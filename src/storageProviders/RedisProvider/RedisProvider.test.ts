import { createClient, RedisClientType } from 'redis';
import { RedisProvider } from './RedisProvider';
import { CoreMessage, CoreBlock, CoreMemoryEntry } from '../../types';

describe('RedisProvider', () => {
  let provider: RedisProvider;
  let redisClient: RedisClientType;
  const testMemoryKey = 'test-memory';
  const testThreadId = 'test-thread';

  const testChatHistory: CoreMessage[] = [

  ];

  const testCoreMemory: Record<CoreBlock, CoreMemoryEntry> = {
    'personality': { content: 'friendly and helpful', description: 'bot personality' },
    'knowledge': { content: 'expert in testing', description: 'areas of expertise' }
  };

  beforeEach(async () => {
    redisClient = createClient();
    await redisClient.connect();
    provider = new RedisProvider({
      client: redisClient,
      prefix: 'test:'
    });
  });

  afterEach(async () => {
    await provider.flush();
    await provider.disconnect();
    await redisClient.quit();
  });

  test('should initialize new memory state', async () => {
    const state = await provider.initializeMemoryState(testMemoryKey);
    expect(state).toEqual({
      chatHistory: [],
      coreMemory: null,
    });
  });

  test('should update and get chat history', async () => {
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    const state = await provider.getMemoryState(testMemoryKey);
    expect(state?.chatHistory).toEqual(testChatHistory);
  });

  test('should update and get core memory', async () => {
    await provider.updateCoreMemory(testMemoryKey, testCoreMemory);
    const state = await provider.getMemoryState(testMemoryKey);
    expect(state?.coreMemory).toEqual(testCoreMemory);
  });

  test('should delete memory state', async () => {
    // Setup initial state
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    await provider.updateCoreMemory(testMemoryKey, testCoreMemory);

    // Delete state
    await provider.deleteMemoryState(testMemoryKey);

    // Verify state is cleared
    const state = await provider.getMemoryState(testMemoryKey);
    expect(state).toEqual({
      chatHistory: [],
      coreMemory: null,
    });
  });

  test('should flush all memory states', async () => {
    // Setup multiple states
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    await provider.updateChatHistory({
      memoryKey: 'another-key',
      threadId: testThreadId,
      messages: testChatHistory
    });

    // Flush all states
    await provider.flush();

    // Verify all states are cleared
    const state1 = await provider.getMemoryState(testMemoryKey);
    const state2 = await provider.getMemoryState('another-key');
    expect(state1).toEqual({
      chatHistory: [],
      coreMemory: null,
    });
    expect(state2).toEqual({
      chatHistory: [],
      coreMemory: null,
    });
  });

  test('should export all memory states', async () => {
    // Setup state
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    await provider.updateCoreMemory(testMemoryKey, testCoreMemory);

    // Export and verify
    const exported = await provider.export(testMemoryKey);
    expect(exported).toEqual({
      chatHistory: testChatHistory,
      coreMemory: testCoreMemory,
    });
  });

  test('should return existing state when initializing already existing memory', async () => {
    // Setup initial state
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    await provider.updateCoreMemory(testMemoryKey, testCoreMemory);

    // Try to initialize existing state
    const state = await provider.initializeMemoryState(testMemoryKey);
    expect(state).toEqual({
      chatHistory: testChatHistory,
      coreMemory: testCoreMemory,
    });
  });

  test('should generate correct memory keys', () => {
    expect(provider.getChatHistoryKey(testMemoryKey)).toBe('test:test-memory::chat-history::thread::default');
    expect(provider.getCoreMemoryKey(testMemoryKey)).toBe('test:test-memory::core-memory');
  });
}); 
