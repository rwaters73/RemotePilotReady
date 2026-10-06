// validateBank: a pure function over the given folders and data files. It reads files and
// returns issues; it never writes anything.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKS, isQuestionFileName } from './checks.ts';
import type { BankContext, FileContext } from './checks.ts';
import { checkAcs, checkFigureIndex, checkReferences, readJson } from './data.ts';
import { decodeUtf8 } from './hash.ts';
import { parseQuestionText } from './parse.ts';
import { checkSchema } from './schema.ts';
import type { Issue } from './types.ts';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export interface BankPaths {
  questionsDir: string;
  figuresDir: string;
  referencesPath: string;
  acsPath: string;
}

export function defaultPaths(): BankPaths {
  return {
    questionsDir: join(REPO_ROOT, 'questions'),
    figuresDir: join(REPO_ROOT, 'figures'),
    referencesPath: join(REPO_ROOT, 'data', 'references.json'),
    acsPath: join(REPO_ROOT, 'data', 'acs-10b-knowledge.json'),
  };
}

export interface BankResult {
  issues: Issue[];
  questionCount: number;
  statusCounts: Record<string, number>;
}

function label(path: string): string {
  const rel = relative(process.cwd(), path);
  return (rel === '' ? '.' : rel).split('\\').join('/');
}

function loadJson(path: string, errors: { file: string; message: string }[]): unknown {
  try {
    return readJson(path);
  } catch (e) {
    errors.push({ file: label(path), message: `cannot read JSON: ${(e as Error).message}` });
    return undefined;
  }
}

export function validateBankDetailed(paths: BankPaths): BankResult {
  const dataErrors: { file: string; message: string }[] = [];

  const refsRaw = loadJson(paths.referencesPath, dataErrors);
  const refsResult = refsRaw === undefined ? { docs: null, errors: [] } : checkReferences(refsRaw);
  for (const m of refsResult.errors) dataErrors.push({ file: label(paths.referencesPath), message: m });

  const acsRaw = loadJson(paths.acsPath, dataErrors);
  const acsResult = acsRaw === undefined ? { acs: null, errors: [] } : checkAcs(acsRaw, refsResult.docs);
  for (const m of acsResult.errors) dataErrors.push({ file: label(paths.acsPath), message: m });

  const indexPath = join(paths.figuresDir, 'index.json');
  const indexRaw = loadJson(indexPath, dataErrors);
  const indexResult = indexRaw === undefined ? { index: null, errors: [] } : checkFigureIndex(indexRaw);
  for (const m of indexResult.errors) dataErrors.push({ file: label(indexPath), message: m });
  if (indexResult.index !== null && refsResult.docs !== null && !refsResult.docs.some((d) => d.key === indexResult.index!.source_doc)) {
    dataErrors.push({ file: label(indexPath), message: `source_doc "${indexResult.index.source_doc}" is not a key in references.json` });
  }

  const entries = existsSync(paths.questionsDir) ? readdirSync(paths.questionsDir).sort() : [];
  if (!existsSync(paths.questionsDir)) {
    dataErrors.push({ file: label(paths.questionsDir), message: 'questions folder does not exist' });
  }
  const questionFiles = entries.filter(isQuestionFileName);

  const bank: BankContext = {
    questionsDir: paths.questionsDir,
    figuresDir: paths.figuresDir,
    label,
    entries,
    questionFiles,
    dataErrors,
    refs: refsResult.docs,
    acs: acsResult.acs,
    figureIndex: indexResult.index,
  };

  const files: FileContext[] = questionFiles.map((name) => {
    const full = join(paths.questionsDir, name);
    const ctx: FileContext = { bank, name, label: label(full), text: null, readError: null, parse: null, schema: null, question: null };
    try {
      ctx.text = decodeUtf8(readFileSync(full));
    } catch {
      ctx.readError = 'file is not valid UTF-8';
      return ctx;
    }
    ctx.parse = parseQuestionText(ctx.text);
    if (ctx.parse.ok) {
      ctx.schema = checkSchema(ctx.parse.parsed);
      if (ctx.schema.ok) ctx.question = ctx.schema.question;
    }
    return ctx;
  });

  const issues: Issue[] = [];
  for (const check of CHECKS) {
    if (check.level === 'bank') {
      issues.push(...check.run(bank));
      continue;
    }
    for (const f of files) {
      if (check.needs === 'parsed' && !f.parse?.ok) continue;
      if (check.needs === 'question' && f.question === null) continue;
      issues.push(...check.run(f));
    }
  }

  const statusCounts: Record<string, number> = {};
  for (const f of files) {
    const st = f.question?.review.status ?? 'unreadable';
    statusCounts[st] = (statusCounts[st] ?? 0) + 1;
  }
  return { issues, questionCount: files.length, statusCounts };
}

export function validateBank(paths: BankPaths): Issue[] {
  return validateBankDetailed(paths).issues;
}
