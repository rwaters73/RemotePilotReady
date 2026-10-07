import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkFigureIndex, checkReferences, readJson } from '../lib/data.ts';
import type { ReferenceDoc } from '../lib/types.ts';
import { REPO_ROOT } from '../lib/validate.ts';

const FIXTURE_INDEX = join(import.meta.dirname, 'fixtures', 'figures', 'index.json');
const refs = checkReferences(readJson(join(REPO_ROOT, 'data', 'references.json'))).docs as ReferenceDoc[];

// Mutable JSON, so each test can break one field of a fresh copy.
type Json = any;

function fixture(): Json {
  return structuredClone(readJson(FIXTURE_INDEX));
}

function rejects(mutate: (ix: Json) => void, substring: string): void {
  const ix = fixture();
  mutate(ix);
  const { index, errors } = checkFigureIndex(ix, refs);
  assert.equal(index, null, `expected a rejection containing "${substring}"`);
  assert.ok(errors.some((e) => e.includes(substring)), `no error contains "${substring}": ${JSON.stringify(errors)}`);
}

// Item 0 is fig-26 (rotate 0); item 4 is legend-1 (rotate 90).
const FIG26 = 0;
const LEGEND1 = 4;

test('the fixture index passes checkFigureIndex', () => {
  const { index, errors } = checkFigureIndex(fixture(), refs);
  assert.deepEqual(errors, []);
  assert.ok(index !== null);
});

test('rejects: missing webp', () => {
  rejects((ix) => delete ix.items[FIG26].files.webp, 'files must have exactly the keys png and webp');
});

test('rejects: wrong extension', () => {
  rejects((ix) => (ix.items[FIG26].files.png.name = 'fig-26.jpg'), 'files.png.name must be "fig-26.png"');
});

test('rejects: name not matching the key', () => {
  rejects((ix) => (ix.items[FIG26].files.webp.name = 'fig-27.webp'), 'files.webp.name must be "fig-26.webp"');
});

test('rejects: a slash in the name', () => {
  rejects((ix) => (ix.items[FIG26].files.png.name = 'sub/fig-26.png'), 'files.png.name must be "fig-26.png"');
});

test('rejects: PNG and WebP sizes that differ', () => {
  rejects((ix) => (ix.items[FIG26].files.webp.width = 2), 'the PNG and WebP sizes differ');
});

test('rejects: an uppercase SHA', () => {
  rejects(
    (ix) => (ix.items[FIG26].files.png.sha256 = ix.items[FIG26].files.png.sha256.toUpperCase()),
    'files.png.sha256 must be 64 lowercase hex characters',
  );
});

test('rejects: zero bytes', () => {
  rejects((ix) => (ix.items[FIG26].files.png.bytes = 0), 'files.png.bytes must be a positive integer');
});

test('rejects: rotate 45', () => {
  rejects((ix) => (ix.items[FIG26].rotate = 45), 'rotate must be 0, 90, 180 or 270');
});

test('rejects: an unknown item key crop_px (the v1 shape)', () => {
  rejects((ix) => (ix.items[FIG26].crop_px = [0, 0, 1, 1]), 'has unknown key "crop_px"');
});

test('rejects: an unknown top-level key', () => {
  rejects((ix) => (ix.generated_at = 'today'), 'unknown top-level key "generated_at"');
});

test('rejects: extracted_with null while items exist', () => {
  rejects((ix) => (ix.extracted_with = null), 'extracted_with must not be null while items is not empty');
});

test('rejects: extracted_with with a missing key', () => {
  rejects((ix) => delete ix.extracted_with.libvips, 'extracted_with must have exactly the keys');
});

test('rejects: erase_pad_pt -1', () => {
  rejects((ix) => (ix.extracted_with.erase_pad_pt = -1), 'erase_pad_pt must be a finite number >= 0');
});

test('rejects: a wrong source_sha256', () => {
  rejects(
    (ix) => (ix.source_sha256 = '0'.repeat(64)),
    'figures/index.json source_sha256 does not match the akts-2h sha256 in references.json',
  );
});

test('rejects: printed_page "1-5" on a figure', () => {
  rejects((ix) => (ix.items[FIG26].printed_page = '1-5'), 'must start with 2- for a figure');
});

test('rejects: rotate 90 with body_px reaching into caption_px', () => {
  rejects((ix) => (ix.items[LEGEND1].body_px = [0, 0, 1, 2]), 'body_px must end above caption_px when rotate is not 0');
});

test('control: the same overlap with rotate 0 is accepted', () => {
  const ix = fixture();
  ix.items[FIG26].body_px = [0, 0, 1, 2];
  assert.deepEqual(checkFigureIndex(ix, refs).errors, []);
});
