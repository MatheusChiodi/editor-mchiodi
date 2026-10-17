import { describe, expect, it } from 'vitest';

import { fitFontSize, lastTime, PAIR_OFFSET, sequenceTimes, splitTimes, status } from '../motion/src/components/c1-kit.tsx';
import { CHECK_START, CHECK_STEP, checkedCount, checkTimes } from '../motion/src/components/Checklist.tsx';
import { comparisonItemSize, comparisonTimes, WINNER_DELAY } from '../motion/src/components/Comparison.tsx';
import { MEANING_TIERS, TERM_TIERS, withFullStop } from '../motion/src/components/Definition.tsx';
import { groupC1 } from '../motion/src/components/index-c1.ts';
import { KEYWORD_MAX, KEYWORD_MIN, keywordFontSize, keywordMaxWidth, outlineWidth } from '../motion/src/components/KeywordPop.tsx';
import { prosConsItemSize, prosConsTimes } from '../motion/src/components/ProsCons.tsx';
import { asQuestion, QUESTION_TIERS } from '../motion/src/components/QuestionCard.tsx';
import { attribution, QUOTE_TIERS, stripQuotes } from '../motion/src/components/Quote.tsx';
import { citationParts, SOURCE_MAX, truncate } from '../motion/src/components/SourceCitation.tsx';
import { bubbleLayout, TAIL_LENGTH } from '../motion/src/components/SpeechBubble.tsx';
import { IMPACT_SEC, STAMP_ROTATE, stampColor, stampGeometry, stampImpact, stampRotation } from '../motion/src/components/Stamp.tsx';
import { fixedActive, STEP_PACE, STEP_PACE_FIXED, STEP_START, stepStates, stepTimes } from '../motion/src/components/StepByStep.tsx';
import { TIP_LABEL, tipLabel } from '../motion/src/components/TipCard.tsx';
import { warningStyle } from '../motion/src/components/WarningCard.tsx';
import { theme } from '../motion/src/theme.ts';

const SAFE = theme.safe;

describe('groupC1', () => {
  const names = ['Quote', 'Definition', 'Comparison', 'ProsCons', 'StepByStep', 'Checklist', 'TipCard', 'WarningCard', 'QuestionCard', 'KeywordPop', 'Stamp', 'SpeechBubble', 'SourceCitation'];

  it('registra os 13 componentes', () => {
    expect(Object.keys(groupC1).sort()).toEqual([...names].sort());
  });

  it.each(names)('%s tem componente, sample, duração e descrição', (name) => {
    const entry = groupC1[name]!;
    expect(typeof entry.component).toBe('function');
    expect(Object.keys(entry.sample).length).toBeGreaterThan(0);
    expect(entry.defaultDuration).toBeGreaterThan(0);
    expect(entry.description.trim().length).toBeGreaterThan(20);
  });
});

describe('c1-kit', () => {
  const tiers = [
    { fontSize: 60, maxChars: 10 },
    { fontSize: 40, maxChars: 20 },
    { fontSize: 34, maxChars: Number.POSITIVE_INFINITY },
  ];

  it('escolhe o maior corpo que comporta o texto', () => {
    expect(fitFontSize('curto', tiers)).toBe(60);
    expect(fitFontSize('  dez chars ', tiers)).toBe(60);
    expect(fitFontSize('um texto de vinte..', tiers)).toBe(40);
    expect(fitFontSize('x'.repeat(500), tiers)).toBe(34);
  });

  it('cai no último corpo quando nenhum comporta, e em 34 sem tiers', () => {
    expect(fitFontSize('x'.repeat(50), tiers.slice(0, 2))).toBe(40);
    expect(fitFontSize('qualquer', [])).toBe(34);
  });

  it('escalona a sequência e completa o que falta a partir do último tempo', () => {
    expect(sequenceTimes(3, [], 1, 0.5)).toEqual([1, 1.5, 2]);
    expect(sequenceTimes(4, [2, 5], 1, 0.5)).toEqual([2, 5, 5.5, 6]);
    expect(sequenceTimes(0, [1])).toEqual([]);
  });

  it('ignora tempos inválidos e nunca volta no tempo', () => {
    expect(sequenceTimes(3, [2, Number.NaN, 1], 1, 0.5)).toEqual([2, 2.5, 2.5]);
    expect(sequenceTimes(2, [-3, 0.2], 1, 0.5)).toEqual([1, 1]);
  });

  it('divide uma lista única em duas colunas, em paralelo por padrão', () => {
    const times = splitTimes(3, 2, undefined, 0.5, 0.6);
    expect(times.left).toEqual([0.5, 1.1, 1.7]);
    expect(times.right).toEqual([0.5 + PAIR_OFFSET, 1.1 + PAIR_OFFSET]);
  });

  it('respeita a ordem dada pelo diretor, mesmo fora de sequência', () => {
    const times = splitTimes(2, 2, [4, 5, 1, 2]);
    expect(times).toEqual({ left: [4, 5], right: [1, 2] });
    expect(splitTimes(2, 1, [3, Number.NaN], 0.5, 0.6)).toEqual({ left: [3, 1.1], right: [0.7] });
  });

  it('acha o último tempo', () => {
    expect(lastTime([1, 4], [2.5])).toBe(4);
    expect(lastTime([], [])).toBe(0);
  });
});

describe('Quote', () => {
  it('remove as aspas do texto para não duplicar a do cartão', () => {
    expect(stripQuotes('"Falar é fácil."')).toBe('Falar é fácil.');
    expect(stripQuotes(' “Me mostre o código” ')).toBe('Me mostre o código');
    expect(stripQuotes('É "simples" assim')).toBe('É "simples" assim');
  });

  it('só atribui quando há autor', () => {
    expect(attribution(' Linus Torvalds ', ' criador do Linux ')).toEqual({ author: 'Linus Torvalds', role: 'criador do Linux' });
    expect(attribution('Ada Lovelace')).toEqual({ author: 'Ada Lovelace', role: undefined });
    expect(attribution(undefined, 'engenheiro')).toBeUndefined();
    expect(attribution('  ')).toBeUndefined();
  });

  it('reduz o corpo em citações longas sem passar do mínimo de 34', () => {
    expect(fitFontSize('Falar é fácil. Me mostre o código.', QUOTE_TIERS)).toBe(66);
    expect(fitFontSize('x'.repeat(200), QUOTE_TIERS)).toBe(40);
    expect(fitFontSize('x'.repeat(900), QUOTE_TIERS)).toBe(34);
  });
});

describe('Definition', () => {
  it('fecha a definição com ponto final quando falta', () => {
    expect(withFullStop('Operação que dá o mesmo resultado')).toBe('Operação que dá o mesmo resultado.');
    expect(withFullStop('Já termina assim. ')).toBe('Já termina assim.');
    expect(withFullStop('Sério?')).toBe('Sério?');
    expect(withFullStop('  ')).toBe('');
  });

  it('diminui o termo e a definição conforme crescem', () => {
    expect(fitFontSize('Cache', TERM_TIERS)).toBe(104);
    expect(fitFontSize('Internacionalização', TERM_TIERS)).toBe(66);
    expect(fitFontSize('x'.repeat(60), MEANING_TIERS)).toBe(42);
    expect(fitFontSize('x'.repeat(400), MEANING_TIERS)).toBe(34);
  });
});

describe('Comparison', () => {
  it('revela em paralelo e dá o veredito depois do último item', () => {
    const times = comparisonTimes(3, 3);
    expect(times.left).toHaveLength(3);
    expect(times.right[0]).toBeCloseTo(times.left[0]! + PAIR_OFFSET);
    expect(times.winnerAt).toBeCloseTo(times.right[2]! + WINNER_DELAY);
  });

  it('usa revealAt (esquerda inteira, depois direita)', () => {
    const times = comparisonTimes(2, 2, [1, 2, 3, 4]);
    expect(times.left).toEqual([1, 2]);
    expect(times.right).toEqual([3, 4]);
    expect(times.winnerAt).toBeCloseTo(4 + WINNER_DELAY);
  });

  it('colunas vazias não quebram', () => {
    expect(comparisonTimes(0, 0)).toEqual({ left: [], right: [], winnerAt: WINNER_DELAY });
  });

  it('ajusta o corpo dos itens ao volume de texto', () => {
    expect(comparisonItemSize(['Rápido', 'Simples'], ['Lento'])).toBe(40);
    expect(comparisonItemSize(['Esquema rígido, validado pelo banco'], ['Curto'])).toBe(36);
    expect(comparisonItemSize(['a', 'b', 'c', 'd', 'e', 'f'], ['a'])).toBe(34);
  });
});

describe('ProsCons', () => {
  it('nomeia as colunas e mantém o paralelo por padrão', () => {
    const times = prosConsTimes(2, 3);
    expect(times.pros).toHaveLength(2);
    expect(times.cons).toHaveLength(3);
    expect(times.cons[1]).toBeCloseTo(times.pros[1]! + PAIR_OFFSET);
  });

  it('aceita prós primeiro e contras depois via revealAt', () => {
    expect(prosConsTimes(2, 1, [1, 2, 5])).toEqual({ pros: [1, 2], cons: [5] });
  });

  it('nunca desce do mínimo legível', () => {
    expect(prosConsItemSize(['Curto'], ['Curto'])).toBe(38);
    expect(prosConsItemSize(['x'.repeat(45)], ['y'])).toBe(36);
    expect(prosConsItemSize(Array.from({ length: 8 }, () => 'x'.repeat(80)), [])).toBe(34);
  });
});

describe('StepByStep', () => {
  it('revela um passo por vez no ritmo da fala', () => {
    const times = stepTimes(3);
    expect(times[0]).toBe(STEP_START);
    expect(times[1]).toBeCloseTo(STEP_START + STEP_PACE);
    expect(stepTimes(3, [1, 3])).toEqual([1, 3, 3 + STEP_PACE]);
  });

  it('com `active` fixo e sem tempos, a lista entra quase junta', () => {
    const times = stepTimes(4, undefined, 2);
    expect(times[3]! - times[0]!).toBeCloseTo(3 * STEP_PACE_FIXED);
    expect(stepTimes(2, [1, 4], 0)).toEqual([1, 4]);
  });

  it('só aceita `active` dentro da lista', () => {
    expect(fixedActive(4, 2)).toBe(2);
    expect(fixedActive(4, 0)).toBe(0);
    expect(fixedActive(4, 4)).toBeUndefined();
    expect(fixedActive(4, -1)).toBeUndefined();
    expect(fixedActive(4, Number.NaN)).toBeUndefined();
    expect(fixedActive(4)).toBeUndefined();
  });

  it('classifica os passos em feito, atual e por fazer', () => {
    expect(stepStates(4, 1)).toEqual(['done', 'active', 'todo', 'todo']);
    expect(stepStates(2, -1)).toEqual(['todo', 'todo']);
    expect(stepStates(2, 5)).toEqual(['done', 'done']);
  });
});

describe('Checklist', () => {
  it('marca um item a cada 0.8s por padrão', () => {
    const times = checkTimes(3);
    expect(times[0]).toBe(CHECK_START);
    expect(times[2]).toBeCloseTo(CHECK_START + 2 * CHECK_STEP);
  });

  it('usa checkAt e completa o resto', () => {
    expect(checkTimes(3, [2, 4])).toEqual([2, 4, 4 + CHECK_STEP]);
  });

  it('conta os itens já marcados', () => {
    const times = [1, 2.2, 3.4];
    expect(checkedCount(times, 0.9)).toBe(0);
    expect(checkedCount(times, 2.2)).toBe(2);
    expect(checkedCount(times, 99)).toBe(3);
  });
});

describe('TipCard e WarningCard', () => {
  it('usa "Dica" quando não há título', () => {
    expect(tipLabel()).toBe(TIP_LABEL);
    expect(tipLabel('  ')).toBe(TIP_LABEL);
    expect(tipLabel(' Atalho ')).toBe('Atalho');
  });

  it('warning é amber e danger é rose, cada um com sua palavra', () => {
    expect(warningStyle()).toEqual({ color: status.amber, label: 'Atenção' });
    expect(warningStyle('danger')).toEqual({ color: status.rose, label: 'Cuidado' });
    expect(warningStyle('danger', 'Risco de vazamento')).toEqual({ color: status.rose, label: 'Risco de vazamento' });
    expect(status.amber).toBe('#b45309');
    expect(status.rose).toBe('#e11d48');
  });
});

describe('QuestionCard', () => {
  it('garante o ponto de interrogação', () => {
    expect(asQuestion('Você faz backup')).toBe('Você faz backup?');
    expect(asQuestion('Você faz backup? ')).toBe('Você faz backup?');
    expect(asQuestion('Você faz backup...')).toBe('Você faz backup?');
    expect(asQuestion('  ')).toBe('');
  });

  it('diminui o corpo em perguntas longas', () => {
    expect(fitFontSize('Você faz backup?', QUESTION_TIERS)).toBe(88);
    expect(fitFontSize('x'.repeat(100), QUESTION_TIERS)).toBe(58);
    expect(fitFontSize('x'.repeat(300), QUESTION_TIERS)).toBe(46);
  });
});

describe('KeywordPop', () => {
  it('palavra curta bate no teto; palavra longa encolhe até caber', () => {
    expect(keywordFontSize('API')).toBe(KEYWORD_MAX);
    const long = keywordFontSize('Internacionalização');
    expect(long).toBeLessThan(KEYWORD_MAX);
    expect(long * 'Internacionalização'.length * 0.68).toBeLessThanOrEqual(keywordMaxWidth('center'));
    expect(keywordFontSize('x'.repeat(200))).toBe(KEYWORD_MIN);
  });

  it('de lado a palavra tem metade da tela', () => {
    expect(keywordMaxWidth('left')).toBeLessThan(keywordMaxWidth('center') * 0.6);
    expect(keywordMaxWidth('right')).toBe(keywordMaxWidth('left'));
    expect(keywordFontSize('Latência', 'left')).toBeLessThan(keywordFontSize('Latência', 'center'));
    expect(keywordFontSize('', 'center')).toBe(KEYWORD_MAX);
  });

  it('o contorno acompanha o corpo, dentro de limites', () => {
    expect(outlineWidth(300)).toBe(30);
    expect(outlineWidth(100)).toBe(14);
    expect(outlineWidth(40)).toBe(10);
  });
});

describe('Stamp', () => {
  it('cai grande, encosta e assenta em escala 1', () => {
    expect(stampImpact(0).scale).toBeCloseTo(2.1);
    expect(stampImpact(0).opacity).toBe(0);
    expect(stampImpact(IMPACT_SEC).scale).toBeCloseTo(0.94);
    expect(stampImpact(IMPACT_SEC).opacity).toBe(1);
    expect(stampImpact(1).scale).toBe(1);
  });

  it('a queda acelera: na metade do tempo ainda percorreu menos da metade', () => {
    const half = stampImpact(IMPACT_SEC / 2).scale;
    expect(half).toBeGreaterThan((2.1 + 0.94) / 2);
    let previous = Number.POSITIVE_INFINITY;
    for (let step = 0; step <= 10; step++) {
      const scale = stampImpact((IMPACT_SEC * step) / 10).scale;
      expect(scale).toBeLessThanOrEqual(previous);
      previous = scale;
    }
  });

  it('limita a rotação e cai no padrão com valor inválido', () => {
    expect(stampRotation()).toBe(STAMP_ROTATE);
    expect(stampRotation(90)).toBe(20);
    expect(stampRotation(-90)).toBe(-20);
    expect(stampRotation(Number.NaN)).toBe(STAMP_ROTATE);
    expect(stampRotation(0)).toBe(0);
  });

  it('texto longo encolhe e as bordas acompanham, a de fora sempre mais grossa', () => {
    const short = stampGeometry('Mito');
    const medium = stampGeometry('Plot twist');
    const long = stampGeometry('Funciona na minha máquina');
    expect(short).toMatchObject({ fontSize: 170, wrap: false });
    expect(medium.wrap).toBe(false);
    expect(medium.fontSize).toBeLessThan(short.fontSize);
    expect(long.wrap).toBe(true);
    expect(long.fontSize).toBeGreaterThanOrEqual(76);
    expect(stampGeometry('x'.repeat(300)).fontSize).toBe(56);
    for (const geometry of [short, long, stampGeometry('x'.repeat(300))]) {
      expect(geometry.outer).toBeGreaterThan(geometry.inner);
      expect(geometry.inner).toBeGreaterThanOrEqual(3);
    }
  });

  it('cada tom tem a sua cor legível sobre paper', () => {
    expect(stampColor()).toBe(theme.color.coral);
    expect(stampColor('ink')).toBe(theme.color.ink);
    expect(stampColor('emerald')).toBe(status.emeraldDeep);
  });
});

describe('SpeechBubble', () => {
  const inside = (layout: ReturnType<typeof bubbleLayout>) => {
    expect(layout.left).toBeGreaterThanOrEqual(SAFE.x);
    expect(layout.left + layout.width).toBeLessThanOrEqual(1920 - SAFE.x);
    expect(layout.top).toBeGreaterThanOrEqual(SAFE.y);
    expect(layout.top + layout.height).toBeLessThanOrEqual(1080 - SAFE.y);
    expect(layout.tip.x).toBeGreaterThanOrEqual(SAFE.x);
    expect(layout.tip.x).toBeLessThanOrEqual(1920 - SAFE.x);
  };

  it('com a cauda à esquerda, o balão fica à direita do ponto', () => {
    const layout = bubbleLayout('Mas na minha máquina funciona!', 'left', 0.4, 0.3);
    expect(layout.tip).toEqual({ x: 768, y: 324 });
    expect(layout.left).toBe(768 + TAIL_LENGTH);
    expect(Math.abs(layout.top + layout.height / 2 - 324)).toBeLessThanOrEqual(1);
    inside(layout);
  });

  it('com a cauda à direita, o balão fica à esquerda do ponto', () => {
    const layout = bubbleLayout('Oi?', 'right', 0.6, 0.4);
    expect(layout.tip.x).toBe(1152);
    expect(layout.left + layout.width).toBe(1152 - TAIL_LENGTH);
    inside(layout);
  });

  it('empurra o balão para dentro da margem segura e mantém a cauda presa nele', () => {
    const text = 'Era só mudar a cor de um botão. Como é que isso derrubou o checkout inteiro em produção?';
    for (const [from, x, y] of [['left', 0.98, 0.99], ['right', 0.01, 0], ['left', 0, 0.5], ['right', 1, 1]] as const) {
      const layout = bubbleLayout(text, from, x, y);
      inside(layout);
      expect(layout.attachY).toBeGreaterThan(layout.top);
      expect(layout.attachY).toBeLessThan(layout.top + layout.height);
      expect(layout.tip.x).toBe(from === 'left' ? layout.left - TAIL_LENGTH : layout.left + layout.width + TAIL_LENGTH);
    }
  });

  it('texto longo quebra em mais linhas com corpo menor, sem perder palavras', () => {
    const text = 'Era só mudar a cor de um botão. Como é que isso derrubou o checkout inteiro em produção numa sexta à noite?';
    const short = bubbleLayout('Oi?');
    const long = bubbleLayout(text);
    expect(short.lines).toEqual(['Oi?']);
    expect(long.fontSize).toBeLessThan(short.fontSize);
    expect(long.fontSize).toBeGreaterThanOrEqual(34);
    expect(long.lines.join(' ')).toBe(text);
    expect(long.height).toBeGreaterThan(short.height);
  });

  it('usa a posição padrão quando x e y são inválidos', () => {
    expect(bubbleLayout('Oi?', 'left', Number.NaN, undefined).tip).toEqual(bubbleLayout('Oi?', 'left').tip);
    inside(bubbleLayout('Oi?', 'right', 5, -3));
  });
});

describe('SourceCitation', () => {
  it('corta sem partir palavra e fecha com reticências', () => {
    expect(truncate('MDN Web Docs', 20)).toBe('MDN Web Docs');
    const cut = truncate('Relatório anual do Stack Overflow Developer Survey sobre linguagens', 30);
    expect(cut.length).toBeLessThanOrEqual(30);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut).toBe('Relatório anual do Stack…');
    expect(truncate('x'.repeat(50), 10)).toBe(`${'x'.repeat(9)}…`);
  });

  it('monta fonte e meta, sem repetir "Fonte:"', () => {
    expect(citationParts('Fonte: MDN Web Docs', 'Array.prototype.map', '2024')).toEqual({ source: 'MDN Web Docs', meta: 'Array.prototype.map · 2024' });
    expect(citationParts('State of JS', undefined, '2023')).toEqual({ source: 'State of JS', meta: '2023' });
    expect(citationParts('State of JS', ' ', '')).toEqual({ source: 'State of JS', meta: undefined });
  });

  it('limita o tamanho da fonte para a pílula caber na tela', () => {
    const parts = citationParts('x '.repeat(200), 'y '.repeat(200), '2024');
    expect(parts.source.length).toBeLessThanOrEqual(SOURCE_MAX);
    expect(parts.meta!.endsWith('· 2024')).toBe(true);
  });
});
