import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTimeline } from '../src/edl/timeline.ts';
import { classifyJump, jumpScore } from '../src/eval/edges.ts';
import { cutFrames, grabGrayFrames, measureJumpCuts, renderContactSheet, rowTop, sheetLayout, tileLeft } from '../src/eval/visual.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';

/**
 * Jump cut e prancha de contato em mídia sintética: quatro trechos de 1s do mesmo quadro texturizado
 * — idêntico (corte invisível), deslocado alguns pixels (jump cut) e barras de cor (troca de plano).
 */
const FPS = 30;
const W = 640;
const H = 360;
const dir = mkdtempSync(join(tmpdir(), 'mce-eval-visual-'));
const still = join(dir, 'still.png');
const video = join(dir, 'cuts.mp4');
const timeline = buildTimeline(
  [
    { id: 'a', start: 0, end: 1 },
    { id: 'b', start: 2, end: 3 },
    { id: 'c', start: 4, end: 5 },
    { id: 'd', start: 6, end: 7 },
  ],
  FPS,
);
const cuts = timeline.clips.slice(1).map((clip) => ({ at: clip.outputStart, clip }));

beforeAll(async () => {
  // textura com detalhe fino (o testsrc tem gradiente, barras e texto) num quadro maior, para recortar com deslocamento
  await ffmpeg(['-f', 'lavfi', '-i', `testsrc=size=${W + 40}x${H + 40}:rate=1`, '-frames:v', '1', still]);
  const loop = ['-loop', '1', '-framerate', String(FPS), '-t', '1', '-i', still];
  await ffmpeg([
    ...loop, ...loop, ...loop,
    '-f', 'lavfi', '-i', `smptebars=size=${W}x${H}:rate=${FPS}:duration=1`,
    '-filter_complex',
    `[0:v]crop=${W}:${H}:20:20,setsar=1[v0];[1:v]crop=${W}:${H}:20:20,setsar=1[v1];[2:v]crop=${W}:${H}:28:24,setsar=1[v2];[3:v]setsar=1[v3];` +
      '[v0][v1][v2][v3]concat=n=4:v=1:a=0,format=yuv420p[v]',
    '-map', '[v]', '-c:v', 'libx264', '-crf', '16', '-r', String(FPS), video,
  ]);
}, 120_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('jump cut no vídeo renderizado', () => {
  it('lê só os quadros pedidos, em ordem, num passe', async () => {
    const frames = await grabGrayFrames(video, [31, 29, 30, 30], { width: 160, height: 90 }, join(dir, 'grab'));
    expect([...frames.keys()]).toEqual([29, 30, 31]);
    expect(frames.get(29)!.length).toBe(160 * 90);
  }, 60_000);

  it('separa corte invisível, jump cut e troca de plano', async () => {
    const measured = await measureJumpCuts(video, cuts, { fps: FPS, width: W, height: H }, join(dir, 'jump'));
    expect(measured.map((cut) => cut.clip.id)).toEqual(['b', 'c', 'd']);
    const [same, shifted, bars] = measured;
    expect(classifyJump(same!.diff)).toBe('invisivel');
    expect(classifyJump(shifted!.diff)).toBe('jump');
    expect(classifyJump(bars!.diff)).toBe('troca');
    // o deslocamento explica a diferença: alinhado fica bem abaixo do bruto
    expect(shifted!.diff.aligned).toBeLessThan(shifted!.diff.raw * 0.6);
    expect(jumpScore(shifted!.diff)).toBeGreaterThan(0.3);
  }, 60_000);

  it('monta a prancha de contato com antes | depois dos pontos pedidos', async () => {
    const output = join(dir, 'eval', 'contact-sheet.png');
    const points = [
      { at: cuts[1]!.at, score: 0.9, checks: ['jump-cut', 'sem-respiro'] },
      { at: cuts[2]!.at, score: 0.2, checks: [] },
    ];
    const file = await renderContactSheet(video, points, { fps: FPS, width: W, height: H }, 'teste · cortes', output);
    expect(file).toBe(output);
    const meta = await sharp(output).metadata();
    const layout = sheetLayout(2, { width: W, height: H });
    expect([meta.width, meta.height]).toEqual([layout.width, layout.height]);
    expect(existsSync(join(dir, 'eval', 'sheet'))).toBe(false);
    // segundo ponto = textura → barras: os dois quadros têm de ser diferentes (seek errado mostra o "depois" duas vezes)
    const { before, after } = cutFrames(cuts[2]!.at, FPS);
    expect(after - before).toBe(1);
    const tile = (left: number) =>
      sharp(output).extract({ left, top: rowTop(layout, 1), width: layout.tile.width, height: layout.tile.height }).greyscale().raw().toBuffer();
    const [a, b] = await Promise.all([tile(tileLeft(layout, 'before')), tile(tileLeft(layout, 'after'))]);
    let sum = 0;
    for (let index = 0; index < a.length; index += 1) sum += Math.abs(a[index]! - b[index]!);
    expect(sum / a.length).toBeGreaterThan(30);
    expect(await renderContactSheet(video, [], { fps: FPS, width: W, height: H }, 'vazio', join(dir, 'none.png'))).toBeNull();
  }, 60_000);
});
