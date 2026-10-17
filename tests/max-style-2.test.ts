import { describe, expect, it } from 'vitest';

import {
  anchorOpacity,
  contentTiming,
  easeInOut,
  easeInOutQuad,
  exitCue,
  holeAt,
  isWindowSlot,
  linkStages,
  normalizePushes,
  noteColumn,
  type PresenterSpec,
  PRESENTER_SLOTS,
  pushAt,
  pushEnvelope,
  type Rect,
  sameStage,
  screenSpan,
  slotRect,
  slotTransform,
  stageMotion,
  type StagePlan,
  stageRamps,
  tearPolygon,
  transformAt,
  WINDOW,
  windowBodyRect,
  windowRect,
  windowSide,
} from '../motion/src/arsenal/stage.ts';
import { CARD_TILT, TAPE } from '../motion/src/components/DocQuote.tsx';
import { pillRole, STACK_GAP, stackGap, stackItems } from '../motion/src/components/PillStack.tsx';
import { registry } from '../motion/src/components/registry.ts';
import { boxDim, entry as screenFocus, focusState, mapBox, RING, ringState, validBoxes, validClicks } from '../motion/src/components/ScreenFocus.tsx';
import { cardTimes, entry as splitExplainer, TITLE_START, titleTimes } from '../motion/src/components/SplitExplainer.tsx';
import { activeStep, CHIP, entry as stageProgress, progressSteps, stepCount, stepGlow } from '../motion/src/components/StageProgress.tsx';
import { contrastRatio, leave, PILL_MIN_FONT, PILL_TONES, pillColors, pillMetrics, rise, wordReveal, wordTimes } from '../motion/src/components/stage-kit.tsx';
import { entry as windowStage, lidOpacity, noteLimit, windowKind } from '../motion/src/components/WindowStage.tsx';
import { motion, stageMotion as themeMotion } from '../motion/src/theme.ts';
import type { OverlayItem } from '../motion/src/types.ts';
import type { Transcript } from '../src/analyze/types.ts';
import { catalog } from '../src/arsenal/catalog.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { lintStyle } from '../src/eval/checks.ts';
import { buildLayoutGraph, windowGroups } from '../src/render/layout.ts';
import { buildOverlayProps, stagePresenter } from '../src/render/overlay.ts';
import { curveExpr, placeStages, pushSumExpr, rampExpr, reframeFilters, stageExpressions, windowLayouts } from '../src/render/reframe.ts';

const W = 1920;
const H = 1080;
const F = 1 / 30;
const spec = (slot: PresenterSpec['slot'], extra: Partial<PresenterSpec> = {}): PresenterSpec => ({ slot, focus: { x: 0.5, y: 0.4 }, backdrop: 'paper', ...extra });
const plan = (slot: PresenterSpec['slot'], extra: Partial<StagePlan> = {}): StagePlan => ({ ...spec(slot), from: null, holdExit: false, ...extra });
const transcript: Transcript = { language: 'pt', words: [] } as unknown as Transcript;

function edlWith(extra: Record<string, unknown>) {
  return edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-12T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 130, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [{ id: 'c1', start: 0, end: 130 }],
    ...extra,
  });
}

/** Avalia uma expressão do ffmpeg (subconjunto usado no reenquadramento) num instante `t`. */
function evalExpr(expression: string, t: number): number {
  const scope = {
    t,
    gte: (a: number, b: number) => (a >= b ? 1 : 0),
    lt: (a: number, b: number) => (a < b ? 1 : 0),
    pow: Math.pow,
    clip: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    trunc: Math.trunc,
  };
  return new Function(...Object.keys(scope), `return ${expression};`)(...Object.values(scope)) as number;
}

/** cubic-bezier(x1, y1, x2, y2) por bisseção, só para conferir a forma fechada. */
function bezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let [low, high] = [0, 1];
  for (let step = 0; step < 50; step += 1) {
    const mid = (low + high) / 2;
    if (at(x1, x2, mid) < x) low = mid;
    else high = mid;
  }
  return at(y1, y2, (low + high) / 2);
}

const covers = (transform: { scale: number; x: number; y: number }, hole: Rect) => {
  expect(transform.x).toBeLessThanOrEqual(hole.x * W + 1e-6);
  expect(transform.y).toBeLessThanOrEqual(hole.y * H + 1e-6);
  expect(transform.x + W * transform.scale).toBeGreaterThanOrEqual((hole.x + hole.w) * W - 1e-6);
  expect(transform.y + H * transform.scale).toBeGreaterThanOrEqual((hole.y + hole.h) * H - 1e-6);
};

describe('gramática de movimento medida (stageMotion)', () => {
  it('a curva da troca é a cubic-bezier(0.65, 0, 0.35, 1) da referência e bate com a série medida', () => {
    let worst = 0;
    for (let step = 0; step <= 100; step += 1) worst = Math.max(worst, Math.abs(easeInOut(step / 100) - bezier(0.65, 0, 0.35, 1, step / 100)));
    expect(worst).toBeLessThan(0.02);
    // progresso por frame do morph do apresentador, medido em 720p (movimento-hd §2.2)
    const measured = [0, 0.001, 0.003, 0.009, 0.019, 0.032, 0.05, 0.072, 0.102, 0.14, 0.19, 0.253, 0.332, 0.429, 0.534, 0.635, 0.72, 0.788, 0.842, 0.884, 0.917, 0.942, 0.962, 0.976, 0.988, 0.994, 0.998, 1];
    const rmse = Math.sqrt(measured.reduce((sum, value, frame) => sum + (easeInOut(frame / 27) - value) ** 2, 0) / measured.length);
    expect(rmse).toBeLessThan(0.02);
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(motion.stage).toBe(easeInOut);
    expect(themeMotion).toBe(stageMotion);
  });

  it('a tabela guarda as durações medidas em frames de 30 fps', () => {
    const frames = (sec: number) => Math.round(sec * 30 * 10) / 10;
    expect(frames(stageMotion.layout.inSec)).toBe(27);
    expect(frames(stageMotion.layout.outSec)).toBe(27);
    expect(frames(stageMotion.pill.sec)).toBe(10);
    expect(stageMotion.pill).toMatchObject({ rise: 26, scaleFrom: 0.92 });
    expect(frames(stageMotion.tile.sec)).toBe(10);
    expect(stageMotion.tile.rise).toBe(51);
    expect(stageMotion.doc.rise).toBe(66);
    expect(frames(stageMotion.word.sec)).toBe(10);
    expect(frames(stageMotion.word.stepSec)).toBe(3.5);
    expect(stageMotion.word).toMatchObject({ riseTitle: 20, risePhrase: 36 });
    expect(frames(stageMotion.exit.sec)).toBe(8);
    expect(frames(stageMotion.push.inSec)).toBe(36);
    expect(frames(stageMotion.push.outSec)).toBe(27);
    expect(stageMotion.push.scale).toBe(1.25);
    expect(frames(stageMotion.tear.sec)).toBe(11);
    expect(stageMotion.presenterCard.radius).toBeGreaterThanOrEqual(33);
    expect(stageMotion.presenterCard.radius).toBeLessThanOrEqual(35);
  });

  it('`transitionSec` troca a duração da troca por overlay, com o mesmo teto de um terço', () => {
    expect(stageRamps(12)).toEqual({ enter: stageMotion.layout.inSec, exit: stageMotion.layout.outSec });
    expect(stageRamps(12, 0.4)).toEqual({ enter: 0.4, exit: 0.4 });
    expect(stageRamps(0.9, 2).enter).toBeCloseTo(0.3);
    expect(stageRamps(12, Number.NaN)).toEqual(stageRamps(12));
    // a meio caminho da troca o buraco já andou metade (curva simétrica)
    const half = holeAt(plan('right', { transitionSec: 0.6 }), 0.3, 6);
    expect(half.rect.w).toBeCloseTo((1 + slotRect('right').w) / 2);
    // a borda cresce de 0 ao valor cheio junto com a troca
    expect(half.border).toBeCloseTo(stageMotion.presenterCard.border / 2);
    expect(holeAt(plan('right'), 3, 6).border).toBe(stageMotion.presenterCard.border);
  });

  it('pílula e cartão desaceleram sem ultrapassar; a saída é ease-in-out de 8 f', () => {
    const series = Array.from({ length: 14 }, (_, frame) => rise(frame, 30, 0));
    expect(series[0]).toBe(0);
    expect(series[10]).toBe(1);
    expect(Math.max(...series)).toBe(1);
    series.slice(1).forEach((value, index) => expect(value).toBeGreaterThanOrEqual(series[index]!));
    // legível no segundo frame: a opacidade (progresso × 3) já passou de 85%
    expect(Math.min(1, series[2]! * 3)).toBeGreaterThanOrEqual(0.85);
    expect(leave(82, 30, 90)).toBe(0);
    expect(leave(86, 30, 90)).toBeCloseTo(0.5);
    expect(leave(90, 30, 90)).toBe(1);
  });

  it('rasgo: 11 dentes de ~4,8% da largura, com ease-in-out quadrático', () => {
    // frente média medida do rasgo, frame a frame (movimento-hd §2.3)
    const measured = [0.007, 0.048, 0.113, 0.207, 0.336, 0.514, 0.686, 0.82, 0.914, 0.978, 1];
    const rmse = Math.sqrt(measured.reduce((sum, value, frame) => sum + (easeInOutQuad((frame + 0.5) / 11) - value) ** 2, 0) / measured.length);
    expect(rmse).toBeLessThan(0.035);
    const xs = [...tearPolygon(0.5).matchAll(/([\d.]+)% [\d.]+%/g)].map((match) => Number(match[1])).slice(1, -1);
    expect(xs).toHaveLength(stageMotion.tear.teeth * 2 + 1);
    const amplitude = Math.max(...xs) - Math.min(...xs);
    expect(amplitude).toBeGreaterThan(4);
    expect(amplitude).toBeLessThan(6.5);
    // no fim do percurso os dentes já saíram do quadro
    expect(Math.min(...[...tearPolygon(0.999).matchAll(/([\d.]+)% [\d.]+%/g)].map((match) => Number(match[1])).slice(1, -1))).toBeGreaterThan(98);
  });
});

describe('zoom na janela (push)', () => {
  it('normalizePushes ordena, limita e cruza pushes vizinhos', () => {
    expect(normalizePushes(undefined, 10)).toEqual([]);
    expect(normalizePushes({ at: 12 }, 10)).toEqual([]);
    expect(normalizePushes([{ at: -1 }, { foo: 1 }, null, 'x'], 10)).toEqual([]);
    const [single] = normalizePushes({ at: 2 }, 10);
    expect(single).toEqual({ at: 2, inSec: stageMotion.push.inSec, scale: 1.25, x: 0.5, y: 0.5, outAt: null, outSec: stageMotion.push.outSec });
    // com `hold` o push volta sozinho, em 27 f
    expect(normalizePushes({ at: 2, hold: 3 }, 12)[0]).toMatchObject({ outAt: 2 + stageMotion.push.inSec + 3, outSec: stageMotion.push.outSec });
    // dois pushes seguidos: o primeiro sai enquanto o segundo entra, na mesma curva e duração (pan)
    const [first, second] = normalizePushes([{ at: 6, scale: 2, x: 0.8, y: 0.2 }, { at: 1, scale: 1.5, x: 0.2, y: 0.7 }], 12);
    expect(first).toMatchObject({ at: 1, outAt: 6, outSec: stageMotion.push.inSec });
    expect(second).toMatchObject({ at: 6, scale: 2, outAt: null });
    // volta que não termina antes do próximo também vira cruzamento
    expect(normalizePushes([{ at: 1, hold: 0.5 }, { at: 3 }], 12)[0]).toMatchObject({ outAt: 3, outSec: stageMotion.push.inSec });
    expect(normalizePushes([{ at: 1, hold: 0.2 }, { at: 8 }], 12)[0]).toMatchObject({ outAt: 1 + stageMotion.push.inSec + 0.2, outSec: stageMotion.push.outSec });
  });

  it('o alvo fica parado, o conteúdo cobre sempre a janela e o push com volta retorna a 1', () => {
    const pushes = normalizePushes([{ at: 1, scale: 1.6, x: 0.81, y: 0.28, hold: 2 }, { at: 7, scale: 2.2, x: 0.1, y: 0.9 }, { at: 9.5, scale: 1.3, x: 0.5, y: 0.5 }], 14);
    for (let frame = 0; frame <= 14 * 30; frame += 1) {
      const state = pushAt(pushes, frame * F);
      expect(state.scale).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(state.scale).toBeLessThanOrEqual(2.2 + 1e-9);
      // nenhuma borda do corpo fica descoberta
      expect(state.tx).toBeLessThanOrEqual(1e-9);
      expect(state.ty).toBeLessThanOrEqual(1e-9);
      expect(state.tx + state.scale).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(state.ty + state.scale).toBeGreaterThanOrEqual(1 - 1e-9);
      for (const push of pushes) expect(pushEnvelope(push, frame * F)).toBeGreaterThanOrEqual(-1e-9);
    }
    // 36 f para entrar: no meio (curva simétrica) metade do zoom
    expect(pushAt(pushes, 1 + stageMotion.push.inSec / 2).scale).toBeCloseTo(1.3);
    const held = pushAt(pushes, 1 + stageMotion.push.inSec + 1);
    expect(held.scale).toBeCloseTo(1.6);
    expect(0.81 * held.scale + held.tx).toBeCloseTo(0.81);
    expect(0.28 * held.scale + held.ty).toBeCloseTo(0.28);
    // depois da espera, volta em 27 f
    expect(pushAt(pushes, 1 + stageMotion.push.inSec + 2 + stageMotion.push.outSec).scale).toBeCloseTo(1);
    // cruzamento: a meio caminho, a média dos dois estados
    expect(pushAt(pushes, 9.5 + stageMotion.push.inSec / 2).scale).toBeCloseTo((2.2 + 1.3) / 2);
    expect(pushAt(pushes, 13.9).scale).toBeCloseTo(1.3);
  });

  it('a expressão do ffmpeg é a mesma conta de pushAt, frame a frame', () => {
    const pushes = normalizePushes([{ at: 0.5, scale: 1.8, x: 0.7, y: 0.3, hold: 1 }, { at: 4, scale: 1.4, x: 0.2, y: 0.6 }, { at: 5, scale: 2, x: 0.9, y: 0.9 }], 8);
    const origin = 12.4;
    const zoom = `1+${pushSumExpr(pushes, origin, (push) => push.scale - 1)}`;
    const tx = `-(${pushSumExpr(pushes, origin, (push) => push.x * (push.scale - 1))})`;
    for (let frame = 0; frame <= 8 * 30; frame += 1) {
      const state = pushAt(pushes, frame * F);
      expect(evalExpr(zoom, origin + frame * F)).toBeCloseTo(state.scale, 5);
      expect(evalExpr(tx, origin + frame * F)).toBeCloseTo(state.tx, 5);
    }
    expect(pushSumExpr([], 3, () => 1)).toBe('0');
    for (let step = 0; step <= 20; step += 1) expect(evalExpr(curveExpr(String(step / 20)), 0)).toBeCloseTo(easeInOut(step / 20), 9);
    expect(evalExpr(rampExpr(2, 0.5), 2.25)).toBeCloseTo(0.5);
  });
});

describe('janela: geometria, espelho e footage dentro dela', () => {
  it('a janela espelha quando o apresentador está à esquerda, e nunca fica sob o canto', () => {
    expect(PRESENTER_SLOTS.map((slot) => windowSide(slot))).toEqual(['left', 'right', 'left', 'right', 'left', 'right', 'left', 'right']);
    expect(windowSide(null)).toBe('left');
    expect(windowSide(undefined, true)).toBe('right');
    const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const slot of ['pip-br', 'pip-bl', 'pip-tr', 'pip-tl'] as const) {
      const side = windowSide(slot);
      for (const media of [false, true]) expect(overlaps(windowRect(side, media), slotRect(slot))).toBe(false);
      const column = noteColumn(side, slot);
      expect(overlaps(column, slotRect(slot))).toBe(false);
      expect(overlaps(column, windowRect(side))).toBe(false);
      expect(column.w).toBeGreaterThan(0.2);
      expect(column.h).toBeGreaterThan(0.4);
      expect(column.x).toBeGreaterThanOrEqual(0);
      expect(column.x + column.w).toBeLessThanOrEqual(1);
    }
    // espelho exato
    expect(windowRect('right').x).toBeCloseTo(1 - windowRect('left').x - windowRect('left').w);
    expect(noteColumn('left', null).h).toBeGreaterThan(noteColumn('left', 'pip-br').h);
    expect(noteLimit('pip-br')).toBe(3);
    expect(noteLimit(null)).toBe(4);
    expect(noteLimit('window')).toBe(4);
  });

  it('com tela ou footage o corpo tem a proporção do quadro, dentro da faixa da janela medida', () => {
    for (const side of ['left', 'right'] as const) {
      const body = windowBodyRect(side);
      // normalizado, largura = altura significa a proporção do quadro (a tela cabe inteira, sem faixas)
      expect(body.w).toBeCloseTo(body.h);
      const frame = windowRect(side, true);
      expect(frame.y).toBeGreaterThanOrEqual(WINDOW.y);
      expect(frame.y + frame.h).toBeLessThanOrEqual(WINDOW.y + WINDOW.h + 1e-9);
      expect(body.y).toBeCloseTo(frame.y + WINDOW.bar);
    }
    expect(slotRect('window')).toEqual(windowBodyRect('left'));
    expect(slotRect('window-right')).toEqual(windowBodyRect('right'));
    expect(isWindowSlot('window')).toBe(true);
    expect(isWindowSlot('pip-br')).toBe(false);
    expect(windowRect('left', false).h).toBe(WINDOW.h);
  });

  it('slot `window`: o footage inteiro pousa no corpo da janela, sem borda e arredondado só embaixo', () => {
    const landed = holeAt(plan('window'), 3, 8);
    expect(landed.rect.x).toBeCloseTo(windowBodyRect().x);
    expect(landed.radii).toEqual([0, 0, WINDOW.radius, WINDOW.radius]);
    expect(landed.border).toBe(0);
    const transform = slotTransform(spec('window', { focus: { x: 0.5, y: 0.5 } }), W, H);
    // cabe inteiro: a escala é a largura do corpo (mais a sobra de cobertura)
    expect(transform.scale).toBeGreaterThanOrEqual(windowBodyRect().w);
    expect(transform.scale).toBeLessThan(windowBodyRect().w * 1.01);
    // vindo de um canto, os raios e a borda interpolam
    const sliding = holeAt(plan('window', { from: spec('pip-br') }), 0, 8);
    expect(sliding.radii[0]).toBe(stageMotion.presenterCard.radius);
    expect(sliding.border).toBe(stageMotion.presenterCard.border);
  });

  it('com pushes, o footage cobre o buraco em todo instante (entrada, zoom, cruzamento e saída)', () => {
    const pushes = normalizePushes([{ at: 0.3, scale: 1.8, x: 0.85, y: 0.2 }, { at: 3, scale: 2.4, x: 0.1, y: 0.95, hold: 1 }], 8);
    const plans = [plan('window', { pushes }), plan('window-right', { pushes, from: spec('pip-bl'), holdExit: true }), plan('window', { pushes, transitionSec: 0.4 })];
    for (const item of plans) {
      for (let frame = 0; frame <= 8 * 30; frame += 1) {
        covers(transformAt(item, frame * F, 8, W, H), holeAt(item, frame * F, 8).rect);
      }
    }
    // em zoom, o ponto-alvo do footage fica parado na tela
    const item = plan('window', { pushes: normalizePushes({ at: 1, scale: 2, x: 0.25, y: 0.75 }, 8) });
    const point = (sec: number) => {
      const transform = transformAt(item, sec, 8, W, H);
      return [transform.x + 0.25 * W * transform.scale, transform.y + 0.75 * H * transform.scale];
    };
    const before = point(0.95);
    const after = point(4);
    // (a âncora é do corpo da janela; o footage tem 0,6% de sobra de cobertura, daí a folga de poucos px)
    expect(Math.abs(after[0]! - before[0]!)).toBeLessThan(4);
    expect(Math.abs(after[1]! - before[1]!)).toBeLessThan(4);
    expect(transformAt(item, 4, 8, W, H).scale).toBeCloseTo(slotTransform(item, W, H).scale * 2);
  });

  it('ffmpeg e camada de gráficos dão a mesma transformação com a curva nova, `transitionSec` e pushes', () => {
    const stageItem = (id: string, from: number, frames: number, stage: StagePlan): OverlayItem => ({ id, component: 'WindowStage', from, durationInFrames: frames, props: {}, hidesCaptions: true, stage });
    const items = [
      stageItem('a', 15, 120, plan('pip-bl', { transitionSec: 0.5, holdExit: true })),
      stageItem('b', 135, 180, plan('window-right', { from: spec('pip-bl'), pushes: normalizePushes([{ at: 1.2, scale: 1.7, x: 0.8, y: 0.3 }, { at: 3.4, scale: 2.2, x: 0.2, y: 0.6, hold: 0.5 }], 6) })),
      stageItem('c', 360, 45, plan('right')),
    ];
    const placed = placeStages(items, 30);
    const expressions = stageExpressions(placed, W, H);
    for (let frame = 0; frame < 430; frame += 1) {
      const t = frame / 30;
      const active = placed.find((item) => t >= item.start && t < item.end);
      const expected = active ? transformAt(active.plan, t - active.start, active.end - active.start, W, H) : { scale: 1, x: 0, y: 0 };
      expect(evalExpr(expressions.scale, t)).toBeCloseTo(expected.scale, 3);
      expect(evalExpr(expressions.x, t)).toBeCloseTo(expected.x, 1);
      expect(evalExpr(expressions.y, t)).toBeCloseTo(expected.y, 1);
    }
    const [filter] = reframeFilters(placed, 1280, 720);
    expect(filter).toContain('eval=frame');
    expect(filter).not.toContain('if(');
  });

  it('kind "footage" é um palco por definição; a camada fixa nunca é', () => {
    const base = { component: 'WindowStage', props: { kind: 'footage' }, presenter: null, layer: 'base' as const };
    expect(stagePresenter(base)).toEqual({ slot: 'window', focus: { x: 0.5, y: 0.5 }, backdrop: 'paper' });
    expect(stagePresenter({ ...base, props: { kind: 'footage', mirror: true } })!.slot).toBe('window-right');
    expect(stagePresenter({ ...base, presenter: { ...spec('window-right'), transitionSec: 0.5 } })).toMatchObject({ slot: 'window-right', transitionSec: 0.5 });
    // um `presenter` de canto não combina com o footage dentro da janela: vale a janela
    expect(stagePresenter({ ...base, presenter: spec('pip-br') })!.slot).toBe('window');
    expect(stagePresenter({ ...base, props: { kind: 'screen' }, presenter: spec('pip-br') })!.slot).toBe('pip-br');
    expect(stagePresenter({ ...base, props: {}, presenter: spec('right'), layer: 'persistent' })).toBeNull();
    expect(windowKind('footage')).toBe('footage');
    expect(windowKind('qualquer')).toBe('terminal');
  });

  it('buildOverlayProps: footage na janela ganha plano com pushes; vizinhos colados sabem quem é quem', () => {
    const edl = edlWith({
      overlays: [
        { id: 'tela', component: 'WindowStage', at: 10, duration: 8, props: { kind: 'footage', push: [{ at: 2, scale: 2, x: 0.8, y: 0.3 }, { at: 5, x: 0.2, y: 0.6 }] } },
        { id: 'tela2', component: 'WindowStage', at: 18, duration: 6, props: { kind: 'footage' } },
        { id: 'split', component: 'SplitExplainer', at: 24, duration: 6, presenter: { slot: 'left', transitionSec: 0.5 } },
        { id: 'prog', component: 'StageProgress', at: 9, duration: 22, layer: 'persistent', props: { steps: [{ at: 0 }] } },
      ],
    });
    const props = buildOverlayProps(edl, buildTimeline(edl.clips, 30), transcript);
    const byId = Object.fromEntries(props.overlays.map((item) => [item.id, item]));
    expect(byId.tela!.stage).toMatchObject({ slot: 'window', from: null, holdExit: true, next: { slot: 'window', component: 'WindowStage', kind: 'footage' } });
    expect(byId.tela!.stage!.pushes).toEqual(normalizePushes(edl.overlays[0]!.props.push, 8));
    expect(byId.tela2!.stage).toMatchObject({ from: { slot: 'window', component: 'WindowStage', kind: 'footage' }, next: { slot: 'left', component: 'SplitExplainer' } });
    expect(byId.tela2!.stage!.pushes).toBeUndefined();
    expect(byId.split!.stage).toMatchObject({ slot: 'left', transitionSec: 0.5, holdExit: false });
    expect(byId.prog!.stage).toBeUndefined();
    expect(byId.prog!.layer).toBe('persistent');
    expect(byId.tela!.layer).toBeUndefined();
  });

  it('tela gravada na janela: espelha com o palco, respeita a tampa e leva os zooms para o ffmpeg', () => {
    const screenItem = (id: string, from: number, frames: number, props: Record<string, unknown>, stage?: StagePlan): OverlayItem => ({ id, component: 'WindowStage', from, durationInFrames: frames, props: { kind: 'screen', ...props }, hidesCaptions: true, stage });
    const items = [
      screenItem('a', 60, 240, { push: [{ at: 2, scale: 1.8, x: 0.8, y: 0.3 }] }, plan('pip-br')),
      screenItem('b', 600, 180, {}, plan('pip-bl')),
      screenItem('c', 900, 150, { push: { at: 1, scale: 2, x: 0.3, y: 0.5, hold: 1 } }),
    ];
    const [a, b, c] = windowLayouts(items, 30);
    // a tampa abre depois da troca de layout e fecha antes da saída
    expect(a!.start).toBeCloseTo(2 + stageMotion.layout.inSec);
    expect(a!.end).toBeCloseTo(10 - stageMotion.layout.outSec);
    expect(a!.rect).toEqual(windowBodyRect('left'));
    expect(a!.origin).toBe(2);
    expect(a!.pushes).toHaveLength(1);
    expect(b!.rect).toEqual(windowBodyRect('right'));
    expect(b!.pushes).toBeUndefined();
    // sem palco: a tela ocupa o overlay inteiro
    expect([c!.start, c!.end]).toEqual([30, 35]);
    expect(windowGroups([a!, b!, c!]).map((group) => group.length)).toEqual([2, 1]);

    const graph = buildLayoutGraph({ camera: '[camera]', screenInput: 2, layout: [a!, b!, c!], width: 1920, height: 1080, output: '[laid]' }).join(';');
    expect(graph).toContain('[lwinscr][lwinscr1]');
    expect(graph).toContain('[lwinscr]split=2[lwfit][lwsrc]');
    expect(graph).toContain('eval=frame:flags=bicubic[lwzoom]');
    // a janela espelhada não tem zoom: só encaixa
    expect(graph).toContain('[lwinscr1]scale=');
    expect(graph).not.toContain('[lwzoom1]');
    expect(graph.endsWith('[lwinout1]null[laid]')).toBe(true);
    // a escala do ffmpeg é a de pushAt, somando os dois overlays da mesma posição
    const scale = /\[lwsrc\]scale=w='trunc\(\d+\*(.+?)\/2\)\*2\+2'/.exec(graph)![1]!;
    for (const [item, placed] of [[items[0]!, a!], [items[2]!, c!]] as const) {
      const pushes = normalizePushes(item.props.push, item.durationInFrames / 30);
      for (let frame = 0; frame < item.durationInFrames; frame += 3) {
        const t = placed.origin! + frame * F;
        // fora do intervalo em que a tela aparece o zoom não conta (e um push sem volta não vaza para a janela seguinte)
        expect(evalExpr(scale, t)).toBeCloseTo(t >= placed.start && t < placed.end - 1e-3 ? pushAt(pushes, frame * F).scale : 1, 5);
      }
    }
  });

  it('tampa: fechada durante a troca de layout, aberta no meio, contínua entre duas janelas iguais', () => {
    const self = { component: 'WindowStage', kind: 'screen' };
    expect(screenSpan(null, 6, self)).toEqual({ openAt: 0, closeAt: 6 });
    const alone = screenSpan(plan('pip-br'), 6, self);
    expect(alone).toEqual({ openAt: stageMotion.layout.inSec, closeAt: 6 - stageMotion.layout.outSec });
    expect(lidOpacity(0, alone, false, false)).toBe(1);
    expect(lidOpacity(alone.openAt, alone, false, false)).toBe(1);
    expect(lidOpacity(3, alone, false, false)).toBe(0);
    expect(lidOpacity(alone.closeAt, alone, false, false)).toBe(1);
    const linked = plan('pip-br', { from: { ...spec('pip-br'), component: 'WindowStage', kind: 'screen' }, holdExit: true, next: { slot: 'pip-br', component: 'WindowStage', kind: 'screen' } });
    expect(screenSpan(linked, 6, self)).toEqual({ openAt: 0, closeAt: 6 });
    expect(lidOpacity(0, screenSpan(linked, 6, self), true, true)).toBe(0);
    expect(lidOpacity(6, screenSpan(linked, 6, self), true, true)).toBe(0);
    expect(sameStage(linked.from, { ...self, slot: 'pip-br' })).toBe(true);
    // outro lado, outra variante ou outro componente: não é a mesma janela
    expect(sameStage(linked.from, { ...self, slot: 'pip-bl' })).toBe(false);
    expect(sameStage(linked.from, { component: 'WindowStage', kind: 'terminal', slot: 'pip-br' })).toBe(false);
    expect(sameStage(null, { ...self, slot: 'pip-br' })).toBe(false);
    expect(sameStage({ slot: 'pip-br' }, { slot: 'pip-br' })).toBe(false);
  });
});

describe('conteúdo do palco: entrada, saída coreografada e troca sem vazio', () => {
  it('contentTiming: o conteúdo entra com a troca em andamento e sai junto com ela', () => {
    const span = (items: number) => stageMotion.exit.itemSec + (items - 1) * stageMotion.exit.staggerSec;
    expect(contentTiming(null, 10, 3)).toEqual({ startSec: stageMotion.contentDelaySec, exitSec: 10 - span(3), linkedIn: false, linkedOut: false });
    // voltando para a tela cheia: a saída começa com a troca (o cartão cresce por cima do que resta)
    expect(contentTiming(plan('right'), 10, 3)).toMatchObject({ startSec: stageMotion.contentDelaySec, exitSec: 10 - stageMotion.layout.outSec + stageMotion.exit.lagSec, linkedOut: false });
    // colado no próximo palco: termina no último frame; colado no anterior: começa no primeiro
    expect(contentTiming(plan('right', { holdExit: true, from: spec('pip-br') }), 10, 3)).toEqual({ startSec: 0, exitSec: 10 - span(3), linkedIn: true, linkedOut: true });
    // a cascata inteira cabe dentro da troca de saída, mesmo com 9 itens
    expect(span(9) + stageMotion.exit.lagSec).toBeLessThanOrEqual(stageMotion.layout.outSec + 1e-9);
    expect(contentTiming(null, 0.1, 5).exitSec).toBe(0);
  });

  it('exitCue: o último a entrar sai primeiro, cada um em 7 f, e todos acabam', () => {
    const exitSec = 5;
    expect(exitCue(4.9, exitSec, 0)).toBe(0);
    expect(exitCue(exitSec + 3 * F, exitSec, 0)).toBeGreaterThan(exitCue(exitSec + 3 * F, exitSec, 1));
    expect(exitCue(exitSec + stageMotion.exit.itemSec, exitSec, 0)).toBe(1);
    expect(exitCue(exitSec + stageMotion.exit.itemSec, exitSec, 2)).toBeLessThan(1);
    expect(exitCue(exitSec + stageMotion.exit.itemSec + 2 * stageMotion.exit.staggerSec, exitSec, 2)).toBeCloseTo(1);
  });

  it('na emenda de dois palcos colados o elemento-âncora nunca chega a zero: não há frame de papel vazio', () => {
    const floor = stageMotion.swapFloor;
    const free = { linkedIn: false, linkedOut: false };
    expect(anchorOpacity(0, 0, free)).toBe(0);
    expect(anchorOpacity(1, 1, free)).toBe(0);
    expect(anchorOpacity(1, 0, free)).toBe(1);
    // último frame do palco A e primeiro do palco B
    expect(anchorOpacity(1, 1, { linkedIn: false, linkedOut: true })).toBeCloseTo(floor);
    expect(anchorOpacity(0, 0, { linkedIn: true, linkedOut: false })).toBeCloseTo(floor);
    expect(anchorOpacity(1, 0, { linkedIn: true, linkedOut: true })).toBe(1);
    expect(floor).toBeGreaterThan(0.25);
    // simulação da emenda: do frame -8 ao +8, a opacidade da âncora visível nunca cai abaixo do piso
    const a = contentTiming(plan('right', { holdExit: true }), 6, 4);
    const b = contentTiming(plan('pip-br', { from: spec('right') }), 6, 4);
    for (let frame = -8; frame <= 8; frame += 1) {
      const visible = frame < 0 ? anchorOpacity(1, exitCue(6 + frame * F, a.exitSec, 3), a) : anchorOpacity(rise(frame, 30, b.startSec), 0, b);
      expect(visible).toBeGreaterThanOrEqual(floor - 1e-9);
    }
  });

  it('linkStages passa adiante componente e variante dos vizinhos', () => {
    const items = [
      { id: 'a', from: 0, durationInFrames: 90, presenter: spec('pip-br'), component: 'WindowStage', kind: 'terminal' },
      { id: 'b', from: 90, durationInFrames: 60, presenter: spec('pip-br'), component: 'WindowStage', kind: 'terminal' },
      { id: 'c', from: 150, durationInFrames: 60, presenter: spec('right'), component: 'SplitExplainer' },
    ];
    const plans = linkStages(items);
    expect(plans.get(items[0]!)!.next).toEqual({ slot: 'pip-br', component: 'WindowStage', kind: 'terminal' });
    expect(plans.get(items[1]!)!.from).toMatchObject({ slot: 'pip-br', component: 'WindowStage', kind: 'terminal' });
    expect(plans.get(items[1]!)!.next).toEqual({ slot: 'right', component: 'SplitExplainer' });
    expect(plans.get(items[2]!)!.next).toBeUndefined();
    expect(sameStage(plans.get(items[1]!)!.from, { slot: 'pip-br', component: 'WindowStage', kind: 'terminal' })).toBe(true);
  });
});

describe('título e frase palavra a palavra', () => {
  it('wordTimes: cada palavra no instante em que é dita; sem `wordAt`, cascata de 3,5 f', () => {
    const step = stageMotion.word.stepSec;
    wordTimes(undefined, 3, 0.4).forEach((time, index) => expect(time).toBeCloseTo(0.4 + index * step));
    expect(wordTimes([1, 1.6, 2.4], 3, 0.4)).toEqual([1, 1.6, 2.4]);
    // faltou o tempo de uma palavra: ela segue a anterior na cascata
    expect(wordTimes([1, undefined, 2.4], 3, 0.4)).toEqual([1, 1 + step, 2.4]);
    // duas palavras ditas a menos de 3 f uma da outra (ou fora de ordem) caem na cascata
    wordTimes([1, 1.05, 0.2], 3, 0.4).forEach((time, index) => expect(time).toBeCloseTo(1 + index * step));
    expect(wordTimes([Number.NaN, -1], 2, 0.4)).toEqual([0.4, 0.4 + step]);
    expect(wordTimes([], 0, 0.4)).toEqual([]);
  });

  it('wordReveal: palavra não dita é invisível; 5–25% nos primeiros frames; Y parado 2 f; blur só em 3 f', () => {
    expect(wordReveal(-0.5, 20)).toEqual({ opacity: 0, y: 20, blur: stageMotion.word.blurPx });
    const at = (frame: number, travel = 20) => wordReveal(frame * F, travel);
    // nos 4 primeiros frames a palavra está entre quase nada e 26%, deslocada e borrada
    for (const frame of [1, 2, 3, 4]) expect(at(frame).opacity).toBeLessThan(0.27);
    expect(at(3).opacity).toBeGreaterThan(0.05);
    expect(at(4).opacity).toBeGreaterThan(0.2);
    expect(at(10)).toEqual({ opacity: 1, y: 0, blur: 0 });
    expect(at(2).y).toBe(20);
    expect(at(5).y).toBeLessThan(20);
    expect(at(5).y).toBeGreaterThan(0);
    expect(at(8).y).toBeCloseTo(0);
    expect(at(1).blur).toBeGreaterThan(0);
    expect(at(3).blur).toBeCloseTo(0);
    // +20 px no título, +36 px na frase
    expect(at(0, stageMotion.word.riseTitle).y).toBe(20);
    expect(at(0, stageMotion.word.risePhrase).y).toBe(36);
  });

  it('SplitExplainer: título na fala, cartões depois da última palavra', () => {
    expect(titleTimes(3)).toEqual(wordTimes(undefined, 3, TITLE_START));
    expect(titleTimes(3, [0.5, 1.4, 2.6])).toEqual([0.5, 1.4, 2.6]);
    const auto = cardTimes(2, 5, [], 2.6);
    expect(auto[0]).toBeCloseTo(2.6 + stageMotion.word.sec + 0.4);
    expect(cardTimes(2, 5, [4, 5.5], 2.6)).toEqual([4, 5.5]);
    expect((splitExplainer.sample.wordAt as number[]).length).toBe(5);
  });
});

describe('anatomia e legibilidade', () => {
  it('pílula: texto com pelo menos ~3,6% da altura do quadro e contraste ≥ 4,5 em todos os tons', () => {
    expect(PILL_MIN_FONT / 1080).toBeGreaterThanOrEqual(0.035);
    for (const tone of PILL_TONES) {
      const colors = pillColors(tone);
      expect(contrastRatio(colors.background, colors.color)).toBeGreaterThanOrEqual(4.5);
    }
    // o branco sobre coral da referência não passaria: por isso o texto da coral é tinta
    expect(contrastRatio('#e27e54', '#ffffff')).toBeLessThan(4.5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
  });

  it('pillMetrics mantém as proporções medidas (texto 32 → altura 72, respiro 28, raio 8)', () => {
    expect(pillMetrics(32)).toEqual({ padX: 28, padY: 18, radius: 8, height: 73 });
    const big = pillMetrics(40);
    expect(big.radius).toBe(10);
    expect(big.height / 40).toBeCloseTo(72 / 32, 0);
    expect(pillMetrics(38, true).padX).toBeLessThan(pillMetrics(38).padX);
  });

  it('pilha: passo regular, vão maior e inclinação maior só na conclusão; árvore reta', () => {
    const pills = stackItems([{ text: 'contexto' }, { text: 'contraste', tone: 'emerald' }, { text: 'conclusão' }]);
    expect(pills.map((_, index) => pillRole(pills, index))).toEqual(['stack', 'stack', 'conclusion']);
    expect(pills.map((_, index) => stackGap(pills, index))).toEqual([0, STACK_GAP.regular, STACK_GAP.conclusion]);
    expect(STACK_GAP.conclusion).toBeGreaterThan(STACK_GAP.regular * 2);
    const tree = stackItems([{ text: 'a' }, { text: 'b', indent: 1 }, { text: 'c', indent: 2 }]);
    expect(tree.map((_, index) => pillRole(tree, index))).toEqual(['tree', 'tree', 'tree']);
    // uma pílula só, ou a última sem ser coral, não é conclusão
    expect(pillRole(stackItems([{ text: 'uma' }]), 0)).toBe('stack');
    const plain = stackItems([{ text: 'a' }, { text: 'b', tone: 'ink' }]);
    expect(pillRole(plain, 1)).toBe('stack');
  });

  it('recorte de documentação: inclinação e fita medidas', () => {
    expect(CARD_TILT).toBeCloseTo(-0.86);
    expect(TAPE).toEqual({ width: 129, height: 38, angle: 37, alpha: 0.8 });
  });
});

describe('foco na tela gravada (ScreenFocus)', () => {
  it('caixas e cliques inválidos são descartados; o escurecimento tem padrão e teto', () => {
    expect(validBoxes(undefined)).toEqual([]);
    expect(validBoxes([{ at: 1, x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, { at: -1, x: 0, y: 0, w: 1, h: 1 }, { at: 1, x: 0, y: 0, w: 0, h: 1 }, null])).toHaveLength(1);
    expect(validClicks([{ at: 1, x: 0.5, y: 0.5 }, { at: 'x' }, { x: 1, y: 1 }])).toHaveLength(1);
    expect(boxDim({})).toBe(stageMotion.focus.dim);
    expect(boxDim({ dim: false })).toBe(0);
    expect(boxDim({ dim: 2 })).toBe(0.85);
    expect(boxDim({ dim: 0.3 })).toBe(0.3);
  });

  it('a caixa entra e sai em 8 f e o contorno é desenhado em 10 f', () => {
    const box = { at: 1, duration: 2 };
    expect(focusState(box, 0.9, 10)).toEqual({ visible: 0, draw: 0 });
    expect(focusState(box, 1 + stageMotion.focus.fadeSec, 10).visible).toBe(1);
    expect(focusState(box, 1 + stageMotion.focus.outlineSec / 2, 10).draw).toBeCloseTo(0.5);
    expect(focusState(box, 2, 10)).toEqual({ visible: 1, draw: 1 });
    expect(focusState(box, 3, 10).visible).toBe(0);
    // sem duração, fica até o fim do overlay e sai com ele
    expect(focusState({ at: 1 }, 9, 10).visible).toBe(1);
    expect(focusState({ at: 1 }, 10, 10).visible).toBe(0);
  });

  it('o anel de clique nasce no ponto, expande desacelerando e some', () => {
    expect(ringState({ at: 2 }, 1.9)).toBeNull();
    expect(ringState({ at: 2 }, 2)).toEqual({ radius: RING.from, opacity: 1 });
    const middle = ringState({ at: 2 }, 2 + stageMotion.focus.ringSec / 2)!;
    expect(middle.radius).toBeGreaterThan((RING.from + RING.to) / 2);
    expect(middle.opacity).toBeGreaterThan(0.5);
    expect(ringState({ at: 2 }, 2 + stageMotion.focus.ringSec)).toBeNull();
  });

  it('o destaque acompanha o zoom da janela', () => {
    const box = { x: 0.6, y: 0.2, w: 0.2, h: 0.1 };
    expect(mapBox(box, { scale: 1, tx: 0, ty: 0 }, 1000, 500)).toEqual({ x: 600, y: 100, w: 200, h: 50 });
    const state = pushAt(normalizePushes({ at: 0, scale: 2, x: 0.6, y: 0.2 }, 9), 8);
    const mapped = mapBox(box, state, 1000, 500);
    // o canto da caixa é o próprio ponto-âncora: fica onde estava, e a caixa dobra de tamanho
    expect(mapped.x).toBeCloseTo(600);
    expect(mapped.y).toBeCloseTo(100);
    expect(mapped.w).toBeCloseTo(400);
    expect(mapped.h).toBeCloseTo(100);
  });
});

describe('indicador de progresso persistente (StageProgress)', () => {
  it('passos em ordem, total limitado e passo atual pelo tempo', () => {
    const steps = progressSteps([{ at: 14, name: 'b' }, { at: 0, name: 'a' }, { at: -1 }, { name: 'sem tempo' }, null]);
    expect(steps.map((step) => step.name)).toEqual(['a', 'b']);
    expect(progressSteps('nada')).toEqual([]);
    expect(stepCount(6, steps)).toBe(6);
    expect(stepCount(undefined, steps)).toBe(2);
    expect(stepCount(40, steps)).toBe(8);
    expect(activeStep(steps, -0.1)).toBe(-1);
    expect(activeStep(steps, 5)).toBe(0);
    expect(activeStep(steps, 14)).toBe(1);
  });

  it('a troca de passo é animada em 6 f: o atual acende enquanto o anterior apaga', () => {
    const steps = progressSteps([{ at: 0 }, { at: 4 }]);
    expect(stepGlow(steps, 0, 2)).toBe(1);
    expect(stepGlow(steps, 1, 2)).toBe(0);
    const mid = 4 + 3 * F;
    expect(stepGlow(steps, 0, mid)).toBeGreaterThan(0);
    expect(stepGlow(steps, 0, mid)).toBeLessThan(1);
    expect(stepGlow(steps, 0, mid) + stepGlow(steps, 1, mid)).toBeCloseTo(1);
    expect(stepGlow(steps, 0, 5)).toBe(0);
    expect(stepGlow(steps, 1, 5)).toBe(1);
    expect(stepGlow(steps, 7, 5)).toBe(0);
    // maior que o da referência (33 px): pelo menos 4% da altura do quadro
    expect(CHIP / 1080).toBeGreaterThanOrEqual(0.04);
  });

  it('a EDL marca a camada fixa e o lint não a trata como gráfico sobreposto', () => {
    expect(edlWith({ overlays: [{ id: 'a', component: 'Callout', at: 5, duration: 2 }] }).overlays[0]!.layer).toBe('base');
    expect(() => edlWith({ overlays: [{ id: 'a', component: 'Callout', at: 5, duration: 2, layer: 'topo' }] })).toThrow();
    expect(() => edlWith({ overlays: [{ id: 'a', component: 'WindowStage', at: 5, duration: 6, presenter: { slot: 'window', transitionSec: 9 } }] })).toThrow();
    expect(edlWith({ overlays: [{ id: 'a', component: 'WindowStage', at: 5, duration: 6, presenter: { slot: 'window-right', transitionSec: 0.5 } }] }).overlays[0]!.presenter).toMatchObject({ slot: 'window-right', transitionSec: 0.5 });
    const overlays = (layer: string) => [
      { id: 'prog', component: 'StageProgress', at: 2, duration: 30, layer, reason: 'onde estamos na série', props: { steps: [{ at: 0 }, { at: 12 }] } },
      { id: 'a', component: 'WindowStage', at: 6, duration: 8, reason: 'demo', presenter: { slot: 'pip-br' }, hidesCaptions: true },
      { id: 'b', component: 'PillStack', at: 20, duration: 6, reason: 'resumo' },
    ];
    const overlapping = (layer: string) => {
      const edl = edlWith({ overlays: overlays(layer) });
      return lintStyle(edl, buildTimeline(edl.clips, 30)).filter((finding) => finding.check === 'graficos-sobrepostos');
    };
    expect(overlapping('base').length).toBeGreaterThan(0);
    expect(overlapping('persistent')).toEqual([]);
    // dois gráficos comuns sobrepostos continuam avisando, mesmo com a camada fixa no meio
    const edl = edlWith({ overlays: [...overlays('persistent'), { id: 'c', component: 'Callout', at: 10, duration: 3, reason: 'aponta' }] });
    const findings = lintStyle(edl, buildTimeline(edl.clips, 30)).filter((finding) => finding.check === 'graficos-sobrepostos');
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('"c"');
  });

  it('os componentes novos estão no arsenal, com sample e descrição', () => {
    const listed = catalog('components').map((item) => item.id);
    for (const [name, entry] of Object.entries({ ScreenFocus: screenFocus, StageProgress: stageProgress })) {
      expect(registry[name]).toBe(entry);
      expect(listed).toContain(name);
      expect(entry.description.length).toBeGreaterThan(40);
      expect(entry.defaultDuration).toBeGreaterThan(0);
    }
    // o sample da janela exercita zoom, destaque e clique
    expect(Array.isArray(windowStage.sample.push)).toBe(true);
    expect(validBoxes(windowStage.sample.focus)).toHaveLength(1);
    expect(validClicks(windowStage.sample.clicks)).toHaveLength(1);
  });
});
