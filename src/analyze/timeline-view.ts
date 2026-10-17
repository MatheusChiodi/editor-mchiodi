import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

import { ffmpeg } from '../lib/ffmpeg.ts';
import { formatClock } from '../lib/time.ts';
import type { Span } from './types.ts';

export interface ViewWord extends Span {
  text: string;
}

export interface ViewBand extends Span {
  kind: 'kept' | 'removed' | 'silence';
}

export interface ViewMarker {
  at: number;
  label: string;
}

export interface TimelineViewInput {
  title: string;
  from: number;
  to: number;
  words: ViewWord[];
  bands: ViewBand[];
  markers: ViewMarker[];
}

export const VIEW = { width: 1920, header: 44, strip: 136, wave: 150, words: 132, frames: 8 } as const;
export const VIEW_HEIGHT = VIEW.header + VIEW.strip + VIEW.wave + VIEW.words;

const BAND_COLOR: Record<ViewBand['kind'], string> = {
  kept: 'rgba(52,211,153,0.22)',
  removed: 'rgba(255,85,85,0.38)',
  silence: 'rgba(148,163,184,0.25)',
};

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Camada vetorial da timeline: régua de tempo, faixas (mantido/cortado/silêncio), marcadores
 * de corte e as palavras na posição em que são ditas. É o que deixa o diretor "ver" um corte.
 */
export function buildTimelineSvg(input: TimelineViewInput): string {
  const { from, to } = input;
  const span = Math.max(0.001, to - from);
  const x = (time: number) => ((Math.min(Math.max(time, from), to) - from) / span) * VIEW.width;
  const waveTop = VIEW.header + VIEW.strip;
  const wordsTop = waveTop + VIEW.wave;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW.width}" height="${VIEW_HEIGHT}" font-family="Segoe UI, Arial, sans-serif">`,
    `<rect x="0" y="0" width="${VIEW.width}" height="${VIEW.header}" fill="#0f172a"/>`,
    `<rect x="0" y="${wordsTop}" width="${VIEW.width}" height="${VIEW.words}" fill="#0f172a"/>`,
    `<text x="12" y="29" fill="#f8f8f2" font-size="20" font-weight="600">${escapeXml(input.title)}  ·  ${formatClock(from)} → ${formatClock(to)}</text>`,
  ];

  for (const band of input.bands) {
    if (band.end <= from || band.start >= to) continue;
    const left = x(band.start);
    parts.push(
      `<rect x="${left.toFixed(1)}" y="${waveTop}" width="${Math.max(1, x(band.end) - left).toFixed(1)}" height="${VIEW.wave}" fill="${BAND_COLOR[band.kind]}"/>`,
    );
  }

  const step = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60].find((value) => span / value <= 16) ?? 120;
  for (let tick = Math.ceil(from / step) * step; tick <= to + 1e-6; tick += step) {
    const left = x(tick).toFixed(1);
    parts.push(
      `<line x1="${left}" y1="${waveTop}" x2="${left}" y2="${waveTop + 10}" stroke="#f8f8f2" stroke-width="2"/>`,
      `<text x="${left}" y="${waveTop + 26}" fill="#f8f8f2" font-size="14" text-anchor="middle">${formatClock(tick, step < 1 ? 2 : 1)}</text>`,
    );
  }

  // palavras em 3 linhas alternadas para não colidirem
  input.words
    .filter((word) => word.end > from && word.start < to)
    .forEach((word, index) => {
      const left = x(word.start);
      const right = x(word.end);
      const row = wordsTop + 26 + (index % 3) * 34;
      parts.push(
        `<line x1="${left.toFixed(1)}" y1="${wordsTop}" x2="${left.toFixed(1)}" y2="${row - 14}" stroke="#64748b" stroke-width="1"/>`,
        `<rect x="${left.toFixed(1)}" y="${wordsTop}" width="${Math.max(1, right - left).toFixed(1)}" height="5" fill="#34d399"/>`,
        `<text x="${(left + 2).toFixed(1)}" y="${row}" fill="#f8f8f2" font-size="17">${escapeXml(word.text)}</text>`,
      );
    });

  for (const marker of input.markers) {
    if (marker.at < from || marker.at > to) continue;
    const left = x(marker.at).toFixed(1);
    parts.push(
      `<line x1="${left}" y1="${VIEW.header}" x2="${left}" y2="${VIEW_HEIGHT}" stroke="#ff5555" stroke-width="3"/>`,
      `<rect x="${left}" y="${VIEW.header}" width="${marker.label.length * 9 + 12}" height="22" fill="#ff5555"/>`,
      `<text x="${Number(left) + 6}" y="${VIEW.header + 16}" fill="#111827" font-size="14" font-weight="700">${escapeXml(marker.label)}</text>`,
    );
  }
  parts.push('</svg>');
  return parts.join('\n');
}

export interface RenderViewOptions extends TimelineViewInput {
  video: string;
  /** áudio para a forma de onda; padrão: o do próprio vídeo */
  audio?: string;
  output: string;
}

/** PNG com tira de frames + forma de onda + palavras de um intervalo. */
export async function renderTimelineView(options: RenderViewOptions): Promise<string> {
  const duration = options.to - options.from;
  if (duration <= 0) throw new Error('Intervalo vazio: --to precisa ser maior que --from');
  mkdirSync(dirname(options.output), { recursive: true });
  const base = options.output.replace(/\.png$/i, '');
  const strip = `${base}.strip.png`;
  const wave = `${base}.wave.png`;
  const frameWidth = VIEW.width / VIEW.frames;
  const seek = ['-ss', options.from.toFixed(3), '-t', duration.toFixed(3)];

  await Promise.all([
    ffmpeg([
      ...seek, '-i', options.video, '-an',
      '-vf', `fps=${VIEW.frames}/${duration.toFixed(3)},scale=${frameWidth}:${VIEW.strip}:force_original_aspect_ratio=increase,crop=${frameWidth}:${VIEW.strip},tile=${VIEW.frames}x1`,
      '-frames:v', '1', '-update', '1', strip,
    ]),
    ffmpeg([
      ...seek, '-i', options.audio ?? options.video,
      '-filter_complex', `aformat=channel_layouts=mono,showwavespic=s=${VIEW.width}x${VIEW.wave}:colors=0xf8f8f2:scale=sqrt`,
      '-frames:v', '1', '-update', '1', wave,
    ]),
  ]);

  await sharp({
    create: { width: VIEW.width, height: VIEW_HEIGHT, channels: 3, background: '#1e293b' },
  })
    .composite([
      { input: await sharp(strip).resize(VIEW.width, VIEW.strip, { fit: 'fill' }).toBuffer(), left: 0, top: VIEW.header },
      { input: wave, left: 0, top: VIEW.header + VIEW.strip },
      { input: Buffer.from(buildTimelineSvg(options)), left: 0, top: 0 },
    ])
    .png()
    .toFile(options.output);
  return options.output;
}

/** Faixas da visão da fonte: silêncios e, se houver EDL, o que fica (verde) e o que sai (vermelho). */
export function sourceBands(silences: Span[], edl: { clips: Span[]; source: { durationSec: number } } | null): ViewBand[] {
  const bands: ViewBand[] = silences.map((span) => ({ ...span, kind: 'silence' }));
  if (!edl) return bands;
  let cursor = 0;
  for (const clip of edl.clips) {
    if (clip.start > cursor) bands.push({ start: cursor, end: clip.start, kind: 'removed' });
    bands.push({ start: clip.start, end: clip.end, kind: 'kept' });
    cursor = clip.end;
  }
  if (cursor < edl.source.durationSec) bands.push({ start: cursor, end: edl.source.durationSec, kind: 'removed' });
  return bands;
}

export async function extractFrame(video: string, at: number, output: string): Promise<string> {
  mkdirSync(dirname(output), { recursive: true });
  await ffmpeg(['-ss', Math.max(0, at).toFixed(3), '-i', video, '-an', '-frames:v', '1', '-update', '1', output]);
  return output;
}

export function viewPath(dir: string, from: number, to: number, tag = 'src'): string {
  return join(dir, `view-${tag}-${from.toFixed(2)}-${to.toFixed(2)}.png`);
}
