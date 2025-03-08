import { CoreMessage } from 'ai';
import { MemoryManager } from './memoryManager';
import { StorageProvider } from './storageProviders/storage-provider';
import { ArchiveProvider } from './archiveProviders/base';
import { ArchivalMemoryPayload, CoreBlock, CoreMemoryEntry, MemoryState, ArchiveEntry } from './types';
import { ArchiveEntry as ProviderArchiveEntry, SearchResult, SearchByTextOptions, SearchBySimilarityOptions, HybridSearchOptions, SearchOptions } from './archiveProviders/types';

// Helper function to convert between ArchiveEntry types
function toProviderEntry(entry: Partial<ArchiveEntry>): ProviderArchiveEntry {
  return {
    id: entry.id || `test-${Date.now()}`,
    name: entry.name || '',
    content: entry.content || '',
    timestamp: entry.timestamp || Date.now(),
    metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
    embeddings: entry.embeddings,
  };
}

function toArchiveEntry(entry: ProviderArchiveEntry): ArchiveEntry {
  return {
    id: entry.id || `test-${Date.now()}`,
    name: entry.name,
    content: entry.content,
    timestamp: entry.timestamp,
    metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
    embeddings: entry.embeddings,
  };
}

// Mock implementations
class MockStorageProvider implements StorageProvider {
  private memoryState: Record<string, MemoryState> = {};

  async getMemoryState(memoryKey: string): Promise<MemoryState | undefined> {
    return this.memoryState[memoryKey];
  }

  async initializeMemoryState(memoryKey: string, threadId: string, previousState?: MemoryState): Promise<MemoryState> {
    if (previousState) {
      this.memoryState[memoryKey] = previousState;
      return previousState;
    }
    const newState: MemoryState = {
      chatHistory: [],
      coreMemory: null,
    };
    this.memoryState[memoryKey] = newState;
    return newState;
  }

  async updateChatHistory({ memoryKey, threadId, messages }: { memoryKey: string; threadId: string; messages: CoreMessage[]; }): Promise<void> {
    if (!this.memoryState[memoryKey]) {
      this.memoryState[memoryKey] = { chatHistory: [], coreMemory: null };
    }
    this.memoryState[memoryKey].chatHistory = messages;
  }

  async addChatHistoryMessage({ memoryKey, message, threadId }: { memoryKey: string; message: CoreMessage; threadId: string; }): Promise<void> {
    if (!this.memoryState[memoryKey]) {
      this.memoryState[memoryKey] = { chatHistory: [], coreMemory: null };
    }
    this.memoryState[memoryKey].chatHistory.push(message);
  }

  async getCoreMemory(memoryKey: string): Promise<Record<CoreBlock, CoreMemoryEntry> | null> {
    return this.memoryState[memoryKey]?.coreMemory || null;
  }

  async updateCoreMemory(key: string, memory: Record<CoreBlock, CoreMemoryEntry> | null): Promise<void> {
    if (!this.memoryState[key]) {
      this.memoryState[key] = { chatHistory: [], coreMemory: null };
    }
    this.memoryState[key].coreMemory = memory;
  }

  async updateArchiveMemory(): Promise<void> { }
  async deleteMemoryState(): Promise<void> { }
  async flush(): Promise<void> { }
  async export(): Promise<MemoryState> { return { chatHistory: [], coreMemory: null }; }
  getChatHistoryKey(): string { return ''; }
  getCoreMemoryKey(): string { return ''; }
  getArchiveMemoryKey(): string { return ''; }
  async searchInArchiveMemory(memoryKey: string, query: string, options?: { useVector?: boolean; vectorQuery?: number[]; limit?: number; }): Promise<ArchiveEntry[]> {
    return [];
  }
}

class MockArchiveProvider extends ArchiveProvider {
  private entries: ProviderArchiveEntry[] = [];

  constructor() {
    super({ namespace: 'test' });
  }

  async initialize(): Promise<void> { }
  async cleanup(): Promise<void> { }

  async addEntry(entry: ProviderArchiveEntry): Promise<ProviderArchiveEntry> {
    if (!entry.name || !entry.content) {
      throw new Error('Name and content are required');
    }

    const newEntry: ProviderArchiveEntry = {
      id: entry.id || `test-${Date.now()}`,
      name: entry.name,
      content: entry.content,
      timestamp: entry.timestamp || Date.now(),
      metadata: entry.metadata,
      embeddings: entry.embeddings,
    };
    this.entries.push(newEntry);
    return newEntry;
  }

  async addEntries(entries: ProviderArchiveEntry[]): Promise<ProviderArchiveEntry[]> {
    return Promise.all(entries.map(entry => this.addEntry(entry)));
  }

  async updateEntry(id: string, updates: Partial<ProviderArchiveEntry>): Promise<ProviderArchiveEntry> {
    const index = this.entries.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error(`Entry with id ${id} not found`);
    }
    const existingEntry = this.entries[index];
    if (!existingEntry) {
      throw new Error(`Entry with id ${id} not found`);
    }
    const updatedEntry: ProviderArchiveEntry = {
      id: existingEntry.id,
      name: updates.name || existingEntry.name,
      content: updates.content || existingEntry.content,
      timestamp: updates.timestamp || existingEntry.timestamp,
      metadata: updates.metadata !== undefined ? updates.metadata : existingEntry.metadata,
      embeddings: updates.embeddings !== undefined ? updates.embeddings : existingEntry.embeddings,
    };
    this.entries[index] = updatedEntry;
    return updatedEntry;
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries = this.entries.filter(e => e.id !== id);
  }

  async deleteEntriesByName(name: string): Promise<number> {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter(e => e.name !== name);
    return initialLength - this.entries.length;
  }

  async searchByText(query: string, options?: SearchByTextOptions): Promise<SearchResult[]> {
    return this.entries
      .filter(entry => entry.content.includes(query))
      .map(entry => ({ entry, score: 1 }));
  }

  async searchBySimilarity(query: string, options?: SearchBySimilarityOptions): Promise<SearchResult[]> {
    return this.entries.map(entry => ({ entry, score: 1 }));
  }

  async hybridSearch(query: string, options?: HybridSearchOptions): Promise<SearchResult[]> {
    return this.searchBySimilarity(query, options);
  }

  async listEntries(options?: SearchOptions): Promise<ProviderArchiveEntry[]> {
    return this.entries;
  }

  async getEntry(id: string): Promise<ProviderArchiveEntry | null> {
    return this.entries.find(e => e.id === id) || null;
  }

  async clear(): Promise<void> {
    this.entries = [];
  }

  async count(): Promise<number> {
    return this.entries.length;
  }

  protected async generateEmbeddings(text: string): Promise<number[]> {
    return [0, 0, 0]; // Mock embeddings
  }
}

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let storageProvider: MockStorageProvider;
  let archiveProvider: MockArchiveProvider;
  const openaiApiKey = 'test-key';
  const memoryKey = 'test-memory';
  const threadId = 'test-thread';

  beforeEach(() => {
    storageProvider = new MockStorageProvider();
    archiveProvider = new MockArchiveProvider();
    memoryManager = new MemoryManager(
      storageProvider,
      archiveProvider,
      openaiApiKey,
      memoryKey,
      threadId
    );
  });

  afterEach(() => {
    memoryManager.dispose();
  });

  describe('initialization', () => {
    it('should initialize with empty state', async () => {
      await memoryManager.initialize();
      const chatHistory = await memoryManager.getChatHistory();
      expect(chatHistory).toHaveLength(1); // Should have system message
      const systemMessage = chatHistory[0];
      expect(systemMessage?.role).toBe('system');
    });

    it('should initialize with previous state', async () => {
      const previousState: MemoryState = {
        chatHistory: [{ role: 'user', content: 'test message' }],
        coreMemory: null,
      };
      await memoryManager.initialize(previousState);
      const chatHistory = await memoryManager.getChatHistory();
      expect(chatHistory).toHaveLength(1);
      const message = chatHistory[0];
      expect(message?.content).toBe('test message');
    });
  });

  describe('core memory operations', () => {
    it('should update core memory', async () => {
      await memoryManager.initialize();
      await memoryManager.updateCoreMemory('test-block', 'test content', 'test description');
      const coreMemory = await memoryManager.getCoreMemory();
      const block = coreMemory?.['test-block'];
      expect(block).toBeDefined();
      if (block) {
        expect(block.content).toBe('test content');
        expect(block.description).toBe('test description');
      }
    });
  });

  describe('chat history operations', () => {
    it('should add user message', async () => {
      await memoryManager.initialize();
      const message: CoreMessage = { role: 'user', content: 'test message' };
      await memoryManager.addUserMessage(message);
      const chatHistory = await memoryManager.getChatHistory();
      expect(chatHistory).toHaveLength(2); // System message + user message
      expect(chatHistory[1]).toEqual(message);
    });

    it('should add AI message', async () => {
      await memoryManager.initialize();
      const message: CoreMessage = { role: 'assistant', content: 'test response' };
      await memoryManager.addAIMessage(message);
      const chatHistory = await memoryManager.getChatHistory();
      expect(chatHistory).toHaveLength(2); // System message + AI message
      expect(chatHistory[1]).toEqual(message);
    });
  });

  describe('archive memory operations', () => {
    it('should add to archive memory', async () => {
      await memoryManager.initialize();
      const payload: ArchivalMemoryPayload = {
        name: 'test entry',
        content: 'test content'
      };
      const entry = await memoryManager.addToArchiveMemory(payload);
      expect(entry.name).toBe(payload.name);
      expect(entry.content).toBe(payload.content);
      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });

    it('should search archive memory', async () => {
      await memoryManager.initialize();
      const payload: ArchivalMemoryPayload = {
        name: 'test entry',
        content: 'test content'
      };
      const addedEntry = await memoryManager.addToArchiveMemory(payload);
      const results = await memoryManager.searchArchiveMemory('test');
      expect(results.length).toBeGreaterThan(0);
      if (results.length > 0) {
        const [result] = results;
        if (result) {
          expect(result.name).toBe(payload.name);
          expect(result.id).toBeDefined();
          expect(result.timestamp).toBeDefined();
        }
      }
    });
  });

  describe('context size management', () => {
    it('should respect max context size', async () => {
      memoryManager = new MemoryManager(
        storageProvider,
        archiveProvider,
        openaiApiKey,
        memoryKey,
        threadId,
        1000 // Small max context size for testing
      );
      await memoryManager.initialize();
      expect(memoryManager.maxContextSize).toBe(1000);
    });

    it('should update max context size', async () => {
      await memoryManager.initialize();
      memoryManager.maxContextSize = 15000;
      expect(memoryManager.maxContextSize).toBe(15000);
    });
  });
}); 
