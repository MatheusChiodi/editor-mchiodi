import { pageLimits } from '../../motion/src/captions/presets.ts';
import type { StyledCaption } from '../../motion/src/types.ts';
import { normalizeToken } from '../analyze/speech.ts';
import type { Word } from '../analyze/types.ts';
import type { CaptionSettings } from '../edl/schema.ts';
import { mapSpan, type Timeline } from '../edl/timeline.ts';

const SENTENCE_END = /[.!?…]["')]?$/;
/** pausa que encerra a página mesmo no meio da frase */
const PAGE_GAP_MS = 550;

/** Texto exibido: sem vírgula/ponto final (poluem a tela), mantendo ? e !. */
export function displayText(word: string): string {
  return word.replace(/[.,;:…]+$/g, '').replace(/^["'(]+|["')]+$/g, '');
}

/** Onde a palavra aparece no vídeo final, ou `null` se foi cortada (ou sobrou só uma lasca dela depois do corte). */
export function captionSpan(word: Pick<Word, 'start' | 'end'>, timeline: Timeline): { start: number; end: number } | null {
  const span = mapSpan(timeline, word);
  if (!span) return null;
  const length = word.end - word.start;
  return span.end - span.start < Math.min(0.08, length * 0.5) ? null : span;
}

/**
 * Converte as palavras da transcrição (tempo da fonte) em legendas no tempo do vídeo final.
 * Palavras cortadas somem; a paginação respeita frase, pausa, corte e largura.
 */
export function buildCaptions(words: Word[], timeline: Timeline, settings: CaptionSettings): StyledCaption[] {
  if (!settings.enabled) return [];
  const highlights = new Set(settings.highlights.map(normalizeToken));
  const replacements = new Map(Object.entries(settings.replacements).map(([from, to]) => [normalizeToken(from), to]));

  const captions: (StyledCaption & { sentenceEnd: boolean; comma: boolean })[] = [];
  for (const word of words) {
    const span = captionSpan(word, timeline);
    if (!span) continue;
    const token = normalizeToken(word.text);
    const text = replacements.get(token) ?? displayText(word.text);
    if (!text) continue;
    const previous = captions.at(-1);
    const startMs = Math.max(Math.round(span.start * 1000), previous ? previous.endMs : 0);
    const endMs = Math.max(Math.round(span.end * 1000), startMs + 40);
    captions.push({
      text: ` ${text}`,
      startMs,
      endMs,
      timestampMs: Math.round((startMs + endMs) / 2),
      confidence: word.score,
      highlight: highlights.has(token),
      sentenceEnd: SENTENCE_END.test(word.text),
      comma: /[,;:]$/.test(word.text),
    });
  }

  // o estilo só aperta a página (bold-shorts: até 3 palavras), nunca afrouxa o que a EDL pediu
  const { maxWords, maxChars } = pageLimits(settings.preset, settings.style, settings.maxWordsPerPage);
  let count = 0;
  let chars = 0;
  captions.forEach((caption, index) => {
    const next = captions[index + 1];
    count += 1;
    chars += caption.text.length;
    const nextTooWide = next ? chars + next.text.length > maxChars : false;
    const breakHere =
      !next ||
      caption.sentenceEnd ||
      count >= maxWords ||
      nextTooWide ||
      next.startMs - caption.endMs > PAGE_GAP_MS ||
      (caption.comma && count >= 3);
    if (breakHere) {
      caption.pageBreakAfter = true;
      count = 0;
      chars = 0;
    }
  });

  return captions.map(({ sentenceEnd: _sentenceEnd, comma: _comma, ...caption }) => caption);
}
