// Checks the files in a figures folder against its index: no extra files, and every listed file
// present with the indexed byte count, SHA-256, format and pixel size, and decoding fully. Also
// encodes one composed item as PNG and WebP and checks the result (encodeFigure, used by
// extract-figures.ts). Uses sharp and crypto; needs no Poppler and no PDF.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { formatSizeReport, PNG, psnr, WEBP } from './figures.ts';
import { FIGURE_FORMATS } from './types.ts';
import type { FigureIndex } from './types.ts';

// The pixels the PNG must hold: one channel for gray (the first of each R=G=B triple), else RGB.
function pngPixels(rgb: Uint8Array, gray: boolean): Buffer {
  return gray ? Buffer.from(rgb.filter((_v, i) => i % 3 === 0)) : Buffer.from(rgb);
}

// Decodes a written PNG and checks it holds exactly the composed pixels. Gray is decoded as b-w:
// sharp otherwise decodes even a one-channel gray PNG to three channels. Decoding as b-w also
// turns a three-channel PNG into one channel, so the stored channel count is checked separately
// from the file's metadata. Returns null on a match.
export async function checkPngPixels(png: Buffer, rgb: Uint8Array, width: number, height: number, gray: boolean): Promise<string | null> {
  const expected = pngPixels(rgb, gray);
  const channels = gray ? 1 : 3;
  const stored = (await sharp(png).metadata()).channels;
  const back = await (gray ? sharp(png).toColourspace('b-w') : sharp(png)).raw().toBuffer({ resolveWithObject: true });
  if (stored !== channels || back.info.channels !== channels || back.info.width !== width || back.info.height !== height || !back.data.equals(expected)) {
    return 'the written PNG does not decode to the composed pixels';
  }
  return null;
}

// Writes a composed RGB image as PNG and WebP with the settings in figures.ts, and checks both.
// PNG: gray is one-channel 8-bit gray (colour type 0), colour is RGB; no metadata. sharp writes a
// one-channel raw input as RGB unless the colourspace is set to b-w, so gray is written as b-w.
// WebP has no gray mode: it is written from the three-channel pixels (lossless for gray, lossy for
// colour) and decoded as three channels, and psnr compares it with the composed pixels.
export async function encodeFigure(
  rgb: Uint8Array,
  width: number,
  height: number,
  gray: boolean,
): Promise<{ png: Buffer; webp: Buffer; psnr: number | null; errors: string[] }> {
  const pngInput = sharp(pngPixels(rgb, gray), { raw: { width, height, channels: gray ? 1 : 3 } });
  const png = await (gray ? pngInput.toColourspace('b-w') : pngInput)
    .png({ compressionLevel: PNG.compressionLevel, adaptiveFiltering: PNG.adaptiveFiltering, palette: PNG.palette })
    .toBuffer();
  const pngError = await checkPngPixels(png, rgb, width, height, gray);
  if (pngError !== null) return { png, webp: Buffer.alloc(0), psnr: null, errors: [pngError] };

  const webpOptions = gray
    ? { lossless: true, effort: WEBP.effort }
    : { quality: WEBP.quality, effort: WEBP.effort, smartSubsample: WEBP.smartSubsample };
  const webp = await sharp(Buffer.from(rgb), { raw: { width, height, channels: 3 } }).webp(webpOptions).toBuffer();
  const wback = await sharp(webp).raw().toBuffer({ resolveWithObject: true });
  if (wback.info.width !== width || wback.info.height !== height || wback.info.channels !== 3) {
    return { png, webp, psnr: null, errors: [`the written WebP decodes as ${wback.info.width}x${wback.info.height} with ${wback.info.channels} channels`] };
  }
  return { png, webp, psnr: psnr(rgb, wback.data), errors: [] };
}

export async function verifyFigureFiles(dir: string, index: FigureIndex): Promise<{ errors: string[]; report: string[] }> {
  const errors: string[] = [];
  const listed = new Set<string>(['index.json', '.gitkeep']);
  for (const item of index.items) for (const fmt of FIGURE_FORMATS) listed.add(item.files[fmt].name);
  const present = existsSync(dir) ? readdirSync(dir) : [];
  if (!existsSync(dir)) errors.push(`folder ${dir} does not exist`);
  for (const name of present.sort()) {
    if (!listed.has(name)) errors.push(`${name} is in the figures folder but not in index.json`);
  }

  for (const item of index.items) {
    for (const fmt of FIGURE_FORMATS) {
      const f = item.files[fmt];
      const path = join(dir, f.name);
      if (!existsSync(path)) {
        errors.push(`${f.name} (${item.key}) is missing`);
        continue;
      }
      const buf = readFileSync(path);
      if (buf.length !== f.bytes) errors.push(`${f.name}: ${buf.length} bytes on disk; index.json says ${f.bytes}`);
      const sha = createHash('sha256').update(buf).digest('hex');
      if (sha !== f.sha256) errors.push(`${f.name}: SHA-256 ${sha} on disk; index.json says ${f.sha256}`);
      try {
        const meta = await sharp(buf).metadata();
        if (meta.format !== fmt) errors.push(`${f.name}: sharp reads it as ${meta.format}, not ${fmt}`);
        if (meta.width !== f.width || meta.height !== f.height) {
          errors.push(`${f.name}: ${meta.width}x${meta.height} pixels; index.json says ${f.width}x${f.height}`);
        }
        await sharp(buf).raw().toBuffer();
      } catch (e) {
        errors.push(`${f.name}: does not decode: ${(e as Error).message}`);
      }
    }
  }
  return { errors, report: formatSizeReport(index.items) };
}
