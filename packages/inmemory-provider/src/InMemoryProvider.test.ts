import { InMemoryProvider } from "./InMemoryProvider";
import { CoreMessage, CoreMemoryEntry } from "../../types";

describe("InMemoryProvider", () => {
  let provider: InMemoryProvider;
  const testMemoryKey = "test-memory";
  const testThreadId = "test-thread";
  const testChatHistory: CoreMessage[] = [];
  const testCoreMemory: Record<string, CoreMemoryEntry> = {
    user: { content: "test user", description: "test description" }
  };

  beforeEach(() => {
    provider = new InMemoryProvider();
  });

  test("should initialize new memory state", async () => {
    const state = await provider.initializeMemoryState(testMemoryKey, testThreadId);
    expect(state).toEqual({
      chatHistory: [],
      coreMemory: null,
    });
  });

  test("should update and get chat history", async () => {
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    const state = await provider.getMemoryState(testMemoryKey);
    expect(state?.chatHistory).toEqual(testChatHistory);
  });

  test("should update and get core memory", async () => {
    await provider.updateCoreMemory(testMemoryKey, testCoreMemory);
    const state = await provider.getMemoryState(testMemoryKey);
    expect(state?.coreMemory).toEqual(testCoreMemory);
  });


  test("should return undefined for non-existent memory key", async () => {
    const state = await provider.getMemoryState("non-existent");
    expect(state).toEqual({
      chatHistory: [],
      coreMemory: null,
    });
  });

  test("should delete memory state", async () => {
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    await provider.updateCoreMemory(testMemoryKey, testCoreMemory);

    await provider.deleteMemoryState(testMemoryKey);
    const state = await provider.getMemoryState(testMemoryKey);
    expect(state).toEqual({
      chatHistory: [],
      coreMemory: null,
    });
  });

  test("should flush all memory states", async () => {
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    await provider.updateChatHistory({
      memoryKey: "another-key",
      threadId: testThreadId,
      messages: testChatHistory
    });
    await provider.flush();

    const state1 = await provider.getMemoryState(testMemoryKey);
    const state2 = await provider.getMemoryState("another-key");
    expect(state1).toEqual({
      chatHistory: [],
      coreMemory: null,
    });
    expect(state2).toEqual({
      chatHistory: [],
      coreMemory: null,
    });
  });

  test("should export all memory states", async () => {
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    await provider.updateCoreMemory(testMemoryKey, testCoreMemory);

    const exported = await provider.export(testMemoryKey);
    expect(exported).toEqual({
      chatHistory: testChatHistory,
      coreMemory: testCoreMemory,
    });
  });

  test("should return existing state when initializing already existing memory", async () => {
    await provider.updateChatHistory({
      memoryKey: testMemoryKey,
      threadId: testThreadId,
      messages: testChatHistory
    });
    await provider.updateCoreMemory(testMemoryKey, testCoreMemory);

    const state = await provider.initializeMemoryState(testMemoryKey, testThreadId);
    expect(state).toEqual({
      chatHistory: testChatHistory,
      coreMemory: testCoreMemory,
    });
  });

  test("should generate correct memory keys", () => {
    expect(provider.getChatHistoryKey(testMemoryKey, testThreadId)).toBe(`${testMemoryKey}::chat-history::thread::${testThreadId}`);
    expect(provider.getCoreMemoryKey(testMemoryKey)).toBe(`${testMemoryKey}::core-memory`);
  });
}); 
