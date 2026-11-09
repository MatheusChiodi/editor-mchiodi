import { spawn } from 'node:child_process';

import { CommandError } from '../lib/exec.ts';
import { Spectrum } from './fft.ts';

export const BARS = 16;

export interface AudioFeatures {
  fps: number;
  frames: number;
  durationSec: number;
  bass: number[];
  mid: number[];
  treble: number[];
  rms: number[];
  /** barras do espectro em escala log, `frames × BARS`, 0–1 */
  bars: number[][];
}

export interface OnsetEnvelope {
  rate: number;
  values: number[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Decodifica qualquer áudio para mono float32 na taxa pedida, em fluxo pelo ffmpeg. */
export async function decodeMono(path: string, sampleRate = 22050): Promise<Float32Array> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', '-'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', (error) => reject(new CommandError('ffmpeg', null, String(error))));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new CommandError('ffmpeg', code, stderr))));
  });
  const bytes = Buffer.concat(chunks);
  // copia para um buffer alinhado: o Buffer do Node pode começar fora de múltiplo de 4
  const aligned = new Uint8Array(bytes.length - (bytes.length % 4));
  aligned.set(bytes.subarray(0, aligned.length));
  return new Float32Array(aligned.buffer);
}

/** Faixas de bins: grave 20–250 Hz, médio 250 Hz–2 kHz, agudo 2–8 kHz. */
export function bandRanges(sampleRate: number, size: number): { bass: [number, number]; mid: [number, number]; treble: [number, number] } {
  const bin = (hz: number) => Math.round((hz * size) / sampleRate);
  return { bass: [bin(20), bin(250)], mid: [bin(250), bin(2000)], treble: [bin(2000), bin(8000)] };
}

/** Normaliza para 0–1 pelo percentil `p` (resistente a picos); `minRef` impede que ruído de fundo vire sinal. */
export function percentileNormalize(values: number[], p = 0.95, minRef = 0): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const ref = Math.max(sorted[Math.floor(p * (sorted.length - 1))]!, minRef);
  if (ref <= 1e-9) return values.map(() => 0);
  return values.map((value) => clamp01(value / ref));
}

/** Filtro exponencial com subida e descida distintas (ExpFilter do audio-reactive-led-strip): ataca rápido, solta devagar. */
export function expSmooth(values: number[], rise: number, decay: number): number[] {
  const out: number[] = [];
  let state = values[0] ?? 0;
  for (const value of values) {
    state += (value > state ? rise : decay) * (value - state);
    out.push(state);
  }
  return out;
}

const compress = (energy: number) => Math.log1p(energy * 30);

/**
 * Características por quadro de vídeo: graves, médios, agudos, volume e barras do espectro. Cada série é
 * normalizada pelo seu percentil 95 (com piso relativo, para o ruído de uma banda vazia não virar sinal) e suavizada.
 */
export function analyzeSpectrum(samples: Float32Array, sampleRate: number, options: { fps: number; size?: number; bars?: number }): AudioFeatures {
  const { fps, size = 2048, bars = BARS } = options;
  const spectrum = new Spectrum(size);
  const ranges = bandRanges(sampleRate, size);
  const half = size / 2;
  const edges = Array.from({ length: bars + 1 }, (_, b) => Math.min(half, Math.max(1, Math.round((40 * (10000 / 40) ** (b / bars) * size) / sampleRate))));
  const frames = Math.floor((samples.length / sampleRate) * fps);

  const rawBass: number[] = [];
  const rawMid: number[] = [];
  const rawTreble: number[] = [];
  const rawRms: number[] = [];
  const rawBars: number[][] = [];
  const band = (mags: Float64Array, [from, to]: [number, number]) => {
    let sum = 0;
    for (let k = from; k < Math.min(to, mags.length); k++) sum += mags[k]! * mags[k]!;
    return compress(Math.sqrt(sum));
  };

  for (let frame = 0; frame < frames; frame++) {
    const center = Math.round((frame * sampleRate) / fps);
    const start = center - size / 2;
    const mags = spectrum.compute(samples, start);
    rawBass.push(band(mags, ranges.bass));
    rawMid.push(band(mags, ranges.mid));
    rawTreble.push(band(mags, ranges.treble));
    rawBars.push(Array.from({ length: bars }, (_, b) => band(mags, [edges[b]!, Math.max(edges[b]! + 1, edges[b + 1]!)])));
    let energy = 0;
    for (let i = 0; i < size; i++) {
      const value = samples[start + i] ?? 0;
      energy += value * value;
    }
    rawRms.push(Math.sqrt(energy / size));
  }

  const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(0.95 * Math.max(0, values.length - 1))] ?? 0;
  const bandRef = Math.max(p95(rawBass), p95(rawMid), p95(rawTreble));
  const norm = (values: number[]) => expSmooth(percentileNormalize(values, 0.95, bandRef * 0.1), 0.7, 0.2);

  const barRef = Math.max(0, ...rawBars.flatMap((row) => [p95(row)]));
  const barSeries = Array.from({ length: bars }, (_, b) => expSmooth(percentileNormalize(rawBars.map((row) => row[b]!), 0.95, barRef * 0.1), 0.7, 0.25));

  return {
    fps,
    frames,
    durationSec: samples.length / sampleRate,
    bass: norm(rawBass),
    mid: norm(rawMid),
    treble: norm(rawTreble),
    rms: expSmooth(percentileNormalize(rawRms, 0.95), 0.6, 0.15),
    bars: Array.from({ length: frames }, (_, frame) => barSeries.map((series) => series[frame]!)),
  };
}

/**
 * Envelope de onset (fluxo espectral positivo em log): sobe onde entra som novo. É a base do tempo e das batidas;
 * taxa mais alta que a do vídeo para a batida cair no instante certo.
 */
export function onsetEnvelope(samples: Float32Array, sampleRate: number, rate = 100, size = 1024): OnsetEnvelope {
  const spectrum = new Spectrum(size);
  const frames = Math.floor((samples.length / sampleRate) * rate);
  const values: number[] = [];
  let previous: Float64Array | null = null;
  const top = Math.min(size / 2, Math.round((5000 * size) / sampleRate));
  for (let frame = 0; frame < frames; frame++) {
    const mags = spectrum.compute(samples, Math.round((frame * sampleRate) / rate) - size / 2);
    const current = new Float64Array(top);
    let flux = 0;
    for (let k = 1; k < top; k++) {
      current[k] = Math.log1p(mags[k]! * 50);
      if (previous) flux += Math.max(0, current[k]! - previous[k]!);
    }
    values.push(flux);
    previous = current;
  }
  return { rate, values };
}
