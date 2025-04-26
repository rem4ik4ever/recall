"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisArchiveProvider = void 0;
exports.setupRedisSchema = setupRedisSchema;
const redis_1 = require("redis");
const recall_archive_provider_1 = require("@aksolab/recall-archive-provider");
const ai_1 = require("ai");
const openai_1 = require("@ai-sdk/openai");
/**
 * Utility function to set up Redis schema for archive storage.
 * This should be called once during application initialization.
 */
async function setupRedisSchema(client, indexName = 'idx:archive', collectionName = 'recall:memory:archive:', dimensions = 1536) {
    try {
        // Drop existing index if it exists
        try {
            await client.ft.dropIndex(indexName);
            console.log('Dropped existing index');
        }
        catch (e) {
            if (!e.message.includes('Unknown Index')) {
                throw e;
            }
        }
        // Create index for archive entries
        await client.ft.create(indexName, {
            '$.id': {
                type: redis_1.SchemaFieldTypes.TEXT,
                AS: 'id'
            },
            '$.name': {
                type: redis_1.SchemaFieldTypes.TEXT,
                AS: 'name'
            },
            '$.content': {
                type: redis_1.SchemaFieldTypes.TEXT,
                AS: 'content'
            },
            '$.timestamp': {
                type: redis_1.SchemaFieldTypes.NUMERIC,
                SORTABLE: true,
                AS: 'timestamp'
            },
            '$.metadata': {
                type: redis_1.SchemaFieldTypes.TEXT,
                AS: 'metadata'
            },
            '$.embeddings': {
                type: redis_1.SchemaFieldTypes.VECTOR,
                ALGORITHM: redis_1.VectorAlgorithms.HNSW,
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
    }
    catch (error) {
        console.error('Error setting up Redis schema:', error);
        throw error;
    }
}
class RedisArchiveProvider extends recall_archive_provider_1.ArchiveProvider {
    client;
    indexName;
    collectionName;
    config;
    constructor(config) {
        super(config);
        this.client = config.client;
        this.indexName = config.indexName || 'idx:archive';
        this.collectionName = config.collectionName || 'recall:memory:archive:';
        this.config = config;
    }
    async cleanup() {
        // No need to disconnect since we don't own the connection
        return;
    }
    getKey(id) {
        return `${this.collectionName}${id}`;
    }
    async generateEmbeddings(text) {
        const { embedding } = await (0, ai_1.embed)({
            model: openai_1.openai.embedding(this.config.embeddingModel || 'text-embedding-3-small'),
            value: text,
        });
        return embedding;
    }
    async addEntry(entry) {
        const timestamp = Date.now();
        const id = `entry-${timestamp}-${Math.random().toString(36).slice(2)}`;
        const embeddings = await this.generateEmbeddings(entry.content);
        const fullEntry = {
            ...entry,
            id,
            embeddings,
            timestamp,
            metadata: entry.metadata || '' // Ensure metadata is a string
        };
        const key = this.getKey(id);
        try {
            // Format the entry for Redis JSON storage
            const jsonEntry = {
                id, // Store the ID in the JSON document
                name: fullEntry.name,
                content: fullEntry.content,
                metadata: typeof fullEntry.metadata === 'string' ? fullEntry.metadata : JSON.stringify(fullEntry.metadata),
                timestamp: fullEntry.timestamp,
                embeddings: fullEntry.embeddings || [] // Ensure embeddings is an array
            };
            await this.client.json.set(key, '$', jsonEntry);
            return fullEntry;
        }
        catch (error) {
            // Clean up the key if it was created but not properly indexed
            try {
                await this.client.del(key);
            }
            catch (cleanupError) {
                console.error('Failed to clean up key after error:', key);
            }
            throw error;
        }
    }
    async addEntries(entries) {
        return Promise.all(entries.map(entry => this.addEntry(entry)));
    }
    async updateEntry(id, entry) {
        const key = this.getKey(id);
        const existing = await this.getEntry(id);
        if (!existing) {
            throw new Error(`Entry with id ${id} not found`);
        }
        const updatedEntry = {
            ...existing,
            ...entry
        };
        // If content was updated, regenerate embeddings
        if (entry.content && entry.content !== existing.content) {
            updatedEntry.embeddings = await this.generateEmbeddings(entry.content);
        }
        await this.client.json.set(key, '$', updatedEntry);
        return updatedEntry;
    }
    async deleteEntry(id) {
        await this.client.del(this.getKey(id));
    }
    async deleteEntriesByName(name) {
        const results = await this.client.ft.search(this.indexName, `@name:(${name})`, { RETURN: ['name'] });
        if (results.documents.length === 0) {
            return 0;
        }
        await Promise.all(results.documents.map(doc => this.client.del(doc.id)));
        return results.documents.length;
    }
    async searchByText(query, options = {}) {
        const { limit = 20 } = options;
        // Prepare search terms for text search - exact phrase match and individual terms
        const terms = query.split(/\s+/).filter(term => term.length > 0);
        const exactPhrase = `"${query}"`;
        const fuzzyTerms = terms.map(term => `%${term}%`).join('|');
        // Combine exact phrase and fuzzy term matching
        const textQuery = `(@name|content:(${exactPhrase})) | (@name|content:(${fuzzyTerms}))`;
        const results = await this.client.ft.search(this.indexName, textQuery, {
            LIMIT: { from: options.offset || 0, size: limit },
            RETURN: ['name', 'content', 'metadata', 'timestamp'],
            SORTBY: 'timestamp',
            DIALECT: 2,
        });
        if (results.documents.length === 0) {
            return [];
        }
        return results.documents.map((doc) => {
            const entry = doc.value;
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
    async searchBySimilarity(query, options = {}) {
        const { limit = 20 } = options;
        const embedding = await this.generateEmbeddings(query);
        const vectorQuery = Buffer.from(new Float32Array(embedding).buffer);
        const results = await this.client.ft.search(this.indexName, '*=>[KNN 20 @embeddings $vec_query AS vector_score]', {
            PARAMS: { vec_query: vectorQuery },
            RETURN: ['name', 'content', 'metadata', 'timestamp', 'vector_score'],
            SORTBY: 'vector_score',
            DIALECT: 2,
            LIMIT: { from: options.offset || 0, size: limit }
        });
        if (results.documents.length === 0) {
            return [];
        }
        // Find min and max scores for normalization
        const scores = results.documents.map((doc) => Number(doc.value.vector_score || 0));
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const range = maxScore - minScore;
        return results.documents.map((doc) => {
            const entry = doc.value;
            const rawScore = Number(doc.value.vector_score || 0);
            const normalizedScore = range === 0 ? 1 : (maxScore - rawScore) / range;
            const score = normalizedScore * 100;
            const { vector_score, ...entryWithoutScore } = entry;
            return {
                entry: { ...entryWithoutScore, id: doc.id.replace(this.collectionName, '') },
                score
            };
        });
    }
    async hybridSearch(query, options = {}) {
        const { limit = 20, vectorWeight = 0.7, textWeight = 0.3 } = options;
        const embedding = await this.generateEmbeddings(query);
        const vectorQuery = Buffer.from(new Float32Array(embedding).buffer);
        const results = await this.client.ft.search(this.indexName, '*=>[KNN 20 @embeddings $vec_query AS vector_score]', {
            PARAMS: { vec_query: vectorQuery },
            RETURN: ['name', 'content', 'metadata', 'timestamp', 'vector_score'],
            DIALECT: 2,
            LIMIT: { from: options.offset || 0, size: limit }
        });
        if (results.documents.length === 0) {
            return [];
        }
        // Find min and max scores for normalization
        const scores = results.documents.map((doc) => Number(doc.value.vector_score || 0));
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const range = maxScore - minScore;
        const processedResults = results.documents.map((doc) => {
            const entry = doc.value;
            const rawVectorScore = Number(doc.value.vector_score || 0);
            const normalizedVectorScore = range === 0 ? 1 : (maxScore - rawVectorScore) / range;
            const content = entry.content.toLowerCase();
            const searchTerms = query.toLowerCase().split(/\s+/);
            const exactPhraseMatch = content.includes(query.toLowerCase());
            const termMatches = searchTerms.filter(term => content.includes(term));
            let textScore = 0;
            if (exactPhraseMatch) {
                textScore = 1.0;
            }
            else if (termMatches.length > 0) {
                textScore = termMatches.length / searchTerms.length;
            }
            const { vector_score, ...entryWithoutScore } = entry;
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
    async listEntries(options = {}) {
        const { limit = 100, offset = 0 } = options;
        try {
            const results = await this.client.ft.search(this.indexName, '*', {
                LIMIT: { from: offset, size: limit },
                SORTBY: 'timestamp',
                DESC: true,
                RETURN: ['id', 'name', 'content', 'metadata', 'timestamp', 'embeddings'], // Include id in returned fields
                DIALECT: 2
            });
            if (!results.documents || results.documents.length === 0) {
                return [];
            }
            return results.documents.map(doc => {
                const value = doc.value;
                // Use the stored ID if available, otherwise extract from key
                const id = value.id || doc.id.replace(this.collectionName, '');
                return {
                    ...value,
                    id
                };
            });
        }
        catch (error) {
            console.error('Error listing entries:', error);
            throw error;
        }
    }
    async getEntry(id) {
        const key = this.getKey(id);
        const entry = await this.client.json.get(key);
        return entry ? { ...entry, id } : null;
    }
    async clear() {
        const keys = await this.client.keys(`${this.collectionName}*`);
        if (keys.length > 0) {
            await this.client.del(keys);
        }
    }
    async count() {
        const info = await this.client.ft.info(this.indexName);
        return Number(info.numDocs);
    }
}
exports.RedisArchiveProvider = RedisArchiveProvider;
