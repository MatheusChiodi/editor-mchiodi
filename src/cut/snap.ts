import type { Span, Word } from '../analyze/types.ts';
import { round3 } from '../lib/time.ts';

/** O que o editor sabe da fala para decidir onde um corte pode ficar (tudo em segundos da fonte). */
export interface SpeechContext {
  words: Pick<Word, 'text' | 'start' | 'end'>[];
  silences: Span[];
  durationSec: number;
}

export interface SnapOptions {
  /** o editor não "teletransporta" a borda: mais longe que isso do pedido, recusa */
  maxShiftSec?: number;
  /** distância mínima da borda até a palavra vizinha (o eval acusa sem-respiro abaixo de 30 ms) */
  marginSec?: number;
}

export interface SnapResult {
  requested: number;
  /** borda válida mais próxima (igual ao pedido se ele já estava em silêncio medido) */
  time: number;
  shiftSec: number;
  /** palavra em que o pedido caía, se caía */
  insideWord: { text: string; start: number; end: number } | null;
  ok: boolean;
  warning: string | null;
}

export const SNAP_MAX_SHIFT_SEC = 1.5;
export const SNAP_MARGIN_SEC = 0.04;

/** Trechos de silêncio medido sem nenhuma palavra por cima (o alinhamento às vezes invade a borda do silêncio). */
export function freeSilences(context: Pick<SpeechContext, 'words' | 'silences'>): Span[] {
  const free: Span[] = [];
  for (const silence of context.silences) {
    let pieces: Span[] = [{ start: silence.start, end: silence.end }];
    for (const word of context.words) {
      if (word.end <= silence.start || word.start >= silence.end) continue;
      pieces = pieces.flatMap((piece) => {
        if (word.end <= piece.start || word.start >= piece.end) return [piece];
        const left = { start: piece.start, end: Math.min(piece.end, word.start) };
        const right = { start: Math.max(piece.start, word.end), end: piece.end };
        return [left, right].filter((part) => part.end - part.start > 1e-6);
      });
    }
    free.push(...pieces);
  }
  return free.sort((a, b) => a.start - b.start);
}

/** Onde uma borda pode ficar: o miolo de cada silêncio livre (com folga das palavras) e o começo/fim do arquivo. */
export function validEdgeSpans(context: SpeechContext, marginSec = SNAP_MARGIN_SEC): Span[] {
  const spans = freeSilences(context).map((span) => {
    const margin = Math.min(marginSec, (span.end - span.start) / 2);
    return { start: span.start + margin, end: span.end - margin };
  });
  const covered = (time: number) => context.words.some((word) => time > word.start && time < word.end);
  if (!covered(0)) spans.push({ start: 0, end: 0 });
  if (!covered(context.durationSec)) spans.push({ start: context.durationSec, end: context.durationSec });
  return spans.sort((a, b) => a.start - b.start);
}

export function wordAt(words: SpeechContext['words'], time: number): SpeechContext['words'][number] | null {
  return words.find((word) => time > word.start + 1e-6 && time < word.end - 1e-6) ?? null;
}

/**
 * Snap obrigatório: devolve a borda de corte válida mais próxima do instante pedido. Válida = dentro de um
 * silêncio medido, sem palavra por cima e com folga das vizinhas. Nunca dentro de palavra.
 */
export function snapEdge(requested: number, context: SpeechContext, options: SnapOptions = {}): SnapResult {
  const maxShift = options.maxShiftSec ?? SNAP_MAX_SHIFT_SEC;
  const clamped = Math.min(Math.max(requested, 0), context.durationSec);
  const inside = wordAt(context.words, clamped);
  let best: number | null = null;
  for (const span of validEdgeSpans(context, options.marginSec)) {
    const candidate = Math.min(Math.max(clamped, span.start), span.end);
    if (best === null || Math.abs(candidate - clamped) < Math.abs(best - clamped)) best = candidate;
  }
  const insideWord = inside ? { text: inside.text, start: inside.start, end: inside.end } : null;
  const where = insideWord ? `dentro de "${insideWord.text}" (${insideWord.start.toFixed(2)}–${insideWord.end.toFixed(2)}s)` : 'fora de silêncio medido';
  if (best === null || Math.abs(best - clamped) > maxShift) {
    return {
      requested,
      time: round3(clamped),
      shiftSec: 0,
      insideWord,
      ok: false,
      warning: `${requested.toFixed(2)}s cai ${where} e não há pausa medida a menos de ${maxShift}s; o corte não foi movido`,
    };
  }
  const time = round3(best);
  const shiftSec = round3(time - requested);
  const moved = Math.abs(time - requested) > 1e-3;
  return {
    requested,
    time,
    shiftSec,
    insideWord,
    ok: true,
    warning: moved ? `${requested.toFixed(2)}s caía ${where}; encaixado na pausa em ${time.toFixed(2)}s` : null,
  };
}
