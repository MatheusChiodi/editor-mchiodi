import { describe, expect, it } from 'vitest';

import { chainStarts, loopProgress, springAt, wobble } from '../motion/src/anim.ts';

describe('chainStarts (chain do motion-canvas)', () => {
  it('cada item começa quando o anterior termina, com folga opcional', () => {
    expect(chainStarts([1, 0.5, 2])).toEqual([0, 1, 1.5]);
    expect(chainStarts([1, 0.5, 2], 0.25, 2)).toEqual([2, 3.25, 4]);
    expect(chainStarts([])).toEqual([]);
  });
});

describe('loopProgress', () => {
  it('repete 0→1 a cada período', () => {
    expect(loopProgress(0, 30, 1)).toBe(0);
    expect(loopProgress(15, 30, 1)).toBeCloseTo(0.5, 6);
    expect(loopProgress(30, 30, 1)).toBe(0);
    expect(loopProgress(45, 30, 1)).toBeCloseTo(0.5, 6);
  });
  it('pingpong vai e volta sem salto', () => {
    expect(loopProgress(15, 30, 1, true)).toBeCloseTo(1, 6);
    expect(loopProgress(30, 30, 1, true)).toBeCloseTo(0, 6);
    expect(loopProgress(7, 30, 1, true)).toBeCloseTo(loopProgress(23, 30, 1, true), 6);
  });
  it('período inválido não quebra', () => {
    expect(loopProgress(10, 30, 0)).toBe(0);
  });
});

describe('springAt', () => {
  it('fica em 0 antes do atraso e assenta em 1', () => {
    expect(springAt(0, 30, 0.5)).toBe(0);
    expect(springAt(300, 30, 0.5)).toBeCloseTo(1, 3);
  });
  it('mola com pouco amortecimento passa de 1 (overshoot)', () => {
    const peak = Math.max(...Array.from({ length: 60 }, (_, frame) => springAt(frame, 30, 0, { damping: 6, stiffness: 140 })));
    expect(peak).toBeGreaterThan(1);
  });
});

describe('wobble (ruído suave)', () => {
  it('é determinístico e limitado pela amplitude', () => {
    expect(wobble(10, 30, 'a', 5)).toBe(wobble(10, 30, 'a', 5));
    for (let frame = 0; frame < 120; frame++) expect(Math.abs(wobble(frame, 30, 'b', 5))).toBeLessThanOrEqual(5);
  });
  it('seeds diferentes dão movimentos diferentes; quadros vizinhos mudam pouco', () => {
    expect(wobble(10, 30, 'a', 5)).not.toBe(wobble(10, 30, 'z', 5));
    expect(Math.abs(wobble(11, 30, 'a', 5) - wobble(10, 30, 'a', 5))).toBeLessThan(1);
  });
});

describe('curvas suaves (theme.motion)', () => {
  it('saída é monotônica, termina em 1 e sem arrancada final', async () => {
    const { motion } = await import('../motion/src/theme');
    const xs = [0, 0.25, 0.5, 0.75, 0.9, 1].map((t) => motion.exit(t));
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]!);
    expect(xs[5]).toBeCloseTo(1, 5);
    expect(xs[5]! - xs[4]!).toBeLessThan(0.45);
  });
  it('pop tem overshoot sutil (<8%) e assenta em 1', async () => {
    const { motion } = await import('../motion/src/theme');
    let peak = 0;
    for (let t = 0; t <= 1; t += 0.01) peak = Math.max(peak, motion.pop(t));
    expect(peak).toBeGreaterThan(1.01);
    expect(peak).toBeLessThan(1.08);
    expect(motion.pop(1)).toBeCloseTo(1, 5);
  });
});
