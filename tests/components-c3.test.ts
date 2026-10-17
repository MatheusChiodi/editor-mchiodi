import { describe, expect, it } from 'vitest';

import { clamp01, cornerPlacement, sweep } from '../motion/src/components/c3-kit.ts';
import { chapterSegments, COMPACT_FROM, currentChapter } from '../motion/src/components/ChapterProgress.tsx';
import { CHAT_START, CHAT_STEP, chatFontSize, chatTimeline, dotLift, showsName, TYPING_LEAD } from '../motion/src/components/ChatBubbles.tsx';
import { countdownNumber, countdownProgress, countdownStart, endFontSize, tickPhase } from '../motion/src/components/Countdown.tsx';
import { groupC3 } from '../motion/src/components/index-c3.ts';
import { likePop, likeRing } from '../motion/src/components/LikeReminder.tsx';
import { areaPath, axisDecimals, gutterWidth, lineDomain, linePath, plotPoints, pointAtProgress, tickIndexes } from '../motion/src/components/LineChart.tsx';
import { arrowNudge } from '../motion/src/components/LinkCard.tsx';
import { BUG_OPACITY, bugOpacity } from '../motion/src/components/LogoBug.tsx';
import { formatShare, sliceArcs, sliceColors, sliceTotal, totalFontSize, visibleFraction } from '../motion/src/components/PieChart.tsx';
import { progressFraction, reachedSteps, stepLabelLines, stepPositions } from '../motion/src/components/ProgressBar.tsx';
import { roundToHalf, starCount, starFills } from '../motion/src/components/Rating.tsx';
import { resolveTrend, statFontSize, trendTone } from '../motion/src/components/StatCard.tsx';
import { highlightedEvent, lineExtent, timelinePositions, timelineScale } from '../motion/src/components/Timeline.tsx';
import { toastLife, toastOffset, toastTone } from '../motion/src/components/Toast.tsx';
import { theme } from '../motion/src/theme.ts';

describe('groupC3', () => {
  const names = [
    'PieChart',
    'LineChart',
    'StatCard',
    'ProgressBar',
    'Timeline',
    'Rating',
    'Countdown',
    'Toast',
    'ChatBubbles',
    'LinkCard',
    'ChapterProgress',
    'LogoBug',
    'LikeReminder',
  ];

  it('tem os 13 componentes', () => {
    expect(Object.keys(groupC3).sort()).toEqual([...names].sort());
  });

  it.each(names)('%s tem componente, sample, duração e descrição', (name) => {
    const entry = groupC3[name]!;
    expect(typeof entry.component).toBe('function');
    expect(Object.keys(entry.sample).length).toBeGreaterThan(0);
    expect(entry.defaultDuration).toBeGreaterThan(0);
    expect(entry.description.trim().length).toBeGreaterThan(20);
  });
});

describe('c3-kit', () => {
  it('traduz o canto em alinhamento flex e lado de saída', () => {
    expect(cornerPlacement('top-left')).toEqual({ justifyContent: 'flex-start', alignItems: 'flex-start', side: -1 });
    expect(cornerPlacement('top-right')).toEqual({ justifyContent: 'flex-start', alignItems: 'flex-end', side: 1 });
    expect(cornerPlacement('bottom-left')).toEqual({ justifyContent: 'flex-end', alignItems: 'flex-start', side: -1 });
    expect(cornerPlacement('bottom-right')).toEqual({ justifyContent: 'flex-end', alignItems: 'flex-end', side: 1 });
  });

  it('limita a 0–1 e trata inválidos', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(7)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it('varre de 0 a 1 entre dois instantes, travando nas pontas', () => {
    expect(sweep(0, 1, 2)).toBe(0);
    expect(sweep(1.5, 1, 2)).toBeCloseTo(0.5);
    expect(sweep(5, 1, 2)).toBe(1);
    expect(sweep(1, 1, 1)).toBe(0);
  });
});

describe('PieChart', () => {
  it('calcula início e tamanho de cada fatia em fração da volta', () => {
    const arcs = sliceArcs([50, 25, 25]);
    expect(arcs.map((arc) => arc.fraction)).toEqual([0.5, 0.25, 0.25]);
    expect(arcs.map((arc) => arc.start)).toEqual([0, 0.5, 0.75]);
  });

  it('ignora negativos e inválidos e não divide por zero', () => {
    expect(sliceArcs([-5, 10, Number.NaN]).map((arc) => arc.fraction)).toEqual([0, 1, 0]);
    expect(sliceArcs([0, 0])).toEqual([
      { start: 0, fraction: 0 },
      { start: 0, fraction: 0 },
    ]);
    expect(sliceArcs([])).toEqual([]);
    expect(sliceTotal([21, -3, 9, Number.NaN])).toBe(30);
  });

  it('as fatias fecham a volta', () => {
    const arcs = sliceArcs([21, 9, 6, 4]);
    const last = arcs[arcs.length - 1]!;
    expect(last.start + last.fraction).toBeCloseTo(1);
  });

  it('desenha as fatias em sequência conforme o progresso da volta', () => {
    const arc = { start: 0.5, fraction: 0.25 };
    expect(visibleFraction(arc, 0.4)).toBe(0);
    expect(visibleFraction(arc, 0.6)).toBeCloseTo(0.1);
    expect(visibleFraction(arc, 1)).toBe(0.25);
  });

  it('pinta de coral só a fatia destacada e as demais em slate', () => {
    const colors = sliceColors([false, true, false, false]);
    expect(colors[1]).toBe(theme.color.coral);
    expect(colors.filter((color) => color === theme.color.coral)).toHaveLength(1);
    expect(new Set(colors).size).toBe(4);
    expect(sliceColors([false, false, false, false, false, false])[4]).toBe(sliceColors([false])[0]);
  });

  it('formata a participação e ajusta o corpo do total', () => {
    expect(formatShare(0.525)).toBe('53%');
    expect(formatShare(0)).toBe('0%');
    expect(formatShare(0.0003)).toBe('<1%');
    expect(totalFontSize('40 h')).toBeGreaterThan(totalFontSize('2.400.000'));
  });
});

describe('LineChart', () => {
  it('parte do zero quando os dados chegam perto dele', () => {
    expect(lineDomain([12, 19, 77])).toEqual({ min: 0, max: 77 });
  });

  it('dá folga embaixo quando a série oscila longe do zero ou é negativa', () => {
    expect(lineDomain([90, 95, 100])).toEqual({ min: 88.5, max: 100 });
    expect(lineDomain([-5, 5])).toEqual({ min: -6.5, max: 5 });
  });

  it('trata série constante, vazia e valores inválidos', () => {
    expect(lineDomain([5, 5])).toEqual({ min: 4, max: 6 });
    expect(lineDomain([])).toEqual({ min: 0, max: 1 });
    expect(lineDomain([Number.NaN, 3, 9])).toEqual({ min: 0, max: 9 });
  });

  it('escala os pontos para a área do gráfico com Y invertido', () => {
    expect(plotPoints([0, 50, 100], 200, 100)).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 50 },
      { x: 200, y: 0 },
    ]);
    expect(plotPoints([7], 200, 100)).toEqual([{ x: 100, y: 50 }]);
    expect(plotPoints([], 200, 100)).toEqual([]);
  });

  it('monta o caminho da linha e fecha a área na base', () => {
    const points = plotPoints([0, 50, 100], 200, 100);
    expect(linePath(points)).toBe('M0 100 L100 50 L200 0');
    expect(areaPath(points, 100)).toBe('M0 100 L100 50 L200 0 L200 100 L0 100 Z');
    expect(areaPath([{ x: 0, y: 0 }], 100)).toBe('');
  });

  it('acha a ponta do traço pelo comprimento percorrido', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      { x: 30, y: 100 },
    ];
    expect(pointAtProgress(points, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAtProgress(points, 25 / 110)).toEqual({ x: 15, y: 20 });
    expect(pointAtProgress(points, 1)).toEqual({ x: 30, y: 100 });
    expect(pointAtProgress(points, 5)).toEqual({ x: 30, y: 100 });
    expect(pointAtProgress([], 0.5)).toEqual({ x: 0, y: 0 });
    const middle = pointAtProgress(points, 80 / 110);
    expect(middle.x).toBeCloseTo(30);
    expect(middle.y).toBeCloseTo(70);
  });

  it('escolhe poucos rótulos do eixo X, sempre com o primeiro e o último', () => {
    expect(tickIndexes(3)).toEqual([0, 1, 2]);
    expect(tickIndexes(9)).toEqual([0, 2, 4, 6, 8]);
    expect(tickIndexes(12)).toEqual([0, 3, 6, 8, 11]);
    expect(tickIndexes(0)).toEqual([]);
  });

  it('abre espaço para o rótulo mais longo do eixo Y, dentro de limites', () => {
    expect(gutterWidth(['0', '5'])).toBe(80);
    expect(gutterWidth(['1.285 ms'])).toBe(146);
    expect(gutterWidth(['1.285 ms'])).toBeGreaterThan(gutterWidth(['77 mil']));
    expect(gutterWidth(['um rótulo absurdamente comprido'])).toBe(230);
    expect(gutterWidth([])).toBe(80);
  });

  it('tira as casas decimais do eixo quando a faixa é larga', () => {
    expect(axisDecimals({ min: 0, max: 1284.6 }, 1)).toBe(0);
    expect(axisDecimals({ min: 0, max: 4.2 }, 1)).toBe(1);
  });
});

describe('StatCard', () => {
  it('deduz a tendência pelo sinal da variação', () => {
    expect(resolveTrend('+12%')).toBe('up');
    expect(resolveTrend('-3 ms')).toBe('down');
    expect(resolveTrend('−3')).toBe('down');
    expect(resolveTrend('estável')).toBe('flat');
    expect(resolveTrend('-')).toBe('flat');
    expect(resolveTrend(undefined)).toBe('flat');
  });

  it('respeita a tendência explícita (queda que é boa notícia)', () => {
    expect(resolveTrend('-42%', 'up')).toBe('up');
  });

  it('usa uma cor por tendência', () => {
    const tones = (['up', 'down', 'flat'] as const).map((trend) => trendTone(trend).color);
    expect(new Set(tones).size).toBe(3);
    expect(tones).not.toContain(theme.color.coral);
  });

  it('reduz o corpo conforme o valor cresce', () => {
    expect(statFontSize('99%')).toBe(156);
    expect(statFontSize('2,4 mi')).toBe(124);
    expect(statFontSize('R$ 1.234,56')).toBe(92);
    expect(statFontSize('1.234.567.890 req')).toBe(68);
  });
});

describe('ProgressBar', () => {
  it('calcula a fração preenchida dentro de 0–1', () => {
    expect(progressFraction(340, 500)).toBeCloseTo(0.68);
    expect(progressFraction(42)).toBeCloseTo(0.42);
    expect(progressFraction(150, 100)).toBe(1);
    expect(progressFraction(-5, 100)).toBe(0);
    expect(progressFraction(5, 0)).toBe(0);
    expect(progressFraction(5, Number.NaN)).toBe(0);
  });

  it('distribui os marcos do início ao fim', () => {
    const positions = stepPositions(4);
    expect(positions[0]).toBe(0);
    expect(positions[1]).toBeCloseTo(1 / 3);
    expect(positions[3]).toBe(1);
    expect(stepPositions(1)).toEqual([1]);
    expect(stepPositions(0)).toEqual([]);
  });

  it('conta os marcos alcançados', () => {
    const positions = stepPositions(4);
    expect(reachedSteps(0, positions)).toBe(1);
    expect(reachedSteps(1 / 3, positions)).toBe(2);
    expect(reachedSteps(0.99, positions)).toBe(3);
    expect(reachedSteps(1, positions)).toBe(4);
  });

  it('reserva de 1 a 3 linhas para os rótulos dos marcos', () => {
    expect(stepLabelLines(['Configurar', 'Utils', 'Strict'], 200)).toBe(1);
    expect(stepLabelLines(['Unitários', 'Integração com o banco'], 160)).toBe(3);
    expect(stepLabelLines(['um rótulo comprido demais para caber em três linhas estreitas'], 120)).toBe(3);
    expect(stepLabelLines([], 200)).toBe(1);
  });
});

describe('Timeline', () => {
  it('centraliza cada marco na sua coluna', () => {
    expect(timelinePositions(4, 1600)).toEqual([200, 600, 1000, 1400]);
    expect(timelinePositions(1, 1600)).toEqual([800]);
    expect(timelinePositions(0, 1600)).toEqual([]);
  });

  it('avança a linha um trecho por marco revelado', () => {
    const positions = [200, 600, 1000];
    expect(lineExtent(positions, [0, 0, 0])).toBe(200);
    expect(lineExtent(positions, [1, 0.5, 0])).toBe(400);
    expect(lineExtent(positions, [1, 1, 1])).toBe(1000);
    expect(lineExtent(positions, [1, 2, -1])).toBe(600);
    expect(lineExtent([], [])).toBe(0);
  });

  it('diminui o texto com mais marcos, sem passar de 24', () => {
    expect(timelineScale(3).title).toBeGreaterThan(timelineScale(4).title);
    expect(timelineScale(4).title).toBeGreaterThan(timelineScale(6).title);
    expect(Math.min(...Object.values(timelineScale(8)))).toBeGreaterThanOrEqual(24);
  });

  it('destaca o marco informado ou o último revelado', () => {
    const times = [0.5, 1.3, 2.1];
    expect(highlightedEvent(3, times, 0)).toBe(-1);
    expect(highlightedEvent(3, times, 1.5)).toBe(1);
    expect(highlightedEvent(3, times, 1.5, 0)).toBe(0);
    expect(highlightedEvent(3, times, 1.5, 9)).toBe(1);
    expect(highlightedEvent(3, times, 1.5, 1.5)).toBe(1);
  });
});

describe('Rating', () => {
  it('arredonda para meio ponto dentro do máximo', () => {
    expect(roundToHalf(4.3)).toBe(4.5);
    expect(roundToHalf(4.2)).toBe(4);
    expect(roundToHalf(7)).toBe(5);
    expect(roundToHalf(-1)).toBe(0);
    expect(roundToHalf(Number.NaN)).toBe(0);
    expect(roundToHalf(8.7, 10)).toBe(8.5);
  });

  it('preenche as estrelas, inclusive pela metade', () => {
    expect(starFills(3.5)).toEqual([1, 1, 1, 0.5, 0]);
    expect(starFills(0)).toEqual([0, 0, 0, 0, 0]);
    expect(starFills(5)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(2, 3)).toEqual([1, 1, 0]);
  });

  it('limita a quantidade de estrelas', () => {
    expect(starCount()).toBe(5);
    expect(starCount(0)).toBe(1);
    expect(starCount(12)).toBe(10);
    expect(starCount(Number.NaN)).toBe(5);
  });
});

describe('Countdown', () => {
  it('troca de número a cada segundo real', () => {
    expect(countdownNumber(0, 30, 5)).toBe(5);
    expect(countdownNumber(29, 30, 5)).toBe(5);
    expect(countdownNumber(30, 30, 5)).toBe(4);
    expect(countdownNumber(149, 30, 5)).toBe(1);
    expect(countdownNumber(150, 30, 5)).toBe(0);
    expect(countdownNumber(999, 30, 5)).toBe(0);
  });

  it('aceita partida quebrada, negativa ou inválida', () => {
    expect(countdownStart(3.9)).toBe(3);
    expect(countdownStart(-2)).toBe(0);
    expect(countdownStart(Number.NaN)).toBe(0);
    expect(countdownNumber(-10, 30, 3)).toBe(3);
  });

  it('esvazia o anel de forma linear até o zero', () => {
    expect(countdownProgress(0, 30, 5)).toBe(0);
    expect(countdownProgress(75, 30, 5)).toBe(0.5);
    expect(countdownProgress(150, 30, 5)).toBe(1);
    expect(countdownProgress(900, 30, 5)).toBe(1);
    expect(countdownProgress(0, 30, 0)).toBe(1);
  });

  it('marca a posição dentro do segundo', () => {
    expect(tickPhase(0, 30)).toBe(0);
    expect(tickPhase(45, 30)).toBe(0.5);
    expect(tickPhase(60, 30)).toBe(0);
  });

  it('encolhe o texto final longo', () => {
    expect(endFontSize('Já!')).toBeGreaterThan(endFontSize('Valendo'));
    expect(endFontSize('Valendo')).toBeGreaterThan(endFontSize('Acabou o tempo'));
  });
});

describe('Toast', () => {
  it('entra de fora da tela pelo lado ancorado e sai pelo mesmo lado', () => {
    expect(toastOffset(1, 0, 0, 800)).toBe(800);
    expect(toastOffset(1, 1, 0, 800)).toBe(0);
    expect(toastOffset(1, 1, 1, 800)).toBe(800);
    expect(toastOffset(-1, 0, 0, 800)).toBe(-800);
    expect(toastOffset(-1, 1, 0.5, 800)).toBe(-400);
  });

  it('esvazia a barra de vida entre a entrada e a saída', () => {
    expect(toastLife(0, 4, 0.4, 0.2)).toBe(1);
    expect(toastLife(0.4, 4, 0.4, 0.2)).toBe(1);
    expect(toastLife(2.1, 4, 0.4, 0.2)).toBeCloseTo(0.5);
    expect(toastLife(3.8, 4, 0.4, 0.2)).toBeCloseTo(0);
    expect(toastLife(1, 0.5, 0.4, 0.2)).toBe(0);
  });

  it('dá um acento diferente por tipo, nenhum deles coral', () => {
    const colors = (['info', 'success', 'warning', 'error'] as const).map((kind) => toastTone(kind).color);
    expect(new Set(colors).size).toBe(4);
    expect(colors).not.toContain(theme.color.coral);
  });
});

describe('ChatBubbles', () => {
  const sample = [{ from: 'them' }, { from: 'me' }, { from: 'them' }, { from: 'me' }] as const;

  it('escalona as mensagens e mostra "digitando" antes das do outro', () => {
    const moments = chatTimeline(sample);
    expect(moments.map((moment) => moment.at)).toEqual([0, 1, 2, 3].map((index) => expect.closeTo(CHAT_START + index * CHAT_STEP)));
    expect(moments[0]!.typingFrom).toBeCloseTo(CHAT_START - TYPING_LEAD);
    expect(moments[1]!.typingFrom).toBeNull();
    expect(moments[2]!.typingFrom).toBeCloseTo(moments[2]!.at - TYPING_LEAD);
    expect(moments[3]!.typingFrom).toBeNull();
  });

  it('respeita revealAt e não digita por cima da mensagem anterior', () => {
    const tight = chatTimeline(sample, [1, 1.5, 2.1]);
    expect(tight[2]!.at).toBe(2.1);
    expect(tight[2]!.typingFrom).toBe(1.75);
    const tooTight = chatTimeline(sample, [1, 1.2, 1.4]);
    expect(tooTight[2]!.typingFrom).toBeNull();
    expect(tooTight[3]!.at).toBeCloseTo(1.4 + CHAT_STEP);
  });

  it('o indicador nunca começa depois da mensagem', () => {
    for (const moment of chatTimeline(sample, [0.1, 0.2, 3, 3.1])) {
      if (moment.typingFrom !== null) expect(moment.typingFrom).toBeLessThan(moment.at);
    }
  });

  it('os pontinhos sobem em onda, dentro de 0–1', () => {
    for (let frame = 0; frame < 90; frame++) {
      for (const dot of [0, 1, 2]) {
        const lift = dotLift(frame / 30, dot);
        expect(lift).toBeGreaterThanOrEqual(0);
        expect(lift).toBeLessThanOrEqual(1);
      }
    }
    expect(dotLift(0.1, 0)).not.toBe(dotLift(0.1, 1));
  });

  it('mostra o nome só quando o remetente muda', () => {
    const messages = [
      { from: 'them', text: 'a', name: 'Cliente' },
      { from: 'them', text: 'b', name: 'Cliente' },
      { from: 'me', text: 'c' },
      { from: 'them', text: 'd', name: 'Cliente' },
      { from: 'them', text: 'e', name: ' ' },
    ] as const;
    expect(messages.map((_, index) => showsName(messages, index))).toEqual([true, false, false, true, false]);
  });

  it('encolhe o texto em conversa longa', () => {
    const short = [{ from: 'me', text: 'Oi' }] as const;
    const long = Array.from({ length: 8 }, () => ({ from: 'me' as const, text: 'Uma mensagem de tamanho médio para encher a tela.' }));
    expect(chatFontSize(short)).toBe(36);
    expect(chatFontSize(long)).toBe(28);
  });
});

describe('LinkCard', () => {
  it('a seta dá um único empurrão e volta', () => {
    expect(arrowNudge(0)).toBe(0);
    expect(arrowNudge(1.25)).toBe(1);
    expect(arrowNudge(1.5)).toBe(0);
    expect(arrowNudge(4)).toBe(0);
  });
});

describe('ChapterProgress', () => {
  const chapters = ['O problema', 'Como o cache funciona', 'Implementando', 'Medindo o ganho', 'Quando não usar'];

  it('marca passado, atual e futuro e numera o atual', () => {
    const segments = chapterSegments(chapters, 1);
    expect(segments.map((segment) => segment.state)).toEqual(['past', 'current', 'future', 'future', 'future']);
    expect(segments[1]!.label).toBe('02 · Como o cache funciona');
    expect(segments[0]!.label).toBe('O problema');
    expect(segments[1]!.weight).toBeGreaterThan(segments[0]!.weight);
  });

  it('com muitos capítulos, só o atual mostra o título', () => {
    const many = Array.from({ length: COMPACT_FROM + 2 }, (_, index) => `Capítulo ${index + 1}`);
    const segments = chapterSegments(many, 3);
    expect(segments[0]!.label).toBe('01');
    expect(segments[3]!.label).toBe('04 · Capítulo 4');
    expect(segments[7]!.label).toBe('08');
  });

  it('corrige índice fora da lista ou quebrado', () => {
    expect(currentChapter(5, 99)).toBe(4);
    expect(currentChapter(5, -1)).toBe(0);
    expect(currentChapter(5, 2.4)).toBe(2);
    expect(currentChapter(0, 3)).toBe(0);
    expect(currentChapter(5, Number.NaN)).toBe(0);
    expect(chapterSegments(chapters, 99)[4]!.state).toBe('current');
  });

  it('título vazio vira só o número', () => {
    expect(chapterSegments(['', ' '], 0).map((segment) => segment.label)).toEqual(['01', '02']);
  });
});

describe('LogoBug', () => {
  it('mantém a opacidade discreta mas visível', () => {
    expect(bugOpacity()).toBe(BUG_OPACITY);
    expect(bugOpacity(0.5)).toBe(0.5);
    expect(bugOpacity(0)).toBe(0.2);
    expect(bugOpacity(2)).toBe(1);
    expect(bugOpacity(Number.NaN)).toBe(BUG_OPACITY);
  });
});

describe('LikeReminder', () => {
  it('o joinha afunda no clique, passa do tamanho e assenta', () => {
    expect(likePop(1, 2)).toBe(1);
    expect(likePop(2, 2)).toBeCloseTo(0.93);
    expect(likePop(3, 2)).toBe(1);
    const peak = Math.max(...Array.from({ length: 30 }, (_, index) => likePop(2 + index / 60, 2)));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.1);
  });

  it('o anel só existe depois do clique e some sozinho', () => {
    expect(likeRing(1.9, 2).opacity).toBe(0);
    expect(likeRing(2, 2).opacity).toBe(0);
    expect(likeRing(2.1, 2).opacity).toBeGreaterThan(0);
    expect(likeRing(2.1, 2).scale).toBeGreaterThan(1);
    expect(likeRing(3, 2).opacity).toBe(0);
  });
});
