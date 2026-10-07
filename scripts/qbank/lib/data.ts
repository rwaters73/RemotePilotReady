// Loads and checks the bank's data files: data/references.json, data/acs-10b-knowledge.json,
// and figures/index.json. Problems found here are reported under the "data" check.
// These functions are pure apart from reading the named files, so tests can feed them bad data.

import { readFileSync } from 'node:fs';
import type { AcsData, FigureIndex, PixelRect, ReferenceDoc } from './types.ts';

// ACS knowledge element code, e.g. UA.I.B.K10 or UA.I.B.K14a.
export const ACS_CODE_RE = /^UA\.(I|II|III|IV|V)\.([A-Z])\.K(\d+)([a-z]?)$/;

// Expected number of ACS knowledge elements in FAA-S-ACS-10B. A hardcoded literal on purpose:
// it is checked against the data file, so it must not be read from that file.
export const ACS_ELEMENT_COUNT = 176;

export const REFERENCE_KINDS = ['cfr', 'faa'] as const;

export const FIGURE_KEY_RE = /^(fig|legend)-([1-9]\d*)$/;

export function areaOfCode(code: string): string | null {
  const m = ACS_CODE_RE.exec(code);
  return m ? m[1] : null;
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

export function checkReferences(raw: unknown): { docs: ReferenceDoc[] | null; errors: string[] } {
  const errors: string[] = [];
  if (!isObj(raw) || !Array.isArray(raw.documents)) {
    return { docs: null, errors: ['references.json must be an object with a "documents" list'] };
  }
  const seen = new Set<string>();
  raw.documents.forEach((d: unknown, i: number) => {
    const where = `references.json documents[${i}]`;
    if (!isObj(d)) {
      errors.push(`${where} must be an object`);
      return;
    }
    for (const k of ['key', 'kind', 'title', 'edition', 'official_url', 'local_file', 'sha256']) {
      if (!isNonEmptyString(d[k])) errors.push(`${where}.${k} must be a non-empty string`);
    }
    if (!(d.document_number === null || isNonEmptyString(d.document_number))) {
      errors.push(`${where}.document_number must be a non-empty string or null`);
    }
    if (isNonEmptyString(d.kind) && !(REFERENCE_KINDS as readonly string[]).includes(d.kind)) {
      errors.push(`${where}.kind must be one of ${REFERENCE_KINDS.join(', ')}`);
    }
    if (isNonEmptyString(d.sha256) && !/^[0-9a-f]{64}$/.test(d.sha256)) {
      errors.push(`${where}.sha256 must be 64 lowercase hex characters`);
    }
    if (isNonEmptyString(d.official_url) && !d.official_url.startsWith('https://')) {
      errors.push(`${where}.official_url must start with https://`);
    }
    if (isNonEmptyString(d.key)) {
      if (seen.has(d.key)) errors.push(`references.json has duplicate key "${d.key}"`);
      seen.add(d.key);
    }
  });
  return { docs: errors.length === 0 ? (raw.documents as ReferenceDoc[]) : null, errors };
}

export function checkAcs(raw: unknown, docs: ReferenceDoc[] | null): { acs: AcsData | null; errors: string[] } {
  const errors: string[] = [];
  if (!isObj(raw) || !Array.isArray(raw.elements) || !Array.isArray(raw.areas)) {
    return { acs: null, errors: ['ACS file must be an object with "areas" and "elements" lists'] };
  }
  const codes = new Set<string>();
  raw.elements.forEach((e: unknown, i: number) => {
    if (!isObj(e) || !isNonEmptyString(e.code) || !isNonEmptyString(e.description)) {
      errors.push(`ACS elements[${i}] must have a non-empty code and description`);
      return;
    }
    if (!ACS_CODE_RE.test(e.code)) errors.push(`ACS code "${e.code}" does not match the code pattern`);
    if (codes.has(e.code)) errors.push(`ACS code "${e.code}" appears more than once`);
    codes.add(e.code);
  });
  if (raw.elements.length !== ACS_ELEMENT_COUNT) {
    errors.push(`ACS file has ${raw.elements.length} elements; expected ${ACS_ELEMENT_COUNT}`);
  }
  const acsRef = docs?.find((d) => d.key === 'acs-10b');
  if (docs !== null) {
    if (acsRef === undefined) errors.push('references.json has no acs-10b entry');
    else if (raw.source_sha256 !== acsRef.sha256) {
      errors.push('ACS file source_sha256 does not match the acs-10b sha256 in references.json');
    }
  }
  return { acs: errors.length === 0 ? (raw as unknown as AcsData) : null, errors };
}

const HEX64_RE = /^[0-9a-f]{64}$/;

// Exact key sets for figures/index.json, in the order the extractor writes them.
const FIGURE_INDEX_KEYS = ['source_doc', 'source_sha256', 'extracted_with', 'items'];
const FIGURE_ITEM_KEYS = ['key', 'type', 'number', 'page', 'printed_page', 'rotate', 'body_px', 'caption_px', 'files'];
const FIGURE_EXTRACTION_KEYS = [
  'poppler', 'sharp', 'libvips', 'dpi', 'ink_threshold', 'erase_pad_pt', 'margin_px', 'pad_px', 'png', 'webp',
];
const FIGURE_PNG_SETTING_KEYS = ['compression_level'];
const FIGURE_WEBP_SETTING_KEYS = ['quality', 'effort', 'smart_subsample', 'lossless_for_grayscale'];

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function sameKeys(obj: Record<string, unknown>, keys: string[]): boolean {
  const have = Object.keys(obj);
  return have.length === keys.length && keys.every((k) => Object.hasOwn(obj, k));
}

function isPixelRect(v: unknown): v is PixelRect {
  return Array.isArray(v) && v.length === 4 && v.every(isNonNegativeInt) && v[2] >= 1 && v[3] >= 1;
}

function checkFigureExtraction(ex: Record<string, unknown>, errors: string[]): void {
  const where = 'figures/index.json extracted_with';
  if (!sameKeys(ex, FIGURE_EXTRACTION_KEYS)) {
    errors.push(`${where} must have exactly the keys ${FIGURE_EXTRACTION_KEYS.join(', ')}`);
  }
  for (const k of ['poppler', 'sharp', 'libvips']) {
    if (!isNonEmptyString(ex[k])) errors.push(`${where}.${k} must be a non-empty string`);
  }
  if (!isPositiveInt(ex.dpi)) errors.push(`${where}.dpi must be a positive integer`);
  for (const k of ['ink_threshold', 'margin_px', 'pad_px']) {
    if (!isNonNegativeInt(ex[k])) errors.push(`${where}.${k} must be a non-negative integer`);
  }
  if (typeof ex.erase_pad_pt !== 'number' || !Number.isFinite(ex.erase_pad_pt) || ex.erase_pad_pt < 0) {
    errors.push(`${where}.erase_pad_pt must be a finite number >= 0`);
  }
  if (!isObj(ex.png) || !sameKeys(ex.png, FIGURE_PNG_SETTING_KEYS)) {
    errors.push(`${where}.png must have exactly the keys ${FIGURE_PNG_SETTING_KEYS.join(', ')}`);
  } else if (typeof ex.png.compression_level !== 'number') {
    errors.push(`${where}.png.compression_level must be a number`);
  }
  if (!isObj(ex.webp) || !sameKeys(ex.webp, FIGURE_WEBP_SETTING_KEYS)) {
    errors.push(`${where}.webp must have exactly the keys ${FIGURE_WEBP_SETTING_KEYS.join(', ')}`);
  } else {
    for (const k of ['quality', 'effort']) {
      if (typeof ex.webp[k] !== 'number') errors.push(`${where}.webp.${k} must be a number`);
    }
    for (const k of ['smart_subsample', 'lossless_for_grayscale']) {
      if (typeof ex.webp[k] !== 'boolean') errors.push(`${where}.webp.${k} must be a boolean`);
    }
  }
}

function checkFigureFile(f: unknown, where: string, expectedName: string, isWebp: boolean, errors: string[]): void {
  if (!isObj(f)) {
    errors.push(`${where} must be an object`);
    return;
  }
  if (f.name !== expectedName) errors.push(`${where}.name must be "${expectedName}"`);
  for (const k of ['width', 'height', 'bytes']) {
    if (!isPositiveInt(f[k])) errors.push(`${where}.${k} must be a positive integer`);
  }
  if (typeof f.sha256 !== 'string' || !HEX64_RE.test(f.sha256)) {
    errors.push(`${where}.sha256 must be 64 lowercase hex characters`);
  }
  if (isWebp && typeof f.lossless !== 'boolean') errors.push(`${where}.lossless must be a boolean`);
}

export function checkFigureIndex(raw: unknown, docs: ReferenceDoc[] | null): { index: FigureIndex | null; errors: string[] } {
  const errors: string[] = [];
  if (!isObj(raw) || !isNonEmptyString(raw.source_doc) || !Array.isArray(raw.items)) {
    return { index: null, errors: ['figures/index.json must have "source_doc" and an "items" list'] };
  }
  for (const k of Object.keys(raw)) {
    if (!FIGURE_INDEX_KEYS.includes(k)) errors.push(`figures/index.json has unknown top-level key "${k}"`);
  }
  if (typeof raw.source_sha256 !== 'string' || !HEX64_RE.test(raw.source_sha256)) {
    errors.push('figures/index.json source_sha256 must be 64 lowercase hex characters');
  }
  const ex = raw.extracted_with;
  if (ex === null) {
    if (raw.items.length > 0) errors.push('figures/index.json extracted_with must not be null while items is not empty');
  } else if (isObj(ex)) {
    if (raw.items.length === 0) errors.push('figures/index.json extracted_with must be null while items is empty');
    checkFigureExtraction(ex, errors);
  } else {
    errors.push('figures/index.json extracted_with must be null or an object');
  }

  const seen = new Set<string>();
  raw.items.forEach((it: unknown, i: number) => {
    const where = `figures/index.json items[${i}]`;
    if (!isObj(it)) {
      errors.push(`${where} must be an object`);
      return;
    }
    for (const k of Object.keys(it)) {
      if (!FIGURE_ITEM_KEYS.includes(k)) errors.push(`${where} has unknown key "${k}"`);
    }
    const { key, type, number, page, printed_page, rotate, body_px, caption_px, files } = it as Record<string, unknown>;
    if (type !== 'figure' && type !== 'legend') errors.push(`${where}.type must be "figure" or "legend"`);
    if (!isPositiveInt(number)) errors.push(`${where}.number must be a positive integer`);
    if (!isPositiveInt(page)) errors.push(`${where}.page must be a positive integer`);
    if (typeof printed_page !== 'string' || !/^[12]-\d+$/.test(printed_page)) {
      errors.push(`${where}.printed_page must look like 1-N or 2-N`);
    } else if (type === 'figure' || type === 'legend') {
      const digit = type === 'legend' ? '1' : '2';
      if (printed_page[0] !== digit) {
        errors.push(`${where}.printed_page "${printed_page}" must start with ${digit}- for a ${type}`);
      }
    }
    if (rotate !== 0 && rotate !== 90 && rotate !== 180 && rotate !== 270) {
      errors.push(`${where}.rotate must be 0, 90, 180 or 270`);
    }
    const bodyOk = isPixelRect(body_px);
    const captionOk = isPixelRect(caption_px);
    if (!bodyOk) errors.push(`${where}.body_px must be 4 non-negative integers with a width and height of at least 1`);
    if (!captionOk) errors.push(`${where}.caption_px must be 4 non-negative integers with a width and height of at least 1`);
    if (bodyOk && captionOk && rotate !== 0 && body_px[1] + body_px[3] > caption_px[1]) {
      errors.push(`${where}: body_px must end above caption_px when rotate is not 0`);
    }
    if (!isNonEmptyString(key)) {
      errors.push(`${where}.key must be a non-empty string`);
      return;
    }
    if (!isObj(files) || !sameKeys(files, ['png', 'webp'])) {
      errors.push(`${where}.files must have exactly the keys png and webp`);
    } else {
      checkFigureFile(files.png, `${where}.files.png`, `${key}.png`, false, errors);
      checkFigureFile(files.webp, `${where}.files.webp`, `${key}.webp`, true, errors);
      const p = files.png as Record<string, unknown> | undefined;
      const w = files.webp as Record<string, unknown> | undefined;
      if (isObj(p) && isObj(w) && (p.width !== w.width || p.height !== w.height)) {
        errors.push(`${where}: the PNG and WebP sizes differ (${p.width}x${p.height} vs ${w.width}x${w.height})`);
      }
    }
    const expectedKey = `${type === 'legend' ? 'legend' : 'fig'}-${number}`;
    if (key !== expectedKey) errors.push(`${where}.key "${key}" should be "${expectedKey}" for its type and number`);
    if (seen.has(key)) errors.push(`figures/index.json has duplicate key "${key}"`);
    seen.add(key);
  });

  const ref = docs?.find((d) => d.key === raw.source_doc);
  if (ref !== undefined && raw.source_sha256 !== ref.sha256) {
    errors.push(`figures/index.json source_sha256 does not match the ${raw.source_doc} sha256 in references.json`);
  }
  return { index: errors.length === 0 ? (raw as unknown as FigureIndex) : null, errors };
}
