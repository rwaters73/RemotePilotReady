// Validates the complete example in docs/QUESTION_FORMAT.md, so the spec and the validator can't drift apart.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { defaultPaths, REPO_ROOT, validateBank } from '../lib/validate.ts';

function extractExample(): string {
  const spec = readFileSync(join(REPO_ROOT, 'docs', 'QUESTION_FORMAT.md'), 'utf8').replace(/\r\n/g, '\n');
  const section = spec.indexOf('\n## 10. Complete example');
  assert.ok(section >= 0, 'spec has a "## 10. Complete example" section');
  const open = spec.indexOf('\n```markdown\n', section);
  assert.ok(open >= 0, 'example is in a ```markdown block');
  const start = open + '\n```markdown\n'.length;
  const end = spec.indexOf('\n```\n', start);
  assert.ok(end >= 0, 'example block is closed');
  return spec.slice(start, end + 1);
}

test('the spec example is a valid approved question', () => {
  const example = extractExample();
  assert.match(example, /^---\nid: RPR-0001\n/);
  assert.match(example, /\n {2}status: approved\n/);
  const dir = mkdtempSync(join(tmpdir(), 'qbank-spec-'));
  try {
    writeFileSync(join(dir, 'RPR-0001.md'), example, 'utf8');
    assert.deepEqual(validateBank({ ...defaultPaths(), questionsDir: dir }), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
