import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';

import {
  checkThumb,
  placeImage,
  planThumb,
  type Problem,
  sourceRegion,
  THUMB,
  type ThumbDesign,
} from '../../motion/src/thumbnail/layout.ts';
import type { ThumbnailProps, ThumbPhoto } from '../../motion/src/thumbnail/Thumbnail.tsx';
import { extractFrame } from '../analyze/timeline-view.ts';
import type { Analysis, Transcript } from '../analyze/types.ts';
import { listVersions, loadEdl } from '../edl/store.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { ffmpeg } from '../lib/ffmpeg.ts';
import { ASSETS_DIR, MOTION_ENTRY, type ProjectPaths, readJson, writeJson } from '../project/paths.ts';
import { bumperDurations } from '../render/bumpers.ts';
import { CHROMIUM_OPTIONS } from '../render/overlay.ts';
import { buildChapters, renderChapters } from '../report/index.ts';
import { checkDescription, checkTags, checkTitle, formatProblems } from './check.ts';
import { buildDescription, buildTagsFile, buildTitlesFile } from './describe.ts';
import {
  type Box,
  faceCrop,
  type FrameCandidate,
  growBox,
  guessFace,
  laplacianVariance,
  meanBrightness,
  type MeasuredFrame,
  pickFrames,
  poolDeviation,
  skinMask,
  skinRatio,
  speechInstants,
  spreadCandidates,
} from './frames.ts';
import { COMPARE_TIERS, compareSheet, compareSvg, CONTACT, contactGrid, contactSvg } from './sheet.ts';
import type { PackSpec, ThumbVariant } from './spec.ts';

type Log = (message: string) => void;

/** Candidatos medidos por faixa de tempo antes de escolher um: mais que isso só gasta ffmpeg. */
const POOL_PER_BUCKET = 4;
const MAX_BYTES = 2 * 1024 * 1024;

export interface PackPaths {
  dir: string;
  framesDir: string;
  framesSheet: string;
  framesIndex: string;
  thumbsSheet: string;
}

export function packPaths(paths: ProjectPaths): PackPaths {
  const dir = join(paths.dir, 'pack');
  return {
    dir,
    framesDir: join(dir, 'frames'),
    framesSheet: join(dir, 'frames.png'),
    framesIndex: join(dir, 'frames.json'),
    thumbsSheet: join(paths.outputDir, 'capas.png'),
  };
}

export interface PackFrame {
  index: number;
  at: number;
  file: string;
  score: number;
  sharpness: number;
  brightness: number;
  skin: number;
  /** palpite do centro do rosto (0–1): vira o `focus` padrão da capa; confira no recorte da folha */
  focus: { x: number; y: number } | null;
  face: Box | null;
}

interface PoolFrame {
  candidate: FrameCandidate;
  width: number;
  height: number;
  gray: Uint8Array;
  rgb: Uint8Array;
}

async function readPool(file: string, candidate: FrameCandidate): Promise<PoolFrame> {
  const rgb = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const gray = await sharp(file).greyscale().raw().toBuffer();
  return { candidate, width: rgb.info.width, height: rgb.info.height, gray: new Uint8Array(gray), rgb: new Uint8Array(rgb.data) };
}

/**
 * Candidatos a frame de capa: mede um punhado de instantes com fala no proxy (rápido), fica com o
 * melhor de cada faixa do vídeo e extrai esses em resolução cheia do arquivo fonte. Um ffmpeg por vez.
 */
export async function packFrames(paths: ProjectPaths, count: number, log: Log): Promise<{ sheet: string; frames: PackFrame[] }> {
  const pack = packPaths(paths);
  const analysis = readJson<Analysis>(paths.analysis);
  const { words } = readJson<Transcript>(paths.words);
  const edl = listVersions(paths).length ? loadEdl(paths) : null;
  const candidates = spreadCandidates(speechInstants(words, edl ? edl.clips : null, analysis.scenes), count, POOL_PER_BUCKET);
  if (candidates.length === 0) throw new Error('Nenhum instante com fala encontrado para tirar frames');

  mkdirSync(pack.framesDir, { recursive: true });
  for (const name of readdirSync(pack.framesDir)) {
    if (/^frame-\d+\.png$/.test(name)) rmSync(join(pack.framesDir, name));
  }
  const poolDir = join(pack.dir, '.pool');
  mkdirSync(poolDir, { recursive: true });
  const pool: PoolFrame[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const file = join(poolDir, `p${index}.png`);
    await ffmpeg(['-ss', candidate.at.toFixed(3), '-i', analysis.proxy, '-an', '-frames:v', '1', '-vf', 'scale=320:-2', '-update', '1', file]);
    pool.push(await readPool(file, candidate));
  }
  rmSync(poolDir, { recursive: true, force: true });

  const deviation = poolDeviation(pool.map((frame) => frame.gray));
  const measured: MeasuredFrame[] = pool.map((frame) => {
    const face = guessFace(skinMask(frame.rgb), deviation, frame.width, frame.height);
    return {
      ...frame.candidate,
      face: face ? { x: face.x / frame.width, y: face.y / frame.height, width: face.width / frame.width, height: face.height / frame.height } : null,
      metrics: {
        // nitidez onde importa: com fundo parado, o quadro inteiro dá sempre o mesmo número
        sharpness: laplacianVariance(frame.gray, frame.width, frame.height, face ? growBox(face, 1.5, frame.width, frame.height) : undefined),
        brightness: meanBrightness(frame.gray),
        skin: skinRatio(frame.rgb),
      },
    };
  });

  const span = (candidates[candidates.length - 1]!.at - candidates[0]!.at) / Math.max(1, count);
  const chosen = pickFrames(measured, count, span / 3);
  const source = existsSync(analysis.renderSource) ? analysis.renderSource : analysis.proxy;
  if (source === analysis.proxy) log('atenção: arquivo fonte não encontrado; frames tirados do proxy (resolução menor)');
  const frames: PackFrame[] = [];
  for (const [position, frame] of chosen.entries()) {
    const file = join(pack.framesDir, `frame-${String(position + 1).padStart(2, '0')}.png`);
    await extractFrame(source, frame.at, file);
    const face = frame.face ?? null;
    frames.push({
      index: position + 1,
      at: frame.at,
      file,
      score: frame.score,
      ...frame.metrics,
      focus: face ? { x: Math.round((face.x + face.width / 2) * 1000) / 1000, y: Math.round((face.y + face.height / 2) * 1000) / 1000 } : null,
      face,
    });
  }

  const grid = contactGrid(frames.length);
  const tiles = [];
  for (const [position, frame] of frames.entries()) {
    const cell = grid.cells[position]!;
    const zoom = grid.faces[position]!;
    const { width = 0, height = 0 } = await sharp(frame.file).metadata();
    const crop = faceCrop(frame.face ? { x: frame.face.x * width, y: frame.face.y * height, width: frame.face.width * width, height: frame.face.height * height } : null, width, height);
    tiles.push(
      { input: await sharp(frame.file).resize(cell.width, cell.height, { fit: 'cover' }).toBuffer(), left: cell.x, top: cell.y },
      { input: await sharp(frame.file).extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height }).resize(zoom.width, zoom.height).toBuffer(), left: zoom.x, top: zoom.y },
    );
  }
  await sharp({ create: { width: grid.width, height: grid.height, channels: 3, background: '#0f172a' } })
    .composite([...tiles, { input: Buffer.from(contactSvg(grid, frames)), left: 0, top: 0 }])
    .png()
    .toFile(pack.framesSheet);
  writeJson(pack.framesIndex, frames);
  return { sheet: pack.framesSheet, frames };
}

/** Número da folha de contato → arquivo; texto → caminho (absoluto ou relativo ao projeto). */
export function resolveFrame(paths: ProjectPaths, frame: number | string): string {
  const pack = packPaths(paths);
  if (typeof frame === 'number') {
    const frames = existsSync(pack.framesIndex) ? readJson<PackFrame[]>(pack.framesIndex) : [];
    const found = frames.find((item) => item.index === frame);
    if (!found || !existsSync(found.file)) throw new Error(`Frame ${frame} não existe. Rode: pnpm mce pack frames ${paths.slug}`);
    return found.file;
  }
  const file = isAbsolute(frame) ? frame : resolve(paths.dir, frame);
  if (!existsSync(file)) throw new Error(`Imagem não encontrada: ${file}`);
  return file;
}

/** Sem `focus` no spec, vale o palpite de rosto que o `pack frames` gravou para aquele frame. */
function guessedFocus(paths: ProjectPaths, frame: number | string): { x: number; y: number } | undefined {
  const index = packPaths(paths).framesIndex;
  if (typeof frame !== 'number' || !existsSync(index)) return undefined;
  return readJson<PackFrame[]>(index).find((item) => item.index === frame)?.focus ?? undefined;
}

interface LoadedPhoto {
  photo: ThumbPhoto;
  file: string;
}

async function loadPhoto(file: string, focus: ThumbVariant['focus'], zoom: number | undefined): Promise<LoadedPhoto> {
  const image = sharp(file).resize({ width: 1920, withoutEnlargement: true });
  const { data, info } = await image.jpeg({ quality: 93, chromaSubsampling: '4:4:4' }).toBuffer({ resolveWithObject: true });
  return {
    file,
    photo: { src: `data:image/jpeg;base64,${data.toString('base64')}`, width: info.width, height: info.height, ...(focus ? { focus } : {}), ...(zoom ? { zoom } : {}) },
  };
}

function designOf(variant: ThumbVariant): ThumbDesign {
  const { frame: _frame, frame2: _frame2, focus: _focus, zoom: _zoom, focus2: _focus2, zoom2: _zoom2, dim: _dim, idea: _idea, ...design } = variant;
  return design;
}

/** Cor média da foto sob cada bloco de texto, já com o escurecimento que a capa aplica: é o fundo real do contraste. */
async function photoUnderText(design: ThumbDesign, photos: (LoadedPhoto | null)[], dim: number): Promise<[number, number, number][]> {
  const plan = planThumb(design);
  const colors: [number, number, number][] = [];
  for (const [index, item] of plan.blocks.entries()) {
    const slot = plan.images[Math.min(index, plan.images.length - 1)]!;
    const loaded = photos[Math.min(index, photos.length - 1)] ?? photos[0];
    if (!loaded || item.surface !== 'photo') {
      colors.push([128, 128, 128]);
      continue;
    }
    const placed = placeImage(loaded.photo, slot.box, loaded.photo.focus ?? { x: 0.5, y: 0.4 }, loaded.photo.zoom ?? 1, slot.anchor);
    const region = sourceRegion(placed, loaded.photo, { ...item.rect, x: item.rect.x - slot.box.x, y: item.rect.y - slot.box.y });
    const scaleX = (await sharp(loaded.file).metadata()).width / loaded.photo.width;
    const stats = await sharp(loaded.file)
      .extract({ left: Math.round(region.x * scaleX), top: Math.round(region.y * scaleX), width: Math.max(1, Math.round(region.width * scaleX)), height: Math.max(1, Math.round(region.height * scaleX)) })
      .stats();
    const factor = (slot.muted ? 0.72 : 1) * (1 - dim);
    colors.push(stats.channels.slice(0, 3).map((channel) => Math.round(channel.mean * factor)) as [number, number, number]);
  }
  return colors;
}

let bundled: Promise<string> | null = null;

/** Um still da composição `Thumbnail` com as props da variante. Casca fina sobre o Remotion. */
async function renderThumbnail(props: ThumbnailProps, output: string): Promise<void> {
  bundled ??= bundle({ entryPoint: MOTION_ENTRY, publicDir: ASSETS_DIR });
  const serveUrl = await bundled;
  const inputProps = props as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: 'Thumbnail', inputProps, chromiumOptions: CHROMIUM_OPTIONS });
  await renderStill({ serveUrl, composition, inputProps, output, imageFormat: 'png', chromiumOptions: CHROMIUM_OPTIONS });
}

/** O YouTube recusa capa acima de 2 MB: se o PNG passar, vira PNG de paleta (ainda .png, um pouco de dithering). */
async function fitUnderLimit(file: string): Promise<number> {
  const original = readFileSync(file);
  let output = await sharp(original).resize(THUMB.width, THUMB.height, { fit: 'fill' }).png({ compressionLevel: 9 }).toBuffer();
  for (const quality of [100, 90, 80]) {
    if (output.length < MAX_BYTES) break;
    output = await sharp(original).png({ palette: true, quality, colours: 256, dither: 1, compressionLevel: 9 }).toBuffer();
  }
  writeFileSync(file, output);
  return output.length;
}

export interface ThumbResult {
  index: number;
  file: string;
  bytes: number;
  problems: Problem[];
}

function finalDuration(paths: ProjectPaths): number {
  if (!listVersions(paths).length) return readJson<Analysis>(paths.analysis).source.durationSec;
  const edl = loadEdl(paths);
  const { introSec, outroSec } = bumperDurations(edl);
  return buildTimeline(edl.clips, edl.output.fps).durationSec + introSec + outroSec;
}

/** Renderiza cada variante (uma por vez) e monta a folha de comparação nos tamanhos em que o público vê. */
export async function packThumbs(paths: ProjectPaths, spec: PackSpec, log: Log): Promise<{ results: ThumbResult[]; sheet: string | null }> {
  if (spec.thumbs.length === 0) throw new Error('O spec não tem variantes de capa ("thumbs")');
  mkdirSync(paths.outputDir, { recursive: true });
  const results: ThumbResult[] = [];
  for (const [index, variant] of spec.thumbs.entries()) {
    const design = designOf(variant);
    const first = await loadPhoto(resolveFrame(paths, variant.frame), variant.focus ?? guessedFocus(paths, variant.frame), variant.zoom);
    const frame2 = variant.frame2 ?? variant.frame;
    const second =
      variant.layout === 'split'
        ? await loadPhoto(resolveFrame(paths, frame2), variant.focus2 ?? (variant.frame2 === undefined ? variant.focus : undefined) ?? guessedFocus(paths, frame2), variant.zoom2 ?? variant.zoom)
        : null;
    const problems = checkThumb(design, await photoUnderText(design, [first, second], variant.dim ?? 0));
    const file = join(paths.outputDir, `capa-${index + 1}.png`);
    await renderThumbnail({ ...design, photo: first.photo, photo2: second?.photo ?? null, dim: variant.dim ?? 0 }, file);
    const bytes = await fitUnderLimit(file);
    results.push({ index: index + 1, file, bytes, problems });
    log(`${file} (${(bytes / 1024).toFixed(0)} KB)`);
    for (const line of formatProblems(`capa ${index + 1} · ${variant.layout} · "${variant.text.replace(/\n/g, ' / ')}"`, problems)) log(`  ${line}`);
  }

  const sheet = compareSheet(results.length);
  const layers: { input: Buffer | { create: { width: number; height: number; channels: 3; background: string } }; left: number; top: number }[] = [];
  for (const band of sheet.bands) {
    layers.push({ input: { create: { width: band.width, height: band.height, channels: 3, background: COMPARE_TIERS[band.tier]!.background } }, left: band.x, top: band.y });
  }
  for (const tile of sheet.tiles) {
    layers.push({ input: await sharp(results[tile.variant]!.file).resize(tile.width, tile.height, { kernel: 'lanczos3' }).toBuffer(), left: tile.x, top: tile.y });
  }
  const labels = spec.thumbs.map((variant, index) => `capa ${index + 1}${variant.idea ? ` · ${variant.idea}` : ''}`);
  layers.push({ input: Buffer.from(compareSvg(sheet, labels, finalDuration(paths))), left: 0, top: 0 });
  const target = packPaths(paths).thumbsSheet;
  await sharp({ create: { width: sheet.width, height: sheet.height, channels: 3, background: '#0f0f0f' } }).composite(layers).png().toFile(target);
  return { results, sheet: target };
}

/** Capítulos no tempo do vídeo final: da EDL mais recente; sem EDL, o `capitulos.txt` já gerado. */
export function projectChapters(paths: ProjectPaths): string {
  if (listVersions(paths).length) {
    const edl = loadEdl(paths);
    const { chapters } = buildChapters(edl, buildTimeline(edl.clips, edl.output.fps), bumperDurations(edl).introSec);
    if (chapters.length) return renderChapters(chapters);
  }
  const file = join(paths.outputDir, 'capitulos.txt');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

export interface PackCheck {
  lines: string[];
  errors: number;
  warnings: number;
  description: string | null;
}

/** Tudo que dá para conferir sem olhar: tamanhos, repetição capa × título, estrutura da descrição, capítulos. */
export function packCheck(spec: PackSpec, chapters: string): PackCheck {
  const lines: string[] = [];
  const all: Problem[] = [];
  const report = (scope: string, problems: Problem[]) => {
    all.push(...problems);
    lines.push(...formatProblems(scope, problems));
  };
  const coverTexts = spec.thumbs.map((variant) => variant.text);

  if (spec.titles.length === 0) report('títulos', [{ level: 'error', code: 'sem-titulo', message: 'o spec não tem títulos' }]);
  else if (spec.titles.length < 3) report('títulos', [{ level: 'warning', code: 'poucos-titulos', message: `${spec.titles.length} título(s): entregue 3 (o recomendado e duas alternativas para teste A/B)` }]);
  spec.titles.forEach((title, index) => {
    const problems = checkTitle(title.text, { coverTexts, keyword: spec.keyword });
    if (!title.why.trim()) problems.push({ level: 'warning', code: 'sem-porque', message: 'falta a linha de porquê deste título' });
    report(`título ${index + 1} · "${title.text}"`, problems);
  });
  spec.thumbs.forEach((variant, index) => report(`capa ${index + 1} · ${variant.layout} · "${variant.text.replace(/\n/g, ' / ')}"`, checkThumb(designOf(variant))));

  let description: string | null = null;
  if (spec.description) {
    description = buildDescription(spec.description, chapters);
    report('descrição', checkDescription(description, { keyword: spec.keyword, expectedChapters: chapters }));
  } else report('descrição', [{ level: 'error', code: 'sem-descricao', message: 'o spec não tem "description"' }]);
  report('tags', spec.tags.length ? checkTags(spec.tags) : [{ level: 'warning', code: 'sem-tags', message: 'o spec não tem tags' }]);

  return {
    lines,
    errors: all.filter((problem) => problem.level === 'error').length,
    warnings: all.filter((problem) => problem.level === 'warning').length,
    description,
  };
}

/** Grava titulo.txt, descricao.txt e tags.txt. Com ERRO na conferência, não grava nada. */
export function packWrite(paths: ProjectPaths, spec: PackSpec): { check: PackCheck; files: string[] } {
  const check = packCheck(spec, projectChapters(paths));
  if (check.errors > 0 || check.description === null) return { check, files: [] };
  mkdirSync(paths.outputDir, { recursive: true });
  const outputs: [string, string][] = [
    ['titulo.txt', buildTitlesFile(spec.titles)],
    ['descricao.txt', check.description],
    ['tags.txt', buildTagsFile(spec.tags)],
  ];
  const files = outputs.map(([name, content]) => {
    const file = join(paths.outputDir, name);
    writeFileSync(file, content, 'utf8');
    return file;
  });
  return { check, files };
}

