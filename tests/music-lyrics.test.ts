import { describe, expect, it } from 'vitest';

import type { Word } from '../src/analyze/types.ts';
import { alignLyrics, linesFromWords, parseLyrics, spreadLyrics, tokenSimilarity } from '../src/music/lyrics.ts';

const w = (text: string, start: number, dur = 0.4): Word => ({ text, start, end: start + dur, score: 0.9, segment: 0, interpolated: false });

describe('parseLyrics', () => {
  it('uma linha por verso, sem vazios nem marcações de seção', () => {
    const text = '[Verso 1]\nEu vou  seguir\n\n(refrão)\nSem olhar pra trás \n[Chorus]\n';
    expect(parseLyrics(text)).toEqual(['Eu vou seguir', 'Sem olhar pra trás']);
  });
  it('aceita CRLF', () => {
    expect(parseLyrics('a b\r\nc d\r\n')).toEqual(['a b', 'c d']);
  });
});

describe('tokenSimilarity', () => {
  it('1 para iguais (sem acento/caixa) e alto para erro de uma letra', () => {
    expect(tokenSimilarity('Coração', 'coracao')).toBe(1);
    expect(tokenSimilarity('seguir', 'segiur')).toBeGreaterThanOrEqual(0.6);
    expect(tokenSimilarity('seguir', 'banana')).toBeLessThan(0.4);
  });
});

describe('linesFromWords (sem letra: usa o que foi ouvido)', () => {
  it('quebra por pausa e por limite de palavras', () => {
    const words = [w('eu', 0), w('vou', 0.5), w('seguir', 1), w('sem', 3), w('olhar', 3.5), w('pra', 4), w('trás', 4.5)];
    const lines = linesFromWords(words, { maxGap: 0.7, maxWords: 8 });
    expect(lines.map((line) => line.text)).toEqual(['eu vou seguir', 'sem olhar pra trás']);
    expect(lines[0]).toMatchObject({ start: 0, end: 1.4 });
    expect(lines[1]!.words).toHaveLength(4);
    const long = linesFromWords(Array.from({ length: 10 }, (_, i) => w(`p${i}`, i * 0.4)), { maxGap: 0.7, maxWords: 4 });
    expect(long.map((line) => line.words.length)).toEqual([4, 4, 2]);
  });
  it('lista vazia', () => {
    expect(linesFromWords([])).toEqual([]);
  });
});

describe('alignLyrics (com letra: alinha o texto fornecido ao que foi ouvido)', () => {
  const lyrics = ['eu vou seguir', 'sem olhar pra trás', 'o dia vai nascer'];

  it('casa palavra a palavra e cada verso ganha início e fim', () => {
    const words = [w('eu', 1), w('vou', 1.5), w('seguir', 2), w('sem', 4), w('olhar', 4.5), w('pra', 5), w('trás', 5.5), w('o', 8), w('dia', 8.3), w('vai', 8.6), w('nascer', 9)];
    const out = alignLyrics(lyrics, words);
    expect(out.map((line) => line.text)).toEqual(lyrics);
    expect(out[0]).toMatchObject({ start: 1, end: 2.4 });
    expect(out[1]!.start).toBe(4);
    expect(out[2]!.end).toBeCloseTo(9.4, 6);
    expect(out[1]!.words.map((word) => word.text)).toEqual(['sem', 'olhar', 'pra', 'trás']);
  });

  it('tolera erro de transcrição e palavra faltando', () => {
    const words = [w('eu', 1), w('vo', 1.5), w('segiur', 2), w('sem', 4), w('pra', 5), w('tras', 5.5), w('dia', 8.3), w('vai', 8.6), w('nascer', 9)];
    const out = alignLyrics(lyrics, words);
    expect(out[0]!.start).toBe(1);
    expect(out[1]!.start).toBe(4);
    expect(out[1]!.end).toBeCloseTo(5.9, 6);
    expect(out[2]!.start).toBeGreaterThanOrEqual(7.9);
  });

  it('verso que não foi ouvido recebe tempo entre os vizinhos', () => {
    const words = [w('eu', 1), w('vou', 1.5), w('seguir', 2), w('o', 10), w('dia', 10.3), w('vai', 10.6), w('nascer', 11)];
    const out = alignLyrics(lyrics, words);
    expect(out[1]!.start).toBeGreaterThanOrEqual(out[0]!.end);
    expect(out[1]!.end).toBeLessThanOrEqual(out[2]!.start + 1e-9);
    expect(out[1]!.end).toBeGreaterThan(out[1]!.start);
  });

  it('tempos sempre crescentes', () => {
    const words = [w('eu', 1), w('vou', 1.5), w('seguir', 2), w('sem', 4), w('olhar', 4.5), w('pra', 5), w('trás', 5.5)];
    const out = alignLyrics(lyrics, words);
    out.forEach((line, i) => {
      expect(line.end).toBeGreaterThan(line.start);
      if (i > 0) expect(line.start).toBeGreaterThanOrEqual(out[i - 1]!.start);
    });
  });

  it('sem nenhuma palavra ouvida devolve vazio (quem chama usa spreadLyrics)', () => {
    expect(alignLyrics(lyrics, [])).toEqual([]);
  });
});

describe('spreadLyrics (letra sem nada para alinhar)', () => {
  it('distribui os versos no intervalo, proporcional ao tamanho', () => {
    const out = spreadLyrics(['a b', 'c d e f'], 10, 40);
    expect(out[0]!.start).toBe(10);
    expect(out[1]!.end).toBeCloseTo(40, 6);
    expect(out[0]!.end - out[0]!.start).toBeCloseTo(10, 6);
    expect(out[1]!.end - out[1]!.start).toBeCloseTo(20, 6);
  });
});

describe('alignLyrics: palavra solta longe do resto do verso é descartada', () => {
  it('um "se" que casou com o verso seguinte não estica o verso', () => {
    const lyrics = ['se eu pudesse voltar atras', 'e rasgar esse meu orgulho'];
    const words = [w('se', 5), w('eu', 5.4), w('pudesse', 5.8), w('voltar', 6.3), w('atras', 6.8), w('e', 9), w('rasgar', 9.4), w('esse', 9.9), w('meu', 10.2), w('orgulho', 10.6)];
    const ok = alignLyrics(lyrics, words);
    // mesmo com um "se" perdido lá na frente, o primeiro verso fica em torno de 5–7 s
    const noisy = alignLyrics(lyrics, [...words, w('se', 30)]);
    expect(noisy[0]!.start).toBeCloseTo(ok[0]!.start, 6);
    expect(noisy[0]!.end).toBeLessThan(8);
    expect(noisy[1]!.start).toBeGreaterThanOrEqual(noisy[0]!.end - 1e-6);
  });
});
