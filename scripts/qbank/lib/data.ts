// Loads and checks the bank's data files: data/references.json, data/acs-10b-knowledge.json,
// and figures/index.json. Problems found here are reported under the "data" check.
// These functions are pure apart from reading the named files, so tests can feed them bad data.

import { readFileSync } from 'node:fs';
import type { AcsData, FigureIndex, FigureItem, ReferenceDoc } from './types.ts';

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

export function checkFigureIndex(raw: unknown): { index: FigureIndex | null; errors: string[] } {
  const errors: string[] = [];
  if (!isObj(raw) || !isNonEmptyString(raw.source_doc) || !Array.isArray(raw.items)) {
    return { index: null, errors: ['figures/index.json must have "source_doc" and an "items" list'] };
  }
  const seen = new Set<string>();
  raw.items.forEach((it: unknown, i: number) => {
    const where = `figures/index.json items[${i}]`;
    if (!isObj(it)) {
      errors.push(`${where} must be an object`);
      return;
    }
    const { key, type, number, file } = it as Partial<FigureItem>;
    if (type !== 'figure' && type !== 'legend') errors.push(`${where}.type must be "figure" or "legend"`);
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) {
      errors.push(`${where}.number must be a positive integer`);
    }
    if (!isNonEmptyString(file) || /[\\/]/.test(file) || file.startsWith('.')) {
      errors.push(`${where}.file must be a plain file name in figures/`);
    }
    if (!isNonEmptyString(key)) {
      errors.push(`${where}.key must be a non-empty string`);
      return;
    }
    const expectedKey = `${type === 'legend' ? 'legend' : 'fig'}-${number}`;
    if (key !== expectedKey) errors.push(`${where}.key "${key}" should be "${expectedKey}" for its type and number`);
    if (seen.has(key)) errors.push(`figures/index.json has duplicate key "${key}"`);
    seen.add(key);
  });
  return { index: errors.length === 0 ? (raw as unknown as FigureIndex) : null, errors };
}
