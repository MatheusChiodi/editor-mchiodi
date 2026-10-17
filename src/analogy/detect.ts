import { normalizeToken } from '../analyze/speech.ts';
import type { Phrase, Span } from '../analyze/types.ts';
import { type AnalogyShape, SHAPE_MODELS, type Universe, type UniverseCategory, UNIVERSES } from './catalog.ts';

/** Uma analogia de universo encontrada na fala. Tempos em segundos da FONTE, como tudo na EDL. */
export interface Analogy extends Span {
  /** id do universo no catálogo (e valor da prop `theme` na EDL) */
  universe: string;
  name: string;
  category: UniverseCategory;
  /** id do tema visual */
  theme: string;
  phraseId: string;
  /** início da primeira palavra-gatilho: onde a animação deve entrar */
  at: number;
  /** o trecho da fala que carrega a analogia */
  text: string;
  /** gatilhos encontrados, como estão no catálogo */
  triggers: string[];
  /** 0–1: ≥ 0,85 é alta (a avaliação cobra o tema); abaixo disso é sugestão */
  confidence: number;
  /** forma da analogia e o modelo de cena que serve a ela, quando a fala deixa claro */
  shape: AnalogyShape | null;
  model: string | null;
}

export interface TimedToken extends Span {
  text: string;
}

/** A partir daqui a analogia é "de confiança alta": entra na cobrança `analogia-sem-tema`. */
export const HIGH_CONFIDENCE = 0.85;

const CONTEXT_WINDOW = 14;
const UNLESS_WINDOW = 3;
const NEIGHBOR_WINDOW = 40;

/** Expressão do catálogo → tokens comparáveis com a fala (sem acento, caixa nem hífen). */
export function normalizeTerm(term: string): string[] {
  return term.split(/\s+/).map(normalizeToken).filter(Boolean);
}

// "era praticamente o meu Alfred", "é tipo um creeper", "que nem no Mario": o que anuncia uma comparação
const FRAMING = [
  'era praticamente', 'é praticamente', 'praticamente', 'tipo', 'como se fosse', 'como se fossem', 'igual', 'que nem', 'parece', 'parecia', 'o meu', 'a minha', 'os meus',
  'um verdadeiro', 'uma verdadeira', 'virou', 'virei', 'imagina', 'pensa', 'é como', 'era como', 'como um', 'como uma', 'como o', 'como a', 'estilo', 'basicamente', 'quase um',
  'quase uma', 'literalmente', 'digamos', 'lembra', 'analogia', 'comparar', 'comparação',
].map(normalizeTerm);

// forma da analogia pela vizinhança, quando o gatilho sozinho não diz
const SHAPE_HINTS: [AnalogyShape, string[]][] = [
  ['equipe', ['liga', 'guilda', 'time', 'equipe', 'esquadrão', 'tripulação', 'sociedade', 'formada', 'formado', 'grupo', 'bando', 'clã']],
  ['chefao', ['chefão', 'boss', 'vilão', 'derrotar', 'enfrentar', 'inimigo', 'monstro', 'batalha']],
  ['levelup', ['nível', 'evoluir', 'evolução', 'desbloquear', 'desbloqueia', 'upar', 'subir', 'poderes']],
  ['jornada', ['fase', 'fases', 'mundo', 'mundos', 'jornada', 'caminho', 'mapa', 'etapa', 'etapas', 'missão']],
  ['inventario', ['inventário', 'cinto', 'mochila', 'itens', 'ferramentas', 'arsenal', 'equipamento', 'equipamentos']],
  ['construcao', ['construir', 'construindo', 'montar', 'montando', 'fortaleza', 'tijolo', 'peça', 'peças']],
  ['escolha', ['escolha', 'escolher', 'opção', 'opções', 'caminhos', 'decidir']],
  ['ajudante', ['ajudava', 'ajudou', 'ajuda', 'ajudante', 'mordomo', 'parceiro', 'companheiro', 'assistente', 'mentor', 'guia', 'mestre']],
];
const SHAPE_HINT_SETS = SHAPE_HINTS.map(([shape, terms]) => [shape, new Set(terms.map((term) => normalizeToken(term)))] as const);

interface Entry {
  universe: Universe;
  term: string;
  tokens: string[];
  strong: boolean;
  context: string[][];
  unless: Set<string>;
  shape: AnalogyShape | null;
}

interface Index {
  byFirst: Map<string, Entry[]>;
}

const indexCache = new WeakMap<Universe[], Index>();

function buildIndex(universes: Universe[]): Index {
  const cached = indexCache.get(universes);
  if (cached) return cached;
  const byFirst = new Map<string, Entry[]>();
  for (const universe of universes) {
    const shapes = new Map(Object.entries(universe.shapes ?? {}).map(([term, shape]) => [normalizeTerm(term).join(' '), shape]));
    const add = (term: string, strong: boolean, context: string[] = [], unless: string[] = []) => {
      const tokens = normalizeTerm(term);
      if (tokens.length === 0) return;
      const entry: Entry = {
        universe,
        term,
        tokens,
        strong,
        context: context.map(normalizeTerm).filter((item) => item.length > 0),
        unless: new Set(unless.map((item) => normalizeToken(item))),
        shape: shapes.get(tokens.join(' ')) ?? null,
      };
      const list = byFirst.get(tokens[0]!);
      if (list) list.push(entry);
      else byFirst.set(tokens[0]!, [entry]);
    };
    for (const term of universe.triggers) add(term, true);
    for (const item of universe.ambiguous ?? []) add(item.term, false, item.context, item.unless);
  }
  const index = { byFirst };
  indexCache.set(universes, index);
  return index;
}

function matchesAt(tokens: string[], at: number, sequence: string[]): boolean {
  if (at < 0 || at + sequence.length > tokens.length) return false;
  for (let offset = 0; offset < sequence.length; offset += 1) if (tokens[at + offset] !== sequence[offset]) return false;
  return true;
}

function hasSequence(tokens: string[], from: number, to: number, sequence: string[]): boolean {
  for (let at = Math.max(0, from); at <= Math.min(tokens.length, to) - sequence.length; at += 1) if (matchesAt(tokens, at, sequence)) return true;
  return false;
}

interface Hit {
  entry: Entry;
  at: number;
  /** palavras de contexto encontradas (só nos ambíguos) */
  support: number;
}

/** Todas as ocorrências de gatilho, já resolvidas: a expressão mais longa vence e o ambíguo só passa com contexto. */
function findHits(tokens: string[], index: Index): Hit[] {
  const raw: Hit[] = [];
  tokens.forEach((token, at) => {
    for (const entry of index.byFirst.get(token) ?? []) if (matchesAt(tokens, at, entry.tokens)) raw.push({ entry, at, support: 0 });
  });
  // posições dos gatilhos fortes por universo: um forte por perto também serve de contexto para o ambíguo
  const strongAt = new Map<string, number[]>();
  for (const hit of raw) {
    if (!hit.entry.strong) continue;
    const list = strongAt.get(hit.entry.universe.id) ?? [];
    list.push(hit.at);
    strongAt.set(hit.entry.universe.id, list);
  }

  const valid = raw.filter((hit) => {
    const { entry, at } = hit;
    if (entry.strong) return true;
    const end = at + entry.tokens.length;
    for (let near = Math.max(0, at - UNLESS_WINDOW); near < Math.min(tokens.length, end + UNLESS_WINDOW); near += 1) {
      if ((near < at || near >= end) && entry.unless.has(tokens[near]!)) return false;
    }
    let support = entry.context.filter((sequence) => hasSequence(tokens, at - CONTEXT_WINDOW, end + CONTEXT_WINDOW, sequence)).length;
    if ((strongAt.get(entry.universe.id) ?? []).some((position) => Math.abs(position - at) <= NEIGHBOR_WINDOW)) support += 1;
    hit.support = support;
    return support > 0;
  });

  // mais longo primeiro; no empate, o forte; depois o ambíguo com mais contexto
  valid.sort((a, b) => b.entry.tokens.length - a.entry.tokens.length || Number(b.entry.strong) - Number(a.entry.strong) || b.support - a.support || a.at - b.at);
  const taken = new Map<number, Hit>();
  const accepted: Hit[] = [];
  for (const hit of valid) {
    const span = hit.entry.tokens.map((_, offset) => hit.at + offset);
    const owners = new Set(span.map((position) => taken.get(position)).filter((owner): owner is Hit => owner !== undefined));
    // a mesma expressão pode valer para o mesmo universo duas vezes ("gotham" dentro de "gotham city"): fica a maior
    if (owners.size > 0) continue;
    accepted.push(hit);
    for (const position of span) taken.set(position, hit);
  }
  return accepted.sort((a, b) => a.at - b.at);
}

function framingBefore(tokens: string[], at: number, reach = 8): number | null {
  let best: number | null = null;
  for (let start = Math.max(0, at - reach); start < at; start += 1) {
    if (FRAMING.some((sequence) => matchesAt(tokens, start, sequence) && start + sequence.length <= at)) {
      best = best === null ? start : Math.min(best, start);
    }
  }
  return best;
}

function framingAfter(tokens: string[], end: number, reach = 4): boolean {
  for (let start = end; start < Math.min(tokens.length, end + reach); start += 1) if (FRAMING.some((sequence) => sequence.length > 1 && matchesAt(tokens, start, sequence))) return true;
  return false;
}

const TRAILING = new Set(['de', 'do', 'da', 'dos', 'das', 'formada', 'formado', 'formados', 'formadas']);

function shapeNear(tokens: string[], from: number, to: number): AnalogyShape | null {
  for (const [shape, terms] of SHAPE_HINT_SETS) {
    for (let at = Math.max(0, from); at < Math.min(tokens.length, to); at += 1) if (terms.has(tokens[at]!)) return shape;
  }
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Analogias de universo na fala: "era praticamente o meu Alfred", "uma liga da justiça formada por devs".
 * Uma por frase e universo, com o trecho, os tempos da frase e a confiança. Função pura: palavras e frases entram por parâmetro.
 */
export function findAnalogies(words: TimedToken[], phrases: Phrase[], universes: Universe[] = UNIVERSES): Analogy[] {
  const tokens = words.map((word) => normalizeToken(word.text));
  const hits = findHits(tokens, buildIndex(universes));
  if (hits.length === 0) return [];

  const phraseOf = (position: number) => phrases.find((phrase) => position >= phrase.from && position < phrase.to);
  const groups = new Map<string, { phrase: Phrase; universe: Universe; hits: Hit[] }>();
  for (const hit of hits) {
    const phrase = phraseOf(hit.at);
    if (!phrase) continue;
    const key = `${phrase.id}|${hit.entry.universe.id}`;
    const group = groups.get(key);
    if (group) group.hits.push(hit);
    else groups.set(key, { phrase, universe: hit.entry.universe, hits: [hit] });
  }

  const analogies: Analogy[] = [];
  for (const { phrase, universe, hits: own } of groups.values()) {
    const first = own[0]!;
    const last = own.at(-1)!;
    const lastEnd = last.at + last.entry.tokens.length;
    const framingStart = framingBefore(tokens, first.at);
    const framed = framingStart !== null || framingAfter(tokens, lastEnd);

    let confidence = Math.max(
      ...own.map(({ entry, support }) =>
        entry.strong ? (universe.fallback ? 0.75 : 0.8) + (entry.tokens.length > 1 ? 0.05 : 0) : 0.6 + 0.05 * Math.min(2, support - 1),
      ),
    );
    if (framed) confidence += 0.1;
    const neighbors = hits.filter((hit) => hit.entry.universe.id === universe.id && Math.abs(hit.at - first.at) <= NEIGHBOR_WINDOW);
    if (new Set(neighbors.map((hit) => hit.entry.tokens.join(' '))).size > 1) confidence += 0.05;

    // trecho: do anúncio da comparação (ou 3 palavras antes) até o gatilho, com o complemento ("… formada por devs")
    const from = Math.max(phrase.from, framingStart ?? first.at - 3);
    let to = lastEnd;
    if (to < phrase.to && TRAILING.has(tokens[to]!)) to = Math.min(phrase.to, to + 3);
    const text = words.slice(from, to).map((word) => word.text).join(' ').replace(/[,.;:!?…]+$/, '');

    const shape = own.find((hit) => hit.entry.shape)?.entry.shape ?? shapeNear(tokens, first.at - 6, lastEnd + 12);
    analogies.push({
      universe: universe.id,
      name: universe.name,
      category: universe.category,
      theme: universe.theme,
      phraseId: phrase.id,
      start: phrase.start,
      end: phrase.end,
      at: words[first.at]!.start,
      text,
      triggers: [...new Set(own.map((hit) => hit.entry.term))],
      confidence: round2(Math.min(0.98, confidence)),
      shape,
      model: shape ? SHAPE_MODELS[shape] : null,
    });
  }
  return analogies.sort((a, b) => a.at - b.at || b.confidence - a.confidence);
}

/** As analogias de uma frase, na ordem em que são ditas (para as marcas do takes.md). */
export function analogiesOf(analogies: Analogy[], phraseId: string): Analogy[] {
  return analogies.filter((analogy) => analogy.phraseId === phraseId);
}
