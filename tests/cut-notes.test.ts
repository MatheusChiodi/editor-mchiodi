import { describe, expect, it } from 'vitest';

import { buildNotes, describeOp } from '../src/cut/notes.ts';
import { applyOps, type CutOp } from '../src/cut/ops.ts';
import { baseEdl, SPEECH } from './cut-fixture.ts';

describe('buildNotes', () => {
  it('descreve as ações com os valores depois do snap, prefixadas por "Matheus:"', () => {
    const edl = baseEdl({ zooms: [{ id: 'z1', at: 0.5, duration: 1, reason: 'ênfase' }] });
    const ops: CutOp[] = [
      { type: 'trimClip', clipId: 'c002', edge: 'start', time: 2.2 },
      { type: 'captionReplace', from: 'reakt', to: 'React' },
      { type: 'moveItem', kind: 'zooms', id: 'z1', duration: 1.5 },
      { type: 'captionHighlight', word: 'vite', on: true },
      { type: 'setLevel', level: 'pro', confirm: true },
    ];
    const notes = buildNotes(applyOps(edl, ops, SPEECH).applied, 'ritmo do bloco 2');
    expect(notes).toBe(
      "Matheus: moveu início de c002 +0.09s; corrigiu legenda 'reakt'→'React'; redimensionou zoom z1 duração 1.50s; " +
        "destacou 'vite' na legenda; trocou o nível normal → pro — ritmo do bloco 2",
    );
  });

  it('frases de remoção, restauração e itens', () => {
    expect(describeOp({ op: { type: 'removeRange', start: 1, end: 2 }, detail: { start: 1.06, end: 1.99 } })).toBe('removeu 1.06s–1.99s (0.93s)');
    expect(describeOp({ op: { type: 'restoreRange', start: 1, end: 2 }, detail: { start: 1.2, end: 1.9 } })).toBe('restaurou 1.20s–1.90s');
    expect(describeOp({ op: { type: 'insertItem', kind: 'overlays', item: {} }, detail: { label: 'LowerThird lt', to: 2 } })).toBe('inseriu overlay LowerThird lt em 2.00s');
    expect(describeOp({ op: { type: 'removeItem', kind: 'effects', id: 'fx1' }, detail: { label: 'glitch fx1' } })).toBe('removeu efeito glitch fx1');
    expect(describeOp({ op: { type: 'trimClip', clipId: 'c012', edge: 'end', time: 1 }, detail: { from: 10.5, to: 10.3 } })).toBe('moveu fim de c012 −0.20s');
  });

  it('lote vazio ainda marca a versão como do Matheus', () => {
    expect(buildNotes([])).toBe('Matheus: sem mudanças');
  });
});
