import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { checkPngPixels, encodeFigure, verifyFigureFiles } from '../lib/figure-files.ts';
import type { FigureFile, FigureIndex, FigureItem } from '../lib/types.ts';
import { REPO_ROOT } from '../lib/validate.ts';

const AKTS_SHA = '738a0cd5c429e20888e94fd490d90ba09223ac4d350d06fe228788d4b502f4fd';

function entry(name: string, buf: Buffer, width: number, height: number): FigureFile {
  return { name, width, height, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
}

// A temp folder with two items made by sharp, and its index.
async function makeFolder(): Promise<{ dir: string; index: FigureIndex }> {
  const dir = mkdtempSync(join(tmpdir(), 'qbank-figures-'));
  const items: FigureItem[] = [];
  const specs = [
    { key: 'fig-1', type: 'figure' as const, number: 1, page: 35, printed: '2-1', w: 6, h: 4, rgb: [10, 120, 200] },
    { key: 'legend-2', type: 'legend' as const, number: 2, page: 14, printed: '1-2', w: 3, h: 5, rgb: [90, 90, 90] },
  ];
  for (const s of specs) {
    const raw = Buffer.alloc(s.w * s.h * 3);
    for (let i = 0; i < raw.length; i += 3) raw.set(s.rgb, i);
    const opts = { raw: { width: s.w, height: s.h, channels: 3 as const } };
    const png = await sharp(raw, opts).png().toBuffer();
    const webp = await sharp(raw, opts).webp({ lossless: true }).toBuffer();
    writeFileSync(join(dir, `${s.key}.png`), png);
    writeFileSync(join(dir, `${s.key}.webp`), webp);
    items.push({
      key: s.key,
      type: s.type,
      number: s.number,
      page: s.page,
      printed_page: s.printed,
      rotate: 0,
      body_px: [0, 0, s.w, s.h],
      caption_px: [0, s.h, s.w, 1],
      files: { png: entry(`${s.key}.png`, png, s.w, s.h), webp: { ...entry(`${s.key}.webp`, webp, s.w, s.h), lossless: true } },
    });
  }
  const index: FigureIndex = {
    source_doc: 'akts-2h',
    source_sha256: AKTS_SHA,
    extracted_with: {
      poppler: '24.02.0',
      sharp: '0.35.5',
      libvips: '8.18.7',
      dpi: 300,
      ink_threshold: 250,
      erase_pad_pt: 0.25,
      margin_px: 24,
      pad_px: 4,
      png: { compression_level: 9 },
      webp: { quality: 90, effort: 6, smart_subsample: true, lossless_for_grayscale: true },
    },
    items,
  };
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  return { dir, index };
}

async function withFolder(fn: (dir: string, index: FigureIndex) => Promise<void>): Promise<void> {
  const { dir, index } = await makeFolder();
  try {
    await fn(dir, index);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCheck(dir: string): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', 'qbank', 'check-figures.ts'), '--figures', dir], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('a matching folder passes', async () => {
  await withFolder(async (dir, index) => {
    const { errors, report } = await verifyFigureFiles(dir, index);
    assert.deepEqual(errors, []);
    assert.ok(report.some((l) => l.startsWith('PNG: 2 files')), report.join('\n'));
    const cli = runCheck(dir);
    assert.equal(cli.status, 0, cli.out);
  });
});

test('a flipped byte fails', async () => {
  await withFolder(async (dir, index) => {
    const p = join(dir, 'fig-1.png');
    const buf = readFileSync(p);
    buf[buf.length - 20] ^= 0xff;
    writeFileSync(p, buf);
    const { errors } = await verifyFigureFiles(dir, index);
    assert.ok(errors.some((e) => e.startsWith('fig-1.png: SHA-256')), JSON.stringify(errors));
  });
});

test('a missing WebP fails', async () => {
  await withFolder(async (dir, index) => {
    unlinkSync(join(dir, 'legend-2.webp'));
    const { errors } = await verifyFigureFiles(dir, index);
    assert.ok(errors.some((e) => e === 'legend-2.webp (legend-2) is missing'), JSON.stringify(errors));
  });
});

test('a stray file fails, and the CLI names it', async () => {
  await withFolder(async (dir, index) => {
    writeFileSync(join(dir, 'stray.png'), 'x');
    const { errors } = await verifyFigureFiles(dir, index);
    assert.ok(errors.some((e) => e === 'stray.png is in the figures folder but not in index.json'), JSON.stringify(errors));
    const cli = runCheck(dir);
    assert.equal(cli.status, 1, cli.out);
    assert.ok(cli.out.includes('stray.png'), cli.out);
  });
});

test('a wrong size in the index fails', async () => {
  await withFolder(async (dir, index) => {
    index.items[0].files.png.width = 7;
    const { errors } = await verifyFigureFiles(dir, index);
    assert.ok(errors.some((e) => e === 'fig-1.png: 6x4 pixels; index.json says 7x4'), JSON.stringify(errors));
  });
});

// ---------------------------------------------------------------------------------------------
// encodeFigure and checkPngPixels, on synthetic composed pixels

// PNG IHDR: bytes 12-15 are "IHDR", byte 24 the bit depth, byte 25 the colour type (0 gray, 2 RGB).
function ihdr(png: Buffer): { bitDepth: number; colourType: number } {
  assert.equal(png.subarray(12, 16).toString('latin1'), 'IHDR');
  return { bitDepth: png[24], colourType: png[25] };
}

// Composed RGB pixels with every value different along the row: gray repeats each value three times.
function synthetic(w: number, h: number, gray: boolean): Uint8Array {
  const rgb = new Uint8Array(w * h * 3);
  for (let p = 0; p < w * h; p++) {
    const v = (p * 37 + 11) % 256;
    rgb.set(gray ? [v, v, v] : [v, (v * 7 + 3) % 256, 255 - v], p * 3);
  }
  return rgb;
}

test('encodeFigure: a gray image is a one-channel 8-bit gray PNG that decodes to the same pixels', async () => {
  const [w, h] = [7, 5];
  const rgb = synthetic(w, h, true);
  const enc = await encodeFigure(rgb, w, h, true);
  assert.deepEqual(enc.errors, []);
  assert.deepEqual(ihdr(enc.png), { bitDepth: 8, colourType: 0 });
  const back = await sharp(enc.png).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
  assert.equal(back.info.channels, 1);
  assert.deepEqual([back.info.width, back.info.height], [w, h]);
  assert.deepEqual([...back.data], [...rgb].filter((_v, i) => i % 3 === 0));
  assert.equal((await sharp(enc.webp).metadata()).format, 'webp');
});

test('encodeFigure: a colour image is an RGB PNG that decodes to the same pixels', async () => {
  const [w, h] = [6, 4];
  const rgb = synthetic(w, h, false);
  const enc = await encodeFigure(rgb, w, h, false);
  assert.deepEqual(enc.errors, []);
  assert.deepEqual(ihdr(enc.png), { bitDepth: 8, colourType: 2 });
  const back = await sharp(enc.png).raw().toBuffer({ resolveWithObject: true });
  assert.equal(back.info.channels, 3);
  assert.deepEqual([back.info.width, back.info.height], [w, h]);
  assert.deepEqual([...back.data], [...rgb]);
  assert.equal((await sharp(enc.webp).metadata()).format, 'webp');
});

for (const gray of [true, false]) {
  test(`checkPngPixels: a one-pixel difference is a mismatch (${gray ? 'gray' : 'colour'})`, async () => {
    const [w, h] = [5, 3];
    const rgb = synthetic(w, h, gray);
    const enc = await encodeFigure(rgb, w, h, gray);
    assert.deepEqual(enc.errors, []);
    assert.equal(await checkPngPixels(enc.png, rgb, w, h, gray), null);
    const other = Uint8Array.from(rgb);
    const p = 7 * 3;
    for (let c = 0; c < (gray ? 3 : 1); c++) other[p + c] ^= 1;
    assert.equal(await checkPngPixels(enc.png, other, w, h, gray), 'the written PNG does not decode to the composed pixels');
  });
}

test('checkPngPixels: a gray image written as a three-channel PNG is a mismatch', async () => {
  const [w, h] = [5, 3];
  const rgb = synthetic(w, h, true);
  const png = await sharp(Buffer.from(rgb), { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  assert.equal(ihdr(png).colourType, 2);
  assert.equal(await checkPngPixels(png, rgb, w, h, true), 'the written PNG does not decode to the composed pixels');
});
