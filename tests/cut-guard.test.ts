import { describe, expect, it } from 'vitest';

import { buildGuardPayload } from '../src/cut/guard.ts';
import { moveBox, planFit, type Footprints } from '../src/edl/fit.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import type { FocusSample } from '../src/render/focus.ts';
import { buildOverlayProps, shiftField } from '../src/render/overlay-props.ts';
import { buildPreviewModel, reuseIfSame } from '../cut/src/lib/preview-model.ts';
import { baseEdl } from './cut-fixture.ts';

describe('shiftField (offset manual SOMA com o shift automático)', () => {
  it('soma os dois', () => {
    expect(shiftField({ x: 0.1, y: 0 }, { x: 0.05, y: -0.02 })).toEqual({ shift: { x: 0.15, y: -0.02 } });
  });
  it('só automático ou só manual passam como estão', () => {
    expect(shiftField({ x: 0, y: -0.1 }, undefined)).toEqual({ shift: { x: 0, y: -0.1 } });
    expect(shiftField(undefined, { x: 0.2, y: 0.1 })).toEqual({ shift: { x: 0.2, y: 0.1 } });
  });
  it('soma zero ou nada não gera campo', () => {
    expect(shiftField(undefined, undefined)).toEqual({});
    expect(shiftField({ x: 0.1, y: 0 }, { x: -0.1, y: 0 })).toEqual({});
  });
  it('sem erro de ponto flutuante', () => {
    expect(shiftField({ x: 0.1, y: 0 }, { x: 0.2, y: 0 }).shift!.x).toBe(0.3);
  });
});

const footprints: Footprints = { Callout: { x: 0.35, y: 0.1, w: 0.3, h: 0.6 } };
const face = { x: 0.5, y: 0.4 };

describe('buildOverlayProps propaga o offset até o OverlayItem', () => {
  const edl = baseEdl({
    overlays: [
      { id: 'a', component: 'Callout', at: 0.2, duration: 1, reason: 'x', offset: { x: 0.1, y: -0.05 } },
      { id: 'b', component: 'Callout', at: 0.2, duration: 1, reason: 'x' },
      { id: 'c', component: 'Callout', at: 0.2, duration: 1, reason: 'x', offset: { x: 0.2, y: 0 } },
    ],
  });
  const timeline = buildTimeline(edl.clips, 30);
  const shifts = new Map([['a', { x: 0, y: -0.1 }], ['b', { x: 0.1, y: 0 }]]);
  const items = (vertical?: Parameters<typeof buildOverlayProps>[3]) => buildOverlayProps(edl, timeline, { words: [] }, vertical, undefined, shifts).overlays;

  it('offset soma com o shift do rosto; sem shift vale sozinho; só shift fica como está', () => {
    const [a, b, c] = items();
    expect(a!.shift).toEqual({ x: 0.1, y: -0.15 });
    expect(b!.shift).toEqual({ x: 0.1, y: 0 });
    expect(c!.shift).toEqual({ x: 0.2, y: 0 });
  });
  it('no Short o offset não vale (a caixa vertical decide)', () => {
    const [a, b, c] = items({ width: 1080, height: 1920, captionTop: 0.7, captionBottom: 0.85, faceTop: 0.3, faceBottom: 0.6 } as never);
    expect(a!.shift).toEqual({ x: 0, y: -0.1 });
    expect(b!.shift).toEqual({ x: 0.1, y: 0 });
    expect(c!.shift).toBeUndefined();
  });
});

describe('planFit com offset', () => {
  const overlay = (offset?: { x: number; y: number }) => ({
    id: 'ov1',
    component: 'Callout',
    at: 0,
    duration: 1,
    props: {},
    reason: 'x',
    hidesCaptions: false,
    presenter: null,
    wipe: 'none' as const,
    layer: 'base' as const,
    ...(offset ? { offset } : {}),
  });
  it('gráfico sobre o rosto precisa de ajuste; arrastado para longe, fica livre', () => {
    expect(planFit({ overlays: [overlay()], zooms: [] }, footprints, { face })[0]!.status).not.toBe('livre');
    expect(planFit({ overlays: [overlay({ x: 0.45, y: 0 })], zooms: [] }, footprints, { face })[0]!.status).toBe('livre');
  });
  it('moveBox desloca a caixa sem mexer no tamanho', () => {
    const moved = moveBox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, { x: 0.05, y: -0.1 });
    expect(moved.x).toBeCloseTo(0.15, 6);
    expect(moved.y).toBeCloseTo(0.1, 6);
    expect(moved.w).toBe(0.3);
    expect(moveBox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  });
});

describe('buildGuardPayload', () => {
  const edl = baseEdl({
    overlays: [
      { id: 'ov1', component: 'Callout', at: 0.2, duration: 1, reason: 'sobre o rosto' },
      { id: 'st1', component: 'SplitExplainer', at: 2, duration: 1, reason: 'palco', presenter: { slot: 'right', focus: 'auto' } },
    ],
  });
  const timeline = buildTimeline(edl.clips, 30);
  const samples: FocusSample[] = Array.from({ length: 12 }, (_, i) => ({ t: i * 0.5, x: 0.7, y: 0.4, face: { x: 0.7, y: 0.4 }, confidence: 0.9 }));

  it('sem detector: origem padrão, rosto padrão e foco do palco no padrão', () => {
    const payload = buildGuardPayload(edl, timeline, { ...footprints, SplitExplainer: null }, null, 'detector');
    expect(payload.origin).toBe('padrão');
    expect(payload.faces.ov1).toEqual({ x: 0.5, y: 0.4 });
    expect(payload.stageFocus.st1).toBeDefined();
    expect(payload.items.map((item) => item.overlay)).toEqual(['ov1', 'st1']);
  });

  it('com detector: usa o rosto medido no trecho e devolve zoom/shift serializáveis', () => {
    const payload = buildGuardPayload(edl, timeline, footprints, samples, 'detector');
    expect(payload.origin).toBe('detector');
    expect(payload.faces.ov1!.x).toBeCloseTo(0.7, 3);
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    expect(payload.zooms.every((zoom) => zoom.id.startsWith('fit-'))).toBe(true);
  });
});

describe('reuseIfSame (soltar o gráfico não re-renderiza o Remotion à toa)', () => {
  const edl = baseEdl({ overlays: [{ id: 'a', component: 'Callout', at: 0.2, duration: 1, reason: 'x' }] });
  const timeline = buildTimeline(edl.clips, 30);
  const build = (drag?: { id: string | null; offset: { x: number; y: number } }) => buildPreviewModel({ edl, timeline, words: [], only: null, guard: null, drag });

  it('props iguais devolvem o objeto anterior; props diferentes, o novo', () => {
    const first = build();
    expect(reuseIfSame(first, build({ id: null, offset: { x: 0, y: 0 } }))).toBe(first);
    const moved = build({ id: 'a', offset: { x: 0.1, y: 0 } });
    expect(reuseIfSame(first, moved)).toBe(moved);
    expect(moved.props!.overlays[0]!.shift).toEqual({ x: 0.1, y: 0 });
    expect(reuseIfSame(null, first)).toBe(first);
  });
});
