// Turns parsed front matter into a typed Question, or reports why it can't.
// Problems found here are reported under the "schema" check.

import { isMap, isScalar, isSeq, Scalar } from 'yaml';
import type { Node, YAMLMap } from 'yaml';
import { REVIEW_LINE } from './hash.ts';
import type { ParsedFile } from './parse.ts';
import type { Question, Review, Source } from './types.ts';

export const TOP_KEYS = ['id', 'acs_code', 'figures', 'options', 'answer', 'sources', 'review'] as const;
export const OPTION_KEYS = ['A', 'B', 'C'] as const;
export const SOURCE_KEYS = ['doc', 'edition', 'location', 'passage'] as const;
export const REVIEW_KEYS = ['status', 'reviewed_by', 'reviewed_at', 'content_hash', 'notes'] as const;

export type SchemaResult = { ok: true; question: Question } | { ok: false; errors: string[] };

function keyName(node: unknown): string | null {
  if (isScalar(node) && typeof node.value === 'string') return node.value;
  return null;
}

// Returns the map's keys in order, or null if any key is not a string.
function mapKeys(map: YAMLMap): string[] | null {
  const keys: string[] = [];
  for (const pair of map.items) {
    const k = keyName(pair.key);
    if (k === null) return null;
    keys.push(k);
  }
  return keys;
}

function getNode(map: YAMLMap, key: string): Node | null {
  for (const pair of map.items) {
    if (keyName(pair.key) === key) return (pair.value as Node | null) ?? null;
  }
  return null;
}

function checkKeySet(where: string, keys: string[], expected: readonly string[], errors: string[]): void {
  for (const k of keys) if (!expected.includes(k)) errors.push(`${where}: unknown key "${k}"`);
  for (const k of expected) if (!keys.includes(k)) errors.push(`${where}: missing key "${k}"`);
}

function nonEmptyString(node: Node | null): string | null {
  if (isScalar(node) && typeof node.value === 'string' && node.value.trim() !== '') return node.value;
  return null;
}

function nullableString(node: Node | null): { ok: boolean; value: string | null } {
  if (node === null) return { ok: true, value: null };
  if (isScalar(node) && node.value === null) return { ok: true, value: null };
  if (isScalar(node) && typeof node.value === 'string') return { ok: true, value: node.value };
  return { ok: false, value: null };
}

function isQuoted(node: Node | null, doubleOnly: boolean): boolean {
  if (!isScalar(node)) return false;
  if (node.type === Scalar.QUOTE_DOUBLE) return true;
  return !doubleOnly && node.type === Scalar.QUOTE_SINGLE;
}

export function checkSchema(parsed: ParsedFile): SchemaResult {
  const errors: string[] = [];
  const root = parsed.doc.contents;
  if (!isMap(root) || root.flow) {
    return { ok: false, errors: ['front matter must be a block-style YAML mapping'] };
  }
  const keys = mapKeys(root);
  if (keys === null) return { ok: false, errors: ['front matter keys must be plain strings'] };
  checkKeySet('front matter', keys, TOP_KEYS, errors);
  const known = keys.filter((k) => (TOP_KEYS as readonly string[]).includes(k));
  const expectedOrder = TOP_KEYS.filter((k) => known.includes(k));
  if (known.join(',') !== expectedOrder.join(',')) {
    errors.push(`front matter keys are out of order; required order is ${TOP_KEYS.join(', ')}`);
  }
  if (errors.length > 0) return { ok: false, errors };

  // id
  const id = nonEmptyString(getNode(root, 'id'));
  if (id === null || !/^RPR-\d{4}$/.test(id)) errors.push('id must be a string like RPR-0001');

  // acs_code
  const acsCode = nonEmptyString(getNode(root, 'acs_code'));
  if (acsCode === null) errors.push('acs_code must be a non-empty string');

  // figures
  const figuresNode = getNode(root, 'figures');
  const figures: string[] = [];
  if (!isSeq(figuresNode)) {
    errors.push('figures must be a list (use [] when the question has no figure)');
  } else {
    for (const item of figuresNode.items) {
      const s = nonEmptyString(item as Node);
      if (s === null) errors.push('figures entries must be non-empty strings such as "fig-26" or "legend-1"');
      else figures.push(s);
    }
  }

  // options
  const optionsNode = getNode(root, 'options');
  const options: Record<string, string> = {};
  if (!isMap(optionsNode) || optionsNode.flow) {
    errors.push('options must be a block-style mapping with keys A, B, C');
  } else {
    const optKeys = mapKeys(optionsNode);
    if (optKeys === null || optKeys.join(',') !== OPTION_KEYS.join(',')) {
      errors.push(`options must have exactly the keys A, B, C, in that order (found: ${optKeys?.join(', ') ?? 'non-string keys'})`);
    } else {
      for (const k of OPTION_KEYS) {
        const node = getNode(optionsNode, k);
        const s = nonEmptyString(node);
        if (s === null || !isQuoted(node, true)) errors.push(`option ${k} must be a non-empty double-quoted string`);
        else options[k] = s;
      }
      const seen = new Map<string, string>();
      for (const [k, v] of Object.entries(options)) {
        const norm = v.toLowerCase().replace(/\s+/g, '');
        const prior = seen.get(norm);
        if (prior !== undefined) errors.push(`options ${prior} and ${k} are the same text`);
        else seen.set(norm, k);
      }
    }
  }

  // answer
  const answer = nonEmptyString(getNode(root, 'answer'));
  if (answer === null || !(OPTION_KEYS as readonly string[]).includes(answer)) errors.push('answer must be A, B, or C');

  // sources
  const sourcesNode = getNode(root, 'sources');
  const sources: Source[] = [];
  if (!isSeq(sourcesNode) || sourcesNode.items.length === 0) {
    errors.push('sources must be a list with at least one entry');
  } else {
    sourcesNode.items.forEach((item, i) => {
      const where = `sources[${i}]`;
      if (!isMap(item)) {
        errors.push(`${where} must be a mapping with doc, edition, location, passage`);
        return;
      }
      const sk = mapKeys(item);
      if (sk === null) {
        errors.push(`${where}: keys must be plain strings`);
        return;
      }
      const before = errors.length;
      checkKeySet(where, sk, SOURCE_KEYS, errors);
      if (errors.length > before) return;
      const entry: Record<string, string> = {};
      for (const k of SOURCE_KEYS) {
        const node = getNode(item, k);
        const s = nonEmptyString(node);
        if (k === 'doc') {
          if (s === null) errors.push(`${where}.${k} must be a non-empty string`);
          else entry[k] = s;
        } else if (s === null || !isQuoted(node, true)) {
          errors.push(`${where}.${k} must be a non-empty double-quoted string`);
        } else {
          entry[k] = s;
        }
      }
      if (Object.keys(entry).length === SOURCE_KEYS.length) sources.push(entry as unknown as Source);
    });
  }

  // review
  const reviewNode = getNode(root, 'review');
  let review: Review | null = null;
  if (!isMap(reviewNode) || reviewNode.flow) {
    errors.push('review must be a block-style mapping (not {...}) and the last key');
  } else {
    const rk = mapKeys(reviewNode);
    const before = errors.length;
    if (rk === null) errors.push('review: keys must be plain strings');
    else checkKeySet('review', rk, REVIEW_KEYS, errors);
    if (errors.length === before) {
      const status = nonEmptyString(getNode(reviewNode, 'status'));
      if (status === null) errors.push('review.status must be a non-empty string');
      const fields: Record<string, string | null> = {};
      for (const k of ['reviewed_by', 'reviewed_at', 'content_hash', 'notes'] as const) {
        const r = nullableString(getNode(reviewNode, k));
        if (!r.ok) errors.push(`review.${k} must be a string or null`);
        fields[k] = r.value;
      }
      const reviewedAtNode = getNode(reviewNode, 'reviewed_at');
      if (fields.reviewed_at !== null && !isQuoted(reviewedAtNode, false)) {
        errors.push('review.reviewed_at must be quoted, for example "2026-10-07"');
      }
      if (status !== null) {
        review = {
          status,
          reviewed_by: fields.reviewed_by,
          reviewed_at: fields.reviewed_at,
          content_hash: fields.content_hash,
          notes: fields.notes,
        };
      }
    }
  }

  // The content hash removes the review block by line position, so the text layout must be exact:
  // one unindented "review:" line, and only indented or blank lines after it.
  const fm = parsed.frontMatterLines;
  const reviewLines = fm.map((l, i) => (REVIEW_LINE.test(l) ? i : -1)).filter((i) => i >= 0);
  if (reviewLines.length !== 1) {
    errors.push('front matter must contain exactly one line "review:" with nothing after the colon');
  } else {
    for (const line of fm.slice(reviewLines[0] + 1)) {
      if (line.trim() !== '' && !/^[ ]/.test(line)) {
        errors.push('every line after "review:" in the front matter must be an indented review field');
        break;
      }
    }
  }

  if (errors.length > 0 || review === null || id === null || acsCode === null || answer === null) {
    return { ok: false, errors: errors.length > 0 ? errors : ['front matter is incomplete'] };
  }
  return {
    ok: true,
    question: {
      id,
      acs_code: acsCode,
      figures,
      options: options as Question['options'],
      answer: answer as Question['answer'],
      sources,
      review,
    },
  };
}
