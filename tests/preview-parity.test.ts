import { describe, expect, it } from 'vitest';

import { buildGuardPayload } from '../src/cut/guard.ts';
import { stageFocusMap, stageTrackMap, applyStageTracks, planStageFocus } from '../src/render/stage-focus.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { FIT_PREFIX, type Footprints, planGuard } from '../src/edl/fit.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import type { FocusSample } from '../src/render/focus.ts';
import { effectFilters, placeEffects } from '../src/render/effects.ts';
import { footageFrameAt, mapPoint, cameraStep } from '../src/render/footage-frame.ts';
import { buildOverlayProps } from '../src/render/overlay-props.ts';
import { buildPreviewProps } from '../src/render/preview-props.ts';
import { placeStages, reframeFilters } from '../src/render/reframe.ts';
import { gradeCss, gradeFilters, placeZooms, zoomFilters } from '../src/render/video.ts';
import { buildEffectFilters, effects } from '../src/arsenal/effects.ts';

const W = 1920;
const H = 1080;
const FPS = 30;

const FOOT: Footprints = { Checklist: { x: 0.53, y: 0.32, w: 0.42, h: 0.35 }, TipCard: { x: 0.05, y: 0.8, w: 0.3, h: 0.1 } };

/** Rosto à direita do centro, parado: o detector "mediu" o trecho inteiro. */
const samples: FocusSample[] = Array.from({ length: 140 }, (_, index) => ({ t: index, x: 0.5, confidence: 0.9, face: { x: 0.52, y: 0.4 } }));

const fixture = () =>
  edlSchema.parse({
    version: 1,
    project: 'paridade',
    createdAt: '2026-11-08T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 140, fps: FPS, width: W, height: H },
    output: { fps: FPS, width: W, height: H },
    clips: [
      { id: 'c1', start: 0, end: 60 },
      { id: 'c2', start: 70, end: 130 },
    ],
    zooms: [{ id: 'z1', at: 20, duration: 3, scale: 1.2, focus: { x: 0.4, y: 0.3 }, mode: 'ease', reason: 'ênfase' }],
    effects: [
      { id: 'e1', preset: 'camera-punch-in', at: 25, duration: 2.5, focus: { x: 0.6, y: 0.4 }, reason: 'ênfase' },
      { id: 'e2', preset: 'camera-pan-left', at: 80, duration: 3, reason: 'abre espaço' },
      { id: 'e3', preset: 'camera-handheld', at: 29, duration: 4, reason: 'tensão leve' },
    ],
    overlays: [
      { id: 'o-stage', component: 'SplitExplainer', at: 10, duration: 6, props: {}, reason: 'explica', presenter: { slot: 'right', focus: 'auto', backdrop: 'paper' } },
      { id: 'o-stage2', component: 'SplitExplainer', at: 16.03, duration: 5, props: {}, reason: 'explica', presenter: { slot: 'pip-bl', focus: 'auto', backdrop: 'paper' } },
      { id: 'o-fit', component: 'Checklist', at: 40, duration: 5, props: {}, reason: 'lista' },
      { id: 'o-tip', component: 'TipCard', at: 50, duration: 4, props: {}, reason: 'dica', offset: { x: 0.02, y: -0.01 } },
      { id: 'o-win', component: 'WindowStage', at: 100, duration: 8, props: { kind: 'footage', push: [{ at: 2, scale: 1.4, x: 0.5, y: 0.4 }] }, reason: 'janela' },
    ],
    grade: { preset: 'warm', exposure: 0.2, contrast: 1.1, saturation: 0.9 },
  });

// avaliador independente do de src/render/footage-frame.ts (só o subconjunto que o reframe/zoom/efeitos emitem)
function ev(expression: string, t: number): number {
  const scope = {
    t,
    PI: Math.PI,
    gte: (a: number, b: number) => +(a >= b),
    lt: (a: number, b: number) => +(a < b),
    between: (v: number, a: number, b: number) => +(v >= a && v <= b),
    clip: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)),
    pow: Math.pow,
    exp: Math.exp,
    sin: Math.sin,
    trunc: Math.trunc,
  };
  return new Function(...Object.keys(scope), `return ${expression};`)(...Object.values(scope)) as number;
}

/** Leva um ponto do quadro de entrada pela cadeia de filtros do render (scale/crop/reframe), como o ffmpeg faria. */
function renderPoint(filters: string[], t: number, point: { x: number; y: number }): { x: number; y: number } {
  let { x, y } = point;
  for (const filter of filters) {
    if (filter.startsWith('scale=')) {
      const [, w, h] = /scale=w='(.+?)':h='(.+?)':eval/.exec(filter)!;
      x *= ev(w!, t) / W;
      y *= ev(h!, t) / H;
    } else if (filter.startsWith('crop=')) {
      const [, cx, cy] = /crop=\d+:\d+:x='(.+?)':y='(.+)'$/.exec(filter)!;
      x -= ev(cx!, t);
      y -= ev(cy!, t);
    } else if (filter.includes('overlay=x=')) {
      const [, w, h] = /scale=w='(.+?)':h='(.+?)':eval=frame/.exec(filter)!;
      const [, ox, oy] = /overlay=x='(.+?)':y='(.+?)':eval=frame/.exec(filter)!;
      const [, enable] = /overlay=enable='(.+?)'$/.exec(filter)!;
      if (ev(enable!, t) > 0) {
        x = ev(ox!, t) + (x * ev(w!, t)) / W;
        y = ev(oy!, t) + (y * ev(h!, t)) / H;
      }
    } else throw new Error(`filtro fora do modelo: ${filter}`);
  }
  return { x, y };
}

describe('preview do Cut = render (mesma matemática)', () => {
  const edl = fixture();
  const timeline = buildTimeline(edl.clips, FPS);
  const size = { width: W, height: H };

  // caminho do render, na mesma sequência de src/render/index.ts
  const plans = planStageFocus(edl, timeline, samples);
  const guard = planGuard(edl, FOOT, timeline, samples);
  const renderProps = buildOverlayProps(edl, timeline, { words: [] }, undefined, stageFocusMap(plans), guard.shifts);
  applyStageTracks(renderProps.overlays, stageTrackMap(plans));
  const renderFilters = [
    ...zoomFilters(placeZooms([...edl.zooms.filter((zoom) => !zoom.id.startsWith(FIT_PREFIX)), ...guard.zooms], timeline), W, H),
    ...effectFilters(placeEffects(edl.effects, timeline), size, FPS),
    ...reframeFilters(placeStages(renderProps.overlays, FPS), W, H),
  ];

  // caminho do Cut: o que o servidor devolve (JSON) alimenta as mesmas funções puras
  const payload = JSON.parse(JSON.stringify(buildGuardPayload(edl, timeline, FOOT, samples, 'detector'))) as ReturnType<typeof buildGuardPayload>;
  const cutProps = buildPreviewProps(edl, timeline, { words: [] }, payload);
  const input = {
    zooms: placeZooms([...edl.zooms.filter((zoom) => !zoom.id.startsWith(FIT_PREFIX)), ...payload.zooms], timeline),
    effects: placeEffects(edl.effects, timeline),
    stages: placeStages(cutProps.overlays, FPS),
    ...size,
    fps: FPS,
  };

  it('a fixture exercita palco, palcos colados, trilha, zoom de ajuste, deslocamento e janela com push', () => {
    expect(renderProps.overlays.filter((item) => item.stage).length).toBeGreaterThanOrEqual(3);
    expect(payload.zooms.some((zoom) => zoom.id.startsWith(FIT_PREFIX))).toBe(true);
    expect(Object.keys(payload.shifts).length + payload.zooms.length).toBeGreaterThan(0);
    expect(Object.keys(payload.stageFocus)).toContain('o-stage');
    expect(reframeFilters(placeStages(renderProps.overlays, FPS), W, H)).toHaveLength(1);
  });

  it('o plano do servidor, depois de JSON, monta as mesmas props que o render (palco, foco, trilha, deslocamento)', () => {
    expect(cutProps.overlays.map((item) => [item.id, item.from, item.durationInFrames, item.stage ?? null, item.shift ?? null])).toEqual(
      renderProps.overlays.map((item) => [item.id, item.from, item.durationInFrames, item.stage ?? null, item.shift ?? null]),
    );
  });

  it('transformação do footage em N instantes: Cut e render diferem < 1 px (zoom + efeitos + palco)', () => {
    let checked = 0;
    let staged = 0;
    let zoomed = 0;
    let worst = 0;
    const corners = [
      { x: 0, y: 0 },
      { x: W, y: H },
      { x: W / 2, y: H / 2 },
      { x: 0.52 * W, y: 0.4 * H },
    ];
    for (let frame = 0; frame < Math.round(timeline.durationSec * FPS); frame += 3) {
      const t = frame / FPS;
      const cut = footageFrameAt(input, t);
      if (cut.stage) staged += 1;
      if (cut.inner.sx !== 1 || cut.inner.tx !== 0) zoomed += 1;
      for (const point of corners) {
        const a = mapPoint(cut, W, H, point);
        const b = renderPoint(renderFilters, t, point);
        worst = Math.max(worst, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect(staged).toBeGreaterThan(50);
    expect(zoomed).toBeGreaterThan(50);
    expect(worst).toBeLessThan(1);
  });

  it('efeitos de câmera: a expressão do render é lida do mesmo gerador e todos os de reframe são cobertos', () => {
    const covered = Object.values(effects)
      .filter((preset) => preset.kind === 'filter' && preset.category === 'camera')
      .map((preset) => [preset.id, cameraStep(buildEffectFilters(preset.id, { start: 1, end: 3, intensity: 0.5, focus: { x: 0.5, y: 0.4 }, fps: FPS, ...size }), W, H)] as const);
    const missing = covered.filter(([, step]) => step === null).map(([id]) => id);
    // a rotação sutil gira o quadro (rotate): o preview mostra só o enquadramento, não o giro
    expect(missing).toEqual(['camera-dutch-tilt']);
  });

  it('cor da EDL vira CSS com os mesmos fatores do filtro eq', () => {
    const grade = edl.grade;
    const css = gradeCss(grade);
    expect(css).toContain('brightness(1.149)');
    expect(css).toContain('contrast(1.155)'); // preset warm 1.05 × 1.1
    expect(css).toContain('saturate(0.972)'); // preset warm 1.08 × 0.9
    expect(gradeFilters(grade).join(',')).toContain('eq=contrast=1.155:saturation=0.972');
  });
});

describe('CSS do footage no Cut', () => {
  it('palco vira translate+scale sobre papel; fora dele não mexe; corte vira identidade', async () => {
    const { footageCssAt, footageInput } = await import('../cut/src/lib/footage-css.ts');
    const edl = fixture();
    const timeline = buildTimeline(edl.clips, FPS);
    const plans = planStageFocus(edl, timeline, samples);
    const props = buildOverlayProps(edl, timeline, { words: [] }, undefined, stageFocusMap(plans));
    const input = footageInput(edl, timeline, props.overlays, null, FOOT);
    const inside = footageCssAt(input, timeline, 13, 960, edl.grade);
    expect(inside.stage.transform).toMatch(/^translate\(.+\) scale\(/);
    expect(inside.stage.background).toBe('#f8f8f2');
    const outside = footageCssAt(input, timeline, 5, 960, edl.grade);
    expect(outside.stage.transform).toBe('none');
    expect(outside.video.filter).toContain('contrast(1.155)');
    expect(footageCssAt(input, timeline, 65, 960, edl.grade).video.transform).toBe('none'); // 60–70 s da fonte foram cortados
  });
});
