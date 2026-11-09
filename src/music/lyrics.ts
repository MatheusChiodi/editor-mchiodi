import type { Word } from '../analyze/types.ts';
import { normalizeText } from '../motion/insert.ts';

export interface LyricWord {
  text: string;
  start: number;
  end: number;
}

export interface LyricLine {
  text: string;
  start: number;
  end: number;
  words: LyricWord[];
}

/** Um verso por linha; some linha vazia e marcação de seção como `[Refrão]` ou `(Verso 2)`. */
export function parseLyrics(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !/^[[(].*[\])]$/.test(line));
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = up;
    }
  }
  return row[b.length]!;
}

/** 0–1: 1 para palavras iguais sem acento e caixa; letra trocada ou faltando ainda pontua alto. */
export function tokenSimilarity(a: string, b: string): number {
  const x = normalizeText(a).replace(/ /g, '');
  const y = normalizeText(b).replace(/ /g, '');
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Sem letra: agrupa o que a transcrição ouviu em versos, quebrando em pausa longa ou em `maxWords` palavras. */
export function linesFromWords(words: Word[], options: { maxGap?: number; maxWords?: number } = {}): LyricLine[] {
  const { maxGap = 0.7, maxWords = 8 } = options;
  const lines: LyricLine[] = [];
  let current: Word[] = [];
  const flush = () => {
    if (current.length === 0) return;
    lines.push({
      text: current.map((word) => word.text).join(' '),
      start: current[0]!.start,
      end: current.at(-1)!.end,
      words: current.map((word) => ({ text: word.text, start: word.start, end: word.end })),
    });
    current = [];
  };
  for (const word of words) {
    const last = current.at(-1);
    if (last && (word.start - last.end > maxGap || current.length >= maxWords)) flush();
    current.push(word);
  }
  flush();
  return lines;
}

interface Token {
  text: string;
  norm: string;
  line: number;
}

/**
 * Alinha a letra fornecida ao que a transcrição ouviu (Needleman–Wunsch sobre palavras, com casamento aproximado):
 * cada palavra da letra herda o tempo da palavra ouvida que casou. Verso sem nenhuma palavra casada ganha tempo
 * interpolado entre os vizinhos. Sem palavras ouvidas devolve vazio.
 */
export function alignLyrics(lyrics: string[], words: Word[]): LyricLine[] {
  const heard = words.map((word) => ({ word, norm: normalizeText(word.text).replace(/ /g, '') })).filter((item) => item.norm);
  if (lyrics.length === 0 || heard.length === 0) return [];

  const tokens: Token[] = lyrics.flatMap((line, index) =>
    line
      .split(/\s+/)
      .map((text) => ({ text, norm: normalizeText(text).replace(/ /g, ''), line: index }))
      .filter((token) => token.norm),
  );
  const n = tokens.length;
  const m = heard.length;
  const GAP = -1;
  const score = (i: number, j: number) => {
    const similarity = tokenSimilarity(tokens[i]!.norm, heard[j]!.norm);
    return similarity >= 0.99 ? 2 : similarity >= 0.6 ? 1 : -1;
  };

  // programação dinâmica: dp[i][j] = melhor alinhamento de tokens[0..i) com heard[0..j)
  const dp = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  for (let i = 1; i <= n; i++) dp[i]![0] = i * GAP;
  for (let j = 1; j <= m; j++) dp[0]![j] = j * GAP;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i]![j] = Math.max(dp[i - 1]![j - 1]! + score(i - 1, j - 1), dp[i - 1]![j]! + GAP, dp[i]![j - 1]! + GAP);
    }
  }
  const matched = new Array<number>(n).fill(-1);
  for (let i = n, j = m; i > 0 && j > 0; ) {
    if (dp[i]![j] === dp[i - 1]![j - 1]! + score(i - 1, j - 1)) {
      if (score(i - 1, j - 1) > 0) matched[i - 1] = j - 1;
      i--;
      j--;
    } else if (dp[i]![j] === dp[i - 1]![j]! + GAP) i--;
    else j--;
  }

  // palavra solta casada longe do resto do verso (um "se" que pegou o verso seguinte) estica o verso: fica só o maior grupo
  const MAX_INNER_GAP = 2.5;
  for (let line = 0; line < lyrics.length; line++) {
    const hits = tokens
      .map((token, index) => ({ token, index }))
      .filter(({ token, index }) => token.line === line && matched[index]! >= 0)
      .map(({ index }) => ({ index, time: heard[matched[index]!]!.word.start }))
      .sort((a, b) => a.time - b.time);
    if (hits.length < 2) continue;
    const groups: (typeof hits)[] = [[hits[0]!]];
    for (const hit of hits.slice(1)) {
      const group = groups.at(-1)!;
      if (hit.time - group.at(-1)!.time > MAX_INNER_GAP) groups.push([hit]);
      else group.push(hit);
    }
    if (groups.length === 1) continue;
    const keep = groups.reduce((best, group) => (group.length > best.length ? group : best));
    for (const hit of hits) if (!keep.includes(hit)) matched[hit.index] = -1;
  }

  // tempo por verso a partir dos tokens casados
  const spans = lyrics.map((_, line) => {
    const times = tokens.flatMap((token, index) => (token.line === line && matched[index]! >= 0 ? [heard[matched[index]!]!.word] : []));
    return times.length ? { start: Math.min(...times.map((t) => t.start)), end: Math.max(...times.map((t) => t.end)) } : null;
  });
  if (spans.every((span) => span === null)) return [];

  // versos sem casamento: interpolação entre o fim do vizinho anterior e o início do seguinte, proporcional ao tamanho
  const weight = (line: number) => Math.max(1, tokens.filter((token) => token.line === line).length);
  for (let line = 0; line < lyrics.length; line++) {
    if (spans[line]) continue;
    let from = line;
    while (from > 0 && !spans[from - 1]) from--;
    let to = line;
    while (to < lyrics.length - 1 && !spans[to + 1]) to++;
    const before = from > 0 ? spans[from - 1]!.end : null;
    const after = to < lyrics.length - 1 ? spans[to + 1]!.start : null;
    const group = Array.from({ length: to - from + 1 }, (_, k) => from + k);
    const total = group.reduce((sum, g) => sum + weight(g), 0);
    const gapStart = before ?? Math.max(0, (after ?? 0) - total * 0.5);
    const gapEnd = after ?? gapStart + total * 0.5;
    let cursor = gapStart;
    for (const g of group) {
      const length = ((gapEnd - gapStart) * weight(g)) / total;
      spans[g] = { start: cursor, end: cursor + length };
      cursor += length;
    }
    line = to;
  }

  return lyrics.map((text, line) => {
    const span = spans[line]!;
    const own = tokens.map((token, index) => ({ token, index })).filter(({ token }) => token.line === line);
    // palavras: tempo do casamento; as sem casamento dividem o que sobra do verso
    const lineWords: LyricWord[] = own.map(({ token, index }, k) => {
      const hit = matched[index]! >= 0 ? heard[matched[index]!]!.word : null;
      const slot = (span.end - span.start) / own.length;
      return hit ? { text: token.text, start: hit.start, end: hit.end } : { text: token.text, start: span.start + k * slot, end: span.start + (k + 1) * slot };
    });
    return { text, start: round3(span.start), end: round3(Math.max(span.end, span.start + 0.3)), words: lineWords.map((word) => ({ ...word, start: round3(word.start), end: round3(word.end) })) };
  });
}

/** Letra sem nada para alinhar (instrumental na transcrição): distribui os versos no intervalo, proporcional ao tamanho. */
export function spreadLyrics(lyrics: string[], start: number, end: number): LyricLine[] {
  const sizes = lyrics.map((line) => Math.max(1, line.split(/\s+/).length));
  const total = sizes.reduce((a, b) => a + b, 0);
  let cursor = start;
  return lyrics.map((text, index) => {
    const length = ((end - start) * sizes[index]!) / total;
    const lineStart = cursor;
    cursor += length;
    const parts = text.split(/\s+/);
    return {
      text,
      start: round3(lineStart),
      end: round3(cursor),
      words: parts.map((part, k) => ({ text: part, start: round3(lineStart + (length * k) / parts.length), end: round3(lineStart + (length * (k + 1)) / parts.length) })),
    };
  });
}
