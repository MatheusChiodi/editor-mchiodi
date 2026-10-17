import { describe, expect, it } from 'vitest';

import { idsInRange, normalizeRange, planDelete, planMove, planRemove, planResize, planRestore, planTrim } from '../cut/src/lib/gestures.ts';
import { createTimeMap } from '../cut/src/lib/timemap.ts';
import { applyOps } from '../src/cut/ops.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { baseEdl, edgesInsideWords, SPEECH } from './cut-fixture.ts';

const edl = baseEdl({
  overlays: [{ id: 'ov1', component: 'LowerThird', at: 0.2, duration: 2, reason: 'apresenta' }],
  broll: [{ id: 'br1', file: 'x.mp4', start: 2.0, end: 3.0, reason: 'mostra' }],
  transitions: [{ id: 't1', intoClip: 'c002', type: 'cross-dissolve', reason: 'troca' }],
});
const timeline = buildTimeline(edl.clips, 30);
const map = createTimeMap(timeline, 6, 'output', 100);

describe('planTrim', () => {
  it('borda solta dentro de palavra encaixa na pausa e avisa', () => {
    // 3.3 cai dentro de "reakt" (fala até 3.4): encaixa na pausa 3.42–4.63
    const plan = planTrim(edl.clips, 'c002', 'end', 3.3, SPEECH);
    expect(plan.ok).toBe(true);
    expect(plan.op).toMatchObject({ type: 'trimClip', clipId: 'c002', edge: 'end' });
    const time = (plan.op as { time: number }).time;
    expect(time).toBeGreaterThan(3.4);
    expect(plan.message).toMatch(/encaixado/);
    // o servidor aceita e a EDL resultante não tem borda em palavra
    const result = applyOps(edl, [plan.op!], SPEECH);
    expect(edgesInsideWords(result.edl)).toEqual([]);
  });

  it('recusa encostar no vizinho, com o motivo', () => {
    const plan = planTrim(edl.clips, 'c002', 'end', 4.6, SPEECH);
    expect(plan.ok).toBe(false);
    expect(plan.message).toMatch(/encostaria em c003/);
  });

  it('recusa longe de qualquer pausa medida', () => {
    const plan = planTrim(baseEdl().clips, 'c002', 'start', 2.6, { ...SPEECH, silences: [] });
    expect(plan.ok).toBe(false);
    expect(plan.message).toMatch(/não há pausa medida/);
  });

  it('borda que não muda não gera operação', () => {
    const plan = planTrim(edl.clips, 'c001', 'start', 0, SPEECH);
    expect(plan.ok).toBe(true);
    expect(plan.op).toBeNull();
  });
});

describe('trechos', () => {
  it('I/O em qualquer ordem', () => {
    expect(normalizeRange(3, 1)).toEqual({ start: 1, end: 3 });
    expect(normalizeRange(null, 1)).toBeNull();
    expect(normalizeRange(1, 1.01)).toBeNull();
  });

  it('remover encaixa as duas pontas e leva o motivo', () => {
    const plan = planRemove({ start: 1.1, end: 3.5 }, SPEECH, 'repetido');
    expect(plan.ok).toBe(true);
    expect(plan.op).toMatchObject({ type: 'removeRange', reason: 'repetido' });
    const result = applyOps(baseEdl(), [plan.op!], SPEECH);
    expect(edgesInsideWords(result.edl)).toEqual([]);
  });

  it('restaurar o trecho cortado entre dois clipes', () => {
    const plan = planRestore({ start: 1.2, end: 1.9 }, SPEECH);
    expect(plan.ok).toBe(true);
    const result = applyOps(edl, [plan.op!], SPEECH);
    expect(result.edl.clips.length).toBe(2);
  });

  it('recusa trecho com ponta longe de pausa', () => {
    const plan = planRemove({ start: 2.5, end: 3 }, { ...SPEECH, silences: [] });
    expect(plan.ok).toBe(false);
    expect(plan.message).toMatch(/^início/);
  });
});

describe('mover e redimensionar itens', () => {
  it('mover overlay pela vista de saída grava o instante da fonte', () => {
    // ov1 em 0.2 (saída 0.2); +1.1 s → saída 1.3 = fonte 2.0
    const plan = planMove(edl, timeline, map, 'overlays', 'ov1', 1.1);
    expect(plan.op).toEqual({ type: 'moveItem', kind: 'overlays', id: 'ov1', at: 2 });
    expect(applyOps(edl, [plan.op!], SPEECH).edl.overlays[0]!.at).toBe(2);
  });

  it('na vista da fonte, soltar num trecho cortado é recusado', () => {
    const source = createTimeMap(timeline, 6, 'source', 100);
    const plan = planMove(edl, timeline, source, 'overlays', 'ov1', 1.3);
    expect(plan.ok).toBe(false);
    expect(plan.message).toMatch(/trecho cortado/);
  });

  it('b-roll move início e fim juntos', () => {
    const plan = planMove(edl, timeline, map, 'broll', 'br1', 0.5);
    expect(plan.op).toMatchObject({ type: 'moveItem', kind: 'broll', start: 2.5, end: 3.5 });
  });

  it('transição pula para o corte mais próximo', () => {
    const plan = planMove(edl, timeline, map, 'transitions', 't1', 1.6);
    expect(plan.op).toEqual({ type: 'moveItem', kind: 'transitions', id: 't1', intoClip: 'c003' });
  });

  it('puxar a borda muda a duração; a borda de início compensa', () => {
    expect(planResize(edl, timeline, map, 'overlays', 'ov1', 'end', 0.5).op).toMatchObject({ duration: 2.5 });
    const start = planResize(edl, timeline, map, 'overlays', 'ov1', 'start', 0.3).op;
    expect(start).toMatchObject({ at: 0.5, duration: 1.7 });
    expect(planResize(edl, timeline, map, 'overlays', 'ov1', 'end', -1.9).ok).toBe(false);
  });
});

describe('delete', () => {
  it('itens saem, clipe vira remoção do trecho dele, sem seleção usa o trecho marcado', () => {
    const plans = planDelete(edl, ['overlays:ov1', 'clip:c003'], null, SPEECH);
    expect(plans[0]!.op).toEqual({ type: 'removeItem', kind: 'overlays', id: 'ov1' });
    expect(plans[1]!.op).toMatchObject({ type: 'removeRange' });
    const ranged = planDelete(edl, [], { start: 1.1, end: 3.5 }, SPEECH);
    expect(ranged[0]!.op).toMatchObject({ type: 'removeRange' });
    expect(planDelete(edl, [], null, SPEECH)).toEqual([]);
  });

  it('itens que tocam o trecho', () => {
    const items = [
      { key: 'a', sourceStart: 0, sourceEnd: 1 },
      { key: 'b', sourceStart: 2, sourceEnd: 3 },
    ];
    expect(idsInRange(items, { start: 0.5, end: 2.1 })).toEqual(['a', 'b']);
    expect(idsInRange(items, { start: 1.2, end: 1.8 })).toEqual([]);
  });
});
