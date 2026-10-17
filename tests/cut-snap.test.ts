import { describe, expect, it } from 'vitest';

import { freeSilences, snapEdge, validEdgeSpans } from '../src/cut/snap.ts';
import { SPEECH, WORDS } from './cut-fixture.ts';

describe('freeSilences', () => {
  it('tira do silêncio o pedaço que uma palavra invade', () => {
    const free = freeSilences({ words: [{ text: 'x', start: 1.0, end: 1.3 }], silences: [{ start: 0.8, end: 2 }] });
    expect(free).toEqual([
      { start: 0.8, end: 1.0 },
      { start: 1.3, end: 2 },
    ]);
  });
});

describe('validEdgeSpans', () => {
  it('encolhe cada silêncio pela folga e inclui começo e fim do arquivo', () => {
    const spans = validEdgeSpans(SPEECH, 0.04);
    expect(spans[0]).toEqual({ start: 0, end: 0 });
    expect(spans[1]!.start).toBeCloseTo(1.06, 6);
    expect(spans[1]!.end).toBeCloseTo(1.99, 6);
    expect(spans.at(-1)).toEqual({ start: 6, end: 6 });
  });
});

describe('snapEdge', () => {
  it('mantém o pedido que já está em silêncio medido', () => {
    const result = snapEdge(1.5, SPEECH);
    expect(result).toMatchObject({ ok: true, time: 1.5, insideWord: null, warning: null });
  });

  it('pedido dentro de palavra encaixa na pausa mais próxima e avisa', () => {
    const result = snapEdge(2.2, SPEECH);
    expect(result.ok).toBe(true);
    expect(result.time).toBeCloseTo(1.99, 3);
    expect(result.insideWord?.text).toBe('vamos');
    expect(result.warning).toContain('vamos');
    expect(WORDS.some((word) => result.time > word.start && result.time < word.end)).toBe(false);
  });

  it('respeita a folga: colado na palavra vai para dentro do silêncio', () => {
    expect(snapEdge(1.03, SPEECH).time).toBeCloseTo(1.06, 3);
    expect(snapEdge(1.03, SPEECH).insideWord).toBeNull();
  });

  it('recusa quando não há pausa medida perto', () => {
    const result = snapEdge(3, { words: WORDS, silences: [], durationSec: 6 });
    expect(result.ok).toBe(false);
    expect(result.warning).toContain('não há pausa medida');
  });

  it('limita o pedido à duração da fonte', () => {
    expect(snapEdge(9, SPEECH).time).toBe(6);
  });
});
