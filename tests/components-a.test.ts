import { describe, expect, it } from 'vitest';

import { barWidths, decimalsFor, formatBarValue } from '../motion/src/components/BarChart.tsx';
import { activeIndex, REVEAL_START, REVEAL_STEP, revealTimes } from '../motion/src/components/BulletList.tsx';
import { counterValue, countWindow, formatPtBr } from '../motion/src/components/Counter.tsx';
import { displayLink } from '../motion/src/components/LowerThird.tsx';
import { eyebrowLabel, layoutTitle, withAlpha, wrapLines } from '../motion/src/components/SectionTitle.tsx';
import { clickTimeline, pressScale, subscribedAt } from '../motion/src/components/SubscribeCTA.tsx';

describe('LowerThird', () => {
  it('mostra o link sem protocolo, www nem barra final', () => {
    expect(displayLink('https://www.react.dev/learn/')).toBe('react.dev/learn');
    expect(displayLink('  http://mchiodi.dev  ')).toBe('mchiodi.dev');
    expect(displayLink('github.com/mchiodi')).toBe('github.com/mchiodi');
  });
});

describe('SectionTitle', () => {
  it('quebra por palavras respeitando o limite de caracteres', () => {
    expect(wrapLines('Como o React decide o que renderizar', 20)).toEqual(['Como o React decide', 'o que renderizar']);
    expect(wrapLines('  Hooks  ', 20)).toEqual(['Hooks']);
    expect(wrapLines('', 20)).toEqual([]);
  });

  it('deixa sozinha na linha a palavra maior que o limite', () => {
    expect(wrapLines('a Internacionalização b', 10)).toEqual(['a', 'Internacionalização', 'b']);
  });

  it('reduz o corpo até o título caber em 3 linhas', () => {
    expect(layoutTitle('Hooks')).toEqual({ fontSize: 100, lines: ['Hooks'] });
    const long = layoutTitle('Uma frase propositalmente longa demais para caber em uma linha só dentro do cartão');
    expect(long.fontSize).toBeLessThan(100);
    expect(long.lines.length).toBeLessThanOrEqual(3);
    expect(long.lines.join(' ')).toBe('Uma frase propositalmente longa demais para caber em uma linha só dentro do cartão');
  });

  it('monta o eyebrow com o índice em dois dígitos', () => {
    expect(eyebrowLabel('Capítulo', 2)).toBe('02 · Capítulo');
    expect(eyebrowLabel(undefined, 12)).toBe('12');
    expect(eyebrowLabel('Extra')).toBe('Extra');
    expect(eyebrowLabel(' ', undefined)).toBeUndefined();
    expect(eyebrowLabel(undefined, 0)).toBe('00');
  });

  it('converte hex do tema em rgba', () => {
    expect(withAlpha('#111827', 0.5)).toBe('rgba(17, 24, 39, 0.5)');
  });
});

describe('BulletList', () => {
  it('escalona a cada 0.6s por padrão', () => {
    const times = revealTimes(3);
    expect(times[0]).toBe(REVEAL_START);
    expect(times[1]).toBeCloseTo(REVEAL_START + REVEAL_STEP);
    expect(times[2]).toBeCloseTo(REVEAL_START + 2 * REVEAL_STEP);
  });

  it('usa revealAt e completa os itens que faltam a partir do último', () => {
    expect(revealTimes(4, [1, 2.5])).toEqual([1, 2.5, 3.1, 3.7]);
    expect(revealTimes(0, [1])).toEqual([]);
  });

  it('ignora valores inválidos e nunca volta no tempo', () => {
    expect(revealTimes(3, [2, Number.NaN, 1])).toEqual([2, 2.6, 2.6]);
    expect(revealTimes(2, [-1, 0.2])).toEqual([REVEAL_START, REVEAL_START]);
  });

  it('destaca o último item revelado', () => {
    const times = [0.5, 1.8, 3.2];
    expect(activeIndex(times, 0)).toBe(-1);
    expect(activeIndex(times, 0.5)).toBe(0);
    expect(activeIndex(times, 3.19)).toBe(1);
    expect(activeIndex(times, 10)).toBe(2);
  });
});

describe('Counter', () => {
  it('formata em pt-BR', () => {
    expect(formatPtBr(0)).toBe('0');
    expect(formatPtBr(999)).toBe('999');
    expect(formatPtBr(1000)).toBe('1.000');
    expect(formatPtBr(2400000)).toBe('2.400.000');
    expect(formatPtBr(1234567.891, 2)).toBe('1.234.567,89');
    expect(formatPtBr(4.2, 1)).toBe('4,2');
    expect(formatPtBr(999.6)).toBe('1.000');
  });

  it('trata negativos sem gerar "-0"', () => {
    expect(formatPtBr(-1234.5, 1)).toBe('-1.234,5');
    expect(formatPtBr(-0.2)).toBe('0');
  });

  it('conta de from a to dentro da janela, travando nas pontas', () => {
    expect(counterValue(0, 30, 10, 110, 0.2, 1)).toBe(10);
    expect(counterValue(6, 30, 10, 110, 0.2, 1)).toBe(10);
    expect(counterValue(36, 30, 10, 110, 0.2, 1)).toBe(110);
    expect(counterValue(300, 30, 10, 110, 0.2, 1)).toBe(110);
  });

  it('desacelera: passa da metade antes de metade do tempo, sem ultrapassar o alvo', () => {
    const mid = counterValue(21, 30, 0, 100, 0.2, 1);
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThanOrEqual(100);
    let previous = -Infinity;
    for (let frame = 0; frame <= 40; frame++) {
      const value = counterValue(frame, 30, 0, 100, 0.2, 1);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('conta para baixo quando from > to', () => {
    expect(counterValue(0, 30, 100, 0, 0, 1)).toBe(100);
    expect(counterValue(30, 30, 100, 0, 0, 1)).toBe(0);
  });

  it('limita a duração da contagem', () => {
    expect(countWindow(1).durationSec).toBe(0.6);
    expect(countWindow(4).durationSec).toBeCloseTo(1.6);
    expect(countWindow(20).durationSec).toBe(1.8);
  });
});

describe('BarChart', () => {
  it('normaliza pela maior barra', () => {
    expect(barWidths([50, 100, 25])).toEqual([0.5, 1, 0.25]);
  });

  it('zera negativos, inválidos e conjunto vazio ou todo zerado', () => {
    expect(barWidths([-5, 10, Number.NaN])).toEqual([0, 1, 0]);
    expect(barWidths([0, 0])).toEqual([0, 0]);
    expect(barWidths([])).toEqual([]);
  });

  it('descobre as casas decimais necessárias (até 2)', () => {
    expect(decimalsFor([1, 20, 300])).toBe(0);
    expect(decimalsFor([38.4, 21.7, 4.2])).toBe(1);
    expect(decimalsFor([1.2345, 3])).toBe(2);
    expect(decimalsFor([])).toBe(0);
  });

  it('formata o valor com a unidade', () => {
    expect(formatBarValue(87, 0, '%')).toBe('87%');
    expect(formatBarValue(4.2, 1, 's')).toBe('4,2s');
    expect(formatBarValue(1200, 0, 'ms')).toBe('1.200 ms');
    expect(formatBarValue(1200, 0)).toBe('1.200');
  });
});

describe('SubscribeCTA', () => {
  it('clica no meio da duração', () => {
    const timeline = clickTimeline(4);
    expect(timeline.clickAt).toBe(2);
    expect(timeline.cursorStart).toBeLessThan(timeline.clickAt);
    expect(timeline.cursorEnd).toBeGreaterThan(timeline.clickAt);
    expect(clickTimeline(0.6).cursorStart).toBe(0);
  });

  it('só vira "Inscrito" depois do clique', () => {
    expect(subscribedAt(1.99, 2)).toBe(0);
    expect(subscribedAt(2, 2)).toBe(0);
    expect(subscribedAt(2.1, 2)).toBeGreaterThan(0);
    expect(subscribedAt(3, 2)).toBe(1);
  });

  it('afunda o botão no instante do clique e volta', () => {
    expect(pressScale(1, 2)).toBe(1);
    expect(pressScale(2, 2)).toBeCloseTo(0.93);
    expect(pressScale(3, 2)).toBe(1);
  });
});
