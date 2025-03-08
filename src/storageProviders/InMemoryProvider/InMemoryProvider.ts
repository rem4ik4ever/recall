import { CoreMessage } from 'ai';
import { MemoryState, CoreMemoryEntry, ArchiveEntry } from '../../types';
import { StorageProvider } from '../storage-provider';

export class InMemoryProvider implements StorageProvider {
  // Separate storage maps for each component
  private storage: Map<string, MemoryState> = new Map();
  private chatHistoryStorage: Map<string, CoreMessage[]> = new Map();
  private coreMemoryStorage: Map<string, Record<string, CoreMemoryEntry> | null> = new Map();
  private archiveMemoryStorage: Map<string, ArchiveEntry[]> = new Map();

  async flush(): Promise<void> {
    this.storage.clear();
    this.chatHistoryStorage.clear();
    this.coreMemoryStorage.clear();
    this.archiveMemoryStorage.clear();
  }

  async export(memoryKey: string, threadId: string = 'default'): Promise<MemoryState> {
    const coreMemory = this.coreMemoryStorage.get(this.getCoreMemoryKey(memoryKey)) || null;
    const archiveMemory = this.archiveMemoryStorage.get(this.getArchiveMemoryKey(memoryKey)) || [];

    const chatHistory = this.chatHistoryStorage.get(this.getChatHistoryKey(memoryKey, threadId)) || [];

    return {
      chatHistory,
      coreMemory,
      //archiveMemory
    };
  }

  // Get complete memory state for a key
  async getMemoryState(memoryKey: string): Promise<MemoryState | undefined> {
    const chatHistory = this.chatHistoryStorage.get(this.getChatHistoryKey(memoryKey)) || [];
    const coreMemory = this.coreMemoryStorage.get(this.getCoreMemoryKey(memoryKey)) || null;
    //const archiveMemory = this.archiveMemoryStorage.get(this.getArchiveMemoryKey(memoryKey)) || [];

    return {
      chatHistory,
      coreMemory,
      //archiveMemory
    };
  }

  // Initialize memory state if it doesn't exist
  async initializeMemoryState(memoryKey: string, threadId: string, previousState?: MemoryState): Promise<MemoryState> {
    const existingState = await this.getMemoryState(memoryKey);
    if (!existingState?.coreMemory) {
      const initialState: MemoryState = {
        chatHistory: previousState?.chatHistory || [],
        coreMemory: previousState?.coreMemory || null,
        //archiveMemory: previousState?.archiveMemory || []
      };
      console.log("initialState", initialState)

      // Initialize component-specific storages
      await this.updateChatHistory({
        memoryKey,
        threadId,
        messages: initialState.chatHistory
      });
      await this.updateCoreMemory(memoryKey, initialState.coreMemory);
      //await this.updateArchiveMemory(memoryKey, initialState.archiveMemory);

      return initialState;
    }
    return existingState;
  }

  // Update chat history for a specific thread
  async updateChatHistory({
    memoryKey,
    threadId,
    messages
  }: {
    memoryKey: string;
    threadId: string;
    messages: CoreMessage[];
  }): Promise<void> {
    this.chatHistoryStorage.set(this.getChatHistoryKey(memoryKey, threadId), messages);
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
    const key = this.getChatHistoryKey(memoryKey, threadId);
    const messages = this.chatHistoryStorage.get(key) || [];
    messages.push(message);
    this.chatHistoryStorage.set(key, messages);
  }

  async getCoreMemory(memoryKey: string): Promise<Record<string, CoreMemoryEntry> | null> {
    return this.coreMemoryStorage.get(this.getCoreMemoryKey(memoryKey)) || null;
  }

  // Update core memory
  async updateCoreMemory(key: string, memory: Record<string, CoreMemoryEntry> | null): Promise<void> {
    this.coreMemoryStorage.set(this.getCoreMemoryKey(key), memory);
  }

  // Update archive memory
  async updateArchiveMemory(key: string, entries: ArchiveEntry[]): Promise<void> {
    this.archiveMemoryStorage.set(this.getArchiveMemoryKey(key), entries);
  }

  // Delete memory state for a key
  async deleteMemoryState(memoryKey: string): Promise<void> {
    this.storage.delete(memoryKey);
    this.chatHistoryStorage.delete(this.getChatHistoryKey(memoryKey));
    this.coreMemoryStorage.delete(this.getCoreMemoryKey(memoryKey));
    this.archiveMemoryStorage.delete(this.getArchiveMemoryKey(memoryKey));
  }

  // Get chat history key
  getChatHistoryKey(memoryKey: string, threadId: string = 'default'): string {
    return `${memoryKey}::chat-history::thread::${threadId}`;
  }

  // Get core memory key
  getCoreMemoryKey(memoryKey: string): string {
    // Remove any thread-specific part before adding core memory suffix
    return `${memoryKey}::core-memory`;
  }

  // Get archive memory key
  getArchiveMemoryKey(memoryKey: string): string {
    return `${memoryKey}::archive-memory`;
  }
}
