export interface ArchiveEntry {
  id?: string;
  name: string;
  content: string;
  metadata?: string;
  timestamp: number;
  embeddings?: number[];
}

export interface SearchResult {
  entry: ArchiveEntry;
  score: number;
  matches?: {
    exactPhrase: boolean;
    terms: string[];
  };
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  includeMetadata?: boolean;
}

export interface SearchByTextOptions extends SearchOptions {
  exactMatch?: boolean;
  fuzzyMatch?: boolean;
}

export interface SearchBySimilarityOptions extends SearchOptions {
  minScore?: number;
}

export interface HybridSearchOptions extends SearchOptions {
  vectorWeight?: number; // Weight for vector similarity (0-1)
  textWeight?: number;   // Weight for text matching (0-1)
  minScore?: number;
}

export interface ProviderConfig {
  namespace?: string;
  embeddingModel?: string;
  dimensions?: number;
} 
