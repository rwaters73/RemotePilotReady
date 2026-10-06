// Prints the content_hash of each question file given.
// Usage: npm run qbank:hash -- questions/RPR-0001.md [more files]
// Output: one line per file, "<hash>  <file>". Exits 1 if any file cannot be hashed.

import { readFileSync } from 'node:fs';
import { computeContentHash, decodeUtf8 } from './lib/hash.ts';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run qbank:hash -- questions/RPR-NNNN.md [more files]');
  process.exit(2);
}
let failed = false;
for (const file of files) {
  try {
    console.log(`${computeContentHash(decodeUtf8(readFileSync(file)))}  ${file}`);
  } catch (e) {
    console.error(`ERROR ${file}: ${(e as Error).message}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
