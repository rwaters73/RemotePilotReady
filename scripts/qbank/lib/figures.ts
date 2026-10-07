// Pure logic for extracting the Testing Supplement figures and legends (B-101).
// No I/O, no Poppler, no sharp: everything here works on parsed text and raw pixel buffers,
// so it can be tested on any machine. extract-figures.ts does the I/O.

import { FIGURE_KEY_RE } from './data.ts';
import type { FigureItem, PixelRect, ReferenceDoc, RotationEntry, RotationsFile } from './types.ts';

// ---------------------------------------------------------------------------------------------
// Constants. Written as literals on purpose: the expected sets and window bounds are checked
// against the PDF, so they must not be computed from it.

export const RENDER_DPI = 300;
export const S = 300 / 72; // points to pixels
export const EXPECTED_PAGE_COUNT = 113;
export const PAGE_PT = { w: 594, h: 774 };
export const PAGE_PX = { w: 2475, h: 3225 };
export const INK_THRESHOLD = 250; // a pixel is ink if any channel is below this
export const MARGIN_PX = 24; // white margin around every image, and the gap between a turned body and its caption
export const PAD_PX = 4; // each crop is padded by this much, to keep anti-aliased edges

// Page-mark windows, in points: architect-Claude's measured extents plus 1.0 pt. Used only to
// assert where the header and page number are; they never decide what is erased.
export const HEADER_Y_PT = [32.8, 45.7] as const;
export const HEADER_LEFT_X_PT = [35.0, 80.1] as const;
export const HEADER_RIGHT_X_PT = [513.5, 559.0] as const;
export const PAGENUM_X_PT = [268.0, 326.0] as const;
export const PAGENUM_Y_PT = [727.0, 741.3] as const;

// Padding erased around each page-mark word box. Never raise it: fig-65 leaves only 0.56 pt.
export const ERASE_PAD_PT = 0.25;
export const CAPTION_TOL_PT = 1.0;

export const MIN_WORD_CHARS = 3;
export const MIN_DETECT_WORDS = 8;
export const SIDEWAYS_SHARE = 0.65;
export const DIRECTION_MIN_VOTES = 3;
export const DIRECTION_AGREEMENT = 0.8;
export const CAPTION_SIDEWAYS_MIN_CHARS = 4;
export const CAPTION_SIDEWAYS_RATIO = 1.02;

export const PPI_WARN = 330;
export const WEBP_PSNR_WARN_DB = 35;

export const WEBP = { quality: 90, effort: 6, smartSubsample: true, losslessForGrayscale: true };
export const PNG = { compressionLevel: 9, adaptiveFiltering: true, palette: false };

export const EXPECTED_FIGURES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
  51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
  71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82,
];
export const EXPECTED_LEGENDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
export const KNOWN_NOT_IN_CONTENTS = ['fig-55'];
// The upright pages nearest the detection line, saved in the words fixture as controls.
export const SAVE_WORDS_CONTROLS = ['fig-36', 'fig-43', 'fig-48'];

export const CAPTION_RE = /^(Figure|Legend)\s+(\d+)\.(\s|$)/;

// ---------------------------------------------------------------------------------------------
// Types

export type ItemType = 'figure' | 'legend';

export interface Word {
  text: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface Page {
  number: number; // 1-based PDF page
  width: number;
  height: number;
  lines: Word[][]; // Poppler's line grouping and word order
}

export interface PxBox {
  x0: number; // inclusive
  y0: number;
  x1: number; // exclusive
  y1: number;
}

export interface Raster {
  data: Uint8Array;
  width: number;
  height: number;
}

export function keyFor(type: ItemType, n: number): string {
  return `${type === 'legend' ? 'legend' : 'fig'}-${n}`;
}

export function expectedKeys(): string[] {
  return [...EXPECTED_FIGURES.map((n) => keyFor('figure', n)), ...EXPECTED_LEGENDS.map((n) => keyFor('legend', n))];
}

export function charCount(text: string): number {
  return [...text.trim()].length;
}

export function lineText(line: Word[]): string {
  return line.map((w) => w.text).join(' ');
}

export function fmtBox(w: Word): string {
  return `[${w.xMin}, ${w.yMin}, ${w.xMax}, ${w.yMax}]`;
}

function fmtPx(b: PxBox): string {
  return `[${b.x0}, ${b.y0}, ${b.x1}, ${b.y1})`;
}

// Index order: figures by number, then legends by number.
export function compareKeys(a: string, b: string): number {
  const ma = FIGURE_KEY_RE.exec(a);
  const mb = FIGURE_KEY_RE.exec(b);
  if (!ma || !mb) return a.localeCompare(b);
  if (ma[1] !== mb[1]) return ma[1] === 'fig' ? -1 : 1;
  return Number(ma[2]) - Number(mb[2]);
}

// ---------------------------------------------------------------------------------------------
// Point-to-pixel conversion

// Outward rule, for word boxes used in crops, caption zones and containment checks.
export function outwardPx(w: Word): PxBox {
  return { x0: Math.floor(w.xMin * S), y0: Math.floor(w.yMin * S), x1: Math.ceil(w.xMax * S), y1: Math.ceil(w.yMax * S) };
}

// Pixel-centre rule, for erasing only. Returns inclusive first/last column and row, clamped to
// the page, as an exclusive PxBox. No pixel whose centre is more than ERASE_PAD_PT outside the
// word box is included.
export function eraseRectPx(w: Word, width: number, height: number): PxBox {
  const c0 = Math.max(0, Math.ceil((w.xMin - ERASE_PAD_PT) * S - 0.5));
  const c1 = Math.min(width - 1, Math.floor((w.xMax + ERASE_PAD_PT) * S - 0.5));
  const r0 = Math.max(0, Math.ceil((w.yMin - ERASE_PAD_PT) * S - 0.5));
  const r1 = Math.min(height - 1, Math.floor((w.yMax + ERASE_PAD_PT) * S - 0.5));
  return { x0: c0, y0: r0, x1: c1 + 1, y1: r1 + 1 };
}

// ---------------------------------------------------------------------------------------------
// Text: Poppler pdftotext -bbox-layout output

function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_m, e: string) => {
    switch (e) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    }
  });
}

function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([A-Za-z]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

export function parseBboxLayout(xhtml: string): Page[] {
  const pages: Page[] = [];
  for (const pm of xhtml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)) {
    const pa = attrs(pm[1]);
    const lines: Word[][] = [];
    for (const lm of pm[2].matchAll(/<line\b[^>]*>([\s\S]*?)<\/line>/g)) {
      const words: Word[] = [];
      for (const wm of lm[1].matchAll(/<word\b([^>]*)>([\s\S]*?)<\/word>/g)) {
        const wa = attrs(wm[1]);
        words.push({
          text: decodeEntities(wm[2]),
          xMin: Number(wa.xMin),
          yMin: Number(wa.yMin),
          xMax: Number(wa.xMax),
          yMax: Number(wa.yMax),
        });
      }
      if (words.length > 0) lines.push(words);
    }
    pages.push({ number: pages.length + 1, width: Number(pa.width), height: Number(pa.height), lines });
  }
  return pages;
}

// ---------------------------------------------------------------------------------------------
// Mapping: which page holds which item

export interface ItemPage {
  key: string;
  type: ItemType;
  number: number;
  page: number;
  captionLine: number; // index into page.lines
  captionText: string;
}

export interface Classification {
  items: ItemPage[];
  contents: { page: number; keys: string[] }[];
  errors: string[];
}

function captionOf(line: Word[]): { type: ItemType; number: number } | null {
  const m = CAPTION_RE.exec(lineText(line));
  if (!m) return null;
  return { type: m[1] === 'Legend' ? 'legend' : 'figure', number: Number(m[2]) };
}

export function classifyPages(pages: Page[]): Classification {
  const out: Classification = { items: [], contents: [], errors: [] };
  for (const p of pages) {
    const caps: { line: number; type: ItemType; number: number }[] = [];
    p.lines.forEach((line, i) => {
      const c = captionOf(line);
      if (c) caps.push({ line: i, ...c });
    });
    if (caps.length === 0) continue;
    if (caps.length === 1) {
      const c = caps[0];
      out.items.push({
        key: keyFor(c.type, c.number),
        type: c.type,
        number: c.number,
        page: p.number,
        captionLine: c.line,
        captionText: lineText(p.lines[c.line]),
      });
    } else if (caps.length === 2) {
      out.errors.push(
        `page ${p.number} has 2 caption lines: ${caps.map((c) => `"${lineText(p.lines[c.line])}"`).join(' and ')}`,
      );
    } else {
      out.contents.push({ page: p.number, keys: caps.map((c) => keyFor(c.type, c.number)) });
    }
  }
  return out;
}

export function checkMapping(c: Classification): { errors: string[]; notes: string[] } {
  const errors: string[] = [...c.errors];
  const notes: string[] = [];
  const expected = new Set(expectedKeys());
  const byKey = new Map<string, number[]>();
  for (const it of c.items) byKey.set(it.key, [...(byKey.get(it.key) ?? []), it.page]);
  for (const [key, pages] of byKey) {
    if (pages.length > 1) errors.push(`${key} is captioned on more than one page: ${pages.join(', ')}`);
    if (!expected.has(key)) errors.push(`${key} (page ${pages.join(', ')}) is not an expected item`);
  }
  for (const key of expected) if (!byKey.has(key)) errors.push(`${key} was not found on any page`);
  const inContents = new Set(c.contents.flatMap((p) => p.keys));
  for (const key of byKey.keys()) {
    if (inContents.has(key)) continue;
    if (KNOWN_NOT_IN_CONTENTS.includes(key)) notes.push(`${key} is not listed on the contents pages (known)`);
    else errors.push(`${key} is captioned on page ${byKey.get(key)!.join(', ')} but is not listed on the contents pages`);
  }
  for (const key of inContents) {
    if (!byKey.has(key)) errors.push(`${key} is listed on the contents pages but no page carries its caption`);
  }
  return { errors, notes };
}

// ---------------------------------------------------------------------------------------------
// Page marks: the "Appendix N" header and the printed page number

export interface PageMarks {
  header: Word;
  digit: Word;
  pageNumber: Word;
}

export interface MarksResult {
  marks: PageMarks | null;
  side: 'left' | 'right' | null;
  printedPage: string | null;
  errors: string[];
}

type Range = readonly [number, number];

function inside(w: Word, xr: Range, yr: Range): boolean {
  return w.xMin >= xr[0] && w.xMax <= xr[1] && w.yMin >= yr[0] && w.yMax <= yr[1];
}

function padded(w: Word, pad: number): Word {
  return { text: w.text, xMin: w.xMin - pad, yMin: w.yMin - pad, xMax: w.xMax + pad, yMax: w.yMax + pad };
}

function intersects(a: Word, b: Word): boolean {
  return a.xMin < b.xMax && b.xMin < a.xMax && a.yMin < b.yMax && b.yMin < a.yMax;
}

function fmtRange(xr: Range, yr: Range): string {
  return `x ${xr[0]}-${xr[1]}, y ${yr[0]}-${yr[1]}`;
}

export function checkPageMarks(page: Page, type: ItemType): MarksResult {
  const errors: string[] = [];
  const P = page.number;
  const digitText = type === 'legend' ? '1' : '2';
  const words = page.lines.flat();

  // Header
  let header: Word | null = null;
  let digit: Word | null = null;
  let side: 'left' | 'right' | null = null;
  const sideOf = (w: Word): 'left' | 'right' | null =>
    inside(w, HEADER_LEFT_X_PT, HEADER_Y_PT) ? 'left' : inside(w, HEADER_RIGHT_X_PT, HEADER_Y_PT) ? 'right' : null;
  const candidates = words.filter((w) => w.text === 'Appendix' && sideOf(w) !== null);
  if (candidates.length !== 1) {
    const all = words.filter((w) => w.text === 'Appendix');
    errors.push(
      `page ${P}: expected one "Appendix" header inside ${fmtRange(HEADER_LEFT_X_PT, HEADER_Y_PT)} or ${fmtRange(HEADER_RIGHT_X_PT, HEADER_Y_PT)}, found ${candidates.length}; "Appendix" words on the page: ${all.length === 0 ? 'none' : all.map(fmtBox).join(', ')}`,
    );
  } else {
    header = candidates[0];
    side = sideOf(header);
    const xr = side === 'left' ? HEADER_LEFT_X_PT : HEADER_RIGHT_X_PT;
    const line = page.lines.find((l) => l.includes(header!))!;
    const next = line[line.indexOf(header) + 1];
    if (next === undefined) {
      errors.push(`page ${P}: the "Appendix" header ${fmtBox(header)} has no digit after it on its line`);
    } else {
      if (next.text !== digitText) {
        errors.push(`page ${P}: header digit is "${next.text}" ${fmtBox(next)}; expected "${digitText}" for a ${type}`);
      }
      if (!inside(next, xr, HEADER_Y_PT)) {
        errors.push(`page ${P}: header digit "${next.text}" ${fmtBox(next)} is outside the ${side} header window (${fmtRange(xr, HEADER_Y_PT)})`);
      }
      if (next.text === digitText && inside(next, xr, HEADER_Y_PT)) digit = next;
    }
  }

  // Page number
  let pageNumber: Word | null = null;
  let printedPage: string | null = null;
  const inWindow = words.filter((w) => inside(w, PAGENUM_X_PT, PAGENUM_Y_PT));
  if (inWindow.length !== 1) {
    const lookalikes = words.filter((w) => /^[12]-\d{1,2}$/.test(w.text));
    errors.push(
      `page ${P}: expected one word inside the page-number window (${fmtRange(PAGENUM_X_PT, PAGENUM_Y_PT)}), found ${inWindow.length}; page-number-like words: ${lookalikes.length === 0 ? 'none' : lookalikes.map((w) => `"${w.text}" ${fmtBox(w)}`).join(', ')}; words inside the window: ${inWindow.length === 0 ? 'none' : inWindow.map((w) => `"${w.text}" ${fmtBox(w)}`).join(', ')}`,
    );
  } else {
    const w = inWindow[0];
    if (!/^[12]-\d{1,2}$/.test(w.text)) {
      errors.push(`page ${P}: the word "${w.text}" ${fmtBox(w)} in the page-number window is not a page number`);
    } else if (w.text[0] !== digitText) {
      errors.push(`page ${P}: page number "${w.text}" ${fmtBox(w)} should start with ${digitText}- for a ${type}`);
    } else {
      pageNumber = w;
      printedPage = w.text;
    }
  }

  // Overlap: a content word that a mark's erase box would partly erase.
  const found: { w: Word; what: string }[] = [];
  if (header) found.push({ w: header, what: 'header' });
  if (digit) found.push({ w: digit, what: 'header' });
  if (pageNumber) found.push({ w: pageNumber, what: 'page number' });
  const markSet = new Set(found.map((f) => f.w));
  for (const w of words) {
    if (markSet.has(w)) continue;
    for (const m of found) {
      if (intersects(w, padded(m.w, ERASE_PAD_PT))) {
        errors.push(`word '${w.text}' ${fmtBox(w)} on page ${P} overlaps the ${m.what}`);
        break;
      }
    }
  }

  const marks = header && digit && pageNumber && errors.length === 0 ? { header, digit, pageNumber } : null;
  return { marks, side, printedPage, errors };
}

// Within an appendix, printed page numbers rise by exactly 1 from one item page to the next.
export function checkPrintedSequence(items: { key: string; type: ItemType; page: number; printedPage: string }[]): string[] {
  const errors: string[] = [];
  for (const type of ['legend', 'figure'] as const) {
    const list = items.filter((i) => i.type === type).sort((a, b) => a.page - b.page);
    for (let i = 1; i < list.length; i++) {
      const prev = Number(list[i - 1].printedPage.split('-')[1]);
      const cur = Number(list[i].printedPage.split('-')[1]);
      if (cur !== prev + 1) {
        errors.push(
          `printed page ${list[i].printedPage} on page ${list[i].page} (${list[i].key}) does not follow ${list[i - 1].printedPage} on page ${list[i - 1].page} (${list[i - 1].key})`,
        );
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------
// Partition into body and caption block

export interface Partition {
  page: number;
  captionTop: number; // points
  captionWords: Word[];
  bodyWords: Word[];
  captionLines: Word[][];
  bodyLines: Word[][];
}

export function partitionWords(page: Page, marks: PageMarks, captionLine: number): Partition {
  const markSet = new Set<Word>([marks.header, marks.digit, marks.pageNumber]);
  const captionTop = Math.min(...page.lines[captionLine].map((w) => w.yMin));
  const isCaption = (w: Word): boolean => w.yMin >= captionTop - CAPTION_TOL_PT;
  const content = page.lines.map((l) => l.filter((w) => !markSet.has(w)));
  const captionLines = content.map((l) => l.filter(isCaption)).filter((l) => l.length > 0);
  const bodyLines = content.map((l) => l.filter((w) => !isCaption(w))).filter((l) => l.length > 0);
  return {
    page: page.number,
    captionTop,
    captionWords: captionLines.flat(),
    bodyWords: bodyLines.flat(),
    captionLines,
    bodyLines,
  };
}

export function nothingAboveCaption(page: number): string {
  return `nothing printed above the caption on page ${page}`;
}

// Text-only checks for an item that will be turned (detected sideways, or listed in the
// rotations file).
export function checkRotatedPartitionText(p: Partition): string[] {
  const errors: string[] = [];
  const capTopPx = Math.floor(p.captionTop * S) - PAD_PX;
  for (const w of findCaptionSideways(p.captionWords)) errors.push(captionSidewaysError(p.page, w));
  for (const w of p.bodyWords) {
    if (outwardPx(w).y1 > capTopPx) {
      errors.push(`body word '${w.text}' ${fmtBox(w)} on page ${p.page} reaches the caption block`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------
// Orientation and direction

export type Orientation = 'sideways' | 'upright' | 'undetermined';

export interface OrientationResult {
  result: Orientation;
  n: number;
  sideways: number;
  share: number;
}

function isSidewaysWord(w: Word): boolean {
  return w.yMax - w.yMin > w.xMax - w.xMin;
}

export function detectOrientation(bodyWords: Word[]): OrientationResult {
  const counted = bodyWords.filter((w) => charCount(w.text) >= MIN_WORD_CHARS);
  const n = counted.length;
  const sideways = counted.filter(isSidewaysWord).length;
  const share = n === 0 ? 0 : sideways / n;
  const result: Orientation = n < MIN_DETECT_WORDS ? 'undetermined' : share >= SIDEWAYS_SHARE ? 'sideways' : 'upright';
  return { result, n, sideways, share };
}

export interface DirectionResult {
  direction: 90 | 270 | null;
  up: number;
  down: number;
}

export function detectDirection(bodyLines: Word[][]): DirectionResult {
  let up = 0;
  let down = 0;
  const qualifies = (w: Word): boolean => charCount(w.text) >= MIN_WORD_CHARS && isSidewaysWord(w);
  const centreY = (w: Word): number => (w.yMin + w.yMax) / 2;
  for (const line of bodyLines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      if (!qualifies(a) || !qualifies(b)) continue;
      const dy = centreY(b) - centreY(a);
      if (dy < 0) up++;
      else if (dy > 0) down++;
    }
  }
  const total = up + down;
  let direction: 90 | 270 | null = null;
  if (total >= DIRECTION_MIN_VOTES) {
    if (up / total >= DIRECTION_AGREEMENT) direction = 90; // bottom-to-top text turns clockwise 90
    else if (down / total >= DIRECTION_AGREEMENT) direction = 270;
  }
  return { direction, up, down };
}

// Caption-block words of 4+ characters that are taller than 1.02 times their width.
export function findCaptionSideways(captionWords: Word[]): Word[] {
  return captionWords.filter(
    (w) => charCount(w.text) >= CAPTION_SIDEWAYS_MIN_CHARS && w.yMax - w.yMin > CAPTION_SIDEWAYS_RATIO * (w.xMax - w.xMin),
  );
}

function captionSidewaysError(page: number, w: Word): string {
  const ratio = (w.yMax - w.yMin) / (w.xMax - w.xMin);
  return `caption block on page ${page} contains sideways text: ${w.text} ${fmtBox(w)} ratio ${ratio.toFixed(2)}`;
}

// ---------------------------------------------------------------------------------------------
// Rotations file

export function checkRotationsFile(raw: unknown, docs: ReferenceDoc[] | null): { file: RotationsFile | null; errors: string[] } {
  const errors: string[] = [];
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isObj(raw)) return { file: null, errors: ['figure-rotations.json must be an object'] };
  for (const k of Object.keys(raw)) {
    if (!['source_doc', 'source_sha256', 'rotations'].includes(k)) errors.push(`figure-rotations.json has unknown key "${k}"`);
  }
  if (raw.source_doc !== 'akts-2h') errors.push('figure-rotations.json source_doc must be "akts-2h"');
  if (docs !== null) {
    const ref = docs.find((d) => d.key === 'akts-2h');
    if (ref === undefined) errors.push('references.json has no akts-2h entry');
    else if (raw.source_sha256 !== ref.sha256) {
      errors.push('figure-rotations.json source_sha256 does not match the akts-2h sha256 in references.json');
    }
  }
  if (!Array.isArray(raw.rotations)) {
    errors.push('figure-rotations.json must have a "rotations" list');
    return { file: null, errors };
  }
  const expected = new Set(expectedKeys());
  const seen = new Set<string>();
  raw.rotations.forEach((e: unknown, i: number) => {
    const where = `figure-rotations.json rotations[${i}]`;
    if (!isObj(e)) {
      errors.push(`${where} must be an object`);
      return;
    }
    const keys = Object.keys(e);
    if (keys.length !== 3 || !['key', 'rotate', 'evidence'].every((k) => Object.hasOwn(e, k))) {
      errors.push(`${where} must have exactly the keys key, rotate, evidence`);
    }
    if (typeof e.key !== 'string' || !FIGURE_KEY_RE.test(e.key)) errors.push(`${where}.key is malformed`);
    else if (!expected.has(e.key)) errors.push(`${where}.key "${e.key}" is not an expected item`);
    else if (seen.has(e.key)) errors.push(`figure-rotations.json lists "${e.key}" more than once`);
    if (typeof e.key === 'string') seen.add(e.key);
    if (e.rotate !== 90 && e.rotate !== 180 && e.rotate !== 270) errors.push(`${where}.rotate must be 90, 180 or 270`);
    if (e.evidence !== 'words' && e.evidence !== 'visual') errors.push(`${where}.evidence must be "words" or "visual"`);
    if (e.evidence === 'words' && e.rotate === 180) {
      errors.push(`${where}: evidence "words" can't give rotate 180 (detection can't see upside down)`);
    }
  });
  return { file: errors.length === 0 ? (raw as unknown as RotationsFile) : null, errors };
}

export interface Detection {
  key: string;
  orientation: OrientationResult;
  direction: DirectionResult | null; // for sideways results only
}

export type RotationCase = 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7' | 'K8' | 'K9' | 'K10' | 'K11' | 'K12';

export interface RotationOutcome {
  key: string;
  case: RotationCase | null; // null only for an upright item with no entry
  error: string | null;
}

export interface RotationComparison {
  outcomes: RotationOutcome[];
  errors: string[];
  directionByEyeOnly: string[]; // K6
  rotationByEyeOnly: string[]; // K11
  undetermined: string[]; // K12
}

export function compareRotations(file: RotationsFile, detections: Detection[]): RotationComparison {
  const entries = new Map<string, RotationEntry>(file.rotations.map((e) => [e.key, e]));
  const out: RotationComparison = { outcomes: [], errors: [], directionByEyeOnly: [], rotationByEyeOnly: [], undetermined: [] };
  const add = (key: string, c: RotationCase | null, error: string | null): void => {
    out.outcomes.push({ key, case: c, error });
    if (error !== null) out.errors.push(error);
  };
  const seen = new Set<string>();
  for (const d of detections) {
    seen.add(d.key);
    const key = d.key;
    const e = entries.get(key);
    const o = d.orientation;
    const share = o.share.toFixed(2);
    if (o.result === 'sideways') {
      const dir = d.direction ?? { direction: null, up: 0, down: 0 };
      const votes = `votes up ${dir.up}, down ${dir.down}`;
      if (dir.direction !== null) {
        const R = dir.direction;
        if (e === undefined) {
          add(key, 'K1', `${key} is printed sideways (${o.sideways} of ${o.n} body words); add { "key": "${key}", "rotate": ${R}, "evidence": "words" }`);
        } else if (e.evidence === 'words' && e.rotate === R) {
          add(key, 'K2', null);
        } else if (e.evidence === 'words') {
          add(key, 'K3', `${key}: the rotations file says rotate ${e.rotate}, but its words give rotate ${R} (${votes})`);
        } else {
          add(key, 'K4', `${key}'s direction was found from its words (${votes}); set evidence to words`);
        }
      } else if (e === undefined) {
        add(
          key,
          'K5',
          `${key} is printed sideways (${o.sideways} of ${o.n} body words) but its reading direction can't be read from its words (${votes}); look at the page and add { "key": "${key}", "rotate": 90 or 270, "evidence": "visual" }`,
        );
      } else if (e.evidence === 'visual' && (e.rotate === 90 || e.rotate === 270)) {
        add(key, 'K6', null);
        out.directionByEyeOnly.push(key);
      } else if (e.evidence === 'visual') {
        add(key, 'K7', `${key} is printed sideways; rotate must be 90 or 270`);
      } else {
        add(key, 'K8', `${key}'s reading direction can't be read from its words (${votes}); use evidence visual`);
      }
    } else if (o.result === 'upright') {
      if (e !== undefined) add(key, 'K9', `the rotations file turns ${key}, but its body text is upright (share ${share} of ${o.n} words)`);
      else add(key, null, null);
    } else if (e === undefined) {
      add(key, 'K12', null);
      out.undetermined.push(key);
    } else if (e.evidence === 'words') {
      add(key, 'K10', `${key} has too few body words to detect; use evidence visual`);
    } else {
      add(key, 'K11', null);
      out.rotationByEyeOnly.push(key);
    }
  }
  for (const e of file.rotations) {
    if (!seen.has(e.key)) out.errors.push(`the rotations file lists ${e.key}, but no item page was checked for it`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Pixels

function isInkAt(rgb: Uint8Array, i: number): boolean {
  return rgb[i] < INK_THRESHOLD || rgb[i + 1] < INK_THRESHOLD || rgb[i + 2] < INK_THRESHOLD;
}

function isFaintAt(rgb: Uint8Array, i: number): boolean {
  return rgb[i] < 255 || rgb[i + 1] < 255 || rgb[i + 2] < 255;
}

function inBox(x: number, y: number, b: PxBox): boolean {
  return x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1;
}

export interface MarkWord {
  label: string; // "Appendix", "2", "2-25"
  word: Word;
}

export interface EraseTouch {
  mark: string;
  count: number;
  box: PxBox;
}

export interface EraseResult {
  erased: Uint8Array;
  rects: PxBox[];
  errors: string[];
  eraseTouch: EraseTouch[];
}

export function marksList(m: PageMarks): MarkWord[] {
  return [
    { label: m.header.text, word: m.header },
    { label: m.digit.text, word: m.digit },
    { label: m.pageNumber.text, word: m.pageNumber },
  ];
}

export function erasePageMarks(rgb: Uint8Array, w: number, h: number, marks: MarkWord[], page: number): EraseResult {
  const rects = marks.map((m) => eraseRectPx(m.word, w, h));
  const errors: string[] = [];
  const eraseTouch: EraseTouch[] = [];
  marks.forEach((m, k) => {
    const r = rects[k];
    let ink = false;
    for (let y = r.y0; y < r.y1 && !ink; y++) {
      for (let x = r.x0; x < r.x1; x++) {
        if (isInkAt(rgb, (y * w + x) * 3)) {
          ink = true;
          break;
        }
      }
    }
    if (!ink) errors.push(`no ink inside the ${m.label} box on page ${page}`);
    // 1-pixel ring directly outside the erase rectangle, clamped to the page, excluding pixels
    // inside any erase rectangle.
    let count = 0;
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (let y = Math.max(0, r.y0 - 1); y <= Math.min(h - 1, r.y1); y++) {
      for (let x = Math.max(0, r.x0 - 1); x <= Math.min(w - 1, r.x1); x++) {
        if (inBox(x, y, r)) continue;
        if (rects.some((o) => inBox(x, y, o))) continue;
        if (isInkAt(rgb, (y * w + x) * 3)) {
          count++;
          bx0 = Math.min(bx0, x);
          by0 = Math.min(by0, y);
          bx1 = Math.max(bx1, x + 1);
          by1 = Math.max(by1, y + 1);
        }
      }
    }
    if (count > 0) eraseTouch.push({ mark: m.label, count, box: { x0: bx0, y0: by0, x1: bx1, y1: by1 } });
  });
  const erased = Uint8Array.from(rgb);
  for (const r of rects) {
    for (let y = r.y0; y < r.y1; y++) erased.fill(255, (y * w + r.x0) * 3, (y * w + r.x1) * 3);
  }
  return { erased, rects, errors, eraseTouch };
}

export interface CropResult {
  body_px: PixelRect | null;
  caption_px: PixelRect | null;
  errors: string[];
  warnings: string[];
  inkOutside: number;
  faintOutside: number;
  touchesEdge: string[];
}

function rectToBox(r: PixelRect): PxBox {
  return { x0: r[0], y0: r[1], x1: r[0] + r[2], y1: r[1] + r[3] };
}

function boxToRect(b: PxBox): PixelRect {
  return [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0];
}

export function unionRect(a: PixelRect, b: PixelRect): PixelRect {
  const A = rectToBox(a);
  const B = rectToBox(b);
  return boxToRect({ x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1) });
}

class BoxAcc {
  x0 = Infinity;
  y0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;
  add(x0: number, y0: number, x1: number, y1: number): void {
    this.x0 = Math.min(this.x0, x0);
    this.y0 = Math.min(this.y0, y0);
    this.x1 = Math.max(this.x1, x1);
    this.y1 = Math.max(this.y1, y1);
  }
  empty(): boolean {
    return this.x0 === Infinity;
  }
  box(): PxBox {
    return { x0: this.x0, y0: this.y0, x1: this.x1, y1: this.y1 };
  }
}

export function computeCrops(erased: Uint8Array, w: number, h: number, partition: Partition, rotated: boolean): CropResult {
  const P = partition.page;
  const errors: string[] = [];
  const warnings: string[] = [];
  const capTopPx = Math.floor(partition.captionTop * S) - PAD_PX;
  const zones = partition.captionWords.map((cw) => {
    const b = outwardPx(cw);
    return { x0: b.x0 - PAD_PX, y0: b.y0 - PAD_PX, x1: b.x1 + PAD_PX, y1: b.y1 + PAD_PX };
  });

  const body = new BoxAcc();
  const caption = new BoxAcc();
  const beside = new BoxAcc();
  let besideCount = 0;
  for (let y = 0; y < h; y++) {
    const rowZones = y >= capTopPx ? zones.filter((z) => y >= z.y0 && y < z.y1) : [];
    for (let x = 0; x < w; x++) {
      if (!isInkAt(erased, (y * w + x) * 3)) continue;
      if (y < capTopPx) {
        body.add(x, y, x + 1, y + 1);
      } else if (rowZones.some((z) => x >= z.x0 && x < z.x1)) {
        caption.add(x, y, x + 1, y + 1);
      } else if (rotated) {
        besideCount++;
        beside.add(x, y, x + 1, y + 1);
      } else {
        body.add(x, y, x + 1, y + 1);
      }
    }
  }
  if (besideCount > 0) errors.push(`ink beside the caption block on page ${P}: ${besideCount} pixels in ${fmtPx(beside.box())}`);
  for (const bw of partition.bodyWords) {
    const b = outwardPx(bw);
    body.add(b.x0, b.y0, b.x1, b.y1);
  }
  for (const cw of partition.captionWords) {
    const b = outwardPx(cw);
    caption.add(b.x0, b.y0, b.x1, b.y1);
  }

  const result: CropResult = { body_px: null, caption_px: null, errors, warnings, inkOutside: 0, faintOutside: 0, touchesEdge: [] };
  if (rotated) {
    if (!body.empty() && body.y1 > capTopPx) errors.push(`body reaches the caption block on page ${P}`);
    for (const cw of findCaptionSideways(partition.captionWords)) errors.push(captionSidewaysError(P, cw));
  }
  if (body.empty()) {
    errors.push(nothingAboveCaption(P));
    return result;
  }
  if (caption.empty()) {
    errors.push(`no caption found on page ${P}`);
    return result;
  }

  const bodyBox: PxBox = {
    x0: Math.max(0, body.x0 - PAD_PX),
    y0: Math.max(0, body.y0 - PAD_PX),
    x1: Math.min(w, body.x1 + PAD_PX),
    y1: Math.min(h, body.y1 + PAD_PX),
  };
  if (rotated) bodyBox.y1 = Math.min(bodyBox.y1, capTopPx);
  const capBox: PxBox = {
    x0: Math.max(0, caption.x0 - PAD_PX),
    y0: Math.max(capTopPx, caption.y0 - PAD_PX),
    x1: Math.min(w, caption.x1 + PAD_PX),
    y1: Math.min(h, caption.y1 + PAD_PX),
  };
  result.body_px = boxToRect(bodyBox);
  result.caption_px = boxToRect(capBox);

  const regions: PxBox[] = rotated ? [bodyBox, capBox] : [rectToBox(unionRect(result.body_px, result.caption_px))];
  const inkAcc = new BoxAcc();
  const faintAcc = new BoxAcc();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      if (!isFaintAt(erased, i)) continue;
      if (regions.some((r) => inBox(x, y, r))) continue;
      result.faintOutside++;
      faintAcc.add(x, y, x + 1, y + 1);
      if (isInkAt(erased, i)) {
        result.inkOutside++;
        inkAcc.add(x, y, x + 1, y + 1);
      }
    }
  }
  if (result.inkOutside > 0) {
    errors.push(`ink outside the crops on page ${P}: ${result.inkOutside} pixels in ${fmtPx(inkAcc.box())} (a bug)`);
  }
  if (result.faintOutside > 0) {
    warnings.push(`faintOutside: ${result.faintOutside} pixels lighter than ink outside the crops on page ${P}, in ${fmtPx(faintAcc.box())}`);
  }

  for (const [name, b] of [['body', bodyBox], ['caption', capBox]] as const) {
    const sides: string[] = [];
    if (b.y0 === 0) sides.push('top');
    if (b.y1 === h) sides.push('bottom');
    if (b.x0 === 0) sides.push('left');
    if (b.x1 === w) sides.push('right');
    for (const s of sides) {
      result.touchesEdge.push(s);
      warnings.push(`touchesEdge: the ${name} crop on page ${P} reaches the ${s} edge of the page`);
    }
  }

  const contains = (outer: PxBox, inner: PxBox): boolean =>
    inner.x0 >= outer.x0 && inner.y0 >= outer.y0 && inner.x1 <= outer.x1 && inner.y1 <= outer.y1;
  for (const cw of [...partition.bodyWords, ...partition.captionWords]) {
    const b = outwardPx(cw);
    if (!contains(bodyBox, b) && !contains(capBox, b)) {
      errors.push(`word '${cw.text}' ${fmtBox(cw)} on page ${P} is not inside either crop (a bug)`);
    }
  }
  return result;
}

export function cropRgb(rgb: Uint8Array, w: number, _h: number, rect: PixelRect): Raster {
  const [left, top, cw, ch] = rect;
  const out = new Uint8Array(cw * ch * 3);
  for (let y = 0; y < ch; y++) {
    const src = ((top + y) * w + left) * 3;
    out.set(rgb.subarray(src, src + cw * 3), y * cw * 3);
  }
  return { data: out, width: cw, height: ch };
}

// Exact pixel mapping, clockwise, no resampling.
export function rotateRgb(rgb: Uint8Array, w: number, h: number, angle: 0 | 90 | 180 | 270): Raster {
  if (angle === 0) return { data: Uint8Array.from(rgb), width: w, height: h };
  const ow = angle === 180 ? w : h;
  const oh = angle === 180 ? h : w;
  const out = new Uint8Array(ow * oh * 3);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let sx: number;
      let sy: number;
      if (angle === 90) {
        sx = y;
        sy = h - 1 - x;
      } else if (angle === 180) {
        sx = w - 1 - x;
        sy = h - 1 - y;
      } else {
        sx = w - 1 - y;
        sy = x;
      }
      const s = (sy * w + sx) * 3;
      const d = (y * ow + x) * 3;
      out[d] = rgb[s];
      out[d + 1] = rgb[s + 1];
      out[d + 2] = rgb[s + 2];
    }
  }
  return { data: out, width: ow, height: oh };
}

function paste(canvas: Raster, src: Raster, left: number, top: number): void {
  for (let y = 0; y < src.height; y++) {
    const s = y * src.width * 3;
    canvas.data.set(src.data.subarray(s, s + src.width * 3), ((top + y) * canvas.width + left) * 3);
  }
}

export interface ComposeFields {
  rotate: 0 | 90 | 180 | 270;
  body_px: PixelRect;
  caption_px: PixelRect;
}

// The final image size the composition must produce.
export function composedSize(f: ComposeFields): { width: number; height: number } {
  const M = MARGIN_PX;
  if (f.rotate === 0) {
    const U = unionRect(f.body_px, f.caption_px);
    return { width: U[2] + 2 * M, height: U[3] + 2 * M };
  }
  const bw = f.rotate === 180 ? f.body_px[2] : f.body_px[3];
  const bh = f.rotate === 180 ? f.body_px[3] : f.body_px[2];
  return { width: Math.max(bw, f.caption_px[2]) + 2 * M, height: bh + f.caption_px[3] + 3 * M };
}

export function composeItem(erased: Uint8Array, w: number, h: number, f: ComposeFields): Raster {
  const M = MARGIN_PX;
  if (f.rotate === 0) {
    const U = unionRect(f.body_px, f.caption_px);
    const canvas: Raster = { data: new Uint8Array((U[2] + 2 * M) * (U[3] + 2 * M) * 3).fill(255), width: U[2] + 2 * M, height: U[3] + 2 * M };
    paste(canvas, cropRgb(erased, w, h, U), M, M);
    return canvas;
  }
  const bodyCrop = cropRgb(erased, w, h, f.body_px);
  const B = rotateRgb(bodyCrop.data, bodyCrop.width, bodyCrop.height, f.rotate);
  const C = cropRgb(erased, w, h, f.caption_px);
  const W = Math.max(B.width, C.width) + 2 * M;
  const H = B.height + C.height + 3 * M;
  const canvas: Raster = { data: new Uint8Array(W * H * 3).fill(255), width: W, height: H };
  paste(canvas, B, Math.floor((W - B.width) / 2), M);
  paste(canvas, C, Math.floor((W - C.width) / 2), 2 * M + B.height);
  return canvas;
}

export function isGrayscale(rgb: Uint8Array): boolean {
  for (let i = 0; i < rgb.length; i += 3) {
    if (rgb[i] !== rgb[i + 1] || rgb[i] !== rgb[i + 2]) return false;
  }
  return true;
}

// Peak signal-to-noise ratio in dB over every byte; Infinity when identical.
export function psnr(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error(`psnr: lengths differ (${a.length} vs ${b.length})`);
  let se = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    se += d * d;
  }
  if (se === 0) return Infinity;
  const mse = se / a.length;
  return 10 * Math.log10((255 * 255) / mse);
}

export interface ToolVersions {
  poppler: string;
  sharp: string;
  libvips: string;
}

// Refuse to overwrite an index made with different tool versions unless allowed: every file
// would get new bytes.
export function versionGuardDecision(
  existingIndex: unknown,
  current: ToolVersions,
  allowFlag: boolean,
): { proceed: boolean; message: string | null } {
  const ex = existingIndex as { items?: unknown; extracted_with?: Record<string, unknown> | null } | null;
  if (ex === null || typeof ex !== 'object' || !Array.isArray(ex.items) || ex.items.length === 0) {
    return { proceed: true, message: null };
  }
  const prev = ex.extracted_with ?? {};
  const diffs = (['poppler', 'sharp', 'libvips'] as const)
    .filter((k) => prev[k] !== current[k])
    .map((k) => `${k} ${String(prev[k])} -> ${current[k]}`);
  if (diffs.length === 0) return { proceed: true, message: null };
  const what = `the existing figures were made with different tools (${diffs.join(', ')}); re-extracting gives every file new bytes, adding roughly 200 MB of new git history`;
  if (allowFlag) return { proceed: true, message: `WARNING: ${what}` };
  return { proceed: false, message: `${what}. Re-run with --allow-version-change to do it anyway.` };
}

function mib(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function formatSizeReport(items: FigureItem[], rotations: RotationEntry[] | null = null): string[] {
  const lines: string[] = [];
  const figures = items.filter((i) => i.type === 'figure').length;
  const legends = items.length - figures;
  const rotated = items.filter((i) => i.rotate !== 0);
  let rot = `${rotated.length} rotated`;
  if (rotations !== null) {
    const ev = (k: string): string | undefined => rotations.find((r) => r.key === k)?.evidence;
    const words = rotated.filter((i) => ev(i.key) === 'words').length;
    const visual = rotated.filter((i) => ev(i.key) === 'visual').length;
    rot += ` (words ${words} / visual ${visual})`;
  }
  const gray = items.filter((i) => i.files.webp.lossless).length;
  lines.push(`Items: ${items.length} (${figures} figures, ${legends} legends), ${rot}, ${gray} grayscale`);
  for (const fmt of ['png', 'webp'] as const) {
    const label = fmt === 'png' ? 'PNG' : 'WebP';
    const total = items.reduce((s, i) => s + i.files[fmt].bytes, 0);
    lines.push(`${label}: ${items.length} files, ${total.toLocaleString('en-US')} bytes (${mib(total)} MiB)`);
    const top = [...items].sort((a, b) => b.files[fmt].bytes - a.files[fmt].bytes).slice(0, 5);
    for (const i of top) lines.push(`  ${i.files[fmt].name}  ${i.files[fmt].bytes.toLocaleString('en-US')}`);
  }
  return lines;
}
