import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { computeContentHash, hashableText, HashInputError } from '../lib/hash.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');

// Known-answer vector. The expected value was computed independently in Git Bash, not with lib/hash.ts:
//   printf -- '---\nid: RPR-0001\n---\nStem text.\n' | sha256sum
const KAT_INPUT = '---\r\nid: RPR-0001\r\nreview:\r\n  status: draft\r\n  notes: null\r\n---\r\nStem text.  \t\r\n\r\n\r\n';
const KAT_HASHED = '---\nid: RPR-0001\n---\nStem text.\n';
const KAT_EXPECTED = '5ef72b7d30998cd06092d5407b50bcab4fb63b41541a9148accf47e2d2565847';

test('known-answer vector', () => {
  assert.equal(hashableText(KAT_INPUT), KAT_HASHED);
  assert.equal(computeContentHash(KAT_INPUT), KAT_EXPECTED);
});

const original = readFileSync(join(FIXTURES, 'good', 'RPR-0001.md'), 'utf8');
const base = computeContentHash(original);

test('line-ending and trailing-whitespace variants hash the same', () => {
  const crlf = original.replace(/\n/g, '\r\n');
  const cr = original.replace(/\n/g, '\r');
  const trailingSpaces = original.split('\n').map((l) => (l === '' ? l : `${l} \t `)).join('\n');
  const extraNewlines = original + '\n\n\n';
  const noFinalNewline = original.replace(/\n+$/, '');
  for (const variant of [crlf, cr, trailingSpaces, extraNewlines, noFinalNewline]) {
    assert.equal(computeContentHash(variant), base);
  }
});

test('changing the stem, an option, a source, the answer, or figures changes the hash', () => {
  const edits = [
    original.replace('Fixture stem for the validator tests.', 'Fixture stem for the validator tests!'),
    original.replace('  C: "Fixture option three"', '  C: "Fixture option thre"'),
    original.replace('passage: "Fixture passage text."', 'passage: "Fixture passage text"'),
    original.replace('answer: A', 'answer: B'),
    original.replace('figures: []', 'figures: ["fig-26"]'),
    original.replace('Fixture explanation', 'Fixture  explanation'),
  ];
  for (const edited of edits) {
    assert.notEqual(edited, original, 'edit must apply');
    assert.notEqual(computeContentHash(edited), base);
  }
});

test('changing review fields does not change the hash', () => {
  const edits = [
    original.replace('  status: approved', '  status: held'),
    original.replace('  notes: null', '  notes: "Something to recheck."'),
    original.replace('  reviewed_at: "2026-10-07"', '  reviewed_at: "2027-01-01"'),
    original.replace('  reviewed_by: q-reviewer', '  reviewed_by: rick'),
  ];
  for (const edited of edits) {
    assert.notEqual(edited, original, 'edit must apply');
    assert.equal(computeContentHash(edited), base);
  }
});

test('a BOM, missing front matter, or missing review line is rejected', () => {
  assert.throws(() => computeContentHash('﻿' + original), HashInputError);
  assert.throws(() => computeContentHash('Stem only.\n'), HashInputError);
  assert.throws(() => computeContentHash('---\nid: RPR-0001\n---\nStem.\n'), HashInputError);
});
