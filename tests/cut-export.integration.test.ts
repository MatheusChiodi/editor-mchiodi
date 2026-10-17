import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { extractFrame } from '../src/analyze/timeline-view.ts';
import { probe } from '../src/analyze/media.ts';
import { audioSchema } from '../src/edl/schema.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { limiterFilter } from '../src/render/audio.ts';
import { compose } from '../src/render/compose.ts';
import { blurPadLines, centerCropChain } from '../src/render/formats.ts';

const dir = mkdtempSync(join(tmpdir(), 'mce-cut-export-'));
const cut = join(dir, 'cut.mkv');

beforeAll(async () => {
  // metade esquerda vermelha, direita azul: o recorte e o encaixe aparecem na cor do centro
  await ffmpeg([
    '-f', 'lavfi', '-i', 'color=c=red:s=160x180:r=30:d=2',
    '-f', 'lavfi', '-i', 'color=c=blue:s=160x180:r=30:d=2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2:sample_rate=48000',
    '-filter_complex', '[0:v][1:v]hstack=inputs=2,format=yuv420p[v]',
    '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'pcm_s16le', cut,
  ]);
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function exportWith(reformat: string[], name: string): Promise<string> {
  const output = join(dir, `${name}.mp4`);
  await compose({
    cut, overlay: null, intro: null, outro: null, output, graphFile: join(dir, `${name}.graph.txt`),
    width: 320, height: 180, fps: 30, durationSec: 2, videoFilters: [], voiceFilters: [],
    limiter: limiterFilter(audioSchema.parse({})), music: null, sfx: [], bumpers: { introSec: 0, outroSec: 0 },
    quality: 'preview', reformat, maxrateK: 2500,
  });
  return output;
}

async function centerColor(file: string): Promise<{ r: number; b: number }> {
  const png = await extractFrame(file, 1, join(dir, `${file.split(/[\\/]/).at(-1)}.png`));
  const { width, height } = await sharp(png).metadata();
  const { data } = await sharp(png).extract({ left: Math.floor(width! / 2) - 2, top: Math.floor(height! / 2) - 2, width: 4, height: 4 }).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0]!, b: data[2]! };
}

describe('exportação pelo grafo de composição', () => {
  it('9x16 blur-pad: quadro vertical com o 16:9 inteiro no centro', async () => {
    const file = await exportWith(blurPadLines({ width: 180, height: 320 }), 'vertical');
    const info = await probe(file);
    expect([info.width, info.height]).toEqual([180, 320]);
    expect(info.durationSec).toBeCloseTo(2, 1);
    expect(info.hasAudio).toBe(true);
  }, 60_000);

  it('1x1 center-crop segue o foco (0 = esquerda vermelha, 1 = direita azul)', async () => {
    const left = await exportWith([`[vout]${centerCropChain({ width: 180, height: 180 }, 0)},format=yuv420p[vfmt]`], 'square-left');
    const right = await exportWith([`[vout]${centerCropChain({ width: 180, height: 180 }, 1)},format=yuv420p[vfmt]`], 'square-right');
    expect([(await probe(left)).width, (await probe(left)).height]).toEqual([180, 180]);
    const a = await centerColor(left);
    const b = await centerColor(right);
    expect(a.r).toBeGreaterThan(a.b);
    expect(b.b).toBeGreaterThan(b.r);
  }, 60_000);
});
