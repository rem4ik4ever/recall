import { CoreMessage } from 'ai';
import { MemoryState, CoreBlock, CoreMemoryEntry, ArchiveEntry } from '../../types';
import { StorageProvider } from '../storage-provider';
import { RedisClientType } from 'redis';

export interface RedisProviderConfig {
  client: RedisClientType;
  prefix?: string;
}

export class RedisProvider implements StorageProvider {
  private redis: RedisClientType;
  private prefix: string;

  constructor(config: RedisProviderConfig) {
    this.redis = config.client;
    this.prefix = config.prefix || 'recall:memory:';

    // Verify Redis connection in constructor
    this.redis.ping().catch(error => {
      throw new Error('Failed to connect to Redis: ' + error);
    });
  }

  private getKey(memoryKey: string): string {
    return `${this.prefix}${memoryKey}`;
  }

  getChatHistoryKey(memoryKey: string, threadId: string = 'default'): string {
    return `${this.getKey(memoryKey)}::chat-history::thread::${threadId}`;
  }

  getCoreMemoryKey(memoryKey: string): string {
    return `${this.getKey(memoryKey)}::core-memory`;
  }

  async flush(): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  // Export is for in memory provider only
  async export(memoryKey: string, threadId: string = 'default'): Promise<MemoryState> {
    const state = await this.getMemoryState(memoryKey, threadId);
    if (!state) {
      throw new Error('Memory state not found');
    }
    return state;
  }

  async getMemoryState(memoryKey: string, threadId: string = 'default'): Promise<MemoryState | undefined> {
    const chatHistoryData = await this.redis.get(this.getChatHistoryKey(memoryKey, threadId));
    const coreMemoryData = await this.redis.get(this.getCoreMemoryKey(memoryKey));

    return {
      chatHistory: chatHistoryData ? JSON.parse(chatHistoryData) : [],
      coreMemory: coreMemoryData ? JSON.parse(coreMemoryData) : null,
    };
  }

  async updateChatHistory({
    memoryKey,
    threadId,
    messages
  }: {
    memoryKey: string;
    threadId: string;
    messages: CoreMessage[];
  }): Promise<void> {
    await this.redis.set(this.getChatHistoryKey(memoryKey, threadId), JSON.stringify(messages));
  }

  async addChatHistoryMessage({
    memoryKey,
    message,
    threadId
  }: {
    memoryKey: string;
    message: CoreMessage;
    threadId: string;
  }): Promise<void> {
    const chatHistory = await this.redis.get(this.getChatHistoryKey(memoryKey, threadId));
    const messages = chatHistory ? JSON.parse(chatHistory) : [];
    messages.push(message);
    await this.redis.set(this.getChatHistoryKey(memoryKey, threadId), JSON.stringify(messages));
  }

  async getChatHistory(memoryKey: string, threadId: string = 'default'): Promise<CoreMessage[]> {
    const state = await this.getMemoryState(memoryKey, threadId);
    return state?.chatHistory || [];
  }

  async getCoreMemory(memoryKey: string): Promise<Record<CoreBlock, CoreMemoryEntry> | null> {
    const coreMemory = await this.redis.get(this.getCoreMemoryKey(memoryKey));
    return coreMemory ? JSON.parse(coreMemory) : null;
  }

  async updateCoreMemory(key: string, memory: Record<CoreBlock, CoreMemoryEntry> | null): Promise<void> {
    await this.redis.set(this.getCoreMemoryKey(key), JSON.stringify(memory));
  }

  async initializeMemoryState(memoryKey: string, threadId: string = 'default'): Promise<MemoryState> {
    const existingState = await this.getMemoryState(memoryKey, threadId);
    if (!existingState) {
      const initialState: MemoryState = {
        chatHistory: [],
        coreMemory: null,
      };

      // Initialize each component separately
      await this.updateChatHistory({ memoryKey, threadId, messages: initialState.chatHistory });
      await this.updateCoreMemory(memoryKey, initialState.coreMemory);

      return initialState;
    }
    return existingState;
  }

  async deleteMemoryState(memoryKey: string): Promise<void> {
    const multi = this.redis.multi();

    // Delete all keys associated with this memory key
    multi.del(this.getKey(memoryKey));
    multi.del(this.getChatHistoryKey(memoryKey));
    multi.del(this.getCoreMemoryKey(memoryKey));

    await multi.exec();
  }

  // Additional method to close Redis connection
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
} 
