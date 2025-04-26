export * from './memoryManager';
export * from './constants';
export * from './types';
export * from './ai';

import { ChatSession, CoreMessage, CoreBlockConfig, MemoryState } from '@aksolab/recall-types';
import { RecallConfig } from './types';
import { MemoryManager } from './memoryManager';
import { DEFAULT_CORE_BLOCKS } from './constants';
import { createTools } from './ai';

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
      previousState,
      memoryOptions = {}
    } = config;

    const {
      chatTokenLimit,
      maxContextSize,
      coreBlockTokenLimit
    } = memoryOptions;

    this.memoryManager = new MemoryManager(
      storageProvider,
      archiveProvider,
      openaiApiKey,
      memoryKey,
      threadId,
      maxContextSize,
      coreBlockTokenLimit,
      chatTokenLimit
    );

    // Initialize the session
    this.initializeSession(coreBlocks, previousState);
  }

  private async initializeSession(coreBlocks: CoreBlockConfig[], previousState?: MemoryState): Promise<void> {
    // Initialize memory manager
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

  async addMessages(messages: CoreMessage | CoreMessage[]): Promise<void> {
    return this.memoryManager.addMessages(messages);
  }

  /**
   * @deprecated Use {@link addMessages} instead. This method will be removed in the next major version.
   * @example
   * // Instead of:
   * await recall.addUserMessage(message);
   * 
   * // Use:
   * await recall.addMessages(message);
   */
  async addUserMessage(message: CoreMessage): Promise<void> {
    return this.addMessages(message);
  }

  /**
   * @deprecated Use {@link addMessages} instead. This method will be removed in the next major version.
   * @example
   * // Instead of:
   * await recall.addAIMessage(message);
   * 
   * // Use:
   * await recall.addMessages(message);
   */
  async addAIMessage(message: CoreMessage): Promise<void> {
    return this.addMessages(message);
  }

  /**
   * @deprecated Use {@link addMessages} instead. This method will be removed in the next major version.
   * @example
   * // Instead of:
   * await recall.addAIMessages(messages);
   * 
   * // Use:
   * await recall.addMessages(messages);
   */
  async addAIMessages(messages: CoreMessage[]): Promise<void> {
    return this.addMessages(messages);
  }

  async getCoreBlocks() {
    return this.memoryManager.getCoreMemory();
  }

  get tools(): Record<string, any> {
    return this._tools;
  }
}
