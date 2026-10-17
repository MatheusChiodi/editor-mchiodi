import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LAST_ENTRY_SEC, minReadSec, readWords } from '../motion/src/components/read-time.ts';
import { minReadSec as kitMinReadSec } from '../motion/src/components/stage-kit.tsx';
import { formatLevels, LAYOUT_LEAD_SEC, LEVELS, type LevelId } from '../src/edl/levels.ts';
import { edlSchema, parseEdl } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { levelCoverage, lintStyle, overlayCues, type TimedWord } from '../src/eval/checks.ts';
import {
  alignPhrase,
  breatherSpans,
  captionClash,
  findOffSync,
  findShortReads,
  findStackedBreathers,
  findStalls,
  formatBreathers,
  namedCues,
  phraseTokens,
  readItems,
  readShortfall,
  spanToOutput,
  spanToSource,
  spokenWords,
  SYNC_SLACK_SEC,
  syncMiss,
  undeclaredStalls,
} from '../src/eval/direction.ts';
import { script } from './helpers.ts';

const MAX = LEVELS.max.limits.syncWindowSec!;

function edlWith(extra: Record<string, unknown> = {}, level: LevelId = 'max') {
  return edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-12T00:00:00.000Z',
    level,
    source: { path: 'C:/v.mp4', durationSec: 200, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [{ id: 'c1', start: 0, end: 200 }],
    ...extra,
  });
}

type TestEdl = ReturnType<typeof edlWith>;
const timelineOf = (edl: TestEdl) => buildTimeline(edl.clips, edl.output.fps);
const only = (edl: TestEdl, check: string, words?: TimedWord[]) => lintStyle(edl, timelineOf(edl), undefined, undefined, words).filter((finding) => finding.check === check);
const pills = (id: string, at: number, duration: number, items: unknown[], extra: Record<string, unknown> = {}) => ({ id, component: 'PillStack', at, duration, reason: 'resume a ideia', props: { items }, ...extra });

/** Vídeo de 200s com uma pílula de 4s a cada 5s dentro de cada intervalo: fora deles, nada acontece. */
function edited(spans: [number, number][], extra: Record<string, unknown> = {}, level: LevelId = 'max') {
  const overlays = spans.flatMap(([from, to], span) =>
    Array.from({ length: Math.floor((to - from) / 5) }, (_, index) => pills(`p${span}-${index}`, from + index * 5, 4, [{ text: 'ideia', at: 0.2 }])),
  );
  return edlWith({ overlays, ...extra }, level);
}

describe('namedCues', () => {
  it('devolve cada instante com a prop de onde veio, em ordem de tempo', () => {
    const cues = namedCues({
      items: [{ text: 'a', at: 1 }, { text: 'b', at: 3, strikeAt: 4 }],
      revealAt: [2, 5],
      markAt: 6,
      note: { text: 'n', at: 7 },
      wordAt: [0.5],
      title: 'x',
    });
    expect(cues).toEqual([
      { path: 'wordAt[0]', at: 0.5 },
      { path: 'items[0].at', at: 1 },
      { path: 'revealAt[0]', at: 2 },
      { path: 'items[1].at', at: 3 },
      { path: 'items[1].strikeAt', at: 4 },
      { path: 'revealAt[1]', at: 5 },
      { path: 'markAt', at: 6 },
      { path: 'note.at', at: 7 },
    ]);
  });

  it('acha o registro de instantes das cenas e cues em profundidade', () => {
    expect(namedCues({ revealAt: { html: 0.8, css: 1.5 }, push: { at: 2, scale: 1.2 }, columns: [{ rows: [{ label: 'x', at: 3 }] }] })).toEqual([
      { path: 'revealAt.html', at: 0.8 },
      { path: 'revealAt.css', at: 1.5 },
      { path: 'push.at', at: 2 },
      { path: 'columns[0].rows[0].at', at: 3 },
    ]);
  });

  it('ignora o que não é instante: negativo, texto, número em chave comum', () => {
    expect(namedCues({ items: ['a', 'b'], values: [1, 2, 3], at: -1, scale: 2, format: 'x', markAt: 'já' })).toEqual([]);
    expect(namedCues({})).toEqual([]);
  });

  it('overlayCues continua devolvendo só os instantes, agora com o registro das cenas', () => {
    expect(overlayCues({ revealAt: { b: 2, a: 1 }, note: { at: 3 } })).toEqual([1, 2, 3]);
  });
});

describe('spokenWords', () => {
  it('leva as palavras para o tempo do vídeo final e descarta as cortadas', () => {
    const timeline = buildTimeline([{ id: 'a', start: 0, end: 20 }, { id: 'b', start: 30, end: 60 }], 30);
    const spoken = spokenWords([...script('fica', 5), ...script('cortada', 24), ...script('volta', 31)], timeline);
    expect(spoken.map((word) => [word.text, word.start])).toEqual([['fica', 5], ['volta', 21]]);
  });
});

describe('syncMiss', () => {
  // um 10.00–10.30 · dois 10.35–10.65 · três 10.70–11.00
  const spoken = spokenWords(script('um dois três', 10), buildTimeline([{ id: 'c', start: 0, end: 100 }], 30));

  it('passa dentro da janela [início − antes; início + depois] de alguma palavra', () => {
    for (const time of [10, 9.85, 10.1, 10.35, 10.2, 10.45]) expect(syncMiss(time, spoken, MAX), String(time)).toBeNull();
  });

  it('meio frame de folga nas bordas: o cue é arredondado para a grade no render', () => {
    expect(syncMiss(10.1 + SYNC_SLACK_SEC - 0.001, spoken, MAX)).toBeNull();
    expect(syncMiss(10.5, spoken, MAX)).not.toBeNull();
  });

  it('fora da janela, devolve a palavra de início mais próximo e a distância', () => {
    const late = syncMiss(10.5, spoken, MAX)!;
    expect(late.word.text).toBe('dois');
    expect(late.delta).toBeCloseTo(0.15, 5);
    const early = syncMiss(10.52, spoken, MAX)!;
    expect(early.word.text).toBe('dois');
    // janela mais larga (nível pro) aceita o mesmo instante
    expect(syncMiss(10.5, spoken, LEVELS.pro.limits.syncWindowSec!)).toBeNull();
  });

  it('entrada em pausa de mais de 0,6s não é erro de sincronia; em pausa curta, é', () => {
    const paused = spokenWords(script('um dois |1.2 três', 10), buildTimeline([{ id: 'c', start: 0, end: 100 }], 30));
    expect(syncMiss(11, paused, MAX)).toBeNull();
    expect(syncMiss(11.4, paused, MAX)).toBeNull();
    const short = spokenWords(script('um dois |0.3 três', 10), buildTimeline([{ id: 'c', start: 0, end: 100 }], 30));
    const miss = syncMiss(10.8, short, MAX)!;
    expect(miss.word.text).toBe('três');
    expect(miss.delta).toBeCloseTo(-0.2, 5);
  });

  it('antes da primeira fala, depois da última e sem palavras: nada a cobrar', () => {
    expect(syncMiss(2, spoken, MAX)).toBeNull();
    expect(syncMiss(50, spoken, MAX)).toBeNull();
    expect(syncMiss(10.5, [], MAX)).toBeNull();
  });
});

describe('fora-de-sincronia', () => {
  const words = script('um dois três quatro cinco seis', 10);

  it('cues em cima das palavras passam', () => {
    const edl = edlWith({ overlays: [pills('p', 9.8, 6, [{ text: 'a', at: 0.2 }, { text: 'b', at: 0.55 }, { text: 'c', at: 1.6 }])] });
    expect(findOffSync(edl, timelineOf(edl), words, MAX)).toEqual([]);
  });

  it('um achado por overlay, listando cada cue fora e o valor novo', () => {
    const edl = edlWith({
      overlays: [
        pills('p', 9.8, 6, [{ text: 'a', at: 0.2 }, { text: 'b', at: 0.7 }, { text: 'c', at: 0.9, strikeAt: 1.42 }]),
        pills('q', 20, 6, [{ text: 'longe da fala', at: 1 }]),
      ],
    });
    const findings = findOffSync(edl, timelineOf(edl), words, MAX);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'warning', check: 'fora-de-sincronia', at: 9.8 });
    // 9.8 + 0.7 = 10.50: 0.15s depois de "dois" (10.35); o ajuste é o início da palavra − 2 frames
    expect(findings[0]!.message).toBe('"p": 2 de 4 entradas fora da palavra (janela −0.15s/+0.10s): items[1].at 0.15s depois de "dois", items[2].strikeAt 0.17s depois de "quatro"');
    expect(findings[0]!.fix).toBe('acerte pelo início da palavra (pnpm mce words): items[1].at 0.70 → 0.48; items[2].strikeAt 1.42 → 1.18');
  });

  it('cue em pausa não avisa; cue depois do fim do overlay não é conferido', () => {
    const paused = script('um dois |1.5 três', 10);
    const edl = edlWith({ overlays: [pills('p', 9.8, 3, [{ text: 'a', at: 0.2 }, { text: 'respiro', at: 1.4 }, { text: 'nunca aparece', at: 9 }])] });
    expect(findOffSync(edl, timelineOf(edl), paused, MAX)).toEqual([]);
  });

  it('overlay sem cues: só o `at` é conferido, com o adiantamento de troca de layout', () => {
    const spaced: TimedWord[] = [{ text: 'palavra', start: 10, end: 10.9 }, { text: 'seguinte', start: 11, end: 11.3 }];
    const card = (at: number) => edlWith({ overlays: [{ id: 'nome', component: 'LowerThird', at, duration: 3, reason: 'apresenta', props: { title: 'Matheus' } }] });
    for (const at of [9.75, 9.85, 10, 10.1]) expect(findOffSync(card(at), timelineOf(card(at)), spaced, MAX), String(at)).toEqual([]);
    expect(MAX.before + LAYOUT_LEAD_SEC).toBeCloseTo(0.25);
    const [finding] = findOffSync(card(10.4), timelineOf(card(10.4)), spaced, MAX);
    expect(finding!.message).toBe('"nome": 1 de 1 entradas fora da palavra (janela −0.15s/+0.10s): at 0.40s depois de "palavra"');
    expect(finding!.fix).toBe('acerte pelo início da palavra (pnpm mce words): at 10.40 → 9.85');
  });

  it('quando o `at` muda, os cues fora já vêm relativos ao novo início e os outros ganham a compensação', () => {
    const spaced: TimedWord[] = [{ text: 'palavra', start: 10, end: 10.9 }, { text: 'seguinte', start: 11, end: 11.3 }, { text: 'longa', start: 11.5, end: 12.4 }];
    const edl = edlWith({
      overlays: [{ id: 'doc', component: 'DocQuote', at: 10.4, duration: 5, reason: 'fonte', props: { text: 'x', markAt: 0.6, note: { text: 'n', at: 1.6 } } }],
    });
    const [finding] = findOffSync(edl, timelineOf(edl), spaced, MAX);
    expect(finding!.message).toContain('2 de 3 entradas');
    expect(finding!.message).toContain('note.at 0.50s depois de "longa"');
    // novo início 9.85; "longa" em 11.50 − 0.07 − 9.85 = 1.58
    expect(finding!.fix).toBe('acerte pelo início da palavra (pnpm mce words): at 10.40 → 9.85; note.at 1.60 → 1.58; como o "at" muda, some 0.55 aos outros cues deste overlay');
  });

  it('pilha sem palavra-título: o `at` só escurece o canto e não é cobrado; com título, é', () => {
    const spaced: TimedWord[] = [{ text: 'palavra', start: 10, end: 10.9 }, { text: 'seguinte', start: 11, end: 11.3 }];
    const stack = (props: Record<string, unknown>) => edlWith({ overlays: [{ id: 'p', component: 'PillStack', at: 10.4, duration: 5, reason: 'r', props }] });
    const plain = stack({ items: [{ text: 'a', at: 0.6 }] });
    expect(findOffSync(plain, timelineOf(plain), spaced, MAX)).toEqual([]);
    const titled = stack({ title: 'mods.', items: [{ text: 'a', at: 0.6 }] });
    expect(findOffSync(titled, timelineOf(titled), spaced, MAX)[0]!.message).toContain('1 de 2 entradas fora da palavra');
  });

  it('desconta o trecho cortado entre o `at` e a palavra: tudo é comparado no tempo do vídeo final', () => {
    const edl = edlWith({
      clips: [{ id: 'a', start: 0, end: 20 }, { id: 'b', start: 30, end: 200 }],
      overlays: [pills('antes-do-corte', 19, 4, [{ text: 'a', at: 2 }]), pills('depois', 30.5, 4, [{ text: 'b', at: 0.85 }])],
    });
    // "volta" começa em 31s da fonte = 21s do vídeo; 19 + 2 e 30.5 → 20.5 + 0.85 = 21.35 ("já")
    expect(findOffSync(edl, timelineOf(edl), script('volta já', 31), MAX)).toEqual([]);
    const late = edlWith({ clips: edl.clips, overlays: [pills('p', 19, 4, [{ text: 'a', at: 2.5 }])] });
    expect(findOffSync(late, timelineOf(late), script('volta já |0.2 agora', 31), MAX)[0]!.fix).toContain('items[0].at 2.50 → 2.28');
  });

  it('frase revelada: cada `wordAt` é cobrado contra a própria palavra dita, não contra a mais próxima', () => {
    // sem 10.00 · abrir 10.35 · o 10.70 · terminal 11.05
    const said = script('sem abrir o terminal', 10);
    const phrase = (wordAt: number[]) =>
      edlWith({ overlays: [{ id: 'tese', component: 'PhraseReveal', at: 9.8, duration: 4, reason: 'a tese', props: { text: 'Sem abrir\no *terminal.*', wordAt } }] });
    const synced = phrase([0.2, 0.55, 0.9, 1.25]);
    expect(findOffSync(synced, timelineOf(synced), said, MAX)).toEqual([]);
    // cascata de passo fixo: a 3ª palavra cai em cima de "abrir", mas quem ela escreve é "o"
    const cascade = phrase([0.2, 0.36, 0.52, 0.68]);
    const [finding] = findOffSync(cascade, timelineOf(cascade), said, MAX);
    expect(finding!.message).toContain('3 de 5 entradas');
    expect(finding!.message).toContain('wordAt[2] 0.38s antes de "o"');
    expect(finding!.fix).toContain('wordAt[1] 0.36 → 0.48; wordAt[2] 0.52 → 0.83; wordAt[3] 0.68 → 1.18');
  });

  it('alignPhrase casa em ordem, prefere a ocorrência perto do cue e desiste quando a frase é síntese', () => {
    const spoken = spokenWords(script('que isso que mudou tudo', 10), buildTimeline([{ id: 'c', start: 0, end: 100 }], 30));
    expect(phraseTokens({ text: 'Isso que *mudou.*', wordAt: [] })).toEqual(['isso', 'que', 'mudou']);
    expect(phraseTokens({ text: 'sem lista' })).toEqual([]);
    expect(alignPhrase(['isso', 'que', 'mudou'], [10.3, 10.7, 11], spoken, 10, 12).map((word) => word?.start)).toEqual([10.35, 10.7, 11.05]);
    // "que" dito duas vezes: fica com o mais perto do cue
    expect(alignPhrase(['que', 'mudou'], [10, 11], spoken, 10, 12)[0]!.start).toBe(10);
    expect(alignPhrase(['que', 'mudou'], [10.75, 11], spoken, 10, 12)[0]!.start).toBe(10.7);
    // 1 de 4 palavras ditas: não é a fala, é resumo
    expect(alignPhrase(['a', 'vida', 'que', 'segue'], [], spoken, 10, 12)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('só os níveis que declaram sincronia cobram, e só quando o lint recebe as palavras', () => {
    expect(LEVELS.max.limits.syncWindowSec).toEqual({ before: 0.15, after: 0.1 });
    expect(LEVELS.pro.limits.syncWindowSec).toEqual({ before: 0.3, after: 0.25 });
    expect(LEVELS.normal.limits.syncWindowSec).toBeNull();
    expect(LEVELS.limpa.limits.syncWindowSec).toBeNull();
    // 0.36s depois de "um" e 0.34s antes de "dois": fora até da janela do pro
    const spaced: TimedWord[] = [{ text: 'um', start: 10, end: 10.6 }, { text: 'dois', start: 10.7, end: 11.3 }];
    const overlays = [pills('p', 9.8, 6, [{ text: 'a', at: 0.2 }, { text: 'b', at: 0.56 }])];
    expect(only(edlWith({ overlays }), 'fora-de-sincronia', spaced)).toHaveLength(1);
    expect(only(edlWith({ overlays }), 'fora-de-sincronia')).toEqual([]);
    expect(only(edlWith({ overlays }, 'pro'), 'fora-de-sincronia', spaced)).toHaveLength(1);
    expect(only(edlWith({ overlays }, 'normal'), 'fora-de-sincronia', spaced)).toEqual([]);
    expect(only(edlWith({ overlays }, 'limpa'), 'fora-de-sincronia', spaced)).toEqual([]);
    // 0.15s depois de "dois": o max avisa, o pro aceita
    const loose = [pills('p', 9.8, 6, [{ text: 'a', at: 0.2 }, { text: 'b', at: 0.7 }])];
    expect(only(edlWith({ overlays: loose }), 'fora-de-sincronia', words)).toHaveLength(1);
    expect(only(edlWith({ overlays: loose }, 'pro'), 'fora-de-sincronia', words)).toEqual([]);
  });
});

describe('minReadSec', () => {
  it('1,2s + 0,25s por palavra; acima de 12 palavras, 0,35s por palavra', () => {
    expect(minReadSec('terminal')).toBeCloseTo(1.45);
    expect(minReadSec('sem abrir o terminal')).toBeCloseTo(2.2);
    expect(minReadSec('')).toBeCloseTo(1.2);
    expect(minReadSec(Array.from({ length: 12 }, () => 'a').join(' '))).toBeCloseTo(4.2);
    expect(minReadSec(Array.from({ length: 20 }, () => 'a').join(' '))).toBeCloseTo(7);
  });

  it('a marcação não conta como palavra, e o stage-kit reexporta a mesma função', () => {
    expect(readWords('Sem abrir\no *terminal.*')).toBe(4);
    expect(readWords('a == b == c')).toBe(3);
    expect(kitMinReadSec).toBe(minReadSec);
  });
});

describe('readItems', () => {
  it('pílula: do `at` ao fim do overlay, ou até o `strikeAt`', () => {
    const items = readItems({ items: [{ text: 'precisa programar', at: 1, strikeAt: 3 }, { text: 'sem título' }, { text: 'pede em linguagem natural', at: 4 }] }, 8);
    expect(items).toEqual([
      { path: 'items[0]', cuePath: 'items[0].at', text: 'precisa programar', from: 1, until: 3, untilPath: 'items[0].strikeAt', need: minReadSec('precisa programar'), kind: 'text' },
      { path: 'items[2]', cuePath: 'items[2].at', text: 'pede em linguagem natural', from: 4, until: 8, untilPath: null, need: minReadSec('pede em linguagem natural'), kind: 'text' },
    ]);
  });

  it('cartões casados com `revealAt`, nota, linhas e notas da janela', () => {
    const split = readItems({ eyebrow: 'Até aqui', title: 'Você personalizava', cards: [{ label: 'Skills' }, { label: 'Conectores', caption: 'nuvem e apps' }], revealAt: [2, 3.5], note: { text: 'tudo nos documentos', at: 5 } }, 9);
    expect(split.map((item) => [item.path, item.cuePath, item.text, item.from])).toEqual([
      ['cards[0]', 'revealAt[0]', 'Skills', 2],
      ['cards[1]', 'revealAt[1]', 'Conectores nuvem e apps', 3.5],
      ['note', 'note.at', 'tudo nos documentos', 5],
    ]);
    const stage = readItems({ title: 'Claude Code', lines: [{ text: 'cria um mod', tone: 'prompt', at: 1 }], notes: [{ text: 'em linguagem natural', at: 2 }], push: { at: 3 } }, 9);
    expect(stage.map((item) => item.cuePath)).toEqual(['lines[0].at', 'notes[0].at']);
  });

  it('frase com `wordAt`: a frase conta da primeira palavra e a última não entra em cima do fim', () => {
    const items = readItems({ text: 'Sem abrir\no *terminal.*', eyebrow: 'o mais interessante', wordAt: [0.4, 0.7, 1.1, 1.3] }, 3.6);
    expect(items).toEqual([
      { path: 'text', cuePath: 'wordAt[0]', text: 'Sem abrir\no *terminal.*', from: 0.4, until: 3.6, untilPath: null, need: minReadSec('Sem abrir o terminal.'), kind: 'text' },
      { path: 'text', cuePath: 'wordAt[3]', text: 'Sem abrir\no *terminal.*', from: 1.3, until: 3.6, untilPath: null, need: LAST_ENTRY_SEC, kind: 'last-word' },
    ]);
  });

  it('sem cue declarado não há item: texto fixo, cena com registro de instantes, lista ambígua', () => {
    expect(readItems({ title: 'Matheus Chiodi', subtitle: 'Desenvolvedor' }, 3)).toEqual([]);
    expect(readItems({ revealAt: { html: 1, css: 2 } }, 5)).toEqual([]);
    expect(readItems({ left: [{ label: 'a' }], right: [{ label: 'b' }], revealAt: [1] }, 5)).toEqual([]);
    expect(readItems({}, 5)).toEqual([]);
  });

  it('readShortfall: quanto falta; item que entra depois do fim falta inteiro', () => {
    const [ok, short, never] = readItems({ items: [{ text: 'dá tempo', at: 1 }, { text: 'quase não dá', at: 5 }, { text: 'tarde', at: 9 }] }, 6.5);
    expect(readShortfall(ok!)).toBe(0);
    expect(readShortfall(short!)).toBeCloseTo(1.95 - 1.5);
    expect(readShortfall(never!)).toBeCloseTo(1.45);
  });
});

describe('leitura-curta', () => {
  it('overlay com tempo de leitura para todos os itens passa; overlay sem cues também', () => {
    const edl = edlWith({
      overlays: [
        pills('p', 10, 8, [{ text: 'precisa programar', at: 1, strikeAt: 3 }, { text: 'pede em linguagem natural', at: 4 }]),
        { id: 'nome', component: 'LowerThird', at: 30, duration: 1.3, reason: 'apresenta', props: { title: 'Matheus Chiodi' } },
      ],
    });
    expect(findShortReads(edl, timelineOf(edl))).toEqual([]);
  });

  it('um achado por overlay, com quanto falta em cada item e a duração nova', () => {
    const edl = edlWith({
      clips: [{ id: 'a', start: 0, end: 20 }, { id: 'b', start: 30, end: 200 }],
      overlays: [pills('p', 40, 5.5, [{ text: 'fazendo as coisas', at: 1.2 }, { text: 'tudo à toa?', at: 4.3 }, { text: 'será que é isso?', at: 3.58 }])],
    });
    const findings = findShortReads(edl, timelineOf(edl));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'warning', check: 'leitura-curta', at: 30 });
    expect(findings[0]!.message).toBe(
      '"p": 2 de 3 textos somem antes de serem lidos: items[1].at "tudo à toa?" fica 1.20s (mínimo 1.95s, faltam 0.75s), items[2].at "será que é isso?" fica 1.92s (mínimo 2.20s, faltam 0.28s)',
    );
    expect(findings[0]!.fix).toBe('aumente "duration" de 5.50 para 6.25 (ou adiante os cues em 0.75s, se o próximo overlay vem colado)');
  });

  it('item riscado cedo demais pede `strikeAt` mais tarde; item que nunca aparece é dito com todas as letras', () => {
    const edl = edlWith({ overlays: [pills('p', 10, 5, [{ text: 'precisa programar', at: 1, strikeAt: 1.8 }, { text: 'grande dificuldade', at: 5.5 }])] });
    const [finding] = findShortReads(edl, timelineOf(edl));
    expect(finding!.message).toContain('items[0].at "precisa programar" fica 0.80s (mínimo 1.70s, faltam 0.90s)');
    expect(finding!.message).toContain('items[1].at "grande dificuldade" nunca aparece (entra em 5.50s e o overlay dura 5.00s; precisa de 1.70s)');
    expect(finding!.fix).toBe('aumente "duration" de 5.00 para 6.70 (ou adiante os cues em 1.70s, se o próximo overlay vem colado); items[0].strikeAt 1.80 → 2.70');
  });

  it('frase revelada: avisa a última palavra que entra em cima do fim', () => {
    const edl = edlWith({ overlays: [{ id: 'tese', component: 'PhraseReveal', at: 10, duration: 3, reason: 'a tese', props: { text: 'Sem abrir\no *terminal.*', wordAt: [0.4, 0.9, 1.6, 2.4] } }] });
    const [finding] = findShortReads(edl, timelineOf(edl));
    expect(finding!.message).toBe('"tese": 1 de 1 textos somem antes de serem lidos: wordAt[3] (última palavra da frase) entra 0.60s antes do fim (mínimo 1.00s, faltam 0.40s)');
  });

  it('só o max cobra a leitura por item', () => {
    const overlays = [pills('p', 10, 5, [{ text: 'grande dificuldade', at: 4.5 }])];
    expect(only(edlWith({ overlays }), 'leitura-curta')).toHaveLength(1);
    for (const level of ['limpa', 'normal', 'pro'] as const) {
      expect(LEVELS[level].limits.itemMinRead).toBe(false);
      expect(only(edlWith({ overlays }, level), 'leitura-curta')).toEqual([]);
    }
  });
});

describe('respiros declarados (breathers)', () => {
  const base = { version: 1, project: 't', createdAt: 'x', source: { path: 'v.mp4', durationSec: 200, fps: 30, width: 1920, height: 1080 }, output: { fps: 30, width: 1920, height: 1080 }, clips: [{ id: 'c1', start: 0, end: 200 }] };

  it('o campo é opcional, com padrão vazio', () => {
    expect(parseEdl(base).breathers).toEqual([]);
    expect(parseEdl({ ...base, breathers: [{ start: 59, end: 75, reason: 'parte pessoal' }] }).breathers).toEqual([{ start: 59, end: 75, reason: 'parte pessoal' }]);
  });

  it('o schema recusa fim antes do início, respiro sem motivo e respiro além da fonte', () => {
    const issues = (breather: Record<string, unknown>) => {
      const result = edlSchema.safeParse({ ...base, breathers: [breather] });
      return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    };
    expect(issues({ start: 75, end: 59, reason: 'x' })).toEqual(['breathers.0: end precisa ser maior que start']);
    expect(issues({ start: 10, end: 10, reason: 'x' })).toHaveLength(1);
    expect(issues({ start: 59, end: 75, reason: '  ' })).toEqual(['breathers.0.reason: diga por que este trecho fica sem edição']);
    expect(issues({ start: 59, end: 75 })).toHaveLength(1);
    expect(issues({ start: 190, end: 230, reason: 'x' })).toEqual(['breathers.0.end: passa do fim da fonte (200s)']);
  });

  it('spanToOutput e spanToSource atravessam cortes', () => {
    const timeline = buildTimeline([{ id: 'a', start: 0, end: 20 }, { id: 'b', start: 30, end: 100 }], 30);
    expect(spanToOutput(timeline, 10, 40)).toEqual({ from: 10, to: 30 });
    expect(spanToOutput(timeline, 22, 28)).toBeNull();
    expect(spanToOutput(timeline, 25, 35)).toEqual({ from: 20, to: 25 });
    expect(spanToSource(timeline, { from: 10, to: 30 })).toEqual({ start: 10, end: 40 });
    // a fronteira de corte fica no clipe que começa (início) e no que termina (fim)
    expect(spanToSource(timeline, { from: 20, to: 25 })).toEqual({ start: 30, end: 35 });
    expect(spanToSource(timeline, { from: 12, to: 20 })).toEqual({ start: 12, end: 20 });
    expect(breatherSpans([{ start: 50, end: 60 }, { start: 10, end: 15 }, { start: 15.2, end: 18 }, { start: 22, end: 28 }], timeline)).toEqual([
      { from: 10, to: 18 },
      { from: 40, to: 50 },
    ]);
  });
});

describe('trecho-parado', () => {
  it('intervalo de 8–40s sem evento dentro do max avisa, com o instante, a duração e o respiro pronto para declarar', () => {
    const edl = edited([[0, 60], [75, 200]]);
    const findings = only(edl, 'trecho-parado');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'warning', at: 59 });
    expect(findings[0]!.message).toContain('16.0s sem nada novo na tela de 00:59');
    expect(findings[0]!.message).toContain('não é um respiro declarado');
    expect(findings[0]!.fix).toContain('"breathers": { "start": 59.00, "end": 75.00, "reason": "..." }');
    expect(only(edl, 'tela-parada')).toEqual([]);
  });

  it('respiro declarado cala o aviso, mas o trecho continua contando na cobertura', () => {
    const plain = edited([[0, 60], [75, 200]]);
    const declared = edited([[0, 60], [75, 200]], { breathers: [{ start: 59, end: 75, reason: 'parte pessoal' }] });
    expect(only(declared, 'trecho-parado')).toEqual([]);
    expect(levelCoverage(declared, timelineOf(declared), LEVELS.max)).toEqual(levelCoverage(plain, timelineOf(plain), LEVELS.max));
    // folga de 0,5s nas bordas; respiro que cobre só um pedaço não vale
    expect(only(edited([[0, 60], [75, 200]], { breathers: [{ start: 59.4, end: 74.6, reason: 'r' }] }), 'trecho-parado')).toEqual([]);
    expect(only(edited([[0, 60], [75, 200]], { breathers: [{ start: 62, end: 75, reason: 'r' }] }), 'trecho-parado')).toHaveLength(1);
    // dois respiros colados cobrem juntos
    expect(only(edited([[0, 60], [75, 200]], { breathers: [{ start: 59, end: 66, reason: 'a' }, { start: 66, end: 75, reason: 'b' }] }), 'trecho-parado')).toEqual([]);
  });

  it('acima de 40s é `tela-parada`, declarado ou não; e o declarado conta nos 20%', () => {
    const edl = edited([[0, 60], [110, 200]], { breathers: [{ start: 59, end: 110, reason: 'mostra a tela inteira' }] });
    expect(only(edl, 'trecho-parado')).toEqual([]);
    expect(only(edl, 'tela-parada')).toHaveLength(1);
    expect(only(edl, 'pouco-editado')).toHaveLength(1);
  });

  it('respiro declarado em tempo da fonte acompanha os cortes', () => {
    const cut = { clips: [{ id: 'a', start: 0, end: 100 }, { id: 'b', start: 120, end: 200 }] };
    // pílulas até 59s; a próxima em 125s da fonte = 105s do vídeo: 46s parados no vídeo se não houvesse nada; aqui, 59→75
    const overlays = [...edited([[0, 60], [75, 95]]).overlays, ...edited([[125, 200]]).overlays.map((overlay) => ({ ...overlay, id: `z-${overlay.id}` }))];
    const edl = edlWith({ ...cut, overlays });
    const [gap] = only(edl, 'trecho-parado');
    expect(gap!.fix).toContain('{ "start": 59.00, "end": 75.00');
    const tail = only(edl, 'trecho-parado').at(-1)!;
    // 94s (fim da última pílula antes do corte) até 125s da fonte: o corte de 20s não conta
    expect(tail.message).toContain('11.0s sem nada novo');
    expect(tail.fix).toContain('{ "start": 94.00, "end": 125.00');
    const declared = edlWith({ ...cut, overlays, breathers: [{ start: 59, end: 75, reason: 'a' }, { start: 94, end: 125, reason: 'b' }] });
    expect(only(declared, 'trecho-parado')).toEqual([]);
  });

  it('outros níveis não têm trecho parado; funções puras devolvem vazio sem limites', () => {
    for (const level of ['limpa', 'normal', 'pro'] as const) expect(only(edited([[0, 60], [75, 200]], {}, level), 'trecho-parado')).toEqual([]);
    const coverage = { share: 0.9, plain: [{ from: 59, to: 75 }], plainSec: 16 };
    const timeline = buildTimeline([{ id: 'c', start: 0, end: 200 }], 30);
    expect(findStalls(coverage, timeline, [], { maxIdleSec: null, maxPlainSec: null }, 'pro')).toEqual([]);
    expect(findStalls(coverage, timeline, [], { maxIdleSec: 8, maxPlainSec: 40 }, 'max')).toHaveLength(1);
    expect(undeclaredStalls({ ...coverage, plain: [{ from: 10, to: 60 }] }, timeline, [], 40)).toEqual([]);
  });
});

describe('respiros-colados', () => {
  it('dois trechos sem edição com menos de 15s editados entre eles avisam', () => {
    expect(LEVELS.max.limits.minBetweenPlainSec).toBe(15);
    // pílulas em 75 e 80 (a última sai em 84): trechos parados 59–75 e 84–100, com 9s editados no meio
    const edl = edited([[0, 60], [75, 85], [100, 200]]);
    const findings = only(edl, 'respiros-colados');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'warning', at: 84 });
    expect(findings[0]!.message).toBe('trechos sem edição em 00:59–01:15 e 01:24–01:40 com só 9.0s editados entre eles (mínimo 15s no nível max)');
    expect(findings[0]!.fix).toContain('dois respiros não se colam');
  });

  it('declarar os dois como respiro não libera: a regra é sobre a distância', () => {
    const edl = edited([[0, 60], [75, 85], [100, 200]], { breathers: [{ start: 59, end: 75, reason: 'a' }, { start: 84, end: 100, reason: 'b' }] });
    expect(only(edl, 'trecho-parado')).toEqual([]);
    expect(only(edl, 'respiros-colados')).toHaveLength(1);
  });

  it('com 15s ou mais de parte editada entre eles, passa; um trecho só, também', () => {
    expect(only(edited([[0, 60], [75, 95], [110, 200]]), 'respiros-colados')).toEqual([]);
    expect(only(edited([[0, 60], [75, 200]]), 'respiros-colados')).toEqual([]);
    const gaps = { share: 0.8, plain: [{ from: 10, to: 20 }, { from: 35, to: 45 }], plainSec: 20 };
    expect(findStackedBreathers(gaps, 15, 'max')).toEqual([]);
    expect(findStackedBreathers({ ...gaps, plain: [{ from: 10, to: 20 }, { from: 34.9, to: 45 }] }, 15, 'max')).toHaveLength(1);
  });

  it('outros níveis não cobram', () => {
    for (const level of ['limpa', 'normal', 'pro'] as const) {
      expect(LEVELS[level].limits.minBetweenPlainSec).toBeNull();
      expect(only(edited([[0, 60], [75, 85], [100, 200]], {}, level), 'respiros-colados')).toEqual([]);
    }
    expect(findStackedBreathers({ share: 0, plain: [{ from: 0, to: 10 }, { from: 11, to: 30 }], plainSec: 29 }, null, 'pro')).toEqual([]);
  });
});

describe('legenda-sobre-palco', () => {
  const stage = (extra: Record<string, unknown>) => ({ id: 'o', component: 'SplitExplainer', at: 10, duration: 6, reason: 'r', props: {}, ...extra });

  it('captionClash: palco lateral, WindowStage em qualquer slot e cena de tela cheia', () => {
    const presenter = (slot: string) => ({ slot, focus: { x: 0.5, y: 0.4 }, backdrop: 'paper' }) as never;
    expect(captionClash({ component: 'SplitExplainer', presenter: presenter('right') })).toBe('um palco de tela cheia');
    expect(captionClash({ component: 'SplitExplainer', presenter: presenter('left') })).toBe('um palco de tela cheia');
    expect(captionClash({ component: 'WindowStage', presenter: presenter('pip-br') })).toBe('uma janela flutuante (WindowStage)');
    expect(captionClash({ component: 'WindowStage', presenter: null })).toBe('uma janela flutuante (WindowStage)');
    expect(captionClash({ component: 'scene:demo/Rede', presenter: null })).toBe('uma cena de tela cheia');
    expect(captionClash({ component: 'scene:modelos/Pilha', presenter: presenter('pip-bl') })).toBe('uma cena de tela cheia');
    expect(captionClash({ component: 'DocQuote', presenter: presenter('pip-br') })).toBeNull();
    expect(captionClash({ component: 'PillStack', presenter: null })).toBeNull();
  });

  it('avisa nos três casos quando falta `hidesCaptions`, em qualquer nível', () => {
    const overlays = [
      stage({ id: 'lado', presenter: { slot: 'left' } }),
      stage({ id: 'janela', component: 'WindowStage', at: 30, presenter: { slot: 'pip-bl' } }),
      stage({ id: 'cena', component: 'scene:demo/Rede', at: 60 }),
      stage({ id: 'pilha', component: 'PillStack', at: 90 }),
      stage({ id: 'doc', component: 'DocQuote', at: 120, presenter: { slot: 'pip-br' } }),
    ];
    for (const level of ['normal', 'max'] as const) {
      expect(only(edlWith({ overlays }, level), 'legenda-sobre-palco').map((finding) => finding.message)).toEqual([
        '"lado" é um palco de tela cheia e não esconde as legendas',
        '"janela" é uma janela flutuante (WindowStage) e não esconde as legendas',
        '"cena" é uma cena de tela cheia e não esconde as legendas',
      ]);
    }
    expect(only(edlWith({ overlays: overlays.map((overlay) => ({ ...overlay, hidesCaptions: true })) }), 'legenda-sobre-palco')).toEqual([]);
  });
});

describe('formatLevels e formatBreathers', () => {
  it('a ficha do nível mostra as regras novas só onde valem', () => {
    const max = formatLevels('max');
    expect(max).toContain('respiros: declare os escolhidos em `breathers`; pelo menos 15s editados entre dois trechos sem edição');
    expect(max).toContain('sincronia: cada entrada de 0.15s antes a 0.10s depois do início da palavra que a motiva (o `at` do overlay pode adiantar mais 0.10s)');
    expect(max).toContain('leitura: cada item de texto fica na tela pelo menos 1,2s + 0,25s por palavra');
    const pro = formatLevels('pro');
    expect(pro).toContain('sincronia: cada entrada de 0.30s antes a 0.25s depois');
    expect(pro).not.toContain('leitura:');
    expect(pro).not.toContain('respiros:');
    for (const level of ['limpa', 'normal'] as const) expect(formatLevels(level)).not.toMatch(/sincronia:|leitura:|respiros:/);
  });

  it('lista os respiros declarados e os trechos parados sem declarar', () => {
    const edl = edited([[0, 60], [75, 85], [100, 200]], { breathers: [{ start: 59, end: 75, reason: 'parte pessoal' }, { start: 120, end: 130, reason: 'sobrou de outra versão' }] });
    const timeline = timelineOf(edl);
    expect(formatBreathers(edl, timeline, levelCoverage(edl, timeline, LEVELS.max), LEVELS.max.limits)).toBe(
      ['respiros declarados: 2', '  00:59–01:15 (16s) — parte pessoal', '  02:00–02:10 (10s) — sobrou de outra versão · há edição aqui: não é mais respiro', 'trechos parados sem declarar: 1 (01:24–01:40)'].join('\n'),
    );
  });

  it('respiro em trecho cortado é dito; sem respiro e sem trecho parado, nada', () => {
    const cut = edlWith({ clips: [{ id: 'a', start: 0, end: 20 }, { id: 'b', start: 30, end: 200 }], breathers: [{ start: 22, end: 28, reason: 'saiu no corte' }] }, 'normal');
    expect(formatBreathers(cut, timelineOf(cut), null, LEVELS.normal.limits)).toBe('respiros declarados: 1\n  fonte 22.00–28.00s: trecho cortado — saiu no corte');
    const full = edited([[0, 200]]);
    expect(formatBreathers(full, timelineOf(full), levelCoverage(full, timelineOf(full), LEVELS.max), LEVELS.max.limits)).toBe('');
  });
});

describe('prova real: EDL do como-melhorei', () => {
  const root = join(import.meta.dirname, '..', 'projects', 'como-melhorei');
  const edlFile = join(root, 'edl', 'edl.v5.json');
  const wordsFile = join(root, 'analysis', 'words.json');

  it.skipIf(!existsSync(edlFile) || !existsSync(wordsFile))('as checagens rodam sobre a EDL e a transcrição de verdade, com achados acionáveis', () => {
    const edl = parseEdl(JSON.parse(readFileSync(edlFile, 'utf8')));
    const { words } = JSON.parse(readFileSync(wordsFile, 'utf8')) as { words: TimedWord[] };
    const timeline = buildTimeline(edl.clips, edl.output.fps);
    const findings = lintStyle(edl, timeline, undefined, undefined, words);
    const sync = findings.filter((finding) => finding.check === 'fora-de-sincronia');
    const reads = findings.filter((finding) => finding.check === 'leitura-curta');
    // a maioria das entradas está na palavra: achado em menos da metade dos overlays, e sempre com valor novo
    expect(sync.length).toBeGreaterThan(0);
    expect(sync.length).toBeLessThan(edl.overlays.length / 2);
    for (const finding of sync) expect(finding.fix).toMatch(/ \d+\.\d\d → \d+\.\d\d/);
    for (const finding of reads) expect(finding.fix).toMatch(/"duration" de \d+\.\d\d para \d+\.\d\d|strikeAt/);
    // conferido à mão contra o words.json: "bootcamps" é dito em 138.97s e a palavra da frase entra em 139.57s
    expect(sync.find((finding) => finding.message.startsWith('"tese-bootcamps"'))?.message).toContain('wordAt[3] 0.60s depois de "bootcamps"');
    // "grande dificuldade" entra em 5.55s num overlay de 5.3s
    expect(reads.find((finding) => finding.message.startsWith('"p-basico"'))?.message).toContain('nunca aparece');
  });
});
