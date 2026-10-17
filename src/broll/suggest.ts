import type { Word } from '../analyze/types.ts';
import type { BrollBudget } from '../edl/levels.ts';
import type { Edl } from '../edl/schema.ts';
import { buildTimeline, outputToSource, sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { round3 } from '../lib/time.ts';
import { placeBroll, placeLayout } from '../render/layout.ts';
import { graphicGapAt, type OverlaySpan } from '../retention/index.ts';
import type { TechMention } from '../tech/detect.ts';
import type { BrollEntry } from './library.ts';
import { expandTags, groupsOf, stem, STOPWORDS, tagsOf, TERM_GROUPS, WEAK_TERMS, words as splitWords } from './terms.ts';

export type TriggerKind = 'objeto' | 'lugar' | 'acao' | 'tecnologia' | 'biblioteca';

export interface BrollCandidate {
  rank: number;
  /** segundos da FONTE (começa na palavra-gatilho) */
  start: number;
  end: number;
  /** segundos do vídeo final, para se localizar no preview */
  outputStart: number;
  outputEnd: number;
  /** palavra como foi dita */
  trigger: string;
  /** grupo de sinônimos, id da tecnologia ou tag da biblioteca */
  term: string;
  kind: TriggerKind;
  quote: string;
  /** segundos sem gráfico na tela até o começo do trecho */
  graphicGapSec: number;
  score: number;
  /** arquivo da biblioteca (relativo a assets/broll) ou `null` se falta */
  file: string | null;
  /** o que buscar quando não há arquivo (inglês, para o Pexels) */
  missing: string | null;
  reason: string;
}

export interface BrollSuggestInput {
  words: readonly Pick<Word, 'text' | 'start' | 'end'>[];
  edl: Pick<Edl, 'clips' | 'overlays' | 'broll' | 'layout' | 'output'>;
  library: readonly BrollEntry[];
  tech: readonly TechMention[];
  budget: BrollBudget;
}

export interface BrollSuggestOptions {
  /** o começo é rosto e gancho: nada de b-roll antes disto (s do vídeo final) */
  skipStartSec: number;
  /** folga em volta de cada gráfico (s) */
  overlayMarginSec: number;
  /** inserto mais curto que isto não vale (s) */
  minSec: number;
  /** quantas vezes o mesmo termo pode ser escolhido */
  maxPerTerm: number;
}

export const BROLL_DEFAULTS: BrollSuggestOptions = { skipStartSec: 5, overlayMarginSec: 0.5, minSec: 1.5, maxPerTerm: 2 };

interface Trigger {
  index: number;
  heard: string;
  term: string;
  kind: TriggerKind;
  tags: string[];
  query: string;
  weight: number;
}

const BASE_WEIGHT = { strong: 1, weak: 0.4, tech: 0.7, library: 0.8 };
const GAP_WEIGHT = 0.6;
const GAP_CAP_SEC = 30;
const MATCH_BONUS = 0.3;

/** Gráficos no tempo de saída (a camada persistente, como o indicador de progresso, não conta). */
export function overlaySpans(edl: Pick<Edl, 'overlays'>, timeline: Timeline): OverlaySpan[] {
  return edl.overlays
    .filter((overlay) => overlay.layer !== 'persistent')
    .map((overlay) => {
      const at = sourceToOutput(timeline, overlay.at);
      return at === null ? null : { id: overlay.id, component: overlay.component, start: at, end: at + overlay.duration };
    })
    .filter((span): span is OverlaySpan => span !== null)
    .sort((a, b) => a.start - b.start);
}

/** Trechos (tempo de saída) em que o quadro já está ocupado: gráfico, b-roll existente, tela gravada. */
export function blockedSpans(edl: BrollSuggestInput['edl'], timeline: Timeline, marginSec: number): { start: number; end: number }[] {
  return [
    ...overlaySpans(edl, timeline).map((span) => ({ start: span.start - marginSec, end: span.end + marginSec })),
    ...placeBroll(edl.broll, timeline).map((span) => ({ start: span.start - marginSec, end: span.end + marginSec })),
    ...placeLayout(edl.layout.segments, timeline),
  ];
}

/** Palavras que pedem imagem: objeto/lugar/ação dos grupos, tecnologia do catálogo ou tag que já existe na biblioteca. */
export function findTriggers(words: BrollSuggestInput['words'], tech: readonly TechMention[], libraryTags: ReadonlySet<string>): Trigger[] {
  const techAt = new Map(tech.filter((mention) => mention.confidence === 'high').map((mention) => [mention.wordIndex, mention]));
  const triggers: Trigger[] = [];
  const clean = (text: string) => text.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  words.forEach((word, index) => {
    const token = splitWords(word.text)[0] ?? '';
    const key = stem(token);
    const groups = token ? groupsOf(token) : [];
    if (groups.length) {
      const group = groups[0]!;
      const weak = WEAK_TERMS.has(key);
      triggers.push({ index, heard: clean(word.text), term: group.key, kind: group.kind, tags: expandTags([token]), query: group.query, weight: weak ? BASE_WEIGHT.weak : BASE_WEIGHT.strong });
      return;
    }
    const mention = techAt.get(index);
    if (mention) {
      const code = TERM_GROUPS.find((group) => group.key === 'codigo')!;
      triggers.push({
        index,
        heard: mention.heard,
        term: `tech:${mention.tech}`,
        kind: 'tecnologia',
        tags: [...new Set([...tagsOf(mention.name), ...tagsOf(mention.tech), ...expandTags(code.terms)])],
        query: `${mention.name} programming`,
        weight: BASE_WEIGHT.tech,
      });
      return;
    }
    if (token.length >= 4 && !STOPWORDS.has(token) && libraryTags.has(key)) {
      triggers.push({ index, heard: clean(word.text), term: key, kind: 'biblioteca', tags: [key], query: token, weight: BASE_WEIGHT.library });
    }
  });
  return triggers;
}

/**
 * Melhor arquivo da biblioteca para as tags: a palavra exata vale o dobro do sinônimo; arquivo mais curto que o
 * inserto perde nota; arquivo já usado perde nota (variedade).
 */
export function matchLibrary(tags: readonly string[], exact: string, library: readonly BrollEntry[], wantSec: number, used: ReadonlyMap<string, number>): BrollEntry | null {
  const wanted = new Set(tags);
  let best: { entry: BrollEntry; score: number } | null = null;
  for (const entry of library) {
    const entryTags = entry.tags.map(stem);
    const hits = entryTags.filter((tag) => wanted.has(tag)).length;
    if (hits === 0) continue;
    const score = hits + (entryTags.includes(exact) ? 2 : 0) - (entry.durationSec + 0.05 < wantSec ? 0.5 : 0) - (used.get(entry.file) ?? 0) * 1.5;
    if (!best || score > best.score || (score === best.score && entry.file < best.entry.file)) best = { entry, score };
  }
  return best?.entry ?? null;
}

const KIND_LABEL: Record<TriggerKind, string> = {
  objeto: 'objeto citado',
  lugar: 'lugar citado',
  acao: 'ação citada',
  tecnologia: 'tecnologia citada',
  biblioteca: 'termo da biblioteca',
};

function quoteAround(words: BrollSuggestInput['words'], index: number): string {
  return words
    .slice(Math.max(0, index - 4), index + 5)
    .map((word) => word.text.trim())
    .join(' ');
}

/** Quantos insertos cabem no vídeo: `perMinute` × minutos, ao menos 1 se o nível leva b-roll. */
export function brollCap(budget: BrollBudget, durationSec: number): number {
  if (budget.perMinute <= 0) return 0;
  return Math.max(1, Math.floor((budget.perMinute * durationSec) / 60));
}

/**
 * Sugere b-roll a partir da fala mantida: cada gatilho vira uma janela que começa na palavra e dura o do nível,
 * fora de qualquer gráfico/tela gravada/b-roll existente. Nota = força do gatilho + tempo sem gráfico (o loop de
 * retenção mostra que trecho longo sem gráfico perde mais) + bônus se a biblioteca tem o arquivo.
 * Escolha gulosa por nota respeitando o teto e a distância mínima do nível; saída em ordem de tempo.
 */
export function suggestBroll(input: BrollSuggestInput, options: Partial<BrollSuggestOptions> = {}): BrollCandidate[] {
  const settings = { ...BROLL_DEFAULTS, ...options };
  const timeline = buildTimeline(input.edl.clips, input.edl.output.fps);
  const cap = brollCap(input.budget, timeline.durationSec);
  if (cap === 0) return [];
  const spans = overlaySpans(input.edl, timeline);
  const blocked = blockedSpans(input.edl, timeline, settings.overlayMarginSec);
  const libraryTags = new Set(input.library.flatMap((entry) => entry.tags.map(stem)));
  const used = new Map<string, number>();

  type Scored = Omit<BrollCandidate, 'rank' | 'file' | 'missing' | 'reason'> & { trigger_: Trigger };
  const scored: Scored[] = [];
  for (const trigger of findTriggers(input.words, input.tech, libraryTags)) {
    const word = input.words[trigger.index]!;
    const outputStart = sourceToOutput(timeline, word.start);
    if (outputStart === null || outputStart < settings.skipStartSec) continue;
    const outputEnd = Math.min(outputStart + input.budget.durationSec, timeline.durationSec);
    if (outputEnd - outputStart < settings.minSec) continue;
    if (blocked.some((span) => span.start < outputEnd && span.end > outputStart)) continue;
    const gap = graphicGapAt({ overlays: spans, introSec: 0 }, outputStart);
    scored.push({
      start: round3(word.start),
      end: round3(outputToSource(timeline, outputEnd) ?? word.start + (outputEnd - outputStart)),
      outputStart: round3(outputStart),
      outputEnd: round3(outputEnd),
      trigger: trigger.heard,
      term: trigger.term,
      kind: trigger.kind,
      quote: quoteAround(input.words, trigger.index),
      graphicGapSec: gap,
      score: trigger.weight + (Math.min(gap, GAP_CAP_SEC) / GAP_CAP_SEC) * GAP_WEIGHT + (libraryTags.size && trigger.tags.some((tag) => libraryTags.has(tag)) ? MATCH_BONUS : 0),
      trigger_: trigger,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.outputStart - b.outputStart);
  const picked: Scored[] = [];
  const perTerm = new Map<string, number>();
  for (const item of scored) {
    if (picked.length >= cap) break;
    if ((perTerm.get(item.term) ?? 0) >= settings.maxPerTerm) continue;
    const near = picked.some(
      (other) => Math.abs(other.outputStart - item.outputStart) < input.budget.minGapSec || (other.outputStart < item.outputEnd && other.outputEnd > item.outputStart),
    );
    if (near) continue;
    picked.push(item);
    perTerm.set(item.term, (perTerm.get(item.term) ?? 0) + 1);
  }

  return picked
    .sort((a, b) => a.outputStart - b.outputStart)
    .map(({ trigger_, ...item }, index) => {
      const want = item.outputEnd - item.outputStart;
      const entry = matchLibrary(trigger_.tags, stem(splitWords(trigger_.heard)[0] ?? ''), input.library, want, used);
      if (entry) used.set(entry.file, (used.get(entry.file) ?? 0) + 1);
      // arquivo mais curto que a janela: o inserto encolhe para caber nele (nunca congela nem repete)
      const fits = entry && entry.durationSec + 0.05 < want && entry.durationSec >= settings.minSec;
      const outputEnd = fits ? round3(item.outputStart + entry.durationSec) : item.outputEnd;
      const end = fits ? round3(outputToSource(timeline, outputEnd) ?? item.start + entry.durationSec) : item.end;
      const gapNote = item.graphicGapSec >= 10 ? `; ${item.graphicGapSec.toFixed(0)}s sem gráfico` : '';
      return {
        rank: index + 1,
        ...item,
        score: Number(item.score.toFixed(2)),
        end,
        outputEnd,
        file: entry?.file ?? null,
        missing: entry ? null : trigger_.query,
        reason: `ilustra "${trigger_.heard}" (${KIND_LABEL[item.kind]})${gapNote}`,
      };
    });
}

/** Grava os candidatos com arquivo como `broll` numa nova versão (ids que não colidem com os da EDL). */
export function applyBroll(edl: Edl, candidates: readonly BrollCandidate[]): { data: Omit<Edl, 'version' | 'createdAt'>; applied: BrollCandidate[] } {
  const taken = new Set([...edl.clips, ...edl.overlays, ...edl.broll, ...edl.zooms, ...edl.transitions, ...edl.effects, ...edl.sfx].map((item) => item.id));
  const applied = candidates.filter((candidate) => candidate.file !== null);
  let next = 1;
  const items = applied.map((candidate) => {
    while (taken.has(`broll-${next}`)) next += 1;
    const id = `broll-${next}`;
    taken.add(id);
    return { id, file: candidate.file!, start: candidate.start, end: candidate.end, from: 0, fit: 'cover' as const, reason: candidate.reason };
  });
  const missing = candidates.filter((candidate) => candidate.file === null).length;
  const { version: _version, createdAt: _createdAt, ...rest } = edl;
  return {
    applied,
    data: {
      ...rest,
      broll: [...edl.broll, ...items].sort((a, b) => a.start - b.start),
      notes:
        `B-roll assistido (mce broll suggest, nível ${edl.level}): ${items.length} inserto(s) da biblioteca sobre o apresentador, ` +
        `nos trechos sem gráfico onde a fala cita algo concreto (${applied.map((candidate) => `"${candidate.trigger}"`).join(', ') || 'nenhum'}).` +
        (missing ? ` ${missing} sugestão(ões) sem arquivo ficaram de fora (mce broll fetch).` : ''),
    },
  };
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, '0')}`;

export function formatBroll(candidates: readonly BrollCandidate[], context: { level: string; cap: number; libraryCount: number }): string {
  if (context.cap === 0) return `nível ${context.level}: sem b-roll (só cortes, legendas, áudio e cor). Troque o nível só se o Matheus pedir.`;
  if (candidates.length === 0) return `nenhum trecho pede b-roll (nível ${context.level}, teto ${context.cap}).`;
  const lines = [
    `b-roll sugerido — nível ${context.level}, teto ${context.cap}, biblioteca com ${context.libraryCount} arquivo(s)`,
    '',
    ' #  fonte (s)        saída   gatilho          nota  arquivo',
  ];
  for (const candidate of candidates) {
    const range = `${candidate.start.toFixed(2)}–${candidate.end.toFixed(2)}`.padEnd(16);
    lines.push(
      `${String(candidate.rank).padStart(2)}  ${range} ${clock(candidate.outputStart).padStart(6)}  ${candidate.trigger.slice(0, 15).padEnd(15)}  ${candidate.score.toFixed(2)}  ${candidate.file ?? `faltando: buscar "${candidate.missing}"`}`,
      `    ${candidate.reason} — "${candidate.quote}"`,
    );
  }
  return lines.join('\n');
}
