import { CoreMessage } from "ai";
import { CoreBlock, CoreMemoryEntry, MemoryState } from "../types";

export interface StorageProvider {
  // Get complete memory state for a key
  getMemoryState(memoryKey: string): Promise<MemoryState | undefined>;

  // Initialize memory state if it doesn't exist
  initializeMemoryState(memoryKey: string, threadId: string, previousState?: MemoryState): Promise<MemoryState>;

  // Update chat history for a specific thread
  updateChatHistory({
    memoryKey,
    threadId,
    messages
  }: {
    memoryKey: string;
    threadId: string;
    messages: CoreMessage[];
  }): Promise<void>;

  // Add a chat history message for a specific thread
  addChatHistoryMessage({
    memoryKey,
    message,
    threadId
  }: {
    memoryKey: string;
    message: CoreMessage;
    threadId: string;
  }): Promise<void>;

  getCoreMemory(memoryKey: string): Promise<Record<CoreBlock, CoreMemoryEntry> | null>;

  // Update core memory
  updateCoreMemory(key: string, memory: Record<CoreBlock, CoreMemoryEntry> | null): Promise<void>;

  // Delete memory state for a key
  deleteMemoryState(memoryKey: string): Promise<void>;

  // Clear all memory states
  flush(): Promise<void>;

  // Export all memory states
  export(memoryKey: string): Promise<MemoryState>;

  // Get chat history key
  getChatHistoryKey(memoryKey: string, threadId?: string): string;

  // Get core memory key
  getCoreMemoryKey(memoryKey: string): string;

} 
