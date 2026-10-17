import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildEffectFilters, type EffectContext, effects } from '../src/arsenal/effects.ts';
import { run } from '../src/lib/exec.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';

/**
 * Cada preset `filter` passa pelo ffmpeg de verdade: um filtro que não existe nesta build,
 * que não aceita `enable` ou que muda o número de frames só aparece assim.
 */
const dir = mkdtempSync(join(tmpdir(), 'mce-arsenal-fx-'));
const source = join(dir, 'source.mp4');
const WIDTH = 320;
const HEIGHT = 180;
const FPS = 30;
const FRAMES = 60;

const context = (overrides: Partial<EffectContext> = {}): EffectContext => ({
  start: 0.5,
  end: 1.5,
  intensity: 0.5,
  width: WIDTH,
  height: HEIGHT,
  fps: FPS,
  focus: { x: 0.5, y: 0.4 },
  ...overrides,
});

async function probe(file: string): Promise<{ frames: number; width: number; height: number; rate: string }> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-count_frames', '-select_streams', 'v:0',
    '-show_entries', 'stream=nb_read_frames,width,height,r_frame_rate', '-of', 'json', file,
  ]);
  const info = (JSON.parse(stdout) as { streams: { nb_read_frames?: string; width: number; height: number; r_frame_rate: string }[] }).streams[0]!;
  return { frames: Number(info.nb_read_frames ?? 0), width: info.width, height: info.height, rate: info.r_frame_rate };
}

async function apply(name: string, filters: string[]) {
  const output = join(dir, `${name}.mp4`);
  await ffmpeg(['-i', source, '-vf', filters.join(','), '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', output]);
  return probe(output);
}

const filterIds = Object.values(effects).filter((preset) => preset.kind === 'filter').map((preset) => preset.id);

describe('arsenal de efeitos (integração com o ffmpeg)', () => {
  beforeAll(async () => {
    await ffmpeg([
      '-f', 'lavfi', '-i', `testsrc2=s=${WIDTH}x${HEIGHT}:r=${FPS}:d=2`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', source,
    ]);
    expect((await probe(source)).frames).toBe(FRAMES);
  }, 60_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it.each(filterIds)('%s é aceito e preserva frames, tamanho e fps', async (id) => {
    const info = await apply(id, buildEffectFilters(id, context({ intensity: effects[id]!.defaultIntensity })));
    expect(info).toEqual({ frames: FRAMES, width: WIDTH, height: HEIGHT, rate: `${FPS}/1` });
  }, 60_000);

  it.each(filterIds)('%s também é aceito nos extremos de intensidade', async (id) => {
    for (const intensity of [0, 1]) {
      const info = await apply(`${id}-${intensity}`, buildEffectFilters(id, context({ intensity })));
      expect(info.frames).toBe(FRAMES);
    }
  }, 90_000);

  it('presets combinados na mesma cadeia (inclusive dois sub-grafos do mesmo tipo) continuam válidos', async () => {
    const chain = [
      ...buildEffectFilters('look-warm-editorial', context({ start: 0, end: 2 })),
      ...buildEffectFilters('focus-blur-background', context({ start: 0.2, end: 0.9 })),
      ...buildEffectFilters('focus-blur-background', context({ start: 1.1, end: 1.8 })),
      ...buildEffectFilters('camera-punch-in', context({ start: 0.3, end: 1.2 })),
      ...buildEffectFilters('glitch-h-shift', context({ start: 1.2, end: 1.7 })),
      ...buildEffectFilters('light-bloom', context({ start: 0.4, end: 1.6 })),
      ...buildEffectFilters('focus-blur-region', context({ start: 0.1, end: 0.6 })),
      ...buildEffectFilters('texture-film-grain', context({ start: 0, end: 2 })),
    ];
    const info = await apply('combo', chain);
    expect(info).toEqual({ frames: FRAMES, width: WIDTH, height: HEIGHT, rate: `${FPS}/1` });
  }, 120_000);

  it('um trecho mais curto que as rampas não quebra as expressões', async () => {
    for (const id of ['camera-punch-in', 'camera-dutch-tilt', 'light-dip-black', 'focus-blur-all', 'glitch-digital-burst']) {
      const info = await apply(`${id}-short`, buildEffectFilters(id, context({ start: 1, end: 1.1 })));
      expect(info.frames).toBe(FRAMES);
    }
  }, 120_000);
});
