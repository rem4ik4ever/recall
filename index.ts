import {
  CoreBlockConfig,
  MemoryManager,
  StorageProvider,
  DEFAULT_CORE_BLOCKS,
  ChatSession,
  MemoryState,
  CoreMessage
} from "./src";
import { createTools } from "./src/ai/tools";
import { ArchiveProvider } from "./src/archiveProviders/base";

export * from './src/storageProviders/RedisProvider'
export * from './src/storageProviders/InMemoryProvider/InMemoryProvider'
export * from './src/archiveProviders'
export { type ChatSession } from './src/types'

export interface RecallConfig {
  storageProvider: StorageProvider;
  archiveProvider: ArchiveProvider;
  openaiApiKey: string;
  coreBlocks?: CoreBlockConfig[];
  memoryKey: string;
  threadId?: string;
  previousState?: MemoryState;
}

export class Recall implements ChatSession {
  private memoryManager: MemoryManager;
  private _tools: Record<string, any> = {};

  constructor(config: RecallConfig) {
    const {
      storageProvider,
      archiveProvider,
      openaiApiKey,
      coreBlocks = DEFAULT_CORE_BLOCKS,
      memoryKey,
      threadId = 'default',
      previousState
    } = config;

    this.memoryManager = new MemoryManager(
      storageProvider,
      archiveProvider,
      openaiApiKey,
      memoryKey,
      threadId
    );

    // Initialize the session
    this.initializeSession(coreBlocks, previousState);
  }

  private async initializeSession(coreBlocks: CoreBlockConfig[], previousState?: MemoryState): Promise<void> {
    // Initialize archive provider
    await this.memoryManager.initialize(previousState);

    // Initialize core blocks with default content
    for (const block of coreBlocks) {
      const existingMemory = await this.memoryManager.getCoreMemory();
      const existingEntry = existingMemory?.[block.key];
      if (!existingEntry) {
        await this.memoryManager.updateCoreMemory(block.key, block?.defaultContent ?? '', block.description);
      }
    }

    // Initialize tools
    this._tools = await createTools(this.memoryManager);
  }

  // ChatSession interface methods
  async chatHistory(): Promise<CoreMessage[]> {
    return this.memoryManager.getChatHistory();
  }

  async addUserMessage(message: CoreMessage): Promise<void> {
    return this.memoryManager.addUserMessage(message);
  }

  async addAIMessage(message: CoreMessage): Promise<void> {
    return this.memoryManager.addAIMessage(message);
  }

  async addAIMessages(messages: CoreMessage[]): Promise<void> {
    return this.memoryManager.addAIMessages(messages);
  }

  async getCoreBlocks() {
    return this.memoryManager.getCoreMemory();
  }

  get tools(): Record<string, any> {
    return this._tools;
  }
} 
