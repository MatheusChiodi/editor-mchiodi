import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { backgroundSchema } from '../src/edl/schema.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { applyBackground } from '../src/render/background.ts';

/** 320x180 @ 30 fps, 1 s. Câmera sintética: quadrado vermelho no centro sobre fundo verde (ou cinza). */
const dir = mkdtempSync(join(tmpdir(), 'mce-bg-'));
const frame = { width: 320, height: 180, fps: 30 };
const greenCam = join(dir, 'green.mkv');
const grayCam = join(dir, 'gray.mkv');
const matte = join(dir, 'matte.mkv');

const box = 'drawbox=x=110:y=50:w=100:h=80:color=red:t=fill';
const encode = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '12'];

beforeAll(async () => {
  await ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x00ff00:s=320x180:r=30:d=1', '-f', 'lavfi', '-i', 'sine=d=1', '-vf', box, '-shortest', ...encode, '-c:a', 'aac', greenCam]);
  await ffmpeg(['-f', 'lavfi', '-i', 'color=c=gray:s=320x180:r=30:d=1', '-f', 'lavfi', '-i', 'sine=d=1', '-vf', box, '-shortest', ...encode, '-c:a', 'aac', grayCam]);
  await ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=30:d=1', '-vf', 'drawbox=x=110:y=50:w=100:h=80:color=white:t=fill,format=gray', '-c:v', 'ffv1', matte]);
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Cor RGB do pixel (x, y) do primeiro quadro. */
function pixel(file: string, x: number, y: number): [number, number, number] {
  const out = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-vf', `format=rgb24,crop=1:1:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
  return [out.stdout[0]!, out.stdout[1]!, out.stdout[2]!];
}

const near = (actual: number[], expected: number[], tolerance = 40) => actual.forEach((value, index) => expect(Math.abs(value - expected[index]!)).toBeLessThan(tolerance));

describe('applyBackground (ffmpeg de verdade)', () => {
  it('chroma: tira o verde, troca por cor e mantém a pessoa e o áudio', async () => {
    const background = backgroundSchema.parse({ mode: 'chroma', keyColor: '#00ff00', color: '#101010', despill: false, edgeBlend: 0, reason: 'teste' });
    const output = join(dir, 'chroma.mp4');
    await applyBackground(background, { input: greenCam, matte: null, output, graphFile: join(dir, 'chroma.txt'), frame, quality: 'preview', durationSec: 1 });
    near(pixel(output, 5, 5), [0x10, 0x10, 0x10]);
    near(pixel(output, 160, 90), [255, 0, 0], 60);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', output], { encoding: 'utf8' });
    expect(probe.stdout.trim()).toBe('aac');
  }, 60_000);

  it('color com máscara: fundo novo onde a máscara é preta, câmera onde é branca', async () => {
    const background = backgroundSchema.parse({ mode: 'color', color: '#2040ff', matte: { downsample: null, opening: 0, feather: 0 }, reason: 'teste' });
    const output = join(dir, 'color.mp4');
    await applyBackground(background, { input: grayCam, matte, output, graphFile: join(dir, 'color.txt'), frame, quality: 'preview', durationSec: 1 });
    near(pixel(output, 5, 5), [0x20, 0x40, 0xff]);
    near(pixel(output, 160, 90), [255, 0, 0], 60);
  }, 60_000);

  it('blur: o fundo original fica desfocado, a pessoa continua nítida', async () => {
    const background = backgroundSchema.parse({ mode: 'blur', blur: 20, matte: { downsample: null, opening: 0, feather: 0 }, reason: 'teste' });
    const output = join(dir, 'blur.mp4');
    await applyBackground(background, { input: grayCam, matte, output, graphFile: join(dir, 'blur.txt'), frame, quality: 'preview', durationSec: 1 });
    near(pixel(output, 5, 5), [128, 128, 128], 30);
    near(pixel(output, 160, 90), [255, 0, 0], 60);
  }, 60_000);
});
