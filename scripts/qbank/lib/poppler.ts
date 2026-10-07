// Finds and runs the Poppler command-line tools. Each tool is looked up in $POPPLER_BIN (a folder)
// first, then on PATH. Xpdf (which Git for Windows ships as pdftotext) is refused: this code needs
// Poppler's pdftoppm and pdftotext -bbox-layout. All calls use argument arrays, never a shell.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

export const POPPLER_TOOLS = ['pdfinfo', 'pdftotext', 'pdftoppm', 'pdfimages', 'pdffonts'] as const;
export type PopplerTool = (typeof POPPLER_TOOLS)[number];

export interface PopplerTools {
  paths: Record<PopplerTool, string>;
  version: string;
}

function exeName(tool: string): string {
  return process.platform === 'win32' ? `${tool}.exe` : tool;
}

export function locateTool(tool: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const name = exeName(tool);
  if (env.POPPLER_BIN) {
    const p = join(env.POPPLER_BIN, name);
    if (existsSync(p)) return p;
  }
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter)) {
    if (dir === '') continue;
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

// Runs `tool -v` and returns stdout plus stderr. The tools print their version on stderr and
// some exit non-zero, so a non-zero exit is caught and its output kept.
function versionOutput(path: string): string {
  try {
    return execFileSync(path, ['-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    return out === '' ? (err.message ?? '') : out;
  }
}

export function findPoppler(env: NodeJS.ProcessEnv = process.env): { tools: PopplerTools | null; errors: string[] } {
  const errors: string[] = [];
  const paths: Partial<Record<PopplerTool, string>> = {};
  const versions: { tool: PopplerTool; version: string }[] = [];
  for (const tool of POPPLER_TOOLS) {
    const path = locateTool(tool, env);
    if (path === null) {
      errors.push(`${tool} not found in POPPLER_BIN or PATH`);
      continue;
    }
    const out = versionOutput(path);
    if (!/poppler/i.test(out)) {
      if (/Glyph & Cog/.test(out)) {
        errors.push(
          `found Xpdf at ${path}; this script needs Poppler (pdftoppm, pdftotext -bbox-layout). Install Poppler and set POPPLER_BIN.`,
        );
      } else {
        errors.push(`${tool} at ${path} is not Poppler (its -v output does not mention Poppler)`);
      }
      continue;
    }
    const v = /version\s+(\S+)/i.exec(out)?.[1];
    if (v === undefined) {
      errors.push(`${tool} at ${path}: cannot read a version from its -v output`);
      continue;
    }
    paths[tool] = path;
    versions.push({ tool, version: v });
  }
  const distinct = [...new Set(versions.map((v) => v.version))];
  if (distinct.length > 1) {
    errors.push(`the Poppler tools report different versions: ${versions.map((v) => `${v.tool} ${v.version}`).join(', ')}`);
  }
  if (errors.length > 0) return { tools: null, errors };
  return { tools: { paths: paths as Record<PopplerTool, string>, version: distinct[0] }, errors };
}

export function runTool(tools: PopplerTools, tool: PopplerTool, args: string[]): string {
  return execFileSync(tools.paths[tool], args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 512 * 1024 * 1024,
  });
}
