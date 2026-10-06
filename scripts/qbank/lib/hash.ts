// The single implementation of a question's content_hash.
// The future database loader must import computeContentHash from here, not re-implement it.
//
// Algorithm (docs/QUESTION_FORMAT.md, "content_hash"):
//   a. The text must not start with a byte order mark.
//   b. Convert CRLF and lone CR to LF.
//   c. Remove the line "review:" and every line after it, up to but not including
//      the closing "---" of the front matter.
//   d. Strip trailing spaces and tabs from every line.
//   e. Remove trailing empty lines and end with exactly one LF.
//   f. SHA-256 of the UTF-8 bytes, as lowercase hex.

import { createHash } from 'node:crypto';

export class HashInputError extends Error {}

const DELIMITER = /^---[ \t]*$/;
export const REVIEW_LINE = /^review:[ \t]*$/;

export function hasBom(text: string): boolean {
  return text.charCodeAt(0) === 0xfeff;
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export interface FrontMatterSplit {
  lines: string[]; // all lines of the LF-normalized text
  closeIndex: number; // index of the closing "---" line
}

// Locates the front matter. Line 1 must be "---"; the front matter ends at the next "---" line.
// Returns null when either delimiter is missing.
export function splitFrontMatter(normalized: string): FrontMatterSplit | null {
  const lines = normalized.split('\n');
  if (lines.length === 0 || !DELIMITER.test(lines[0])) return null;
  for (let i = 1; i < lines.length; i++) {
    if (DELIMITER.test(lines[i])) return { lines, closeIndex: i };
  }
  return null;
}

// Returns the exact text that is hashed (steps a to e).
export function hashableText(text: string): string {
  if (hasBom(text)) throw new HashInputError('file starts with a byte order mark (BOM)');
  const normalized = normalizeLineEndings(text);
  const split = splitFrontMatter(normalized);
  if (split === null) throw new HashInputError('front matter is missing or not closed with ---');
  const { lines, closeIndex } = split;
  let reviewIndex = -1;
  for (let i = 1; i < closeIndex; i++) {
    if (REVIEW_LINE.test(lines[i])) {
      reviewIndex = i;
      break;
    }
  }
  if (reviewIndex === -1) throw new HashInputError('front matter has no "review:" line');
  const kept = [...lines.slice(0, reviewIndex), ...lines.slice(closeIndex)];
  const stripped = kept.map((line) => line.replace(/[ \t]+$/, ''));
  while (stripped.length > 0 && stripped[stripped.length - 1] === '') stripped.pop();
  return stripped.join('\n') + '\n';
}

export function computeContentHash(text: string): string {
  return createHash('sha256').update(hashableText(text), 'utf8').digest('hex');
}

// Decodes file bytes as strict UTF-8. Throws on invalid UTF-8.
export function decodeUtf8(bytes: Uint8Array): string {
  // ignoreBOM: true keeps a BOM in the string so callers can detect and reject it.
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}
