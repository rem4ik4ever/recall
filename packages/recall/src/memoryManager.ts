import { CoreMessage } from "ai";
import { ArchivalMemoryPayload, CoreBlock, CoreMemoryEntry, MemoryState } from "@aksolab/recall-types";
import { StorageProvider } from "@aksolab/recall-storage-provider";
import { summarizeMessages } from "./ai/summarizer";
import { encoding_for_model } from "tiktoken";
import { AGENT_PROMPT } from "./ai/prompts";
import { ArchiveProvider, ArchiveEntry } from "@aksolab/recall-archive-provider";

export class MemoryManager {
  private provider: StorageProvider;
  private archiveProvider: ArchiveProvider;
  private openaiApiKey: string;
  private memoryKey: string;
  private threadId: string;
  private chatHistory: CoreMessage[] = [];
  private coreMemory: Record<CoreBlock, CoreMemoryEntry> | null = null;
  private encoder: ReturnType<typeof encoding_for_model> | null = null;

  private chatTokenLimit: number = 10000; // default token limit
  private _maxContextSize: number = 20000; // default max context size
  private coreBlockTokenLimit: number = 2000; // default core block token limit

  /**
   * Creates a new instance of the MemoryManager.
   * @param provider - Storage provider for chat history and core memory
   * @param archiveProvider - Provider for archival memory and RAG capabilities
   * @param openaiApiKey - OpenAI API key for embeddings and summarization
   * @param memoryKey - Unique identifier for this memory instance
   * @param threadId - Conversation thread identifier
   * @param maxContextSize - Optional maximum context size in tokens
   * @param coreBlockTokenLimit - Optional token limit for core memory blocks
   */
  constructor(
    provider: StorageProvider,
    archiveProvider: ArchiveProvider,
    openaiApiKey: string,
    memoryKey: string,
    threadId: string,
    maxContextSize?: number,
    coreBlockTokenLimit?: number,
    chatTokenLimit?: number
  ) {
    this.provider = provider;
    this.archiveProvider = archiveProvider;
    this.openaiApiKey = openaiApiKey;
    this.memoryKey = memoryKey;
    this.threadId = threadId;
    if (maxContextSize) {
      this._maxContextSize = maxContextSize;
    }
    if (coreBlockTokenLimit) {
      this.coreBlockTokenLimit = coreBlockTokenLimit;
    }
    if (chatTokenLimit) {
      this.chatTokenLimit = chatTokenLimit;
    }
  }

  /**
   * Initializes the memory manager with optional previous state.
   * @param previousState - Optional previous memory state to restore
   */
  async initialize(previousState?: MemoryState): Promise<void> {
    // Load core and archive memory
    const state = await this.provider.initializeMemoryState(this.memoryKey, this.threadId, previousState);
    this.coreMemory = state.coreMemory;

    if (state?.chatHistory && state.chatHistory.length > 0) {
      this.chatHistory = state.chatHistory;
    } else {
      // Initialize new chat history with system message
      this.chatHistory = [{ role: 'system', content: this.coreMemoryToString() }];
      await this.saveChatHistory();
    }

    // Ensure core memory changes are persisted
    if (this.coreMemory) {
      await this.saveCoreMemory();
    }
  }

  /**
   * Saves the current chat history to the storage provider.
   * @private
   */
  private async saveChatHistory(): Promise<void> {
    await this.provider.updateChatHistory({
      memoryKey: this.memoryKey,
      threadId: this.threadId,
      messages: this.chatHistory
    });
  }

  /**
   * Saves the current core memory to the storage provider.
   * @private
   */
  private async saveCoreMemory(): Promise<void> {
    await this.provider.updateCoreMemory(this.memoryKey, this.coreMemory);
  }

  /**
   * Converts core memory blocks to a string representation.
   * @private
   * @returns Formatted string of core memory blocks
   */
  private coreMemoryToString(): string {
    const coreMemoryEntries = this.coreMemory
      ? Object.entries(this.coreMemory)
        .map(([key, entry]) => {
          return `Name: ${key}\nDescription: ${entry.description}\nContent: ${entry.content}`
        })
        .join("\n---\n")
      : 'No core memory available';

    return `${AGENT_PROMPT}\n\nCore Memory:\n${coreMemoryEntries}\n\n`;
  }

  /**
   * Retrieves the complete chat history.
   * @returns Promise resolving to an array of chat messages
   */
  async getChatHistory(): Promise<CoreMessage[]> {
    return this.chatHistory;
  }

  /**
   * Adds one or more messages to the chat history.
   * @param messages - A single message or array of messages to add
   * @example
   * // Add a single message
   * await memoryManager.addMessages({ role: 'user', content: 'Hello!' });
   * 
   * // Add multiple messages
   * await memoryManager.addMessages([
   *   { role: 'assistant', content: 'Hi!' },
   *   { role: 'user', content: 'How are you?' }
   * ]);
   */
  async addMessages(messages: CoreMessage | CoreMessage[]): Promise<void> {
    const messageArray = Array.isArray(messages) ? messages : [messages];
    this.chatHistory.push(...messageArray);
    await this.checkChatHistorySize();
    await this.saveChatHistory();
  }

  /**
   * @deprecated Use {@link addMessages} instead. This method will be removed in the next major version.
   * @example
   * // Instead of:
   * await memoryManager.addUserMessage(message);
   * 
   * // Use:
   * await memoryManager.addMessages(message);
   */
  async addUserMessage(message: CoreMessage): Promise<void> {
    return this.addMessages(message);
  }

  /**
   * @deprecated Use {@link addMessages} instead. This method will be removed in the next major version.
   * @example
   * // Instead of:
   * await memoryManager.addAIMessage(message);
   * 
   * // Use:
   * await memoryManager.addMessages(message);
   */
  async addAIMessage(message: CoreMessage): Promise<void> {
    return this.addMessages(message);
  }

  /**
   * @deprecated Use {@link addMessages} instead. This method will be removed in the next major version.
   * @example
   * // Instead of:
   * await memoryManager.addAIMessages(messages);
   * 
   * // Use:
   * await memoryManager.addMessages(messages);
   */
  async addAIMessages(messages: CoreMessage[]): Promise<void> {
    return this.addMessages(messages);
  }

  /**
   * Retrieves the current state of core memory.
   * @returns Promise resolving to a record of core memory blocks and their entries
   */
  async getCoreMemory(): Promise<Record<CoreBlock, CoreMemoryEntry> | null> {
    return this.provider.getCoreMemory(this.memoryKey) || {};
  }

  /**
   * Updates a core memory block with new content.
   * @param block - The core memory block to update
   * @param content - New content for the block
   * @param description - Optional description for the block
   * @throws {Error} If content exceeds token limit
   */
  async updateCoreMemory(block: CoreBlock, content: string, description?: string): Promise<void> {
    if (!this.coreMemory) {
      this.coreMemory = await this.getCoreMemory() || {};
    }

    // Check token count for the content
    const contentTokens = this.countTokens(content);
    if (contentTokens > this.coreBlockTokenLimit) {
      throw new Error(`Core memory block content exceeds token limit of ${this.coreBlockTokenLimit} tokens. Current: ${contentTokens} tokens.`);
    }

    this.coreMemory[block] = { content, description: description || this.coreMemory[block]?.description || '' };

    if (this.chatHistory[0]?.role === 'system') {
      this.chatHistory[0].content = this.coreMemoryToString();
      await this.saveChatHistory();
    }
    await this.saveCoreMemory();
  }

  /**
   * Searches the archive memory using semantic similarity.
   * @param query - Search query text
   * @returns Promise resolving to array of matching archive entries
   */
  async searchArchiveMemory(query: string): Promise<ArchiveEntry[]> {
    const result = await this.archiveProvider.searchBySimilarity(query);
    return result.map(r => r.entry);
  }

  /**
   * Adds a new entry to the archive memory.
   * @param payload - Archive entry data to add
   * @returns Promise resolving to the created archive entry
   */
  async addToArchiveMemory(payload: ArchivalMemoryPayload): Promise<ArchiveEntry> {
    const timestamp = Date.now();
    const id = payload.id || `archival_memory_${timestamp}`;
    const newEntry: ArchiveEntry = {
      id,
      content: payload.content,
      name: payload.name,
      timestamp,
    };
    const entry = await this.archiveProvider.addEntry(newEntry);
    return entry;
  }

  /**
   * Updates an existing archive memory entry.
   * @param id - ID of the entry to update
   * @param payload - Updated archive entry data
   * @returns Promise resolving to the updated archive entry
   */
  async updateArchiveMemory(id: string, payload: ArchivalMemoryPayload): Promise<ArchiveEntry | null> {
    const updatedEntry = {
      ...payload,
      timestamp: Date.now(),
    } as Partial<ArchiveEntry>;
    const entry = await this.archiveProvider.updateEntry(id, updatedEntry);
    return entry;
  }

  /**
   * Removes an entry from archive memory.
   * @param id - ID of the entry to remove
   * @returns Promise resolving to the removed entry, or null if not found
   */
  async removeArchivalMemory(id: string): Promise<ArchiveEntry | null> {
    const entry = await this.archiveProvider.getEntry(id);
    if (!entry) {
      return null;
    }
    await this.archiveProvider.deleteEntry(id);
    return entry;
  }

  /**
   * Gets the current context size in tokens.
   */
  get contextSize(): number {
    return this.totalTokenCount();
  }

  /**
   * Gets the maximum allowed context size in tokens.
   */
  get maxContextSize(): number {
    return this._maxContextSize;
  }

  /**
   * Sets the maximum allowed context size in tokens.
   * Triggers chat history summarization if needed.
   */
  set maxContextSize(size: number) {
    this._maxContextSize = size;
    // Check if we need to summarize due to new limit
    this.checkChatHistorySize().catch(error => {
      console.error('Error checking chat history size after maxContextSize update:', error);
    });
  }

  /**
   * Gets or initializes the token encoder.
   * @private
   * @returns Token encoder instance
   */
  private getEncoder() {
    if (!this.encoder) {
      // Using gpt-4o tokenizer as it's compatible with most OpenAI models
      this.encoder = encoding_for_model("gpt-4o");
    }
    return this.encoder;
  }

  /**
   * Counts the number of tokens in a text string.
   * @private
   * @param text - Text to count tokens for
   * @returns Number of tokens
   */
  private countTokens(text: string): number {
    const encoder = this.getEncoder();
    return encoder.encode(text).length;
  }

  /**
   * Calculates the total token count of the chat history.
   * @private
   * @returns Total number of tokens
   */
  private totalTokenCount(): number {
    return this.chatHistory.reduce((total, message) => {
      if (typeof message.content === 'string') {
        return total + this.countTokens(message.content);
      }
      if (Array.isArray(message.content)) {
        return total + message.content.reduce((acc, item) => {
          if (item.type === 'text') {
            acc += this.countTokens(item.text);
          } else if (['tool-call', 'tool-result'].includes(item.type)) {
            acc += this.countTokens(JSON.stringify(item));
          }
          return acc;
        }, 0);
      }
      return total;
    }, 0);
  }

  /**
   * Checks and manages chat history size, summarizing if needed.
   * @private
   */
  private async checkChatHistorySize(): Promise<void> {
    while (this.totalTokenCount() > this.chatTokenLimit) {
      // Keep the system message (index 0) and last message
      const messagesToSummarize = this.chatHistory.slice(1, -1);
      if (messagesToSummarize.length === 0) break;

      const summary = await summarizeMessages(messagesToSummarize, this.openaiApiKey);
      const firstMessage = this.chatHistory[0];
      const lastMessage = this.chatHistory[this.chatHistory.length - 1];

      if (!firstMessage || !lastMessage) {
        return;
      }

      this.chatHistory = [
        firstMessage,
        { role: 'system', content: `Previous conversation summary: ${summary}` },
        lastMessage
      ];
      await this.saveChatHistory();
    }
  }

  /**
   * Cleans up resources when the instance is no longer needed.
   */
  public dispose(): void {
    if (this.encoder) {
      this.encoder.free();
      this.encoder = null;
    }
  }

  /**
   * Gets the token limit for core memory blocks.
   */
  get coreMemoryBlockLimit(): number {
    return this.coreBlockTokenLimit;
  }

  /**
   * Sets the token limit for core memory blocks.
   */
  set coreMemoryBlockLimit(limit: number) {
    this.coreBlockTokenLimit = limit;
  }
} 
