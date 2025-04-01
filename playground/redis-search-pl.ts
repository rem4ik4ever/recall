import { RedisArchiveProvider, RedisArchiveProviderConfig, setupRedisSchema } from "../src/archiveProviders/RedisArchiveProvider/RedisArchiveProvider";
import { config } from 'dotenv';
import { createClient, RedisClientType } from 'redis';
import readline from 'readline';
import { ArchiveEntry } from "../src/types";
import { SearchResult } from "../src/archiveProviders/types";

// Load environment variables
config();

const client = createClient({
  url: 'redis://localhost:6380',
}) as RedisClientType;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

let provider: RedisArchiveProvider;

async function addEntry() {
  const name = await question('Enter name: ');
  const content = await question('Enter content: ');
  const metadata = await question('Enter metadata (optional): ');

  const timestamp = Date.now();
  const entryId = `entry-${timestamp}`;

  const entry: ArchiveEntry = {
    id: entryId,
    name,
    content,
    metadata: JSON.parse(metadata || '{}'),
    timestamp
  };

  try {
    const stored = await provider.addEntry(entry as any);
    console.log('\nEntry added successfully!');
    const count = await provider.count();
    console.log(`Total entries: ${count}`);
  } catch (error) {
    console.error('Failed to add entry:', error);
    throw error;
  }
}

async function searchByText() {
  const searchText = await question('Enter search text: ');

  try {
    const results = await provider.searchByText(searchText) as SearchResult[];

    if (results.length === 0) {
      console.log('\nNo results found');
      return;
    }

    console.log('\nText Search Results:', results.length, 'matches found');
    results.forEach((result, i) => {
      console.log(`\n--- Result ${i + 1} ---`);
      console.log('Name:', result.entry.name);
      console.log('Content:', result.entry.content);
      if (result.entry.metadata) {
        console.log('Metadata:', result.entry.metadata);
      }
      console.log('Score:', `${result.score.toFixed(2)}%`);
      if (result.matches && (result.matches.exactPhrase || (result.matches.terms && result.matches.terms.length > 0))) {
        console.log('Matches:', {
          exactPhrase: result.matches.exactPhrase,
          matchedTerms: result.matches.terms?.join(', ') || ''
        });
      }
    });
  } catch (error) {
    console.error('Text search error:', error);
  }
}

async function searchBySimilarity() {
  const searchText = await question('Enter text to find similar content: ');

  try {
    const results = await provider.searchBySimilarity(searchText) as SearchResult[];

    if (results.length === 0) {
      console.log('\nNo similar results found');
      return;
    }

    console.log('\nSimilarity Search Results:', results.length, 'matches found');
    results.forEach((result, i) => {
      console.log(`\n--- Result ${i + 1} ---`);
      console.log('Name:', result.entry.name);
      console.log('Content:', result.entry.content);
      if (result.entry.metadata) {
        console.log('Metadata:', result.entry.metadata);
      }
      console.log('Similarity Score:', `${result.score.toFixed(2)}%`);
    });
  } catch (error) {
    console.error('Similarity search error:', error);
  }
}

async function deleteEntry() {
  const name = await question('Enter name of entry to delete: ');

  try {
    const count = await provider.deleteEntriesByName(name);
    if (count === 0) {
      console.log('No entries found with that name');
    } else {
      console.log(`${count} entry/entries deleted successfully!`);
    }
  } catch (error) {
    console.error('Error deleting entries:', error);
  }
}

async function listAllEntries() {
  try {
    const entries = await provider.listEntries() as ArchiveEntry[];
    const count = await provider.count();
    console.log(`\nTotal entries: ${count}`);

    if (entries.length === 0) {
      console.log('No entries found');
      return;
    }

    entries.forEach((entry, i) => {
      console.log(`\n--- Entry ${i + 1} ---`);
      console.log('ID:', entry.id);
      console.log('Name:', entry.name);
      console.log('Content:', entry.content);
      if (entry.metadata) console.log('Metadata:', entry.metadata);
      console.log('Added:', new Date(entry.timestamp).toLocaleString());
    });
  } catch (error) {
    console.error('Failed to list entries:', error);
  }
}

async function hybridSearch() {
  const searchText = await question('Enter search text: ');

  try {
    const results = await provider.hybridSearch(searchText, {
      vectorWeight: 0.7,
      textWeight: 0.3
    }) as SearchResult[];

    if (results.length === 0) {
      console.log('\nNo results found');
      return;
    }

    console.log('\nHybrid Search Results:', results.length, 'matches found');

    results.forEach((result, i) => {
      console.log(`\n--- Result ${i + 1} ---`);
      console.log('Name:', result.entry.name);
      console.log('Content:', result.entry.content);
      if (result.entry.metadata) {
        console.log('Metadata:', result.entry.metadata);
      }
      console.log('Score:', `${result.score.toFixed(2)}%`);

      // Show match details if any text matches found
      if (result.matches && (result.matches.exactPhrase || (result.matches.terms && result.matches.terms.length > 0))) {
        console.log('Matches:', {
          exactPhrase: result.matches.exactPhrase,
          matchedTerms: result.matches.terms?.join(', ') || ''
        });
      }
    });

  } catch (error) {
    console.error('Hybrid search error:', error);
  }
}

async function main() {
  await client.connect();
  console.log('Connected to Redis');

  const config: RedisArchiveProviderConfig = {
    client,
    indexName: 'idx:archive',
    collectionName: 'recall:memory:archive:',
    embeddingModel: 'text-embedding-3-small',
    dimensions: 1536
  };

  try {
    await setupRedisSchema(
      client,
      config.indexName,
      config.collectionName,
      config.dimensions
    );

    provider = new RedisArchiveProvider(config);
    await provider.initialize();

    const count = await provider.count();
    console.log(`\nReady to use. Current entries: ${count}`);
  } catch (error) {
    console.error('Failed to initialize provider:', error);
    await client.disconnect();
    process.exit(1);
  }

  while (true) {
    console.log('\n=== Redis Search Testing CLI ===');
    console.log('1. Add new entry');
    console.log('2. Search by text');
    console.log('3. Search by similarity');
    console.log('4. Hybrid search');
    console.log('5. Delete entry');
    console.log('6. List all entries');
    console.log('7. Exit');

    const choice = await question('\nEnter your choice (1-7): ');

    try {
      switch (choice) {
        case '1':
          await addEntry();
          break;
        case '2':
          await searchByText();
          break;
        case '3':
          await searchBySimilarity();
          break;
        case '4':
          await hybridSearch();
          break;
        case '5':
          await deleteEntry();
          break;
        case '6':
          await listAllEntries();
          break;
        case '7':
          console.log('Goodbye!');
          rl.close();
          await client.disconnect();
          process.exit(0);
        default:
          console.log('Invalid choice. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}


