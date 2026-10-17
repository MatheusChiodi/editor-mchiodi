// Mede o custo de render de uma composição do Studio e gera material para olhar (docs/cinema.md §10).
//
//   pnpm tsx scripts/cine-bench.ts <Id> --out <pasta> [--range 0-90] [--stills 8,16,24] [--scale 0.6667] [--props '{"a":1}']
//
// Com --range renderiza o trecho em H.264 (1280×720 por padrão) e informa segundos de render por frame e por
// segundo de vídeo. Com --stills grava PNGs dos frames pedidos. Um bundle só para tudo.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

import { ASSETS_DIR, MOTION_ENTRY } from '../src/project/paths.ts';
import { CHROMIUM_OPTIONS } from '../src/render/overlay.ts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const id = process.argv[2];
if (!id || id.startsWith('--')) throw new Error('uso: cine-bench <Id> --out <pasta> [--range a-b] [--stills f,f] [--scale n] [--props json]');
const outDir = resolve(option('out') ?? join('projects', '.stills'));
const scale = Number(option('scale') ?? 2 / 3);
const inputProps = option('props') ? (JSON.parse(option('props')!) as Record<string, unknown>) : undefined;
mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: MOTION_ENTRY, publicDir: ASSETS_DIR });
const composition = await selectComposition({ serveUrl, id, inputProps, chromiumOptions: CHROMIUM_OPTIONS });

for (const frame of (option('stills') ?? '').split(',').filter(Boolean).map(Number)) {
  const output = join(outDir, `${id}-${frame}.png`);
  const startedAt = Date.now();
  await renderStill({ serveUrl, composition, inputProps, frame: Math.min(frame, composition.durationInFrames - 1), output, scale, imageFormat: 'png', chromiumOptions: CHROMIUM_OPTIONS });
  console.log(`still ${frame}: ${((Date.now() - startedAt) / 1000).toFixed(2)} s → ${output}`);
}

const range = option('range');
if (range) {
  const [from, to] = range.split('-').map(Number) as [number, number];
  const last = Math.min(to, composition.durationInFrames - 1);
  const output = join(outDir, `${id}.mp4`);
  let renderStart = 0;
  let renderEnd = 0;
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: 'h264',
    crf: 16,
    scale,
    frameRange: [from, last],
    concurrency: 2,
    muted: true,
    chromiumOptions: CHROMIUM_OPTIONS,
    outputLocation: output,
    onProgress: ({ renderedFrames }) => {
      if (renderedFrames >= 1 && !renderStart) renderStart = Date.now();
      renderEnd = Date.now();
    },
  });
  const count = last - from + 1;
  const perFrame = (renderEnd - renderStart) / 1000 / Math.max(1, count - 1);
  console.log(`${id} ${from}-${last} @ escala ${scale.toFixed(2)}: ${perFrame.toFixed(3)} s/frame (parede, 2 abas) · ${(perFrame * composition.fps).toFixed(1)} s por segundo de vídeo → ${output}`);
}
