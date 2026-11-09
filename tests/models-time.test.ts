import { describe, expect, it } from 'vitest';

import { fitSceneTimes, SCENE_TAIL_SEC } from '../motion/src/scenes/modelos/fit-time.ts';
import { sequence } from '../motion/src/scenes/modelos/kit-a.ts';
import { fillTimes, pickSec } from '../motion/src/scenes/modelos/fit-b.ts';
import { fileiraTimes } from '../motion/src/scenes/modelos/FileiraDeItens.tsx';
import { pilhaTimes } from '../motion/src/scenes/modelos/PilhaEmDoisGrupos.tsx';
import { unlockTimes } from '../motion/src/scenes/modelos/CrachaComDesbloqueios.tsx';

const flat = (value: unknown): number[] => (typeof value === 'number' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(flat) : []);

describe('fitSceneTimes', () => {
  it('o que cabe não muda; sem duração válida devolve o mesmo valor', () => {
    const times = { a: 1, list: [2, 3] };
    expect(fitSceneTimes(times, 20)).toEqual(times);
    expect(fitSceneTimes(times, undefined)).toBe(times);
    expect(fitSceneTimes(times, Number.NaN)).toBe(times);
  });

  it('não muta a entrada e mantém a estrutura (objeto, array, aninhado)', () => {
    const times = { first: 1, groups: [[2, 30], [40]], tag: 'x' };
    const out = fitSceneTimes(times, 8);
    expect(times.groups[0]![1]).toBe(30);
    expect(out.tag).toBe('x');
    expect(out.groups.map((group) => group.length)).toEqual([2, 1]);
  });

  it('o último tempo deixa a cauda de leitura e a ordem é mantida', () => {
    const out = fitSceneTimes({ a: 1, b: [5, 9, 40], c: 60 }, 10);
    const values = [out.a, ...out.b, out.c];
    expect(Math.max(...values)).toBeLessThanOrEqual(10 - SCENE_TAIL_SEC + 1e-6);
    values.forEach((value, index) => index && expect(value).toBeGreaterThanOrEqual(values[index - 1]!));
    expect(out.a).toBe(1);
  });

  it('cena curta demais: nada negativo nem NaN', () => {
    flat(fitSceneTimes({ a: 3, b: [4, 5, 6] }, 0.5)).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    });
  });

  it('funciona com as funções de tempo dos modelos', () => {
    const fileira = fitSceneTimes(fileiraTimes(5, [1, 2, 3, 4, 50]), 9);
    expect(fileira.at(-1)).toBeLessThanOrEqual(9 - SCENE_TAIL_SEC + 1e-6);
    const pilha = fitSceneTimes(pilhaTimes([3, 3], [[1, 2, 3], [4, 5, 99]]), 12);
    expect(Math.max(...pilha.flat())).toBeLessThanOrEqual(12 - SCENE_TAIL_SEC + 1e-6);
    const cracha = fitSceneTimes(unlockTimes(4, { items: [1, 2, 3, 70] }), 10);
    expect(Math.max(...cracha.items)).toBeLessThanOrEqual(10 - SCENE_TAIL_SEC + 1e-6);
  });
});

describe('tempos negativos viram o padrão', () => {
  it('sequence, fillTimes e pickSec ignoram valor < 0', () => {
    expect(sequence(2, [-1, 3], 0.5, 1)).toEqual([0.5, 3]);
    expect(fillTimes(2, [-2, undefined], 1, 0.7)).toEqual([1, 1.7]);
    expect(pickSec(-1, 2)).toBe(2);
  });
});
