import type { RedisClientType } from 'redis';
import { RedisArchiveProvider, setupRedisSchema } from './RedisArchiveProvider';
import { ArchiveEntry } from '@aksolab/recall';

// Mock the ai package
jest.mock('ai', () => ({
  embed: jest.fn().mockImplementation(() => ({
    embedding: new Array(1536).fill(0.1)
  }))
}));

// Create a mock Redis client
const mockRedisClient = {
  moduleList: jest.fn().mockResolvedValue([{ name: 'search' }]),
  ft: {
    info: jest.fn().mockResolvedValue({ numDocs: '0' }),
    create: jest.fn().mockResolvedValue('OK'),
    dropIndex: jest.fn().mockResolvedValue('OK'),
    search: jest.fn().mockResolvedValue({ documents: [] })
  },
  json: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null)
  },
  keys: jest.fn().mockResolvedValue([]),
  del: jest.fn().mockResolvedValue(1)
} as any;

describe('RedisArchiveProvider', () => {
  let provider: RedisArchiveProvider;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create a new provider instance
    provider = new RedisArchiveProvider({
      client: mockRedisClient,
      indexName: 'test:archive',
      collectionName: 'test:archive:'
    });

    // Setup default mock responses
    mockRedisClient.moduleList.mockResolvedValue([{ name: 'search' }]);
    mockRedisClient.ft.info.mockResolvedValue({ numDocs: '0' });
  });

  //describe('initialization', () => {
  //  it('should check for Redis Search module availability', async () => {
  //    await provider.initialize();
  //    expect(mockRedisClient.moduleList).toHaveBeenCalled();
  //  });

  //  it('should throw error if Redis Search is not available', async () => {
  //    mockRedisClient.moduleList.mockResolvedValue([{ name: 'other' }]);
  //    await expect(provider.initialize()).rejects.toThrow('Redis Search module is not available');
  //  });

  //  it('should check if index exists', async () => {
  //    await provider.initialize();
  //    expect(mockRedisClient.ft.info).toHaveBeenCalledWith('test:archive');
  //  });

  //  it('should throw error if index does not exist', async () => {
  //    mockRedisClient.ft.info.mockRejectedValue(new Error('Unknown Index'));
  //    await expect(provider.initialize()).rejects.toThrow('Redis Search index');
  //  });
  //});

  describe('schema setup', () => {
    it('should create schema with correct configuration', async () => {
      await setupRedisSchema(mockRedisClient, 'test:archive', 'test:archive:', 1536);
      expect(mockRedisClient.ft.create).toHaveBeenCalled();
      const createCall = mockRedisClient.ft.create.mock.calls[0];
      expect(createCall[0]).toBe('test:archive');
      expect(mockRedisClient.ft.info).toHaveBeenCalledWith('test:archive');
    });

    it('should handle existing index during setup', async () => {
      // Mock that dropping index fails with Unknown Index
      mockRedisClient.ft.dropIndex.mockRejectedValueOnce(new Error('Unknown Index'));

      await setupRedisSchema(mockRedisClient);
      expect(mockRedisClient.ft.create).toHaveBeenCalled();
      expect(mockRedisClient.ft.info).toHaveBeenCalled();
    });

    it('should handle errors during index creation', async () => {
      mockRedisClient.ft.create.mockRejectedValueOnce(new Error('Creation failed'));
      await expect(setupRedisSchema(mockRedisClient)).rejects.toThrow('Creation failed');
    });

    it('should verify index was created successfully', async () => {
      await setupRedisSchema(mockRedisClient);
      expect(mockRedisClient.ft.info).toHaveBeenCalled();
      expect(mockRedisClient.ft.create).toHaveBeenCalled();
    });
  });

  describe('entry management', () => {
    const testEntry: ArchiveEntry = {
      name: 'Test Entry',
      content: 'Test Content',
      metadata: 'Test Metadata',
      timestamp: Date.now()
    };

    it('should add new entry', async () => {
      const result = await provider.addEntry(testEntry);
      expect(mockRedisClient.json.set).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('embeddings');
    });

    it('should get entry by id', async () => {
      mockRedisClient.json.get.mockResolvedValue({
        ...testEntry,
        embeddings: new Array(1536).fill(0.1)
      });

      const result = await provider.getEntry('test-id');
      expect(mockRedisClient.json.get).toHaveBeenCalled();
      expect(result).toMatchObject(testEntry);
    });

    it('should update entry', async () => {
      const existingEntry = { ...testEntry, id: 'test-id', embeddings: new Array(1536).fill(0.1) };
      mockRedisClient.json.get.mockResolvedValue(existingEntry);

      const update = { content: 'Updated Content' };
      const result = await provider.updateEntry('test-id', update);
      expect(mockRedisClient.json.set).toHaveBeenCalled();
      expect(result.content).toBe(update.content);
    });

    it('should delete entry', async () => {
      await provider.deleteEntry('test-id');
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  describe('search operations', () => {
    const mockSearchResults = {
      documents: [
        {
          id: 'test:archive:1',
          value: {
            name: 'Test 1',
            content: 'Content 1',
            metadata: '',
            timestamp: Date.now(),
            vector_score: '0.5'
          }
        },
        {
          id: 'test:archive:2',
          value: {
            name: 'Test 2',
            content: 'Content 2',
            metadata: '',
            timestamp: Date.now(),
            vector_score: '0.8'
          }
        }
      ]
    };

    beforeEach(() => {
      mockRedisClient.ft.search.mockResolvedValue(mockSearchResults);
    });

    it('should perform text search', async () => {
      const results = await provider.searchByText('test query');
      expect(mockRedisClient.ft.search).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('matches');
    });

    it('should perform similarity search', async () => {
      const results = await provider.searchBySimilarity('test query');
      expect(mockRedisClient.ft.search).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('score');
    });

    it('should perform hybrid search', async () => {
      const results = await provider.hybridSearch('test query');
      expect(mockRedisClient.ft.search).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('matches');
    });

    it('should handle empty search results', async () => {
      mockRedisClient.ft.search.mockResolvedValue({ documents: [] });
      const results = await provider.searchByText('no results');
      expect(results).toHaveLength(0);
    });
  });

  describe('utility operations', () => {
    it('should list entries', async () => {
      mockRedisClient.ft.search.mockResolvedValue({
        documents: [
          {
            id: 'test:archive:1',
            value: {
              name: 'Test 1',
              content: 'Content 1',
              timestamp: Date.now()
            }
          }
        ]
      });

      const results = await provider.listEntries();
      expect(mockRedisClient.ft.search).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('should clear all entries', async () => {
      mockRedisClient.keys.mockResolvedValue(['key1', 'key2']);
      await provider.clear();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should get entry count', async () => {
      const mockInfo = { numDocs: '42' };
      mockRedisClient.ft.info.mockResolvedValueOnce(mockInfo);
      const count = await provider.count();
      expect(count).toBe(42);
    });
  });
}); 
