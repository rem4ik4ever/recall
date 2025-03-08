# @rkim/recall

A memory management system for AI applications that provides persistent core memory, chat history management, and RAG (Retrieval-Augmented Generation) capabilities.

## Features

- 🧠 **Core Memory**: Persistent memory that stays in system messages
- 💬 **Chat History**: Manage conversation history across multiple threads
- 📚 **Archive Memory**: RAG (Retrieval-Augmented Generation) support for long-term memory
- 🔄 **Multiple Storage Providers**: Support for in-memory and Redis storage

## Installation

```bash
npm install @rkim/recall
# or
yarn add @rkim/recall
# or
pnpm add @rkim/recall
```

## Quick Start

```typescript
import { Recall, RedisProvider, RedisArchiveProvider } from '@rkim/recall';
import { createClient } from 'redis';

// Initialize providers
const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

const memory = new Recall({
  storageProvider: new RedisProvider({
    client: redisClient,
    prefix: 'user_123'
  }),
  archiveProvider: new RedisArchiveProvider({
    client: redisClient,
    indexName: 'idx:user_memory',
    collectionName: 'user_123'
  }),
  openaiApiKey: process.env.OPENAI_API_KEY,
  coreBlocks: [
    {
      key: 'user_context',
      description: 'Essential information about the user',
      defaultContent: 'User name is Alice. She prefers quick, concise responses.',
      readOnly: false
    },
    {
      key: 'assistant_persona',
      description: 'Assistant personality and behavior settings',
      defaultContent: 'I am Nova, a helpful AI assistant focused on clear communication.',
      readOnly: true
    }
  ]
});

// Create a chat session
const session = await memory.createChatSession('user_123', 'main');
await session.addUserMessage({ content: 'Hello!' });
```

## Core Memory

Core Memory is a persistent memory system that's always present in the system prompt. It allows both users and AI agents to maintain and update important contextual information throughout conversations.

### How Core Memory Works

- Core Memory is included in every system prompt
- Can be organized into blocks with different purposes
- Each block can be marked as read-only or updatable
- AI agents can update their own memory during conversations
- Persists across multiple chat sessions

### Example Usage

```typescript
const memory = new Recall({
  // ... provider configuration ...
  coreBlocks: [
    {
      key: 'user_preferences',
      description: 'User preferences and settings',
      defaultContent: 'Language: English, Tone: Professional',
      readOnly: false
    },
    {
      key: 'agent_persona',
      description: 'AI personality settings',
      defaultContent: 'You are a helpful technical assistant',
      readOnly: true
    }
  ]
});

// Update core memory
await memory.updateCoreMemory('user_preferences', {
  language: 'Spanish',
  tone: 'Casual'
});
```

## Chat History

Chat History maintains the ongoing conversation between users and AI Agents, including message history, tool calls, and automatic conversation summarization.

### Features

- Automatic token limit management
- Smart conversation summarization
- Multiple conversation threads
- Tool call history preservation
- Context-aware message handling

### Example Usage

```typescript
// Create chat sessions
const mainThread = await memory.createChatSession('user_123', 'main');
const analyticsThread = await memory.createChatSession('user_123', 'analytics');

// Add messages with tool usage
await mainThread.addUserMessage({
  content: 'Analyze this dataset'
});

await mainThread.addAIMessage({
  content: 'I\'ll analyze the data',
  tool_calls: [{
    type: 'function',
    function: {
      name: 'analyzeData',
      arguments: { dataset: 'sales_2024.csv' }
    }
  }]
});

// Get history
const history = await mainThread.getChatHistory();
const summarizedHistory = await mainThread.getSummarizedHistory();
```

## Archive Memory (RAG)

Archive Memory provides RAG capabilities for long-term information storage and retrieval.

```typescript
// Store information
await memory.addToArchive('user_123', {
  content: 'User prefers vegetarian food',
  metadata: { category: 'preferences' }
});

// Search archive
const results = await memory.searchArchive('user_123', 'food preferences');
```

## Storage Providers

Recall supports multiple storage providers for different use cases.

### Built-in Providers

- **InMemoryProvider**: Great for testing and development
- **RedisProvider**: Production-ready persistent storage

### Redis Requirements

To use the `RedisArchiveProvider`, you need:
- Redis Stack with RediSearch module installed
- Redis version 6.0 or higher

For development:
```bash
docker run -d --name redis-stack -p 6379:6379
```

For production:
```bash
docker run -d --name redis-stack -p 6379:6379 redis/redis-stack:latest
```

### Custom Providers

You can implement custom providers by extending the base interfaces:

```typescript
import { StorageProvider, ArchiveProvider } from '@rkim/recall';

class CustomStorageProvider implements StorageProvider {
  // Implement storage methods
}

class CustomArchiveProvider implements ArchiveProvider {
  // Implement archive methods
}
```

## License

MIT 
