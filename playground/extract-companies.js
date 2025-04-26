"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parse_1 = require("csv-parse");
const csv_stringify_1 = require("csv-stringify");
const INPUT_FILE = path_1.default.join(__dirname, 'companies_sorted.csv');
const OUTPUT_FILE = path_1.default.join(__dirname, 'companies_100k.csv');
const LIMIT = 100_000;
async function extractCompanies() {
    const parser = fs_1.default.createReadStream(INPUT_FILE)
        .pipe((0, csv_parse_1.parse)({
        columns: true,
        skip_empty_lines: true,
        trim: true
    }));
    const stringifier = (0, csv_stringify_1.stringify)({
        header: true,
        quoted: true // Ensure proper escaping of fields
    });
    const writeStream = fs_1.default.createWriteStream(OUTPUT_FILE);
    stringifier.pipe(writeStream);
    let count = 0;
    for await (const record of parser) {
        if (count >= LIMIT)
            break;
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
