import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { extractFrame } from '../src/analyze/timeline-view.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';

/** Vídeo em que o brilho é o número do frame (Y = 16 + 6·N, dentro da faixa limitada): o frame extraído se identifica pela média de cinza. */
const FPS = 30;
const dir = mkdtempSync(join(tmpdir(), 'mce-frame-seek-'));
const video = join(dir, 'numbered.mp4');

beforeAll(async () => {
  await ffmpeg([
    '-f', 'lavfi', '-i', `nullsrc=size=64x64:rate=${FPS}:duration=1`,
    '-vf', "geq=lum='16+N*6':cb=128:cr=128,format=yuv420p",
    '-c:v', 'libx264', '-qp', '0', '-g', '10', video,
  ]);
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function frameNumber(file: string): Promise<number> {
  const { channels } = await sharp(file).stats();
  // o PNG sai em faixa cheia: desfaz a expansão de 16–235 para voltar ao Y gravado
  return Math.round((channels[0]!.mean * 219) / 255 / 6);
}

describe('extractFrame', () => {
  it('devolve o frame que está na tela no instante pedido', async () => {
    // meio do frame, fronteira exata, frame cujo n/fps arredonda para cima em ms (29/30 = 0.96666…)
    const cases: Array<[number, number]> = [
      [0, 0],
      [10.5 / FPS, 10],
      [12 / FPS, 12],
      [0.967, 29],
      [29 / FPS, 29],
      [20.99 / FPS, 20],
    ];
    const got: number[] = [];
    for (const [at] of cases) {
      const file = await extractFrame(video, at, join(dir, `f-${at.toFixed(4)}.png`));
      got.push(existsSync(file) ? await frameNumber(file) : -1);
    }
    expect(got).toEqual(cases.map(([, expected]) => expected));
  }, 60_000);
});
