# Changelog

## [1.0.0] - 2024-03-XX

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
