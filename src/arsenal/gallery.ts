import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

import { ffmpeg } from '../lib/ffmpeg.ts';
import { ASSETS_DIR, MOTION_ENTRY } from '../project/paths.ts';
import { CHROMIUM_OPTIONS } from '../render/overlay.ts';

export const SHEET_COLUMNS = 4;
export const SHEET_ROWS = 3;

/** Divide os ids em folhas de contato de `size` itens. */
export function sheetPages(ids: string[], size = SHEET_COLUMNS * SHEET_ROWS): string[][] {
  const pages: string[][] = [];
  for (let index = 0; index < ids.length; index += size) pages.push(ids.slice(index, index + size));
  return pages;
}

/** Frame representativo: 60% da duração, quando a entrada já assentou e a saída ainda não começou. */
export function representativeFrame(durationInFrames: number, at = 0.6): number {
  return Math.min(Math.max(0, durationInFrames - 1), Math.round(durationInFrames * at));
}

export interface GalleryOptions {
  ids: string[];
  outDir: string;
  /** fração da duração de cada composição em que o frame é tirado */
  at?: number;
  log?: (message: string) => void;
}

/**
 * Folhas de contato das composições do Studio (componentes, cenas): um bundle só, um frame de
 * cada, montados em mosaico. É como conferir o arsenal inteiro de uma vez, olhando.
 */
export async function renderGallery(options: GalleryOptions): Promise<string[]> {
  mkdirSync(options.outDir, { recursive: true });
  const serveUrl = await bundle({ entryPoint: MOTION_ENTRY, publicDir: ASSETS_DIR });
  const sheets: string[] = [];
  for (const [pageIndex, page] of sheetPages(options.ids).entries()) {
    const frames: string[] = [];
    for (const id of page) {
      const composition = await selectComposition({ serveUrl, id, chromiumOptions: CHROMIUM_OPTIONS });
      const output = join(options.outDir, `${id}.png`);
      await renderStill({ serveUrl, composition, frame: representativeFrame(composition.durationInFrames, options.at), output, scale: 0.25, chromiumOptions: CHROMIUM_OPTIONS });
      frames.push(output);
      options.log?.(`${id}`);
    }
    const sheet = join(options.outDir, `sheet-${String(pageIndex + 1).padStart(2, '0')}.png`);
    await ffmpeg([
      ...frames.flatMap((frame) => ['-i', frame]),
      '-filter_complex',
      `${frames.map((_, index) => `[${index}:v]`).join('')}xstack=inputs=${frames.length}:layout=${xstackLayout(frames.length)}:fill=0x0c0c0c[out]`,
      '-map', '[out]', '-frames:v', '1', '-update', '1', sheet,
    ]);
    sheets.push(sheet);
  }
  return sheets;
}

/** Layout do xstack para `count` quadros iguais em grade de `SHEET_COLUMNS` colunas. */
export function xstackLayout(count: number, columns = SHEET_COLUMNS): string {
  const positions: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column === 0 ? '0' : Array.from({ length: column }, (_, step) => `w${step}`).join('+');
    const y = row === 0 ? '0' : Array.from({ length: row }, (_, step) => `h${step * columns}`).join('+');
    positions.push(`${x}_${y}`);
  }
  return positions.join('|');
}
