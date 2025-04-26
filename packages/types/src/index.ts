import { CoreMessage, Tool } from 'ai'
export type { CoreMessage };

export type ArchivalMemoryPayload = {
  id?: string;
  name: string;
  content: string;
  embeddings?: number[];
  metadata?: Record<string, any>;
};

export type CoreBlock = string;

export interface CoreBlockConfig {
  key: CoreBlock;
  description: string;
  defaultContent?: string;
  readOnly?: boolean;
}

export interface CoreMemoryEntry {
  description: string;
  content: string;
}

export interface ArchiveEntry {
  id: string;
  name: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
  embeddings?: number[];
}

export interface MemoryState {
  chatHistory: CoreMessage[];
  coreMemory: Record<CoreBlock, CoreMemoryEntry> | null;
}

export interface MemoryConfig {
  coreBlocks: CoreBlockConfig[];
  initialArchiveMemory?: ArchiveEntry[];
}

export interface ChatSession {
  chatHistory: () => Promise<CoreMessage[]>;
  addUserMessage: (message: CoreMessage) => Promise<void>;
  addAIMessage: (message: CoreMessage) => Promise<void>;
  addAIMessages: (messages: CoreMessage[]) => Promise<void>;
  getCoreBlocks: () => Promise<Record<CoreBlock, CoreMemoryEntry> | null>;
  tools: Record<string, Tool>;
}
