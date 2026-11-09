import { describe, expect, it } from 'vitest';

import { coverage, diffRatio, FrameDiffer, stillSpans } from '../src/analyze/motion.ts';

describe('diffRatio', () => {
  it('conta só pixels que mudaram além da tolerância', () => {
    const a = Uint8Array.from([10, 10, 10, 10]);
    const b = Uint8Array.from([10, 12, 40, 10]);
    expect(diffRatio(a, b, 4)).toBe(0.25);
    expect(diffRatio(a, b, 0)).toBe(0.5);
    expect(diffRatio(a, a, 0)).toBe(0);
  });
});

describe('FrameDiffer', () => {
  it('não emite nada para o primeiro frame', () => {
    const differ = new FrameDiffer(4, 0);
    expect(differ.push(Uint8Array.from([1, 1, 1, 1]))).toEqual([]);
  });

  it('remonta frames que chegam quebrados em pedaços arbitrários', () => {
    const differ = new FrameDiffer(4, 0);
    const bytes = [1, 1, 1, 1, 1, 1, 9, 9, 5, 5, 5, 5];
    const out: number[] = [];
    for (const chunk of [bytes.slice(0, 3), bytes.slice(3, 9), bytes.slice(9)]) {
      out.push(...differ.push(Uint8Array.from(chunk)));
    }
    expect(out).toEqual([0.5, 1]);
  });
});

describe('stillSpans', () => {
  const opts = { threshold: 0.01, minStillSec: 0.5 };

  it('devolve trechos parados com duração mínima', () => {
    // 10 fps: 0–0.6s parado, movimento, 1.0–1.3s parado (curto demais)
    const values = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0, 0, 0];
    expect(stillSpans(values, 10, opts)).toEqual([{ start: 0, end: 0.6 }]);
  });

  it('fecha o trecho que vai até o fim do vídeo', () => {
    const values = [0.5, 0.5, 0, 0, 0, 0, 0, 0];
    expect(stillSpans(values, 10, opts)).toEqual([{ start: 0.2, end: 0.8 }]);
  });

  it('sem trecho longo o bastante, devolve vazio', () => {
    expect(stillSpans([0, 0, 0.9, 0, 0], 10, opts)).toEqual([]);
  });
});

describe('spans', () => {
  it('coverage mede quanto de um intervalo está dentro dos outros', () => {
    expect(coverage({ start: 1, end: 3 }, [{ start: 0, end: 1.5 }, { start: 2.5, end: 9 }])).toBeCloseTo(0.5, 6);
    expect(coverage({ start: 1, end: 1 }, [{ start: 0, end: 9 }])).toBe(0);
  });

});
