import { describe, expect, it } from 'vitest';

import type { ComponentEntry } from '../motion/src/components/registry.ts';
import { CAPTION_ZONE } from '../motion/src/scene-kit/tokens.ts';
import { entry as degrauEntry, gapLayout, gapRatio, ROW_STAGGER, rowTimes } from '../motion/src/scenes/como-melhorei/DegrauMercado.tsx';
import {
  BLOCK_STAGGER,
  blockDelay,
  entry as estudoEntry,
  formatHours,
  studyHours,
  studyLayout,
  studyTimes,
} from '../motion/src/scenes/como-melhorei/EstudoSemEvoluir.tsx';
import {
  entry as stackEntry,
  highlightWindow,
  STACK_GROUPS,
  stackCardTimes,
  stackLayout,
} from '../motion/src/scenes/como-melhorei/StackInicial.tsx';
import { theme } from '../motion/src/theme.ts';

const USABLE = { width: 1920 - theme.safe.x * 2, height: 1080 - theme.safe.y - CAPTION_ZONE };

describe('como-melhorei (A): contrato das cenas', () => {
  const cases: [string, ComponentEntry, number, string[]][] = [
    ['EstudoSemEvoluir', estudoEntry, 5.6, ['study1', 'study2', 'study3', 'study4', 'flat']],
    ['StackInicial', stackEntry, 8, ['html', 'css', 'bootstrap', 'javascript', 'backend', 'php', 'mysql']],
    ['DegrauMercado', degrauEntry, 6.5, ['base', 'market', 'gap', 'felt']],
  ];

  it.each(cases)('%s: entry válido, revealAt com as chaves pedidas e dentro da duração', (_name, entry, duration, keys) => {
    expect(typeof entry.component).toBe('function');
    expect(entry.defaultDuration).toBe(duration);
    expect(entry.description.length).toBeGreaterThan(20);
    const revealAt = entry.sample.revealAt as Record<string, number>;
    expect(Object.keys(revealAt)).toEqual(keys);
    const times = Object.values(revealAt);
    expect(times.every((time) => time >= 0 && time < duration)).toBe(true);
    // a fala cita os elementos em ordem
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('defaults iguais aos combinados com o diretor', () => {
    expect(estudoEntry.sample.revealAt).toEqual({ study1: 1.6, study2: 2.1, study3: 2.6, study4: 3.1, flat: 4.2 });
    expect(stackEntry.sample.revealAt).toEqual({ html: 0.9, css: 1.6, bootstrap: 2.3, javascript: 3.2, backend: 5.0, php: 6.0, mysql: 6.8 });
    expect(degrauEntry.sample.revealAt).toEqual({ base: 0.4, market: 2.0, gap: 3.4, felt: 5.2 });
  });
});

describe('EstudoSemEvoluir', () => {
  const layout = studyLayout();

  it('studyTimes devolve os quatro estudos na ordem da fala', () => {
    expect(studyTimes({ study1: 1, study2: 2, study3: 3, study4: 4, flat: 5 })).toEqual([1, 2, 3, 4]);
  });

  it('a coluna i empilha i+1 blocos, de baixo para cima, sem sobreposição', () => {
    expect(layout.columns.map((column) => column.blocks.length)).toEqual([1, 2, 3, 4]);
    for (const column of layout.columns) {
      expect(column.blocks[0]! + layout.block.height).toBe(layout.baseline);
      for (let j = 1; j < column.blocks.length; j++) {
        expect(column.blocks[j - 1]! - column.blocks[j]!).toBe(layout.block.height + layout.block.gap);
      }
    }
    // a pilha mais alta encosta no topo do gráfico
    expect(layout.columns.at(-1)!.blocks.at(-1)).toBe(0);
  });

  it('colunas lado a lado dentro do gráfico, sem invadir os rótulos nem o contador', () => {
    const first = layout.columns[0]!;
    const last = layout.columns.at(-1)!;
    expect(first.x).toBe(layout.chart.x);
    expect(first.x).toBeGreaterThan(layout.labelWidth);
    expect(last.x + layout.column.width).toBeCloseTo(layout.chart.x + layout.chart.width);
    expect(last.x + layout.column.width).toBeLessThan(layout.side.x);
    expect(layout.side.x + layout.side.width).toBeLessThanOrEqual(layout.width);
    for (let i = 1; i < layout.columns.length; i++) {
      expect(layout.columns[i]!.x - layout.columns[i - 1]!.x).toBeCloseTo(layout.column.width + layout.column.gap);
    }
    expect(first.center).toBeCloseTo(first.x + layout.column.width / 2);
  });

  it('a faixa da evolução fica abaixo das colunas e cabe no cartão', () => {
    expect(layout.stepLabelY).toBeGreaterThan(layout.baseline);
    expect(layout.dividerY).toBeGreaterThan(layout.stepLabelY + 34);
    expect(layout.evolutionY).toBeGreaterThan(layout.dividerY);
    expect(layout.height).toBeGreaterThan(layout.evolutionY);
  });

  it('título + cartão cabem na área útil, acima da faixa das legendas', () => {
    const card = layout.height + 44 * 2 + 4;
    expect(layout.width + 44 * 2 + 4).toBeLessThanOrEqual(USABLE.width);
    // eyebrow + título (80 px) ocupam ~160 px; o espaçamento é 44
    expect(160 + 44 + card).toBeLessThanOrEqual(USABLE.height);
  });

  it('blocos de uma coluna caem escalonados', () => {
    expect(blockDelay(2, 0)).toBe(2);
    expect(blockDelay(2, 3)).toBeCloseTo(2 + 3 * BLOCK_STAGGER);
    expect(blockDelay(1, 2, 0.1)).toBeCloseTo(1.2);
  });

  it('as horas acumulam a cada estudo e param no total', () => {
    const starts = [1.6, 2.1, 2.6, 3.1];
    expect(studyHours(0, starts)).toBe(0);
    expect(studyHours(1.6, starts)).toBe(0);
    expect(studyHours(1.8, starts)).toBe(5);
    expect(studyHours(2.05, starts)).toBe(10);
    expect(studyHours(2.6, starts)).toBe(20);
    expect(studyHours(5.6, starts)).toBe(40);
    expect(studyHours(9, starts, 25)).toBe(100);
    // nunca diminui
    const values = Array.from({ length: 60 }, (_, i) => studyHours(i / 10, starts));
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('formatHours', () => {
    expect(formatHours(0)).toBe('0 h');
    expect(formatHours(40)).toBe('40 h');
  });
});

describe('StackInicial', () => {
  const layout = stackLayout();
  const revealAt = stackEntry.sample.revealAt as Parameters<typeof stackCardTimes>[0];

  it('dois grupos na ordem da fala: 4 de front, 2 de back', () => {
    expect(STACK_GROUPS.map((group) => group.title)).toEqual(['Front-end', 'Back-end']);
    expect(STACK_GROUPS.map((group) => group.items.map((item) => item.name))).toEqual([
      ['HTML', 'CSS', 'Bootstrap', 'JavaScript'],
      ['PHP', 'MySQL'],
    ]);
    // toda tecnologia tem tempo de entrada
    for (const item of STACK_GROUPS.flatMap((group) => group.items)) {
      expect(revealAt[item.key]).toBeGreaterThan(0);
    }
  });

  it('cartões alinhados pela base; o do back é menor', () => {
    const [front, back] = layout.cards as [(typeof layout.cards)[number], (typeof layout.cards)[number]];
    expect(front.y).toBe(0);
    expect(front.y + front.height).toBe(layout.height);
    expect(back.y + back.height).toBe(layout.height);
    expect(back.height).toBeLessThan(front.height);
    // sobra espaço acima do cartão menor para a pílula
    expect(back.y).toBeGreaterThan(100);
    expect(front.x).toBe(0);
    expect(back.x).toBeGreaterThan(front.x + front.width);
    expect(back.x + back.width).toBe(layout.width);
    expect(front.width).toBeGreaterThan(back.width);
  });

  it('itens empilham de baixo para cima, sem sobrepor entre si nem o cabeçalho', () => {
    for (const card of layout.cards) {
      expect(card.tiles[0]! + layout.tile.height).toBe(card.height - layout.padding);
      for (let j = 1; j < card.tiles.length; j++) {
        expect(card.tiles[j - 1]! - card.tiles[j]!).toBe(layout.tile.height + layout.tile.gap);
      }
      expect(card.tiles.at(-1)).toBe(layout.padding + layout.header);
    }
  });

  it('cabe na área útil', () => {
    expect(layout.width).toBeLessThanOrEqual(USABLE.width);
    // eyebrow + título (76 px) ocupam ~155 px; o espaçamento é 40
    expect(155 + 40 + layout.height).toBeLessThanOrEqual(USABLE.height);
  });

  it('stackLayout generaliza para outras contagens', () => {
    const other = stackLayout([3, 3, 3], 1500);
    expect(other.cards).toHaveLength(3);
    expect(new Set(other.cards.map((card) => card.height)).size).toBe(1);
    expect(other.cards.at(-1)!.x + other.cards.at(-1)!.width).toBeLessThanOrEqual(1500);
  });

  it('o cartão do front entra antes do HTML; o do back, na palavra "back-end"', () => {
    const times = stackCardTimes(revealAt);
    expect(times.front).toBeCloseTo(0.35);
    expect(times.front).toBeLessThan(revealAt.html);
    expect(times.back).toBe(5);
    expect(times.back).toBeLessThan(revealAt.php);
    expect(stackCardTimes({ ...revealAt, html: 0.2 }).front).toBe(0);
  });

  it('o destaque passa de item em item', () => {
    const reveal = revealAt;
    expect(highlightWindow('html', reveal)).toEqual({ from: 0.9, to: 1.6 });
    expect(highlightWindow('php', reveal)).toEqual({ from: 6.0, to: 6.8 });
    // a fala demora a chegar no próximo: o destaque não segura mais que o teto
    expect(highlightWindow('javascript', reveal).to).toBeCloseTo(4.4);
    expect(highlightWindow('mysql', reveal).to).toBeCloseTo(8.0);
    expect(highlightWindow('mysql', reveal, 0.5).to).toBeCloseTo(7.3);
  });
});

describe('DegrauMercado', () => {
  const layout = gapLayout();

  it('base baixa à esquerda, paredão alto à direita, no mesmo chão', () => {
    expect(layout.base.x).toBe(0);
    expect(layout.wall.x + layout.wall.width).toBe(layout.width);
    expect(layout.base.y + layout.base.height).toBe(layout.height);
    expect(layout.wall.y + layout.wall.height).toBe(layout.height);
    expect(layout.wall.y).toBe(0);
    expect(gapRatio(layout)).toBeGreaterThan(3);
  });

  it('fiadas do paredão de baixo para cima, preenchendo a altura', () => {
    expect(layout.rows).toHaveLength(5);
    expect(layout.rows[0]!.y + layout.rows[0]!.height).toBeCloseTo(layout.height);
    expect(layout.rows.at(-1)!.y).toBeCloseTo(0);
    for (let i = 1; i < layout.rows.length; i++) {
      expect(layout.rows[i]!.y).toBeLessThan(layout.rows[i - 1]!.y);
      // sem sobreposição
      expect(layout.rows[i]!.y + layout.rows[i]!.height).toBeLessThan(layout.rows[i - 1]!.y);
    }
    expect(gapLayout(1640, 540, 3).rows).toHaveLength(3);
  });

  it('a régua do vão fica no corredor, entre o topo da base e o topo do paredão', () => {
    const corridorLeft = layout.base.x + layout.base.width;
    expect(layout.gap.x).toBeGreaterThan(corridorLeft);
    expect(layout.gap.x).toBeLessThan(layout.wall.x);
    expect(layout.gap.x - corridorLeft).toBeCloseTo(layout.wall.x - layout.gap.x);
    expect(layout.gap.from).toBe(layout.base.y);
    expect(layout.gap.to).toBe(layout.wall.y);
    expect(layout.gap.size).toBe(layout.wall.height - layout.base.height);
    expect(layout.gap.label).toEqual([layout.gap.x, layout.gap.size / 2]);
    // o corredor comporta uma pílula de ~420 px
    expect(layout.wall.x - corridorLeft).toBeGreaterThanOrEqual(440);
  });

  it('a pessoa fica em cima da base; a confirmação, no chão do corredor', () => {
    const { person } = layout;
    expect(person.center[0]).toBe(layout.base.width / 2);
    expect(person.center[1] + person.size / 2).toBeLessThan(layout.base.y);
    expect(person.center[1] - person.size / 2).toBeGreaterThan(0);
    expect(layout.felt[0]).toBe(layout.gap.x);
    expect(layout.felt[1]).toBeGreaterThan(layout.base.y);
    expect(layout.felt[1]).toBeLessThan(layout.height);
  });

  it('cabe na área útil', () => {
    expect(layout.width).toBeLessThanOrEqual(USABLE.width);
    // eyebrow + título (80 px) ocupam ~160 px; o espaçamento é 52
    expect(160 + 52 + layout.height + 10).toBeLessThanOrEqual(USABLE.height);
  });

  it('as fiadas sobem escalonadas a partir de `market`', () => {
    const times = rowTimes(2, 5);
    expect(times[0]).toBe(2);
    expect(times.at(-1)).toBeCloseTo(2 + 4 * ROW_STAGGER);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(rowTimes(1, 2, 0.5)).toEqual([1, 1.5]);
    // o paredão termina de subir antes de o vão ser medido
    const reveal = degrauEntry.sample.revealAt as { market: number; gap: number };
    expect(rowTimes(reveal.market, 5).at(-1)! + 0.45).toBeLessThan(reveal.gap);
  });
});
