import { describe, expect, it } from 'vitest';

import { estimateFace } from '../src/analyze/focus.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import type { FocusSample } from '../src/render/focus.ts';
import { buildOverlayProps, stagePresenter } from '../src/render/overlay-props.ts';
import {
  centerToStageFocus,
  DEFAULT_STAGE_FOCUS,
  FACE_HALF,
  faceOutside,
  findFaceOutOfStage,
  formatStageFocus,
  planStageFocus,
  stageFocusMap,
  stageSourceSpans,
  visibleFraction,
  windowSpan,
} from '../src/render/stage-focus.ts';

const W = 1920;
const H = 1080;

function edlWith(overlays: unknown[], clips = [{ id: 'c1', start: 0, end: 60 }, { id: 'c2', start: 70, end: 130 }]) {
  return edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-17T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 130, fps: 30, width: 2560, height: 1440 },
    output: { fps: 30, width: W, height: H },
    clips,
    overlays,
  });
}

/** Apresentador parado em `x` (rosto em `faceX`/`faceY`), 2 amostras/s. */
const still = (from: number, to: number, x: number, face?: { x: number; y: number }): FocusSample[] =>
  Array.from({ length: Math.round((to - from) * 2) + 1 }, (_, index) => ({ t: from + index / 2, x, confidence: 0.8, ...(face ? { face } : {}) }));

const track = (center: number, low: number, high: number) => ({ center, low, high, q1: center, q3: center });
const stage = (id: string, at: number, presenter: Record<string, unknown>, duration = 8) => ({ id, component: 'SplitExplainer', at, duration, presenter });

describe('foco do palco: proporção do slot', () => {
  it('o cartão lateral mostra ~27% da largura da fonte; o canto (zoom 1,6) mostra mais, e a janela mostra tudo', () => {
    const card = visibleFraction('right', undefined, W, H);
    expect(card.x).toBeCloseTo(0.2687, 3);
    expect(card.y).toBeGreaterThan(0.99);
    const pip = visibleFraction('pip-br', undefined, W, H);
    expect(pip.x).toBeGreaterThan(card.x);
    expect(pip.y).toBeCloseTo(0.621, 2);
    expect(visibleFraction('window', undefined, W, H).x).toBeGreaterThan(0.99);
    // zoom aproxima: mostra menos
    expect(visibleFraction('pip-br', 2.4, W, H).x).toBeLessThan(pip.x);
  });

  it('janela estreita: o foco vai no centro exato do apresentador, mesmo que ele se mexa', () => {
    // faixa 0.36–0.46 + rosto não cabe em 0.27: centro (mediana) e não o meio da faixa
    expect(centerToStageFocus(track(0.38, 0.36, 0.46), 0.27, FACE_HALF.x)).toBeCloseTo(0.38, 6);
  });

  it('janela larga: o foco vai no meio da faixa do movimento, que cabe inteira com o rosto', () => {
    expect(centerToStageFocus(track(0.38, 0.36, 0.46), 0.6, FACE_HALF.x)).toBeCloseTo(0.41, 6);
  });

  it('o foco fica no alcance do recorte (não descobre a borda) e janela cheia é 0.5', () => {
    expect(centerToStageFocus(track(0.05, 0.05, 0.05), 0.27, FACE_HALF.x)).toBeCloseTo(0.135, 6);
    expect(centerToStageFocus(track(0.98, 0.98, 0.98), 0.4, FACE_HALF.x)).toBeCloseTo(0.8, 6);
    expect(centerToStageFocus(track(0.3, 0.3, 0.3), 1, FACE_HALF.x)).toBe(0.5);
  });

  it('windowSpan/faceOutside: quanto do rosto fica fora do recorte', () => {
    expect(windowSpan(0.47, 0.27)).toEqual({ start: expect.closeTo(0.335, 6), end: expect.closeTo(0.605, 6) });
    expect(faceOutside(0.4, 0.27, 0.4, 0.06)).toBe(0);
    // rosto em 0.30 ± 0.06 (0.24–0.36) com recorte em 0.335–0.605: 0.095 de 0.12 de fora
    expect(faceOutside(0.47, 0.27, 0.3, 0.06)).toBeCloseTo(0.095 / 0.12, 6);
    expect(faceOutside(0.47, 0.27, 0.1, 0.06)).toBe(1);
    expect(faceOutside(0.2, 1, 0.9, 0.06)).toBe(0);
  });
});

describe('foco do palco: plano por overlay', () => {
  it('schema: "auto" é o padrão; número/objeto continua valendo', () => {
    const edl = edlWith([stage('a', 5, { slot: 'right' }), stage('b', 20, { slot: 'left', focus: { x: 0.4, y: 0.3 } }), stage('c', 35, { slot: 'pip-br', focus: 'auto' })]);
    expect(edl.overlays.map((overlay) => overlay.presenter!.focus)).toEqual(['auto', { x: 0.4, y: 0.3 }, 'auto']);
    expect(() => edlWith([stage('a', 5, { slot: 'right', focus: 'centro' })])).toThrow();
  });

  it('auto: centro do rosto no intervalo do palco (segundos da fonte); fixo passa direto', () => {
    const edl = edlWith([stage('a', 5, { slot: 'right' }), stage('b', 20, { slot: 'pip-br', focus: { x: 0.47, y: 0.4 } })]);
    const timeline = buildTimeline(edl.clips, 30);
    // fora do palco o apresentador está em outro lugar: não pode contaminar o foco
    const samples = [...still(0, 4.5, 0.7), ...still(5, 13, 0.45, { x: 0.39, y: 0.24 }), ...still(20, 28, 0.44, { x: 0.42, y: 0.26 })];
    const [a, b] = planStageFocus(edl, timeline, samples);
    expect(a).toMatchObject({ id: 'a', mode: 'auto', focus: { x: 0.39, y: expect.closeTo(0.497, 3) } });
    expect(b).toMatchObject({ id: 'b', mode: 'fixed', focus: { x: 0.47, y: 0.4 } });
    // sem rosto detectado: centro do apresentador e a faixa do rosto (0.3–0.6)
    const [plain] = planStageFocus(edlWith([stage('p', 5, { slot: 'pip-br' })]), timeline, still(5, 13, 0.4));
    expect(plain!.focus.x).toBeCloseTo(0.4, 3);
    expect(plain!.focus.y).toBeCloseTo(0.45, 3);
  });

  it('sem amostra: auto cai no padrão e avisa', () => {
    const edl = edlWith([stage('a', 5, { slot: 'right' })]);
    const plans = planStageFocus(edl, buildTimeline(edl.clips, 30), null);
    expect(plans[0]!.focus).toEqual(DEFAULT_STAGE_FOCUS);
    expect(formatStageFocus(plans)[0]).toMatch(/aviso: foco auto do palco a .*sem amostra/);
  });

  it('palco que atravessa um corte usa só a fonte mantida', () => {
    const edl = edlWith([stage('a', 56, { slot: 'right' }, 8)]);
    const timeline = buildTimeline(edl.clips, 30);
    const spans = stageSourceSpans(timeline, edl.overlays[0]!);
    expect(spans).toHaveLength(2);
    expect(spans[0]!).toEqual({ start: 56, end: 60 });
    expect(spans[1]!.start).toBeCloseTo(70, 6);
    expect(spans[1]!.end).toBeCloseTo(74, 6);
    // o trecho cortado (60–70) tem o apresentador em outro lugar: fica de fora
    const samples = [...still(56, 60, 0.4, { x: 0.4, y: 0.25 }), ...still(60.5, 69.5, 0.8, { x: 0.8, y: 0.25 }), ...still(70, 74, 0.4, { x: 0.4, y: 0.25 })];
    expect(planStageFocus(edl, timeline, samples)[0]!.focus.x).toBeCloseTo(0.4, 3);
  });

  it('slots de janela e WindowStage de footage ficam de fora (mostram o footage inteiro)', () => {
    const edl = edlWith([
      stage('w', 5, { slot: 'window' }),
      { id: 'f', component: 'WindowStage', at: 20, duration: 5, props: { kind: 'footage' }, presenter: { slot: 'pip-br' } },
    ]);
    expect(planStageFocus(edl, buildTimeline(edl.clips, 30), still(0, 30, 0.4))).toEqual([]);
  });

  it('stagePresenter resolve "auto" pelo mapa e, sem ele, cai no padrão', () => {
    const edl = edlWith([stage('a', 5, { slot: 'right' }), stage('b', 13, { slot: 'left', focus: { x: 0.3, y: 0.2 } })]);
    const map = new Map([['a', { x: 0.41, y: 0.5 }]]);
    expect(stagePresenter(edl.overlays[0]!, map)!.focus).toEqual({ x: 0.41, y: 0.5 });
    expect(stagePresenter(edl.overlays[0]!)!.focus).toEqual(DEFAULT_STAGE_FOCUS);
    expect(stagePresenter(edl.overlays[1]!, map)!.focus).toEqual({ x: 0.3, y: 0.2 });
    // e o foco resolvido chega ao plano do palco (e ao `from` do palco colado seguinte)
    const props = buildOverlayProps(edl, buildTimeline(edl.clips, 30), { words: [] }, undefined, map);
    const [first, second] = props.overlays.filter((item) => item.stage);
    expect(first!.stage!.focus).toEqual({ x: 0.41, y: 0.5 });
    expect(second!.stage!.from!.focus).toEqual({ x: 0.41, y: 0.5 });
  });
});

describe('achado rosto-fora-do-palco', () => {
  const timelineOf = (edl: ReturnType<typeof edlWith>) => buildTimeline(edl.clips, 30);

  it('foco fixo 0.47 no cartão com o rosto em 0.40: erro com sugestão de "auto"', () => {
    const edl = edlWith([stage('s-promessa', 24.65, { slot: 'right', focus: { x: 0.47, y: 0.4 } })]);
    const findings = findFaceOutOfStage(planStageFocus(edl, timelineOf(edl), still(24, 34, 0.42, { x: 0.4, y: 0.24 })));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'error', check: 'rosto-fora-do-palco', at: 24.65 });
    expect(findings[0]!.message).toMatch(/s-promessa.*right.*rosto/);
    expect(findings[0]!.fix).toMatch(/"auto"/);
    expect(formatStageFocus(planStageFocus(edl, timelineOf(edl), still(24, 34, 0.42, { x: 0.4, y: 0.24 }))).join('\n')).toMatch(/aviso: palco s-promessa .*corta/);
  });

  it('o mesmo palco em "auto" não acusa; foco fixo que enquadra também não', () => {
    const samples = still(24, 34, 0.42, { x: 0.4, y: 0.24 });
    const auto = edlWith([stage('a', 24.65, { slot: 'right', focus: 'auto' })]);
    expect(findFaceOutOfStage(planStageFocus(auto, timelineOf(auto), samples))).toEqual([]);
    const good = edlWith([stage('a', 24.65, { slot: 'right', focus: { x: 0.4, y: 0.4 } })]);
    expect(findFaceOutOfStage(planStageFocus(good, timelineOf(good), samples))).toEqual([]);
  });

  it('o canto (janela larga) tolera o mesmo desvio que corta o cartão', () => {
    const samples = still(24, 34, 0.42, { x: 0.4, y: 0.24 });
    const pip = edlWith([stage('a', 24.65, { slot: 'pip-br', focus: { x: 0.47, y: 0.4 } })]);
    expect(findFaceOutOfStage(planStageFocus(pip, timelineOf(pip), samples))).toEqual([]);
  });

  it('auto que ainda corta (o apresentador anda mais que o cartão) vira aviso, não erro', () => {
    const samples = [...still(24, 28, 0.2, { x: 0.2, y: 0.25 }), ...still(28.5, 34, 0.75, { x: 0.75, y: 0.25 })];
    const edl = edlWith([stage('a', 24.65, { slot: 'right' })]);
    const findings = findFaceOutOfStage(planStageFocus(edl, timelineOf(edl), samples));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warning');
    expect(findings[0]!.fix).toMatch(/slot mais largo|divida/);
  });

  it('stageFocusMap: id → foco', () => {
    const edl = edlWith([stage('a', 5, { slot: 'right' })]);
    expect(stageFocusMap(planStageFocus(edl, timelineOf(edl), still(5, 13, 0.4, { x: 0.38, y: 0.25 }))).get('a')).toEqual({ x: 0.38, y: expect.any(Number) });
  });
});

describe('detector: centro do rosto pela pele', () => {
  it('acha a altura (testa→queixo) e o centro horizontal do rosto, ignorando a mão mais abaixo', () => {
    const width = 100;
    const height = 60;
    const mask = new Uint8Array(width * height);
    const fill = (x0: number, y0: number, w: number, h: number) => {
      for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) mask[y * width + x] = 1;
    };
    fill(30, 8, 12, 14); // rosto: x 30–42, y 8–22
    fill(34, 22, 4, 4); // pescoço estreito
    fill(55, 36, 10, 8); // mão à direita, embaixo
    const face = estimateFace(mask, width, height, 0.4)!;
    expect(face.x).toBeCloseTo(36 / width, 2);
    expect(face.y).toBeCloseTo(15 / height, 1);
    expect(estimateFace(new Uint8Array(width * height), width, height, 0.4)).toBeNull();
  });
});
