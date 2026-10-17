import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { detectFocusTrack } from '../src/analyze/focus.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { run } from '../src/lib/exec.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { renderCut } from '../src/render/cuts.ts';
import { cropFraction, type FocusKeyframe, focusAt, planFocus } from '../src/render/focus.ts';
import { verticalCrop } from '../src/render/shorts.ts';

/**
 * Foco dinâmico em mídia sintética: um quadrado cor de pele parado à esquerda, que anda para a direita e para.
 * O detector acha o quadrado, o plano vira pan, e o Short cortado (com um corte no meio) mostra o quadrado onde
 * a expressão do recorte diz, e centrado depois que ele para. Mede a posição no arquivo de saída.
 */
const FPS = 30;
const W = 640;
const H = 360;
const DURATION = 9;
const SQUARE = 64;
const OUT = { width: 180, height: 320 };
const dir = mkdtempSync(join(tmpdir(), 'mce-focus-'));
const source = join(dir, 'walk.mp4');
const analysisDir = join(dir, 'analysis');

/** Borda esquerda do quadrado no tempo da fonte: parado em 40 até 2 s, anda até 520 em 4 s, para. */
const squareLeft = (t: number) => 40 + 480 * Math.min(1, Math.max(0, (t - 2) / 4));

async function frameCount(file: string): Promise<number> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]);
  return Number(stdout.trim());
}

/** Centro horizontal (px) dos pixels claros (o quadrado) em cada frame do arquivo, em cinza. */
async function squareCenters(file: string): Promise<number[]> {
  const raw = join(dir, `centers-${Math.random().toString(36).slice(2)}.raw`);
  await ffmpeg(['-i', file, '-an', '-f', 'rawvideo', '-pix_fmt', 'gray', raw]);
  const bytes = readFileSync(raw);
  rmSync(raw);
  const size = OUT.width * OUT.height;
  const centers: number[] = [];
  for (let frame = 0; frame * size < bytes.length; frame += 1) {
    let sum = 0;
    let count = 0;
    for (let y = 0; y < OUT.height; y += 1) {
      for (let x = 0; x < OUT.width; x += 1) {
        if (bytes[frame * size + y * OUT.width + x]! > 120) {
          sum += x + 0.5;
          count += 1;
        }
      }
    }
    centers.push(count > 50 ? sum / count : NaN);
  }
  return centers;
}

describe('foco dinâmico do Short (integração)', () => {
  beforeAll(async () => {
    await ffmpeg([
      '-f', 'lavfi', '-i', `color=c=0x2a3a2e:s=${W}x${H}:r=${FPS}:d=${DURATION}`,
      '-f', 'lavfi', '-i', `color=c=0xE0AC69:s=${SQUARE}x${SQUARE * 2}:r=${FPS}:d=${DURATION}`,
      '-f', 'lavfi', '-i', `sine=f=440:d=${DURATION}`,
      '-filter_complex', `[0:v][1:v]overlay=x='40+480*clip((t-2)/4,0,1)':y=60:eval=frame:shortest=1,format=yuv420p[v]`,
      '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-c:a', 'aac', '-shortest', source,
    ]);
  }, 60_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('detecta, planeja pan e o recorte acompanha o quadrado no arquivo de saída, sem mudar a contagem de frames', async () => {
    const track = await detectFocusTrack(source, { cacheDir: analysisDir, video: { width: W, height: H, durationSec: DURATION } });
    expect(track.samples.length).toBeGreaterThanOrEqual(DURATION * 2 - 1);
    const at = (t: number) => track.samples.find((sample) => Math.abs(sample.t - t) < 0.01)!;
    expect(Math.abs(at(1).x * W - (squareLeft(1) + SQUARE / 2))).toBeLessThan(16);
    expect(Math.abs(at(8).x * W - (squareLeft(8) + SQUARE / 2))).toBeLessThan(16);
    expect(existsSync(join(analysisDir, 'focus-detect.json'))).toBe(true);

    // cache: mesma chave devolve o mesmo track; outro parâmetro recalcula
    expect(await detectFocusTrack(source, { cacheDir: analysisDir, video: { width: W, height: H } })).toEqual(track);
    const other = await detectFocusTrack(source, { cacheDir: analysisDir, video: { width: W, height: H }, params: { fps: 1 } });
    expect(other.fps).toBe(1);

    // um corte no meio da caminhada: o pan de cada lado é planejado sozinho
    const clips = [{ id: 'a', start: 0, end: 4 }, { id: 'b', start: 4.5, end: DURATION }];
    const plan = planFocus(track.samples, clips, { crop: cropFraction(W, H) });
    expect(plan.mode).toBe('pan');
    const focus = plan.focus as FocusKeyframe[];
    expect(focusAt(focus, 8.9) - focusAt(focus, 1)).toBeGreaterThan(0.6);

    const timeline = buildTimeline(clips, FPS);
    const output = join(dir, 'short.mkv');
    await renderCut(timeline, {
      source, output, graphFile: join(dir, 'cut.graph.txt'), quality: 'preview', fps: FPS, ...OUT, fadeMs: 12,
      prep: verticalCrop(focus, OUT),
    });
    const expected = timeline.clips.reduce((total, clip) => total + clip.endFrame - clip.startFrame, 0);
    expect(await frameCount(output)).toBe(expected);

    const cropWidth = Math.trunc((H * 9) / 16 / 2) * 2;
    const scale = OUT.width / cropWidth;
    const centers = await squareCenters(output);
    let checked = 0;
    for (const clip of timeline.clips) {
      const first = Math.round(clip.outputStart * FPS);
      for (let frame = first; frame < first + clip.endFrame - clip.startFrame; frame += 7) {
        const sourceT = (clip.startFrame + frame - first) / FPS;
        const left = (W - cropWidth) * focusAt(focus, sourceT);
        const visible = squareLeft(sourceT) + SQUARE / 2 - left;
        if (visible < SQUARE / 2 || visible > cropWidth - SQUARE / 2) continue;
        expect(Math.abs(centers[frame]! - visible * scale)).toBeLessThan(3);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(20);
    // depois que o quadrado para, o recorte o deixa no meio do Short
    expect(Math.abs(centers.at(-1)! - OUT.width / 2)).toBeLessThan(OUT.width * 0.12);
  }, 120_000);
});
