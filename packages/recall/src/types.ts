import { CoreMessage } from 'ai'
import { ArchiveProvider } from '@aksolab/recall-archive-provider';
import { StorageProvider } from '@aksolab/recall-storage-provider';
import { CoreBlockConfig, MemoryState } from '@aksolab/recall-types'
export type { CoreMessage };

export interface RecallConfig {
  storageProvider: StorageProvider;
  archiveProvider: ArchiveProvider;
  openaiApiKey: string;
  coreBlocks?: CoreBlockConfig[];
  memoryKey: string;
  threadId?: string;
  previousState?: MemoryState;
  memoryOptions?: {
    chatTokenLimit?: number;     // Default: 10000
    maxContextSize?: number;     // Default: 20000
    coreBlockTokenLimit?: number; // Default: 2000
  };
}
