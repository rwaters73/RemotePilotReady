import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { findPoppler, readVersionText } from '../lib/poppler.ts';
import type { VersionReader } from '../lib/poppler.ts';

// Deliberately a literal, not POPPLER_TOOLS: a test sourced from the constant under test can't
// catch a member disappearing from it.
const TOOLS = ['pdfinfo', 'pdftotext', 'pdftoppm', 'pdfimages', 'pdffonts'];

function exe(t: string): string {
  return process.platform === 'win32' ? `${t}.exe` : t;
}

// A temp folder (its name has a space on purpose, so the messages carry a path with a space)
// holding an empty placeholder for each tool. The placeholders only satisfy locateTool's
// existsSync; they are never run.
function withBin(fn: (dir: string, env: NodeJS.ProcessEnv) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'qbank poppler-'));
  try {
    for (const t of TOOLS) writeFileSync(join(dir, exe(t)), '');
    fn(dir, { POPPLER_BIN: dir, PATH: '' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Arguments for `node -e` that write the given text to each stream and exit with the given code.
// process.exitCode, not process.exit(), so the pipes drain before the child exits.
function program(stdout: string, stderr: string, exitCode: number): string[] {
  const code = `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)}); process.exitCode = ${exitCode};`;
  return ['-e', code];
}

interface Spec {
  out: string;
  err: string;
  code: number;
}

// A VersionReader that runs a real child node process for each tool, as described by spec.
function reader(spec: Record<string, Spec>): VersionReader {
  return (path: string) => {
    const t = basename(path).replace(/\.exe$/, '');
    const s = spec[t];
    if (s === undefined) throw new Error(`no spec for ${t}`);
    return readVersionText(process.execPath, program(s.out, s.err, s.code));
  };
}

function each(fn: (t: string) => Spec): Record<string, Spec> {
  return Object.fromEntries(TOOLS.map((t) => [t, fn(t)]));
}

// The shape of Poppler 24.02.0's -v text. Real Poppler prints the Glyph & Cog line too.
function POPPLER(t: string, v: string): string {
  return `${t} version ${v}\nCopyright 2005-2024 The Poppler Developers - http://poppler.freedesktop.org\nCopyright 1996-2011, 2022 Glyph & Cog, LLC\n`;
}

// Xpdf 4.00's -v text, as checked on the desktop (exit 99).
function XPDF(t: string): string {
  return `${t} version 4.00\nCopyright 1996-2017 Glyph & Cog, LLC\n`;
}

function msgs(dir: string, template: (t: string, path: string) => string): string[] {
  return TOOLS.map((t) => template(t, join(dir, exe(t))));
}

function assertAccepted(dir: string, r: ReturnType<typeof findPoppler>): void {
  assert.deepEqual(r.errors, [], r.errors.join('\n'));
  assert.notEqual(r.tools, null);
  assert.equal(r.tools!.version, '24.02.0');
  assert.deepEqual(r.tools!.paths, Object.fromEntries(TOOLS.map((t) => [t, join(dir, exe(t))])));
}

test('P1 readVersionText reads stderr when the exit code is 0', () => {
  assert.equal(readVersionText(process.execPath, program('', POPPLER('pdfinfo', '24.02.0'), 0)), POPPLER('pdfinfo', '24.02.0'));
});

test('P2 defect: findPoppler accepts Poppler whose -v text is on stderr with exit 0', () => {
  withBin((dir, env) => {
    const r = findPoppler(env, reader(each((t) => ({ out: '', err: POPPLER(t, '24.02.0'), code: 0 }))));
    assertAccepted(dir, r);
  });
});

test('P3 findPoppler accepts Poppler -v text on stderr with a non-zero exit', () => {
  withBin((dir, env) => {
    const r = findPoppler(env, reader(each((t) => ({ out: '', err: POPPLER(t, '24.02.0'), code: 99 }))));
    assertAccepted(dir, r);
  });
});

test('P4 findPoppler accepts Poppler -v text on stdout with exit 0', () => {
  withBin((dir, env) => {
    const r = findPoppler(env, reader(each((t) => ({ out: POPPLER(t, '24.02.0'), err: '', code: 0 }))));
    assertAccepted(dir, r);
  });
});

test('P5 findPoppler refuses Xpdf', () => {
  withBin((dir, env) => {
    const r = findPoppler(env, reader(each((t) => ({ out: '', err: XPDF(t), code: 99 }))));
    assert.equal(r.tools, null);
    assert.deepEqual(
      r.errors,
      msgs(dir, (_t, p) => `found Xpdf at ${p}; this script needs Poppler (pdftoppm, pdftotext -bbox-layout). Install Poppler and set POPPLER_BIN.`),
    );
  });
});

test('P6 negative controls are not accepted as Poppler', () => {
  const runs: ((t: string) => Spec)[] = [
    // a) version-shaped, no Poppler
    (t) => ({ out: '', err: `${t} version 24.02.0\nCopyright 2024 Example Software\n`, code: 0 }),
    // b) no output, exit 0
    () => ({ out: '', err: '', code: 0 }),
    // c) no output, exit 1
    () => ({ out: '', err: '', code: 1 }),
  ];
  for (const run of runs) {
    withBin((dir, env) => {
      const r = findPoppler(env, reader(each(run)));
      assert.equal(r.tools, null);
      assert.deepEqual(r.errors, msgs(dir, (t, p) => `${t} at ${p} is not Poppler (its -v output does not mention Poppler)`));
    });
  }
});

test('P7 findPoppler refuses tools reporting different versions', () => {
  withBin((_dir, env) => {
    const r = findPoppler(env, reader(each((t) => ({ out: '', err: POPPLER(t, t === 'pdftoppm' ? '24.08.0' : '24.02.0'), code: 0 }))));
    assert.equal(r.tools, null);
    assert.deepEqual(r.errors, [
      'the Poppler tools report different versions: pdfinfo 24.02.0, pdftotext 24.02.0, pdftoppm 24.08.0, pdfimages 24.02.0, pdffonts 24.02.0',
    ]);
  });
});

test('P8 findPoppler reports Poppler text with no version', () => {
  withBin((dir, env) => {
    const r = findPoppler(env, reader(each(() => ({ out: '', err: 'Copyright 2005-2024 The Poppler Developers\n', code: 0 }))));
    assert.equal(r.tools, null);
    assert.deepEqual(r.errors, msgs(dir, (t, p) => `${t} at ${p}: cannot read a version from its -v output`));
  });
});

test('P9 readVersionText passes arguments unchanged, with no shell', () => {
  const out = readVersionText(process.execPath, [
    '-e',
    'process.stdout.write(JSON.stringify(process.argv.slice(1)))',
    'a b',
    '&',
    '"q"',
    '%PATH%',
    '$HOME',
  ]);
  assert.equal(out, JSON.stringify(['a b', '&', '"q"', '%PATH%', '$HOME']));
});
