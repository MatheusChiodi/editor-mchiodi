import { normalizeToken } from '../analyze/speech.ts';
import type { Flag, FlagKind, Span, Word } from '../analyze/types.ts';
import type { Clip, Edl } from '../edl/schema.ts';
import { round3 } from '../lib/time.ts';
import type { TechMention } from '../tech/detect.ts';

/**
 * Escolha automática de trechos para o Short. Determinística (sem LLM): cada candidato traz a nota
 * e os componentes que a explicam. É ranking para o diretor ler, nunca escolha cega.
 */

/** Gancho: termos que prendem nos primeiros segundos (comparados sem acento/caixa, por palavra inteira). */
export const DEFAULT_HOOK_TERMS = [
  'o segredo', 'segredo', 'ninguem', 'nunca', 'jamais', 'erro', 'erros', 'errado', 'errei', 'pare de', 'nao faca', 'nao use',
  'a verdade', 'verdade', 'mito', 'problema', 'cuidado', 'o pior', 'o melhor', 'todo mundo', 'por que', 'o maior', 'a real',
  'ninguem te conta', 'ninguem fala', 'presta atencao', 'o que ninguem', 'ninguem sabe', 'arrependo', 'perdi',
];
/** Imperativo só conta como gancho no começo de frase ("Esqueça o curso…"), não no meio ("eu use"). */
export const DEFAULT_IMPERATIVES = [
  'pare', 'faca', 'evite', 'esqueca', 'olha', 'olhe', 'preste', 'presta', 'veja', 'aprenda', 'use', 'comece', 'imagine',
  'imagina', 'escuta', 'escute', 'saiba', 'confie', 'entenda', 'largue', 'desista', 'estude', 'aprende', 'repara', 'repare',
];
/** Abertura que depende do que veio antes (conectivo, retomada, pronome sem referente). */
export const DEFAULT_WEAK_OPENERS = [
  'entao', 'e ai', 'e', 'mas', 'ai', 'dai', 'como eu disse', 'como eu falei', 'como falei', 'como disse', 'isso', 'esse',
  'essa', 'esses', 'essas', 'ele', 'ela', 'eles', 'elas', 'tambem', 'alem disso', 'por isso', 'enfim', 'ou seja', 'nesse caso',
  'no caso', 'que', 'dele', 'dela', 'la', 'daquilo', 'disso', 'nisso', 'aquilo', 'o resto',
];
/** Fala de canal (apresentação, pedido de inscrição, despedida): no Short soa como pedaço do vídeo longo. */
export const DEFAULT_CHANNEL_TERMS = [
  'me chamo', 'meu nome e', 'esse e o canal', 'bem vindo', 'bem vindos', 'se inscreve', 'se inscreva', 'deixa o like', 'deixe o like',
  'ativa o sininho', 'e isso pessoal', 'e isso galera', 'fiquem com deus', 'fiquem em paz', 'ate a proxima', 'ate o proximo video',
  'nesse video', 'neste video', 'no video de hoje', 'comenta ai', 'deixa nos comentarios',
];
const NUMBER_WORDS = new Set([
  'dois', 'duas', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'quinze', 'vinte', 'trinta',
  'cinquenta', 'cem', 'cento', 'mil', 'milhao', 'milhoes', 'bilhao', 'metade', 'dobro', 'triplo', 'porcento',
]);
const SENTENCE_END = /[.!?…]["')]?$/;
/** "sabe?", "né?", "certo?": muleta de fala, não pergunta que prende. */
const TAG_QUESTIONS = new Set(['sabe', 'ne', 'certo', 'entendeu', 'beleza', 'ta', 'ok', 'viu', 'concorda', 'tendeu', 'entende']);
const isQuestion = (item: { word: Word; key: string }) => item.word.text.includes('?') && !TAG_QUESTIONS.has(item.key);

export interface HookRules {
  terms: string[];
  imperatives: string[];
  weakOpeners: string[];
  channelTerms: string[];
}

export const DEFAULT_RULES: HookRules = {
  terms: DEFAULT_HOOK_TERMS,
  imperatives: DEFAULT_IMPERATIVES,
  weakOpeners: DEFAULT_WEAK_OPENERS,
  channelTerms: DEFAULT_CHANNEL_TERMS,
};

export type ComponentKey = 'hook' | 'closure' | 'density' | 'clean' | 'tech' | 'standalone' | 'fit';

/** Peso de cada componente na nota (soma 1). Gancho e autossuficiência pesam mais: Short sem eles não segura. */
export const WEIGHTS: Record<ComponentKey, number> = {
  hook: 0.25,
  standalone: 0.2,
  closure: 0.2,
  clean: 0.1,
  density: 0.1,
  tech: 0.1,
  fit: 0.05,
};

export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  hook: 'gancho',
  standalone: 'autossuf.',
  closure: 'fecho',
  clean: 'limpo',
  density: 'densid.',
  tech: 'tech',
  fit: 'duração',
};

/** Quanto cada tipo de flag que SOBREVIVEU aos cortes tira do componente "limpo". */
const FLAG_PENALTY: Record<FlagKind, number> = { retake: 0.4, marker: 0.4, restart: 0.3, filler: 0.15, 'voiced-gap': 0.04 };

export interface Component {
  /** 0–1 */
  score: number;
  weight: number;
  detail: string;
}

export type EdgeKind = 'corte' | 'silencio';

export interface ShortsField {
  start: number;
  end: number;
  focusX: number;
  reason: string;
}

export interface ShortSuggestion {
  rank: number;
  /** 0–100 */
  score: number;
  /** segundos da FONTE */
  start: number;
  end: number;
  /** duração no Short (só o que sobreviveu aos cortes) */
  outputSec: number;
  edges: { start: EdgeKind; end: EdgeKind };
  components: Record<ComponentKey, Component>;
  opening: string;
  text: string;
  /** pronto para colar em `shorts` da EDL */
  shorts: ShortsField;
}

export interface SuggestInput {
  words: Word[];
  clips: Pick<Clip, 'id' | 'start' | 'end'>[];
  silences: Span[];
  flags: Flag[];
  tech: Pick<TechMention, 'tech' | 'name' | 'start' | 'end' | 'confidence'>[];
  /** foco horizontal já usado na EDL (o candidato herda) */
  focusX?: number;
}

export interface SuggestOptions {
  count: number;
  minSec: number;
  maxSec: number;
  /** silêncio medido mínimo para uma pausa servir de borda (cuts.minSilenceSec) */
  minSilenceSec: number;
  hookWindowSec: number;
  rules: HookRules;
}

export const DEFAULT_SUGGEST: SuggestOptions = { count: 3, minSec: 20, maxSec: 60, minSilenceSec: 0.12, hookWindowSec: 3, rules: DEFAULT_RULES };

interface KeptWord {
  word: Word;
  clip: number;
  key: string;
}

interface Boundary {
  /** índice em `kept` da primeira palavra depois da borda */
  index: number;
  kind: EdgeKind;
  /** instante da borda se ela abre o Short (segundos da fonte) */
  startAt: number;
  /** instante da borda se ela fecha o Short */
  endAt: number;
  /** pausa medida (s); Infinity em corte da EDL ou ponta do vídeo */
  pause: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const tokens = (phrase: string) => phrase.split(/\s+/).map(normalizeToken).filter(Boolean);

/** Respiro deixado dentro do silêncio, igual ao corte automático: nunca a borda colada na palavra. */
const breath = (silence: Span) => Math.min(0.12, (silence.end - silence.start) / 2);

/** Palavras que sobreviveram aos cortes (o meio da palavra cai dentro de um clipe), com o clipe de cada uma. */
export function keptWords(words: Word[], clips: Pick<Clip, 'start' | 'end'>[]): KeptWord[] {
  const kept: KeptWord[] = [];
  for (const word of words) {
    const middle = (word.start + word.end) / 2;
    const clip = clips.findIndex((item) => middle >= item.start && middle < item.end);
    if (clip >= 0) kept.push({ word, clip, key: normalizeToken(word.text) });
  }
  return kept;
}

/** Maior trecho de silêncio medido dentro do intervalo. */
function measuredSilence(span: Span, silences: Span[]): Span | null {
  let best: Span | null = null;
  for (const silence of silences) {
    const start = Math.max(span.start, silence.start);
    const end = Math.min(span.end, silence.end);
    if (end > start && (!best || end - start > best.end - best.start)) best = { start, end };
  }
  return best;
}

/**
 * Pontos onde o Short pode começar ou terminar: corte que a EDL já faz, ou pausa entre palavras com silêncio
 * medido. Nunca dentro de palavra; pausa "com som e sem palavra" não serve.
 */
export function shortBoundaries(kept: KeptWord[], clips: Pick<Clip, 'start' | 'end'>[], silences: Span[], minSilenceSec: number): Boundary[] {
  if (kept.length === 0) return [];
  const boundaries: Boundary[] = [
    { index: 0, kind: 'corte', startAt: clips[kept[0]!.clip]!.start, endAt: NaN, pause: Infinity },
  ];
  for (let index = 1; index < kept.length; index += 1) {
    const previous = kept[index - 1]!;
    const next = kept[index]!;
    const before = clips[previous.clip]!;
    const after = clips[next.clip]!;
    if (previous.clip !== next.clip && before.end < after.start - 0.01) {
      boundaries.push({ index, kind: 'corte', startAt: after.start, endAt: before.end, pause: Infinity });
      continue;
    }
    const silence = measuredSilence({ start: previous.word.end, end: next.word.start }, silences);
    if (!silence || silence.end - silence.start < minSilenceSec) continue;
    boundaries.push({
      index,
      kind: 'silencio',
      startAt: round3(Math.max(previous.word.end, silence.end - breath(silence))),
      endAt: round3(Math.min(next.word.start, silence.start + breath(silence))),
      pause: round3(silence.end - silence.start),
    });
  }
  boundaries.push({ index: kept.length, kind: 'corte', startAt: NaN, endAt: clips[kept.at(-1)!.clip]!.end, pause: Infinity });
  return boundaries;
}

/** Tempo de saída de um instante da fonte (soma do que os clipes mantêm até ali). */
function outputClock(clips: Pick<Clip, 'start' | 'end'>[]): (time: number) => number {
  return (time) => clips.reduce((total, clip) => total + Math.max(0, Math.min(time, clip.end) - clip.start), 0);
}

function matchesAt(keys: string[], at: number, phrase: string[]): boolean {
  return phrase.length > 0 && phrase.every((token, offset) => keys[at + offset] === token);
}

/** Termos de uma lista que aparecem na sequência de tokens (o mais longo vence em cada posição). */
function findTerms(keys: string[], terms: string[][]): string[] {
  const found = new Set<string>();
  for (let at = 0; at < keys.length; at += 1) {
    const hit = terms.filter((term) => matchesAt(keys, at, term)).sort((a, b) => b.length - a.length)[0];
    if (hit) found.add(hit.join(' '));
  }
  return [...found];
}

export function scoreHook(window: KeptWord[], rules: HookRules, firstSentenceIsQuestion: boolean): Component {
  const keys = window.map((item) => item.key);
  const hits: string[] = [];
  if (firstSentenceIsQuestion || window.some((item) => isQuestion(item))) hits.push('pergunta');
  const number = window.find((item) => /\d/.test(item.word.text) || NUMBER_WORDS.has(item.key));
  if (number) hits.push(`número "${number.word.text}"`);
  const terms = findTerms(keys, rules.terms.map(tokens));
  if (terms.length) hits.push(terms.map((term) => `"${term}"`).join(', '));
  const imperatives = new Set(rules.imperatives.map(normalizeToken));
  const imperative = window.find((item, index) => imperatives.has(item.key) && (index === 0 || SENTENCE_END.test(window[index - 1]!.word.text)));
  if (imperative) hits.push(`imperativo "${imperative.word.text}"`);
  return { score: clamp01(hits.length * 0.5), weight: WEIGHTS.hook, detail: hits.join('; ') || 'sem gancho nos primeiros segundos' };
}

export function scoreStandalone(window: KeptWord[], previous: KeptWord | undefined, rules: HookRules): Component {
  let score = 1;
  const notes: string[] = [];
  // o Whisper abre frase com maiúscula: minúscula no começo é frase pela metade, mesmo que a anterior feche com ponto
  if ((previous && !SENTENCE_END.test(previous.word.text)) || /^\p{Ll}/u.test(window[0]?.word.text ?? '')) {
    // quem cai no Short sem o vídeo longo não entende frase pela metade: pesa quase tudo
    score -= 0.8;
    notes.push('começa no meio da frase');
  }
  const keys = window.slice(0, 6).map((item) => item.key);
  const opener = rules.weakOpeners
    .map(tokens)
    .filter((term) => matchesAt(keys, 0, term))
    .sort((a, b) => b.length - a.length)[0];
  if (opener) {
    score -= 0.4;
    notes.push(`abre com "${opener.join(' ')}" (depende do contexto)`);
  }
  const channel = findTerms(window.map((item) => item.key), rules.channelTerms.map(tokens));
  if (channel.length) {
    score -= 0.4;
    notes.push(`fala de canal: ${channel.map((term) => `"${term}"`).join(', ')}`);
  }
  return { score: clamp01(score), weight: WEIGHTS.standalone, detail: notes.join('; ') || 'abre frase nova, sem retomada' };
}

export function scoreClosure(last: KeptWord, end: Boundary): Component {
  const sentence = SENTENCE_END.test(last.word.text);
  const pause = end.kind === 'corte' ? 'corte da EDL' : `pausa de ${end.pause.toFixed(2)}s`;
  if (!sentence) return { score: 0, weight: WEIGHTS.closure, detail: `termina sem fim de frase (${pause})` };
  const long = end.pause >= 0.4;
  return { score: long ? 1 : 0.7, weight: WEIGHTS.closure, detail: `fim de frase + ${pause}` };
}

export function scoreDensity(wordCount: number, outputSec: number): Component {
  const perSec = wordCount / outputSec;
  return { score: clamp01((perSec - 1.5) / 1.5), weight: WEIGHTS.density, detail: `${perSec.toFixed(1)} palavras/s` };
}

export function scoreClean(flags: Flag[]): Component {
  const penalty = flags.reduce((total, flag) => total + FLAG_PENALTY[flag.kind], 0);
  const counts = new Map<string, number>();
  for (const flag of flags) counts.set(flag.kind, (counts.get(flag.kind) ?? 0) + 1);
  const detail = [...counts].map(([kind, count]) => `${count} ${kind}`).join(', ');
  return { score: clamp01(1 - penalty), weight: WEIGHTS.clean, detail: detail ? `sobrou: ${detail}` : 'sem hesitação nem retake' };
}

export function scoreTech(names: string[]): Component {
  const score = names.length === 0 ? 0 : names.length === 1 ? 0.6 : 1;
  return { score, weight: WEIGHTS.tech, detail: names.length ? names.join(', ') : 'nenhuma tecnologia citada' };
}

export function scoreFit(outputSec: number, maxSec: number): Component {
  return { score: clamp01(outputSec / (0.75 * maxSec)), weight: WEIGHTS.fit, detail: `${outputSec.toFixed(0)}s` };
}

export function totalScore(components: Record<ComponentKey, Component>): number {
  const sum = (Object.keys(WEIGHTS) as ComponentKey[]).reduce((total, key) => total + components[key].score * components[key].weight, 0);
  return Math.round(sum * 1000) / 10;
}

const overlap = (a: Span, b: Span) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

function positives(components: Record<ComponentKey, Component>): string {
  const good = (['hook', 'closure', 'tech'] as ComponentKey[]).filter((key) => components[key].score >= 0.5);
  return good.map((key) => `${COMPONENT_LABEL[key]}: ${components[key].detail}`).join('; ');
}

/**
 * Ranqueia trechos do vídeo JÁ editado (só o que a EDL mantém) para o Short. Janela de `minSec`–`maxSec` no
 * vídeo final, bordas em corte da EDL ou pausa com silêncio medido; por início fica o melhor fim, e candidatos
 * que se sobrepõem em mais da metade dão lugar ao de nota maior.
 */
export function suggestShorts(input: SuggestInput, options: Partial<SuggestOptions> = {}): ShortSuggestion[] {
  const opts = { ...DEFAULT_SUGGEST, ...options, rules: { ...DEFAULT_RULES, ...options.rules } };
  const clips = [...input.clips].sort((a, b) => a.start - b.start);
  const kept = keptWords(input.words, clips);
  const boundaries = shortBoundaries(kept, clips, input.silences, opts.minSilenceSec);
  const outAt = outputClock(clips);
  const insideClip = (time: number) => clips.some((clip) => time >= clip.start && time < clip.end);
  const keptFlags = input.flags.filter((flag) => insideClip((flag.start + flag.end) / 2));
  const keptTech = input.tech.filter((mention) => mention.confidence === 'high' && insideClip((mention.start + mention.end) / 2));

  const best: ShortSuggestion[] = [];
  for (let a = 0; a < boundaries.length - 1; a += 1) {
    const open = boundaries[a]!;
    const startOut = outAt(open.startAt);
    let winner: ShortSuggestion | null = null;
    for (let b = a + 1; b < boundaries.length; b += 1) {
      const close = boundaries[b]!;
      const outputSec = outAt(close.endAt) - startOut;
      if (outputSec > opts.maxSec) break;
      if (outputSec < opts.minSec) continue;
      const window = kept.slice(open.index, close.index);
      const span = { start: open.startAt, end: close.endAt };
      const hookWords = window.filter((item) => outAt(item.word.start) - startOut < opts.hookWindowSec);
      const firstEnd = window.findIndex((item) => SENTENCE_END.test(item.word.text));
      const firstQuestion = firstEnd >= 0 && outAt(window[0]!.word.start) - startOut < opts.hookWindowSec && isQuestion(window[firstEnd]!);
      const flags = keptFlags.filter((flag) => (flag.start + flag.end) / 2 >= span.start && (flag.start + flag.end) / 2 < span.end);
      const tech = [...new Set(keptTech.filter((mention) => mention.start >= span.start && mention.end <= span.end).map((mention) => mention.name))];
      const components: Record<ComponentKey, Component> = {
        hook: scoreHook(hookWords, opts.rules, firstQuestion),
        standalone: scoreStandalone(window, kept[open.index - 1], opts.rules),
        closure: scoreClosure(window.at(-1)!, close),
        clean: scoreClean(flags),
        density: scoreDensity(window.length, outputSec),
        tech: scoreTech(tech),
        fit: scoreFit(outputSec, opts.maxSec),
      };
      const text = window.map((item) => item.word.text).join(' ');
      const candidate: ShortSuggestion = {
        rank: 0,
        score: totalScore(components),
        start: span.start,
        end: span.end,
        outputSec: round3(outputSec),
        edges: { start: open.kind, end: close.kind },
        components,
        opening: window.slice(0, 14).map((item) => item.word.text).join(' '),
        text,
        shorts: { start: span.start, end: span.end, focusX: input.focusX ?? 0.5, reason: '' },
      };
      if (!winner || candidate.score > winner.score) winner = candidate;
    }
    if (winner) best.push(winner);
  }

  const picked: ShortSuggestion[] = [];
  for (const candidate of best.sort((x, y) => y.score - x.score || x.start - y.start)) {
    const length = candidate.end - candidate.start;
    if (picked.some((other) => overlap(other, candidate) > 0.5 * Math.min(length, other.end - other.start))) continue;
    picked.push(candidate);
    if (picked.length === opts.count) break;
  }
  return picked.map((candidate, index) => {
    const rank = index + 1;
    const why = positives(candidate.components);
    return { ...candidate, rank, shorts: { ...candidate.shorts, reason: `mce shorts suggest #${rank} (nota ${candidate.score})${why ? `: ${why}` : ''}` } };
  });
}

/** Conteúdo da próxima versão da EDL com o candidato em `shorts`; as notes dizem de onde veio e o que havia antes. */
export function applySuggestion(edl: Edl, chosen: ShortSuggestion): Omit<Edl, 'version' | 'createdAt'> {
  const { version: _version, createdAt: _createdAt, ...data } = edl;
  const before = edl.shorts ? `${edl.shorts.start}–${edl.shorts.end}s` : 'nenhum';
  return {
    ...data,
    shorts: chosen.shorts,
    notes:
      `Short: candidato #${chosen.rank} do mce shorts suggest sobre a v${edl.version} (nota ${chosen.score}, fonte ` +
      `${chosen.start}–${chosen.end}s, ${chosen.outputSec.toFixed(0)}s no Short; antes: ${before}). Abre com "${chosen.opening}…".`,
  };
}

/** Tabela para o terminal: nota, componentes e começo do texto de cada candidato. */
export function formatSuggestions(suggestions: ShortSuggestion[]): string {
  if (suggestions.length === 0) return 'nenhum trecho cabe na janela pedida com bordas em pausa medida';
  const keys = Object.keys(WEIGHTS) as ComponentKey[];
  const header = ['#', 'nota', 'fonte', 'final', ...keys.map((key) => COMPONENT_LABEL[key])];
  const rows = suggestions.map((item) => [
    String(item.rank),
    item.score.toFixed(1),
    `${item.start.toFixed(2)}–${item.end.toFixed(2)}`,
    `${item.outputSec.toFixed(0)}s`,
    ...keys.map((key) => item.components[key].score.toFixed(2)),
  ]);
  const widths = header.map((cell, column) => Math.max(cell.length, ...rows.map((row) => row[column]!.length)));
  const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column]!)).join('  ').trimEnd();
  const lines = [line(header), ...rows.map(line)];
  for (const item of suggestions) {
    lines.push('', `#${item.rank} "${item.opening}…"`);
    lines.push(`   termina: "…${item.text.split(' ').slice(-10).join(' ')}"`);
    for (const key of keys) lines.push(`   ${COMPONENT_LABEL[key].padEnd(10)} ${item.components[key].detail}`);
    lines.push(`   EDL: "shorts": ${JSON.stringify(item.shorts)}`);
  }
  return lines.join('\n');
}
