import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';

const INPUT_FILE = path.join(__dirname, 'companies_sorted.csv');
const OUTPUT_FILE = path.join(__dirname, 'companies_100k.csv');
const LIMIT = 100_000;

async function extractCompanies() {
  const parser = fs.createReadStream(INPUT_FILE)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    }));

  const stringifier = stringify({
    header: true,
    quoted: true // Ensure proper escaping of fields
  });

  const writeStream = fs.createWriteStream(OUTPUT_FILE);
  stringifier.pipe(writeStream);

  let count = 0;

  for await (const record of parser) {
    if (count >= LIMIT) break;

    stringifier.write(record);
    count++;

    if (count % 10000 === 0) {
      console.log(`Processed ${count} records`);
    }
  }

  stringifier.end();
  console.log(`\nExtracted ${count} records to ${OUTPUT_FILE}`);
}

console.log('Starting extraction...');
extractCompanies().catch(console.error); 
