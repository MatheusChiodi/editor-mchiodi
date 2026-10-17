import { normalizeToken } from '../analyze/speech.ts';
import type { Word } from '../analyze/types.ts';
import type { CaptionSettings } from '../edl/schema.ts';
import type { Timeline } from '../edl/timeline.ts';
import { buildCaptions, captionSpan, displayText } from './captions.ts';

export interface SrtCue {
  index: number;
  /** segundos do arquivo de vídeo (saída, já com a vinheta de abertura) */
  start: number;
  end: number;
  text: string;
}

function stamp(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

/**
 * Legendas no tempo de SAÍDA: as mesmas páginas que o render desenha (palavras + replacements + paginação
 * por `maxWordsPerPage`), deslocadas por `offsetSec` (a vinheta de abertura, quando há).
 */
export function buildSrtCues(words: Word[], timeline: Timeline, captions: CaptionSettings, offsetSec = 0): SrtCue[] {
  const styled = buildCaptions(words, timeline, { ...captions, enabled: true });
  const cues: SrtCue[] = [];
  let page: typeof styled = [];
  for (const caption of styled) {
    page.push(caption);
    if (!caption.pageBreakAfter) continue;
    cues.push({
      index: cues.length + 1,
      start: page[0]!.startMs / 1000 + offsetSec,
      end: page.at(-1)!.endMs / 1000 + offsetSec,
      text: page.map((item) => item.text.trim()).join(' '),
    });
    page = [];
  }
  return cues;
}

export function formatSrt(cues: SrtCue[]): string {
  return cues.map((cue, index) => `${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n');
}

export function buildSrt(words: Word[], timeline: Timeline, captions: CaptionSettings, offsetSec = 0): string {
  return formatSrt(buildSrtCues(words, timeline, captions, offsetSec));
}

function parseStamp(text: string): number {
  const match = /(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/.exec(text.trim());
  if (!match) throw new Error(`tempo de SRT inválido: "${text}"`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]!.padEnd(3, '0')) / 1000;
}

export function parseSrt(text: string): SrtCue[] {
  const blocks = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex < 0) continue;
    const [from, to] = lines[timeIndex]!.split('-->');
    cues.push({ index: cues.length + 1, start: parseStamp(from!), end: parseStamp(to!), text: lines.slice(timeIndex + 1).join(' ') });
  }
  return cues;
}

interface ShownToken {
  word: Word;
  shown: string;
  /** meio da palavra no vídeo de saída */
  mid: number;
}

/** Cada palavra legendada, com o texto que a tela mostra hoje e onde ela cai na saída. */
export function shownTokens(words: Word[], timeline: Timeline, captions: CaptionSettings): ShownToken[] {
  const replacements = new Map(Object.entries(captions.replacements).map(([from, to]) => [normalizeToken(from), to]));
  const tokens: ShownToken[] = [];
  for (const word of words) {
    const span = captionSpan(word, timeline);
    if (!span) continue;
    const shown = replacements.get(normalizeToken(word.text)) ?? displayText(word.text);
    if (!shown) continue;
    tokens.push({ word, shown, mid: (span.start + span.end) / 2 });
  }
  return tokens;
}

type Step = { kind: 'equal' | 'sub'; a: number; b: number } | { kind: 'del'; a: number } | { kind: 'ins'; b: number };

/** Alinhamento de Levenshtein entre duas listas de tokens (igualdade exata: caixa e acento contam como correção). */
export function alignTokens(a: string[], b: string[]): Step[] {
  const cost: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const same = a[i - 1] === b[j - 1] ? 0 : 1;
      cost[i]![j] = Math.min(cost[i - 1]![j - 1]! + same, cost[i - 1]![j]! + 1, cost[i]![j - 1]! + 1);
    }
  }
  const steps: Step[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && cost[i]![j] === cost[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      steps.push({ kind: a[i - 1] === b[j - 1] ? 'equal' : 'sub', a: i - 1, b: j - 1 });
      i -= 1;
      j -= 1;
    } else if (i > 0 && cost[i]![j] === cost[i - 1]![j]! + 1) {
      steps.push({ kind: 'del', a: i - 1 });
      i -= 1;
    } else {
      steps.push({ kind: 'ins', b: j - 1 });
      j -= 1;
    }
  }
  return steps.reverse();
}

export interface SrtImport {
  /** operações para o lote do editor (vão para `captions.replacements`) */
  ops: { type: 'captionReplace'; from: string; to: string | null }[];
  changes: { from: string; to: string; at: number }[];
  /** o que a correção pediu e não dá para expressar como troca de palavra (palavra apagada/inserida, várias → uma) */
  unmatched: string[];
}

const tokenize = (text: string) => text.split(/\s+/).map((token) => displayText(token)).filter(Boolean);

/**
 * Reimporta um SRT corrigido sem retranscrever: cada legenda é alinhada por tempo às palavras que ela cobre
 * e por diff de tokens ao texto novo. Troca 1:1 (ou 1 palavra → várias) vira replacement da palavra transcrita.
 * Replacement vale para todas as ocorrências da palavra (é assim que o render aplica).
 */
export function importSrt(text: string, words: Word[], timeline: Timeline, captions: CaptionSettings, offsetSec = 0): SrtImport {
  const cues = parseSrt(text).map((cue) => ({ ...cue, start: cue.start - offsetSec, end: cue.end - offsetSec }));
  const tokens = shownTokens(words, timeline, captions);
  const byCue = new Map<number, ShownToken[]>();
  for (const token of tokens) {
    const cue = cues.find((item) => token.mid >= item.start - 1e-3 && token.mid <= item.end + 1e-3);
    if (!cue) continue;
    byCue.set(cue.index, [...(byCue.get(cue.index) ?? []), token]);
  }

  const decided = new Map<string, { from: string; to: string; at: number }>();
  const unmatched: string[] = [];
  const decide = (token: ShownToken, to: string) => {
    const from = displayText(token.word.text);
    const key = normalizeToken(from);
    const previous = decided.get(key);
    if (previous && previous.to !== to) {
      unmatched.push(`"${from}" recebeu duas correções diferentes ("${previous.to}" e "${to}"); ficou a primeira`);
      return;
    }
    if (!previous) decided.set(key, { from, to, at: token.word.start });
  };

  for (const cue of cues) {
    const original = byCue.get(cue.index) ?? [];
    const next = tokenize(cue.text);
    const steps = alignTokens(original.map((token) => token.shown), next);
    let block: Step[] = [];
    const flush = () => {
      if (block.length === 0) return;
      const olds = block.flatMap((step) => ('a' in step ? [original[step.a]!] : []));
      const news = block.flatMap((step) => ('b' in step ? [next[step.b]!] : []));
      if (olds.length === news.length) olds.forEach((token, index) => decide(token, news[index]!));
      else if (olds.length === 1 && news.length > 1) decide(olds[0]!, news.join(' '));
      else {
        const was = olds.map((token) => token.shown).join(' ') || '(nada)';
        unmatched.push(`legenda ${cue.index}: "${was}" → "${news.join(' ') || '(nada)'}" não vira troca de palavra; ajuste na timeline`);
      }
      block = [];
    };
    for (const step of steps) {
      if (step.kind === 'equal') flush();
      else block.push(step);
    }
    flush();
  }

  const changes = [...decided.values()];
  const ops = changes.map((change) => ({
    type: 'captionReplace' as const,
    from: change.from,
    // voltar à grafia transcrita é desfazer a correção
    to: change.to === change.from ? null : change.to,
  }));
  return { ops, changes, unmatched };
}
