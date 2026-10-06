import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkAcs, checkReferences, readJson } from '../lib/data.ts';
import type { AcsData, ReferenceDoc } from '../lib/types.ts';
import { REPO_ROOT } from '../lib/validate.ts';

const acs = readJson(join(REPO_ROOT, 'data', 'acs-10b-knowledge.json')) as AcsData;
const refs = checkReferences(readJson(join(REPO_ROOT, 'data', 'references.json'))).docs as ReferenceDoc[];

test('committed ACS file: 176 unique codes with the per-area counts confirmed in the PDF', () => {
  // Hardcoded literals, deliberately not read from the file under test.
  assert.equal(acs.elements.length, 176);
  assert.equal(new Set(acs.elements.map((e) => e.code)).size, 176);
  const perArea: Record<string, number> = { I: 77, II: 26, III: 17, IV: 4, V: 52 };
  for (const [area, n] of Object.entries(perArea)) {
    assert.equal(acs.elements.filter((e) => e.area === area).length, n, `area ${area}`);
  }
  assert.deepEqual(
    acs.areas.map((a) => a.numeral),
    ['I', 'II', 'III', 'IV', 'V'],
  );
});

test('committed ACS file: spot checks against the printed text', () => {
  const spot: Record<string, string> = {
    'UA.I.B.K10': 'Visual line of sight (VLOS) aircraft operations.',
    'UA.I.B.K14a': 'a. See and avoid other aircraft and other potential hazard considerations of the remote PIC',
    'UA.I.B.K21d': 'd. Cloud clearance requirements',
    // Wrapped onto a second line in the PDF.
    'UA.I.A.K3': 'The ramifications of falsification, reproduction, or alteration of a certificate, rating, authorization, record, or report.',
    // Starts with a form feed (page break) in the pdftotext output.
    'UA.I.B.K24': 'Civil twilight operations.',
    'UA.I.F.K7': 'Product labeling.',
  };
  for (const [code, description] of Object.entries(spot)) {
    const el = acs.elements.find((e) => e.code === code);
    assert.ok(el, `${code} present`);
    assert.equal(el.description, description, code);
  }
  assert.equal(acs.elements.find((e) => e.code === 'UA.I.F.K8'), undefined, 'Task F has seven elements');
});

test('the ACS data check accepts the committed file and rejects bad copies', () => {
  assert.deepEqual(checkAcs(acs, refs).errors, []);

  const duplicated = { ...acs, elements: [...acs.elements.slice(0, 175), { ...acs.elements[0] }] };
  assert.ok(checkAcs(duplicated, refs).errors.some((e) => e.includes('more than once')));

  const short = { ...acs, elements: acs.elements.slice(0, 175) };
  assert.ok(checkAcs(short, refs).errors.some((e) => e.includes('175 elements')));

  const badCode = { ...acs, elements: [{ ...acs.elements[0], code: 'UA.VI.A.K1' }, ...acs.elements.slice(1)] };
  assert.ok(checkAcs(badCode, refs).errors.some((e) => e.includes('code pattern')));

  const wrongSource = { ...acs, source_sha256: '0'.repeat(64) };
  assert.ok(checkAcs(wrongSource, refs).errors.some((e) => e.includes('source_sha256')));
});
