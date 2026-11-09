/**
 * Mede a área do quadro que cada componente do arsenal ocupa (caixa do alfa renderizado com as props de exemplo)
 * e grava `motion/src/arsenal/footprints.json`, que o ajuste automático do vídeo (`src/edl/fit.ts`) consome.
 * Rode de novo ao criar ou mudar o layout de um componente: `pnpm tsx scripts/measure-footprints.ts [Componente...]`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { registry } from '../motion/src/components/registry.ts';
import { renderStill } from '../src/render/overlay.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'motion', 'src', 'arsenal', 'footprints.json');
const TMP = join(ROOT, 'projects', '.stills', 'footprints');
const W = 1920;
const H = 1080;
const ALPHA_MIN = 40;
/** poucos pixels soltos (partícula, sombra) não contam como área ocupada */
const ROW_MIN = 6;

type Box = { x: number; y: number; w: number; h: number };

async function bbox(file: string): Promise<Box | null> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = new Uint32Array(info.height);
  const cols = new Uint32Array(info.width);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3]! > ALPHA_MIN) {
        rows[y]!++;
        cols[x]!++;
      }
    }
  }
  const first = (arr: Uint32Array) => arr.findIndex((n) => n >= ROW_MIN);
  const last = (arr: Uint32Array) => arr.length - 1 - [...arr].reverse().findIndex((n) => n >= ROW_MIN);
  const y0 = first(rows);
  const x0 = first(cols);
  if (y0 < 0 || x0 < 0) return null;
  const y1 = last(rows);
  const x1 = last(cols);
  return { x: x0 / info.width, y: y0 / info.height, w: (x1 - x0 + 1) / info.width, h: (y1 - y0 + 1) / info.height };
}

const union = (a: Box | null, b: Box | null): Box | null => {
  if (!a || !b) return a ?? b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

const round = (n: number) => Math.round(n * 1000) / 1000;

async function main(): Promise<void> {
  mkdirSync(TMP, { recursive: true });
  const only = process.argv.slice(2);
  const table: Record<string, Box | null> = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, Box | null>) : {};
  const entries = Object.entries(registry as Record<string, { defaultDuration: number; sample: Record<string, unknown> }>).filter(([name]) => !only.length || only.includes(name));
  for (const [name, entry] of entries) {
    const total = Math.round(entry.defaultDuration * 30);
    let box: Box | null = null;
    for (const k of [0.5, 0.75, 0.95]) {
      const file = join(TMP, `${name}-${k}.png`);
      await renderStill('Overlay', Math.round(total * k), file, {
        fps: 30,
        width: W,
        height: H,
        durationInFrames: total,
        captions: [],
        captionStyle: 'long',
        overlays: [{ id: 'm', component: name, from: 0, durationInFrames: total, props: entry.sample, hidesCaptions: false }],
      });
      box = union(box, await bbox(file));
    }
    table[name] = box && { x: round(box.x), y: round(box.y), w: round(box.w), h: round(box.h) };
    console.log(name, JSON.stringify(table[name]));
  }
  writeFileSync(OUT, `${JSON.stringify(Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
}

await main();
