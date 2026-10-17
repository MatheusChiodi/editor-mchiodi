import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { normalizePushes, slotRect, type StagePlan, windowBodyRect } from '../motion/src/arsenal/stage.ts';
import type { OverlayItem } from '../motion/src/types.ts';
import { run } from '../src/lib/exec.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { buildLayoutGraph } from '../src/render/layout.ts';
import { placeStages, reframeFilters, windowLayouts } from '../src/render/reframe.ts';

/**
 * O reenquadramento passa pelo ffmpeg de verdade: `scale` por frame + `overlay` com tamanho variável
 * só se prova rodando. Mídia sintética, 320x180, 2 s.
 */
const dir = mkdtempSync(join(tmpdir(), 'mce-reframe-'));
const source = join(dir, 'source.mp4');
const screen = join(dir, 'screen.mp4');
const WIDTH = 320;
const HEIGHT = 180;
const FPS = 30;
const FRAMES = 60;
const PAPER = [0xf8, 0xf8, 0xf2];

const plan = (slot: StagePlan['slot'], extra: Partial<StagePlan> = {}): StagePlan => ({ slot, focus: { x: 0.5, y: 0.4 }, backdrop: 'paper', from: null, holdExit: false, ...extra });
const stage = (id: string, from: number, frames: number, value: StagePlan): OverlayItem => ({ id, component: 'SplitExplainer', from, durationInFrames: frames, props: {}, hidesCaptions: true, stage: value });

async function frameCount(file: string): Promise<number> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]);
  return Number(stdout.trim());
}

/** Cor média de um bloco 4x4 centrado no ponto normalizado, no frame `n`. */
async function pixel(file: string, frame: number, x: number, y: number): Promise<number[]> {
  const out = join(dir, `px-${frame}-${Math.round(x * 1000)}-${Math.round(y * 1000)}.rgb`);
  await ffmpeg([
    '-i', file,
    '-vf', `select='eq(n,${frame})',crop=4:4:${Math.round(x * WIDTH) - 2}:${Math.round(y * HEIGHT) - 2},scale=1:1:flags=area,format=rgb24`,
    '-frames:v', '1', '-f', 'rawvideo', out,
  ]);
  const { readFileSync } = await import('node:fs');
  return [...readFileSync(out)];
}

const distance = (a: number[], b: number[]) => Math.max(...a.map((value, index) => Math.abs(value - b[index]!)));

async function apply(name: string, filters: string[]): Promise<string> {
  const output = join(dir, `${name}.mp4`);
  const graph = join(dir, `${name}.graph.txt`);
  writeFileSync(graph, `[0:v]${filters.join(',')},format=yuv420p[v]`, 'utf8');
  await ffmpeg(['-i', source, '-/filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10', output]);
  return output;
}

describe('reenquadramento do palco (integração com o ffmpeg)', () => {
  beforeAll(async () => {
    // footage escuro e tela azul: nenhum dos dois se confunde com o paper
    await ffmpeg(['-f', 'lavfi', '-i', `color=c=0x203040:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=2`, '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10', '-pix_fmt', 'yuv420p', source]);
    await ffmpeg(['-f', 'lavfi', '-i', `color=c=0x1040d0:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=2`, '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10', '-pix_fmt', 'yuv420p', screen]);
  }, 60_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('o footage pousa no cartão sobre papel e volta à tela cheia, sem perder frames', async () => {
    const stages = placeStages([stage('a', 15, 36, plan('right'))], FPS);
    const output = await apply('right', reframeFilters(stages, WIDTH, HEIGHT));
    expect(await frameCount(output)).toBe(FRAMES);

    const card = slotRect('right');
    const inside: [number, number] = [card.x + card.w / 2, card.y + card.h / 2];
    // o footage ampliado passa do cartão para a esquerda (o papel da camada de gráficos cobre a sobra); x=0.1 fica fora dele
    const outside: [number, number] = [0.1, 0.5];
    const footage = await pixel(source, 30, ...outside);

    // antes e depois do palco: quadro intacto
    expect(distance(await pixel(output, 5, ...outside), footage)).toBeLessThan(6);
    expect(distance(await pixel(output, 56, ...outside), footage)).toBeLessThan(6);
    // no meio do palco: papel fora do cartão, footage dentro
    expect(distance(await pixel(output, 32, ...outside), PAPER)).toBeLessThan(10);
    expect(distance(await pixel(output, 32, ...inside), footage)).toBeLessThan(10);
    // primeiro frame do palco: o footage ainda cobre quase tudo (a animação parte da tela cheia)
    expect(distance(await pixel(output, 15, ...outside), footage)).toBeLessThan(10);
  }, 120_000);

  it('dois palcos colados: o cartão vai de um slot ao outro sem passar pela tela cheia', async () => {
    const items = [stage('a', 6, 24, plan('right', { holdExit: true })), stage('b', 30, 24, plan('pip-bl', { from: { slot: 'right', focus: { x: 0.5, y: 0.4 }, zoom: undefined } }))];
    const output = await apply('linked', reframeFilters(placeStages(items, FPS), WIDTH, HEIGHT));
    expect(await frameCount(output)).toBe(FRAMES);
    const footage = await pixel(source, 30, 0.1, 0.2);
    // na emenda (frames 29 e 30) o canto alto esquerdo continua papel: o footage não reabriu
    expect(distance(await pixel(output, 29, 0.1, 0.2), PAPER)).toBeLessThan(10);
    expect(distance(await pixel(output, 30, 0.1, 0.2), PAPER)).toBeLessThan(10);
    const pip = slotRect('pip-bl');
    expect(distance(await pixel(output, 48, pip.x + pip.w / 2, pip.y + pip.h / 2), footage)).toBeLessThan(10);
  }, 120_000);

  it('a gravação de tela entra no corpo da janela do WindowStage', async () => {
    const items: OverlayItem[] = [{ id: 'w', component: 'WindowStage', from: 15, durationInFrames: 30, props: { kind: 'screen' }, hidesCaptions: true }];
    const graph = join(dir, 'window.graph.txt');
    const output = join(dir, 'window.mp4');
    const lines = buildLayoutGraph({ camera: '[camera]', screenInput: 1, layout: windowLayouts(items, FPS), width: WIDTH, height: HEIGHT, output: '[laid]' });
    writeFileSync(graph, [`[0:v]null[camera]`, ...lines, '[laid]format=yuv420p[v]'].join(';\n'), 'utf8');
    await ffmpeg(['-i', source, '-i', screen, '-/filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10', output]);
    expect(await frameCount(output)).toBe(FRAMES);
    const body = windowBodyRect();
    const center: [number, number] = [body.x + body.w / 2, body.y + body.h / 2];
    const blue = await pixel(screen, 30, 0.5, 0.5);
    const footage = await pixel(source, 30, 0.5, 0.5);
    expect(distance(await pixel(output, 30, ...center), blue)).toBeLessThan(10);
    expect(distance(await pixel(output, 5, ...center), footage)).toBeLessThan(10);
    expect(distance(await pixel(output, 30, 0.9, 0.5), footage)).toBeLessThan(10);
  }, 120_000);

  it('zoom na tela gravada dentro da janela: escala por frame sem perder frames nem abrir fresta', async () => {
    const items: OverlayItem[] = [
      { id: 'w', component: 'WindowStage', from: 6, durationInFrames: 48, props: { kind: 'screen', push: [{ at: 0.1, scale: 2, x: 1, y: 1 }, { at: 0.8, scale: 1.5, x: 0, y: 0 }] }, hidesCaptions: true },
    ];
    const graph = join(dir, 'window-zoom.graph.txt');
    const output = join(dir, 'window-zoom.mp4');
    const lines = buildLayoutGraph({ camera: '[camera]', screenInput: 1, layout: windowLayouts(items, FPS), width: WIDTH, height: HEIGHT, output: '[laid]' });
    expect(lines.join(';')).toContain('eval=frame');
    writeFileSync(graph, [`[0:v]null[camera]`, ...lines, '[laid]format=yuv420p[v]'].join(';\n'), 'utf8');
    await ffmpeg(['-i', source, '-i', screen, '-/filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10', output]);
    expect(await frameCount(output)).toBe(FRAMES);
    const body = windowBodyRect();
    const blue = await pixel(screen, 30, 0.5, 0.5);
    const footage = await pixel(source, 30, 0.5, 0.5);
    // em pleno zoom (âncora no canto de baixo, depois no de cima) as quatro quinas do corpo continuam sendo tela
    for (const frame of [24, 40, 50]) {
      for (const [fx, fy] of [[0.04, 0.06], [0.96, 0.06], [0.04, 0.94], [0.96, 0.94]] as const) {
        expect(distance(await pixel(output, frame, body.x + body.w * fx, body.y + body.h * fy), blue)).toBeLessThan(10);
      }
    }
    // e a tela ampliada não vaza para fora da janela
    expect(distance(await pixel(output, 40, body.x + body.w + 0.05, body.y + body.h / 2), footage)).toBeLessThan(10);
    expect(distance(await pixel(output, 40, body.x + body.w / 2, body.y + body.h + 0.05), footage)).toBeLessThan(10);
    expect(distance(await pixel(output, 57, body.x + body.w / 2, body.y + body.h / 2), footage)).toBeLessThan(10);
  }, 120_000);

  it('footage dentro da janela (slot `window`) com zoom: cobre o corpo o tempo todo e volta à tela cheia', async () => {
    const pushes = normalizePushes([{ at: 0.3, scale: 2.2, x: 0.9, y: 0.1, hold: 0.2 }], 1.4);
    const stages = placeStages([stage('f', 9, 42, plan('window', { focus: { x: 0.5, y: 0.5 }, pushes }))], FPS);
    const output = await apply('window-slot', reframeFilters(stages, WIDTH, HEIGHT));
    expect(await frameCount(output)).toBe(FRAMES);
    const body = slotRect('window');
    const footage = await pixel(source, 30, 0.5, 0.5);
    for (const frame of [24, 30, 36]) {
      for (const [fx, fy] of [[0.05, 0.07], [0.95, 0.07], [0.05, 0.93], [0.95, 0.93]] as const) {
        expect(distance(await pixel(output, frame, body.x + body.w * fx, body.y + body.h * fy), footage)).toBeLessThan(10);
      }
    }
    expect(distance(await pixel(output, 3, 0.9, 0.9), footage)).toBeLessThan(6);
    expect(distance(await pixel(output, 56, 0.9, 0.9), footage)).toBeLessThan(6);
  }, 120_000);
});
