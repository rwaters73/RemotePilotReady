// Tests for scripts/qbank/lib/figures.ts on synthetic data only, so they run on any machine
// (no Poppler, no PDF). Pixel tests that place things by points use a full 2475 x 3225 white page.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkReferences, readJson } from '../lib/data.ts';
import {
  CAPTION_RE,
  checkMapping,
  checkPageMarks,
  checkPrintedSequence,
  checkRotatedPartitionText,
  checkRotationsFile,
  classifyPages,
  compareRotations,
  composedSize,
  composeItem,
  computeCrops,
  cropRgb,
  detectDirection,
  detectOrientation,
  erasePageMarks,
  expectedKeys,
  findCaptionSideways,
  isGrayscale,
  marksList,
  PAGE_PX,
  parseBboxLayout,
  partitionWords,
  rotateRgb,
  S,
  versionGuardDecision,
} from '../lib/figures.ts';
import type { Detection, ItemType, Page, Word } from '../lib/figures.ts';
import type { ReferenceDoc, RotationEntry, RotationsFile } from '../lib/types.ts';
import { REPO_ROOT } from '../lib/validate.ts';

const AKTS_SHA = '738a0cd5c429e20888e94fd490d90ba09223ac4d350d06fe228788d4b502f4fd';
const refs = checkReferences(readJson(join(REPO_ROOT, 'data', 'references.json'))).docs as ReferenceDoc[];

// ---------------------------------------------------------------------------------------------
// Builders

function W(text: string, xMin: number, yMin: number, xMax: number, yMax: number): Word {
  return { text, xMin, yMin, xMax, yMax };
}

// The real extents from architect-Claude's measurements (plan section 2).
const leftHeader = (): Word[] => [W('Appendix', 36.0, 33.8, 73.0, 44.3), W('2', 74.1, 33.8, 79.1, 44.3)];
const rightLegendHeader = (): Word[] => [W('Appendix', 514.5, 33.8, 552.0, 44.7), W('1', 553.0, 33.8, 558.0, 44.7)];
const pageNum = (text = '2-25', x0 = 269.0, x1 = 289.0): Word => W(text, x0, 728.0, x1, 740.3);
const captionLine = (): Word[] => [W('Figure', 250, 700, 280, 710), W('65.', 282, 700, 295, 710), W('Panel', 297, 700, 320, 710)];

function mkPage(lines: Word[][], number = 96): Page {
  return { number, width: 594, height: 774, lines };
}

// A figure page: header, any extra lines, the caption line, then the page number.
function figurePage(extra: Word[][] = [], opts: { header?: Word[]; pn?: Word | null; number?: number } = {}): Page {
  const lines: Word[][] = [opts.header ?? leftHeader(), ...extra, captionLine()];
  if (opts.pn !== null) lines.push([opts.pn ?? pageNum()]);
  return mkPage(lines, opts.number ?? 96);
}

function captionIndex(p: Page): number {
  return p.lines.findIndex((l) => l[0]?.text === 'Figure' || l[0]?.text === 'Legend');
}

function whitePage(): Uint8Array {
  return new Uint8Array(PAGE_PX.w * PAGE_PX.h * 3).fill(255);
}

function fillPx(buf: Uint8Array, x0: number, y0: number, x1: number, y1: number, v = 0, width = PAGE_PX.w): void {
  for (let y = y0; y < y1; y++) buf.fill(v, (y * width + x0) * 3, (y * width + x1) * 3);
}

// Ink strictly inside a word box, like a glyph.
function inkIn(buf: Uint8Array, w: Word, v = 0): void {
  fillPx(buf, Math.ceil(w.xMin * S), Math.ceil(w.yMin * S), Math.floor(w.xMax * S), Math.floor(w.yMax * S), v);
}

function pixel(buf: Uint8Array, width: number, x: number, y: number): number[] {
  const i = (y * width + x) * 3;
  return [buf[i], buf[i + 1], buf[i + 2]];
}

function rowInk(buf: Uint8Array, width: number, y: number): number {
  let n = 0;
  for (let x = 0; x < width; x++) if (pixel(buf, width, x, y).some((c) => c < 250)) n++;
  return n;
}

// Runs marks, partition, erase and crops on a figure page with ink in every word box.
function scenario(page: Page, opts: { rotated?: boolean; draw?: (buf: Uint8Array) => void; skipInk?: string[] } = {}) {
  const m = checkPageMarks(page, 'figure');
  assert.deepEqual(m.errors, []);
  const part = partitionWords(page, m.marks!, captionIndex(page));
  const buf = whitePage();
  for (const w of page.lines.flat()) if (!(opts.skipInk ?? []).includes(w.text)) inkIn(buf, w);
  opts.draw?.(buf);
  const er = erasePageMarks(buf, PAGE_PX.w, PAGE_PX.h, marksList(m.marks!), page.number);
  const crops = computeCrops(er.erased, PAGE_PX.w, PAGE_PX.h, part, opts.rotated ?? false);
  return { m, part, buf, er, crops };
}

// ---------------------------------------------------------------------------------------------
// A1. Parsing

test('A1 parseBboxLayout reads pages, lines and words, decodes entities, and keeps word order', () => {
  const xhtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title></title>
<meta name="Producer" content="test"/>
</head>
<body>
<doc>
  <page width="594.000000" height="774.000000">
    <flow>
      <block xMin="36.000000" yMin="33.800000" xMax="79.100000" yMax="44.300000">
        <line xMin="36.000000" yMin="33.800000" xMax="79.100000" yMax="44.300000">
          <word xMin="36.000000" yMin="33.800000" xMax="73.000000" yMax="44.300000">Appendix</word>
          <word xMin="74.100000" yMin="33.800000" xMax="79.100000" yMax="44.300000">2</word>
        </line>
        <line xMin="100.000000" yMin="100.000000" xMax="110.000000" yMax="300.000000">
          <word xMin="100.000000" yMin="250.000000" xMax="110.000000" yMax="300.000000">R&amp;D</word>
          <word xMin="100.000000" yMin="200.000000" xMax="110.000000" yMax="240.000000">&lt;5&gt;</word>
          <word xMin="100.000000" yMin="150.000000" xMax="110.000000" yMax="190.000000">caf&#233;</word>
          <word xMin="100.000000" yMin="100.000000" xMax="110.000000" yMax="140.000000">it&#x2019;s</word>
          <word xMin="100.000000" yMin="90.000000" xMax="110.000000" yMax="95.000000">&quot;q&quot;&apos;a&apos;</word>
          <word xMin="100.000000" yMin="80.000000" xMax="110.000000" yMax="85.000000">&amp;lt;</word>
        </line>
      </block>
    </flow>
  </page>
  <page width="594.000000" height="774.000000">
  </page>
</doc>
</body>
</html>
`;
  const pages = parseBboxLayout(xhtml);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].number, 1);
  assert.equal(pages[0].width, 594);
  assert.equal(pages[0].height, 774);
  assert.equal(pages[0].lines.length, 2);
  assert.deepEqual(pages[0].lines[0][0], W('Appendix', 36, 33.8, 73, 44.3));
  // Poppler's order is kept, even though the words run bottom to top.
  assert.deepEqual(
    pages[0].lines[1].map((w) => w.text),
    ['R&D', '<5>', 'café', 'it’s', '"q"\'a\'', '&lt;'],
  );
  assert.equal(pages[0].lines[1][0].yMin, 250);
  assert.equal(pages[1].number, 2);
  assert.deepEqual(pages[1].lines, []);
});

// ---------------------------------------------------------------------------------------------
// A2. Classification and mapping

function captionPage(number: number, key: string, title = 'Title'): Page {
  const [kind, n] = key.split('-');
  return mkPage([[W(kind === 'fig' ? 'Figure' : 'Legend', 100, 700, 130, 710), W(`${n}.`, 132, 700, 140, 710), W(title, 142, 700, 180, 710)]], number);
}

function contentsPages(keys: string[], startNumber: number): Page[] {
  const pages: Page[] = [];
  for (let i = 0; i < keys.length; i += 40) {
    const lines = keys.slice(i, i + 40).map((k, j) => {
      const [kind, n] = k.split('-');
      return [W(kind === 'fig' ? 'Figure' : 'Legend', 100, 100 + j * 15, 130, 110 + j * 15), W(`${n}.`, 132, 100 + j * 15, 140, 110 + j * 15), W('Entry', 142, 100 + j * 15, 180, 110 + j * 15)];
    });
    pages.push(mkPage(lines, startNumber + pages.length));
  }
  return pages;
}

// Every expected item on its own page, with contents pages listing all but fig-55.
function bankPages(opts: { drop?: string[]; extra?: Page[]; contentsDrop?: string[] } = {}): Page[] {
  const keys = expectedKeys();
  const contents = contentsPages(keys.filter((k) => k !== 'fig-55' && !(opts.contentsDrop ?? []).includes(k)), 7);
  const items = keys.filter((k) => !(opts.drop ?? []).includes(k)).map((k, i) => captionPage(20 + i, k));
  return [...contents, ...items, ...(opts.extra ?? [])];
}

test('A2 the caption pattern needs the dot after the number (erratum)', () => {
  assert.ok(CAPTION_RE.test('Figure 12. Sectional Chart Excerpt.'));
  assert.ok(CAPTION_RE.test('Legend 3.'));
  assert.ok(CAPTION_RE.test('Figure 55.\tNote'));
  // An unescaped dot would read this as Figure 1.
  assert.equal(CAPTION_RE.exec('Figure 12 shows'), null);
  const page = mkPage([[W('Figure', 100, 100, 130, 110), W('12', 132, 100, 140, 110), W('shows', 142, 100, 170, 110)]], 50);
  assert.deepEqual(classifyPages([page]).items, []);
});

test('A2 classification: 0, 1, 2 and 3+ caption lines', () => {
  const none = mkPage([[W('Some', 100, 100, 130, 110), W('text', 132, 100, 150, 110)]], 1);
  const one = captionPage(2, 'fig-12');
  const two = mkPage([...captionPage(3, 'fig-13').lines, ...captionPage(3, 'fig-14').lines], 3);
  const contents = contentsPages(['fig-1', 'fig-2', 'fig-3'], 4);
  const c = classifyPages([none, one, two, ...contents]);
  assert.deepEqual(c.items.map((i) => [i.key, i.page, i.type, i.number]), [['fig-12', 2, 'figure', 12]]);
  assert.deepEqual(c.contents, [{ page: 4, keys: ['fig-1', 'fig-2', 'fig-3'] }]);
  assert.equal(c.errors.length, 1);
  assert.ok(c.errors[0].startsWith('page 3 has 2 caption lines'), c.errors[0]);
});

test('A2 mapping: the full set passes, with fig-55 reported as a note', () => {
  const r = checkMapping(classifyPages(bankPages()));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.notes, ['fig-55 is not listed on the contents pages (known)']);
});

test('A2 mapping: duplicate key names both pages', () => {
  const r = checkMapping(classifyPages(bankPages({ extra: [captionPage(200, 'fig-3')] })));
  assert.ok(r.errors.some((e) => e.startsWith('fig-3 is captioned on more than one page:') && e.endsWith(', 200')), JSON.stringify(r.errors));
});

test('A2 mapping: missing key', () => {
  const r = checkMapping(classifyPages(bankPages({ drop: ['fig-4'] })));
  assert.ok(r.errors.includes('fig-4 was not found on any page'), JSON.stringify(r.errors));
});

test('A2 mapping: unexpected key', () => {
  const r = checkMapping(classifyPages(bankPages({ extra: [captionPage(200, 'fig-16')] })));
  assert.ok(r.errors.includes('fig-16 (page 200) is not an expected item'), JSON.stringify(r.errors));
});

test('A2 mapping: a two-caption page is an error', () => {
  const two = mkPage([...captionPage(200, 'fig-1').lines, ...captionPage(200, 'fig-2').lines], 200);
  const r = checkMapping(classifyPages(bankPages({ extra: [two] })));
  assert.ok(r.errors.some((e) => e.startsWith('page 200 has 2 caption lines')), JSON.stringify(r.errors));
});

test('A2 mapping: any contents difference other than fig-55 is an error', () => {
  const r = checkMapping(classifyPages(bankPages({ contentsDrop: ['fig-5'] })));
  assert.ok(r.errors.some((e) => e.startsWith('fig-5 is captioned on page') && e.endsWith('not listed on the contents pages')), JSON.stringify(r.errors));
  assert.deepEqual(r.notes, ['fig-55 is not listed on the contents pages (known)']);
});

// ---------------------------------------------------------------------------------------------
// A3. Page marks that must pass

test('A3 left page with the real extents passes', () => {
  const m = checkPageMarks(figurePage(), 'figure');
  assert.deepEqual(m.errors, []);
  assert.equal(m.side, 'left');
  assert.equal(m.printedPage, '2-25');
  assert.ok(m.marks !== null);
});

test('A3 right legend page with the real extents passes', () => {
  const m = checkPageMarks(figurePage([], { header: rightLegendHeader(), pn: pageNum('1-1') }), 'legend');
  assert.deepEqual(m.errors, []);
  assert.equal(m.side, 'right');
  assert.equal(m.printedPage, '1-1');
});

test('A3 page number "2-25" (centre 279.0) and "2-77" (centre 315.0) pass', () => {
  assert.deepEqual(checkPageMarks(figurePage([], { pn: pageNum('2-25', 269.0, 289.0) }), 'figure').errors, []);
  assert.deepEqual(checkPageMarks(figurePage([], { pn: pageNum('2-77', 305.0, 325.0) }), 'figure').errors, []);
});

test('A3 both header window corners exactly: yMin 32.8 and yMax 45.7', () => {
  const header = [W('Appendix', 36.0, 32.8, 73.0, 44.3), W('2', 74.1, 33.8, 79.1, 45.7)];
  assert.deepEqual(checkPageMarks(figurePage([], { header }), 'figure').errors, []);
});

// ---------------------------------------------------------------------------------------------
// A4. Page marks that must fail, each with its own error

function marksErrors(page: Page, type: ItemType = 'figure'): string[] {
  return checkPageMarks(page, type).errors;
}

function assertOneError(errors: string[], substring: string): void {
  assert.ok(errors.some((e) => e.includes(substring)), `no error contains "${substring}": ${JSON.stringify(errors)}`);
}

test('A4 header yMin 32.7', () => {
  const e = marksErrors(figurePage([], { header: [W('Appendix', 36.0, 32.7, 73.0, 44.3), W('2', 74.1, 33.8, 79.1, 44.3)] }));
  assertOneError(e, 'expected one "Appendix" header');
  assertOneError(e, 'found 0; "Appendix" words on the page: [36, 32.7, 73, 44.3]');
});

test('A4 left digit xMax 80.2', () => {
  const e = marksErrors(figurePage([], { header: [W('Appendix', 36.0, 33.8, 73.0, 44.3), W('2', 74.1, 33.8, 80.2, 44.3)] }));
  assertOneError(e, 'header digit "2" [74.1, 33.8, 80.2, 44.3] is outside the left header window');
});

test('A4 right "Appendix" xMax 559.1', () => {
  const e = marksErrors(
    figurePage([], { header: [W('Appendix', 514.5, 33.8, 559.1, 44.7), W('1', 553.0, 33.8, 558.0, 44.7)], pn: pageNum('1-1') }),
    'legend',
  );
  assertOneError(e, 'found 0; "Appendix" words on the page: [514.5, 33.8, 559.1, 44.7]');
});

test('A4 header at x 300', () => {
  const e = marksErrors(figurePage([], { header: [W('Appendix', 300, 33.8, 337, 44.3), W('2', 338.1, 33.8, 343.1, 44.3)] }));
  assertOneError(e, 'found 0; "Appendix" words on the page: [300, 33.8, 337, 44.3]');
});

test('A4 header words on different sides', () => {
  const e = marksErrors(figurePage([], { header: [W('Appendix', 36.0, 33.8, 73.0, 44.3), W('2', 553.0, 33.8, 558.0, 44.7)] }));
  assertOneError(e, 'is outside the left header window');
});

test('A4 page number xMin 267.9', () => {
  const e = marksErrors(figurePage([], { pn: pageNum('2-25', 267.9, 289.0) }));
  assertOneError(e, 'expected one word inside the page-number window');
  assertOneError(e, 'found 0; page-number-like words: "2-25" [267.9, 728, 289, 740.3]');
});

test('A4 page number yMax 741.4', () => {
  const e = marksErrors(figurePage([], { pn: W('2-25', 269.0, 728.0, 289.0, 741.4) }));
  assertOneError(e, 'found 0; page-number-like words: "2-25" [269, 728, 289, 741.4]');
});

test('A4 page number at y 700', () => {
  const e = marksErrors(figurePage([], { pn: W('2-25', 269.0, 690.0, 289.0, 699.0) }));
  assertOneError(e, 'found 0; page-number-like words: "2-25" [269, 690, 289, 699]');
});

test('A4 wrong appendix digit', () => {
  const e = marksErrors(figurePage([], { header: [W('Appendix', 36.0, 33.8, 73.0, 44.3), W('1', 74.1, 33.8, 79.1, 44.3)] }));
  assertOneError(e, 'header digit is "1" [74.1, 33.8, 79.1, 44.3]; expected "2" for a figure');
  const e2 = marksErrors(figurePage([], { pn: pageNum('1-25') }));
  assertOneError(e2, 'page number "1-25" [269, 728, 289, 740.3] should start with 2- for a figure');
});

test('A4 missing page number', () => {
  const e = marksErrors(figurePage([], { pn: null }));
  assertOneError(e, 'found 0; page-number-like words: none; words inside the window: none');
});

test('A4 two words inside the page-number window', () => {
  const e = marksErrors(figurePage([[W('x', 300, 729, 305, 740)]]));
  assertOneError(e, 'found 2;');
});

test('A4 a content word overlapping the padded header box', () => {
  const e = marksErrors(figurePage([[W('Chart', 70, 44.4, 100, 50)]]));
  assertOneError(e, "word 'Chart' [70, 44.4, 100, 50] on page 96 overlaps the header");
});

test('A4 a gap in printed page numbers', () => {
  const e = checkPrintedSequence([
    { key: 'fig-26', type: 'figure', page: 59, printedPage: '2-25' },
    { key: 'fig-27', type: 'figure', page: 60, printedPage: '2-27' },
    { key: 'legend-1', type: 'legend', page: 13, printedPage: '1-1' },
    { key: 'legend-2', type: 'legend', page: 14, printedPage: '1-2' },
  ]);
  assert.deepEqual(e, ['printed page 2-27 on page 60 (fig-27) does not follow 2-25 on page 59 (fig-26)']);
});

// ---------------------------------------------------------------------------------------------
// A5. Controls: content, not errors

test('A5 a word above y 48 clear of the marks is content', () => {
  const page = figurePage([[W('Top', 300, 38, 330, 44)]]);
  assert.deepEqual(marksErrors(page), []);
  const m = checkPageMarks(page, 'figure');
  const part = partitionWords(page, m.marks!, captionIndex(page));
  assert.ok(part.bodyWords.some((w) => w.text === 'Top'));
});

test('A5 a word "2-14" at y 400 is content', () => {
  assert.deepEqual(marksErrors(figurePage([[W('2-14', 300, 400, 320, 410)]])), []);
});

test('A5 a word "Appendix" at y 400 is content', () => {
  assert.deepEqual(marksErrors(figurePage([[W('Appendix', 300, 400, 337, 410)]])), []);
});

// ---------------------------------------------------------------------------------------------
// A6. Erase

test('A6 header-glyph ink inside the "Appendix" box is gone in the erased copy', () => {
  const { er, buf } = scenario(figurePage([[W('Body', 100, 300, 130, 310)]]));
  assert.deepEqual(er.errors, []);
  const x = Math.ceil(36.0 * S) + 2;
  const y = Math.ceil(33.8 * S) + 2;
  assert.deepEqual(pixel(buf, PAGE_PX.w, x, y), [0, 0, 0]);
  assert.deepEqual(pixel(er.erased, PAGE_PX.w, x, y), [255, 255, 255]);
});

test('A6 an erase box with no ink is an error', () => {
  const { er } = scenario(figurePage([[W('Body', 100, 300, 130, 310)]]), { skipInk: ['2'] });
  assert.deepEqual(er.errors, ['no ink inside the 2 box on page 96']);
});

test('A6 ink 1.5 pt beyond the header yMax raises eraseTouch', () => {
  const { er } = scenario(figurePage([[W('Body', 100, 300, 130, 310)]]), {
    draw: (buf) => fillPx(buf, Math.ceil(36.0 * S), Math.ceil(33.8 * S), Math.floor(73.0 * S), Math.floor((44.3 + 1.5) * S)),
  });
  assert.equal(er.eraseTouch.length, 1);
  assert.equal(er.eraseTouch[0].mark, 'Appendix');
  assert.ok(er.eraseTouch[0].count > 0);
});

test('A6 fig-65: border at row 187 is kept, nothing of the header shows, no eraseTouch', () => {
  const page = figurePage();
  const { er, crops } = scenario(page, { draw: (buf) => fillPx(buf, 221, 187, 2001, 190, 128) });
  assert.deepEqual(er.errors, []);
  assert.deepEqual(er.eraseTouch, []);
  assert.deepEqual(crops.errors, []);
  assert.equal(crops.body_px![1], 183);
  const fields = { rotate: 0 as const, body_px: crops.body_px!, caption_px: crops.caption_px! };
  const out = composeItem(er.erased, PAGE_PX.w, PAGE_PX.h, fields);
  const uLeft = Math.min(crops.body_px![0], crops.caption_px![0]);
  const uTop = Math.min(crops.body_px![1], crops.caption_px![1]);
  assert.ok(rowInk(out.data, out.width, 187 - uTop + 24) >= 1000, 'the border row has ink in the image');
  // No pixel from the header's erase rectangles that falls inside U is non-white.
  for (const r of er.rects.slice(0, 2)) {
    for (let y = Math.max(r.y0, uTop); y < r.y1; y++) {
      for (let x = Math.max(r.x0, uLeft); x < r.x1; x++) {
        assert.deepEqual(pixel(out.data, out.width, x - uLeft + 24, y - uTop + 24), [255, 255, 255], `pixel ${x},${y}`);
      }
    }
  }
  // The header's rows really are inside U here, so the loop above checked something.
  assert.ok(er.rects[0].y1 > uTop);
});

test('A6 fig-65 with the line at row 186 raises eraseTouch', () => {
  const { er } = scenario(figurePage(), { draw: (buf) => fillPx(buf, 221, 186, 2001, 189, 128) });
  assert.ok(er.eraseTouch.some((t) => t.mark === 'Appendix' && t.box.y0 === 186), JSON.stringify(er.eraseTouch));
});

// ---------------------------------------------------------------------------------------------
// A7. fig-19

test('A7 fig-19: a line at row 195 from column 0 gives left 0, top 191 and a left-edge warning', () => {
  const { crops } = scenario(figurePage(), { draw: (buf) => fillPx(buf, 0, 195, 2159, 196) });
  assert.deepEqual(crops.errors, []);
  assert.equal(crops.body_px![0], 0);
  assert.equal(crops.body_px![1], 191);
  assert.ok(crops.touchesEdge.includes('left'));
  assert.ok(crops.warnings.some((w) => w.startsWith('touchesEdge: the body crop on page 96 reaches the left edge')));
  assert.equal(crops.inkOutside, 0);
});

// ---------------------------------------------------------------------------------------------
// A8. Detection

function bodyWords(n: number, sideways: number, text = 'word'): Word[] {
  const out: Word[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i < sideways ? W(text, 100, 100 + i * 30, 110, 125 + i * 30) : W(text, 100 + i, 50, 130 + i, 60));
  }
  return out;
}

test('A8 detection on the confirmed data points', () => {
  assert.equal(detectOrientation(bodyWords(21, 21)).result, 'sideways');
  assert.equal(detectOrientation(bodyWords(40, 14)).result, 'upright');
  assert.equal(detectOrientation(bodyWords(53, 17)).result, 'upright');
  assert.equal(detectOrientation(bodyWords(10, 5)).result, 'upright');
  assert.equal(detectOrientation(bodyWords(4, 1)).result, 'undetermined');
  assert.equal(detectOrientation(bodyWords(4, 4)).result, 'undetermined');
});

test('A8 exactly 0.65 with n = 20 is sideways; 0.64 with n = 25 is upright', () => {
  const at = detectOrientation(bodyWords(20, 13));
  assert.equal(at.share, 0.65);
  assert.equal(at.result, 'sideways');
  const below = detectOrientation(bodyWords(25, 16));
  assert.equal(below.share, 0.64);
  assert.equal(below.result, 'upright');
});

test('A8 words under 3 characters are ignored', () => {
  const r = detectOrientation([...bodyWords(21, 21), ...bodyWords(30, 0, 'ab')]);
  assert.deepEqual(r, { result: 'sideways', n: 21, sideways: 21, share: 1 });
  assert.equal(detectOrientation(bodyWords(30, 30, 'ab')).result, 'undetermined');
});

// ---------------------------------------------------------------------------------------------
// A9. Direction

// One line of two sideways words: "up" reads bottom to top (second word higher on the page).
function pair(dir: 'up' | 'down'): Word[] {
  const low = W('lower', 100, 300, 110, 340);
  const high = W('upper', 100, 250, 110, 290);
  return dir === 'up' ? [low, high] : [high, low];
}

function lines(up: number, down: number): Word[][] {
  return [...Array.from({ length: up }, () => pair('up')), ...Array.from({ length: down }, () => pair('down'))];
}

test('A9 bottom-to-top lines give 90; top-to-bottom lines give 270', () => {
  assert.deepEqual(detectDirection(lines(5, 0)), { direction: 90, up: 5, down: 0 });
  assert.deepEqual(detectDirection(lines(0, 5)), { direction: 270, up: 0, down: 5 });
});

test('A9 2 votes and 0 votes give null', () => {
  assert.equal(detectDirection(lines(2, 0)).direction, null);
  assert.equal(detectDirection([]).direction, null);
});

test('A9 8 up / 2 down (exactly 0.8) gives 90; 47 / 5 gives 90; 7 / 3 gives null', () => {
  assert.equal(detectDirection(lines(8, 2)).direction, 90);
  assert.equal(detectDirection(lines(47, 5)).direction, 90);
  assert.deepEqual(detectDirection(lines(7, 3)), { direction: null, up: 7, down: 3 });
});

test('A9 a pair separated by a 2-character word gives no vote', () => {
  const [a, b] = pair('up');
  assert.deepEqual(detectDirection([[a, W('of', 100, 292, 110, 298), b]]), { direction: null, up: 0, down: 0 });
});

// ---------------------------------------------------------------------------------------------
// A10. findCaptionSideways

test('A10 caption-block sideways check: 4+ characters taller than 1.02 times their width', () => {
  const notFlagged = [
    W('11.', 100, 100, 110, 110.9),
    W('Air', 100, 100, 110, 110.9),
    W('vs.', 100, 100, 110, 110.9),
    W('abcd', 100, 200, 150, 250), // 1.00
    W('abcd', 100, 200, 150, 251), // exactly 1.02
  ];
  assert.deepEqual(findCaptionSideways(notFlagged), []);
  const flagged = [W('abcd', 100, 200, 150, 251.5), W('abcd', 100, 200, 150, 252)]; // 1.03, 1.04
  assert.deepEqual(findCaptionSideways(flagged), flagged);
});

// ---------------------------------------------------------------------------------------------
// A11. Rotations file and compareRotations

function rotFile(rotations: RotationEntry[]): RotationsFile {
  return { source_doc: 'akts-2h', source_sha256: AKTS_SHA, rotations };
}

function sideways(key: string, direction: 90 | 270 | null, up: number, down: number): Detection {
  return { key, orientation: { result: 'sideways', n: 30, sideways: 28, share: 28 / 30 }, direction: { direction, up, down } };
}
const upright = (key: string): Detection => ({ key, orientation: { result: 'upright', n: 40, sideways: 14, share: 0.35 }, direction: null });
const undetermined = (key: string): Detection => ({ key, orientation: { result: 'undetermined', n: 3, sideways: 0, share: 0 }, direction: null });

function one(d: Detection, entry?: RotationEntry) {
  const r = compareRotations(rotFile(entry ? [entry] : []), [d]);
  assert.equal(r.outcomes.length, 1);
  return { r, o: r.outcomes[0] };
}

test('A11 K1 sideways with a direction and no entry', () => {
  const { o } = one(sideways('fig-11', 90, 12, 0));
  assert.equal(o.case, 'K1');
  assert.equal(o.error, 'fig-11 is printed sideways (28 of 30 body words); add { "key": "fig-11", "rotate": 90, "evidence": "words" }');
});

test('A11 K2 sideways, evidence words, same rotate: accepted', () => {
  const { o, r } = one(sideways('fig-11', 90, 12, 0), { key: 'fig-11', rotate: 90, evidence: 'words' });
  assert.equal(o.case, 'K2');
  assert.deepEqual(r.errors, []);
});

test('A11 K3 sideways, evidence words, different rotate', () => {
  const { o } = one(sideways('fig-11', 90, 12, 0), { key: 'fig-11', rotate: 270, evidence: 'words' });
  assert.equal(o.case, 'K3');
  assert.ok(o.error!.includes('rotate 270') && o.error!.includes('rotate 90') && o.error!.includes('votes up 12, down 0'), o.error!);
});

test('A11 K4 sideways with a direction, evidence visual', () => {
  const { o } = one(sideways('fig-11', 90, 12, 0), { key: 'fig-11', rotate: 90, evidence: 'visual' });
  assert.equal(o.case, 'K4');
  assert.equal(o.error, "fig-11's direction was found from its words (votes up 12, down 0); set evidence to words");
});

test('A11 K5 sideways, direction null, no entry', () => {
  const { o } = one(sideways('fig-3', null, 0, 0));
  assert.equal(o.case, 'K5');
  assert.equal(
    o.error,
    'fig-3 is printed sideways (28 of 30 body words) but its reading direction can\'t be read from its words (votes up 0, down 0); look at the page and add { "key": "fig-3", "rotate": 90 or 270, "evidence": "visual" }',
  );
});

test('A11 K6 sideways, direction null, visual 90 or 270: accepted and listed', () => {
  const { o, r } = one(sideways('fig-82', null, 1, 1), { key: 'fig-82', rotate: 270, evidence: 'visual' });
  assert.equal(o.case, 'K6');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.directionByEyeOnly, ['fig-82']);
});

test('A11 K7 sideways, direction null, visual 180', () => {
  const { o } = one(sideways('fig-3', null, 0, 0), { key: 'fig-3', rotate: 180, evidence: 'visual' });
  assert.equal(o.case, 'K7');
  assert.equal(o.error, 'fig-3 is printed sideways; rotate must be 90 or 270');
});

test('A11 K8 sideways, direction null, evidence words', () => {
  const { o } = one(sideways('fig-3', null, 0, 0), { key: 'fig-3', rotate: 90, evidence: 'words' });
  assert.equal(o.case, 'K8');
  assert.equal(o.error, "fig-3's reading direction can't be read from its words (votes up 0, down 0); use evidence visual");
});

test('A11 K9 upright with an entry', () => {
  const { o } = one(upright('fig-36'), { key: 'fig-36', rotate: 90, evidence: 'visual' });
  assert.equal(o.case, 'K9');
  assert.equal(o.error, 'the rotations file turns fig-36, but its body text is upright (share 0.35 of 40 words)');
});

test('A11 K10 undetermined, evidence words', () => {
  const { o } = one(undetermined('legend-2'), { key: 'legend-2', rotate: 90, evidence: 'words' });
  assert.equal(o.case, 'K10');
  assert.equal(o.error, 'legend-2 has too few body words to detect; use evidence visual');
});

test('A11 K11 undetermined, evidence visual: accepted and listed', () => {
  const { o, r } = one(undetermined('legend-2'), { key: 'legend-2', rotate: 180, evidence: 'visual' });
  assert.equal(o.case, 'K11');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.rotationByEyeOnly, ['legend-2']);
});

test('A11 K12 undetermined, no entry: upright by default and listed', () => {
  const { o, r } = one(undetermined('legend-2'));
  assert.equal(o.case, 'K12');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.undetermined, ['legend-2']);
});

test('A11 checkRotationsFile accepts a good file and rejects bad ones', () => {
  const good = { source_doc: 'akts-2h', source_sha256: AKTS_SHA, rotations: [{ key: 'legend-1', rotate: 90, evidence: 'words' }] };
  assert.deepEqual(checkRotationsFile(good, refs).errors, []);
  const bad = (rotations: unknown[], extra: Record<string, unknown> = {}) =>
    checkRotationsFile({ ...good, rotations, ...extra }, refs).errors;
  assertOneError(bad([{ key: 'fig-3', rotate: 180, evidence: 'words' }]), 'evidence "words" can\'t give rotate 180');
  assertOneError(bad([{ key: 'fig-3', rotate: 0, evidence: 'visual' }]), 'rotate must be 90, 180 or 270');
  assertOneError(bad([{ key: 'fig-3', rotate: 90, evidence: 'visual' }, { key: 'fig-3', rotate: 90, evidence: 'visual' }]), 'lists "fig-3" more than once');
  assertOneError(bad([{ key: 'fig-16', rotate: 90, evidence: 'visual' }]), 'key "fig-16" is not an expected item');
  assertOneError(bad([{ key: 'fig-3', rotate: 90, evidence: 'visual', note: 'x' }]), 'must have exactly the keys key, rotate, evidence');
  assertOneError(bad([], { comment: 'x' }), 'unknown key "comment"');
  assertOneError(bad([], { source_sha256: '0'.repeat(64) }), 'source_sha256 does not match the akts-2h sha256');
});

// ---------------------------------------------------------------------------------------------
// A12. Partition and crops

test('A12 upright page: the crop is all ink plus the pad; one faint pixel outside is reported', () => {
  const { crops } = scenario(figurePage(), {
    draw: (buf) => {
      fillPx(buf, 400, 1000, 1400, 2000);
      fillPx(buf, 2400, 100, 2401, 101, 252);
    },
  });
  assert.deepEqual(crops.errors, []);
  assert.deepEqual(crops.body_px, [396, 996, 1008, 1008]);
  assert.equal(crops.inkOutside, 0);
  assert.equal(crops.faintOutside, 1);
  assert.ok(crops.warnings.some((w) => w.startsWith('faintOutside: 1 ')), JSON.stringify(crops.warnings));
});

const besideInk = (buf: Uint8Array): void => {
  fillPx(buf, 400, 1000, 1400, 2000);
  fillPx(buf, 100, 2930, 150, 2940); // left of the caption, below its top
};

test('A12 rotated page: ink beside the caption block is an error', () => {
  const { crops } = scenario(figurePage(), { rotated: true, draw: besideInk });
  assertOneError(crops.errors, 'ink beside the caption block on page 96: 500 pixels');
});

test('A12 upright page: the same ink is accepted as body', () => {
  const { crops } = scenario(figurePage(), { draw: besideInk });
  assert.deepEqual(crops.errors, []);
  assert.equal(crops.body_px![0], 96);
  assert.equal(crops.body_px![1] + crops.body_px![3], 2944);
});

test('A12 rotated page: a body word reaching the caption rows is an error', () => {
  const page = figurePage([[W('Reach', 400, 698, 430, 705)]]);
  const { part, crops } = scenario(page, { rotated: true, draw: (buf) => fillPx(buf, 400, 1000, 1400, 2000) });
  assert.deepEqual(checkRotatedPartitionText(part), ["body word 'Reach' [400, 698, 430, 705] on page 96 reaches the caption block"]);
  assertOneError(crops.errors, 'body reaches the caption block on page 96');
});

test('A12 rotated page: a sideways 4+ character word in the caption block is an error', () => {
  const page = figurePage([[W('Side', 400, 702, 405, 720)]]);
  const { part, crops } = scenario(page, { rotated: true, draw: (buf) => fillPx(buf, 400, 1000, 1400, 2000) });
  assert.deepEqual(checkRotatedPartitionText(part), ['caption block on page 96 contains sideways text: Side [400, 702, 405, 720] ratio 3.60']);
  assertOneError(crops.errors, 'caption block on page 96 contains sideways text: Side');
});

test('A12 a page with nothing above the caption is an error', () => {
  const { crops } = scenario(figurePage());
  assert.deepEqual(crops.errors, ['nothing printed above the caption on page 96']);
  assert.equal(crops.body_px, null);
});

test('A12 rotated page: page-number ink below the caption is erased, not "ink beside the caption"', () => {
  const { buf, crops } = scenario(figurePage(), { rotated: true, draw: (b) => fillPx(b, 400, 1000, 1400, 2000) });
  // The page number really was drawn below the caption block.
  assert.deepEqual(pixel(buf, PAGE_PX.w, Math.ceil(269 * S) + 2, Math.ceil(728 * S) + 2), [0, 0, 0]);
  assert.deepEqual(crops.errors, []);
});

// ---------------------------------------------------------------------------------------------
// A13. rotateRgb

test('A13 rotateRgb is an exact clockwise mapping with no mirroring', () => {
  // 3 x 2 image; pixel i has channels [10i+1, 10i+2, 10i+3].
  //   p0 p1 p2
  //   p3 p4 p5
  const p = (i: number): number[] => [10 * i + 1, 10 * i + 2, 10 * i + 3];
  const src = Uint8Array.from([0, 1, 2, 3, 4, 5].flatMap(p));
  const expect = (order: number[]): number[] => order.flatMap(p);
  const r90 = rotateRgb(src, 3, 2, 90);
  assert.equal(r90.width, 2);
  assert.equal(r90.height, 3);
  assert.deepEqual([...r90.data], expect([3, 0, 4, 1, 5, 2]));
  const r180 = rotateRgb(src, 3, 2, 180);
  assert.equal(r180.width, 3);
  assert.deepEqual([...r180.data], expect([5, 4, 3, 2, 1, 0]));
  const r270 = rotateRgb(src, 3, 2, 270);
  assert.equal(r270.width, 2);
  assert.deepEqual([...r270.data], expect([2, 5, 1, 4, 0, 3]));
  const back = rotateRgb(r90.data, r90.width, r90.height, 270);
  assert.equal(back.width, 3);
  assert.deepEqual([...back.data], [...src]);
});

// ---------------------------------------------------------------------------------------------
// A14. composeItem

// A small page whose every pixel is non-white and distinct by position.
function patternPage(w: number, h: number): Uint8Array {
  const buf = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) buf.set([x * 10, y * 10, 7], (y * w + x) * 3);
  return buf;
}

function region(img: { data: Uint8Array; width: number }, left: number, top: number, w: number, h: number): number[] {
  const out: number[] = [];
  for (let y = top; y < top + h; y++) out.push(...img.data.subarray((y * img.width + left) * 3, (y * img.width + left + w) * 3));
  return out;
}

test('A14 composeItem upright: U pasted at (M, M) on a white margin', () => {
  const page = patternPage(20, 20);
  const f = { rotate: 0 as const, body_px: [2, 3, 5, 4] as [number, number, number, number], caption_px: [4, 10, 3, 2] as [number, number, number, number] };
  const out = composeItem(page, 20, 20, f);
  // U = [2, 3, 5, 9]
  assert.deepEqual([out.width, out.height], [5 + 48, 9 + 48]);
  assert.deepEqual(composedSize(f), { width: out.width, height: out.height });
  assert.deepEqual(region(out, 24, 24, 5, 9), [...cropRgb(page, 20, 20, [2, 3, 5, 9]).data]);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      if (x >= 24 && x < 29 && y >= 24 && y < 33) continue;
      assert.deepEqual(pixel(out.data, out.width, x, y), [255, 255, 255], `margin pixel ${x},${y}`);
    }
  }
});

test('A14 composeItem rotate 90: size and both paste positions match the formula; caption unturned', () => {
  const page = patternPage(20, 20);
  const f = { rotate: 90 as const, body_px: [2, 3, 5, 4] as [number, number, number, number], caption_px: [4, 10, 3, 2] as [number, number, number, number] };
  const out = composeItem(page, 20, 20, f);
  // B is the body turned: 4 wide, 5 high. C is 3 x 2. W = max(4, 3) + 48 = 52; H = 5 + 2 + 72 = 79.
  assert.deepEqual([out.width, out.height], [52, 79]);
  assert.deepEqual(composedSize(f), { width: 52, height: 79 });
  const body = cropRgb(page, 20, 20, f.body_px);
  const B = rotateRgb(body.data, body.width, body.height, 90);
  const bx = Math.floor((52 - 4) / 2);
  const cx = Math.floor((52 - 3) / 2);
  const cy = 48 + 5;
  assert.deepEqual(region(out, bx, 24, 4, 5), [...B.data]);
  assert.deepEqual(region(out, cx, cy, 3, 2), [...cropRgb(page, 20, 20, f.caption_px).data]);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const inB = x >= bx && x < bx + 4 && y >= 24 && y < 29;
      const inC = x >= cx && x < cx + 3 && y >= cy && y < cy + 2;
      if (inB || inC) continue;
      assert.deepEqual(pixel(out.data, out.width, x, y), [255, 255, 255], `pixel ${x},${y}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// A15. isGrayscale, versionGuardDecision, usage errors

test('A15 isGrayscale', () => {
  assert.equal(isGrayscale(Uint8Array.from([0, 0, 0, 128, 128, 128, 255, 255, 255])), true);
  assert.equal(isGrayscale(Uint8Array.from([0, 0, 0, 128, 128, 129])), false);
});

test('A15 versionGuardDecision', () => {
  const cur = { poppler: '24.02.0', sharp: '0.35.5', libvips: '8.18.7' };
  const idx = (ex: unknown, items: unknown[] = [{}]) => ({ source_doc: 'akts-2h', extracted_with: ex, items });
  assert.deepEqual(versionGuardDecision(null, cur, false), { proceed: true, message: null });
  assert.deepEqual(versionGuardDecision(idx(null, []), cur, false), { proceed: true, message: null });
  assert.deepEqual(versionGuardDecision(idx({ ...cur }), cur, false), { proceed: true, message: null });
  const refused = versionGuardDecision(idx({ ...cur, poppler: '23.08.0' }), cur, false);
  assert.equal(refused.proceed, false);
  assert.ok(refused.message!.includes('poppler 23.08.0 -> 24.02.0') && refused.message!.includes('200 MB'), refused.message!);
  const allowed = versionGuardDecision(idx({ ...cur, libvips: '8.17.0' }), cur, true);
  assert.equal(allowed.proceed, true);
  assert.ok(allowed.message!.startsWith('WARNING'));
});

function runExtract(args: string[]): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', 'qbank', 'extract-figures.ts'), ...args], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('A15 usage errors exit 2 before any tool lookup', () => {
  for (const args of [['--only', 'fig-1'], ['--save-words', 'x.json'], ['--survey', '--save-words', 'figures/x.json']]) {
    const r = runExtract(args);
    assert.equal(r.status, 2, `${args.join(' ')}: ${r.out}`);
    assert.ok(r.out.includes('Usage:'), r.out);
    assert.ok(!r.out.includes('POPPLER_BIN') && !r.out.includes('Xpdf'), r.out);
  }
});
