import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { slotRect } from '../motion/src/arsenal/stage.ts';
import { detectFocusTrack } from '../src/analyze/focus.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { buildOverlayProps } from '../src/render/overlay-props.ts';
import { placeStages, reframeFilters } from '../src/render/reframe.ts';
import { findFaceOutOfStage, planStageFocus, stageFocusMap } from '../src/render/stage-focus.ts';

/**
 * Palco com o apresentador fora do centro, em mídia sintética: um "rosto" (retângulo cor de pele) à esquerda,
 * x ≈ 0,20. O detector acha o rosto, o foco `"auto"` enquadra o cartão do slot right nele, e o ffmpeg de verdade
 * mostra o rosto dentro do cartão. O foco fixo antigo (0,5) deixa o cartão sem rosto, e o eval acusa.
 */
const W = 640;
const H = 360;
const FPS = 30;
const DURATION = 3;
const FACE = { left: 100, top: 50, w: 56, h: 72 };
const SKIN = [0xe0, 0xac, 0x69];
const dir = mkdtempSync(join(tmpdir(), 'mce-stage-focus-'));
const source = join(dir, 'source.mp4');

function edlFor(focus: unknown) {
  return edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-17T00:00:00.000Z',
    source: { path: source, durationSec: DURATION, fps: FPS, width: W, height: H },
    output: { fps: FPS, width: W, height: H },
    clips: [{ id: 'c1', start: 0, end: DURATION }],
    overlays: [{ id: 'palco', component: 'SplitExplainer', at: 0.5, duration: 2, presenter: { slot: 'right', ...(focus === undefined ? {} : { focus }) } }],
  });
}

/** Fração de pixels cor de pele dentro do retângulo normalizado, no frame `n`. */
async function skinShare(file: string, frame: number, rect: { x: number; y: number; w: number; h: number }): Promise<number> {
  const out = join(dir, `crop-${frame}-${Math.random().toString(36).slice(2)}.rgb`);
  const [x, y, w, h] = [rect.x * W, rect.y * H, rect.w * W, rect.h * H].map(Math.round) as [number, number, number, number];
  await ffmpeg(['-i', file, '-vf', `select='eq(n,${frame})',crop=${w}:${h}:${x}:${y},format=rgb24`, '-frames:v', '1', '-f', 'rawvideo', out]);
  const bytes = readFileSync(out);
  let skin = 0;
  for (let index = 0; index < bytes.length; index += 3) {
    if (Math.abs(bytes[index]! - SKIN[0]!) < 24 && Math.abs(bytes[index + 1]! - SKIN[1]!) < 24 && Math.abs(bytes[index + 2]! - SKIN[2]!) < 24) skin += 1;
  }
  return skin / (bytes.length / 3);
}

async function renderStage(name: string, edl: ReturnType<typeof edlFor>, map?: Map<string, { x: number; y: number }>): Promise<string> {
  const timeline = buildTimeline(edl.clips, FPS);
  const props = buildOverlayProps(edl, timeline, { words: [] }, undefined, map);
  const output = join(dir, `${name}.mp4`);
  const graph = join(dir, `${name}.graph.txt`);
  writeFileSync(graph, `[0:v]${reframeFilters(placeStages(props.overlays, FPS), W, H).join(',')},format=yuv420p[v]`, 'utf8');
  await ffmpeg(['-i', source, '-/filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10', output]);
  return output;
}

describe('foco auto do palco (integração)', () => {
  beforeAll(async () => {
    await ffmpeg([
      '-f', 'lavfi', '-i', `color=c=0x2a3a2e:s=${W}x${H}:r=${FPS}:d=${DURATION}`,
      '-f', 'lavfi', '-i', `color=c=0xE0AC69:s=${FACE.w}x${FACE.h}:r=${FPS}:d=${DURATION}`,
      '-filter_complex', `[0:v][1:v]overlay=x=${FACE.left}:y=${FACE.top}:shortest=1,format=yuv420p[v]`,
      '-map', '[v]', '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10', source,
    ]);
  }, 60_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('o recorte do slot right contém o rosto fora do centro; o foco fixo 0.5 não, e o eval acusa', async () => {
    const track = await detectFocusTrack(source, { cacheDir: join(dir, 'analysis'), video: { width: W, height: H, durationSec: DURATION } });
    const faces = track.samples.flatMap((sample) => (sample.face ? [sample.face] : []));
    expect(faces.length).toBeGreaterThan(track.samples.length / 2);
    expect(Math.abs(faces[2]!.x * W - (FACE.left + FACE.w / 2))).toBeLessThan(8);
    expect(Math.abs(faces[2]!.y * H - (FACE.top + FACE.h / 2))).toBeLessThan(10);

    const auto = edlFor(undefined);
    const timeline = buildTimeline(auto.clips, FPS);
    const plans = planStageFocus(auto, timeline, track.samples);
    expect(plans[0]!.mode).toBe('auto');
    expect(findFaceOutOfStage(plans)).toEqual([]);

    const card = slotRect('right');
    // meio do palco (pousado): frame 45 = 1,5 s
    const fit = await renderStage('auto', auto, stageFocusMap(plans));
    const share = await skinShare(fit, 45, card);
    // rosto inteiro dentro do cartão: área do rosto escalado / área do cartão (o cartão cobre ~0,9 da altura da fonte)
    const scale = (card.h * H) / H;
    const expected = (FACE.w * scale * FACE.h * scale) / (card.w * W * card.h * H);
    expect(share).toBeGreaterThan(expected * 0.85);
    // e centrado: a coluna do meio do cartão é pele
    expect(await skinShare(fit, 45, { x: card.x + card.w / 2 - 0.005, y: (FACE.top + FACE.h / 2) / H - 0.01, w: 0.01, h: 0.02 })).toBeGreaterThan(0.9);

    const fixed = edlFor({ x: 0.5, y: 0.4 });
    const fixedPlans = planStageFocus(fixed, timeline, track.samples);
    expect(findFaceOutOfStage(fixedPlans).map((finding) => [finding.check, finding.severity])).toEqual([['rosto-fora-do-palco', 'error']]);
    const miss = await renderStage('fixed', fixed);
    expect(await skinShare(miss, 45, card)).toBeLessThan(0.01);
  }, 120_000);
});
