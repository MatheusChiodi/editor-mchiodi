import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Analysis } from '../analyze/types.ts';
import { ffmpeg, videoEncodeArgs } from '../lib/ffmpeg.ts';
import { type ProjectPaths, readJson, writeJson } from '../project/paths.ts';

export const PEAKS_PER_SEC = 100;
const PEAK_RATE = 8000;

export function proxyDir(paths: Pick<ProjectPaths, 'rendersDir'>): string {
  return join(paths.rendersDir, 'proxy');
}

export interface Waveform {
  peaksPerSec: number;
  durationSec: number;
  /** pico absoluto de cada janela, 0–255 */
  peaks: number[];
}

/** Acumula picos de PCM s16le mono em janelas fixas; aceita pedaços de qualquer tamanho (até byte ímpar). */
export function createPeakAccumulator(samplesPerPeak: number) {
  const peaks: number[] = [];
  let current = 0;
  let count = 0;
  let carry: number | null = null;
  const take = (sample: number) => {
    const value = Math.abs(sample);
    if (value > current) current = value;
    count += 1;
    if (count >= samplesPerPeak) {
      peaks.push(Math.min(255, Math.round((current / 32768) * 255)));
      current = 0;
      count = 0;
    }
  };
  return {
    push(chunk: Uint8Array) {
      let offset = 0;
      if (carry !== null && chunk.length > 0) {
        take(((chunk[0]! << 8) | carry) << 16 >> 16);
        carry = null;
        offset = 1;
      }
      for (; offset + 1 < chunk.length; offset += 2) take(((chunk[offset + 1]! << 8) | chunk[offset]!) << 16 >> 16);
      if (offset < chunk.length) carry = chunk[offset]!;
    },
    finish(): number[] {
      if (count > 0) peaks.push(Math.min(255, Math.round((current / 32768) * 255)));
      current = 0;
      count = 0;
      return peaks;
    },
  };
}

/** Lê o áudio pelo ffmpeg (PCM no stdout, binário) e devolve os picos. */
export function decodePeaks(input: string, peaksPerSec = PEAKS_PER_SEC): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const accumulator = createPeakAccumulator(Math.round(PEAK_RATE / peaksPerSec));
    const child = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', input, '-vn', '-ac', '1', '-ar', String(PEAK_RATE), '-f', 's16le', '-'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => accumulator.push(chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(accumulator.finish()) : reject(new Error(`ffmpeg (forma de onda) saiu com ${code}: ${stderr.slice(-500)}`))));
  });
}

/** Fonte do áudio para a forma de onda: o wav 16 kHz da análise (leve) ou o proxy. */
function waveformInput(paths: ProjectPaths, analysis: Analysis): string {
  return existsSync(paths.audio16k) ? paths.audio16k : analysis.proxy;
}

/** Forma de onda pré-calculada uma vez e guardada em renders/proxy/peaks.json (refeita se o áudio mudar). */
export async function ensureWaveform(paths: ProjectPaths): Promise<Waveform> {
  const analysis = readJson<Analysis>(paths.analysis);
  const input = waveformInput(paths, analysis);
  const file = join(proxyDir(paths), 'peaks.json');
  const stamp = `${statSync(input).size}:${Math.round(statSync(input).mtimeMs)}`;
  if (existsSync(file)) {
    const cached = readJson<Waveform & { stamp?: string }>(file);
    if (cached.stamp === stamp && cached.peaksPerSec === PEAKS_PER_SEC) return { peaksPerSec: cached.peaksPerSec, durationSec: cached.durationSec, peaks: cached.peaks };
  }
  const peaks = await decodePeaks(input);
  const waveform: Waveform = { peaksPerSec: PEAKS_PER_SEC, durationSec: analysis.source.durationSec, peaks };
  writeJson(file, { ...waveform, stamp });
  return waveform;
}

export function proxyFile(paths: Pick<ProjectPaths, 'rendersDir'>): string {
  return join(proxyDir(paths), 'proxy.mp4');
}

/**
 * Proxy do player, gerado uma vez em renders/proxy/. O proxy da análise (720p, GOP de 1 s, AAC) já serve ao
 * navegador: só é remuxado com `faststart` (segundos, sem reencode). Sem ele, encoda um 540p a partir da fonte.
 */
export async function ensureProxy(paths: ProjectPaths): Promise<string> {
  const file = proxyFile(paths);
  if (existsSync(file)) return file;
  mkdirSync(proxyDir(paths), { recursive: true });
  const analysis = readJson<Analysis>(paths.analysis);
  const partial = `${file}.part.mp4`;
  rmSync(partial, { force: true });
  if (existsSync(analysis.proxy)) {
    await ffmpeg(['-i', analysis.proxy, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', partial]);
  } else {
    const fps = Math.min(analysis.source.fps, 30);
    await ffmpeg([
      '-i', analysis.renderSource,
      '-vf', `fps=${fps},scale=-2:540`,
      ...(await videoEncodeArgs('proxy')), '-g', String(Math.round(fps / 2)),
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', partial,
    ]);
  }
  renameSync(partial, file);
  return file;
}
