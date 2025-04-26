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

  async initialize(): Promise<void> {
    // Nothing to initialize for mock provider
  }

  async getChatHistory(memoryKey: string, threadId: string = 'default'): Promise<CoreMessage[]> {
    const state = await this.getMemoryState(memoryKey, threadId);
    return state?.chatHistory || [];
  }

  async getMemoryState(memoryKey: string, threadId: string = 'default'): Promise<MemoryState | undefined> {
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
      await memoryManager.addMessages(message);
      const chatHistory = await memoryManager.getChatHistory();
      expect(chatHistory).toHaveLength(2); // System message + user message
      expect(chatHistory[1]).toEqual(message);
    });

    it('should add AI message', async () => {
      await memoryManager.initialize();
      const message: CoreMessage = { role: 'assistant', content: 'test response' };
      await memoryManager.addMessages(message);
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

  describe('message operations', () => {
    beforeEach(async () => {
      await memoryManager.initialize();
    });

    it('should add a single message', async () => {
      const message: CoreMessage = { role: 'user', content: 'test message' };
      await memoryManager.addMessages(message);
      const chatHistory = await memoryManager.getChatHistory();
      const userMessages = chatHistory.filter(msg => msg.role === 'user');
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0]?.content).toBe('test message');
    });

    it('should add multiple messages', async () => {
      const messages: CoreMessage[] = [
        { role: 'user', content: 'user message' },
        { role: 'assistant', content: 'assistant message' }
      ];
      await memoryManager.addMessages(messages);
      const chatHistory = await memoryManager.getChatHistory();
      const nonSystemMessages = chatHistory.filter(msg => msg.role !== 'system');
      expect(nonSystemMessages).toHaveLength(2);
      expect(nonSystemMessages[0]?.content).toBe('user message');
      expect(nonSystemMessages[1]?.content).toBe('assistant message');
    });

    it('should maintain message order', async () => {
      const messages: CoreMessage[] = [
        { role: 'user', content: 'first message' },
        { role: 'assistant', content: 'second message' },
        { role: 'user', content: 'third message' }
      ];
      await memoryManager.addMessages(messages);
      const chatHistory = await memoryManager.getChatHistory();
      const nonSystemMessages = chatHistory.filter(msg => msg.role !== 'system');
      expect(nonSystemMessages).toHaveLength(3);
      expect(nonSystemMessages.map(msg => msg.content)).toEqual([
        'first message',
        'second message',
        'third message'
      ]);
    });

    it('should handle empty message array', async () => {
      await memoryManager.addMessages([]);
      const chatHistory = await memoryManager.getChatHistory();
      const nonSystemMessages = chatHistory.filter(msg => msg.role !== 'system');
      expect(nonSystemMessages).toHaveLength(0);
    });
  });

  describe('memory limits configuration', () => {
    it('should initialize with default memory limits', () => {
      const defaultManager = new MemoryManager(
        storageProvider,
        archiveProvider,
        openaiApiKey,
        memoryKey,
        threadId
      );
      expect(defaultManager['chatTokenLimit']).toBe(10000); // Default chat token limit
      expect(defaultManager['maxContextSize']).toBe(20000); // Default max context size
      expect(defaultManager['coreBlockTokenLimit']).toBe(2000); // Default core block token limit
    });

    it('should initialize with custom memory limits', () => {
      const customManager = new MemoryManager(
        storageProvider,
        archiveProvider,
        openaiApiKey,
        memoryKey,
        threadId,
        25000, // maxContextSize
        3000,  // coreBlockTokenLimit
        15000  // chatTokenLimit
      );
      expect(customManager['chatTokenLimit']).toBe(15000);
      expect(customManager['maxContextSize']).toBe(25000);
      expect(customManager['coreBlockTokenLimit']).toBe(3000);
    });

    it('should enforce chat token limit when adding messages', async () => {
      const smallLimitManager = new MemoryManager(
        storageProvider,
        archiveProvider,
        openaiApiKey,
        memoryKey,
        threadId,
        undefined, // default maxContextSize
        undefined, // default coreBlockTokenLimit
        100 // very small chatTokenLimit for testing
      );

      await smallLimitManager.initialize();

      // Add a message that should exceed the token limit
      const longMessage = {
        role: 'user' as const,
        content: 'a'.repeat(200)
      };
      await smallLimitManager.addMessages(longMessage);

      const history = await smallLimitManager.getChatHistory();
      expect(history.length).toBeLessThan(3); // Should only have system message and possibly truncated history
    });

    it('should enforce core block token limit', async () => {
      const smallBlockLimitManager = new MemoryManager(
        storageProvider,
        archiveProvider,
        openaiApiKey,
        memoryKey,
        threadId,
        undefined, // default maxContextSize
        50, // very small coreBlockTokenLimit for testing
        undefined // default chatTokenLimit
      );

      await smallBlockLimitManager.initialize();

      // Try to update core memory with content that exceeds the token limit
      const longContent = 'a'.repeat(500); // This should definitely be more than 50 tokens
      await expect(async () => {
        await smallBlockLimitManager.updateCoreMemory('test-block', longContent, 'test description');
      }).rejects.toThrow('Core memory block content exceeds token limit');
    });

    it('should allow updating memory limits after initialization', async () => {
      await memoryManager.initialize();

      // Update limits
      memoryManager['chatTokenLimit'] = 15000;
      memoryManager['maxContextSize'] = 25000;
      memoryManager['coreBlockTokenLimit'] = 3000;

      expect(memoryManager['chatTokenLimit']).toBe(15000);
      expect(memoryManager['maxContextSize']).toBe(25000);
      expect(memoryManager['coreBlockTokenLimit']).toBe(3000);
    });
  });
}); 
