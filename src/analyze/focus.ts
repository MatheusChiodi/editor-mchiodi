import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { z } from 'zod';

import type { ProgressFn } from '../lib/ffmpeg.ts';
import type { FocusSample } from '../render/focus.ts';

/**
 * Detector leve do apresentador para o foco do Short: amostra o proxy em baixa taxa e resolução (um passe do
 * ffmpeg, RGB cru por pipe) e estima, quadro a quadro, o centro horizontal de quem fala. Sem modelo, offline.
 * As funções de perfil são puras; `detectFocusTrack` é a casca que chama o ffmpeg e guarda o cache.
 */

/** Sobe quando a heurística muda: invalida os caches antigos. */
export const FOCUS_ALGO_VERSION = 3;

export interface DetectParams {
  /** quadros por segundo amostrados */
  fps: number;
  /** largura do quadro analisado (px) */
  width: number;
}

export const DEFAULT_DETECT_PARAMS: DetectParams = { fps: 2, width: 192 };

export interface FocusTrack {
  /** arquivo analisado (ou `manual` quando veio de focus-track.json) */
  source: string;
  fps: number;
  width: number;
  height: number;
  samples: FocusSample[];
}

/** Diferença de luma abaixo disso é ruído de compressão, não movimento. */
const MOTION_FLOOR = 10;
/** Peso do movimento acumulado contra a massa de pele no perfil de colunas. */
const MOTION_WEIGHT = 0.55;
/** Memória do movimento: a 2 fps, ~1 s. Quem fala se mexe pouco por quadro, mas sempre no mesmo lugar. */
const MOTION_DECAY = 0.6;

const luma = (r: number, g: number, b: number) => (77 * r + 150 * g + 29 * b) >> 8;

/** Regra clássica de pele em YCbCr (Cb 77–127, Cr 133–173), com luma mínima para não pegar sombra. */
export function isSkin(r: number, g: number, b: number): boolean {
  const y = luma(r, g, b);
  if (y < 50) return false;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

export interface FrameProfile {
  gray: Uint8Array;
  /** soma, por coluna, da diferença de luma para o quadro anterior (acima do ruído) */
  motion: Float64Array;
  /** pixels de pele por coluna (ponderados) */
  skin: Float64Array;
  /** 1 onde o pixel é pele (linha a linha), para achar a altura do rosto */
  skinMask: Uint8Array;
}

/**
 * Peso da linha (0 = topo): rosto e tronco de quem fala sentado ficam na parte de cima; mãos que gesticulam,
 * braços e mesa ficam embaixo e puxariam o foco para o lado do gesto. Pleno até 55% da altura, cai até 0,2 no pé.
 */
export function rowWeight(y: number): number {
  return y <= 0.55 ? 1 : Math.max(0.2, 1 - ((y - 0.55) / 0.45) * 0.8);
}

/** Perfis por coluna (ponderados por `rowWeight`) de um quadro RGB24 `width × height`. */
export function frameProfile(rgb: Uint8Array, previous: Uint8Array | null, width: number, height: number): FrameProfile {
  const gray = new Uint8Array(width * height);
  const motion = new Float64Array(width);
  const skin = new Float64Array(width);
  const skinMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const weight = rowWeight(y / height);
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const r = rgb[pixel * 3]!;
      const g = rgb[pixel * 3 + 1]!;
      const b = rgb[pixel * 3 + 2]!;
      const value = luma(r, g, b);
      gray[pixel] = value;
      if (previous) motion[x] = motion[x]! + Math.max(0, Math.abs(value - previous[pixel]!) - MOTION_FLOOR) * weight;
      if (isSkin(r, g, b)) {
        skin[x] = skin[x]! + weight;
        skinMask[pixel] = 1;
      }
    }
  }
  return { gray, motion, skin, skinMask };
}

function normalized(values: Float64Array, floor: number): Float64Array {
  const peak = Math.max(...values);
  const out = new Float64Array(values.length);
  if (peak <= floor) return out;
  for (let index = 0; index < values.length; index += 1) out[index] = values[index]! / peak;
  return out;
}

function boxBlur(values: Float64Array, radius: number): Float64Array {
  const out = new Float64Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, index - radius); k <= Math.min(values.length - 1, index + radius); k += 1) {
      sum += values[k]!;
      count += 1;
    }
    out[index] = sum / count;
  }
  return out;
}

/**
 * Centro do apresentador a partir dos perfis de coluna: movimento acumulado + pele, normalizados, borrados na
 * largura de um tronco (~10% do quadro). Centro = centróide em volta do pico; confiança = quanto o pico se destaca
 * da média (perfil chato = ninguém em particular). Contraste/bordas ficou de fora: estante e monitor ao fundo
 * têm mais borda que o rosto.
 */
export function estimateCenter(motion: Float64Array, skin: Float64Array, height: number): { x: number; confidence: number } {
  const width = motion.length;
  const m = normalized(motion, height);
  const s = normalized(skin, height * 0.04);
  const combined = new Float64Array(width);
  for (let index = 0; index < width; index += 1) combined[index] = MOTION_WEIGHT * m[index]! + (1 - MOTION_WEIGHT) * s[index]!;
  const blurred = boxBlur(combined, Math.max(1, Math.round(width * 0.05)));
  let peak = 0;
  for (let index = 1; index < width; index += 1) if (blurred[index]! > blurred[peak]!) peak = index;
  const top = blurred[peak]!;
  if (top <= 1e-6) return { x: 0.5, confidence: 0 };
  const radius = Math.max(1, Math.round(width * 0.08));
  let weight = 0;
  let moment = 0;
  for (let index = Math.max(0, peak - radius); index <= Math.min(width - 1, peak + radius); index += 1) {
    const value = Math.max(0, blurred[index]! - top / 2);
    weight += value;
    moment += value * (index + 0.5);
  }
  const mean = blurred.reduce((sum, value) => sum + value, 0) / width;
  return { x: (weight > 0 ? moment / weight : peak + 0.5) / width, confidence: Math.min(1, Math.max(0, (top - mean) / top)) };
}

/**
 * Centro do rosto (frações do quadro) a partir do centro do apresentador `x`. Altura: na faixa de colunas em volta
 * de `x`, a primeira corrida de linhas com pele (de cima para baixo) é testa→queixo; o cabelo não é pele e o
 * pescoço, mais estreito, fica abaixo do limiar. Só olha os 80% de cima (mãos e braços moram embaixo). Largura:
 * centróide da pele nessas linhas numa faixa mais larga (o centro do apresentador puxa para o lado do gesto e do
 * tronco; o cartão vertical do palco precisa do rosto). `null` quando quase não há pele na faixa.
 */
export function estimateFace(skinMask: Uint8Array, width: number, height: number, x: number): { x: number; y: number } | null {
  const half = Math.max(1, Math.round(width * 0.05));
  const center = Math.round(x * width);
  const from = Math.max(0, center - half);
  const to = Math.min(width - 1, center + half);
  const rows = Math.max(1, Math.round(height * 0.8));
  const counts = new Float64Array(rows);
  for (let y = 0; y < rows; y += 1) {
    let count = 0;
    for (let column = from; column <= to; column += 1) count += skinMask[y * width + column]!;
    counts[y] = count;
  }
  const peak = Math.max(...counts);
  if (peak < (to - from + 1) * 0.2) return null;
  const threshold = peak * 0.4;
  const first = counts.findIndex((count) => count >= threshold);
  let last = first;
  // tolera uma linha falhada (óculos, sombra) sem sair do rosto
  while (last + 1 < rows && (counts[last + 1]! >= threshold || (last + 2 < rows && counts[last + 2]! >= threshold))) last += 1;
  const wide = Math.max(1, Math.round(width * 0.1));
  let weight = 0;
  let moment = 0;
  for (let y = first; y <= last; y += 1) {
    for (let column = Math.max(0, center - wide); column <= Math.min(width - 1, center + wide); column += 1) {
      if (skinMask[y * width + column]) {
        weight += 1;
        moment += column + 0.5;
      }
    }
  }
  return { x: weight > 0 ? moment / weight / width : x, y: (first + last + 1) / 2 / height };
}

/** Acumula o movimento entre quadros (decaimento) e devolve uma amostra por quadro. */
export class FocusAccumulator {
  private previous: Uint8Array | null = null;
  private motion: Float64Array;
  private index = 0;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly fps: number,
  ) {
    this.motion = new Float64Array(width);
  }

  push(rgb: Uint8Array): FocusSample {
    const profile = frameProfile(rgb, this.previous, this.width, this.height);
    for (let x = 0; x < this.width; x += 1) this.motion[x] = MOTION_DECAY * this.motion[x]! + (1 - MOTION_DECAY) * profile.motion[x]!;
    this.previous = profile.gray;
    const { x, confidence } = estimateCenter(this.motion, profile.skin, this.height);
    const face = estimateFace(profile.skinMask, this.width, this.height, x);
    const sample: FocusSample = {
      t: Number((this.index / this.fps).toFixed(3)),
      x: Number(x.toFixed(4)),
      confidence: Number(confidence.toFixed(3)),
      ...(face ? { face: { x: Number(face.x.toFixed(4)), y: Number(face.y.toFixed(4)) } } : {}),
    };
    this.index += 1;
    return sample;
  }
}

// ── track externo (correção à mão) ──────────────────────────────────────────────

const trackSample = z.object({
  t: z.number().nonnegative(),
  x: z.number().min(0).max(1),
  /** centro do rosto (frações do quadro), opcional: sem ele o palco usa `x` e a faixa do rosto */
  face: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  confidence: z.number().min(0).max(1).default(1),
});

export const focusTrackFileSchema = z.union([
  z.object({ samples: z.array(trackSample).min(1) }),
  z.array(trackSample).min(1),
]);

/** `analysis/focus-track.json`: `{ samples: [{ t, x, confidence? }] }` (ou só a lista); `x` = centro do apresentador. */
export function parseFocusTrackFile(data: unknown): FocusSample[] {
  const parsed = focusTrackFileSchema.parse(data);
  return (Array.isArray(parsed) ? parsed : parsed.samples).sort((a, b) => a.t - b.t);
}

export function manualTrackPath(analysisDir: string): string {
  return join(analysisDir, 'focus-track.json');
}

// ── casca: ffmpeg + cache ───────────────────────────────────────────────────────

export interface CacheKey {
  path: string;
  size: number;
  mtimeMs: number;
  fps: number;
  width: number;
  algo: number;
}

export function cacheKey(file: string, params: DetectParams): CacheKey {
  const stat = statSync(file);
  return { path: resolve(file), size: stat.size, mtimeMs: Math.round(stat.mtimeMs), fps: params.fps, width: params.width, algo: FOCUS_ALGO_VERSION };
}

export function sameKey(a: CacheKey | undefined, b: CacheKey): boolean {
  return !!a && (Object.keys(b) as (keyof CacheKey)[]).every((key) => a[key] === b[key]);
}

export interface DetectOptions {
  /** onde fica `focus-detect.json` (analysis/) */
  cacheDir: string;
  /** dimensões do arquivo, para a altura do quadro analisado */
  video: { width: number; height: number; durationSec?: number };
  params?: Partial<DetectParams>;
  /** ignora o cache */
  force?: boolean;
  onProgress?: ProgressFn;
}

/** Track do apresentador no arquivo inteiro (cacheado por caminho+tamanho+mtime+parâmetros). */
export async function detectFocusTrack(file: string, options: DetectOptions): Promise<FocusTrack> {
  const params = { ...DEFAULT_DETECT_PARAMS, ...options.params };
  const key = cacheKey(file, params);
  const cacheFile = join(options.cacheDir, 'focus-detect.json');
  if (!options.force && existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8')) as { key?: CacheKey; track?: FocusTrack };
    if (cached.track && sameKey(cached.key, key)) return cached.track;
  }
  const width = params.width;
  const height = Math.max(2, Math.round((width * options.video.height) / options.video.width / 2) * 2);
  mkdirSync(options.cacheDir, { recursive: true });
  const graph = join(options.cacheDir, 'focus-detect.graph.txt');
  writeFileSync(graph, `[0:v]fps=${params.fps}:start_time=0,scale=${width}:${height}:flags=area,format=rgb24[fd]`);
  const accumulator = new FocusAccumulator(width, height, params.fps);
  const samples: FocusSample[] = [];
  await streamFrames(file, graph, width * height * 3, (frame) => samples.push(accumulator.push(frame)), options);
  const track: FocusTrack = { source: key.path, fps: params.fps, width, height, samples };
  writeFileSync(cacheFile, JSON.stringify({ key, createdAt: new Date().toISOString(), track }));
  return track;
}

/** RGB cru por pipe, quadro a quadro: o arquivo inteiro nunca fica na memória nem no disco. */
function streamFrames(file: string, graph: string, frameSize: number, onFrame: (frame: Uint8Array) => void, options: DetectOptions): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-i', file, '-/filter_complex', graph, '-map', '[fd]', '-an', '-f', 'rawvideo', 'pipe:1'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let pending: Buffer = Buffer.alloc(0);
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      let offset = 0;
      while (pending.length - offset >= frameSize) {
        onFrame(new Uint8Array(pending.buffer, pending.byteOffset + offset, frameSize));
        offset += frameSize;
      }
      pending = pending.subarray(offset);
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000);
      const match = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(chunk);
      const total = options.video.durationSec;
      if (match && total && options.onProgress) {
        const time = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        options.onProgress({ label: 'foco', percent: Math.min(100, (time / total) * 100), etaSec: null });
      }
    });
    child.on('error', (error) => fail(error));
    child.on('close', (code) => (code === 0 ? done() : fail(new Error(`ffmpeg (detector de foco) saiu com código ${code}\n${stderr.split('\n').slice(-10).join('\n')}`))));
  });
}
