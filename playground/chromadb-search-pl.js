"use strict";
//import { ChromaClient, Collection } from 'chromadb';
//import { config } from 'dotenv';
//import readline from 'readline';
//import { openai } from '@ai-sdk/openai';
//import { embed, embedMany } from 'ai';
//// Load environment variables
//config();
//const COLLECTION_NAME = 'test_memory_archive';
//const client = new ChromaClient({
//  path: "http://localhost:8000"
//});
//let collection: Collection;
//const rl = readline.createInterface({
//  input: process.stdin,
//  output: process.stdout
//});
//const question = (query: string): Promise<string> => {
//  return new Promise((resolve) => {
//    rl.question(query, resolve);
//  });
//};
//async function getEmbedding(text: string) {
//  const { embedding } = await embed({
//    model: openai.embedding('text-embedding-3-small'),
//    value: text,
//  });
//  return embedding;
//}
//async function addEntry() {
//  const name = await question('Enter name: ');
//  const content = await question('Enter content: ');
//  const metadata = await question('Enter metadata (optional): ');
//  const timestamp = Date.now();
//  const id = `entry-${timestamp}`;
//  const embeddings = await getEmbedding(content);
//  try {
//    await collection.add({
//      ids: [id],
//      embeddings: [embeddings],
//      metadatas: [{
//        name,
//        content,
//        metadata: metadata || '',
//        timestamp
//      }],
//      documents: [content] // Store the content as the document for text search
//    });
//    console.log('Entry added successfully!');
//    // Show current collection info
//    const count = await collection.count();
//    console.log('\nCurrent collection count:', count);
//  } catch (error) {
//    console.error('Error adding entry:', error);
//    throw error;
//  }
//}
//interface ChromaMetadata {
//  name: string;
//  content: string;
//  metadata: string;
//  timestamp: number;
//}
//async function searchByText() {
//  const searchText = await question('Enter search text: ');
//  try {
//    // Perform text search
//    const results = await collection.query({
//      queryTexts: [searchText],
//      nResults: 20,
//      include: ['metadatas', 'distances'] as any
//    });
//    if (!results.metadatas?.[0]?.length) {
//      console.log('\nNo results found');
//      return;
//    }
//    console.log('\nText Search Results:', results.metadatas[0].length, 'matches found');
//    // Find min and max distances for normalization
//    const distances = results.distances?.[0] ?? [];
//    const minDist = Math.min(...distances);
//    const maxDist = Math.max(...distances);
//    const range = maxDist - minDist;
//    results.metadatas[0].forEach((metadata: any, i: number) => {
//      console.log(`\n--- Result ${i + 1} ---`);
//      console.log('Name:', metadata.name);
//      console.log('Content:', metadata.content);
//      if (metadata.metadata) {
//        console.log('Metadata:', metadata.metadata);
//      }
//      // Calculate combined score using both distance and text matching
//      const content = metadata.content.toLowerCase();
//      const searchTerms = searchText.toLowerCase().split(/\s+/);
//      const exactPhraseMatch = content.includes(searchText.toLowerCase());
//      const termMatches = searchTerms.filter(term => content.includes(term));
//      let textMatchScore = 0;
//      if (exactPhraseMatch) {
//        textMatchScore = 1.0; // Full score for exact phrase match
//      } else if (termMatches.length > 0) {
//        textMatchScore = termMatches.length / searchTerms.length; // Partial score for term matches
//      }
//      // Normalize distance score
//      let distanceScore = 0;
//      if (results.distances?.[0]?.[i] !== undefined) {
//        distanceScore = range === 0 ? 1 : (maxDist - results.distances[0][i]) / range;
//      }
//      // Combine scores with higher weight on text matching for text search
//      const finalScore = (textMatchScore * 0.7 + distanceScore * 0.3) * 100;
//      console.log('Score:', `${finalScore.toFixed(2)}%`);
//      if (exactPhraseMatch || termMatches.length > 0) {
//        console.log('Matches:', {
//          exactPhrase: exactPhraseMatch,
//          matchedTerms: termMatches.join(', ')
//        });
//      }
//    });
//  } catch (error) {
//    console.error('Text search error:', error);
//  }
//}
//async function searchBySimilarity() {
//  const searchText = await question('Enter text to find similar content: ');
//  try {
//    const embedding = await getEmbedding(searchText);
//    const results = await collection.query({
//      queryEmbeddings: [embedding],
//      nResults: 20,
//      include: ['metadatas', 'distances'] as any
//    });
//    if (!results.metadatas?.[0]?.length) {
//      console.log('\nNo similar results found');
//      return;
//    }
//    console.log('\nSimilarity Search Results:', results.metadatas[0].length, 'matches found');
//    // Find min and max distances for normalization
//    const distances = results.distances?.[0] ?? [];
//    const minDist = Math.min(...distances);
//    const maxDist = Math.max(...distances);
//    const range = maxDist - minDist;
//    results.metadatas[0].forEach((metadata: any, i: number) => {
//      console.log(`\n--- Result ${i + 1} ---`);
//      console.log('Name:', metadata.name);
//      console.log('Content:', metadata.content);
//      if (metadata.metadata) {
//        console.log('Metadata:', metadata.metadata);
//      }
//      if (results.distances?.[0]?.[i] !== undefined) {
//        // Normalize distance to 0-1 range and convert to similarity score
//        const normalizedDist = range === 0 ? 1 : (maxDist - results.distances[0][i]) / range;
//        const similarityScore = normalizedDist * 100;
//        console.log('Similarity Score:', `${similarityScore.toFixed(2)}%`);
//      }
//    });
//  } catch (error) {
//    console.error('Similarity search error:', error);
//  }
//}
//async function hybridSearch() {
//  const searchText = await question('Enter search text: ');
//  try {
//    const embedding = await getEmbedding(searchText);
//    // First get semantic search results
//    const results = await collection.query({
//      queryEmbeddings: [embedding],
//      nResults: 20,
//      include: ['metadatas', 'distances'] as any
//    });
//    if (!results.metadatas?.[0]?.length) {
//      console.log('\nNo results found');
//      return;
//    }
//    // Find min and max distances for normalization
//    const distances = results.distances?.[0] ?? [];
//    const minDist = Math.min(...distances);
//    const maxDist = Math.max(...distances);
//    const range = maxDist - minDist;
//    // Process and score results
//    const processedResults = results.metadatas[0].map((metadata: any, i: number) => {
//      // Normalize distance to 0-1 range
//      const distances = results.distances?.[0];
//      if (!distances) {
//        return {
//          doc: { value: metadata },
//          vectorScore: 0,
//          textScore: 0,
//          finalScore: 0,
//          matches: {
//            exactPhrase: false,
//            terms: []
//          }
//        };
//      }
//      const normalizedDist = range === 0 ? 1 : (maxDist - distances[i]!) / range;
//      const vectorScore = normalizedDist;
//      // Check for relevant terms in content
//      const content = metadata.content.toLowerCase();
//      const searchTerms = searchText.toLowerCase().split(/\s+/);
//      // Calculate text relevance based on content only
//      let textScore = 0;
//      const exactPhraseMatch = content.includes(searchText.toLowerCase());
//      const termMatches = searchTerms.filter(term => content.includes(term));
//      if (exactPhraseMatch) {
//        textScore = 0.3; // Boost for exact phrase match
//      } else if (termMatches.length > 0) {
//        textScore = 0.15 * (termMatches.length / searchTerms.length); // Partial match boost
//      }
//      // Final score heavily weights vector similarity but boosts for text matches
//      const finalScore = (vectorScore * 0.7 + textScore * 0.3) * 100;
//      return {
//        doc: { value: metadata },
//        vectorScore,
//        textScore,
//        finalScore,
//        matches: {
//          exactPhrase: exactPhraseMatch,
//          terms: termMatches
//        }
//      };
//    });
//    // Sort by final score
//    const sortedResults = processedResults
//      .sort((a, b) => b.finalScore - a.finalScore)
//      .slice(0, 20);
//    console.log('\nHybrid Search Results:', sortedResults.length, 'matches found');
//    sortedResults.forEach((result, i) => {
//      console.log(`\n--- Result ${i + 1} ---`);
//      console.log('Name:', result.doc.value.name);
//      console.log('Content:', result.doc.value.content);
//      if (result.doc.value.metadata) {
//        console.log('Metadata:', result.doc.value.metadata);
//      }
//      console.log('Final Score:', `${result.finalScore.toFixed(2)}%`);
//      console.log('Vector Score:', `${(result.vectorScore * 100).toFixed(2)}%`);
//      console.log('Text Score:', `${(result.textScore * 100).toFixed(2)}%`);
//      if (result.matches.exactPhrase || result.matches.terms.length > 0) {
//        console.log('Matches:', {
//          exactPhrase: result.matches.exactPhrase,
//          matchedTerms: result.matches.terms.join(', ')
//        });
//      }
//    });
//  } catch (error) {
//    console.error('Hybrid search error:', error);
//  }
//}
//async function deleteEntry() {
//  const name = await question('Enter name of entry to delete: ');
//  try {
//    // First find entries with matching name
//    const results = await collection.query({
//      queryTexts: [name],
//      nResults: 100,
//      where: { "name": name }
//    });
//    if (!results.ids?.[0]?.length) {
//      console.log('No entries found with that name');
//      return;
//    }
//    // Delete found entries
//    await collection.delete({
//      ids: results.ids[0]
//    });
//    console.log('Entry(ies) deleted successfully!');
//  } catch (error) {
//    console.error('Error deleting entry:', error);
//  }
//}
//async function listAllEntries() {
//  try {
//    // Get all entries
//    const results = await collection.get({
//      include: ['metadatas', 'documents'] as any
//    });
//    if (!results.metadatas?.length) {
//      console.log('\nNo entries found');
//      return;
//    }
//    console.log('\nAll Entries:', results.metadatas.length, 'entries found');
//    // Sort by timestamp
//    const entries = results.metadatas
//      .map((metadata, index) => ({
//        id: results.ids?.[index] ?? '',
//        metadata: metadata as unknown as ChromaMetadata
//      }))
//      .filter(entry =>
//        entry.metadata &&
//        typeof entry.metadata.timestamp === 'number' &&
//        typeof entry.metadata.name === 'string' &&
//        typeof entry.metadata.content === 'string'
//      )
//      .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
//    entries.forEach((entry, i) => {
//      console.log(`\n--- Entry ${i + 1} ---`);
//      console.log('ID:', entry.id);
//      console.log('Name:', entry.metadata.name);
//      console.log('Content:', entry.metadata.content);
//      console.log('Metadata:', entry.metadata.metadata);
//      console.log('Timestamp:', new Date(entry.metadata.timestamp).toLocaleString());
//    });
//    // Show collection info
//    const count = await collection.count();
//    console.log('\nCollection Info:', {
//      count,
//      name: COLLECTION_NAME
//    });
//  } catch (error) {
//    console.error('Error listing entries:', error);
//  }
//}
//async function main() {
//  //await setupCollection();
//  collection = await client.getCollection({
//    name: COLLECTION_NAME,
//    embeddingFunction: {
//      generate: async (texts: string[]) => {
//        const { embeddings } = await embedMany({
//          model: openai.embedding('text-embedding-3-small'),
//          values: texts
//        });
//        return embeddings;
//      }
//    }
//  });
//  while (true) {
//    console.log('\n=== ChromaDB Search Testing CLI ===');
//    console.log('1. Add new entry');
//    console.log('2. Search by text');
//    console.log('3. Search by similarity');
//    console.log('4. Hybrid search');
//    console.log('5. Delete entry');
//    console.log('6. List all entries');
//    console.log('7. Exit');
//    const choice = await question('\nEnter your choice (1-7): ');
//    try {
//      switch (choice) {
//        case '1':
//          await addEntry();
//          break;
//        case '2':
//          await searchByText();
//          break;
//        case '3':
//          await searchBySimilarity();
//          break;
//        case '4':
//          await hybridSearch();
//          break;
//        case '5':
//          await deleteEntry();
//          break;
//        case '6':
//          await listAllEntries();
//          break;
//        case '7':
//          console.log('Goodbye!');
//          rl.close();
//          process.exit(0);
//        default:
//          console.log('Invalid choice. Please try again.');
//      }
//    } catch (error) {
//      console.error('Error:', error);
//    }
//  }
//}
//// Run the CLI if this file is executed directly
//if (require.main === module) {
//  main().catch(console.error);
//} 
