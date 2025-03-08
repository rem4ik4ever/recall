import { CoreMessage } from "ai";
import { ArchivalMemoryPayload, CoreBlock, CoreMemoryEntry, MemoryState } from "./types";
import { StorageProvider } from "./storageProviders/storage-provider";
import { summarizeMessages } from "./ai/summarizer";
import { encoding_for_model } from "tiktoken";
import { AGENT_PROMPT } from "./ai/prompts";
import { ArchiveProvider } from "./archiveProviders/base";
import { ArchiveEntry } from "./archiveProviders/types";

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

  constructor(
    provider: StorageProvider,
    archiveProvider: ArchiveProvider,
    openaiApiKey: string,
    memoryKey: string,
    threadId: string,
    maxContextSize?: number,
    coreBlockTokenLimit?: number
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
  }

  async initialize(previousState?: MemoryState): Promise<void> {
    // Load core and archive memory
    const state = await this.provider.initializeMemoryState(this.memoryKey, this.threadId, previousState);
    console.log({ state })
    this.coreMemory = state.coreMemory;

    if (state?.chatHistory && state.chatHistory.length > 0) {
      this.chatHistory = state.chatHistory;
    } else {
      console.log("initializing new chat history", state?.chatHistory)
      // Initialize new chat history with system message
      this.chatHistory = [{ role: 'system', content: this.coreMemoryToString() }];
      await this.saveChatHistory();
    }

    // Ensure core memory changes are persisted
    if (this.coreMemory) {
      await this.saveCoreMemory();
    }
  }

  private async saveChatHistory(): Promise<void> {
    await this.provider.updateChatHistory({
      memoryKey: this.memoryKey,
      threadId: this.threadId,
      messages: this.chatHistory
    });
  }

  private async saveCoreMemory(): Promise<void> {
    await this.provider.updateCoreMemory(this.memoryKey, this.coreMemory);
  }

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

  async getChatHistory(): Promise<CoreMessage[]> {
    return this.chatHistory;
  }

  async addUserMessage(message: CoreMessage): Promise<void> {
    this.chatHistory.push(message);
    await this.checkChatHistorySize();
    await this.saveChatHistory();
  }

  async getCoreMemory(): Promise<Record<CoreBlock, CoreMemoryEntry> | null> {
    return this.provider.getCoreMemory(this.memoryKey) || {};
  }

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

  async searchArchiveMemory(query: string): Promise<ArchiveEntry[]> {
    const result = await this.archiveProvider.searchBySimilarity(query);
    return result.map(r => r.entry);
  }

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

  async updateArchiveMemory(id: string, payload: ArchivalMemoryPayload): Promise<ArchiveEntry | null> {
    const updatedEntry = {
      ...payload,
      timestamp: Date.now(),
    } as Partial<ArchiveEntry>;
    const entry = await this.archiveProvider.updateEntry(id, updatedEntry);
    return entry;
  }

  async removeArchivalMemory(id: string): Promise<ArchiveEntry | null> {
    const entry = await this.archiveProvider.getEntry(id);
    if (!entry) {
      return null;
    }
    await this.archiveProvider.deleteEntry(id);
    return entry;
  }

  async addAIMessage(message: CoreMessage): Promise<void> {
    this.chatHistory.push(message);
    await this.checkChatHistorySize();
    await this.saveChatHistory();
  }

  async addAIMessages(messages: CoreMessage[]): Promise<void> {
    this.chatHistory.push(...messages);
    await this.checkChatHistorySize();
    await this.saveChatHistory();
  }

  /**
   * Get the current context size in tokens
   */
  get contextSize(): number {
    return this.totalTokenCount();
  }

  /**
   * Get the maximum allowed context size in tokens
   */
  get maxContextSize(): number {
    return this._maxContextSize;
  }

  /**
   * Set the maximum allowed context size in tokens
   */
  set maxContextSize(size: number) {
    this._maxContextSize = size;
    // Check if we need to summarize due to new limit
    this.checkChatHistorySize().catch(error => {
      console.error('Error checking chat history size after maxContextSize update:', error);
    });
  }

  private getEncoder() {
    if (!this.encoder) {
      // Using gpt-4o tokenizer as it's compatible with most OpenAI models
      this.encoder = encoding_for_model("gpt-4o");
    }
    return this.encoder;
  }

  private countTokens(text: string): number {
    const encoder = this.getEncoder();
    return encoder.encode(text).length;
  }

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

  // Clean up encoder when the instance is no longer needed
  public dispose(): void {
    if (this.encoder) {
      this.encoder.free();
      this.encoder = null;
    }
  }

  /**
   * Get the core block token limit
   */
  get coreMemoryBlockLimit(): number {
    return this.coreBlockTokenLimit;
  }

  /**
   * Set the core block token limit
   */
  set coreMemoryBlockLimit(limit: number) {
    this.coreBlockTokenLimit = limit;
  }
} 
