import { describe, expect, it } from 'vitest';

import { applyOps, CutOpError, type CutOp, mergeIntervals, reconcileRemovals, rebuildClips } from '../src/cut/ops.ts';
import { baseEdl, edgesInsideWords, SPEECH, WORDS } from './cut-fixture.ts';

const apply = (ops: unknown[], edl = baseEdl()) => applyOps(edl, ops as CutOp[], SPEECH);

describe('trimClip', () => {
  it('apara a borda com snap em silêncio e mantém removed coerente', () => {
    const result = apply([{ type: 'trimClip', clipId: 'c002', edge: 'start', time: 2.2 }]);
    const clip = result.edl.clips.find((item) => item.id === 'c002')!;
    expect(clip.start).toBeCloseTo(1.99, 3);
    expect(result.warnings[0]).toContain('vamos');
    expect(result.applied[0]!.detail).toMatchObject({ from: 1.9 });
    expect(edgesInsideWords(result.edl)).toEqual([]);
    // buraco 1.2–1.99: a pausa antiga + um pedaço manual novo
    const gap = result.edl.removed.filter((item) => item.start >= 1.2 && item.end <= 1.99 + 1e-6);
    expect(gap.map((item) => item.kind)).toEqual(['silence', 'manual']);
    expect(gap.at(-1)!.end).toBeCloseTo(1.99, 3);
  });

  it('recusa encostar em outro clipe', () => {
    expect(() => apply([{ type: 'trimClip', clipId: 'c001', edge: 'end', time: 2.5 }])).toThrow(/encostaria/);
  });

  it('erro aponta o índice da operação', () => {
    try {
      apply([{ type: 'captionHighlight', word: 'vite', on: true }, { type: 'trimClip', clipId: 'zzz', edge: 'start', time: 1 }]);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CutOpError);
      expect((error as CutOpError).opIndex).toBe(1);
    }
  });
});

describe('removeRange / restoreRange', () => {
  it('remover trecho parte o clipe nas pausas, nunca dentro de palavra', () => {
    const result = apply([{ type: 'removeRange', start: 3.43, end: 4.62 }, { type: 'removeRange', start: 1.5, end: 1.95 }]);
    expect(edgesInsideWords(result.edl)).toEqual([]);
    const manual = result.edl.removed.filter((item) => item.kind === 'manual');
    expect(manual.length).toBeGreaterThan(0);
  });

  it('remover no meio de um clipe cria um id novo para o pedaço da direita', () => {
    const edl = baseEdl({
      clips: [{ id: 'c001', start: 0, end: 5.8 }],
      removed: [{ start: 5.8, end: 6, kind: 'silence', reason: '' }],
    });
    const result = apply([{ type: 'removeRange', start: 2.2, end: 3.0 }], edl);
    expect(result.edl.clips.map((clip) => clip.id)).toEqual(['c001', 'c001-2']);
    expect(result.edl.clips[0]!.end).toBeCloseTo(1.99, 3);
    expect(result.edl.clips[1]!.start).toBeCloseTo(3.46, 3);
    expect(result.edl.clips[1]!.quote).toBe('e vite tambem');
    expect(edgesInsideWords(result.edl)).toEqual([]);
  });

  it('restaurar junta os clipes vizinhos e descarta a transição que entrava no corte sumido', () => {
    const edl = baseEdl({ transitions: [{ id: 'tr1', intoClip: 'c002', type: 'cross-dissolve', reason: 'troca de assunto' }] });
    const result = apply([{ type: 'restoreRange', start: 1.2, end: 1.9 }], edl);
    expect(result.edl.clips.map((clip) => [clip.id, clip.start, clip.end])).toEqual([
      ['c001', 0, 3.6],
      ['c003', 4.5, 5.8],
    ]);
    expect(result.edl.transitions).toEqual([]);
    expect(result.warnings.join(' ')).toContain('tr1');
    expect(result.edl.removed.some((item) => item.start < 1.9 && item.end > 1.2)).toBe(false);
  });

  it('remover trecho com overlay ancorado dentro é recusado pelo schema', () => {
    const edl = baseEdl({ overlays: [{ id: 'lt', component: 'LowerThird', at: 2.5, duration: 1, reason: 'nome' }] });
    expect(() => apply([{ type: 'removeRange', start: 1.5, end: 3.5 }], edl)).toThrow(/trecho cortado/);
  });
});

describe('itens', () => {
  it('inserir exige reason e gera id', () => {
    expect(() => apply([{ type: 'insertItem', kind: 'zooms', item: { at: 2.1, duration: 1 } }])).toThrow(/reason/);
    const result = apply([{ type: 'insertItem', kind: 'zooms', item: { at: 2.1, duration: 1, reason: 'ênfase no React' } }]);
    expect(result.edl.zooms[0]).toMatchObject({ id: 'z1', at: 2.1, scale: 1.12 });
  });

  it('mover, redimensionar, editar e remover', () => {
    const edl = baseEdl({ overlays: [{ id: 'lt', component: 'LowerThird', at: 0.5, duration: 1, reason: 'nome', props: { title: 'a' } }] });
    const result = apply(
      [
        { type: 'moveItem', kind: 'overlays', id: 'lt', at: 2.2 },
        { type: 'moveItem', kind: 'overlays', id: 'lt', duration: 2 },
        { type: 'updateItem', kind: 'overlays', id: 'lt', patch: { props: { title: 'Matheus' } } },
      ],
      edl,
    );
    expect(result.edl.overlays[0]).toMatchObject({ at: 2.2, duration: 2, props: { title: 'Matheus' } });
    expect(apply([{ type: 'removeItem', kind: 'overlays', id: 'lt' }], edl).edl.overlays).toEqual([]);
  });

  it('item legado sem reason só se move com reason', () => {
    const edl = baseEdl({ zooms: [{ id: 'z9', at: 0.5, duration: 1 }] });
    expect(() => apply([{ type: 'moveItem', kind: 'zooms', id: 'z9', at: 2.2 }], edl)).toThrow(/reason/);
    expect(apply([{ type: 'moveItem', kind: 'zooms', id: 'z9', at: 2.2, reason: 'ênfase' }], edl).edl.zooms[0]!.at).toBe(2.2);
  });

  it('não troca id por patch', () => {
    const edl = baseEdl({ zooms: [{ id: 'z9', at: 0.5, duration: 1, reason: 'x' }] });
    expect(() => apply([{ type: 'updateItem', kind: 'zooms', id: 'z9', patch: { id: 'z10' } }], edl)).toThrow(/id/);
  });
});

describe('legendas e nível', () => {
  it('correção vai para replacements (sem duplicar a mesma palavra) e destaque para highlights', () => {
    const result = apply([
      { type: 'captionReplace', from: 'reakt', to: 'Reakt' },
      { type: 'captionReplace', from: 'Reakt', to: 'React' },
      { type: 'captionHighlight', word: 'vite', on: true },
    ]);
    expect(result.edl.captions.replacements).toEqual({ Reakt: 'React' });
    expect(result.edl.captions.highlights).toEqual(['vite']);
    expect(result.applied[1]!.detail.previous).toBe('Reakt');
    const undone = apply([{ type: 'captionReplace', from: 'reakt', to: null }], result.edl);
    expect(undone.edl.captions.replacements).toEqual({});
  });

  it('nível só troca com confirm: true', () => {
    expect(() => apply([{ type: 'setLevel', level: 'pro' }])).toThrow(/formato inválido/);
    expect(apply([{ type: 'setLevel', level: 'pro', confirm: true }]).edl.level).toBe('pro');
  });
});

describe('funções de intervalo', () => {
  it('mergeIntervals junta sobreposição e mantém encostados separados', () => {
    expect(mergeIntervals([{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 1.5, end: 3 }])).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 3 },
    ]);
  });

  it('reconcileRemovals recorta remoções aos buracos e cobre o resto como manual', () => {
    const removed = reconcileRemovals([{ start: 0, end: 1 }, { start: 3, end: 6 }], [{ start: 1, end: 2, kind: 'retake', reason: 'r' }], 6);
    expect(removed).toEqual([
      { start: 1, end: 2, kind: 'retake', reason: 'r' },
      { start: 2, end: 3, kind: 'manual', reason: 'Matheus: cortado no editor' },
    ]);
  });

  it('rebuildClips preserva o quote de clipe intacto', () => {
    const clips = rebuildClips(baseEdl().clips, [{ start: 0, end: 1.2 }], WORDS);
    expect(clips[0]!.quote).toBe('ola pessoal hoje');
  });
});
