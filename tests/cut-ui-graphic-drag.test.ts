import { describe, expect, it } from 'vitest';

import {
  clampBox,
  coversFace,
  dragOffset,
  duplicateOp,
  frameGuides,
  handlesAt,
  isDraggable,
  isZero,
  nudgeOffset,
  offsetOp,
  snapAxis,
} from '../cut/src/lib/graphic-drag.ts';
import { applyOps } from '../src/cut/ops.ts';
import type { Footprints } from '../src/edl/fit.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { baseEdl, SPEECH } from './cut-fixture.ts';

const footprints: Footprints = {
  Callout: { x: 0.577, y: 0.18, w: 0.207, h: 0.404 },
  Burst: null,
  WindowStage: { x: 0, y: 0, w: 1, h: 1 },
};
const edl = baseEdl({
  overlays: [
    { id: 'ov1', component: 'Callout', at: 0.2, duration: 1, reason: 'destaca', offset: { x: 0.1, y: 0 } },
    { id: 'ov2', component: 'Burst', at: 0.2, duration: 1, reason: 'estoura' },
    { id: 'ov3', component: 'Callout', at: 2.0, duration: 1, reason: 'fora do instante' },
    { id: 'ov4', component: 'Callout', at: 0.2, duration: 1, reason: 'palco', presenter: { slot: 'right' } },
    { id: 'ov5', component: 'LowerThird', at: 0.2, duration: 1, reason: 'sem medida' },
  ],
});
const timeline = buildTimeline(edl.clips, 30);
const threshold = { x: 0.01, y: 0.01 };

describe('snapAxis', () => {
  it('gruda a borda na guia mais próxima dentro do limite', () => {
    expect(snapAxis(0.31, 0.2, [1 / 3], 0.025)).toEqual({ delta: 1 / 3 - 0.31, line: 1 / 3 });
  });
  it('gruda o centro na guia do meio', () => {
    const { delta, line } = snapAxis(0.395, 0.2, [0.5], 0.01);
    expect(line).toBe(0.5);
    expect(0.395 + 0.1 + delta).toBeCloseTo(0.5, 6);
  });
  it('longe de qualquer guia não mexe', () => {
    expect(snapAxis(0.1, 0.1, [0.5], 0.01)).toEqual({ delta: 0, line: null });
  });
});

describe('frameGuides', () => {
  it('traz margens, terços, centro e as bordas do rosto', () => {
    const guides = frameGuides({ x: 0.5, y: 0.4 });
    expect(guides.x).toEqual(expect.arrayContaining([0.02, 0.333, 0.5, 0.667, 0.98, 0.4, 0.6]));
    expect(guides.y).toEqual(expect.arrayContaining([0.02, 0.5, 0.8, 0.27, 0.53]));
  });
  it('sem rosto, só as guias do quadro', () => {
    expect(frameGuides(null).x).toHaveLength(5);
  });
});

describe('coversFace', () => {
  it('avisa quando a caixa invade a caixa do rosto', () => {
    expect(coversFace({ x: 0.45, y: 0.3, w: 0.2, h: 0.2 }, { x: 0.5, y: 0.4 })).toBe(true);
    expect(coversFace({ x: 0.7, y: 0.3, w: 0.2, h: 0.2 }, { x: 0.5, y: 0.4 })).toBe(false);
  });
});

describe('dragOffset', () => {
  const base = { x: 0.577, y: 0.18, w: 0.207, h: 0.404 };
  const guides = frameGuides(null);

  it('soma o gesto ao offset inicial', () => {
    const result = dragOffset({ base, startOffset: { x: 0.05, y: 0 }, delta: { x: -0.1, y: 0.05 }, guides, threshold, snap: false });
    expect(result.offset).toEqual({ x: -0.05, y: 0.05 });
    expect(result.hit).toEqual({ x: null, y: null });
  });
  it('gruda no centro do quadro e informa a guia', () => {
    // centro do gráfico em 0.577+0.1035 = 0.6805; falta -0.1805 até 0.5
    const result = dragOffset({ base, startOffset: { x: 0, y: 0 }, delta: { x: -0.18, y: 0 }, guides, threshold, snap: true });
    expect(result.hit.x).toBe(0.5);
    expect(result.rect.x + result.rect.w / 2).toBeCloseTo(0.5, 3);
  });
  it('Alt (snap desligado) deixa a posição solta', () => {
    const result = dragOffset({ base, startOffset: { x: 0, y: 0 }, delta: { x: -0.18, y: 0 }, guides, threshold, snap: false });
    expect(result.offset.x).toBe(-0.18);
    expect(result.hit.x).toBeNull();
  });
  it('nunca sai do quadro', () => {
    const result = dragOffset({ base, startOffset: { x: 0, y: 0 }, delta: { x: 2, y: -2 }, guides, threshold, snap: false });
    expect(result.rect.x + result.rect.w).toBeCloseTo(1, 6);
    expect(result.rect.y).toBe(0);
    expect(result.offset.y).toBeCloseTo(-0.18, 6);
    expect(result.hit).toEqual({ x: null, y: null });
  });
});

describe('clampBox', () => {
  it('caixa do tamanho do quadro fica na origem', () => {
    expect(clampBox({ x: 0.3, y: -0.2, w: 1, h: 1 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('nudgeOffset', () => {
  it('passo fino e grosso (Shift), sem acumular erro de ponto flutuante', () => {
    let offset = nudgeOffset(undefined, 'right');
    offset = nudgeOffset(offset, 'right');
    offset = nudgeOffset(offset, 'down', true);
    expect(offset).toEqual({ x: 0.01, y: 0.05 });
  });
});

describe('offsetOp / duplicateOp', () => {
  it('offset zero apaga o campo (volta à posição original)', () => {
    expect(isZero({ x: 0.0001, y: 0 })).toBe(true);
    expect(offsetOp('ov1', { x: 0, y: 0 })).toMatchObject({ type: 'updateItem', unset: ['offset'], patch: {} });
    expect(offsetOp('ov1', null)).toMatchObject({ unset: ['offset'] });
  });

  it('grava o offset como nova versão da EDL pela op do servidor (e reseta)', () => {
    const moved = applyOps(edl, [offsetOp('ov3', { x: -0.2, y: 0.1234567 })], SPEECH);
    expect(moved.edl.overlays.find((item) => item.id === 'ov3')!.offset).toEqual({ x: -0.2, y: 0.123 });
    expect(moved.applied[0]!.detail.fields).toContain('offset');
    const reset = applyOps(moved.edl, [offsetOp('ov3', null)], SPEECH);
    expect(reset.edl.overlays.find((item) => item.id === 'ov3')!.offset).toBeUndefined();
  });

  it('recusa offset fora do quadro (schema)', () => {
    expect(() => applyOps(edl, [offsetOp('ov3', { x: 1.5, y: 0 })], SPEECH)).toThrow(/offset/);
  });

  it('duplica no mesmo instante, deslocado, com id novo e o reason', () => {
    const original = edl.overlays[0]!;
    const result = applyOps(edl, [duplicateOp(original)], SPEECH);
    const copy = result.edl.overlays.at(-1)!;
    expect(copy.id).not.toBe('ov1');
    expect(copy.at).toBe(original.at);
    expect(copy.reason).toBe('destaca');
    expect(copy.offset).toEqual({ x: 0.16, y: 0.06 });
    expect(result.edl.overlays).toHaveLength(edl.overlays.length + 1);
  });
});

describe('isDraggable / handlesAt', () => {
  it('só gráfico que pinta sobre o footage', () => {
    expect(isDraggable(edl.overlays[0]!, footprints)).toBe(true);
    expect(isDraggable(edl.overlays[1]!, footprints)).toBe(false);
    expect(isDraggable(edl.overlays[3]!, footprints)).toBe(false);
    expect(isDraggable({ component: 'scene:demo/Cena', presenter: null, layer: 'base', props: {} }, footprints)).toBe(false);
    expect(isDraggable({ component: 'WindowStage', presenter: null, layer: 'base', props: { kind: 'footage' } }, footprints)).toBe(false);
    expect(isDraggable({ component: 'X', presenter: null, layer: 'persistent', props: {} }, footprints)).toBe(false);
  });

  it('lista os visíveis no instante com a caixa = medida + shift + offset', () => {
    const handles = handlesAt(edl, timeline, 0.5, footprints, { ov1: { x: 0, y: -0.05 } });
    const ov1 = handles.find((handle) => handle.overlay.id === 'ov1')!;
    expect(ov1.base.y).toBeCloseTo(0.13, 6);
    expect(ov1.rect.x).toBeCloseTo(0.677, 6);
    // ov5 não tem medida: usa a caixa padrão; ov2/ov4 não arrastam; ov3 não está no ar
    expect(handles.map((handle) => handle.overlay.id).sort()).toEqual(['ov1', 'ov5']);
  });
});
