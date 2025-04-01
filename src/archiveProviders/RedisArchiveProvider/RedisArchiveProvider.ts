import { RedisClientType, SchemaFieldTypes, VectorAlgorithms, SearchOptions as RedisSearchOptions } from 'redis';
import { ArchiveProvider } from '../base';
import { ArchiveEntry, SearchResult, SearchOptions, SearchByTextOptions, SearchBySimilarityOptions, HybridSearchOptions, ProviderConfig } from '../types';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface RedisArchiveProviderConfig extends ProviderConfig {
  dimensions?: number; // Vector dimensions, defaults to 1536 for text-embedding-3-small
  collectionName?: string;    // Key prefix for Redis, collection name
  indexName?: string; // Search index name
  client: RedisClientType; // Pre-configured Redis client
}

/**
 * Utility function to set up Redis schema for archive storage.
 * This should be called once during application initialization.
 */
export async function setupRedisSchema(
  client: RedisClientType,
  indexName: string = 'idx:archive',
  collectionName: string = 'recall:memory:archive:',
  dimensions: number = 1536
): Promise<void> {
  try {
    // Drop existing index if it exists
    try {
      await client.ft.dropIndex(indexName);
      console.log('Dropped existing index');
    } catch (e: any) {
      if (!e.message.includes('Unknown Index')) {
        throw e;
      }
    }

    // Create index for archive entries
    await client.ft.create(indexName, {
      '$.id': {
        type: SchemaFieldTypes.TEXT,
        AS: 'id'
      },
      '$.name': {
        type: SchemaFieldTypes.TEXT,
        AS: 'name'
      },
      '$.content': {
        type: SchemaFieldTypes.TEXT,
        AS: 'content'
      },
      '$.timestamp': {
        type: SchemaFieldTypes.NUMERIC,
        SORTABLE: true,
        AS: 'timestamp'
      },
      '$.metadata': {
        type: SchemaFieldTypes.TEXT,
        AS: 'metadata'
      },
      '$.embeddings': {
        type: SchemaFieldTypes.VECTOR,
        ALGORITHM: VectorAlgorithms.HNSW,
        TYPE: 'FLOAT32',
        DIM: dimensions,
        DISTANCE_METRIC: 'COSINE',
        AS: 'embeddings'
      }
    }, {
      ON: 'JSON',
      PREFIX: collectionName
    });

    // Verify the index was created
    await client.ft.info(indexName);
    console.log('Search index created successfully');
  } catch (error) {
    console.error('Error setting up Redis schema:', error);
    throw error;
  }
}

export class RedisArchiveProvider extends ArchiveProvider {
  private readonly client: RedisClientType;
  private readonly indexName: string;
  private readonly collectionName: string;

  constructor(config: RedisArchiveProviderConfig) {
    super(config);
    this.client = config.client;
    this.indexName = config.indexName || 'idx:archive';
    this.collectionName = config.collectionName || 'recall:memory:archive:';

    // Set up Redis schema in constructor
    setupRedisSchema(this.client, this.indexName, this.collectionName, this.config.dimensions)
      .catch(error => {
        console.error('Error setting up Redis schema:', error);
        throw error;
      });
  }

  async cleanup(): Promise<void> {
    // No need to disconnect since we don't own the connection
    return;
  }

  private getKey(id: string): string {
    return `${this.collectionName}${id}`;
  }

  protected async generateEmbeddings(text: string): Promise<number[]> {
    const { embedding } = await embed({
      model: openai.embedding(this.config.embeddingModel || 'text-embedding-3-small'),
      value: text,
    });
    return embedding;
  }

  async addEntry(entry: Omit<ArchiveEntry, 'id' | 'embeddings' | 'timestamp'>): Promise<ArchiveEntry> {
    const timestamp = Date.now()
    const id = `entry-${timestamp}-${Math.random().toString(36).slice(2)}`;
    const embeddings = await this.generateEmbeddings(entry.content!);

    const fullEntry: ArchiveEntry = {
      ...entry,
      id,
      embeddings,
      timestamp,
      metadata: entry.metadata || ''  // Ensure metadata is a string
    };

    const key = this.getKey(id);
    try {
      // Format the entry for Redis JSON storage
      const jsonEntry = {
        id,  // Store the ID in the JSON document
        name: fullEntry.name,
        content: fullEntry.content,
        metadata: typeof fullEntry.metadata === 'string' ? fullEntry.metadata : JSON.stringify(fullEntry.metadata),
        timestamp: fullEntry.timestamp,
        embeddings: fullEntry.embeddings || []  // Ensure embeddings is an array
      };

      await this.client.json.set(key, '$', jsonEntry as any);
      return fullEntry;
    } catch (error) {
      // Clean up the key if it was created but not properly indexed
      try {
        await this.client.del(key);
      } catch (cleanupError) {
        console.error('Failed to clean up key after error:', key);
      }
      throw error;
    }
  }

  async addEntries(entries: ArchiveEntry[]): Promise<ArchiveEntry[]> {
    return Promise.all(entries.map(entry => this.addEntry(entry)));
  }

  async updateEntry(id: string, entry: Partial<ArchiveEntry>): Promise<ArchiveEntry> {
    const key = this.getKey(id);
    const existing = await this.getEntry(id);

    if (!existing) {
      throw new Error(`Entry with id ${id} not found`);
    }

    const updatedEntry: ArchiveEntry = {
      ...existing,
      ...entry
    };

    // If content was updated, regenerate embeddings
    if (entry.content && entry.content !== existing.content) {
      updatedEntry.embeddings = await this.generateEmbeddings(entry.content);
    }

    await this.client.json.set(key, '$', updatedEntry as any);
    return updatedEntry;
  }

  async deleteEntry(id: string): Promise<void> {
    await this.client.del(this.getKey(id));
  }

  async deleteEntriesByName(name: string): Promise<number> {
    const results = await this.client.ft.search(
      this.indexName,
      `@name:(${name})`,
      { RETURN: ['name'] } as RedisSearchOptions
    );

    if (results.documents.length === 0) {
      return 0;
    }

    await Promise.all(results.documents.map(doc => this.client.del(doc.id)));
    return results.documents.length;
  }

  async searchByText(query: string, options: SearchByTextOptions = {}): Promise<SearchResult[]> {
    const { limit = 20 } = options;

    // Prepare search terms for text search - exact phrase match and individual terms
    const terms = query.split(/\s+/).filter(term => term.length > 0);
    const exactPhrase = `"${query}"`;
    const fuzzyTerms = terms.map(term => `%${term}%`).join('|');

    // Combine exact phrase and fuzzy term matching
    const textQuery = `(@name|content:(${exactPhrase})) | (@name|content:(${fuzzyTerms}))`;

    const results = await this.client.ft.search(
      this.indexName,
      textQuery,
      {
        LIMIT: { from: options.offset || 0, size: limit },
        RETURN: ['name', 'content', 'metadata', 'timestamp'],
        SORTBY: 'timestamp',
        DIALECT: 2,
      } as RedisSearchOptions
    );

    if (results.documents.length === 0) {
      return [];
    }

    return results.documents.map((doc: any) => {
      const entry = doc.value as unknown as ArchiveEntry;
      const content = entry.content.toLowerCase();
      const exactPhraseMatch = content.includes(query.toLowerCase());
      const termMatches = terms.filter(term => content.includes(term.toLowerCase()));

      const score = exactPhraseMatch ? 1.0 : termMatches.length / terms.length;

      return {
        entry: { ...entry, id: doc.id.replace(this.collectionName, '') },
        score: score * 100,
        matches: {
          exactPhrase: exactPhraseMatch,
          terms: termMatches
        }
      };
    });
  }

  async searchBySimilarity(query: string, options: SearchBySimilarityOptions = {}): Promise<SearchResult[]> {
    const { limit = 20 } = options;
    const embedding = await this.generateEmbeddings(query);
    const vectorQuery = Buffer.from(new Float32Array(embedding).buffer);

    const results = await this.client.ft.search(
      this.indexName,
      '*=>[KNN 20 @embeddings $vec_query AS vector_score]',
      {
        PARAMS: { vec_query: vectorQuery },
        RETURN: ['name', 'content', 'metadata', 'timestamp', 'vector_score'],
        SORTBY: 'vector_score',
        DIALECT: 2,
        LIMIT: { from: options.offset || 0, size: limit }
      } as RedisSearchOptions
    );

    if (results.documents.length === 0) {
      return [];
    }

    // Find min and max scores for normalization
    const scores = results.documents.map((doc: any) =>
      Number(doc.value.vector_score || 0)
    );
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;

    return results.documents.map((doc: any) => {
      const entry = doc.value as unknown as ArchiveEntry;
      const rawScore = Number(doc.value.vector_score || 0);
      const normalizedScore = range === 0 ? 1 : (maxScore - rawScore) / range;
      const score = normalizedScore * 100;

      const { vector_score, ...entryWithoutScore } = entry as any;

      return {
        entry: { ...entryWithoutScore, id: doc.id.replace(this.collectionName, '') },
        score
      };
    });
  }

  async hybridSearch(query: string, options: HybridSearchOptions = {}): Promise<SearchResult[]> {
    const { limit = 20, vectorWeight = 0.7, textWeight = 0.3 } = options;
    const embedding = await this.generateEmbeddings(query);
    const vectorQuery = Buffer.from(new Float32Array(embedding).buffer);

    const results = await this.client.ft.search(
      this.indexName,
      '*=>[KNN 20 @embeddings $vec_query AS vector_score]',
      {
        PARAMS: { vec_query: vectorQuery },
        RETURN: ['name', 'content', 'metadata', 'timestamp', 'vector_score'],
        DIALECT: 2,
        LIMIT: { from: options.offset || 0, size: limit }
      } as RedisSearchOptions
    );

    if (results.documents.length === 0) {
      return [];
    }

    // Find min and max scores for normalization
    const scores = results.documents.map((doc: any) =>
      Number(doc.value.vector_score || 0)
    );
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;

    const processedResults = results.documents.map((doc: any) => {
      const entry = doc.value as unknown as ArchiveEntry;
      const rawVectorScore = Number(doc.value.vector_score || 0);
      const normalizedVectorScore = range === 0 ? 1 : (maxScore - rawVectorScore) / range;

      const content = entry.content.toLowerCase();
      const searchTerms = query.toLowerCase().split(/\s+/);
      const exactPhraseMatch = content.includes(query.toLowerCase());
      const termMatches = searchTerms.filter(term => content.includes(term));

      let textScore = 0;
      if (exactPhraseMatch) {
        textScore = 1.0;
      } else if (termMatches.length > 0) {
        textScore = termMatches.length / searchTerms.length;
      }

      const { vector_score, ...entryWithoutScore } = entry as any;
      const finalScore = (normalizedVectorScore * vectorWeight + textScore * textWeight) * 100;

      return {
        entry: { ...entryWithoutScore, id: doc.id.replace(this.collectionName, '') },
        score: finalScore,
        matches: {
          exactPhrase: exactPhraseMatch,
          terms: termMatches
        }
      };
    });

    return processedResults
      .filter(result => !options.minScore || result.score >= options.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async listEntries(options: SearchOptions = {}): Promise<ArchiveEntry[]> {
    const { limit = 100, offset = 0 } = options;

    try {
      const results = await this.client.ft.search(
        this.indexName,
        '*',
        {
          LIMIT: { from: offset, size: limit },
          SORTBY: 'timestamp',
          DESC: true,
          RETURN: ['id', 'name', 'content', 'metadata', 'timestamp', 'embeddings'],  // Include id in returned fields
          DIALECT: 2
        } as RedisSearchOptions
      );

      if (!results.documents || results.documents.length === 0) {
        return [];
      }

      return results.documents.map(doc => {
        const value = doc.value as unknown as ArchiveEntry;
        // Use the stored ID if available, otherwise extract from key
        const id = value.id || doc.id.replace(this.collectionName, '');
        return {
          ...value,
          id
        };
      });
    } catch (error) {
      console.error('Error listing entries:', error);
      throw error;
    }
  }

  async getEntry(id: string): Promise<ArchiveEntry | null> {
    const key = this.getKey(id);
    const entry = await this.client.json.get(key) as unknown as { name: string; content: string; metadata?: string; timestamp: number; embeddings?: number[] } | null;
    return entry ? { ...entry, id } : null;
  }

  async clear(): Promise<void> {
    const keys = await this.client.keys(`${this.collectionName}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  async count(): Promise<number> {
    const info = await this.client.ft.info(this.indexName);
    return Number(info.numDocs);
  }

  // Update the schema setup to include the ID field
  private async ensureSchemaHasIdField(): Promise<void> {
    try {
      const info = await this.client.ft.info(this.indexName);
      const schema = info.attributes as Array<{ identifier: string }>;
      const hasIdField = schema.some(attr => attr.identifier === '$.id');

      if (!hasIdField) {
        // Drop and recreate index with ID field
        await setupRedisSchema(this.client, this.indexName, this.collectionName, this.config.dimensions);
      }
    } catch (error) {
      console.error('Error checking schema:', error);
    }
  }
} 
