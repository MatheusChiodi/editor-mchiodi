import type { Flag, Phrase, Span, Word } from '../analyze/types.ts';
import type { Config } from '../config.ts';
import { quantize, round3 } from '../lib/time.ts';
import type { Removal } from './schema.ts';

export interface AutocutInput {
  words: Word[];
  phrases: Phrase[];
  flags: Flag[];
  silences: Span[];
  durationSec: number;
  fps: number;
  cuts: Config['cuts'];
}

export interface AutocutResult {
  clips: { id: string; start: number; end: number; quote: string; reason: string }[];
  removed: Removal[];
}

const SENTENCE_END = /[.!?…]["')]?$/;

/** Quanto de um intervalo é silêncio detectado. */
export function silentSeconds(span: Span, silences: Span[]): number {
  let total = 0;
  for (const silence of silences) total += Math.max(0, Math.min(span.end, silence.end) - Math.max(span.start, silence.start));
  return total;
}

function overlapsAny(span: Span, others: Span[]): Span | undefined {
  return others.find((other) => span.start < other.end - 1e-6 && span.end > other.start + 1e-6);
}

/**
 * Corte-base: remove trechos flagados (retake, marcador, hesitação) e encurta pausas,
 * sempre cortando em fronteira de palavra e, quando há silêncio detectado, dentro dele.
 * É o ponto de partida do diretor, não a edição final.
 */
export function autocut(input: AutocutInput): AutocutResult {
  const { words, cuts, fps } = input;
  const applied = input.flags
    .filter((flag) => flag.kind !== 'voiced-gap' && flag.confidence >= cuts.minFlagConfidence)
    .sort((a, b) => a.start - b.start);

  const kept = words.filter((word) => {
    const middle = (word.start + word.end) / 2;
    return !applied.some((flag) => middle >= flag.start && middle < flag.end);
  });
  if (kept.length === 0) throw new Error('Nenhuma palavra sobrou depois dos cortes automáticos');

  const sentenceEnds = new Set(input.phrases.map((phrase) => phrase.to - 1));
  const indexOf = new Map(words.map((word, index) => [word, index]));

  // 1. agrupa palavras mantidas em blocos contínuos de fala
  const blocks: { first: Word; last: Word; endsSentence: boolean }[] = [];
  for (const word of kept) {
    const block = blocks.at(-1);
    const endsSentence = sentenceEnds.has(indexOf.get(word)!) || SENTENCE_END.test(word.text);
    if (!block) {
      blocks.push({ first: word, last: word, endsSentence });
      continue;
    }
    const gap = word.start - block.last.end;
    const maxPause = block.endsSentence ? cuts.maxPauseBetweenPhrases : cuts.maxPauseInPhrase;
    const between = { start: block.last.end, end: word.start };
    const flagBetween = overlapsAny(between, applied);
    // intervalo longo mas com som (palavra esticada, respiro, "ééé" não transcrito): cortar ali
    // corta em cima de áudio. Só encurta pausa onde há silêncio medido; o resto fica como sugestão.
    const cuttable = gap > maxPause && silentSeconds(between, input.silences) >= cuts.minSilenceSec;
    if (!cuttable && !flagBetween) {
      block.last = word;
      block.endsSentence = endsSentence;
    } else {
      blocks.push({ first: word, last: word, endsSentence });
    }
  }

  // 2. cada bloco vira um clipe com respiro nas bordas, sem invadir palavra vizinha
  const raw = blocks.map((block, index) => {
    const previousLimit = index === 0 ? 0 : limitAfter(words, indexOf.get(block.first)! - 1);
    const nextLimit = limitBefore(words, indexOf.get(block.last)! + 1, input.durationSec);
    const padOut = block.endsSentence ? cuts.sentencePadOut : cuts.padOut;
    const start = snapIn(block.first.start, previousLimit, cuts.padIn, input.silences);
    const end = snapOut(block.last.end, nextLimit, padOut, input.silences);
    return { start, end, first: block.first, last: block.last };
  });

  // 3. quantiza, funde sobreposições e clipes curtos demais
  const merged: typeof raw = [];
  for (const clip of raw) {
    const start = quantize(clip.start, fps, 'floor');
    const end = quantize(clip.end, fps, 'ceil');
    const previous = merged.at(-1);
    const gapIsFlagged = previous && overlapsAny({ start: previous.end, end: start }, applied);
    const tooShort = end - start < cuts.minClipSec && previous && start - previous.end < 0.25 && !gapIsFlagged;
    if (previous && (start <= previous.end + 1 / fps || tooShort)) {
      previous.end = Math.max(previous.end, end);
      previous.last = clip.last;
    } else {
      merged.push({ ...clip, start, end });
    }
  }

  const keptSet = new Set(kept);
  const clips = merged.map((clip, index) => {
    const from = indexOf.get(clip.first)!;
    const to = indexOf.get(clip.last)!;
    const quote = words
      .slice(from, to + 1)
      .filter((word) => keptSet.has(word))
      .map((word) => word.text)
      .join(' ');
    return {
      id: `c${String(index + 1).padStart(3, '0')}`,
      start: round3(Math.max(0, clip.start)),
      end: round3(Math.min(input.durationSec, clip.end)),
      quote: quote.length > 90 ? `${quote.slice(0, 87)}...` : quote,
      reason: '',
    };
  });

  return { clips, removed: describeRemovals(clips, applied, input.durationSec) };
}

/** Fim da palavra anterior: o clipe não pode começar antes disso. */
function limitAfter(words: Word[], index: number): number {
  return index >= 0 ? words[index]!.end : 0;
}

function limitBefore(words: Word[], index: number, durationSec: number): number {
  return index < words.length ? words[index]!.start : durationSec;
}

const MAX_TAIL = 0.3;
const GUARD = 0.02;

/**
 * Quanto entrar no silêncio antes de cortar: o bastante para o som morrer de vez (o fim da fala
 * decai abaixo do limiar antes de sumir), sem passar do meio de um silêncio curto.
 */
export function breathInside(silence: Span): number {
  return Math.min(0.12, (silence.end - silence.start) / 2);
}

/**
 * Fim do clipe. O alinhamento pode encerrar a palavra antes do som acabar; se existe um
 * silêncio medido logo depois, o corte entra nele em vez de confiar só no timestamp.
 */
function snapOut(wordEnd: number, nextWordStart: number, pad: number, silences: Span[]): number {
  const ceiling = Math.max(wordEnd, nextWordStart - GUARD);
  let end = wordEnd + pad;
  const silence = silences.find((span) => span.end > wordEnd && span.start < wordEnd + MAX_TAIL);
  if (silence && silence.start > wordEnd) end = Math.max(end, silence.start + breathInside(silence));
  return Math.min(end, wordEnd + Math.max(pad, MAX_TAIL), ceiling);
}

function snapIn(wordStart: number, previousWordEnd: number, pad: number, silences: Span[]): number {
  const floor = Math.min(wordStart, previousWordEnd + GUARD);
  let start = wordStart - pad;
  const silence = silences.findLast((span) => span.start < wordStart && span.end > wordStart - MAX_TAIL);
  if (silence && silence.end < wordStart) start = Math.min(start, silence.end - breathInside(silence));
  return Math.max(start, wordStart - Math.max(pad, MAX_TAIL), floor, 0);
}

/** Lista o que saiu, com o motivo, para o relatório. */
function describeRemovals(clips: Span[], applied: Flag[], durationSec: number): Removal[] {
  const removed: Removal[] = [];
  const gaps: Span[] = [];
  let cursor = 0;
  for (const clip of clips) {
    if (clip.start - cursor > 0.01) gaps.push({ start: cursor, end: clip.start });
    cursor = clip.end;
  }
  if (durationSec - cursor > 0.01) gaps.push({ start: cursor, end: durationSec });

  for (const gap of gaps) {
    const flag = applied
      .filter((item) => item.start < gap.end && item.end > gap.start)
      .sort((a, b) => b.end - b.start - (a.end - a.start))[0];
    removed.push({
      start: round3(gap.start),
      end: round3(gap.end),
      kind: flag ? (flag.kind === 'restart' ? 'retake' : (flag.kind as Removal['kind'])) : 'silence',
      reason: flag ? flag.reason : `pausa de ${(gap.end - gap.start).toFixed(2)}s encurtada`,
    });
  }
  return removed;
}
