// Renders every figure and legend in the Airman Knowledge Testing Supplement (FAA-CT-8080-2H,
// references/sport_rec_private_akts.pdf) into figures/ as a lossless PNG and a WebP, turning
// sideways bodies upright per data/figure-rotations.json, and writes figures/index.json last.
//
// Usage:
//   npm run qbank:figures:survey [-- --save-words FILE]   checks the pages and suggests rotations; writes nothing
//   npm run qbank:figures:extract [-- --out DIR --only KEY,... --allow-version-change]
//
// Needs Poppler (pdfinfo, pdftotext, pdftoppm, pdfimages, pdffonts), found in $POPPLER_BIN or on
// PATH. Xpdf is refused. Reads references/ only; never writes there.

import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { checkReferences, FIGURE_KEY_RE, readJson } from './lib/data.ts';
import {
  CAPTION_SIDEWAYS_MIN_CHARS,
  charCount,
  checkMapping,
  checkPageMarks,
  checkPrintedSequence,
  checkRotatedPartitionText,
  checkRotationsFile,
  classifyPages,
  compareKeys,
  compareRotations,
  composedSize,
  composeItem,
  computeCrops,
  detectDirection,
  detectOrientation,
  ERASE_PAD_PT,
  erasePageMarks,
  EXPECTED_PAGE_COUNT,
  expectedKeys,
  fmtBox,
  formatSizeReport,
  INK_THRESHOLD,
  isGrayscale,
  lineText,
  MARGIN_PX,
  marksList,
  PAD_PX,
  PAGE_PT,
  PAGE_PX,
  parseBboxLayout,
  partitionWords,
  PNG,
  PPI_WARN,
  RENDER_DPI,
  SAVE_WORDS_CONTROLS,
  versionGuardDecision,
  WEBP,
  WEBP_PSNR_WARN_DB,
} from './lib/figures.ts';
import type { Detection, DirectionResult, ItemPage, OrientationResult, Page, PageMarks, Partition, Word } from './lib/figures.ts';
import { encodeFigure, verifyFigureFiles } from './lib/figure-files.ts';
import { findPoppler, runTool } from './lib/poppler.ts';
import type { PopplerTools } from './lib/poppler.ts';
import type { FigureExtraction, FigureFile, FigureIndex, FigureItem, RotationEntry, RotationsFile } from './lib/types.ts';
import { REPO_ROOT } from './lib/validate.ts';

const USAGE = [
  'Usage:',
  '  node scripts/qbank/extract-figures.ts --survey [--save-words FILE]',
  '  node scripts/qbank/extract-figures.ts [--out DIR] [--only KEY,...] [--allow-version-change]',
  '--save-words needs --survey and may not point inside references/ or figures/.',
  '--only needs --out pointing somewhere other than the repo\'s figures/.',
].join('\n');

const REPO_FIGURES = join(REPO_ROOT, 'figures');
const REPO_REFERENCES = join(REPO_ROOT, 'references');

interface Args {
  survey: boolean;
  saveWords: string | null;
  out: string;
  outGiven: boolean;
  only: string[] | null;
  allowVersionChange: boolean;
}

function usageError(msg: string): never {
  console.error(`ERROR: ${msg}`);
  console.error(USAGE);
  process.exit(2);
}

function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// Usage errors are checked before any tool lookup and exit with code 2.
function parseArgs(argv: string[]): Args {
  const a: Args = { survey: false, saveWords: null, out: REPO_FIGURES, outGiven: false, only: null, allowVersionChange: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === '--survey') a.survey = true;
    else if (arg === '--allow-version-change') a.allowVersionChange = true;
    else if (arg === '--save-words' && value !== undefined) {
      a.saveWords = resolve(value);
      i++;
    } else if (arg === '--out' && value !== undefined) {
      a.out = resolve(value);
      a.outGiven = true;
      i++;
    } else if (arg === '--only' && value !== undefined) {
      a.only = value.split(',').map((k) => k.trim()).filter((k) => k !== '');
      i++;
    } else usageError(`unknown or incomplete argument: ${arg}`);
  }
  if (a.saveWords !== null && !a.survey) usageError('--save-words works only together with --survey');
  if (a.saveWords !== null && (isInside(a.saveWords, REPO_REFERENCES) || isInside(a.saveWords, REPO_FIGURES))) {
    usageError('--save-words may not write inside references/ or figures/');
  }
  if (a.only !== null) {
    if (!a.outGiven || isInside(a.out, REPO_FIGURES)) usageError("--only needs --out pointing somewhere other than the repo's figures/");
    const expected = new Set(expectedKeys());
    const bad = a.only.filter((k) => !FIGURE_KEY_RE.test(k) || !expected.has(k));
    if (a.only.length === 0 || bad.length > 0) usageError(`--only has unknown keys: ${bad.join(', ') || '(none given)'}`);
  }
  return a;
}

function sha256File(path: string): Promise<string> {
  return new Promise((res, rej) => {
    const h = createHash('sha256');
    createReadStream(path)
      .on('data', (c) => h.update(c))
      .on('end', () => res(h.digest('hex')))
      .on('error', rej);
  });
}

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));

const refs = checkReferences(readJson(join(REPO_ROOT, 'data', 'references.json')));
if (refs.docs === null) fail(`data/references.json is invalid: ${refs.errors.join('; ')}`);
const ref = refs.docs.find((d) => d.key === 'akts-2h');
if (ref === undefined) fail('data/references.json has no akts-2h entry');
const pdfPath = join(REPO_REFERENCES, ref.local_file);

const errors: string[] = [];
const itemWarnings = new Map<string, string[]>();
const warn = (key: string, msg: string): void => {
  itemWarnings.set(key, [...(itemWarnings.get(key) ?? []), msg]);
};

const tmp = mkdtempSync(join(tmpdir(), 'rpr-figures-'));
let exitCode = 0;
try {
  exitCode = await main();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(exitCode);

// ---------------------------------------------------------------------------------------------

interface ItemState {
  item: ItemPage;
  page: Page;
  marks: PageMarks | null;
  side: 'left' | 'right' | null;
  printedPage: string | null;
  partition: Partition | null;
  orientation: OrientationResult | null;
  direction: DirectionResult | null;
  maxPpi: number | null;
  fontsNotEmbedded: string[];
}

// Runs inside the try above, so it returns an exit code and never calls process.exit (or fail):
// the finally must run to delete the temp folder.
async function main(): Promise<number> {
  // 1. Preflight
  if (!existsSync(pdfPath)) {
    console.error(`ERROR: references/${ref!.local_file} not found`);
    return 1;
  }
  const pdfSha = await sha256File(pdfPath);
  if (pdfSha !== ref!.sha256) {
    console.error(`ERROR: references/${ref!.local_file} SHA-256 is ${pdfSha}; references.json expects ${ref!.sha256}`);
    return 1;
  }

  const rotationsPath = join(REPO_ROOT, 'data', 'figure-rotations.json');
  const rot = checkRotationsFile(readJson(rotationsPath), refs.docs);
  if (rot.file === null) {
    console.error(`ERROR: data/figure-rotations.json is invalid:\n  ${rot.errors.join('\n  ')}`);
    return 1;
  }
  const rotations: RotationsFile = rot.file;

  const found = findPoppler();
  if (found.tools === null) {
    for (const e of found.errors) console.error(`ERROR: ${e}`);
    return 1;
  }
  const tools: PopplerTools = found.tools;

  errors.push(...checkPdfInfo(runTool(tools, 'pdfinfo', ['-f', '1', '-l', String(EXPECTED_PAGE_COUNT), '-box', pdfPath])));
  const ppiByPage = parseImagesList(runTool(tools, 'pdfimages', ['-list', pdfPath]));

  // 2. Text
  const bboxPath = join(tmp, 'bbox.html');
  runTool(tools, 'pdftotext', ['-bbox-layout', '-enc', 'UTF-8', '-f', '1', '-l', String(EXPECTED_PAGE_COUNT), pdfPath, bboxPath]);
  const pages = parseBboxLayout(readFileSync(bboxPath, 'utf8'));
  if (pages.length !== EXPECTED_PAGE_COUNT) errors.push(`pdftotext gave ${pages.length} pages; expected ${EXPECTED_PAGE_COUNT}`);

  // 3. Mapping
  const classified = classifyPages(pages);
  const mapping = checkMapping(classified);
  errors.push(...mapping.errors);
  const items = [...classified.items].sort((a, b) => compareKeys(a.key, b.key));

  // 4. Page marks (and the per-page font and image checks from the preflight list)
  const states: ItemState[] = [];
  for (const item of items) {
    const page = pages[item.page - 1];
    const m = checkPageMarks(page, item.type);
    errors.push(...m.errors);
    const fonts = parseFonts(runTool(tools, 'pdffonts', ['-f', String(item.page), '-l', String(item.page), pdfPath]));
    for (const f of fonts) warn(item.key, `font not embedded: ${f}`);
    const maxPpi = ppiByPage.get(item.page) ?? null;
    if (maxPpi !== null && maxPpi > PPI_WARN) warn(item.key, `an embedded image is ${maxPpi} ppi (above ${PPI_WARN})`);
    states.push({
      item,
      page,
      marks: m.marks,
      side: m.side,
      printedPage: m.printedPage,
      partition: null,
      orientation: null,
      direction: null,
      maxPpi,
      fontsNotEmbedded: fonts,
    });
  }
  const left = states.filter((s) => s.side === 'left').length;
  const right = states.filter((s) => s.side === 'right').length;
  const withPrinted = states.filter((s) => s.printedPage !== null);
  errors.push(...checkPrintedSequence(withPrinted.map((s) => ({ key: s.item.key, type: s.item.type, page: s.item.page, printedPage: s.printedPage! }))));

  // 5. Partition and detection
  const listed = new Map<string, RotationEntry>(rotations.rotations.map((e) => [e.key, e]));
  for (const s of states) {
    if (s.marks === null) continue;
    s.partition = partitionWords(s.page, s.marks, s.item.captionLine);
    s.orientation = detectOrientation(s.partition.bodyWords);
    if (s.orientation.result === 'sideways') s.direction = detectDirection(s.partition.bodyLines);
    if (s.orientation.result === 'sideways' || listed.has(s.item.key)) {
      errors.push(...checkRotatedPartitionText(s.partition));
    }
  }

  // 6. Rotations
  const detections: Detection[] = states
    .filter((s) => s.orientation !== null)
    .map((s) => ({ key: s.item.key, orientation: s.orientation!, direction: s.direction }));
  const cmp = compareRotations(rotations, detections);

  if (args.survey) {
    printSurvey(states, listed, cmp, mapping.notes, left, right);
    const code = errors.length > 0 ? 1 : 0;
    if (errors.length > 0) {
      console.log(`\n${errors.length} errors:`);
      for (const e of errors) console.log(`ERROR: ${e}`);
    }
    if (args.saveWords !== null) {
      if (code === 0) {
        const n = saveWords(args.saveWords, states, pdfSha, tools.version);
        console.log(`\nWrote ${args.saveWords} (${n} pages)`);
      } else {
        console.log(`\nNot writing ${args.saveWords}: the survey found errors`);
      }
    }
    return code;
  }

  errors.push(...cmp.errors);
  if (errors.length > 0) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    console.error(`${errors.length} errors before rendering; nothing written`);
    return 1;
  }

  // 7. Version guard
  const versions = { poppler: tools.version, sharp: sharp.versions.sharp, libvips: sharp.versions.vips };
  const existingPath = join(args.out, 'index.json');
  const existing = existsSync(existingPath) ? readJson(existingPath) : null;
  const guard = versionGuardDecision(existing, versions, args.allowVersionChange);
  if (guard.message !== null) console.error(guard.message);
  if (!guard.proceed) return 1;

  // 8. Per item
  const outTmp = join(tmp, 'out');
  mkdirSync(outTmp);
  const results: FigureItem[] = [];
  const reportLines: string[] = [];
  const selected = states.filter((s) => args.only === null || args.only.includes(s.item.key));
  for (const s of selected) {
    try {
      const r = await renderItem(tools, s, listed.get(s.item.key), outTmp);
      if (r !== null) {
        results.push(r.item);
        reportLines.push(r.line);
      }
    } catch (e) {
      errors.push(`${s.item.key}: ${(e as Error).message}`);
    }
  }

  // 9. Finish
  if (errors.length === 0 && results.length === selected.length) {
    mkdirSync(args.out, { recursive: true });
    for (const it of results) {
      copyFileSync(join(outTmp, it.files.png.name), join(args.out, it.files.png.name));
      copyFileSync(join(outTmp, it.files.webp.name), join(args.out, it.files.webp.name));
    }
    const extractedWith: FigureExtraction = {
      poppler: versions.poppler,
      sharp: versions.sharp,
      libvips: versions.libvips,
      dpi: RENDER_DPI,
      ink_threshold: INK_THRESHOLD,
      erase_pad_pt: ERASE_PAD_PT,
      margin_px: MARGIN_PX,
      pad_px: PAD_PX,
      png: { compression_level: PNG.compressionLevel },
      webp: {
        quality: WEBP.quality,
        effort: WEBP.effort,
        smart_subsample: WEBP.smartSubsample,
        lossless_for_grayscale: WEBP.losslessForGrayscale,
      },
    };
    const index: FigureIndex = { source_doc: 'akts-2h', source_sha256: pdfSha, extracted_with: extractedWith, items: results };
    writeFileSync(join(args.out, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
    const verified = await verifyFigureFiles(args.out, index);
    errors.push(...verified.errors);
  }

  // 10. Report
  for (const l of reportLines) console.log(l);
  if (itemWarnings.size > 0) {
    console.log('\nWarnings:');
    for (const [key, list] of [...itemWarnings].sort(([a], [b]) => compareKeys(a, b))) {
      for (const w of list) console.log(`  ${key}: ${w}`);
    }
  }
  console.log(`\nSideways detected, direction confirmed by eye only: ${cmp.directionByEyeOnly.join(', ') || 'none'}`);
  console.log(`Rotation confirmed by eye only: ${cmp.rotationByEyeOnly.join(', ') || 'none'}`);
  console.log(`Undetermined; upright by default; check by eye: ${cmp.undetermined.join(', ') || 'none'}`);
  console.log(`\nTools: Poppler ${versions.poppler}, sharp ${versions.sharp}, libvips ${versions.libvips}`);
  if (errors.length === 0) {
    console.log('');
    for (const l of formatSizeReport(results, rotations.rotations)) console.log(l);
    console.log(`\nWrote ${results.length} items to ${args.out}`);
  } else {
    console.log(`\n${errors.length} errors; nothing written to ${args.out}:`);
    for (const e of errors) console.log(`ERROR: ${e}`);
  }
  return errors.length > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------

function checkPdfInfo(out: string): string[] {
  const errs: string[] = [];
  const pagesMatch = /^Pages:\s+(\d+)/m.exec(out);
  if (!pagesMatch || Number(pagesMatch[1]) !== EXPECTED_PAGE_COUNT) {
    errs.push(`pdfinfo reports ${pagesMatch?.[1] ?? 'no'} pages; expected ${EXPECTED_PAGE_COUNT}`);
  }
  const per = new Map<number, Record<string, string>>();
  for (const m of out.matchAll(/^Page\s+(\d+)\s+(size|rot|MediaBox|CropBox):\s+(.*)$/gm)) {
    const p = Number(m[1]);
    per.set(p, { ...(per.get(p) ?? {}), [m[2]]: m[3].trim() });
  }
  const nums = (s: string | undefined): number[] => (s ?? '').split(/\s+/).filter((x) => x !== '').map(Number);
  for (let p = 1; p <= EXPECTED_PAGE_COUNT; p++) {
    const info = per.get(p);
    if (info === undefined) {
      errs.push(`pdfinfo has no box information for page ${p}`);
      continue;
    }
    const size = /([\d.]+)\s*x\s*([\d.]+)\s*pts/.exec(info.size ?? '');
    if (!size || Number(size[1]) !== PAGE_PT.w || Number(size[2]) !== PAGE_PT.h) {
      errs.push(`page ${p} is ${info.size ?? 'of unknown size'}; expected ${PAGE_PT.w} x ${PAGE_PT.h} pts`);
    }
    if (Number(info.rot) !== 0) errs.push(`page ${p} has rot ${info.rot}; expected 0`);
    const mb = nums(info.MediaBox);
    const cb = nums(info.CropBox);
    if (mb.length !== 4 || cb.length !== 4 || mb.some((v, i) => v !== cb[i])) {
      errs.push(`page ${p} MediaBox (${info.MediaBox}) differs from CropBox (${info.CropBox})`);
    }
  }
  return errs;
}

// pdfimages -list columns: page num type width height color comp bpc enc interp object ID x-ppi y-ppi size ratio
function parseImagesList(out: string): Map<number, number> {
  const max = new Map<number, number>();
  for (const line of out.split(/\r?\n/)) {
    const t = line.trim().split(/\s+/);
    if (t.length < 14 || !/^\d+$/.test(t[0])) continue;
    const page = Number(t[0]);
    const ppi = Math.max(Number(t[12]), Number(t[13]));
    if (Number.isFinite(ppi)) max.set(page, Math.max(max.get(page) ?? 0, ppi));
  }
  return max;
}

// pdffonts columns: name type encoding emb sub uni object ID. Returns the fonts not embedded.
function parseFonts(out: string): string[] {
  const lines = out.split(/\r?\n/);
  const sep = lines.findIndex((l) => /^-{4,}/.test(l));
  const notEmbedded: string[] = [];
  for (const line of lines.slice(sep + 1)) {
    const t = line.trim().split(/\s+/);
    if (t.length < 7) continue;
    if (t[t.length - 5] === 'no') notEmbedded.push(t[0]);
  }
  return notEmbedded;
}

function ratioOf(w: Word): number {
  return (w.yMax - w.yMin) / (w.xMax - w.xMin);
}

function printSurvey(
  states: ItemState[],
  listed: Map<string, RotationEntry>,
  cmp: ReturnType<typeof compareRotations>,
  notes: string[],
  left: number,
  right: number,
): void {
  for (const s of states) {
    console.log(`\n== ${s.item.key}  page ${s.item.page}  printed ${s.printedPage ?? '?'}`);
    console.log(`   caption: ${s.item.captionText}`);
    if (s.partition !== null) {
      const capWords = new Set(s.page.lines[s.item.captionLine]);
      for (const l of s.partition.captionLines) {
        if (l.every((w) => capWords.has(w))) continue;
        console.log(`   caption block: ${lineText(l)}`);
      }
    }
    if (s.marks !== null) {
      console.log(
        `   header ${s.side}: "${s.marks.header.text}" ${fmtBox(s.marks.header)}, "${s.marks.digit.text}" ${fmtBox(s.marks.digit)}; page number "${s.marks.pageNumber.text}" ${fmtBox(s.marks.pageNumber)}`,
      );
    } else {
      console.log('   page marks: FAILED (see errors)');
    }
    if (s.orientation !== null) {
      const o = s.orientation;
      const d = s.direction === null ? '' : `, direction ${s.direction.direction ?? 'unreadable'} (votes up ${s.direction.up}, down ${s.direction.down})`;
      console.log(`   body words n ${o.n}, sideways ${o.sideways}, share ${o.share.toFixed(2)}: ${o.result}${d}`);
    }
    if (s.partition !== null) {
      const long = s.partition.captionWords.filter((w) => charCount(w.text) >= CAPTION_SIDEWAYS_MIN_CHARS);
      const top = long.length === 0 ? null : Math.max(...long.map(ratioOf));
      console.log(`   caption block highest height/width (4+ characters): ${top === null ? 'n/a' : top.toFixed(2)}`);
    }
    const e = listed.get(s.item.key);
    console.log(`   rotations file: ${e === undefined ? 'not listed' : JSON.stringify(e)}`);
    console.log(`   highest image ppi: ${s.maxPpi ?? 'no images'}; fonts not embedded: ${s.fontsNotEmbedded.join(', ') || 'none'}`);
    for (const w of itemWarnings.get(s.item.key) ?? []) console.log(`   warning: ${w}`);
  }

  console.log(`\nHeaders: ${left} left, ${right} right (expected 48 left, 50 right)`);
  for (const n of notes) console.log(`Note: ${n}`);

  const suggested = states
    .filter((s) => s.orientation?.result === 'sideways' && s.direction?.direction != null)
    .map((s) => ({ key: s.item.key, rotate: s.direction!.direction, evidence: 'words' }));
  console.log('\nSuggested entries:');
  console.log(JSON.stringify(suggested, null, 2));
  const unreadable = states.filter((s) => s.orientation?.result === 'sideways' && s.direction?.direction == null).map((s) => s.item.key);
  console.log(`\nSideways, direction unreadable; set by eye (90 or 270), evidence visual: ${unreadable.join(', ') || 'none'}`);
  const undetermined = states.filter((s) => s.orientation?.result === 'undetermined').map((s) => s.item.key);
  console.log(`Undetermined, check by eye: ${undetermined.join(', ') || 'none'}`);
  if (cmp.errors.length > 0) {
    console.log('\nTo do (rotations file vs. detection):');
    for (const e of cmp.errors) console.log(`  to do: ${e}`);
  }
}

function saveWords(path: string, states: ItemState[], pdfSha: string, poppler: string): number {
  const wordJson = (w: Word): { t: string; b: number[] } => ({ t: w.text, b: [w.xMin, w.yMin, w.xMax, w.yMax] });
  const chosen = states.filter(
    (s) => s.partition !== null && (s.orientation?.result === 'sideways' || SAVE_WORDS_CONTROLS.includes(s.item.key)),
  );
  const pageLines = chosen.map((s) =>
    JSON.stringify({
      key: s.item.key,
      page: s.item.page,
      result: s.orientation!.result,
      caption_lines: s.partition!.captionLines.map((l) => l.map(wordJson)),
      body_lines: s.partition!.bodyLines.map((l) => l.map(wordJson)),
    }),
  );
  const text = [
    '{',
    `  "source_doc": "akts-2h",`,
    `  "source_sha256": ${JSON.stringify(pdfSha)},`,
    `  "poppler": ${JSON.stringify(poppler)},`,
    '  "pages": [',
    pageLines.map((l) => `    ${l}`).join(',\n'),
    '  ]',
    '}',
  ].join('\n');
  writeFileSync(path, text + '\n', 'utf8');
  return chosen.length;
}

function fileEntry(name: string, buf: Buffer, width: number, height: number): FigureFile {
  return { name, width, height, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
}

async function renderItem(
  tools: PopplerTools,
  s: ItemState,
  entry: RotationEntry | undefined,
  outTmp: string,
): Promise<{ item: FigureItem; line: string } | null> {
  const key = s.item.key;
  const P = s.item.page;
  const prefix = join(tmp, `page-${P}`);
  runTool(tools, 'pdftoppm', ['-r', String(RENDER_DPI), '-f', String(P), '-l', String(P), '-singlefile', '-png', '-aa', 'yes', '-aaVector', 'yes', pdfPath, prefix]);
  const { data, info } = await sharp(`${prefix}.png`).raw().toBuffer({ resolveWithObject: true });
  rmSync(`${prefix}.png`, { force: true });
  if (info.width !== PAGE_PX.w || info.height !== PAGE_PX.h || info.channels !== 3) {
    errors.push(`${key}: page ${P} rendered as ${info.width}x${info.height} with ${info.channels} channels; expected ${PAGE_PX.w}x${PAGE_PX.h} with 3`);
    return null;
  }
  const w = info.width;
  const h = info.height;
  const rotate: 0 | 90 | 180 | 270 = entry?.rotate ?? 0;

  const er = erasePageMarks(data, w, h, marksList(s.marks!), P);
  errors.push(...er.errors.map((e) => `${key}: ${e}`));
  for (const t of er.eraseTouch) {
    warn(key, `eraseTouch: ${t.count} ink pixels touch the ${t.mark} erase box, in [${t.box.x0}, ${t.box.y0}, ${t.box.x1}, ${t.box.y1})`);
  }
  const crops = computeCrops(er.erased, w, h, s.partition!, rotate !== 0);
  errors.push(...crops.errors.map((e) => `${key}: ${e}`));
  for (const wmsg of crops.warnings) warn(key, wmsg);
  if (crops.body_px === null || crops.caption_px === null || er.errors.length > 0 || crops.errors.length > 0) return null;

  const fields = { rotate, body_px: crops.body_px, caption_px: crops.caption_px };
  const composed = composeItem(er.erased, w, h, fields);
  const expected = composedSize(fields);
  if (composed.width !== expected.width || composed.height !== expected.height) {
    errors.push(`${key}: composed ${composed.width}x${composed.height}; the formula gives ${expected.width}x${expected.height} (a bug)`);
    return null;
  }
  const gray = isGrayscale(composed.data);
  const W = composed.width;
  const H = composed.height;

  // PNG (one-channel gray or RGB, no metadata) and WebP (lossless for gray, lossy for colour),
  // each decoded and checked; see encodeFigure.
  const enc = await encodeFigure(composed.data, W, H, gray);
  if (enc.errors.length > 0) {
    errors.push(...enc.errors.map((e) => `${key}: ${e}`));
    return null;
  }
  const { png, webp } = enc;
  const db = enc.psnr!;
  if (!gray && db < WEBP_PSNR_WARN_DB) warn(key, `WebP PSNR ${db.toFixed(1)} dB is below ${WEBP_PSNR_WARN_DB} dB`);

  writeFileSync(join(outTmp, `${key}.png`), png);
  writeFileSync(join(outTmp, `${key}.webp`), webp);

  const item: FigureItem = {
    key,
    type: s.item.type,
    number: s.item.number,
    page: P,
    printed_page: s.printedPage!,
    rotate,
    body_px: crops.body_px,
    caption_px: crops.caption_px,
    files: {
      png: fileEntry(`${key}.png`, png, W, H),
      webp: { ...fileEntry(`${key}.webp`, webp, W, H), lossless: gray },
    },
  };
  const n = (x: number): string => x.toLocaleString('en-US');
  const rotText = rotate === 0 ? 'rot 0' : `rot ${rotate} (${entry!.evidence})`;
  const line = `${key}  p${P}  ${s.printedPage}  ${rotText}  body ${crops.body_px[2]}x${crops.body_px[3]}  caption ${crops.caption_px[2]}x${crops.caption_px[3]}  out ${W}x${H}  ${gray ? 'gray' : 'colour'}  png ${n(png.length)}  webp ${n(webp.length)}${gray ? ' (lossless)' : ''}`;
  return { item, line };
}
