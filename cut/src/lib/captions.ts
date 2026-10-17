/**
 * Painel de legendas: as palavras que aparecem no vídeo final, paginadas como o render pagina (buildCaptions),
 * com a grafia exibida (replacements) e o destaque (highlights). Correção vale para toda ocorrência do token.
 */
import { normalizeToken } from '../../../src/analyze/speech.ts';
import type { Word } from '../../../src/analyze/types.ts';
import type { CutOp } from '../../../src/cut/ops.ts';
import type { CaptionSettings } from '../../../src/edl/schema.ts';
import type { Timeline } from '../../../src/edl/timeline.ts';
import { buildCaptions, captionSpan, displayText } from '../../../src/render/captions.ts';

export interface CaptionWord {
  /** índice na transcrição */
  index: number;
  /** como foi transcrita */
  raw: string;
  /** como aparece na tela */
  shown: string;
  replaced: boolean;
  highlighted: boolean;
  /** segundos da fonte */
  start: number;
  /** segundos de saída */
  outputStart: number;
}

export interface CaptionPage {
  words: CaptionWord[];
  outputStart: number;
}

type CaptionInput = Pick<Word, 'text' | 'start' | 'end'> & { score?: number };

export function captionPages(words: CaptionInput[], timeline: Timeline, settings: CaptionSettings): CaptionPage[] {
  const highlights = new Set(settings.highlights.map(normalizeToken));
  const replacements = new Map(Object.entries(settings.replacements).map(([from, to]) => [normalizeToken(from), to]));
  // mesma filtragem do buildCaptions, para casar palavra a palavra com a paginação dele
  const shownWords: CaptionWord[] = [];
  words.forEach((word, index) => {
    const span = captionSpan(word, timeline);
    if (!span) return;
    const token = normalizeToken(word.text);
    const replacement = replacements.get(token);
    const shown = replacement ?? displayText(word.text);
    if (!shown) return;
    shownWords.push({ index, raw: word.text, shown, replaced: replacement !== undefined, highlighted: highlights.has(token), start: word.start, outputStart: span.start });
  });
  const captions = buildCaptions(
    words.map((word) => ({ ...word, score: word.score ?? 1 })) as Word[],
    timeline,
    { ...settings, enabled: true },
  );
  const pages: CaptionPage[] = [];
  let current: CaptionWord[] = [];
  shownWords.forEach((word, position) => {
    current.push(word);
    if (captions[position]?.pageBreakAfter || position === shownWords.length - 1) {
      pages.push({ words: current, outputStart: current[0]!.outputStart });
      current = [];
    }
  });
  return pages;
}

/** Edição inline de uma palavra → `captionReplace` (vazio ou igual à transcrição desfaz a correção). */
export function replaceOp(word: Pick<CaptionWord, 'raw' | 'shown' | 'replaced'>, typed: string): CutOp | null {
  const text = typed.trim();
  if (text === word.shown) return null;
  if (text === '' || text === displayText(word.raw)) return word.replaced ? { type: 'captionReplace', from: word.raw, to: null } : null;
  if (!normalizeToken(word.raw)) return null;
  return { type: 'captionReplace', from: displayText(word.raw) || word.raw, to: text };
}

/** O render compara o destaque com o token TRANSCRITO (antes da correção), então é ele que vai para `highlights`. */
export function highlightOp(word: Pick<CaptionWord, 'raw' | 'highlighted'>): CutOp | null {
  const text = displayText(word.raw) || word.raw;
  if (!normalizeToken(text)) return null;
  return { type: 'captionHighlight', word: text, on: !word.highlighted };
}

/** Página que está na tela no instante de saída `t`. */
export function pageAt(pages: CaptionPage[], t: number): number {
  let found = -1;
  pages.forEach((page, index) => {
    if (page.outputStart <= t + 1e-6) found = index;
  });
  return found;
}
