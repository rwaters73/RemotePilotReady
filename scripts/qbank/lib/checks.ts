// Registry of validator checks. Each check has a stable ID, used in output and in the tests.
// validate.ts runs every check listed in CHECKS, in order; removing a check from CHECKS
// turns it off (the mutation proof in the tests relies on this).
//
// Gating is decided by validate.ts, not by this registry: a file that fails to parse gets no
// further checks, and a file whose front matter fails the schema gets only the body check.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkBody } from './body.ts';
import { computeContentHash, HashInputError } from './hash.ts';
import { areaOfCode, FIGURE_KEY_RE } from './data.ts';
import type { ParseResult } from './parse.ts';
import type { SchemaResult } from './schema.ts';
import { REVIEWERS, STATUSES } from './types.ts';
import type { AcsData, FigureIndex, Issue, Question, ReferenceDoc, Severity } from './types.ts';

export interface BankContext {
  questionsDir: string;
  figuresDir: string;
  label: (path: string) => string; // display path for messages
  entries: string[]; // every name in questionsDir
  questionFiles: string[]; // names matching RPR-NNNN.md
  dataErrors: { file: string; message: string }[];
  refs: ReferenceDoc[] | null;
  acs: AcsData | null;
  figureIndex: FigureIndex | null;
}

export interface FileContext {
  bank: BankContext;
  name: string; // file name, e.g. RPR-0001.md
  label: string; // display path
  text: string | null; // null when the file is not valid UTF-8
  readError: string | null;
  parse: ParseResult | null;
  schema: SchemaResult | null;
  question: Question | null;
}

export type CheckDef =
  | { id: string; level: 'bank'; run: (bank: BankContext) => Issue[] }
  | { id: string; level: 'file'; needs: 'text' | 'parsed' | 'question'; run: (f: FileContext) => Issue[] };

// RPR-0001 to RPR-9999; RPR-0000 is not a valid ID.
const QUESTION_FILE_RE = /^RPR-(?!0000)(\d{4})\.md$/;
export const IGNORED_FILES = ['.gitkeep'];

export function isQuestionFileName(name: string): boolean {
  return QUESTION_FILE_RE.test(name);
}

function issue(file: string, check: string, message: string, severity: Severity = 'error'): Issue {
  return { file, check, severity, message };
}

// Option text that refers to other options. These break when options are shuffled.
// An exact phrase list, case-insensitive (docs/QUESTION_FORMAT.md section 4). Any other
// reference to another option is a q-reviewer check, not a validator check.
const OPTION_TEXT_PATTERNS: RegExp[] = [
  /\ball of the above\b/i,
  /\bnone of the above\b/i,
  /\bboth of the above\b/i,
  /\bneither of the above\b/i,
  /\ball of these\b/i,
  /\bnone of these\b/i,
  /\bboth\s+[abc]\s+and\s+[abc]\b/i,
  /\bneither\s+[abc]\s+nor\s+[abc]\b/i,
];

function validDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

export const CHECKS: CheckDef[] = [
  {
    id: 'data',
    level: 'bank',
    run: (b) => b.dataErrors.map((e) => issue(e.file, 'data', e.message)),
  },
  {
    id: 'file-name',
    level: 'bank',
    run: (b) =>
      b.entries
        .filter((n) => !IGNORED_FILES.includes(n) && !isQuestionFileName(n))
        .map((n) => issue(b.label(join(b.questionsDir, n)), 'file-name', 'not a question file name; expected RPR-NNNN.md')),
  },
  {
    id: 'parse',
    level: 'file',
    needs: 'text',
    run: (f) => {
      if (f.readError !== null) return [issue(f.label, 'parse', f.readError)];
      if (f.parse !== null && !f.parse.ok) return f.parse.errors.map((m) => issue(f.label, 'parse', m));
      return [];
    },
  },
  {
    id: 'schema',
    level: 'file',
    needs: 'parsed',
    run: (f) => (f.schema !== null && !f.schema.ok ? f.schema.errors.map((m) => issue(f.label, 'schema', m)) : []),
  },
  {
    id: 'body',
    level: 'file',
    needs: 'parsed',
    run: (f) => (f.parse?.ok ? checkBody(f.parse.parsed.bodyLines).map((m) => issue(f.label, 'body', m)) : []),
  },
  {
    id: 'id-match',
    level: 'file',
    needs: 'question',
    run: (f) => {
      const stem = f.name.replace(/\.md$/, '');
      return f.question!.id === stem ? [] : [issue(f.label, 'id-match', `id ${f.question!.id} does not match the file name ${f.name}`)];
    },
  },
  {
    id: 'id-sequence',
    level: 'bank',
    run: (b) => {
      const nums = b.questionFiles.map((n) => Number(QUESTION_FILE_RE.exec(n)![1]));
      if (nums.length === 0) return [];
      const have = new Set(nums);
      const max = Math.max(...nums);
      const missing: string[] = [];
      for (let i = 1; i <= max; i++) if (!have.has(i)) missing.push(`RPR-${String(i).padStart(4, '0')}`);
      if (missing.length === 0) return [];
      return [
        issue(
          b.label(b.questionsDir),
          'id-sequence',
          `IDs missing between RPR-0001 and the highest ID: ${missing.join(', ')}. Question files are never deleted; retire them instead.`,
        ),
      ];
    },
  },
  {
    id: 'acs-code',
    level: 'file',
    needs: 'question',
    run: (f) => {
      const acs = f.bank.acs;
      if (acs === null) return [];
      const code = f.question!.acs_code;
      return acs.elements.some((e) => e.code === code)
        ? []
        : [issue(f.label, 'acs-code', `acs_code ${code} is not a knowledge element in data/acs-10b-knowledge.json`)];
    },
  },
  {
    id: 'source-doc',
    level: 'file',
    needs: 'question',
    run: (f) => {
      const refs = f.bank.refs;
      if (refs === null) return [];
      return f.question!.sources
        .filter((s) => !refs.some((d) => d.key === s.doc))
        .map((s) => issue(f.label, 'source-doc', `source doc "${s.doc}" is not a key in data/references.json`));
    },
  },
  {
    id: 'source-edition',
    level: 'file',
    needs: 'question',
    run: (f) => {
      const refs = f.bank.refs;
      if (refs === null) return [];
      const q = f.question!;
      const st = q.review.status;
      // Warning for content that was approved (approved, retired, held with a hash); error otherwise.
      const wasApproved = st === 'approved' || ((st === 'retired' || st === 'held') && q.review.content_hash !== null);
      const severity: Severity = wasApproved ? 'warning' : 'error';
      const out: Issue[] = [];
      for (const s of q.sources) {
        const ref = refs.find((d) => d.key === s.doc);
        if (ref === undefined) continue; // reported by source-doc
        if (s.edition !== ref.edition) {
          const msg = `source ${s.doc} edition "${s.edition}" does not match references.json "${ref.edition}"`;
          out.push(issue(f.label, 'source-edition', wasApproved ? `${msg}; needs recheck` : msg, severity));
        }
      }
      return out;
    },
  },
  {
    id: 'area-i-cfr',
    level: 'file',
    needs: 'question',
    run: (f) => {
      const { acs, refs } = f.bank;
      if (acs === null || refs === null) return [];
      const q = f.question!;
      if (!acs.elements.some((e) => e.code === q.acs_code)) return []; // reported by acs-code
      if (areaOfCode(q.acs_code) !== 'I') return [];
      const hasCfr = q.sources.some((s) => refs.find((d) => d.key === s.doc)?.kind === 'cfr');
      return hasCfr
        ? []
        : [issue(f.label, 'area-i-cfr', 'Area I question needs at least one source whose document kind is "cfr" in data/references.json')];
    },
  },
  {
    id: 'figure',
    level: 'file',
    needs: 'question',
    run: (f) => {
      const index = f.bank.figureIndex;
      const out: Issue[] = [];
      const seen = new Set<string>();
      for (const key of f.question!.figures) {
        if (!FIGURE_KEY_RE.test(key)) {
          out.push(issue(f.label, 'figure', `figure key "${key}" is malformed; use fig-N or legend-N`));
          continue;
        }
        if (seen.has(key)) {
          out.push(issue(f.label, 'figure', `figure key "${key}" is listed more than once`));
          continue;
        }
        seen.add(key);
        if (index === null) continue; // index problems are reported by data
        const item = index.items.find((it) => it.key === key);
        if (item === undefined) {
          out.push(issue(f.label, 'figure', `figure key "${key}" is not in figures/index.json`));
        } else if (!existsSync(join(f.bank.figuresDir, item.file))) {
          out.push(issue(f.label, 'figure', `figure key "${key}" points to ${item.file}, which is missing from figures/`));
        }
      }
      return out;
    },
  },
  {
    id: 'status',
    level: 'file',
    needs: 'question',
    run: (f) => {
      const r = f.question!.review;
      const out: string[] = [];
      if (!(STATUSES as readonly string[]).includes(r.status)) {
        out.push(`review.status "${r.status}" is not one of ${STATUSES.join(', ')}`);
      }
      if (r.reviewed_by !== null && !(REVIEWERS as readonly string[]).includes(r.reviewed_by)) {
        out.push(`review.reviewed_by "${r.reviewed_by}" must be ${REVIEWERS.join(' or ')}`);
      }
      if (r.status === 'approved' && r.reviewed_by !== null && r.reviewed_by !== 'q-reviewer') {
        out.push(`review.reviewed_by must be q-reviewer when status is approved (found "${r.reviewed_by}")`);
      }
      if (r.reviewed_at !== null && !validDate(r.reviewed_at)) {
        out.push(`review.reviewed_at "${r.reviewed_at}" must be a real date written YYYY-MM-DD`);
      }
      if (r.notes !== null && r.notes.trim() === '') out.push('review.notes must be null or non-empty text');
      if (r.status === 'approved' || r.status === 'returned' || r.status === 'held') {
        if (r.reviewed_by === null) out.push(`review.reviewed_by is required when status is ${r.status}`);
        if (r.reviewed_at === null) out.push(`review.reviewed_at is required when status is ${r.status}`);
      }
      if ((r.status === 'returned' || r.status === 'held') && (r.notes === null || r.notes.trim() === '')) {
        out.push(`review.notes must explain why when status is ${r.status}`);
      }
      return [...new Set(out)].map((m) => issue(f.label, 'status', m));
    },
  },
  {
    id: 'content-hash',
    level: 'file',
    needs: 'question',
    run: (f) => {
      const { status, content_hash: stored } = f.question!.review;
      const nullOnly = status === 'draft' || status === 'returned';
      const required = status === 'approved';
      const optional = status === 'held' || status === 'retired';
      if (!nullOnly && !required && !optional) return []; // unknown status is reported by status
      if (nullOnly) {
        return stored === null ? [] : [issue(f.label, 'content-hash', `content_hash must be null when status is ${status}`)];
      }
      if (stored === null) {
        return required ? [issue(f.label, 'content-hash', 'content_hash is required when status is approved')] : [];
      }
      let actual: string;
      try {
        actual = computeContentHash(f.text!);
      } catch (e) {
        if (e instanceof HashInputError) return [issue(f.label, 'content-hash', `cannot compute hash: ${e.message}`)];
        throw e;
      }
      return stored === actual
        ? []
        : [issue(f.label, 'content-hash', `content_hash does not match the file content (stored ${stored}, computed ${actual})`)];
    },
  },
  {
    id: 'option-text',
    level: 'file',
    needs: 'question',
    run: (f) => {
      const out: Issue[] = [];
      for (const [key, text] of Object.entries(f.question!.options)) {
        if (OPTION_TEXT_PATTERNS.some((re) => re.test(text))) {
          out.push(issue(f.label, 'option-text', `option ${key} refers to other options ("${text}"); options are shuffled, so each must stand alone`));
        }
      }
      return out;
    },
  },
];

export function checkIds(): string[] {
  return CHECKS.map((c) => c.id);
}
