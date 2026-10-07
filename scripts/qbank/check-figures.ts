// Checks every file in figures/ against figures/index.json: present, same size in bytes, same
// SHA-256, same pixel size, decodes fully, no extra files. Prints the size report.
// Needs neither Poppler nor the PDF.
// Usage: npm run qbank:figures:check [-- --figures DIR]
// Exits 1 on any error.

import { join, resolve } from 'node:path';
import { verifyFigureFiles } from './lib/figure-files.ts';
import { checkFigureIndex, checkReferences, readJson } from './lib/data.ts';
import { REPO_ROOT } from './lib/validate.ts';

function usage(msg: string): never {
  console.error(msg);
  console.error('Usage: npm run qbank:figures:check [-- --figures DIR]');
  process.exit(2);
}

let dir = join(REPO_ROOT, 'figures');
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--figures' && argv[i + 1] !== undefined) {
    dir = resolve(argv[i + 1]);
    i++;
  } else {
    usage(`Unknown or incomplete argument: ${argv[i]}`);
  }
}

const refs = checkReferences(readJson(join(REPO_ROOT, 'data', 'references.json')));
for (const e of refs.errors) console.log(`ERROR data/references.json: ${e}`);

let raw: unknown;
try {
  raw = readJson(join(dir, 'index.json'));
} catch (e) {
  console.log(`ERROR ${join(dir, 'index.json')}: cannot read JSON: ${(e as Error).message}`);
  process.exit(1);
}
const { index, errors: indexErrors } = checkFigureIndex(raw, refs.docs);
for (const e of indexErrors) console.log(`ERROR ${e}`);
if (index === null) process.exit(1);

const { errors, report } = await verifyFigureFiles(dir, index);
for (const e of errors) console.log(`ERROR ${e}`);
for (const line of report) console.log(line);
const total = refs.errors.length + indexErrors.length + errors.length;
console.log(`${total} errors`);
process.exit(total > 0 ? 1 : 0);
