import { spawn } from 'node:child_process';

import { CommandError } from '../lib/exec.ts';
import { round3 } from '../lib/time.ts';
import type { Span } from './types.ts';

export interface MotionOptions {
  /** largura da análise: quadro pequeno basta para saber se algo mexeu */
  width: number;
  /** sigma do desfoque que apaga ruído de compressão antes de comparar */
  blur: number;
  /** quadros por segundo analisados */
  sampleFps: number;
  /** diferença de luminância (0–255) abaixo da qual o pixel conta como igual */
  tolerance: number;
}

export const MOTION_DEFAULTS: MotionOptions = { width: 160, blur: 1, sampleFps: 10, tolerance: 8 };

/** Fração de pixels cuja luminância mudou além da tolerância (ideia do `motion` do auto-editor). */
export function diffRatio(previous: Uint8Array, current: Uint8Array, tolerance: number): number {
  let changed = 0;
  for (let i = 0; i < current.length; i++) if (Math.abs(current[i]! - previous[i]!) > tolerance) changed++;
  return changed / current.length;
}

/** Recebe bytes crus de frames em escala de cinza, em pedaços de tamanho qualquer, e emite o movimento de cada frame novo. */
export class FrameDiffer {
  private pending = new Uint8Array(0);
  private previous: Uint8Array | null = null;

  constructor(
    private readonly frameBytes: number,
    private readonly tolerance: number,
  ) {}

  push(chunk: Uint8Array): number[] {
    const joined = new Uint8Array(this.pending.length + chunk.length);
    joined.set(this.pending);
    joined.set(chunk, this.pending.length);
    const values: number[] = [];
    let offset = 0;
    while (joined.length - offset >= this.frameBytes) {
      const frame = joined.slice(offset, offset + this.frameBytes);
      if (this.previous) values.push(diffRatio(this.previous, frame, this.tolerance));
      this.previous = frame;
      offset += this.frameBytes;
    }
    this.pending = joined.slice(offset);
    return values;
  }
}

/**
 * Trechos em que o quadro quase não muda (`values[i]` é o movimento no instante i/sampleFps),
 * com duração mínima. Útil em gravação de tela, onde a fala para e nada se mexe.
 */
export function stillSpans(values: number[], sampleFps: number, options: { threshold: number; minStillSec: number }): Span[] {
  const spans: Span[] = [];
  let from = -1;
  const close = (endFrame: number) => {
    if (from < 0) return;
    const span = { start: round3(from / sampleFps), end: round3(endFrame / sampleFps) };
    if (span.end - span.start >= options.minStillSec - 1e-9) spans.push(span);
    from = -1;
  };
  values.forEach((value, index) => {
    if (value <= options.threshold) {
      if (from < 0) from = index;
    } else {
      close(index);
    }
  });
  close(values.length);
  return spans;
}

/** Fração (0–1) de `span` que está dentro de `others`. */
export function coverage(span: Span, others: Span[]): number {
  const length = span.end - span.start;
  if (length <= 0) return 0;
  let covered = 0;
  for (const other of others) covered += Math.max(0, Math.min(span.end, other.end) - Math.max(span.start, other.start));
  return Math.min(1, covered / length);
}

/** Movimento por quadro amostrado, lido do ffmpeg em fluxo (nada vai para disco). */
export async function measureMotion(
  videoPath: string,
  size: { width: number; height: number },
  options: Partial<MotionOptions> = {},
): Promise<number[]> {
  const o = { ...MOTION_DEFAULTS, ...options };
  const width = Math.max(16, Math.round(o.width / 2) * 2);
  const height = Math.max(16, Math.round((width * size.height) / size.width / 2) * 2);
  const filters = [`fps=${o.sampleFps}`, `scale=${width}:${height}`, 'format=gray', ...(o.blur > 0 ? [`gblur=sigma=${o.blur}`] : [])];
  const args = ['-hide_banner', '-nostdin', '-v', 'error', '-i', videoPath, '-an', '-vf', filters.join(','), '-f', 'rawvideo', '-pix_fmt', 'gray', '-'];

  const differ = new FrameDiffer(width * height, o.tolerance);
  const values: number[] = [];
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.stdout.on('data', (chunk: Buffer) => values.push(...differ.push(chunk)));
    child.on('error', (error) => reject(new CommandError('ffmpeg', null, String(error))));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new CommandError('ffmpeg', code, stderr))));
  });
  // o primeiro quadro não tem anterior: herda o movimento do segundo
  return values.length > 0 ? [values[0]!, ...values] : [];
}

export async function detectStills(
  videoPath: string,
  size: { width: number; height: number },
  options: Partial<MotionOptions> & { threshold?: number; minStillSec?: number } = {},
): Promise<Span[]> {
  const { threshold = 0.002, minStillSec = 0.8, ...motion } = options;
  const sampleFps = motion.sampleFps ?? MOTION_DEFAULTS.sampleFps;
  const values = await measureMotion(videoPath, size, motion);
  return stillSpans(values, sampleFps, { threshold, minStillSec });
}
