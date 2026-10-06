// Extracts the ACS knowledge elements from references/uas_acs.pdf into data/acs-10b-knowledge.json.
// Usage:
//   npm run qbank:acs:extract   writes the data file
//   npm run qbank:acs:check     re-extracts and compares with the committed file (exit 1 if different)
// pdftotext is found from $PDFTOTEXT, then PATH, then the copy bundled with Git for Windows.
// Reads references/ only; never writes there.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAcsText } from './lib/acs-extract.ts';
import { checkReferences, readJson } from './lib/data.ts';
import { REPO_ROOT } from './lib/validate.ts';

// Hardcoded literals, confirmed by hand against the PDF. Never read these from the output file.
const EXPECTED_TOTAL = 176;
const EXPECTED_PER_AREA: Record<string, number> = { I: 77, II: 26, III: 17, IV: 4, V: 52 };
const EXPECTED_AREAS = 5;

const check = process.argv.includes('--check');
const outPath = join(REPO_ROOT, 'data', 'acs-10b-knowledge.json');

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const { docs, errors } = checkReferences(readJson(join(REPO_ROOT, 'data', 'references.json')));
if (docs === null) fail(`data/references.json is invalid: ${errors.join('; ')}`);
const ref = docs.find((d) => d.key === 'acs-10b');
if (ref === undefined) fail('data/references.json has no acs-10b entry');

const pdfPath = join(REPO_ROOT, 'references', ref.local_file);
if (!existsSync(pdfPath)) fail(`references/${ref.local_file} not found`);
const pdfHash = createHash('sha256').update(readFileSync(pdfPath)).digest('hex');
if (pdfHash !== ref.sha256) fail(`references/${ref.local_file} SHA-256 is ${pdfHash}; references.json expects ${ref.sha256}`);

function candidates(): string[] {
  const list: string[] = [];
  if (process.env.PDFTOTEXT) list.push(process.env.PDFTOTEXT);
  list.push('pdftotext');
  list.push('C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe');
  return list;
}

function toolVersion(bin: string): string | null {
  try {
    // pdftotext -v prints to stderr and may exit non-zero; capture both streams.
    const out = execFileSync(bin, ['-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return out;
  } catch (e) {
    const err = e as { code?: string; stderr?: string; stdout?: string };
    if (err.code === 'ENOENT') return null;
    return `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
}

let bin: string | null = null;
let versionText = '';
for (const c of candidates()) {
  const v = toolVersion(c);
  if (v !== null && /pdftotext version/i.test(v)) {
    bin = c;
    versionText = v;
    break;
  }
}
if (bin === null) fail('pdftotext not found; set PDFTOTEXT or install it (Git for Windows includes it)');

const version = /pdftotext version (\S+)/i.exec(versionText)?.[1] ?? 'unknown';
const vendor = /Glyph & Cog/i.test(versionText) ? 'Xpdf' : /poppler/i.test(versionText) ? 'Poppler' : 'pdftotext';
const extractedWith = `pdftotext -raw -enc UTF-8 (${vendor} ${version})`;

const text = execFileSync(bin, ['-raw', '-enc', 'UTF-8', pdfPath, '-'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'], // pdftotext prints harmless font warnings on stderr
  maxBuffer: 64 * 1024 * 1024,
});

const { areas, elements } = parseAcsText(text);

const problems: string[] = [];
const codes = new Set(elements.map((e) => e.code));
if (codes.size !== elements.length) problems.push('duplicate codes extracted');
if (elements.length !== EXPECTED_TOTAL) problems.push(`extracted ${elements.length} elements; expected ${EXPECTED_TOTAL}`);
for (const [area, n] of Object.entries(EXPECTED_PER_AREA)) {
  const got = elements.filter((e) => e.area === area).length;
  if (got !== n) problems.push(`area ${area}: extracted ${got} elements; expected ${n}`);
}
if (areas.length !== EXPECTED_AREAS) problems.push(`extracted ${areas.length} areas; expected ${EXPECTED_AREAS}`);
for (const e of elements) if (e.description === '') problems.push(`${e.code} has an empty description`);
if (problems.length > 0) fail(`extraction failed its checks:\n  ${problems.join('\n  ')}`);

const output =
  JSON.stringify({ doc: 'acs-10b', source_sha256: ref.sha256, extracted_with: extractedWith, areas, elements }, null, 2) + '\n';

if (check) {
  if (!existsSync(outPath)) fail('data/acs-10b-knowledge.json does not exist; run npm run qbank:acs:extract');
  const committed = readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n');
  if (committed !== output) fail('data/acs-10b-knowledge.json differs from a fresh extraction');
  console.log(`OK: data/acs-10b-knowledge.json matches a fresh extraction (${elements.length} elements, ${areas.length} areas, ${extractedWith})`);
} else {
  writeFileSync(outPath, output, 'utf8');
  console.log(`Wrote data/acs-10b-knowledge.json (${elements.length} elements, ${areas.length} areas, ${extractedWith})`);
}
