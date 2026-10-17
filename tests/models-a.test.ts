import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ComponentEntry } from '../motion/src/components/registry.ts';
import { isIconName } from '../motion/src/scene-kit/icons.tsx';
import {
  cartaoBodyTimes,
  cartaoButtonWidth,
  cartaoCounterText,
  cartaoExtent,
  cartaoLayout,
  CARTAO_MAX_COUNTERS,
  type CartaoComContadoresESeloProps,
  cartaoPhase,
  cartaoReveal,
  cartaoSchedule,
  cartaoTitleSize,
  entry as cartaoEntry,
} from '../motion/src/scenes/modelos/CartaoComContadoresESelo.tsx';
import {
  COLUNAS_BLOCK_STAGGER,
  COLUNAS_MAX,
  COLUNAS_MIN,
  colunasBlockDelay,
  type ColunasComLinhaParadaProps,
  colunasCounterText,
  colunasExtent,
  colunasLayout,
  colunasShowLabels,
  colunasTimes,
  colunasTotal,
  entry as colunasEntry,
} from '../motion/src/scenes/modelos/ColunasComLinhaParada.tsx';
import {
  DEGRAU_MAX_ROWS,
  DEGRAU_MIN_ROWS,
  DEGRAU_ROW_STAGGER,
  type DegrauEVaoProps,
  degrauExtent,
  degrauLayout,
  degrauRatio,
  degrauReveal,
  degrauRowLabels,
  degrauRowTimes,
  entry as degrauEntry,
} from '../motion/src/scenes/modelos/DegrauEVao.tsx';
import {
  entry as fileiraEntry,
  FILEIRA_MAX,
  FILEIRA_MIN,
  fileiraBlocks,
  fileiraCapeSway,
  type FileiraDeItensProps,
  fileiraDing,
  fileiraExtent,
  type FileiraFigure,
  fileiraLabelSize,
  fileiraLayout,
  fileiraShift,
  fileiraTimes,
  fileiraTrayPath,
  isFileiraFigure,
} from '../motion/src/scenes/modelos/FileiraDeItens.tsx';
import {
  entry as hubEntry,
  HUB_MAX,
  HUB_MIN,
  type HubComSatelitesProps,
  hubConnected,
  hubCountLabel,
  hubExtent,
  hubLayout,
  hubTextRoom,
  hubTimes,
} from '../motion/src/scenes/modelos/HubComSatelites.tsx';
import { AREA, clampInt, fitFont, fitPill, fitsArea, iconOr, lineCount, MIN_TEXT, pillWidth, sequence, statementHeight, textWidth, timeOr, titleSize } from '../motion/src/scenes/modelos/kit-a.ts';
import {
  entry as pilhaEntry,
  PILHA_MAX_ITEMS,
  pilhaCounts,
  type PilhaEmDoisGruposProps,
  pilhaExtent,
  pilhaGroupTimes,
  pilhaHighlight,
  pilhaLayout,
  pilhaTileText,
  pilhaTimes,
} from '../motion/src/scenes/modelos/PilhaEmDoisGrupos.tsx';
import {
  entry as trocaEntry,
  trocaClosingHeight,
  type TrocaEntreDoisPolosProps,
  trocaExtent,
  trocaLayout,
  trocaLift,
  trocaReveal,
} from '../motion/src/scenes/modelos/TrocaEntreDoisPolos.tsx';
import { loadScenes, modelProblems, modelsOf } from '../src/scenes/models.ts';
import { SCENES_DIR } from '../src/scenes/sync.ts';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const inside = (box: { x: number; y: number; width: number; height: number }, width: number, height: number) =>
  box.x >= -0.001 && box.y >= -0.001 && box.x + box.width <= width + 0.001 && box.y + box.height <= height + 0.001;

describe('kit-a: contas compartilhadas', () => {
  it('área útil = quadro menos a margem segura e a faixa das legendas', () => {
    expect(AREA).toEqual({ width: 1728, height: 836 });
    expect(fitsArea({ width: 1728, height: 836 })).toBe(true);
    expect(fitsArea({ width: 1729, height: 100 })).toBe(false);
    expect(fitsArea({ width: 100, height: 837 })).toBe(false);
  });

  it('sequence usa o tempo informado e segue em sequência onde falta', () => {
    expect(sequence(4, [1, 2.5], 0.9, 0.5)).toEqual([1, 2.5, 3, 3.5]);
    expect(sequence(3, undefined, 0.9, 0.5)).toEqual([0.9, 1.4, 1.9]);
    expect(sequence(3, [undefined, 4, Number.NaN], 1, 1)).toEqual([1, 4, 5]);
    expect(sequence(0, [1], 1, 1)).toEqual([]);
    expect(timeOr(2, 9)).toBe(2);
    expect(timeOr('2', 9)).toBe(9);
    expect(timeOr(Number.POSITIVE_INFINITY, 9)).toBe(9);
  });

  it('texto: largura cresce com o tamanho, e o ajuste nunca passa do teto nem do piso', () => {
    expect(textWidth('abcd', 50, 0.5)).toBe(100);
    expect(textWidth('ação', 10, 1)).toBe(40);
    expect(fitFont('curto', 1000, 60)).toBe(60);
    expect(fitFont('um texto bem mais comprido que a caixa', 300, 60)).toBe(MIN_TEXT);
    const size = fitFont('texto médio aqui', 400, 60, 34, 0.5);
    expect(size).toBeLessThan(60);
    expect(textWidth('texto médio aqui', size, 0.5)).toBeLessThanOrEqual(400);
    expect(fitFont('', 10, 60)).toBe(60);
    expect(lineCount('uma frase de seis palavras curtas', 200, 40)).toBeGreaterThan(1);
    expect(lineCount('curta', 500, 40)).toBe(1);
    expect(titleSize('Frase curta.', 80)).toBe(80);
    expect(titleSize('Uma frase longa demais para caber em uma única linha de título desta cena.', 80)).toBe(60);
    expect(statementHeight('Frase curta.', 80, { eyebrow: true })).toBeGreaterThan(statementHeight('Frase curta.', 80));
    expect(statementHeight('Frase curta.', 80, { support: 'apoio' })).toBeGreaterThan(statementHeight('Frase curta.', 80));
  });

  it('pílula: a largura inclui padding e adorno, e o ajuste respeita o mínimo de 34 px', () => {
    expect(pillWidth('abc', 36, 'dot')).toBeGreaterThan(pillWidth('abc', 36));
    expect(pillWidth('abc', 36, 'icon')).toBeGreaterThan(pillWidth('abc', 36, 'dot'));
    expect(fitPill('curto', 600)).toBe(36);
    const size = fitPill('um rótulo comprido de pílula', 600);
    expect(pillWidth('um rótulo comprido de pílula', size)).toBeLessThanOrEqual(600);
    expect(fitPill('um rótulo comprido demais para qualquer corredor estreito', 200)).toBe(MIN_TEXT);
  });

  it('ícone por nome: desconhecido cai no padrão, sem quebrar o render', () => {
    expect(iconOr('server')).toBe('server');
    expect(iconOr('nao-existe', 'user')).toBe('user');
    expect(iconOr(undefined)).toBeUndefined();
    expect(iconOr(42, 'check')).toBe('check');
    for (const name of ['bell', 'book', 'flag', 'users', 'chat', 'file', 'trophy', 'eye', 'heart', 'award']) expect(isIconName(name), name).toBe(true);
    expect(clampInt(9, 2, 5)).toBe(5);
    expect(clampInt(Number.NaN, 2, 5)).toBe(2);
    expect(clampInt(3.9, 2, 5)).toBe(3);
  });
});

describe('contrato: os sete modelos no catálogo', () => {
  const models = modelsOf(loadScenes());
  const cases: [string, ComponentEntry, string[], string[]][] = [
    ['PilhaEmDoisGrupos', pilhaEntry, ['como-melhorei/StackInicial'], ['HTML', 'Bootstrap', 'PHP', 'MySQL', 'Recém-formado']],
    ['ColunasComLinhaParada', colunasEntry, ['como-melhorei/EstudoSemEvoluir'], ['nada evoluindo', 'Aquela sensação', 'hoursPerStudy']],
    ['DegrauEVao', degrauEntry, ['como-melhorei/DegrauMercado'], ['O que eu sabia', 'mercado pede', 'acabei sentindo']],
    ['FileiraDeItens', fileiraEntry, ['como-melhorei/AlfredDio', 'como-melhorei/LigaDosDevs'], ['DIO', 'Alfred', 'Bootcamps', 'Liga dos Devs', 'ao meu dispor', 'DevOps']],
    ['HubComSatelites', hubEntry, ['como-melhorei/TudoNaDio', 'teste-fullstack/FullStack'], ['DIO', 'Bootcamp', 'bootcamp', 'Ranking', 'full stack']],
    ['CartaoComContadoresESelo', cartaoEntry, ['como-melhorei/ArtigoReconhecido'], ['Matheus', 'Reconhecido', 'curtidas', 'leituras']],
    ['TrocaEntreDoisPolos', trocaEntry, ['teste-fullstack/EnviarReceber'], ['Front-end', 'Back-end', 'enviar os dados', 'herança']],
  ];

  it.each(cases)('%s: metadados completos, lidos do fonte', (name, entry) => {
    const model = models.find((item) => item.name === name)!;
    expect(model, name).toBeDefined();
    expect(modelProblems(model)).toEqual([]);
    // o catálogo lê o fonte; o Studio executa o módulo: os dois têm que enxergar o mesmo exemplo
    expect(model.sample).toEqual(JSON.parse(JSON.stringify(entry.sample)));
    expect(model.defaultDuration).toBe(entry.defaultDuration);
    expect(model.tags).toEqual(entry.tags);
    expect(model.slots).toEqual(entry.slots);
    expect(model.origin).toEqual(entry.origin);
    expect(model.description!.length).toBeGreaterThan(120);
    expect(model.description).toMatch(/^Para a fala/);
    expect(model.description).toContain('Serve para');
    expect(typeof entry.component).toBe('function');
  });

  it.each(cases)('%s: as cenas de origem declaram o modelo', (name, entry, origins) => {
    const scenes = loadScenes();
    for (const key of origins) {
      const scene = scenes.find((item) => `${item.project}/${item.name}` === key)!;
      expect(scene.model, key).toBe(name);
    }
    expect(origins).toContain(entry.origin!.scene);
  });

  it.each(cases)('%s: nenhum texto do vídeo de origem no código', (name, _entry, _origins, forbidden) => {
    // a linha `origin` cita a cena de onde o modelo nasceu: é metadado, não conteúdo
    const source = readFileSync(join(SCENES_DIR, 'modelos', `${name}.tsx`), 'utf8').replace(/^\s*origin: \{.*$/m, '');
    for (const word of forbidden) expect(source.includes(word), `${name} contém "${word}"`).toBe(false);
  });

  it.each(cases)('%s: todo ícone do exemplo existe no kit', (_name, entry) => {
    const icons: unknown[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) key === 'icon' ? icons.push(item) : walk(item);
    };
    walk(entry.sample);
    for (const icon of icons) expect(isIconName(String(icon)), String(icon)).toBe(true);
  });
});

describe('PilhaEmDoisGrupos', () => {
  const origin: PilhaEmDoisGruposProps = {
    eyebrow: 'Recém-formado',
    title: 'A stack que eu tinha.',
    accent: 'eu tinha',
    groups: [
      { title: 'Front-end', icon: 'browser', items: [{ label: 'HTML', hint: 'estrutura' }, { label: 'CSS', hint: 'estilo' }, { label: 'Bootstrap', hint: 'layout pronto' }, { label: 'JavaScript', hint: 'interação' }] },
      { title: 'Back-end', icon: 'server', items: [{ label: 'PHP', hint: 'servidor' }, { label: 'MySQL', hint: 'banco de dados' }] },
    ],
    revealAt: [[0.9, 1.6, 2.3, 3.2], [6.0, 6.8]],
    groupAt: [0.35, 5.0],
    note: 'e até umas coisinhas',
  };
  const other: PilhaEmDoisGruposProps = {
    title: 'O que levo e o que fica.',
    groups: [
      { title: 'Na mochila', items: [{ label: 'Notebook' }, { label: 'Carregador de 100 W', hint: 'e o cabo reserva' }] },
      { title: 'Em casa', icon: 'lock', items: ['Monitor', 'Teclado', 'Mouse', 'Webcam', 'Microfone'].map((label) => ({ label })) },
    ],
  };

  it('com as contagens da cena de origem (4 + 2) reproduz o desenho dela', () => {
    const layout = pilhaLayout([4, 2]);
    expect(layout.tile.height).toBe(92);
    expect(layout.height).toBe(40 * 2 + 108 + 4 * 92 + 3 * 16);
    expect(layout.cards[0]!.y).toBe(0);
    expect(layout.cards[0]!.width).toBeGreaterThan(layout.cards[1]!.width);
    expect(layout.cards[1]!.x + layout.cards[1]!.width).toBe(layout.width);
    expect(layout.short).toBe(1);
    // o cartão menor encosta na mesma base e deixa espaço em cima para a nota
    expect(layout.cards[1]!.y + layout.cards[1]!.height).toBe(layout.height);
    expect(layout.note.height).toBe(layout.cards[1]!.y);
    expect(layout.note.height).toBeGreaterThanOrEqual(96);
  });

  it.each(range(1, PILHA_MAX_ITEMS).flatMap((a) => range(1, PILHA_MAX_ITEMS).map((b) => [a, b] as [number, number])))('%i + %i itens: pilhas dentro do cartão, cartões dentro do palco', (a, b) => {
    for (const hasNote of [false, true]) {
      const layout = pilhaLayout([a, b], hasNote);
      expect(layout.height).toBeLessThanOrEqual(604);
      expect(layout.tile.height).toBeGreaterThanOrEqual(MIN_TEXT * 1.3);
      layout.cards.forEach((card, index) => {
        expect(inside(card, layout.width, layout.height)).toBe(true);
        expect(card.tiles).toHaveLength([a, b][index]!);
        // a pilha sobe: cada item fica acima do anterior, sem encostar no cabeçalho
        for (let item = 1; item < card.tiles.length; item += 1) expect(card.tiles[item]!).toBe(card.tiles[item - 1]! - layout.tile.height - layout.tile.gap);
        expect(card.tiles.at(-1)!).toBeGreaterThanOrEqual(layout.padding + layout.header - 0.001);
        expect(card.tiles[0]! + layout.tile.height).toBe(card.height - layout.padding);
      });
      expect(layout.cards[0]!.x + layout.cards[0]!.width).toBeLessThan(layout.cards[1]!.x);
      if (hasNote) expect(layout.note.height).toBeGreaterThanOrEqual(96);
    }
  });

  it('limites: no máximo dois grupos e cinco itens; um grupo só fica centralizado', () => {
    expect(pilhaCounts([{ items: [1, 2, 3, 4, 5, 6, 7] }, { items: [] }, { items: [1] }])).toEqual([5, 1]);
    expect(pilhaLayout([9, 9, 9]).cards).toHaveLength(2);
    const single = pilhaLayout([3]);
    expect(single.cards).toHaveLength(1);
    expect(single.cards[0]!.x * 2 + single.cards[0]!.width).toBeCloseTo(single.width, 0);
    expect(pilhaLayout([]).cards).toHaveLength(1);
    // empate: o segundo cartão é o "mais baixo" e os dois dividem a largura
    const tie = pilhaLayout([3, 3]);
    expect(tie.short).toBe(1);
    expect(Math.abs(tie.cards[0]!.width - tie.cards[1]!.width)).toBeLessThanOrEqual(1);
    expect(pilhaLayout([2, 4]).cards[1]!.width).toBeGreaterThan(pilhaLayout([2, 4]).cards[0]!.width);
  });

  it('tempos: por grupo e índice; o segundo grupo espera o primeiro acabar', () => {
    expect(pilhaTimes([4, 2], origin.revealAt)).toEqual(origin.revealAt);
    const filled = pilhaTimes([3, 2], [[1, 2]]);
    expect(filled[0]).toEqual([1, 2, 2.7]);
    expect(filled[1]![0]).toBeCloseTo(4.5);
    expect(filled[1]![1]!).toBeGreaterThan(filled[1]![0]!);
    expect(pilhaGroupTimes([[0.9, 1.6], [6, 6.8]])).toEqual([0.35, 5]);
    expect(pilhaGroupTimes([[0.2], [0.5]])).toEqual([0, 0]);
    expect(pilhaGroupTimes([[0.9], [6]], [0.1, 4])).toEqual([0.1, 4]);
  });

  it('destaque: do item citado até o próximo, no máximo 1,2 s', () => {
    const all = [0.9, 1.6, 2.3, 3.2, 6.0, 6.8];
    expect(pilhaHighlight(0.9, all)).toEqual({ from: 0.9, to: 1.6 });
    expect(pilhaHighlight(3.2, all)).toEqual({ from: 3.2, to: 4.4 });
    expect(pilhaHighlight(6.8, all)).toEqual({ from: 6.8, to: 8 });
  });

  it('texto da peça: encolhe até 34 px e, se nem assim couber, o apoio sai', () => {
    expect(pilhaTileText('HTML', 'estrutura', 574, 92)).toEqual({ labelSize: 44, hintSize: 34, showHint: true });
    const tight = pilhaTileText('Carregador de 100 W', 'reserva', 574, 92);
    expect(tight.showHint).toBe(true);
    expect(tight.labelSize).toBeLessThan(44);
    expect(tight.labelSize).toBeGreaterThanOrEqual(MIN_TEXT);
    // o apoio não cabe nem com o nome no mínimo: sai, e o nome volta ao corpo cheio
    expect(pilhaTileText('Carregador de 100 W', 'e o cabo reserva', 574, 92)).toEqual({ labelSize: 44, hintSize: 34, showHint: false });
    expect(pilhaTileText('Um nome de item comprido demais', 'com um apoio também comprido', 400, 92).showHint).toBe(false);
    expect(pilhaTileText('Item', undefined, 574, 60).labelSize).toBe(MIN_TEXT);
    expect(pilhaTileText('Item', undefined, 574, 60).showHint).toBe(false);
  });

  it('cabe na área útil com as props da cena de origem, com outro assunto e com o exemplo', () => {
    for (const props of [origin, other, pilhaEntry.sample as PilhaEmDoisGruposProps, {}]) expect(fitsArea(pilhaExtent(props)), JSON.stringify(pilhaExtent(props))).toBe(true);
    expect(pilhaExtent({ groups: Array.from({ length: 2 }, () => ({ title: 'G', items: Array.from({ length: 9 }, () => ({ label: 'x' })) })), note: 'n', eyebrow: 'e' }).height).toBeLessThanOrEqual(AREA.height);
  });
});

describe('ColunasComLinhaParada', () => {
  const origin: ColunasComLinhaParadaProps = {
    eyebrow: 'Aquela sensação',
    title: 'Estudo sem ver resultado.',
    effortLabel: 'Estudo',
    resultLabel: 'Evolução',
    steps: ['estudo', 'estudo', 'estudo', 'estudo'],
    revealAt: [1.6, 2.1, 2.6, 3.1],
    flatAt: 4.2,
    flatLabel: 'nada evoluindo',
    counter: { perStep: 10, suffix: ' h', caption: 'de estudo' },
  };
  const other: ColunasComLinhaParadaProps = {
    eyebrow: 'Anúncios',
    title: 'Mais verba, a mesma venda.',
    effortLabel: 'Verba',
    resultLabel: 'Vendas',
    steps: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun'],
    counter: { perStep: 500, prefix: 'R$ ', caption: 'em anúncio' },
    flatLabel: 'sem crescer',
  };

  it('com 4 colunas reproduz o gráfico da cena de origem', () => {
    const layout = colunasLayout(4);
    expect(layout.block.height).toBe(64);
    expect(layout.baseline).toBe(4 * 64 + 3 * 10);
    expect(layout.columns.map((column) => column.blocks.length)).toEqual([1, 2, 3, 4]);
    expect(layout.resultY).toBeGreaterThan(layout.dividerY);
    expect(layout.dividerY).toBeGreaterThan(layout.stepLabelY);
  });

  it.each(range(COLUNAS_MIN, COLUNAS_MAX))('%i colunas: tudo dentro do gráfico, a mais alta no chão comum', (steps) => {
    const layout = colunasLayout(steps);
    expect(layout.columns).toHaveLength(steps);
    expect(layout.block.height).toBeGreaterThanOrEqual(36);
    expect(layout.baseline).toBeLessThanOrEqual(286);
    layout.columns.forEach((column, index) => {
      expect(column.blocks).toHaveLength(index + 1);
      expect(column.x).toBeGreaterThanOrEqual(layout.chart.x - 0.001);
      expect(column.x + layout.column.width).toBeLessThanOrEqual(layout.chart.x + layout.chart.width + 0.001);
      expect(column.blocks[0]! + layout.block.height).toBe(layout.baseline);
      expect(column.blocks.at(-1)!).toBeGreaterThanOrEqual(0);
    });
    // a última coluna ocupa a altura toda: é o esforço máximo
    expect(layout.columns.at(-1)!.blocks.at(-1)).toBe(0);
    expect(layout.side.x + layout.side.width).toBeLessThanOrEqual(layout.width);
    expect(layout.chart.x).toBeGreaterThanOrEqual(layout.labelWidth);
    expect(layout.height).toBeLessThanOrEqual(504);
  });

  it('limites: menos de 2 vira 2, mais de 6 vira 6', () => {
    expect(colunasLayout(0).columns).toHaveLength(COLUNAS_MIN);
    expect(colunasLayout(40).columns).toHaveLength(COLUNAS_MAX);
    expect(colunasTimes(1)).toHaveLength(2);
    expect(colunasTimes(9)).toHaveLength(6);
  });

  it('tempos e total: cada coluna soma a sua parte, com rampa', () => {
    expect(colunasTimes(4, origin.revealAt)).toEqual([1.6, 2.1, 2.6, 3.1]);
    expect(colunasTimes(3, [2])).toEqual([2, 2.5, 3]);
    expect(colunasBlockDelay(2, 0)).toBe(2);
    expect(colunasBlockDelay(2, 3)).toBeCloseTo(2 + 3 * COLUNAS_BLOCK_STAGGER);
    const starts = [1.6, 2.1, 2.6, 3.1];
    expect(colunasTotal(0, starts, 10)).toBe(0);
    expect(colunasTotal(1.8, starts, 10)).toBe(5);
    expect(colunasTotal(2.05, starts, 10)).toBe(10);
    expect(colunasTotal(9, starts, 10)).toBe(40);
    expect(colunasTotal(9, [1, 2, 3, 4, 5, 6], 500)).toBe(3000);
    expect(colunasCounterText(40, { suffix: ' h' })).toBe('40 h');
    expect(colunasCounterText(3000, { prefix: 'R$ ' })).toBe('R$ 3.000');
    expect(colunasCounterText(7, {})).toBe('7');
  });

  it('rótulo de coluna só aparece quando cabe embaixo dela', () => {
    expect(colunasShowLabels(origin.steps!, colunasLayout(4))).toBe(true);
    expect(colunasShowLabels(other.steps!, colunasLayout(6))).toBe(true);
    expect(colunasShowLabels(['primeira tentativa', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta'], colunasLayout(6))).toBe(false);
    expect(colunasShowLabels(['', ''], colunasLayout(2))).toBe(false);
  });

  it('cabe na área útil com as props da cena de origem, com outro assunto (6 colunas) e com o exemplo', () => {
    for (const props of [origin, other, colunasEntry.sample as ColunasComLinhaParadaProps, {}, { steps: ['a', 'b'], eyebrow: 'e' }]) {
      expect(fitsArea(colunasExtent(props)), JSON.stringify(colunasExtent(props))).toBe(true);
    }
  });
});

describe('DegrauEVao', () => {
  const origin: DegrauEVaoProps = {
    eyebrow: 'Tecnologias bem básicas',
    title: 'O básico não bastava.',
    base: { label: 'O que eu sabia', hint: 'HTML, CSS, JavaScript, PHP', icon: 'user' },
    wall: { label: 'O que o mercado pede' },
    gapLabel: 'grande dificuldade',
    closing: 'acabei sentindo',
    revealAt: { base: 0.4, wall: 2.0, gap: 3.4, closing: 5.2 },
  };
  const other: DegrauEVaoProps = {
    eyebrow: 'Do protótipo à produção',
    title: 'Funcionar no meu PC é só o começo.',
    base: { label: 'O protótipo', hint: 'roda local, com um usuário', icon: 'code' },
    wall: { label: 'Produção', items: ['login', 'backup', 'monitoramento', 'escala', 'suporte', 'custo'] },
    gapLabel: 'meses de trabalho',
  };

  it('sem itens, o paredão tem as 5 fiadas da cena de origem, com o nome no topo', () => {
    expect(degrauRowLabels(origin.wall!)).toEqual(['', '', '', '', 'O que o mercado pede']);
    const layout = degrauLayout(5);
    expect(layout.rows).toHaveLength(5);
    expect(layout.base).toEqual({ x: 0, y: 380, width: 580, height: 160 });
    expect(degrauRatio(layout)).toBeCloseTo(3.375);
  });

  it('itens viram fiadas de baixo para cima; de 3 a 7 fiadas', () => {
    expect(degrauRowLabels({ label: 'Topo', items: ['a', 'b', 'c'] })).toEqual(['a', 'b', 'c', 'Topo']);
    expect(degrauRowLabels({ label: 'Topo', items: ['a'] })).toEqual(['a', '', 'Topo']);
    expect(degrauRowLabels(other.wall!)).toHaveLength(DEGRAU_MAX_ROWS);
    expect(degrauRowLabels({ label: 'Topo', items: range(1, 12).map(String) })).toHaveLength(DEGRAU_MAX_ROWS);
    expect(degrauRowLabels({ label: 'Topo', items: range(1, 12).map(String) }).at(-1)).toBe('Topo');
    expect(degrauLayout(1).rows).toHaveLength(DEGRAU_MIN_ROWS);
    expect(degrauLayout(99).rows).toHaveLength(DEGRAU_MAX_ROWS);
  });

  it.each(range(DEGRAU_MIN_ROWS, DEGRAU_MAX_ROWS))('%i fiadas: empilham sem sobrepor, o vão vai do topo da base ao topo do paredão', (rows) => {
    const layout = degrauLayout(rows);
    layout.rows.forEach((row, index) => {
      expect(inside(row, layout.width, layout.height)).toBe(true);
      if (index > 0) expect(row.y + row.height).toBeLessThan(layout.rows[index - 1]!.y);
      expect(row.height).toBeGreaterThanOrEqual(MIN_TEXT * 1.5);
    });
    expect(layout.rows[0]!.y + layout.rows[0]!.height).toBeCloseTo(layout.height);
    expect(layout.rows.at(-1)!.y).toBeCloseTo(0);
    expect(layout.gap.from).toBe(layout.base.y);
    expect(layout.gap.to).toBe(0);
    expect(layout.gap.size).toBe(layout.base.y);
    // a régua e as pílulas ficam no corredor, sem tocar a base nem o paredão
    expect(layout.gap.x).toBeGreaterThan(layout.base.x + layout.base.width);
    expect(layout.gap.x).toBeLessThan(layout.wall.x);
    expect(layout.corridor.width).toBe(layout.wall.x - layout.base.width);
    expect(layout.person.center[1] - layout.person.size / 2).toBeGreaterThanOrEqual(0);
    expect(layout.closing[1]).toBeGreaterThan(layout.gap.label[1]);
  });

  it('tempos: partes por chave com padrão; fiadas em cascata ou sincronizadas com a fala', () => {
    expect(degrauReveal()).toEqual({ base: 0.4, wall: 2.0, gap: 3.4, closing: 5.2 });
    expect(degrauReveal({ gap: 9 })).toEqual({ base: 0.4, wall: 2.0, gap: 9, closing: 5.2 });
    const cascade = degrauRowTimes(2, 5);
    expect(cascade[0]).toBe(2);
    expect(cascade[4]).toBeCloseTo(2 + 4 * DEGRAU_ROW_STAGGER);
    expect(degrauRowTimes(2, 4, [2.5, 3.5])).toEqual([2.5, 3.5, 3.5 + DEGRAU_ROW_STAGGER, 3.5 + 2 * DEGRAU_ROW_STAGGER].map((value) => expect.closeTo(value, 6)));
  });

  it('rótulos do corredor cabem entre a base e o paredão', () => {
    const room = degrauLayout(5).corridor.width - 40;
    for (const label of ['grande dificuldade', 'meses de trabalho', 'muito chão']) expect(pillWidth(label, fitPill(label, room))).toBeLessThanOrEqual(room);
    expect(pillWidth('acabei sentindo', fitPill('acabei sentindo', room, 36, 'icon'), 'icon')).toBeLessThanOrEqual(room);
  });

  it('cabe na área útil com as props da cena de origem, com outro assunto (7 fiadas) e com o exemplo', () => {
    for (const props of [origin, other, degrauEntry.sample as DegrauEVaoProps, {}]) expect(fitsArea(degrauExtent(props)), JSON.stringify(degrauExtent(props))).toBe(true);
  });
});

describe('FileiraDeItens', () => {
  const alfred: FileiraDeItensProps = {
    eyebrow: 'Digital Innovation One',
    title: 'DIO — o meu Alfred',
    accent: 'Alfred',
    titleAt: 0.3,
    figure: 'tray',
    host: { icon: 'bell', label: 'ao meu dispor', at: 2.0 },
    items: [{ label: 'Cursos', icon: 'book' }, { label: 'Bootcamps', icon: 'flag' }, { label: 'Comunidade', icon: 'users' }, { label: 'Mentoria', icon: 'chat' }],
    revealAt: [3.4, 4.0, 4.6, 5.2],
    closing: 'tudo que eu precisava',
    closingAt: 5.8,
  };
  const liga: FileiraDeItensProps = {
    eyebrow: 'Cada um com o seu poder',
    title: 'Liga dos Devs',
    accent: 'Devs',
    titleAt: 3.0,
    figure: 'hero',
    items: [{ label: 'Front-end', icon: 'browser' }, { label: 'Back-end', icon: 'server' }, { label: 'Mobile', icon: 'phone' }, { label: 'Dados', icon: 'database' }, { label: 'DevOps', icon: 'cloud' }],
    revealAt: [0.5, 0.9, 1.3, 1.7, 2.1],
    closing: 'crescendo juntos',
    closingAt: 4.6,
    rising: true,
  };
  const other: FileiraDeItensProps = {
    title: 'Dois caminhos.',
    figure: 'card',
    items: [{ label: 'Faculdade', hint: 'quatro anos', icon: 'book' }, { label: 'Curso livre', hint: 'seis meses', icon: 'bolt' }],
    closing: 'os dois funcionam',
  };

  it('bandeja com 4 itens e quem serve: o desenho da cena de origem', () => {
    const layout = fileiraLayout(4, 'tray', { host: true });
    expect(layout.host).toEqual({ size: 200, center: [100, 100], labelY: 218 });
    expect(layout.tray).toEqual({ x: 264, y: 286, width: 1464, lip: 18 });
    expect(layout.slots[0]).toEqual({ x: 292, width: 331, height: 268, scale: 1 });
    expect(layout.badge).toBe(112);
    expect(fileiraTrayPath(layout.tray!)).toBe('M264 286 q0 18 18 18 H1710 q18 0 18 -18');
  });

  it('time de 5: a figura do meio é a maior e as das pontas diminuem', () => {
    const layout = fileiraLayout(5, 'hero');
    expect(layout.slots.map((slot) => slot.scale)).toEqual([0.86, 0.93, 1, 0.93, 0.86].map((value) => expect.closeTo(value, 5)));
    expect(layout.slots[0]!.width).toBe(300);
    expect(layout.height).toBeCloseTo(300 * 0.8 * 1.3 + 94);
    expect(layout.tray).toBeUndefined();
    expect(layout.host).toBeUndefined();
  });

  const figures: FileiraFigure[] = ['card', 'tray', 'hero'];
  it.each(figures.flatMap((figure) => range(FILEIRA_MIN, FILEIRA_MAX).map((count) => [figure, count] as [FileiraFigure, number])))('%s com %i itens: centralizada, sem sobrepor, dentro da largura útil', (figure, count) => {
    for (const host of [false, true]) {
      for (const hint of [false, true]) {
        const layout = fileiraLayout(count, figure, { host, hint });
        expect(layout.slots).toHaveLength(count);
        layout.slots.forEach((slot, index) => {
          expect(slot.x).toBeGreaterThanOrEqual(0);
          expect(slot.x + slot.width).toBeLessThanOrEqual(AREA.width + 0.001);
          if (index > 0) expect(slot.x).toBeGreaterThan(layout.slots[index - 1]!.x + layout.slots[index - 1]!.width);
          expect(slot.width).toBeGreaterThanOrEqual(240);
        });
        expect(layout.span.from).toBeGreaterThanOrEqual(-0.001);
        expect(layout.span.to).toBeLessThanOrEqual(AREA.width + 0.001);
        expect(layout.span.from + layout.span.to).toBeCloseTo(AREA.width, 0);
        if (figure !== 'hero') expect(layout.slots[0]!.width).toBeLessThanOrEqual(420);
        if (layout.tray) {
          expect(layout.tray.x).toBeLessThan(layout.slots[0]!.x);
          expect(layout.tray.x + layout.tray.width).toBeGreaterThan(layout.slots.at(-1)!.x + layout.slots.at(-1)!.width);
          expect(layout.tray.y).toBeGreaterThan(layout.slots[0]!.height);
        }
        // quem serve só existe na bandeja, e fica à esquerda dela
        expect(Boolean(layout.host)).toBe(figure === 'tray' && host);
        if (layout.host) expect(layout.host.center[0] + layout.host.size / 2).toBeLessThan(layout.tray!.x);
        for (const closing of [false, true]) {
          for (const rising of [false, true]) expect(fileiraBlocks(layout, { eyebrow: true, closing, rising }).total).toBeLessThanOrEqual(AREA.height);
        }
      }
    }
  });

  it('limites e figura inválida', () => {
    expect(fileiraLayout(1, 'card').slots).toHaveLength(FILEIRA_MIN);
    expect(fileiraLayout(12, 'hero').slots).toHaveLength(FILEIRA_MAX);
    expect(fileiraLayout(5, 'card').badge).toBe(96);
    expect(isFileiraFigure('tray')).toBe(true);
    expect(isFileiraFigure('bandeja')).toBe(false);
    expect(isFileiraFigure(undefined)).toBe(false);
    expect(fileiraExtent({ figure: 'bandeja' as FileiraFigure })).toEqual(fileiraExtent({ figure: 'card' }));
  });

  it('tempos, toque de quem serve e balanço da capa', () => {
    expect(fileiraTimes(4, alfred.revealAt)).toEqual([3.4, 4.0, 4.6, 5.2]);
    expect(fileiraTimes(3, [1])).toEqual([1, 1.5, 2]);
    expect(fileiraTimes(9)).toHaveLength(FILEIRA_MAX);
    const times = [3.4, 4.0];
    expect(fileiraDing(3.3, times)).toBe(0);
    expect(fileiraDing(3.4, times)).toBe(1);
    expect(fileiraDing(3.65, times)).toBeCloseTo(0.5);
    expect(fileiraDing(3.95, times)).toBe(0);
    expect(fileiraDing(4.0, times)).toBe(1);
    expect(Math.abs(fileiraCapeSway(17, 30, 2))).toBeLessThanOrEqual(5);
    expect(fileiraCapeSway(17, 30, 0)).not.toBe(fileiraCapeSway(17, 30, 1));
    expect(fileiraCapeSway(17, 30, 1)).toBe(fileiraCapeSway(17, 30, 1));
  });

  it('a pilha se recentra: só o título, só a fileira, e os dois na posição final', () => {
    const blocks = fileiraBlocks(fileiraLayout(4, 'tray', { host: true }), { eyebrow: true, closing: true });
    expect(blocks.total).toBe(blocks.title + blocks.gap + blocks.row + blocks.gap + blocks.closing);
    expect(fileiraShift(1, 1, blocks)).toBe(0);
    // só o título: ele desce até o meio
    expect(fileiraShift(1, 0, blocks)).toBe((blocks.total - blocks.title) / 2);
    // só a fileira (o título vem depois): ela sobe o que o título ocuparia, pela metade
    expect(fileiraShift(0, 1, blocks)).toBe(-(blocks.title + blocks.gap) / 2);
    expect(fileiraShift(0.5, 1, blocks)).toBeCloseTo(-(blocks.title + blocks.gap) / 4);
    expect(fileiraBlocks(fileiraLayout(3, 'card'), {}).closing).toBe(0);
    expect(fileiraBlocks(fileiraLayout(3, 'card'), { closing: true, rising: true }).closing).toBe(96);
    expect(fileiraBlocks(fileiraLayout(3, 'card'), { eyebrow: true }).title).toBeGreaterThan(fileiraBlocks(fileiraLayout(3, 'card'), {}).title);
  });

  it('nome do item: encolhe até a maior palavra caber no cartão', () => {
    const wide = fileiraLayout(4, 'tray', { host: true }).slots[0]!.width;
    const narrow = fileiraLayout(5, 'tray', { host: true }).slots[0]!.width;
    expect(fileiraLabelSize(['Cursos', 'Bootcamps', 'Comunidade', 'Mentoria'], wide)).toBe(40);
    const small = fileiraLabelSize(['Cursos', 'Bootcamps', 'Comunidade', 'Mentoria', 'Certificados'], narrow);
    expect(small).toBeLessThan(40);
    expect(small).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fileiraLabelSize(['Internacionalização'], 260)).toBe(MIN_TEXT);
  });

  it('cabe na área útil com as props das duas cenas de origem, com outro assunto (2 itens) e com o exemplo', () => {
    for (const props of [alfred, liga, other, fileiraEntry.sample as FileiraDeItensProps, {}]) expect(fitsArea(fileiraExtent(props)), JSON.stringify(fileiraExtent(props))).toBe(true);
    expect(fileiraExtent(liga).width).toBe(5 * 300 + 4 * 36);
    expect(fileiraExtent(other).width).toBe(2 * 420 + 28);
  });
});

describe('HubComSatelites', () => {
  const tudo: HubComSatelitesProps = {
    eyebrow: 'Digital Innovation One',
    title: 'Tudo isso, num lugar só.',
    accent: 'num lugar só',
    hub: { label: 'DIO' },
    satellites: [
      { title: 'Cursos', hint: 'back-end, front-end, mobile', icon: 'book' },
      { title: 'bootcamps', value: 174, icon: 'flag' },
      { title: 'Artigos', hint: 'da comunidade', icon: 'file' },
      { title: 'Ranking', hint: 'com prêmios', icon: 'trophy' },
    ],
    revealAt: [1.0, 1.5, 2.0, 2.5],
  };
  const fullStack: HubComSatelitesProps = {
    eyebrow: 'Dev full stack',
    title: 'Uma pessoa, as duas pontas.',
    accent: 'as duas pontas',
    hub: { icon: 'user' },
    hubAt: 0.9,
    satellites: [
      { title: 'Front-end', hint: 'O que você vê: as telinhas bonitas.', icon: 'browser' },
      { title: 'Back-end', hint: 'O que roda por trás: regras e banco de dados.', icon: 'database' },
    ],
    revealAt: [3.0, 4.3],
    showCount: false,
    closing: 'faz os dois',
    closingAt: 5.4,
  };
  const other: HubComSatelitesProps = {
    title: 'Seis áreas, um prontuário.',
    hub: { icon: 'file' },
    satellites: ['Recepção', 'Triagem', 'Consulta', 'Exames', 'Farmácia', 'Cobrança'].map((title) => ({ title })),
  };

  it('com 4 partes reproduz o hub da cena de origem: um cartão em cada canto', () => {
    const layout = hubLayout(4);
    expect(layout.card).toMatchObject({ width: 610, height: 236, badge: 120, vertical: false, hintLines: 2 });
    expect(layout.nodes.map((node) => [node.x, node.y])).toEqual([[0, 0], [1118, 0], [0, 288], [1118, 288]]);
    expect(layout.nodes.map((node) => node.link.bend)).toEqual([14, -14, -14, 14]);
    expect(layout.hub.center).toEqual([864, 262]);
  });

  it('com 2 partes vira "um no meio, duas pontas": cartões altos e setas retas', () => {
    const layout = hubLayout(2);
    expect(layout.card.vertical).toBe(true);
    expect(layout.card.height).toBe(400);
    expect(layout.nodes.map((node) => node.side)).toEqual(['left', 'right']);
    for (const node of layout.nodes) {
      expect(node.link.bend).toBe(0);
      expect(node.link.from[1]).toBeCloseTo(layout.hub.center[1]);
      expect(node.y + layout.card.height / 2).toBeCloseTo(layout.hub.center[1]);
    }
    expect(layout.pillRoom).toBeGreaterThan(hubLayout(4).pillRoom);
  });

  it.each(range(HUB_MIN, HUB_MAX))('%i partes: cartões dentro do palco, sem sobrepor, e ligações saindo da borda do centro', (count) => {
    const layout = hubLayout(count);
    expect(layout.nodes).toHaveLength(count);
    expect(layout.nodes.filter((node) => node.side === 'left')).toHaveLength(Math.ceil(count / 2));
    layout.nodes.forEach((node, index) => {
      expect(inside({ x: node.x, y: node.y, width: layout.card.width, height: layout.card.height }, layout.width, layout.height)).toBe(true);
      // ordem da fala: esquerda, direita, esquerda…
      expect(node.side).toBe(index % 2 === 0 ? 'left' : 'right');
      const below = layout.nodes[index + 2];
      if (below) expect(below.y).toBeGreaterThanOrEqual(node.y + layout.card.height + 28 - 0.001);
      const [fx, fy] = node.link.from;
      expect(Math.hypot(fx - layout.hub.center[0], fy - layout.hub.center[1])).toBeCloseTo(layout.hub.ring + 12);
      // a seta termina no corredor, antes de tocar o cartão
      expect(node.side === 'left' ? node.link.to[0] : layout.width - node.link.to[0]).toBeGreaterThan(layout.card.width);
    });
    expect(layout.corridor).toBeGreaterThan(layout.hub.ring * 2 + 100);
    expect(layout.card.height).toBeGreaterThanOrEqual(150);
    expect(layout.card.badge).toBeLessThan(layout.card.height - 40);
    expect(hubTextRoom(layout, true)).toBeGreaterThan(300);
    expect(hubTextRoom(layout, false)).toBeGreaterThanOrEqual(hubTextRoom(layout, true));
    expect(layout.pillY).toBeGreaterThan(layout.hub.center[1] + layout.hub.ring);
  });

  it('limites, tempos e contagem', () => {
    expect(hubLayout(1).nodes).toHaveLength(HUB_MIN);
    expect(hubLayout(20).nodes).toHaveLength(HUB_MAX);
    expect(hubLayout(5).card.hintLines).toBe(1);
    expect(hubTimes(4, tudo.revealAt)).toEqual([1.0, 1.5, 2.0, 2.5]);
    expect(hubTimes(3, [2])).toEqual([2, 2.5, 3]);
    expect(hubConnected(0.9, [1, 1.5, 2])).toBe(0);
    expect(hubConnected(1.5, [1, 1.5, 2])).toBe(2);
    expect(hubCountLabel(2, 4)).toBe('2 de 4');
    expect(hubCountLabel(9, 6)).toBe('6 de 6');
    expect(hubCountLabel(-1, 3)).toBe('0 de 3');
  });

  it('os textos das cenas de origem cabem nos cartões', () => {
    const four = hubLayout(4);
    for (const satellite of tudo.satellites!) expect(textWidth(satellite.title, 60, 0.52)).toBeLessThanOrEqual(hubTextRoom(four, true));
    expect(lineCount('back-end, front-end, mobile', hubTextRoom(four, true), 36)).toBeLessThanOrEqual(four.card.hintLines);
    const two = hubLayout(2);
    for (const satellite of fullStack.satellites!) expect(lineCount(satellite.hint!, hubTextRoom(two, true), 36)).toBeLessThanOrEqual(two.card.hintLines);
    expect(pillWidth('faz os dois', fitPill('faz os dois', two.pillRoom, 36, 'dot'), 'dot')).toBeLessThanOrEqual(two.pillRoom);
  });

  it('cabe na área útil com as props das duas cenas de origem, com outro assunto (6 partes) e com o exemplo', () => {
    for (const props of [tudo, fullStack, other, hubEntry.sample as HubComSatelitesProps, {}]) expect(fitsArea(hubExtent(props)), JSON.stringify(hubExtent(props))).toBe(true);
  });
});

describe('CartaoComContadoresESelo', () => {
  const origin: CartaoComContadoresESeloProps = {
    eyebrow: 'Artigos da comunidade',
    card: { author: 'Matheus Chiodi', title: 'O que eu aprendi estudando back-end', statusBefore: 'rascunho', statusAfter: 'publicado', action: 'Publicar', actionDone: 'Publicado' },
    counters: [
      { label: 'leituras', value: 1248, icon: 'eye' },
      { label: 'curtidas', value: 312, icon: 'heart' },
      { label: 'comentários', value: 47, icon: 'chat' },
    ],
    seal: { text: 'Reconhecido pelo que eu estudei.', icon: 'award' },
    revealAt: { card: 0.4, action: 2.2, counters: 3.8, seal: 6.0 },
  };
  const other: CartaoComContadoresESeloProps = {
    card: { title: 'Inscrições para a turma de março', action: 'Abrir inscrições', actionDone: 'Inscrições abertas', statusBefore: 'em breve', statusAfter: 'aberto' },
    counters: [{ label: 'inscritos em uma hora', value: 500, suffix: '+' }],
  };

  it('com 3 contadores reproduz as medidas da cena de origem', () => {
    const layout = cartaoLayout(3);
    expect(layout).toEqual({ width: 1464, height: 548, card: { width: 880, height: 548 }, stat: { width: 520, height: 164, gap: 28, badge: 96, fontSize: 64 }, gap: 64 });
  });

  it.each(range(1, CARTAO_MAX_COUNTERS))('%i contador(es): a coluna cabe na altura do cartão', (count) => {
    const layout = cartaoLayout(count);
    expect(layout.stat.height * count + layout.stat.gap * (count - 1)).toBeLessThanOrEqual(layout.height);
    expect(layout.stat.height).toBeGreaterThanOrEqual(110);
    expect(layout.stat.height).toBeLessThanOrEqual(200);
    expect(layout.stat.badge).toBeLessThanOrEqual(layout.stat.height - 36);
    // número + rótulo cabem na altura do cartãozinho
    expect(layout.stat.fontSize + 6 + MIN_TEXT * 1.2).toBeLessThanOrEqual(layout.stat.height - 8);
    expect(layout.width).toBeLessThanOrEqual(AREA.width);
  });

  it('limites: de 1 a 4 contadores', () => {
    expect(cartaoLayout(0)).toEqual(cartaoLayout(1));
    expect(cartaoLayout(9)).toEqual(cartaoLayout(CARTAO_MAX_COUNTERS));
    expect(cartaoSchedule(3, 6, 9)).toHaveLength(CARTAO_MAX_COUNTERS);
  });

  it('o botão afunda, troca de estado no meio do aperto e fica no estado final', () => {
    expect(cartaoPhase(2.1, 2.2)).toEqual({ press: 0, swap: 0, done: false });
    const middle = cartaoPhase(2.36, 2.2);
    expect(middle.press).toBeGreaterThan(0.9);
    expect(middle.done).toBe(true);
    expect(middle.swap).toBeLessThan(0.1);
    expect(cartaoPhase(2.3, 2.2).done).toBe(false);
    expect(cartaoPhase(3, 2.2)).toEqual({ press: 0, swap: 1, done: true });
  });

  it('tempos: partes por chave, linhas do corpo antes do aperto, contadores terminando antes do selo', () => {
    expect(cartaoReveal()).toEqual({ card: 0.4, action: 2.2, counters: 3.8, seal: 6.0 });
    expect(cartaoReveal({ seal: 9 }).seal).toBe(9);
    const lines = cartaoBodyTimes(0.4, 2.2);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBeCloseTo(0.9);
    expect(lines.at(-1)!).toBeLessThanOrEqual(2.2 - 0.5 + 0.001);
    expect(cartaoBodyTimes(0.4, 0.5)).toEqual([0.9, 0.9, 0.9]);
    const schedule = cartaoSchedule(3.8, 6, 3);
    expect(schedule.map((slot) => slot.atSec)).toEqual([3.8, 4.05, 4.3]);
    for (const slot of schedule) expect(slot.atSec + slot.durationSec).toBeCloseTo(5.8);
    expect(cartaoSchedule(3.8, 3.9, 2).every((slot) => slot.durationSec >= 0.6)).toBe(true);
  });

  it('textos: número com prefixo e sufixo, título longo desce de corpo, botão cresce com o texto', () => {
    expect(cartaoCounterText({ value: 1248 })).toBe('1.248');
    expect(cartaoCounterText({ value: 12880, prefix: 'R$ ' })).toBe('R$ 12.880');
    expect(cartaoCounterText({ value: 500, suffix: '+' })).toBe('500+');
    expect(cartaoTitleSize('O que eu aprendi estudando back-end')).toBe(54);
    expect(cartaoTitleSize('Um título de cartão bem comprido, daqueles que explicam a ideia inteira antes de alguém abrir o texto')).toBe(46);
    expect(cartaoButtonWidth('Publicar', 'Publicado')).toBe(320);
    expect(cartaoButtonWidth('Abrir inscrições', 'Inscrições abertas')).toBeGreaterThan(320);
    expect(cartaoButtonWidth('Abrir inscrições', 'Inscrições abertas')).toBeLessThan(880 - 88);
  });

  it('cabe na área útil com as props da cena de origem, com outro assunto (1 contador, sem selo) e com o exemplo (4)', () => {
    for (const props of [origin, other, cartaoEntry.sample as CartaoComContadoresESeloProps, {}]) expect(fitsArea(cartaoExtent(props)), JSON.stringify(cartaoExtent(props))).toBe(true);
    expect(cartaoExtent(other).height).toBe(548);
    expect(cartaoExtent(origin).height).toBeGreaterThan(cartaoExtent({ ...origin, seal: undefined }).height);
  });
});

describe('TrocaEntreDoisPolos', () => {
  const origin: TrocaEntreDoisPolosProps = {
    eyebrow: 'A herança do back-end',
    left: { label: 'Front-end', icon: 'browser' },
    right: { label: 'Back-end', icon: 'server' },
    goLabel: 'enviar os dados',
    backLabel: 'receber os dados',
    title: 'E entender o porquê.',
    accent: 'o porquê',
    support: 'Quem já fez o back sabe por que o dado vai e volta.',
    revealAt: { go: 0.9, back: 1.75, closing: 4.0 },
  };
  const other: TrocaEntreDoisPolosProps = {
    left: { label: 'Aluno', icon: 'user' },
    right: { label: 'Mentor', icon: 'users' },
    goLabel: 'a dúvida',
    backLabel: 'o caminho, não a resposta pronta',
  };

  it('reproduz o diagrama da cena de origem: ida por cima, volta por baixo', () => {
    const layout = trocaLayout();
    expect(layout.left).toEqual([88, 128]);
    expect(layout.right).toEqual([1232, 128]);
    expect(layout.go.from[0]).toBeLessThan(layout.go.to[0]);
    expect(layout.back.from[0]).toBeGreaterThan(layout.back.to[0]);
    expect(layout.go.label[1]).toBeLessThan(layout.left[1]);
    expect(layout.back.label[1]).toBeGreaterThan(layout.left[1]);
    expect(layout.go.label[0]).toBe(layout.width / 2);
    expect(layout.height).toBe(292);
    expect(layout.labelY).toBeGreaterThan(layout.left[1] + layout.badge / 2);
    expect(layout.labelY + 44).toBeLessThanOrEqual(layout.height);
    // as setas começam fora dos discos
    expect(layout.go.from[0]).toBeGreaterThan(layout.left[0] + layout.badge / 2);
    expect(layout.go.to[0]).toBeLessThan(layout.right[0] - layout.badge / 2);
    expect(layout.between).toBe(layout.go.to[0] - layout.go.from[0]);
  });

  it('o diagrama acompanha a largura pedida', () => {
    for (const width of [900, 1320, 1500]) {
      const layout = trocaLayout(width);
      expect(layout.right[0] + layout.badge / 2).toBe(width);
      expect(layout.between).toBeGreaterThan(400);
    }
  });

  it('tempos por chave, com padrão', () => {
    expect(trocaReveal()).toEqual({ go: 0.9, back: 1.75, closing: 4.0 });
    expect(trocaReveal({ back: 3 })).toEqual({ go: 0.9, back: 3, closing: 4.0 });
  });

  it('frase de fecho: sem ela o diagrama não se mexe; com ela, começa no centro e sobe', () => {
    expect(trocaClosingHeight(undefined)).toBe(0);
    expect(trocaLift(0, 0)).toBe(0);
    const height = trocaClosingHeight(origin.title, origin.support);
    expect(height).toBeGreaterThan(trocaClosingHeight(origin.title));
    expect(trocaLift(1, height)).toBe(0);
    expect(trocaLift(0, height)).toBe((height + 52) / 2);
    expect(trocaClosingHeight('Uma frase de fecho comprida o bastante para precisar de duas linhas inteiras nesta cena de troca.')).toBeGreaterThan(trocaClosingHeight('Curta.'));
  });

  it('os rótulos das setas cabem entre os dois polos', () => {
    const room = trocaLayout().between - 120;
    for (const label of [origin.goLabel!, origin.backLabel!, other.backLabel!, 'manda o pull request', 'devolve os comentários']) {
      expect(pillWidth(label, fitPill(label, room)), label).toBeLessThanOrEqual(room);
    }
  });

  it('cabe na área útil com as props da cena de origem, com outro assunto (sem fecho) e com o exemplo', () => {
    for (const props of [origin, other, trocaEntry.sample as TrocaEntreDoisPolosProps, {}]) expect(fitsArea(trocaExtent(props)), JSON.stringify(trocaExtent(props))).toBe(true);
    expect(trocaExtent(other).height).toBe(292);
    expect(trocaExtent(origin).height).toBeGreaterThan(trocaExtent({ ...origin, support: undefined }).height);
  });
});
