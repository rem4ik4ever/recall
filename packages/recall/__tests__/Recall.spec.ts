import { Recall } from '../index';
import { StorageProvider } from '../src/storageProviders/storage-provider';
import { ArchiveProvider } from '../src/archiveProviders/base';
import { CoreMessage, MemoryState } from '../src/types';

describe('Recall', () => {
  let storageProvider: jest.Mocked<StorageProvider>;
  let archiveProvider: jest.Mocked<ArchiveProvider>;
  let recall: Recall;

  beforeEach(async () => {
    // Mock storage provider
    storageProvider = {
      initializeMemoryState: jest.fn().mockResolvedValue({
        chatHistory: [],
        coreMemory: null
      } as MemoryState),
      getMemoryState: jest.fn().mockResolvedValue({
        chatHistory: [],
        coreMemory: null
      } as MemoryState),
      updateChatHistory: jest.fn(),
      addChatHistoryMessage: jest.fn(),
      getChatHistory: jest.fn().mockResolvedValue([]),
      getCoreMemory: jest.fn().mockResolvedValue({
        user: { content: '', description: 'User information' },
        customBlock: { content: 'Default content', description: 'Custom block' }
      }),
      updateCoreMemory: jest.fn(),
      deleteMemoryState: jest.fn(),
      flush: jest.fn(),
      export: jest.fn().mockResolvedValue({
        chatHistory: [],
        coreMemory: null
      } as MemoryState),
      getChatHistoryKey: jest.fn(),
      getCoreMemoryKey: jest.fn()
    } as unknown as jest.Mocked<StorageProvider>;

    // Mock archive provider with all required methods
    archiveProvider = {
      config: {},
      cleanup: jest.fn(),
      addEntry: jest.fn(),
      addEntries: jest.fn(),
      searchByText: jest.fn(),
      searchBySimilarity: jest.fn(),
      hybridSearch: jest.fn(),
      getEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      deleteEntriesByName: jest.fn(),
      listEntries: jest.fn(),
      clear: jest.fn(),
      count: jest.fn()
    } as unknown as jest.Mocked<ArchiveProvider>;

    recall = new Recall({
      storageProvider,
      archiveProvider,
      openaiApiKey: 'test-key',
      memoryKey: 'test-memory'
    });
  });

  describe('initialization', () => {
    it('should initialize with default core blocks', async () => {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      const coreBlocks = await recall.getCoreBlocks();
      expect(coreBlocks).toBeDefined();
      expect(coreBlocks?.user).toBeDefined();
      expect(coreBlocks?.user?.content).toBe('');
    });

    it('should initialize with custom core blocks', async () => {
      const customRecall = new Recall({
        storageProvider,
        archiveProvider,
        openaiApiKey: 'test-key',
        memoryKey: 'test-memory',
        coreBlocks: [{
          key: 'customBlock',
          description: 'Custom block',
          defaultContent: 'Default content'
        }]
      });

      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      const coreBlocks = await customRecall.getCoreBlocks();
      expect(coreBlocks).toBeDefined();
      expect(coreBlocks?.customBlock).toBeDefined();
      expect(coreBlocks?.customBlock?.content).toBe('Default content');
    });

    it('should initialize with previous state', async () => {
      const previousState: MemoryState = {
        chatHistory: [{
          content: 'Previous message',
          role: 'user'
        } as CoreMessage],
        coreMemory: null
      };

      // Update mock to return the previous state
      storageProvider.getMemoryState.mockResolvedValue(previousState);
      storageProvider.initializeMemoryState.mockResolvedValue(previousState);

      const customRecall = new Recall({
        storageProvider,
        archiveProvider,
        openaiApiKey: 'test-key',
        memoryKey: 'test-memory',
        previousState
      });

      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      const history = await customRecall.chatHistory();
      // Filter out system messages
      const userMessages = history.filter(msg => msg.role !== 'system');
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0]?.content).toBe('Previous message');
    });
  });

  describe('chat history management', () => {
    it('should add and retrieve a single message', async () => {
      const message: CoreMessage = {
        content: 'Hello',
        role: 'user'
      } as CoreMessage;

      await recall.addMessages(message);
      const history = await recall.chatHistory();
      // Filter out system messages
      const userMessages = history.filter(msg => msg.role !== 'system');
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0]?.content).toBe('Hello');
    });

    it('should add and retrieve multiple messages', async () => {
      const messages: CoreMessage[] = [
        { content: 'First message', role: 'assistant' } as CoreMessage,
        { content: 'Second message', role: 'user' } as CoreMessage
      ];

      await recall.addMessages(messages);
      const history = await recall.chatHistory();
      // Filter out system messages
      const chatMessages = history.filter(msg => msg.role !== 'system');
      expect(chatMessages).toHaveLength(2);
      expect(chatMessages[0]?.content).toBe('First message');
      expect(chatMessages[1]?.content).toBe('Second message');
    });

    describe('deprecated methods', () => {
      it('should support legacy addUserMessage for backward compatibility', async () => {
        const message: CoreMessage = {
          content: 'Hello',
          role: 'user'
        } as CoreMessage;

        await recall.addUserMessage(message);
        const history = await recall.chatHistory();
        const userMessages = history.filter(msg => msg.role === 'user');
        expect(userMessages).toHaveLength(1);
        expect(userMessages[0]?.content).toBe('Hello');
      });

      it('should support legacy addAIMessage for backward compatibility', async () => {
        const message: CoreMessage = {
          content: 'Hi there!',
          role: 'assistant'
        } as CoreMessage;

        await recall.addAIMessage(message);
        const history = await recall.chatHistory();
        const aiMessages = history.filter(msg => msg.role === 'assistant');
        expect(aiMessages).toHaveLength(1);
        expect(aiMessages[0]?.content).toBe('Hi there!');
      });

      it('should support legacy addAIMessages for backward compatibility', async () => {
        const messages: CoreMessage[] = [
          { content: 'First message', role: 'assistant' } as CoreMessage,
          { content: 'Second message', role: 'assistant' } as CoreMessage
        ];

        await recall.addAIMessages(messages);
        const history = await recall.chatHistory();
        const aiMessages = history.filter(msg => msg.role === 'assistant');
        expect(aiMessages).toHaveLength(2);
        expect(aiMessages[0]?.content).toBe('First message');
        expect(aiMessages[1]?.content).toBe('Second message');
      });
    });
  });

  describe('tools', () => {
    it('should provide memory management tools', async () => {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      const tools = recall.tools;
      expect(tools).toBeDefined();
      expect(tools.coreMemoryAppend).toBeDefined();
      expect(tools.coreMemoryReplace).toBeDefined();
      expect(tools.archivalMemorySearch).toBeDefined();
      expect(tools.archivalMemoryInsert).toBeDefined();
    });
  });
}); 
