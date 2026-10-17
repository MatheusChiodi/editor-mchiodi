import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { stabilizeSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { run } from '../src/lib/exec.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { renderCut } from '../src/render/cuts.ts';
import { hasVidstab, prepareStabilize } from '../src/render/stabilize.ts';

/**
 * Estabilização em mídia sintética: um quadro parado com textura, "tremido" por um crop que anda
 * a cada frame (câmera na mão de mentira). Prova que o corte estabilizado tem a mesma contagem de
 * frames do corte sem estabilizar e que a diferença entre frames vizinhos cai. Só roda com libvidstab.
 */
const available = await hasVidstab();
const FPS = 30;
const W = 640;
const H = 360;
const dir = mkdtempSync(join(tmpdir(), 'mce-stabilize-'));
const source = join(dir, 'shaky.mp4');
const analysisDir = join(dir, 'analysis');

async function frameCount(file: string): Promise<number> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]);
  return Number(stdout.trim());
}

/** Média da diferença absoluta entre frames vizinhos, no miolo do quadro (longe das bordas do zoom), em cinza 160x90. */
async function meanFrameDiff(file: string): Promise<number> {
  const raw = join(dir, `gray-${Math.random().toString(36).slice(2)}.raw`);
  const w = 160;
  const h = 90;
  await ffmpeg(['-i', file, '-vf', `scale=${w}:${h},format=gray`, '-f', 'rawvideo', raw]);
  const bytes = readFileSync(raw);
  const size = w * h;
  const frames = Math.floor(bytes.length / size);
  let total = 0;
  for (let frame = 1; frame < frames; frame += 1) {
    let sum = 0;
    let count = 0;
    for (let y = Math.floor(h * 0.2); y < h * 0.8; y += 1) {
      for (let x = Math.floor(w * 0.2); x < w * 0.8; x += 1) {
        sum += Math.abs(bytes[frame * size + y * w + x]! - bytes[(frame - 1) * size + y * w + x]!);
        count += 1;
      }
    }
    total += sum / count;
  }
  return total / Math.max(1, frames - 1);
}

describe.skipIf(!available)('estabilização com vidstab (integração)', () => {
  beforeAll(async () => {
    // um único quadro de textura repetido, recortado num ponto que treme a cada frame
    await ffmpeg([
      '-f', 'lavfi', '-i', `testsrc2=s=960x540:r=${FPS}:d=4`,
      '-f', 'lavfi', '-i', 'sine=f=440:d=4',
      '-vf', `trim=end_frame=1,loop=loop=${4 * FPS - 1}:size=1:start=0,setpts=N/${FPS}/TB,crop=${W}:${H}:x='160+36*sin(n*1.9)+14*sin(n*4.3)':y='90+24*sin(n*2.7+1)+10*sin(n*5.1)'`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source,
    ]);
  }, 60_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('mesma contagem de frames e menos tremor; a análise vai para o cache', async () => {
    const timeline = buildTimeline([{ id: 'c1', start: 0.2, end: 1.6 }, { id: 'c2', start: 2, end: 3.7 }], FPS);
    const settings = stabilizeSchema.parse({ enabled: true, shakiness: 8, smoothing: 30 });
    const logs: string[] = [];
    const prepared = await prepareStabilize(settings, source, analysisDir, { fps: FPS, log: (m) => logs.push(m) });
    expect(prepared.transform).toContain('vidstabtransform=input=');
    expect(readdirSync(join(analysisDir, 'stabilize')).filter((name) => name.endsWith('.trf'))).toHaveLength(1);

    const base = { fps: FPS, width: W, height: H, fadeMs: 12, source, quality: 'preview' as const };
    const shaky = join(dir, 'cut-shaky.mkv');
    const steady = join(dir, 'cut-steady.mkv');
    await renderCut(timeline, { ...base, output: shaky, graphFile: join(dir, 'shaky.graph.txt') });
    await renderCut(timeline, { ...base, output: steady, graphFile: join(dir, 'steady.graph.txt'), stabilize: prepared.transform! });

    const expected = timeline.clips.reduce((total, clip) => total + clip.endFrame - clip.startFrame, 0);
    expect(await frameCount(shaky)).toBe(expected);
    expect(await frameCount(steady)).toBe(expected);

    const before = await meanFrameDiff(shaky);
    const after = await meanFrameDiff(steady);
    // medido: ~36 → ~12,5 (média de diferença entre frames vizinhos, 0–255)
    expect(after).toBeLessThan(before * 0.6);

    const again = await prepareStabilize(settings, source, analysisDir, { fps: FPS, log: (m) => logs.push(m) });
    expect(again.transform).toBe(prepared.transform);
    expect(logs.at(-1)).toContain('em cache');
    expect(existsSync(join(analysisDir, 'stabilize'))).toBe(true);
  }, 120_000);
});
