import { describe, expect, it } from 'vitest';

import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import type { FocusSample } from '../src/render/focus.ts';
import { placeStages, stageExpressions } from '../src/render/reframe.ts';
import { applyStageTracks, buildFocusTrack, FOLLOW, planStageFocus, stageTrackMap, type TrackSample } from '../src/render/stage-focus.ts';
import { cleanFocusTrack, endFocus, type FocusKey, focusAtSec, IDENTITY, type StagePlan, trackedTransform, transformAt } from '../motion/src/arsenal/stage.ts';
import type { OverlayItem } from '../motion/src/types.ts';

const W = 1920;
const H = 1080;
const yBand = { center: 0.45, low: 0.4, high: 0.5, q1: 0.45, q3: 0.45 };
const VISIBLE = { x: 0.2687, y: 1 };

/** Série de rosto andando de `x0` a `x1` em `duration` s, 4 amostras/s. */
const walk = (x0: number, x1: number, duration: number, perSec = 4): TrackSample[] =>
  Array.from({ length: Math.round(duration * perSec) + 1 }, (_, index) => {
    const sec = index / perSec;
    return { sec, x: x0 + ((x1 - x0) * sec) / duration, y: 0.4 };
  });

describe('trilha de foco: stage.ts', () => {
  it('cleanFocusTrack descarta lixo, ordena e exige 2 chaves', () => {
    expect(cleanFocusTrack(undefined)).toEqual([]);
    expect(cleanFocusTrack([{ t: 1, x: 0.5, y: 0.5 }])).toEqual([]);
    const keys = cleanFocusTrack([
      { t: 2, x: 2, y: -1 },
      { t: Number.NaN, x: 0.5, y: 0.5 },
      { t: 0, x: 0.2, y: 0.4 },
      { t: 2, x: 0.9, y: 0.9 },
    ]);
    expect(keys).toEqual([
      { t: 0, x: 0.2, y: 0.4 },
      { t: 2, x: 1, y: 0 },
    ]);
  });

  it('focusAtSec interpola e fica parado fora das chaves; sem trilha vale o foco fixo', () => {
    const spec = { focus: { x: 0.5, y: 0.4 }, focusTrack: [{ t: 1, x: 0.2, y: 0.4 }, { t: 3, x: 0.6, y: 0.4 }] };
    expect(focusAtSec(spec, 0).x).toBeCloseTo(0.2);
    expect(focusAtSec(spec, 2).x).toBeCloseTo(0.4);
    expect(focusAtSec(spec, 9).x).toBeCloseTo(0.6);
    expect(focusAtSec({ focus: { x: 0.3, y: 0.3 } }, 5)).toEqual({ x: 0.3, y: 0.3 });
    expect(endFocus(spec).x).toBeCloseTo(0.6);
    expect(endFocus({ focus: { x: 0.3, y: 0.3 } }).x).toBe(0.3);
  });
});

describe('buildFocusTrack', () => {
  it('apresentador parado ou quase: sem trilha (foco fixo)', () => {
    expect(buildFocusTrack(walk(0.7, 0.7, 8), 8, VISIBLE, yBand)).toEqual([]);
    expect(buildFocusTrack(walk(0.7, 0.71, 8), 8, VISIBLE, yBand)).toEqual([]);
  });

  it('poucas amostras ou duração inválida: sem trilha', () => {
    expect(buildFocusTrack([{ sec: 1, x: 0.5, y: 0.4 }], 8, VISIBLE, yBand)).toEqual([]);
    expect(buildFocusTrack(walk(0.2, 0.8, 8), 0, VISIBLE, yBand)).toEqual([]);
    expect(buildFocusTrack(walk(0.2, 0.8, 8), Number.NaN, VISIBLE, yBand)).toEqual([]);
  });

  it('apresentador que anda: o foco acompanha, de ponta a ponta do palco, sem passar da velocidade máxima', () => {
    const track = buildFocusTrack(walk(0.3, 0.6, 10), 10, VISIBLE, yBand);
    expect(track.length).toBeGreaterThanOrEqual(2);
    expect(track[0]!.t).toBe(0);
    expect(track[track.length - 1]!.t).toBe(10);
    expect(track[track.length - 1]!.x).toBeGreaterThan(track[0]!.x + 0.1);
    for (let index = 1; index < track.length; index += 1) {
      const speed = Math.abs(track[index]!.x - track[index - 1]!.x) / (track[index]!.t - track[index - 1]!.t);
      expect(speed).toBeLessThanOrEqual(FOLLOW.maxSpeed + 1e-3);
    }
    // o foco nunca descobre a borda do cartão
    for (const key of track) {
      expect(key.x).toBeGreaterThanOrEqual(VISIBLE.x / 2 - 1e-6);
      expect(key.x).toBeLessThanOrEqual(1 - VISIBLE.x / 2 + 1e-6);
    }
  });

  it('amostra fora do detector (NaN) e fora do palco é ignorada, sem quebrar', () => {
    const dirty = [...walk(0.3, 0.6, 8), { sec: 3, x: Number.NaN, y: 0.4 }, { sec: -2, x: 0.99, y: 0.4 }, { sec: 99, x: 0.01, y: 0.4 }];
    const track = buildFocusTrack(dirty, 8, VISIBLE, yBand);
    expect(track.every((key) => Number.isFinite(key.x) && Number.isFinite(key.y))).toBe(true);
  });

  it('trecho sem amostra herda o vizinho (não salta para o centro)', () => {
    const samples = [...walk(0.3, 0.3, 3), ...walk(0.6, 0.6, 3).map((sample) => ({ ...sample, sec: sample.sec + 7 }))];
    const track = buildFocusTrack(samples, 10, VISIBLE, yBand);
    expect(track.length).toBeGreaterThan(2);
    track.forEach((key) => expect(key.x).toBeGreaterThanOrEqual(0.3 - 0.01));
  });

  it('janela larga (visible 1): foco em 0.5, sem trilha', () => {
    expect(buildFocusTrack(walk(0.2, 0.8, 8), 8, { x: 1, y: 1 }, yBand)).toEqual([]);
  });
});

describe('trilha no render: ffmpeg igual ao Remotion', () => {
  const plan = (focusTrack: FocusKey[], extra: Partial<StagePlan> = {}): StagePlan => ({ slot: 'right', focus: { x: 0.5, y: 0.4 }, backdrop: 'paper', from: null, holdExit: false, focusTrack, ...extra });
  const item = (id: string, from: number, frames: number, stage: StagePlan): OverlayItem => ({ id, component: 'SplitExplainer', from, durationInFrames: frames, props: {}, hidesCaptions: true, stage });

  function evalExpr(expression: string, t: number): number {
    const scope = { t, gte: (a: number, b: number) => (a >= b ? 1 : 0), lt: (a: number, b: number) => (a < b ? 1 : 0), pow: Math.pow, clip: (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)) };
    return new Function(...Object.keys(scope), `return ${expression};`)(...Object.values(scope)) as number;
  }

  it('a posição do footage com trilha bate frame a frame com transformAt', () => {
    const track: FocusKey[] = [{ t: 0, x: 0.3, y: 0.4 }, { t: 3, x: 0.5, y: 0.4 }, { t: 6, x: 0.7, y: 0.45 }];
    const items = [item('a', 30, 180, plan(track))];
    const placed = placeStages(items, 30);
    const expressions = stageExpressions(placed, W, H);
    for (let frame = 0; frame < 260; frame += 1) {
      const t = frame / 30;
      const active = placed.find((entry) => t >= entry.start && t < entry.end);
      const expected = active ? transformAt(active.plan, t - active.start, active.end - active.start, W, H) : IDENTITY;
      expect(evalExpr(expressions.x, t)).toBeCloseTo(expected.x, 1);
      expect(evalExpr(expressions.y, t)).toBeCloseTo(expected.y, 1);
      expect(evalExpr(expressions.scale, t)).toBeCloseTo(expected.scale, 3);
    }
  });

  it('o footage cobre o buraco em todo o caminho (nunca descobre borda)', () => {
    const track: FocusKey[] = [{ t: 0, x: 0.01, y: 0.4 }, { t: 5, x: 0.99, y: 0.4 }];
    for (let sec = 0; sec <= 5; sec += 0.25) {
      const transform = trackedTransform({ slot: 'right', focus: { x: 0.5, y: 0.4 }, focusTrack: track }, sec, W, H);
      const box = { x: (1 - 0.018 - 0.243) * W, w: 0.243 * W };
      expect(transform.x).toBeLessThanOrEqual(box.x + 1e-6);
      expect(transform.x + W * transform.scale).toBeGreaterThanOrEqual(box.x + box.w - 1e-6);
    }
  });

  it('trilha ignorada quando o palco tem push; sem trilha nada muda', () => {
    const track: FocusKey[] = [{ t: 0, x: 0.3, y: 0.4 }, { t: 4, x: 0.7, y: 0.4 }];
    const pushes = [{ at: 1, inSec: 1, scale: 1.5, x: 0.5, y: 0.5, outAt: null, outSec: 1 }];
    const withPush = placeStages([item('a', 0, 150, plan(track, { pushes: pushes }))], 30);
    const without = placeStages([item('a', 0, 150, plan([], { pushes: pushes }))], 30);
    expect(stageExpressions(withPush, W, H).x).toBe(stageExpressions(without, W, H).x);
  });

  it('palco colado: o cartão do seguinte parte do foco de SAÍDA do anterior', () => {
    const track: FocusKey[] = [{ t: 0, x: 0.3, y: 0.4 }, { t: 4, x: 0.7, y: 0.4 }];
    const a = item('a', 0, 120, plan(track, { holdExit: true }));
    const b = item('b', 120, 120, plan([], { from: { slot: 'right', focus: { x: 0.5, y: 0.4 } } }));
    applyStageTracks([b, a], new Map([['a', track]]));
    expect(a.stage!.focusTrack).toEqual(track);
    expect(b.stage!.from!.focus.x).toBeCloseTo(0.7);
  });
});

describe('planStageFocus com trilha', () => {
  const edl = (overlays: unknown[]) =>
    edlSchema.parse({
      version: 1,
      project: 't',
      createdAt: '2026-10-17T00:00:00.000Z',
      source: { path: 'C:/v.mp4', durationSec: 60, fps: 30, width: 2560, height: 1440 },
      output: { fps: 30, width: W, height: H },
      clips: [{ id: 'c1', start: 0, end: 60 }],
      overlays,
    });
  const stage = (focus: unknown) => ({ id: 's1', component: 'SplitExplainer', at: 10, duration: 8, presenter: { slot: 'right', focus } });
  const walking: FocusSample[] = Array.from({ length: 49 }, (_, index) => ({ t: 10 + index / 6, x: 0.35 + (0.25 * index) / 48, confidence: 0.9 }));

  it('auto + apresentador que anda: plano com trilha e rosto dentro do recorte', () => {
    const base = edl([stage('auto')]);
    const [plan] = planStageFocus(base, buildTimeline(base.clips, 30), walking);
    expect(plan!.track.length).toBeGreaterThanOrEqual(2);
    expect(plan!.cut.x).toBeLessThan(0.1);
    expect(stageTrackMap([plan!]).get('s1')).toBe(plan!.track);
  });

  it('foco fixo nunca ganha trilha', () => {
    const base = edl([stage({ x: 0.47, y: 0.4 })]);
    const [plan] = planStageFocus(base, buildTimeline(base.clips, 30), walking);
    expect(plan!.track).toEqual([]);
    expect(stageTrackMap([plan!]).size).toBe(0);
  });

  it('auto + apresentador parado: sem trilha', () => {
    const base = edl([stage('auto')]);
    const still: FocusSample[] = walking.map((sample) => ({ ...sample, x: 0.5 }));
    expect(planStageFocus(base, buildTimeline(base.clips, 30), still)[0]!.track).toEqual([]);
  });
});
