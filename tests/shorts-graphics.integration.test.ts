import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { placeVertical } from '../motion/src/vertical.ts';
import type { Transcript } from '../src/analyze/types.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline, sourceToOutput } from '../src/edl/timeline.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { buildOverlayProps, renderOverlay } from '../src/render/overlay.ts';
import { shortsEdl, shortsFrame } from '../src/render/shorts.ts';

/**
 * Camada de gráficos do Short de verdade (Remotion → ProRes 4444 com alfa): um TipCard ancorado depois de um corte
 * tem que aparecer no frame que a timeline diz e dentro da caixa `top` (acima do rosto, longe da legenda); o
 * SubscribeCTA (`skip`) não pode desenhar nada. Lê o alfa do arquivo renderizado, em escala 1/4.
 */
const SCALE = 0.25;
const W = 1080 * SCALE;
const H = 1920 * SCALE;
const dir = mkdtempSync(join(tmpdir(), 'mce-shorts-gfx-'));
const transcript = { language: 'pt', words: [] } as unknown as Transcript;

const edl = edlSchema.parse({
  version: 1,
  project: 'teste',
  createdAt: '2026-10-17T00:00:00.000Z',
  source: { path: join(dir, 'fonte.mp4'), durationSec: 6, fps: 30, width: 1920, height: 1080 },
  output: { fps: 30, width: 1920, height: 1080 },
  clips: [
    { id: 'c1', start: 0, end: 1.5 },
    { id: 'c2', start: 2.5, end: 6 },
  ],
  overlays: [
    { id: 'cta', component: 'SubscribeCTA', at: 0.6, duration: 0.8, props: {} },
    { id: 'dica', component: 'TipCard', at: 3, duration: 2, props: { text: 'Cache na borda antes de escalar o banco.' } },
  ],
  shorts: { start: 0.5, end: 5.5 },
});

/** Caixa (em px da escala 1/4) dos pixels com alfa visível no frame `n`; `null` se o frame está vazio. */
async function alphaBox(file: string, frame: number): Promise<{ x0: number; y0: number; x1: number; y1: number; count: number } | null> {
  const raw = join(dir, `alpha-${frame}.raw`);
  await ffmpeg(['-y', '-i', file, '-vf', `select='eq(n,${frame})',format=rgba`, '-frames:v', '1', '-f', 'rawvideo', raw]);
  const bytes = readFileSync(raw);
  let box: { x0: number; y0: number; x1: number; y1: number; count: number } | null = null;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (bytes[(y * W + x) * 4 + 3]! < 24) continue;
      box ??= { x0: x, y0: y, x1: x, y1: y, count: 0 };
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x);
      box.y1 = Math.max(box.y1, y);
      box.count += 1;
    }
  }
  return box;
}

describe('gráficos no Short (integração com o Remotion)', () => {
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('o cartão aparece no tempo do Short, dentro da caixa de cima; o CTA não entra', async () => {
    const short = shortsEdl(edl);
    const timeline = buildTimeline(short.clips, 30);
    const frame = shortsFrame(short);
    const props = buildOverlayProps(short, timeline, transcript, frame);
    const output = join(dir, 'overlay.mov');
    await renderOverlay(props, { output, scale: SCALE, concurrency: 2 });

    // 0.5–1.5 (1 s) + 2.5–3 (0.5 s): o cartão entra em 1.5 s de saída, frame 45
    const from = Math.round(sourceToOutput(timeline, 3)! * 30);
    expect(from).toBe(45);
    expect(await alphaBox(output, from - 3)).toBeNull();
    // durante o CTA (saída 0.1–0.9 s) a camada fica vazia
    expect(await alphaBox(output, 15)).toBeNull();

    const drawn = await alphaBox(output, from + 30);
    expect(drawn).not.toBeNull();
    const box = placeVertical({ zone: 'top' }, frame)!;
    const slack = 1;
    expect(drawn!.x0).toBeGreaterThanOrEqual(box.x * SCALE - slack);
    expect(drawn!.x1).toBeLessThanOrEqual((box.x + box.width) * SCALE + slack);
    expect(drawn!.y0).toBeGreaterThanOrEqual(box.y * SCALE - slack);
    expect(drawn!.y1).toBeLessThanOrEqual((box.y + box.height) * SCALE + slack);
    // não cobre o rosto nem a legenda, e é um cartão de verdade (ocupa boa parte da largura útil)
    expect(drawn!.y1).toBeLessThan(frame.face.top * SCALE);
    expect(drawn!.x1 - drawn!.x0).toBeGreaterThan(box.width * SCALE * 0.5);
  }, 300_000);
});
