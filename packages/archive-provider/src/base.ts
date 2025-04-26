import { ArchiveEntry, SearchResult, SearchOptions, SearchByTextOptions, SearchBySimilarityOptions, HybridSearchOptions, ProviderConfig } from './types';

/**
 * Abstract base class for Archive Provider implementations.
 * This class defines the interface that all archive providers must implement.
 */
export abstract class ArchiveProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Clean up provider resources
   */
  abstract cleanup(): Promise<void>;

  /**
   * Add a new entry to the archive
   * @param entry The entry to add
   * @returns The added entry with generated ID
   */
  abstract addEntry(entry: ArchiveEntry): Promise<ArchiveEntry>;

  /**
   * Add multiple entries to the archive
   * @param entries Array of entries to add
   * @returns Array of added entries
   */
  abstract addEntries(entries: ArchiveEntry[]): Promise<ArchiveEntry[]>;

  /**
   * Update an existing entry
   * @param id Entry ID
   * @param entry Updated entry data
   * @returns The updated entry
   */
  abstract updateEntry(id: string, entry: Partial<ArchiveEntry>): Promise<ArchiveEntry>;

  /**
   * Delete an entry by ID
   * @param id Entry ID
   */
  abstract deleteEntry(id: string): Promise<void>;

  /**
   * Delete entries by name
   * @param name Entry name
   * @returns Number of entries deleted
   */
  abstract deleteEntriesByName(name: string): Promise<number>;

  /**
   * Search entries by text content
   * @param query Search query text
   * @param options Search options
   * @returns Array of search results
   */
  abstract searchByText(query: string, options?: SearchByTextOptions): Promise<SearchResult[]>;

  /**
   * Search entries by semantic similarity
   * @param query Text to find similar content
   * @param options Search options
   * @returns Array of search results
   */
  abstract searchBySimilarity(query: string, options?: SearchBySimilarityOptions): Promise<SearchResult[]>;

  /**
   * Hybrid search combining text and semantic similarity
   * @param query Search query
   * @param options Search options
   * @returns Array of search results
   */
  abstract hybridSearch(query: string, options?: HybridSearchOptions): Promise<SearchResult[]>;

  /**
   * List all entries in the archive
   * @param options Listing options
   * @returns Array of entries
   */
  abstract listEntries(options?: SearchOptions): Promise<ArchiveEntry[]>;

  /**
   * Get entry by ID
   * @param id Entry ID
   * @returns The entry if found, null otherwise
   */
  abstract getEntry(id: string): Promise<ArchiveEntry | null>;

  /**
   * Clear all entries from the archive
   */
  abstract clear(): Promise<void>;

  /**
   * Get the total number of entries in the archive
   */
  abstract count(): Promise<number>;

  /**
   * Generate embeddings for text
   * @param text Text to generate embeddings for
   * @returns Array of embedding values
   */
  protected abstract generateEmbeddings(text: string): Promise<number[]>;
} 
