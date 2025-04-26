# Changelog

## [2.1.0] - 2024-04-03

### Features
- **Memory Configuration**: Added configurable memory limits
  ```typescript
  const recall = new Recall({
    // ... other config ...
    memoryOptions: {
      chatTokenLimit: 15000,      // Default: 10000
      maxContextSize: 25000,      // Default: 20000
      coreBlockTokenLimit: 3000   // Default: 2000
    }
  });
  ```
  - Added ability to customize chat history token limit
  - Added ability to customize maximum context size
  - Added ability to customize core block token limit
  - All limits are optional with sensible defaults

### Documentation
- Added memory configuration options documentation with examples
- Added best practices for memory limit configuration

## [2.0.0] - 2024-04-02

### Breaking Changes
- **Provider Initialization**: Removed `initialize()` method from providers
  - Storage and Archive providers no longer require explicit initialization
  - Initialization is now handled automatically in the constructor
  - This is a breaking change as code calling `initialize()` will need to be updated

### Improvements
- **Provider Initialization**: Simplified provider initialization process
  - Redis schema setup is now optional but recommended
  - Added schema validation in RedisArchiveProvider constructor
  - Added warning messages for missing schema
  - Schema setup is now safe to run multiple times

- **Redis Schema Setup**: Simplified Redis schema management
  ```typescript
  // Before
  await setupRedisSchema(client, 'idx:archive', 'prefix:', 1536, false); // With validation
  
  // After
  await setupRedisSchema(client, 'idx:archive', 'prefix:', 1536); // Always recreates
  ```
  - Removed schema validation to avoid race conditions
  - Removed `force` parameter - schema is always recreated
  - Schema setup now always drops and recreates the index
  - Removed automatic schema checks from provider constructor
  - Removed `ensureSchemaHasIdField` method

### Documentation
- Updated README with clearer Redis setup instructions
- Added detailed provider initialization examples
- Improved search capabilities documentation
- Added schema setup best practices

### Migration Guide
1. Remove all calls to `initialize()` on storage and archive providers
2. If using Redis, ensure `setupRedisSchema` is called before using the provider
3. Update any code that relied on schema validation parameters
4. Review and update any code that assumed indexes would persist between schema setups

## [1.0.0] - 2024-04-01

### Breaking Changes
- **Recall Client Initialization**: Changed how Recall client and providers are initialized. Client must now be pre-configured with providers.
  ```typescript
  // Before
  const recall = new Recall({
    url: 'redis://localhost:6380',
    openaiApiKey: process.env.OPENAI_API_KEY,
    memoryKey: 'user-123',
    threadId: 'thread-1'
  });

  // After
  const redisClient = createClient({
    url: 'redis://localhost:6380'
  });
  await redisClient.connect();

  const storage = new RedisProvider({
    client: redisClient,
    prefix: 'user-123'
  });

  const archiveProvider = new RedisArchiveProvider({
    client: redisClient,
    indexName: 'idx:archive',
    collectionName: 'user-123'
  });

  const recall = new Recall({
    storageProvider: storage,
    archiveProvider: archiveProvider,
    openaiApiKey: process.env.OPENAI_API_KEY,
    memoryKey: 'user-123',
    threadId: 'thread-1'
  });
  ```

- **Redis Search Index Schema**: Added ID field to Redis search index schema. Existing indexes will be automatically recreated with the new schema.
  - Added `$.id` field to store entry IDs
  - IDs are now properly stored and retrieved in search results
  - Improved ID handling in `addEntry`, `listEntries`, and search functions

- **Message Handling API**: Unified message handling methods into a single `addMessages` method.
  ```typescript
  // Before
  await recall.addUserMessage(message);
  await recall.addAIMessage(message);
  await recall.addAIMessages(messages);

  // After
  await recall.addMessages(message);        // Single message
  await recall.addMessages([message1, message2]); // Multiple messages
  ```
  - Old methods are marked as deprecated but remain functional for backward compatibility
  - Improved type safety and reduced code duplication
  - More flexible API that handles both single and multiple messages

### Improvements
- Better error handling in Redis operations
- More robust index verification
- Cleaner logging output
- Improved type safety in Redis JSON operations

### Migration Guide
1. Update your Recall client initialization code as shown above
2. Initialize Redis client and providers separately before creating the Recall instance
3. No manual migration needed for the index schema change - it will be handled automatically
4. If you were relying on the old ID format (extracted from Redis key), the behavior remains backward compatible
5. Consider migrating to the new unified `addMessages` method for message handling
   - Replace `addUserMessage`, `addAIMessage`, and `addAIMessages` with `addMessages`
   - The old methods will continue to work but are deprecated

## [0.1.4] - Previous version 
