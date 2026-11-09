import { describe, expect, it } from 'vitest';

import { stageMotion } from '../motion/src/arsenal/stage.ts';
import { minReadSec } from '../motion/src/components/read-time.ts';
import { phraseTimes } from '../motion/src/components/PhraseReveal.tsx';
import { cardTimes, noteEntry, titleTimes } from '../motion/src/components/SplitExplainer.tsx';
import { ENTRY_GAP, entryDeadline, entryTimes, fitEntryTimes, fitMarkStart, fitStep, MIN_STEP } from '../motion/src/components/timing.ts';

const EXIT = stageMotion.exit.sec;

describe('timing: prazo de entrada', () => {
  it('o prazo deixa a saída e a leitura mínima; nunca negativo', () => {
    expect(entryDeadline(10, 2)).toBeCloseTo(10 - EXIT - 2);
    expect(entryDeadline(1, 5)).toBe(0);
    expect(entryDeadline(10, -3)).toBeCloseTo(10 - EXIT);
  });
});

describe('fitEntryTimes', () => {
  it('o que já cabe não muda', () => {
    expect(fitEntryTimes([0.5, 1.5, 3], 10)).toEqual([0.5, 1.5, 3]);
  });

  it('o último que entra tarde é puxado para dar leitura; o anterior recua com o vão mínimo', () => {
    const out = fitEntryTimes([1, 7.8, 8.4], 9, 1.5);
    expect(out[2]).toBeCloseTo(9 - EXIT - 1.5);
    expect(out[1]).toBeCloseTo(out[2]! - ENTRY_GAP);
    expect(out[0]).toBe(1);
  });

  it('quem foi falado cedo continua no instante dito, mesmo com o último puxado', () => {
    const out = fitEntryTimes([0.5, 1, 9], 6, 1);
    expect(out[0]).toBe(0.5);
    expect(out[1]).toBe(1);
    expect(out[2]).toBeCloseTo(6 - EXIT - 1);
  });

  it('overlay curto demais: tudo colapsa no começo, em ordem, sem negativo nem NaN', () => {
    const out = fitEntryTimes([2, 3, 4], 1, 2);
    expect(out).toEqual([0, 0, 0]);
    const nonDecreasing = fitEntryTimes([1, 2, 3, 4, 5], 2.5, 1.2);
    nonDecreasing.forEach((time, index) => {
      expect(time).toBeGreaterThanOrEqual(0);
      if (index) expect(time).toBeGreaterThanOrEqual(nonDecreasing[index - 1]!);
    });
  });

  it('duração inválida ou lista vazia: devolve a cópia', () => {
    expect(fitEntryTimes([1, 2], Number.NaN)).toEqual([1, 2]);
    expect(fitEntryTimes([1, 2], 0)).toEqual([1, 2]);
    expect(fitEntryTimes([], 5)).toEqual([]);
  });

  it('leitura por item: texto longo tem prazo mais cedo', () => {
    const out = fitEntryTimes([8, 8.5], 10, [minReadSec('um dois três quatro cinco seis seven oito nove dez'), 1]);
    expect(out[0]).toBeLessThanOrEqual(10 - EXIT - 3);
  });
});

describe('fitStep e entryTimes', () => {
  it('a cascata padrão comprime para caber, com piso', () => {
    expect(fitStep(1, 0.5, 1.6, 10)).toBe(1.6);
    expect(fitStep(5, 0.5, 1.6, 20)).toBe(1.6);
    expect(fitStep(5, 0.5, 1.6, 5)).toBeLessThan(1.6);
    expect(fitStep(5, 0.5, 1.6, 1)).toBe(MIN_STEP);
  });

  it('sem duração válida, é a conta antiga do cueTimes', () => {
    expect(entryTimes([undefined, 3, undefined], 0.5, 1.6, undefined)).toEqual([0.5, 3, 4.6]);
    expect(entryTimes([-1, Number.NaN], 0.5, 1, Number.NaN)).toEqual([0.5, 1.5]);
  });

  it('5 pílulas num overlay de 5 s: todas entram e a última tem tempo de leitura', () => {
    const texts = ['a b', 'c d', 'e f', 'g h', 'i j'];
    const times = entryTimes(texts.map(() => undefined), 0.2, 1.6, 5, texts.map(() => minReadSec('a b')));
    expect(times).toHaveLength(5);
    expect(times[4]).toBeLessThanOrEqual(entryDeadline(5, minReadSec('a b')) + 1e-9);
    times.forEach((time, index) => index && expect(time).toBeGreaterThanOrEqual(times[index - 1]!));
  });

  it('`at` depois do fim do overlay é puxado para dentro', () => {
    const [time] = entryTimes([99], 0.5, 1.6, 6);
    expect(time).toBeLessThan(6);
  });
});

describe('componentes: tempos com a duração', () => {
  it('SplitExplainer: sem duração é igual ao de antes; com duração curta, cartões e nota cabem', () => {
    expect(cardTimes(3, 4)).toEqual(cardTimes(3, 4, [], undefined, undefined));
    const times = cardTimes(4, 4, [], undefined, 6, ['a', 'b', 'c', 'd']);
    expect(Math.max(...times)).toBeLessThanOrEqual(entryDeadline(6) + 1e-9);
    expect(noteEntry(undefined, 'a nota final do bloco', 5, 6)).toBeLessThanOrEqual(entryDeadline(6, minReadSec('a nota final do bloco')) + 1e-9);
    expect(noteEntry(2, 'x', 5, 20)).toBe(2);
    expect(noteEntry(Number.NaN, 'x', 5, undefined)).toBeGreaterThan(5);
  });

  it('título: palavras ditas tarde demais são puxadas; sem duração, igual ao wordTimes', () => {
    const late = titleTimes(3, [0.5, 1, 20], 0.4, 6);
    expect(late[2]).toBeLessThanOrEqual(entryDeadline(6) + 1e-9);
    expect(titleTimes(3, [0.5, 1, 2], 0.4)).toEqual([0.5, 1, 2]);
  });

  it('PhraseReveal: a última palavra entra com 1 s de tela antes da saída', () => {
    expect(phraseTimes([0.5, 1, 30], 3, false, 4)[2]).toBeLessThanOrEqual(entryDeadline(4) + 1e-9);
    expect(phraseTimes(undefined, 4, true)).toHaveLength(4);
    expect(phraseTimes([], 0, false, 4)).toEqual([]);
  });

  it('DocQuote: o marca-texto termina antes da saída; overlay curto começa em 0,2 s', () => {
    expect(fitMarkStart(1.2, 10, 0.9)).toBe(1.2);
    expect(fitMarkStart(8, 5, 0.9)).toBeCloseTo(5 - EXIT - 0.9 - 0.5);
    expect(fitMarkStart(3, 1, 0.9)).toBe(0.2);
    expect(fitMarkStart(3, undefined, 0.9)).toBe(3);
  });
});
