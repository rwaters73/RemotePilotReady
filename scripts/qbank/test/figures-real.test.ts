// Real-data tests for the extracted Testing Supplement figures (B-101). These fail until the
// extraction has been run and its output transferred: that failure is the negative control
// showing the tests can fail.
//
// Every expected value below is a hardcoded literal, deliberately not imported from
// lib/figures.ts (no EXPECTED_*, SAVE_WORDS_CONTROLS or other constants): a test sourced from the
// constant under test can't catch a member disappearing from that constant. Only functions are
// imported.
//
// Paths are the repo defaults. For mutation checks they can be pointed at copies with
// FIGURES_REAL_DIR (a figures folder), FIGURES_REAL_ROTATIONS (a rotations file) and
// FIGURES_REAL_WORDS (a words fixture).

import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { checkReferences, readJson } from '../lib/data.ts';
import { detectDirection, detectOrientation, findCaptionSideways } from '../lib/figures.ts';
import type { Word } from '../lib/figures.ts';
import type { FigureIndex, ReferenceDoc, RotationsFile } from '../lib/types.ts';
import { REPO_ROOT } from '../lib/validate.ts';

const FIGURES_DIR = process.env.FIGURES_REAL_DIR ?? join(REPO_ROOT, 'figures');
const ROTATIONS_PATH = process.env.FIGURES_REAL_ROTATIONS ?? join(REPO_ROOT, 'data', 'figure-rotations.json');
const WORDS_PATH = process.env.FIGURES_REAL_WORDS ?? join(REPO_ROOT, 'scripts', 'qbank', 'test', 'fixtures', 'figure-words.json');

// Literal: the akts-2h SHA-256 (FAA-CT-8080-2H).
const AKTS_SHA = '738a0cd5c429e20888e94fd490d90ba09223ac4d350d06fe228788d4b502f4fd';

// Literal key -> [PDF page, printed page], written out from the measured mapping (plan section 2):
// Legend N on page 12+N; figures 1-15 on 34+N, 17-28 on 33+N, 31-82 on 31+N; printed 2-(page-34).
// Figures 16, 29 and 30 don't exist.
const PAGES: Record<string, [number, string]> = {
  'fig-1': [35, '2-1'], 'fig-2': [36, '2-2'], 'fig-3': [37, '2-3'], 'fig-4': [38, '2-4'],
  'fig-5': [39, '2-5'], 'fig-6': [40, '2-6'], 'fig-7': [41, '2-7'], 'fig-8': [42, '2-8'],
  'fig-9': [43, '2-9'], 'fig-10': [44, '2-10'], 'fig-11': [45, '2-11'], 'fig-12': [46, '2-12'],
  'fig-13': [47, '2-13'], 'fig-14': [48, '2-14'], 'fig-15': [49, '2-15'], 'fig-17': [50, '2-16'],
  'fig-18': [51, '2-17'], 'fig-19': [52, '2-18'], 'fig-20': [53, '2-19'], 'fig-21': [54, '2-20'],
  'fig-22': [55, '2-21'], 'fig-23': [56, '2-22'], 'fig-24': [57, '2-23'], 'fig-25': [58, '2-24'],
  'fig-26': [59, '2-25'], 'fig-27': [60, '2-26'], 'fig-28': [61, '2-27'], 'fig-31': [62, '2-28'],
  'fig-32': [63, '2-29'], 'fig-33': [64, '2-30'], 'fig-34': [65, '2-31'], 'fig-35': [66, '2-32'],
  'fig-36': [67, '2-33'], 'fig-37': [68, '2-34'], 'fig-38': [69, '2-35'], 'fig-39': [70, '2-36'],
  'fig-40': [71, '2-37'], 'fig-41': [72, '2-38'], 'fig-42': [73, '2-39'], 'fig-43': [74, '2-40'],
  'fig-44': [75, '2-41'], 'fig-45': [76, '2-42'], 'fig-46': [77, '2-43'], 'fig-47': [78, '2-44'],
  'fig-48': [79, '2-45'], 'fig-49': [80, '2-46'], 'fig-50': [81, '2-47'], 'fig-51': [82, '2-48'],
  'fig-52': [83, '2-49'], 'fig-53': [84, '2-50'], 'fig-54': [85, '2-51'], 'fig-55': [86, '2-52'],
  'fig-56': [87, '2-53'], 'fig-57': [88, '2-54'], 'fig-58': [89, '2-55'], 'fig-59': [90, '2-56'],
  'fig-60': [91, '2-57'], 'fig-61': [92, '2-58'], 'fig-62': [93, '2-59'], 'fig-63': [94, '2-60'],
  'fig-64': [95, '2-61'], 'fig-65': [96, '2-62'], 'fig-66': [97, '2-63'], 'fig-67': [98, '2-64'],
  'fig-68': [99, '2-65'], 'fig-69': [100, '2-66'], 'fig-70': [101, '2-67'], 'fig-71': [102, '2-68'],
  'fig-72': [103, '2-69'], 'fig-73': [104, '2-70'], 'fig-74': [105, '2-71'], 'fig-75': [106, '2-72'],
  'fig-76': [107, '2-73'], 'fig-77': [108, '2-74'], 'fig-78': [109, '2-75'], 'fig-79': [110, '2-76'],
  'fig-80': [111, '2-77'], 'fig-81': [112, '2-78'], 'fig-82': [113, '2-79'], 'legend-1': [13, '1-1'],
  'legend-2': [14, '1-2'], 'legend-3': [15, '1-3'], 'legend-4': [16, '1-4'], 'legend-5': [17, '1-5'],
  'legend-6': [18, '1-6'], 'legend-7': [19, '1-7'], 'legend-8': [20, '1-8'], 'legend-9': [21, '1-9'],
  'legend-10': [22, '1-10'], 'legend-11': [23, '1-11'], 'legend-12': [24, '1-12'], 'legend-13': [25, '1-13'],
  'legend-14': [26, '1-14'], 'legend-15': [27, '1-15'], 'legend-16': [28, '1-16'], 'legend-17': [29, '1-17'],
  'legend-18': [30, '1-18'], 'legend-19': [31, '1-19'],
};

// Literal: the 13 items printed sideways, confirmed by eye.
const SIDEWAYS = ['legend-1', 'fig-3', 'fig-11', 'fig-18', 'fig-27', 'fig-35', 'fig-37', 'fig-38', 'fig-39', 'fig-40', 'fig-57', 'fig-72', 'fig-82'];
// Literal: the 11 whose direction is read from their words; all rotate 90 per the votes.
const BY_WORDS = ['legend-1', 'fig-11', 'fig-18', 'fig-27', 'fig-35', 'fig-37', 'fig-38', 'fig-39', 'fig-40', 'fig-57', 'fig-72'];
// Literal: the 2 altimeter faces whose direction can't be read from text; set by eye.
const BY_EYE = ['fig-3', 'fig-82'];
// Literal: the upright pages nearest the detection line, kept in the words fixture as controls.
const CONTROLS = ['fig-36', 'fig-43', 'fig-48'];

function loadIndex(): FigureIndex {
  const index = readJson(join(FIGURES_DIR, 'index.json')) as FigureIndex;
  // B1. Always the first assertion.
  assert.equal(index.items.length, 98, `expected 98 items, found ${index.items.length}`);
  return index;
}

function loadRotations(): RotationsFile {
  return readJson(ROTATIONS_PATH) as RotationsFile;
}

interface WordsPage {
  key: string;
  page: number;
  result: string;
  caption_lines: { t: string; b: number[] }[][];
  body_lines: { t: string; b: number[] }[][];
}

function loadWords(): { source_sha256: string; pages: WordsPage[] } {
  // B14
  assert.ok(existsSync(WORDS_PATH), 'missing scripts/qbank/test/fixtures/figure-words.json');
  return readJson(WORDS_PATH) as { source_sha256: string; pages: WordsPage[] };
}

const toWords = (lines: { t: string; b: number[] }[][]): Word[][] =>
  lines.map((l) => l.map((w) => ({ text: w.t, xMin: w.b[0], yMin: w.b[1], xMax: w.b[2], yMax: w.b[3] })));

function wordsPage(pages: WordsPage[], key: string): WordsPage {
  const p = pages.find((x) => x.key === key);
  assert.ok(p, `${key} is not in the words fixture`);
  return p;
}

// ---------------------------------------------------------------------------------------------
// Index and files

test('B1-B3 the index has the 98 items on the literal pages', () => {
  const index = loadIndex();
  const keys = index.items.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, 'duplicate keys');
  assert.deepEqual([...keys].sort(), Object.keys(PAGES).sort());
  for (const it of index.items) {
    assert.deepEqual([it.page, it.printed_page], PAGES[it.key], it.key);
  }
});

test('B4 source_sha256 is the literal akts-2h value and matches references.json', () => {
  const index = loadIndex();
  assert.equal(index.source_sha256, AKTS_SHA);
  const docs = checkReferences(readJson(join(REPO_ROOT, 'data', 'references.json'))).docs as ReferenceDoc[];
  assert.equal(index.source_sha256, docs.find((d) => d.key === 'akts-2h')?.sha256);
});

test('B5 extraction settings', () => {
  const ex = loadIndex().extracted_with;
  assert.ok(ex !== null);
  assert.equal(ex.dpi, 300);
  assert.equal(ex.margin_px, 24);
  assert.equal(ex.erase_pad_pt, 0.25);
});

test('B6 both files exist with the indexed sizes', () => {
  for (const it of loadIndex().items) {
    for (const f of [it.files.png, it.files.webp]) {
      const p = join(FIGURES_DIR, f.name);
      assert.ok(existsSync(p), `${f.name} is missing`);
      assert.equal(statSync(p).size, f.bytes, `${f.name} size`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Rotations

test('B7 each item rotate equals its rotations-file entry, or 0', () => {
  const index = loadIndex();
  const rot = loadRotations();
  for (const it of index.items) {
    assert.equal(it.rotate, rot.rotations.find((r) => r.key === it.key)?.rotate ?? 0, it.key);
  }
});

test('B8 the rotations file lists exactly the 13 sideways items', () => {
  assert.deepEqual(loadRotations().rotations.map((r) => r.key).sort(), [...SIDEWAYS].sort());
});

test('B9 the "words" entries are exactly the 11, each rotate 90', () => {
  const words = loadRotations().rotations.filter((r) => r.evidence === 'words');
  assert.deepEqual(words.map((r) => r.key).sort(), [...BY_WORDS].sort());
  for (const r of words) assert.equal(r.rotate, 90, r.key);
});

test('B10 the "visual" entries are exactly fig-3 and fig-82, each 90 or 270', () => {
  const visual = loadRotations().rotations.filter((r) => r.evidence === 'visual');
  assert.deepEqual(visual.map((r) => r.key).sort(), [...BY_EYE].sort());
  for (const r of visual) assert.ok(r.rotate === 90 || r.rotate === 270, `${r.key} rotate ${r.rotate}`);
});

test('B11 legend-1 has rotate 90 (it reads bottom to top)', () => {
  assert.equal(loadRotations().rotations.find((r) => r.key === 'legend-1')?.rotate, 90);
  assert.equal(loadIndex().items.find((i) => i.key === 'legend-1')?.rotate, 90);
});

test('B12 every turned item has its body ending above its caption', () => {
  for (const it of loadIndex().items) {
    if (it.rotate === 0) continue;
    assert.ok(it.body_px[1] + it.body_px[3] <= it.caption_px[1], it.key);
  }
});

// ---------------------------------------------------------------------------------------------
// Content near the header

// Literal rows: architect-Claude's 300-dpi measurements of the top edges near the header.
for (const [key, R] of [['fig-65', 187], ['fig-19', 195]] as const) {
  test(`B13 ${key}: the top edge at row ${R} is inside the crop and was not erased`, async () => {
    const it = loadIndex().items.find((i) => i.key === key);
    assert.ok(it, `${key} missing`);
    assert.equal(it.rotate, 0);
    assert.ok(it.body_px[1] <= R, `body_px top ${it.body_px[1]} > ${R}`);
    if (key === 'fig-19') assert.equal(it.body_px[0], 0);
    const { data, info } = await sharp(join(FIGURES_DIR, it.files.png.name)).raw().toBuffer({ resolveWithObject: true });
    assert.ok(info.channels === 1 || info.channels === 3, `channels ${info.channels}`);
    const uTop = Math.min(it.body_px[1], it.caption_px[1]);
    const row = R - uTop + 24;
    let ink = 0;
    for (let x = 0; x < info.width; x++) {
      const i = (row * info.width + x) * info.channels;
      for (let c = 0; c < info.channels; c++) {
        if (data[i + c] < 250) {
          ink++;
          break;
        }
      }
    }
    assert.ok(ink >= 100, `output row ${row} has ${ink} ink pixels`);
  });
}

// ---------------------------------------------------------------------------------------------
// Words fixture (real Poppler words for the 13 sideways pages and 3 controls)

test('B15 the words fixture has the literal sha and exactly the 16 keys', () => {
  const w = loadWords();
  assert.equal(w.source_sha256, AKTS_SHA);
  assert.deepEqual(w.pages.map((p) => p.key).sort(), [...SIDEWAYS, ...CONTROLS].sort());
});

test('B16 each of the 13 is detected sideways with n >= 21', () => {
  const w = loadWords();
  for (const key of SIDEWAYS) {
    const r = detectOrientation(toWords(wordsPage(w.pages, key).body_lines).flat());
    assert.equal(r.result, 'sideways', `${key}: ${JSON.stringify(r)}`);
    assert.ok(r.n >= 21, `${key}: n ${r.n}`);
  }
});

test('B17 direction is 90 for the 11 and null for fig-3 and fig-82', () => {
  const w = loadWords();
  for (const key of BY_WORDS) {
    assert.equal(detectDirection(toWords(wordsPage(w.pages, key).body_lines)).direction, 90, key);
  }
  for (const key of BY_EYE) {
    assert.equal(detectDirection(toWords(wordsPage(w.pages, key).body_lines)).direction, null, key);
  }
});

test('B18 fig-36 and fig-43 are upright; fig-48 is not sideways', () => {
  const w = loadWords();
  const res = (key: string): string => detectOrientation(toWords(wordsPage(w.pages, key).body_lines).flat()).result;
  assert.equal(res('fig-36'), 'upright');
  assert.equal(res('fig-43'), 'upright');
  assert.notEqual(res('fig-48'), 'sideways');
});

test('B19 no false alarm: findCaptionSideways is empty on all 16 caption blocks', () => {
  const w = loadWords();
  for (const key of [...SIDEWAYS, ...CONTROLS]) {
    const flagged = findCaptionSideways(toWords(wordsPage(w.pages, key).caption_lines).flat());
    assert.deepEqual(flagged.map((x) => x.text), [], key);
  }
});

test('B20 negative control: the check flags real sideways body words, and no word sits in the margin band', () => {
  const w = loadWords();
  for (const key of SIDEWAYS) {
    const flagged = findCaptionSideways(toWords(wordsPage(w.pages, key).body_lines).flat());
    assert.ok(flagged.length >= 1, `${key}: no body word flagged`);
  }
  for (const key of [...SIDEWAYS, ...CONTROLS]) {
    const p = wordsPage(w.pages, key);
    for (const word of [...toWords(p.body_lines).flat(), ...toWords(p.caption_lines).flat()]) {
      if ([...word.text.trim()].length < 4) continue;
      const h = word.yMax - word.yMin;
      const wd = word.xMax - word.xMin;
      assert.ok(!(h > wd && h <= 1.02 * wd), `${key}: '${word.text}' has ratio ${(h / wd).toFixed(3)}`);
    }
  }
});
