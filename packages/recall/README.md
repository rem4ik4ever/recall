# @rkim/recall

A memory management for AI applications using that provides persistent core memory, chat history management, and RAG (Retrieval-Augmented Generation) capabilities.

## Features

- 🧠 **Core Memory**: Persistent memory that stays in system messages
- 💬 **Chat History**: Manage conversation history across multiple threads
- 📚 **Archive Memory**: RAG (Retrieval-Augmented Generation) support for long-term memory
- 🔄 **Multiple Storage Providers**: Support for in-memory and Redis storage also add your own

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

// Initialize Redis client
const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

// Initialize storage provider
const storage = new RedisProvider({
  client: redisClient,
  prefix: 'user_123'  // Optional: prefix for Redis keys
});

// Initialize archive provider for RAG capabilities
const archive = new RedisArchiveProvider({
  client: redisClient,
  indexName: 'idx:user_memory',  // Optional: defaults to 'idx:archive'
  collectionName: 'user_123:archive:',  // Optional: defaults to 'recall:memory:archive:'
  dimensions: 1536  // Optional: for text-embedding-3-small
});

// Initialize Recall with configured providers
const memory = new Recall({
  storageProvider: storage,
  archiveProvider: archive,
  openaiApiKey: process.env.OPENAI_API_KEY,
  memoryKey: 'user_123',
  threadId: 'main',
  memoryOptions: { // optional
    maxContextSize: 25000,     // Custom max context size
    coreBlockTokenLimit: 3000, // Custom core block token limit
    chatTokenLimit: 15000,     // Custom chat token limit
  },
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

// Add messages directly to the memory instance
await memory.addMessages({ content: 'Hello!', role: 'user' });

// Add multiple messages at once
await memory.addMessages([
  { content: 'Hi there!', role: 'assistant' },
  { content: 'How can I help?', role: 'assistant' }
]);
```

## Memory Limits Configuration

Recall provides configurable memory limits to help manage token usage and context size:

- `chatTokenLimit`: Maximum number of tokens in chat history (default: 10000)
- `maxContextSize`: Maximum total context size in tokens (default: 20000)
- `coreBlockTokenLimit`: Maximum tokens per core memory block (default: 2000)

You can set these limits during initialization:

```typescript
const memory = new Recall({
  storageProvider: storage,
  archiveProvider: archive,
  openaiApiKey: process.env.OPENAI_API_KEY,
  memoryKey: 'user_123',
  threadId: 'main',
  maxContextSize: 25000,     // Custom max context size
  coreBlockTokenLimit: 3000, // Custom core block token limit
  chatTokenLimit: 15000,     // Custom chat token limit
  coreBlocks: [
    // ... core blocks configuration ...
  ]
});
```

These limits help manage memory and token usage:
- `chatTokenLimit`: When exceeded, older messages are automatically summarized
- `maxContextSize`: Ensures total context stays within model limits
- `coreBlockTokenLimit`: Prevents individual core memory blocks from becoming too large

The limits can also be updated after initialization:

```typescript
// Update limits as needed
memory.maxContextSize = 30000;
memory.chatTokenLimit = 20000;
memory.coreBlockTokenLimit = 4000;
```

## Core Memory

Core Memory is a persistent memory system that's always present in the system prompt. It allows both users and AI agents to maintain and update important contextual information throughout conversations.

### How Core Memory Works

- Core Memory is included in every system prompt
- Can be organized into blocks with different purposes
- Each block can be marked as read-only or updatable
- AI agents can update their own memory during conversations
- Persists across multiple chat sessions
- Automatically initializes with default content

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

// Pass tools to AI Agent
import { generateText } from 'ai';

const result = await generateText({
  model: 'gpt-4',
  tools: memory.tools,  // Memory tools are automatically available to the AI
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant that remembers user preferences.'
    },
    {
      role: 'user',
      content: 'Remember that I prefer technical explanations and my name is Alex.'
    }
  ],
});
```

The AI agent will have access to these memory management tools:
- `coreMemoryReplace`: Update entire memory blocks
- `coreMemoryAppend`: Add information to existing blocks
- `archivalMemorySearch`: Search through archived information
- `archivalMemoryInsert`: Add new information to archive

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
// Create a memory instance with different thread IDs
const memory = new Recall({
  storageProvider,
  archiveProvider,
  openaiApiKey: process.env.OPENAI_API_KEY,
  memoryKey: 'user_123',
  threadId: 'main'  // Main conversation thread
});

const analyticsMemory = new Recall({
  storageProvider,
  archiveProvider,
  openaiApiKey: process.env.OPENAI_API_KEY,
  memoryKey: 'user_123',
  threadId: 'analytics'  // Analytics-specific thread
});

// Add messages
await memory.addMessages({
  content: 'Analyze this dataset',
  role: 'user'
});

await memory.addMessages({
  content: 'I\'ll analyze the data',
  role: 'assistant',
  tool_calls: [{
    type: 'function',
    function: {
      name: 'analyzeData',
      arguments: { dataset: 'sales_2024.csv' }
    }
  }]
});

// Add multiple messages at once
await memory.addMessages([
  { content: 'Here are the results', role: 'assistant' },
  { content: 'Thanks!', role: 'user' }
]);

// Get history
const history = await memory.chatHistory();
```

## Archive Memory (RAG)

Archive Memory provides RAG capabilities for long-term information storage and retrieval. It supports multiple search methods:
- Text-based search with fuzzy matching
- Semantic search using embeddings
- Hybrid search combining both approaches

### Example Usage

```typescript
// Store information using tools
await memory.tools.archivalMemoryInsert({
  content: 'User prefers vegetarian food',
  name: 'Dietary Preferences',  // Optional: name for the entry
  metadata: { category: 'preferences' }  // Optional: additional metadata
});

// Text-based search
const textResults = await memory.tools.archivalMemorySearch({
  query: 'food preferences',
  type: 'text'
});

// Semantic search
const semanticResults = await memory.tools.archivalMemorySearch({
  query: 'dietary restrictions',
  type: 'similarity'
});

// Hybrid search (combines text and semantic search)
const hybridResults = await memory.tools.archivalMemorySearch({
  query: 'food allergies',
  type: 'hybrid',
  vectorWeight: 0.7,  // Optional: weight for semantic search (default: 0.7)
  textWeight: 0.3    // Optional: weight for text search (default: 0.3)
});

// Get chat history
const history = await memory.chatHistory();
```

Each search result includes:
- The matched entry with its content and metadata
- A relevance score (0-100)
- Match details for text searches (exact phrases and matched terms)

## Storage Providers

Recall supports multiple storage providers for different use cases.

### Built-in Providers

- **InMemoryProvider**: Great for testing and development
- **RedisProvider**: Production-ready persistent storage

### Redis Requirements

To use Redis providers, you need:
- Redis Stack with RediSearch module installed
- Redis version 6.0 or higher
- Node Redis client v4.7.0 or higher

For development:
```bash
docker run -d --name redis-stack -p 6379:6379 redis/redis-stack:latest
```

For production, ensure your Redis instance has the RediSearch module installed. Then initialize the providers:

```typescript
import { Recall, RedisProvider, RedisArchiveProvider, setupRedisSchema } from '@rkim/recall';
import { createClient } from 'redis';

// Initialize Redis client
const client = createClient({
  url: process.env.REDIS_URL,
  // Add any additional configuration options
});
await client.connect();

// Optional but recommended: Set up Redis schema once during app initialization
// This creates necessary indexes for vector search and validates existing schema
await setupRedisSchema(
  client,
  'idx:archive',      // Optional: index name
  'user:archive:',    // Optional: collection prefix
  1536,              // Optional: vector dimensions
  false              // Optional: force schema recreation
);

// Initialize storage provider for chat history and core memory
const storage = new RedisProvider({
  client,
  prefix: 'user:memory:'  // Optional: prefix for Redis keys
});

// Initialize archive provider for RAG capabilities
const archive = new RedisArchiveProvider({
  client,
  indexName: 'idx:archive',      // Optional: defaults to 'idx:archive'
  collectionName: 'user:archive:', // Optional: defaults to 'recall:memory:archive:'
  dimensions: 1536,              // Optional: for text-embedding-3-small
  embeddingModel: 'text-embedding-3-small'  // Optional: defaults to text-embedding-3-small
});

// Initialize Recall with configured providers
const recall = new Recall({
  storageProvider: storage,
  archiveProvider: archive,
  openaiApiKey: process.env.OPENAI_API_KEY,
  memoryKey: 'user_123',
  threadId: 'main'
});
```

The Redis schema setup:
- Is optional but recommended for production use
- Should be done once during application initialization
- Creates necessary indexes for vector search
- Validates existing schema if already present
- Can be forced to recreate with the `force` parameter
- Is safe to run multiple times (won't recreate if valid)
- Will log a warning if missing when using the archive provider

The providers will automatically:
- Handle vector embeddings for semantic search
- Manage JSON storage and retrieval
- Provide text, semantic, and hybrid search capabilities

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

## Using with AI Agents

Memory tools can be passed directly to AI agents for autonomous memory management:

```typescript
import { generateText } from 'ai';

// Initialize memory and create session as shown in Quick Start
const session = await memory.createChatSession('user_123', 'main');
const { tools } = session;

const result = await generateText({
  model: 'gpt-4',
  tools,  // Pass the memory tools to the AI
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant that remembers user preferences.'
    },
    {
      role: 'user',
      content: 'I prefer to be called Alex and like technical, detailed explanations.'
    }
  ],
});

// The AI can now use tools to manage memory
// For example, it might call:
// tools.coreMemoryReplace({
//   block: 'user_preferences',
//   content: 'Name: Alex, Preference: Technical and detailed explanations'
// })

// Later in the conversation, AI can retrieve preferences
const result2 = await generateText({
  model: 'gpt-4',
  tools,
  messages: [
    {
      role: 'user',
      content: 'Can you explain how databases work?'
    }
  ],
});

// AI can search archive memory for relevant information
// tools.archivalMemorySearch({
//   query: 'user Alex technical preferences'
// })
```

The available tools include:
- `coreMemoryReplace`: Update entire memory blocks
- `coreMemoryAppend`: Add information to existing blocks
- `archivalMemorySearch`: Search through archived information
- `archivalMemoryInsert`: Add new information to archive

## Contributing

### Commit Messages

This project uses semantic versioning based on commit message prefixes. Your commit message should be structured as follows:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types that trigger version updates:
- `feat`: New feature (minor version bump)
- `fix`: Bug fix (patch version bump)
- `perf`: Performance improvement (patch version bump)
- `BREAKING CHANGE`: Breaking API change (major version bump)

Examples:
```bash
# Patch release (0.0.x)
git commit -m "fix: correct memory leak in chat history"
git commit -m "perf: improve archive search performance"

# Minor release (0.x.0)
git commit -m "feat: add new core memory block type"

# Major release (x.0.0)
git commit -m "feat!: redesign storage provider API
BREAKING CHANGE: storage provider interface has changed"
```

The version number will be automatically updated when merging to main branch.

## License

MIT 
