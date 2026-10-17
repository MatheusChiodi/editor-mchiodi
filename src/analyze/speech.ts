import { round3 } from '../lib/time.ts';
import type { Flag, Phrase, Span, Word } from './types.ts';

/** Minúsculas, sem acento e sem pontuação: base de toda comparação de fala. */
export function normalizeToken(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const SENTENCE_END = /[.!?…]["')]?$/;

export interface PhraseOptions {
  /** pausa que separa frases */
  pauseSplit: number;
  /** frase longa demais quebra na próxima vírgula */
  maxDuration: number;
}

export function buildPhrases(words: Word[], options: PhraseOptions = { pauseSplit: 0.45, maxDuration: 12 }): Phrase[] {
  const phrases: Phrase[] = [];
  let from = 0;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const next = words[index + 1];
    const gap = next ? next.start - word.end : Infinity;
    const duration = word.end - words[from]!.start;
    const boundary =
      !next ||
      gap >= options.pauseSplit ||
      SENTENCE_END.test(word.text) ||
      (duration >= options.maxDuration && /,$/.test(word.text));
    if (!boundary) continue;
    phrases.push({
      id: `P${String(phrases.length + 1).padStart(3, '0')}`,
      from,
      to: index + 1,
      start: words[from]!.start,
      end: word.end,
      text: words
        .slice(from, index + 1)
        .map((item) => item.text)
        .join(' '),
      pauseAfter: next ? round3(Math.max(0, gap)) : 0,
    });
    from = index + 1;
  }
  return phrases;
}

function levenshtein<T>(a: T[], b: T[]): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j]!;
      row[j] = Math.min(above + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length]!;
}

/** Similaridade (0-1) entre o começo de duas frases, em tokens. */
export function prefixSimilarity(a: string[], b: string[], maxTokens = 6): number {
  const size = Math.min(a.length, b.length, maxTokens);
  if (size === 0) return 0;
  return 1 - levenshtein(a.slice(0, size), b.slice(0, size)) / size;
}

function phraseTokens(phrase: Phrase, words: Word[]): string[] {
  return words
    .slice(phrase.from, phrase.to)
    .map((word) => normalizeToken(word.text))
    .filter(Boolean);
}

export interface RetakeOptions {
  minTokens: number;
  minSimilarity: number;
  /** distância máxima entre o fim da tentativa e o início da regravação */
  maxGapSec: number;
}

const RETAKE_DEFAULTS: RetakeOptions = { minTokens: 3, minSimilarity: 0.67, maxGapSec: 20 };

/**
 * Retake = frase que recomeça igual à anterior. Mantém a ÚLTIMA versão e marca as
 * anteriores para corte. Uma interjeição curta no meio ("não", "de novo") vai junto.
 */
export function detectRetakes(phrases: Phrase[], words: Word[], options: Partial<RetakeOptions> = {}): Flag[] {
  const config = { ...RETAKE_DEFAULTS, ...options };
  const tokens = phrases.map((phrase) => phraseTokens(phrase, words));
  const flags: Flag[] = [];
  for (let index = 0; index < phrases.length - 1; index += 1) {
    const current = tokens[index]!;
    if (current.length < config.minTokens) continue;
    for (const offset of [1, 2]) {
      const candidate = phrases[index + offset];
      const candidateTokens = tokens[index + offset];
      if (!candidate || !candidateTokens) break;
      if (candidate.start - phrases[index]!.end > config.maxGapSec) break;
      // só pula uma frase se ela for uma interjeição curta
      if (offset === 2 && tokens[index + 1]!.length > 3) break;
      if (candidateTokens.length < config.minTokens) continue;
      const similarity = prefixSimilarity(current, candidateTokens);
      if (similarity < config.minSimilarity) continue;
      flags.push({
        kind: 'retake',
        start: phrases[index]!.start,
        end: candidate.start,
        confidence: round3(Math.min(0.95, similarity)),
        reason: `${phrases[index]!.id} recomeça em ${candidate.id}: mantida a última versão`,
      });
      break;
    }
  }
  return flags;
}

/** Recomeço no meio da frase: "o React usa o... o React usa um virtual DOM". */
export function detectRestarts(phrases: Phrase[], words: Word[]): Flag[] {
  const flags: Flag[] = [];
  for (const phrase of phrases) {
    const slice = words.slice(phrase.from, phrase.to);
    const tokens = slice.map((word) => normalizeToken(word.text));
    let index = 0;
    while (index < tokens.length) {
      const match = findRepeat(tokens, index);
      if (!match) {
        index += 1;
        continue;
      }
      const first = slice[index]!;
      const again = slice[match.at]!;
      flags.push({
        kind: 'restart',
        start: first.start,
        end: again.start,
        confidence: match.size >= 3 ? 0.9 : match.size === 2 ? 0.72 : 0.5,
        reason: `recomeço em ${phrase.id}: "${slice
          .slice(index, match.at)
          .map((word) => word.text)
          .join(' ')}" repetido logo depois`,
      });
      index = match.at;
    }
  }
  return flags;
}

function findRepeat(tokens: string[], start: number): { at: number; size: number } | null {
  for (const size of [4, 3, 2, 1]) {
    if (start + size > tokens.length) continue;
    const gram = tokens.slice(start, start + size);
    if (gram.some((token) => !token)) continue;
    // n-grama de 2 só com palavras de 1-2 letras ("o a", "é o") repete naturalmente
    if (size === 2 && gram.every((token) => token.length <= 2)) continue;
    if (size === 1 && gram[0]!.length < 2) continue;
    const maxOffset = size === 1 ? 1 : size + 3;
    for (let at = start + size; at <= start + maxOffset && at + size <= tokens.length; at += 1) {
      if (gram.every((token, offset) => tokens[at + offset] === token)) return { at, size };
    }
  }
  return null;
}

const MARKER_WORDS = new Set(['corta', 'cortar', 'cortaisso', 'cortaai']);

/** Marcador verbal: uma frase que é só "corta" descarta a frase anterior e o próprio marcador. */
export function detectMarkers(phrases: Phrase[], words: Word[]): Flag[] {
  const flags: Flag[] = [];
  phrases.forEach((phrase, index) => {
    const tokens = phraseTokens(phrase, words);
    if (tokens.length === 0 || tokens.length > 3) return;
    if (!MARKER_WORDS.has(tokens[0]!) && !MARKER_WORDS.has(tokens.join(''))) return;
    const previous = phrases[index - 1];
    flags.push({
      kind: 'marker',
      start: previous ? previous.start : phrase.start,
      end: phrase.end,
      confidence: 0.95,
      reason: previous
        ? `marcador "corta" em ${phrase.id}: descartada ${previous.id}`
        : `marcador "corta" em ${phrase.id}`,
    });
  });
  return flags;
}

// "um" e "a" são palavras: só entram formas que não existem em português ("uhm", "hum", "ahn")
const FILLER = /^(e{2,}|e+h+|h+u+m+|h+m+|u+h+m*|a+h+n*|a+n+|h+a+n+)$/;

/** "ééé", "hum", "ahn". O "é" simples só conta se for alongado e isolado por pausas. */
export function detectFillers(words: Word[]): Flag[] {
  const flags: Flag[] = [];
  words.forEach((word, index) => {
    const token = normalizeToken(word.text);
    if (!token) return;
    const duration = word.end - word.start;
    const gapBefore = index > 0 ? word.start - words[index - 1]!.end : 1;
    const gapAfter = index < words.length - 1 ? words[index + 1]!.start - word.end : 1;
    let confidence = 0;
    if (FILLER.test(token)) confidence = 0.9;
    else if (token === 'e' && /(\.\.\.|…)$/.test(word.text)) confidence = 0.8;
    else if (token === 'e' && duration >= 0.45 && (gapBefore >= 0.15 || gapAfter >= 0.15)) confidence = 0.6;
    if (confidence === 0) return;
    flags.push({
      kind: 'filler',
      start: word.start,
      end: word.end,
      confidence,
      reason: `hesitação "${word.text}" (${duration.toFixed(2)}s)`,
    });
  });
  return flags;
}

/**
 * Som sem palavra: intervalo entre palavras que NÃO é silêncio. O Whisper costuma omitir
 * "ééé", respiros e risadas; aqui eles aparecem como hipótese para o diretor conferir.
 */
export function detectVoicedGaps(words: Word[], silences: Span[], minGap = 0.4, minVoiced = 0.3): Flag[] {
  const flags: Flag[] = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    const start = words[index]!.end;
    const end = words[index + 1]!.start;
    if (end - start < minGap) continue;
    let silent = 0;
    for (const silence of silences) {
      silent += Math.max(0, Math.min(end, silence.end) - Math.max(start, silence.start));
    }
    const voiced = end - start - silent;
    if (voiced < minVoiced) continue;
    flags.push({
      kind: 'voiced-gap',
      start: round3(start),
      end: round3(end),
      confidence: 0.5,
      reason: `${voiced.toFixed(2)}s de som sem palavra transcrita (possível "ééé", respiro ou risada)`,
    });
  }
  return flags;
}
