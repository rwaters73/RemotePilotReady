// Splits a question file into front matter and body, and parses the front matter as YAML.
// Problems found here are reported under the "parse" check.

import { CST, Lexer, parseDocument } from 'yaml';
import type { Document } from 'yaml';
import { hasBom, normalizeLineEndings, splitFrontMatter } from './hash.ts';

export interface ParsedFile {
  normalized: string; // LF-normalized file text
  frontMatterLines: string[]; // lines between the two "---" delimiters
  bodyLines: string[]; // lines after the closing "---"
  doc: Document.Parsed;
}

export type ParseResult = { ok: true; parsed: ParsedFile } | { ok: false; errors: string[] };

export function parseQuestionText(text: string): ParseResult {
  if (hasBom(text)) return { ok: false, errors: ['file starts with a byte order mark (BOM); save it as UTF-8 without BOM'] };
  const normalized = normalizeLineEndings(text);
  const split = splitFrontMatter(normalized);
  if (split === null) {
    return { ok: false, errors: ['front matter is missing or not closed: line 1 must be --- and the front matter must end with a --- line'] };
  }
  const frontMatterLines = split.lines.slice(1, split.closeIndex);
  const bodyLines = split.lines.slice(split.closeIndex + 1);
  const yamlText = frontMatterLines.join('\n') + '\n';

  const errors: string[] = [];
  frontMatterLines.forEach((line, i) => {
    // i + 2: file line number (line 1 is the opening ---).
    if (line.includes('<!--')) errors.push(`line ${i + 2}: HTML comments ("<!--") are not allowed in the front matter`);
  });
  for (const token of new Lexer().lex(yamlText)) {
    if (CST.tokenType(token) === 'comment') errors.push(`YAML comments are not allowed: ${token.trim()}`);
  }

  const doc = parseDocument(yamlText, { uniqueKeys: true, prettyErrors: false });
  for (const e of doc.errors) errors.push(`invalid YAML: ${e.message}`);
  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, parsed: { normalized, frontMatterLines, bodyLines, doc } };
}
