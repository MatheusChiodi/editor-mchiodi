import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import sharp, { type OverlayOptions } from 'sharp';

import type { PlacedClip } from '../edl/timeline.ts';
import { ffmpeg } from '../lib/ffmpeg.ts';
import { formatClock } from '../lib/time.ts';
import { type DecisionPoint, frameDiff, type JumpCut } from './edges.ts';

/** Largura dos quadros comparados no jump cut: pequeno o bastante para ignorar ruído, grande para ver o salto. */
export const DIFF_WIDTH = 160;

/** Tamanho (par) de um quadro com a largura dada, no aspecto do vídeo. */
export function scaledSize(width: number, height: number, targetWidth: number): { width: number; height: number } {
  return { width: targetWidth, height: Math.max(2, Math.round((targetWidth * height) / width / 2) * 2) };
}

/** Frame de saída em que cada corte cai: o último antes (`n-1`) e o primeiro depois (`n`). */
export function cutFrames(at: number, fps: number): { before: number; after: number } {
  const after = Math.max(1, Math.round(at * fps));
  return { before: after - 1, after };
}

/**
 * Lê só os quadros pedidos (índice de frame) em cinza, num passe único do ffmpeg (`select` por número de frame).
 * Um seek por corte custaria um processo por quadro; aqui é uma decodificação só, por grafo em arquivo.
 */
export async function grabGrayFrames(
  file: string,
  indices: readonly number[],
  size: { width: number; height: number },
  workDir: string,
): Promise<Map<number, Uint8Array>> {
  const wanted = [...new Set(indices)].filter((index) => index >= 0).sort((a, b) => a - b);
  const frames = new Map<number, Uint8Array>();
  if (wanted.length === 0) return frames;
  mkdirSync(workDir, { recursive: true });
  const graph = join(workDir, 'jump.graph.txt');
  const raw = join(workDir, 'jump.gray.raw');
  writeFileSync(graph, `[0:v]select='${wanted.map((index) => `eq(n,${index})`).join('+')}',scale=${size.width}:${size.height}:flags=area,format=gray[jg]`);
  await ffmpeg(['-i', file, '-/filter_complex', graph, '-map', '[jg]', '-an', '-fps_mode', 'passthrough', '-f', 'rawvideo', raw]);
  const bytes = readFileSync(raw);
  rmSync(raw);
  rmSync(graph);
  const frameSize = size.width * size.height;
  wanted.forEach((index, order) => {
    if ((order + 1) * frameSize <= bytes.length) frames.set(index, new Uint8Array(bytes.subarray(order * frameSize, (order + 1) * frameSize)));
  });
  return frames;
}

/** Diferença entre o último quadro antes e o primeiro depois de cada corte, no vídeo renderizado. */
export async function measureJumpCuts(
  file: string,
  cuts: readonly { at: number; clip: PlacedClip }[],
  video: { fps: number; width: number; height: number },
  workDir: string,
): Promise<JumpCut[]> {
  const size = scaledSize(video.width, video.height, DIFF_WIDTH);
  const pairs = cuts.map((cut) => ({ ...cut, ...cutFrames(cut.at, video.fps) }));
  const frames = await grabGrayFrames(file, pairs.flatMap((pair) => [pair.before, pair.after]), size, workDir);
  return pairs.flatMap((pair): JumpCut[] => {
    const before = frames.get(pair.before);
    const after = frames.get(pair.after);
    if (!before || !after) return [];
    return [{ at: pair.at, clip: pair.clip, diff: frameDiff(before, after, size.width, size.height) }];
  });
}

// ── prancha de contato ───────────────────────────────────────────────────────────

export interface SheetLayout {
  width: number;
  height: number;
  header: number;
  label: number;
  gap: number;
  tile: { width: number; height: number };
}

/** Geometria da prancha: cabeçalho, e uma linha por corte com rótulo | antes | depois. Quadro vertical vira mais estreito. */
export function sheetLayout(rows: number, video: { width: number; height: number }): SheetLayout {
  const tile = video.width >= video.height ? scaledSize(video.width, video.height, 480) : { width: Math.round((360 * video.width) / video.height / 2) * 2, height: 360 };
  const header = 56;
  const label = 300;
  const gap = 10;
  return {
    width: label + 2 * tile.width + 3 * gap,
    height: header + rows * (tile.height + gap) + gap,
    header,
    label,
    gap,
    tile,
  };
}

export function tileLeft(layout: SheetLayout, side: 'before' | 'after'): number {
  return layout.label + layout.gap + (side === 'after' ? layout.tile.width + layout.gap : 0);
}

export function rowTop(layout: SheetLayout, row: number): number {
  return layout.header + layout.gap + row * (layout.tile.height + layout.gap);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Camada de texto da prancha: título, e por linha o instante, a nota e os achados; "antes"/"depois" nos quadros. */
export function contactSheetSvg(title: string, points: readonly DecisionPoint[], layout: SheetLayout): string {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" font-family="Segoe UI, Arial, sans-serif">`,
    `<text x="14" y="36" fill="#f8f8f2" font-size="22" font-weight="600">${escapeXml(title)}</text>`,
  ];
  points.forEach((point, row) => {
    const top = rowTop(layout, row);
    parts.push(
      `<text x="14" y="${top + 34}" fill="#ff5555" font-size="26" font-weight="700">#${row + 1}  ${formatClock(point.at)}</text>`,
      `<text x="14" y="${top + 64}" fill="#94a3b8" font-size="16">nota ${point.score.toFixed(2)}</text>`,
      ...point.checks.map((check, index) => `<text x="14" y="${top + 96 + index * 24}" fill="#f8f8f2" font-size="18">• ${escapeXml(check)}</text>`),
    );
    for (const side of ['before', 'after'] as const) {
      const left = tileLeft(layout, side);
      parts.push(
        `<rect x="${left}" y="${top}" width="${side === 'before' ? 64 : 76}" height="24" fill="#0f172a" fill-opacity="0.8"/>`,
        `<text x="${left + 8}" y="${top + 17}" fill="#f8f8f2" font-size="15" font-weight="600">${side === 'before' ? 'antes' : 'depois'}</text>`,
      );
    }
  });
  parts.push('</svg>');
  return parts.join('\n');
}

/**
 * PNG com os cortes mais suspeitos (último quadro antes | primeiro depois), para o diretor olhar só ali.
 * Devolve `null` quando não há ponto para mostrar.
 */
export async function renderContactSheet(
  file: string,
  points: readonly DecisionPoint[],
  video: { fps: number; width: number; height: number },
  title: string,
  output: string,
): Promise<string | null> {
  if (points.length === 0) return null;
  const layout = sheetLayout(points.length, video);
  const tilesDir = join(dirname(output), 'sheet');
  mkdirSync(tilesDir, { recursive: true });
  const composite: OverlayOptions[] = [];
  for (const [row, point] of points.entries()) {
    const frames = cutFrames(point.at, video.fps);
    for (const side of ['before', 'after'] as const) {
      // o seek de entrada descarta todo quadro com pts < -ss: mirar no meio do quadro pularia para o seguinte
      const at = Math.max(0, frames[side] / video.fps - 0.0005);
      const tile = join(tilesDir, `${row}-${side}.png`);
      await ffmpeg(['-ss', at.toFixed(4), '-i', file, '-an', '-frames:v', '1', '-vf', `scale=${layout.tile.width}:${layout.tile.height}`, '-update', '1', tile]);
      composite.push({ input: readFileSync(tile), left: tileLeft(layout, side), top: rowTop(layout, row) });
    }
  }
  rmSync(tilesDir, { recursive: true, force: true });
  composite.push({ input: Buffer.from(contactSheetSvg(title, points, layout)), left: 0, top: 0 });
  mkdirSync(dirname(output), { recursive: true });
  await sharp({ create: { width: layout.width, height: layout.height, channels: 3, background: '#1e293b' } })
    .composite(composite)
    .png()
    .toFile(output);
  return output;
}
