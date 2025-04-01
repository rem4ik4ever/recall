import { CoreMessage } from "ai";
import { CoreBlock, CoreMemoryEntry, MemoryState } from "../types";

export interface StorageProvider {
  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;

  /**
   * Initialize memory state for a given memory key and thread
   */
  initializeMemoryState(memoryKey: string, threadId?: string, previousState?: MemoryState): Promise<MemoryState>;

  /**
   * Get memory state for a given memory key and thread
   */
  getMemoryState(memoryKey: string, threadId?: string): Promise<MemoryState | undefined>;

  /**
   * Update chat history for a given memory key and thread
   */
  updateChatHistory(params: { memoryKey: string; threadId: string; messages: CoreMessage[] }): Promise<void>;

  /**
   * Add a single message to chat history
   */
  addChatHistoryMessage(params: { memoryKey: string; message: CoreMessage; threadId: string }): Promise<void>;

  /**
   * Get chat history for a given memory key and thread
   */
  getChatHistory(memoryKey: string, threadId?: string): Promise<CoreMessage[]>;

  /**
   * Get core memory for a given memory key
   */
  getCoreMemory(memoryKey: string): Promise<Record<CoreBlock, CoreMemoryEntry> | null>;

  /**
   * Update core memory for a given memory key
   */
  updateCoreMemory(memoryKey: string, memory: Record<CoreBlock, CoreMemoryEntry> | null): Promise<void>;

  /**
   * Delete memory state for a given memory key
   */
  deleteMemoryState(memoryKey: string): Promise<void>;

  /**
   * Clear all memory states
   */
  flush(): Promise<void>;

  /**
   * Export memory state for a given memory key and thread
   */
  export(memoryKey: string, threadId?: string): Promise<MemoryState>;

  /**
   * Get chat history key for a given memory key and thread
   */
  getChatHistoryKey(memoryKey: string, threadId?: string): string;

  /**
   * Get core memory key for a given memory key
   */
  getCoreMemoryKey(memoryKey: string): string;
} 
