import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkIds } from '../lib/checks.ts';
import { defaultPaths, REPO_ROOT, validateBank } from '../lib/validate.ts';
import type { BankPaths } from '../lib/validate.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function paths(questionsDir: string, overrides: Partial<BankPaths> = {}): BankPaths {
  return { ...defaultPaths(), questionsDir, figuresDir: join(FIXTURES, 'figures'), ...overrides };
}

// Every check the validator must have. A hardcoded literal list on purpose: it is compared with the
// registry, so it must not be built from the registry.
const EXPECTED_CHECK_IDS = [
  'data',
  'file-name',
  'parse',
  'schema',
  'body',
  'id-match',
  'id-sequence',
  'acs-code',
  'source-doc',
  'source-edition',
  'area-i-cfr',
  'figure',
  'status',
  'content-hash',
  'option-text',
];

// Bad fixture case -> the one check it must fail. A hardcoded literal table, not built from the registry.
const BAD_CASES: { name: string; check: string; overrides?: Partial<BankPaths> }[] = [
  { name: 'data-references-duplicate-key', check: 'data', overrides: { referencesPath: join(FIXTURES, 'data', 'references-duplicate-key.json') } },
  { name: 'file-name', check: 'file-name' },
  { name: 'file-name-zero', check: 'file-name' },
  { name: 'parse-yaml', check: 'parse' },
  { name: 'parse-no-frontmatter', check: 'parse' },
  { name: 'parse-duplicate-key', check: 'parse' },
  { name: 'parse-comment', check: 'parse' },
  { name: 'parse-html-comment-frontmatter', check: 'parse' },
  { name: 'schema-missing-answer', check: 'schema' },
  { name: 'schema-four-options', check: 'schema' },
  { name: 'schema-duplicate-option', check: 'schema' },
  { name: 'schema-unquoted-option', check: 'schema' },
  { name: 'schema-unknown-key-area', check: 'schema' },
  { name: 'schema-key-order', check: 'schema' },
  { name: 'schema-review-flow-style', check: 'schema' },
  { name: 'schema-empty-sources', check: 'schema' },
  { name: 'schema-figures-null', check: 'schema' },
  { name: 'schema-unquoted-source', check: 'schema' },
  { name: 'body-no-explanation', check: 'body' },
  { name: 'body-html', check: 'body' },
  { name: 'body-html-comment', check: 'body' },
  { name: 'id-match', check: 'id-match' },
  { name: 'id-sequence', check: 'id-sequence' },
  { name: 'acs-code-unknown', check: 'acs-code' },
  { name: 'acs-code-bad-area', check: 'acs-code' },
  { name: 'source-doc', check: 'source-doc' },
  { name: 'source-edition', check: 'source-edition' },
  { name: 'area-i-cfr', check: 'area-i-cfr' },
  { name: 'figure-not-in-index', check: 'figure' },
  { name: 'figure-file-missing', check: 'figure' },
  { name: 'figure-malformed-key', check: 'figure' },
  { name: 'figure-duplicate-key', check: 'figure' },
  { name: 'figure-webp-missing', check: 'figure' },
  { name: 'figure-png-missing', check: 'figure' },
  { name: 'status-invalid', check: 'status' },
  { name: 'status-returned-no-notes', check: 'status' },
  { name: 'status-bad-reviewed-by', check: 'status' },
  { name: 'status-approved-by-rick', check: 'status' },
  { name: 'content-hash-mismatch', check: 'content-hash' },
  { name: 'content-hash-null-approved', check: 'content-hash' },
  { name: 'content-hash-on-draft', check: 'content-hash' },
  { name: 'content-hash-held-mismatch', check: 'content-hash' },
  { name: 'option-text', check: 'option-text' },
  { name: 'option-text-both', check: 'option-text' },
  { name: 'option-text-all-of-these', check: 'option-text' },
];

test('the registry has exactly the expected checks', () => {
  assert.deepEqual([...checkIds()].sort(), [...EXPECTED_CHECK_IDS].sort());
});

test('every check has at least one bad fixture', () => {
  const covered = new Set(BAD_CASES.map((c) => c.check));
  for (const id of EXPECTED_CHECK_IDS) assert.ok(covered.has(id), `no bad fixture for check "${id}"`);
  for (const id of checkIds()) assert.ok(covered.has(id), `no bad fixture for registered check "${id}"`);
});

test('good fixtures: zero issues', () => {
  assert.deepEqual(validateBank(paths(join(FIXTURES, 'good'))), []);
});

test('the real data files and the real questions folder validate', () => {
  const issues = validateBank(defaultPaths()).filter((i) => i.severity === 'error');
  assert.deepEqual(issues, []);
});

for (const c of BAD_CASES) {
  test(`bad fixture ${c.name} fails only "${c.check}"`, () => {
    const issues = validateBank(paths(join(FIXTURES, 'bad', c.name), c.overrides));
    assert.ok(
      issues.some((i) => i.check === c.check && i.severity === 'error'),
      `expected a "${c.check}" error, got: ${JSON.stringify(issues)}`,
    );
    const others = issues.filter((i) => i.check !== c.check);
    assert.deepEqual(others, [], 'no other check may fire');
  });
}

test('edition mismatch on an approved question is a warning, not an error', () => {
  const issues = validateBank(paths(join(FIXTURES, 'warn', 'source-edition-approved')));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].check, 'source-edition');
  assert.equal(issues[0].severity, 'warning');
});

function withTempBank(files: Record<string, string | Buffer>, fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'qbank-test-'));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const goodDraft = readFileSync(join(FIXTURES, 'good', 'RPR-0003.md'), 'utf8').replace('RPR-0003', 'RPR-0001');

test('an empty questions folder (only .gitkeep) has zero issues', () => {
  withTempBank({ '.gitkeep': '' }, (dir) => assert.deepEqual(validateBank(paths(dir)), []));
});

test('a file with a BOM fails parse only', () => {
  withTempBank({ 'RPR-0001.md': '﻿' + goodDraft }, (dir) => {
    const issues = validateBank(paths(dir));
    assert.ok(issues.length > 0);
    assert.ok(issues.every((i) => i.check === 'parse'), JSON.stringify(issues));
  });
});

test('invalid UTF-8 fails parse only', () => {
  withTempBank({ 'RPR-0001.md': Buffer.concat([Buffer.from(goodDraft, 'utf8'), Buffer.from([0xff, 0xfe])]) }, (dir) => {
    const issues = validateBank(paths(dir));
    assert.ok(issues.length > 0);
    assert.ok(issues.every((i) => i.check === 'parse'), JSON.stringify(issues));
  });
});

test('a CRLF copy of an approved question still validates', () => {
  const approved = readFileSync(join(FIXTURES, 'good', 'RPR-0001.md'), 'utf8').replace(/\n/g, '\r\n');
  withTempBank({ 'RPR-0001.md': approved }, (dir) => assert.deepEqual(validateBank(paths(dir)), []));
});

function runCli(args: string[]): number | null {
  const r = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', 'qbank', 'validate.ts'), ...args], { encoding: 'utf8' });
  return r.status;
}

test('CLI exits 0 on good, 0 on warnings only, and 1 on a bad case', () => {
  const figs = ['--figures', join(FIXTURES, 'figures')];
  assert.equal(runCli(['--questions', join(FIXTURES, 'good'), ...figs]), 0);
  assert.equal(runCli(['--questions', join(FIXTURES, 'warn', 'source-edition-approved'), ...figs]), 0);
  assert.equal(runCli(['--questions', join(FIXTURES, 'bad', 'content-hash-mismatch'), ...figs]), 1);
});
