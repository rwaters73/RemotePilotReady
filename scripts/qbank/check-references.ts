// Compares each local_file in references/ with its sha256 in data/references.json.
// Reports match, MISMATCH, or missing for each document. A missing file is reported but does not
// fail the run (the laptop may not have every PDF); a mismatch or bad data file exits 1.
// Reads references/ only; never writes there.

import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkReferences, readJson } from './lib/data.ts';
import { REPO_ROOT } from './lib/validate.ts';

function sha256File(path: string): Promise<string> {
  return new Promise((res, rej) => {
    const h = createHash('sha256');
    createReadStream(path)
      .on('data', (c) => h.update(c))
      .on('end', () => res(h.digest('hex')))
      .on('error', rej);
  });
}

const { docs, errors } = checkReferences(readJson(join(REPO_ROOT, 'data', 'references.json')));
if (docs === null) {
  for (const e of errors) console.log(`ERROR data/references.json: ${e}`);
  process.exit(1);
}

const counts = { match: 0, mismatch: 0, missing: 0 };
for (const d of docs) {
  const path = join(REPO_ROOT, 'references', d.local_file);
  if (!existsSync(path)) {
    counts.missing++;
    console.log(`missing   ${d.key}: references/${d.local_file}`);
    continue;
  }
  const actual = await sha256File(path);
  if (actual === d.sha256) {
    counts.match++;
    console.log(`match     ${d.key}: references/${d.local_file}`);
  } else {
    counts.mismatch++;
    console.log(`MISMATCH  ${d.key}: references/${d.local_file} (expected ${d.sha256}, got ${actual})`);
  }
}
console.log(`${docs.length} documents: ${counts.match} match, ${counts.mismatch} mismatch, ${counts.missing} missing`);
process.exit(counts.mismatch > 0 ? 1 : 0);
