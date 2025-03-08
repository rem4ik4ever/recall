import {
  CoreBlockConfig,
  MemoryManager,
  StorageProvider,
  DEFAULT_CORE_BLOCKS,
  ChatSession,
  MemoryState
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
}

export class Recall {
  private storageProvider: StorageProvider;
  private archiveProvider: ArchiveProvider;
  private openaiApiKey: string;
  private coreBlocks: CoreBlockConfig[];

  constructor(config: RecallConfig) {
    this.storageProvider = config.storageProvider;
    this.openaiApiKey = config.openaiApiKey;
    this.coreBlocks = config.coreBlocks || DEFAULT_CORE_BLOCKS;
    this.archiveProvider = config.archiveProvider;
  }

  async createChatSession(memoryKey: string, threadId: string = 'default', previousState?: MemoryState): Promise<ChatSession> {
    const memoryManager = new MemoryManager(this.storageProvider, this.archiveProvider, this.openaiApiKey, memoryKey, threadId);
    await this.archiveProvider.initialize()

    // Initialize memory manager
    await memoryManager.initialize(previousState);

    // Initialize core blocks with default content
    for (const block of this.coreBlocks) {
      const existingMemory = await memoryManager.getCoreMemory();
      const existingEntry = existingMemory?.[block.key];
      if (!existingEntry) {
        await memoryManager.updateCoreMemory(block.key, block?.defaultContent ?? '', block.description);
      }
    }

    return {
      chatHistory: memoryManager.getChatHistory.bind(memoryManager),
      addUserMessage: memoryManager.addUserMessage.bind(memoryManager),
      addAIMessage: memoryManager.addAIMessage.bind(memoryManager),
      addAIMessages: memoryManager.addAIMessages.bind(memoryManager),
      getCoreBlocks: memoryManager.getCoreMemory.bind(memoryManager),
      tools: await createTools(memoryManager)
    };
  }
} 
