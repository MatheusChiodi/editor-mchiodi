import { describe, expect, it } from 'vitest';

import { clampPps, collapsedOutput, createTimeMap, fitPps, formatClock, formatTimecode, nextPlayable, rulerTicks, zoomScroll, ZOOM_MAX_PPS, ZOOM_MIN_PPS } from '../cut/src/lib/timemap.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { baseEdl } from './cut-fixture.ts';

const edl = baseEdl();
const timeline = buildTimeline(edl.clips, 30);

describe('createTimeMap (vista de saída)', () => {
  const map = createTimeMap(timeline, 6, 'output', 100);

  it('mede a vista pela duração editada', () => {
    expect(map.durationSec).toBeCloseTo(4.2, 3);
    expect(map.width).toBeCloseTo(420, 1);
  });

  it('converte fonte → x pulando o que foi cortado', () => {
    expect(map.toX(0.5)).toBeCloseTo(50, 3);
    // c002 começa em 1.9 na fonte = 1.2 na saída
    expect(map.toX(2)).toBeCloseTo(130, 1);
    expect(map.toX(1.5)).toBeNull();
  });

  it('instante cortado cai no corte onde sumiu', () => {
    expect(map.toXClamped(1.5)).toBeCloseTo(120, 1);
    expect(collapsedOutput(timeline, 5.9)).toBeCloseTo(4.2, 3);
  });

  it('x → fonte atravessa o corte', () => {
    const point = map.fromX(130);
    expect(point.view).toBeCloseTo(1.3, 3);
    expect(point.source).toBeCloseTo(2.0, 3);
    expect(map.fromX(-50).view).toBe(0);
    expect(map.fromX(9999).view).toBeCloseTo(4.2, 3);
  });
});

describe('createTimeMap (vista da fonte)', () => {
  const map = createTimeMap(timeline, 6, 'source', 50);

  it('desenha o arquivo inteiro, inclusive o cortado', () => {
    expect(map.durationSec).toBe(6);
    expect(map.toX(1.5)).toBe(75);
    expect(map.viewTime(1.5)).toBe(1.5);
    expect(map.fromX(100).source).toBe(2);
  });
});

describe('zoom e régua', () => {
  it('limita o zoom', () => {
    expect(clampPps(0.1)).toBe(ZOOM_MIN_PPS);
    expect(clampPps(1e6)).toBe(ZOOM_MAX_PPS);
    expect(fitPps(1024, 0)).toBe(40);
    expect(fitPps(1024, 100)).toBeCloseTo(10, 0);
  });

  it('zoom mantém o ponto sob o cursor', () => {
    // em 10 px/s, com scroll 100 e cursor em 200 px: t = 30 s; em 20 px/s o mesmo t fica sob o cursor
    const next = zoomScroll(10, 20, 200, 100);
    expect((next + 200) / 20).toBeCloseTo(30, 6);
    expect(zoomScroll(10, 1, 0, 0)).toBe(0);
  });

  it('marcas da régua respeitam o espaço mínimo do rótulo', () => {
    const ticks = rulerTicks(0, 60, 10);
    expect(ticks.step).toBe(10);
    expect(ticks.major.map((tick) => tick.t)).toEqual([0, 10, 20, 30, 40, 50, 60]);
    expect(ticks.major[1]!.label).toBe('0:10');
    expect(ticks.minor.length).toBeGreaterThan(0);
    const fine = rulerTicks(1, 2, 400);
    expect(fine.step).toBe(0.2);
    expect(fine.major[0]!.label).toMatch(/\.\d$/);
  });

  it('formata relógio e timecode', () => {
    expect(formatClock(62.45)).toBe('1:02');
    expect(formatClock(62.45, true)).toBe('1:02.4');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatTimecode(61.5, 30)).toBe('01:01:15');
  });
});

describe('nextPlayable', () => {
  it('pula o trecho cortado e para no fim', () => {
    expect(nextPlayable(timeline, 0.5)).toBe(0.5);
    expect(nextPlayable(timeline, 1.5)).toBeCloseTo(1.9, 3);
    expect(nextPlayable(timeline, 5.9)).toBeNull();
  });
});
