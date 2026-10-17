import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTimeline } from '../src/edl/timeline.ts';
import { run } from '../src/lib/exec.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { compose } from '../src/render/compose.ts';
import { renderCut } from '../src/render/cuts.ts';
import { placeBroll } from '../src/render/layout.ts';

/**
 * B-roll pelo ffmpeg de verdade: câmera vermelha com um corte no meio; b-roll de 0,5 s verde + azul (com áudio alto
 * próprio), inserido a partir de `from: 0.5` num trecho da fonte que atravessa o corte. Só pode aparecer azul, só no
 * intervalo previsto, sem mudar a contagem de frames, e o áudio do b-roll não pode vazar.
 */
const dir = mkdtempSync(join(tmpdir(), 'mce-broll-'));
const camera = join(dir, 'camera.mp4');
const broll = join(dir, 'broll.mp4');
const WIDTH = 320;
const HEIGHT = 180;
const FPS = 30;
const RED = [0xd0, 0x20, 0x20];
const BLUE = [0x20, 0x40, 0xd0];

const timeline = buildTimeline(
  [
    { id: 'a', start: 0, end: 2 },
    { id: 'b', start: 3, end: 6 },
  ],
  FPS,
);

async function frameCount(file: string): Promise<number> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]);
  return Number(stdout.trim().split(/\r?\n/)[0]);
}

async function pixel(file: string, frame: number): Promise<number[]> {
  const out = join(dir, `px-${frame}.rgb`);
  await ffmpeg(['-i', file, '-vf', `select='eq(n,${frame})',crop=4:4:${WIDTH / 2 - 2}:${HEIGHT / 2 - 2},scale=1:1:flags=area,format=rgb24`, '-frames:v', '1', '-f', 'rawvideo', out]);
  return [...readFileSync(out)];
}

const near = (a: number[], b: number[]) => Math.max(...a.map((value, index) => Math.abs(value - b[index]!))) < 40;

describe('b-roll no ffmpeg (integração)', () => {
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  beforeAll(async () => {
    await ffmpeg([
      '-f', 'lavfi', '-i', `color=c=0xd02020:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=6`, '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=48000:d=6',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', camera,
    ]);
    // b-roll 4:3, em 25 fps: 0,5 s verde e depois azul; áudio alto que não pode aparecer na saída
    await ffmpeg([
      '-f', 'lavfi', '-i', 'color=c=0x20d020:s=240x180:r=25:d=0.5', '-f', 'lavfi', '-i', 'color=c=0x2040d0:s=240x180:r=25:d=4',
      '-f', 'lavfi', '-i', "aevalsrc='0.9*sin(2*PI*1000*t)':s=48000:d=4.5",
      '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-map', '2:a',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10', '-pix_fmt', 'yuv420p', '-c:a', 'aac', broll,
    ]);
  }, 60_000);

  it('aparece só no intervalo previsto, começa em `from`, atravessa o corte e não muda a duração nem o áudio', async () => {
    const cut = join(dir, 'cut.mkv');
    await renderCut(timeline, { source: camera, output: cut, graphFile: join(dir, 'cut.graph.txt'), quality: 'preview', fps: FPS, width: WIDTH, height: HEIGHT, fadeMs: 12 });
    expect(await frameCount(cut)).toBe(150);

    // fonte 1–4 s atravessa o corte (2–3 s): no vídeo final vira 1–3 s
    const placed = placeBroll([{ file: broll, start: 1, end: 4, from: 0.5, fit: 'cover' }], timeline);
    expect(placed).toEqual([{ file: broll, start: 1, end: 3, from: 0.5, fit: 'cover' }]);

    const base = { cut, overlay: null, intro: null, outro: null, bumpers: { introSec: 0, outroSec: 0 }, quality: 'preview' as const, durationSec: timeline.durationSec, fps: FPS, width: WIDTH, height: HEIGHT, videoFilters: [], voiceFilters: [], limiter: 'anull', music: null, sfx: [] };
    const output = join(dir, 'out.mp4');
    await compose({ ...base, broll: placed, output, graphFile: join(dir, 'compose.graph.txt') });
    expect(await frameCount(output)).toBe(150);

    expect(near(await pixel(output, 15), RED)).toBe(true); // 0,5 s
    expect(near(await pixel(output, 29), RED)).toBe(true); // 0,97 s: último frame antes do inserto
    expect(near(await pixel(output, 30), BLUE)).toBe(true); // 1,0 s: já é o b-roll, e azul (o verde ficou antes de `from`)
    expect(near(await pixel(output, 60), BLUE)).toBe(true); // 2,0 s: em cima do corte
    expect(near(await pixel(output, 89), BLUE)).toBe(true); // 2,97 s: último frame do inserto
    expect(near(await pixel(output, 90), RED)).toBe(true); // 3,0 s: voltou para a câmera
    expect(near(await pixel(output, 140), RED)).toBe(true);

    // o áudio do b-roll (1 kHz, quase 0 dBFS) não entra: o volume fica no nível da voz sintética
    const reference = join(dir, 'ref.mp4');
    await compose({ ...base, output: reference, graphFile: join(dir, 'ref.graph.txt') });
    const peak = async (file: string) => {
      const stderr = await ffmpeg(['-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-']);
      return Number(/max_volume: (-?[\d.]+) dB/.exec(stderr)![1]);
    };
    expect(Math.abs((await peak(output)) - (await peak(reference)))).toBeLessThan(0.5);
  }, 180_000);
});
