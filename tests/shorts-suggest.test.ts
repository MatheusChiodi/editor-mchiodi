import { describe, expect, it } from 'vitest';

import type { Flag, Span, Word } from '../src/analyze/types.ts';
import { configSchema } from '../src/config.ts';
import { edlSchema, shortsSchema } from '../src/edl/schema.ts';
import {
  applySuggestion,
  DEFAULT_HOOK_TERMS,
  DEFAULT_RULES,
  formatSuggestions,
  keptWords,
  scoreClean,
  scoreClosure,
  scoreHook,
  scoreStandalone,
  shortBoundaries,
  suggestShorts,
  totalScore,
  WEIGHTS,
} from '../src/render/shorts-suggest.ts';
import { script } from './helpers.ts';

const repeat = (sentence: string, times: number) => Array.from({ length: times }, () => sentence).join(' ');

/** Silêncio medido em toda pausa ≥ minGap (com 50 ms de folga para cada lado, como o silencedetect). */
function silencesFrom(words: Word[], minGap = 0.5): Span[] {
  const spans: Span[] = [];
  for (let index = 1; index < words.length; index += 1) {
    const gap = words[index]!.start - words[index - 1]!.end;
    if (gap >= minGap) spans.push({ start: words[index - 1]!.end + 0.05, end: words[index]!.start - 0.05 });
  }
  return spans;
}

const insideWord = (words: Word[], time: number) => words.some((word) => time > word.start + 1e-6 && time < word.end - 1e-6);

const kept = (texts: string[]) => texts.map((text, index) => ({ word: { text, start: index, end: index + 0.5, score: 1, segment: 0, interpolated: false }, clip: 0, key: text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '') }));

// contexto (voz contínua, sem silêncio) | gancho autossuficiente | trecho que depende do anterior
const TEXT = [
  repeat('isso aqui é contexto do assunto.', 20),
  '|1',
  'Por que ninguém te conta esse erro?',
  repeat('A resposta tem várias partes importantes.', 10),
  '|1',
  'Então como eu disse isso continua.',
  repeat('Mais detalhes sobre o mesmo ponto.', 10),
  '|1',
].join(' ');

function fixture() {
  const words = script(TEXT);
  return { words, clips: [{ id: 'c1', start: 0, end: words.at(-1)!.end + 0.5 }], silences: silencesFrom(words), flags: [] as Flag[], tech: [] };
}

describe('shorts suggest: bordas', () => {
  it('só palavras que sobreviveram aos cortes entram', () => {
    const words = script('um dois três |1 quatro cinco');
    const result = keptWords(words, [{ start: 0, end: 0.6 }, { start: 2, end: 10 }]);
    expect(result.map((item) => item.word.text)).toEqual(['um', 'dois', 'quatro', 'cinco']);
    expect(result.map((item) => item.clip)).toEqual([0, 0, 1, 1]);
  });

  it('borda só em pausa com silêncio medido ou em corte da EDL; pausa com som não serve', () => {
    const words = script('Primeira frase aqui. |0.6 Segunda frase aqui. |0.6 Terceira frase aqui.');
    const clips = [{ start: 0, end: 20 }];
    const onlyFirst = [{ start: words[2]!.end + 0.05, end: words[3]!.start - 0.05 }];
    const items = keptWords(words, clips);
    const boundaries = shortBoundaries(items, clips, onlyFirst, 0.12);
    // começo, a pausa com silêncio, fim; a segunda pausa (sem silêncio medido) não vira borda
    expect(boundaries.map((boundary) => boundary.index)).toEqual([0, 3, 9]);
    expect(boundaries[1]!.kind).toBe('silencio');
    // silêncio curto demais também não serve
    const tiny = [{ start: words[2]!.end + 0.3, end: words[2]!.end + 0.35 }];
    expect(shortBoundaries(items, clips, tiny, 0.12).map((boundary) => boundary.index)).toEqual([0, 9]);
    // borda deixa respiro dentro do silêncio, nunca colada nem dentro da palavra
    expect(boundaries[1]!.endAt).toBeGreaterThan(words[2]!.end);
    expect(boundaries[1]!.startAt).toBeLessThan(words[3]!.start);
    expect(boundaries[1]!.endAt).toBeLessThanOrEqual(boundaries[1]!.startAt);
  });

  it('corte da EDL é borda e usa as pontas dos clipes', () => {
    const words = script('Uma frase inteira. |2 lixo lixo |2 Outra frase inteira.');
    const clips = [{ start: 0, end: words[2]!.end + 0.2 }, { start: words[5]!.start - 0.2, end: 30 }];
    const items = keptWords(words, clips);
    expect(items.map((item) => item.word.text)).not.toContain('lixo');
    const cut = shortBoundaries(items, clips, [], 0.12)[1]!;
    expect(cut).toMatchObject({ index: 3, kind: 'corte', endAt: clips[0]!.end, startAt: clips[1]!.start });
  });
});

describe('shorts suggest: componentes', () => {
  it('gancho: pergunta, número, termo da lista e imperativo no começo de frase; "sabe?" não conta', () => {
    expect(scoreHook(kept(['Por', 'que', 'ninguém', 'te', 'conta?']), DEFAULT_RULES, true)).toMatchObject({ score: 1 });
    expect(scoreHook(kept(['Esqueça', 'os', '3', 'cursos.']), DEFAULT_RULES, false).detail).toMatch(/número "3".*imperativo "Esqueça"/);
    expect(scoreHook(kept(['eu', 'use', 'isso', 'sabe?']), DEFAULT_RULES, false)).toMatchObject({ score: 0 });
    expect(scoreHook(kept(['Isso', 'é', 'bom,', 'né?']), DEFAULT_RULES, false).score).toBe(0);
    // lista configurável
    const custom = { ...DEFAULT_RULES, terms: ['bomba'] };
    expect(scoreHook(kept(['Isso', 'é', 'uma', 'bomba.']), custom, false).detail).toBe('"bomba"');
    expect(scoreHook(kept(['Isso', 'é', 'um', 'erro.']), custom, false).score).toBe(0);
  });

  it('autossuficiência penaliza conectivo, retomada, frase pela metade e fala de canal', () => {
    expect(scoreStandalone(kept(['Docker', 'resolve', 'isso.']), kept(['fim.'])[0], DEFAULT_RULES).score).toBe(1);
    expect(scoreStandalone(kept(['Como', 'eu', 'disse,', 'o', 'Docker']), undefined, DEFAULT_RULES).detail).toContain('"como eu disse"');
    expect(scoreStandalone(kept(['Então', 'o', 'Docker']), undefined, DEFAULT_RULES).score).toBeCloseTo(0.6);
    expect(scoreStandalone(kept(['Docker', 'resolve']), kept(['usando'])[0], DEFAULT_RULES).detail).toContain('meio da frase');
    expect(scoreStandalone(kept(['docker', 'resolve']), kept(['fim.'])[0], DEFAULT_RULES).detail).toContain('meio da frase');
    expect(scoreStandalone(kept(['Docker.', 'Fiquem', 'com', 'Deus.']), undefined, DEFAULT_RULES).detail).toContain('"fiquem com deus"');
  });

  it('fecho exige fim de frase; pausa longa vale mais que curta', () => {
    const [last] = kept(['fim.']);
    const [open] = kept(['e']);
    const boundary = (pause: number) => ({ index: 1, kind: 'silencio' as const, startAt: 0, endAt: 0, pause });
    expect(scoreClosure(last!, boundary(0.6)).score).toBe(1);
    expect(scoreClosure(last!, boundary(0.2)).score).toBe(0.7);
    expect(scoreClosure(open!, boundary(0.6)).score).toBe(0);
  });

  it('flags que sobraram tiram de "limpo"; pesos somam 1', () => {
    const flag = (kind: Flag['kind']): Flag => ({ kind, start: 0, end: 1, reason: '', confidence: 1 });
    expect(scoreClean([]).score).toBe(1);
    expect(scoreClean([flag('retake'), flag('filler')]).score).toBeCloseTo(0.45);
    expect(scoreClean([flag('retake'), flag('retake'), flag('retake')]).score).toBe(0);
    expect(Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
  });
});

describe('shorts suggest: ranking', () => {
  it('prefere o trecho com gancho e autossuficiente; bordas em pausa medida, dentro da janela', () => {
    const input = fixture();
    const candidates = suggestShorts(input, { count: 3, minSec: 20, maxSec: 60 });
    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0]!;
    expect(top.rank).toBe(1);
    expect(top.opening).toMatch(/^Por que ninguém te conta esse erro\?/);
    expect(top.components.hook.score).toBe(1);
    expect(top.components.standalone.score).toBe(1);
    expect(top.score).toBe(totalScore(top.components));
    for (const candidate of candidates) {
      expect(candidate.outputSec).toBeGreaterThanOrEqual(20);
      expect(candidate.outputSec).toBeLessThanOrEqual(60);
      expect(insideWord(input.words, candidate.start)).toBe(false);
      expect(insideWord(input.words, candidate.end)).toBe(false);
      expect(shortsSchema.safeParse(candidate.shorts).success).toBe(true);
      expect(candidate.shorts).toMatchObject({ start: candidate.start, end: candidate.end, focusX: 0.5 });
      expect(candidate.shorts.reason).toContain(`#${candidate.rank}`);
    }
    // ordenado por nota, sem dois candidatos quase iguais
    expect(candidates.map((candidate) => candidate.score)).toEqual([...candidates.map((candidate) => candidate.score)].sort((a, b) => b - a));
    // o que abre com "Então" perde para o gancho
    const weak = candidates.find((candidate) => candidate.opening.startsWith('Então'));
    if (weak) expect(weak.components.standalone.score).toBeLessThan(1);
  });

  it('só conta o que a EDL mantém: trecho cortado sai do texto, da duração e das flags', () => {
    const input = fixture();
    const hook = input.words.findIndex((word) => word.text === 'ninguém') - 2;
    const cutFrom = input.words[hook + 10]!.start - 0.01;
    const cutTo = input.words[hook + 16]!.end + 0.01;
    const clips = [
      { id: 'c1', start: 0, end: cutFrom },
      { id: 'c2', start: cutTo, end: input.clips[0]!.end },
    ];
    const flags: Flag[] = [{ kind: 'retake', start: cutFrom + 0.1, end: cutTo - 0.1, reason: '', confidence: 1 }];
    const [top] = suggestShorts({ ...input, clips, flags }, { count: 1 });
    expect(top!.opening).toMatch(/^Por que ninguém/);
    const inSpan = input.words.filter((word) => word.start >= top!.start && word.end <= top!.end).length;
    expect(top!.text.split(' ').length).toBe(inSpan - 7);
    expect(top!.outputSec).toBeCloseTo(top!.end - top!.start - (cutTo - cutFrom), 2);
    expect(top!.components.clean.score).toBe(1);
  });

  it('tecnologia de confiança alta pontua; baixa é ignorada', () => {
    const input = fixture();
    const at = input.words.find((word) => word.text === 'resposta')!;
    const mention = { tech: 'docker', name: 'Docker', start: at.start, end: at.end };
    const high = suggestShorts({ ...input, tech: [{ ...mention, confidence: 'high' }] }, { count: 1 })[0]!;
    const low = suggestShorts({ ...input, tech: [{ ...mention, confidence: 'low' }] }, { count: 1 })[0]!;
    expect(high.components.tech).toMatchObject({ score: 0.6, detail: 'Docker' });
    expect(low.components.tech.score).toBe(0);
  });

  it('nada na janela: lista vazia e mensagem clara', () => {
    expect(suggestShorts(fixture(), { minSec: 100, maxSec: 120 })).toEqual([]);
    expect(formatSuggestions([])).toMatch(/nenhum trecho/);
  });

  it('tabela traz componentes e o trecho pronto para a EDL', () => {
    const text = formatSuggestions(suggestShorts(fixture(), { count: 2 }));
    expect(text.split('\n')[0]).toMatch(/^#\s+nota\s+fonte\s+final\s+gancho/);
    expect(text).toContain('"shorts": {"start":');
    expect(text).toContain('Por que ninguém');
  });

  it('applySuggestion gera a próxima EDL com o trecho e notes explicando, sem tocar no resto', () => {
    const input = fixture();
    const edl = edlSchema.parse({
      version: 3,
      project: 'teste',
      createdAt: '2026-10-12T00:00:00.000Z',
      source: { path: 'C:/v.mp4', durationSec: 200, fps: 30, width: 1920, height: 1080 },
      output: { fps: 30, width: 1920, height: 1080 },
      clips: input.clips,
      shorts: { start: 1, end: 30, focusX: 0.3 },
    });
    const [top] = suggestShorts({ ...input, focusX: edl.shorts!.focusX }, { count: 1 });
    const next = applySuggestion(edl, top!);
    expect(next).not.toHaveProperty('version');
    expect(next.shorts).toEqual({ ...top!.shorts, graphics: 'auto' });
    expect(next.shorts!.focusX).toBe(0.3);
    expect(next.notes).toMatch(/candidato #1 .* v3 .*antes: 1–30s/);
    expect(next.clips).toEqual(edl.clips);
    expect(edlSchema.safeParse({ ...next, version: 4, createdAt: edl.createdAt }).success).toBe(true);
  });

  it('listas do gancho vêm do mce.config.json (padrão em PT-BR)', () => {
    const config = configSchema.parse({});
    expect(config.shorts.hookTerms).toEqual(DEFAULT_HOOK_TERMS);
    expect(config.shorts.hookWindowSec).toBe(3);
    expect(configSchema.parse({ shorts: { hookTerms: ['bomba'] } }).shorts.hookTerms).toEqual(['bomba']);
  });
});
