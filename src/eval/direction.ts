import { LAST_ENTRY_SEC, minReadSec } from '../../motion/src/components/read-time.ts';
import { normalizeToken } from '../analyze/speech.ts';
import { LAYOUT_LEAD_SEC, type StyleLimits } from '../edl/levels.ts';
import type { Breather, Edl, Overlay } from '../edl/schema.ts';
import { mapSpan, sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { formatClock } from '../lib/time.ts';
import { SCENE_COMPONENT } from './budget.ts';
import type { Coverage, Finding, TimedWord } from './checks.ts';

/**
 * Checagens de direção que só existiam como regra escrita (docs/referencia-max.md §10): entrada na palavra,
 * leitura mínima por item, trecho parado dentro da parte editada, respiros colados e legenda sobre palco.
 * Tudo função pura; `lintStyle` junta os achados.
 */

export interface NamedCue {
  /** de qual prop veio: `items[1].at`, `revealAt[2]`, `wordAt[0]`, `note.at`, `markAt`, `revealAt.study1` */
  path: string;
  /** segundos, relativos ao início do overlay */
  at: number;
}

const isCueKey = (key: string) => key === 'at' || key.endsWith('At');
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCueTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Todo instante de entrada declarado nas props de um overlay, com o caminho da prop: número em chave `at` ou
 * terminada em `At` (em qualquer profundidade), lista de números numa chave dessas (`revealAt`, `wordAt`) e
 * registro de números (`revealAt: { html: 0.8 }`, o formato das cenas).
 */
export function namedCues(props: Record<string, unknown>): NamedCue[] {
  const cues: NamedCue[] = [];
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (!isRecord(node)) return;
    for (const [key, value] of Object.entries(node)) {
      const here = path ? `${path}.${key}` : key;
      if (!isCueKey(key)) {
        walk(value, here);
      } else if (isCueTime(value)) {
        cues.push({ path: here, at: value });
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => (isCueTime(item) ? cues.push({ path: `${here}[${index}]`, at: item }) : walk(item, `${here}[${index}]`)));
      } else if (isRecord(value)) {
        for (const [name, item] of Object.entries(value)) {
          if (isCueTime(item)) cues.push({ path: `${here}.${name}`, at: item });
          else walk(item, `${here}.${name}`);
        }
      }
    }
  };
  walk(props, '');
  return cues.sort((a, b) => a.at - b.at);
}

export interface SpokenWord {
  text: string;
  /** segundos do vídeo final */
  start: number;
  end: number;
}

/** As palavras que sobraram no vídeo, no tempo final (as da transcrição estão no tempo da fonte). */
export function spokenWords(words: readonly TimedWord[], timeline: Timeline): SpokenWord[] {
  return words
    .flatMap((word) => {
      const span = mapSpan(timeline, word);
      return span ? [{ text: word.text, start: span.start, end: span.end }] : [];
    })
    .sort((a, b) => a.start - b.start);
}

export interface SyncWindow {
  before: number;
  after: number;
}

/** pausa a partir da qual uma entrada entre duas palavras é entrada em respiro, não erro de sincronia */
export const SYNC_PAUSE_SEC = 0.6;
/** adiantamento sugerido: início da palavra − 2 frames */
export const SYNC_LEAD_SEC = 0.07;
const SYNC_EPSILON = 0.005;
/** meio frame a 30 fps: o cue é arredondado para a grade de frames no render, então menos que isso não se distingue */
export const SYNC_SLACK_SEC = 1 / 60;

export interface SyncMiss {
  word: SpokenWord;
  /** instante − início da palavra: positivo = entrou depois */
  delta: number;
}

/**
 * Uma entrada no instante `time` (vídeo final) está fora de sincronia? Passa quando cai na janela de alguma
 * palavra, ou numa pausa maior que `SYNC_PAUSE_SEC` (aí inclui tudo o que está a mais de 1 s de qualquer fala).
 * Fora disso, devolve a palavra de início mais próximo e a distância.
 */
export function syncMiss(time: number, spoken: readonly SpokenWord[], window: SyncWindow): SyncMiss | null {
  let previous: SpokenWord | undefined;
  let next: SpokenWord | undefined;
  for (const word of spoken) {
    if (time >= word.start - window.before - SYNC_SLACK_SEC && time <= word.start + window.after + SYNC_SLACK_SEC) return null;
    if (word.start <= time) previous = word;
    else {
      next = word;
      break;
    }
  }
  const inPause = !previous || time > previous.end;
  if (inPause && (next?.start ?? Infinity) - (previous?.end ?? -Infinity) > SYNC_PAUSE_SEC) return null;
  const nearest = [previous, next].filter((word): word is SpokenWord => word !== undefined).sort((a, b) => Math.abs(time - a.start) - Math.abs(time - b.start))[0];
  return nearest ? { word: nearest, delta: time - nearest.start } : null;
}

/** até onde, fora do overlay, procurar a palavra dita que uma palavra da frase reproduz */
const PHRASE_SEARCH_SEC = 1.5;

/** As palavras de uma frase revelada por `wordAt`, na ordem (sem a marcação), já normalizadas. */
export function phraseTokens(props: Record<string, unknown>): string[] {
  if (typeof props.text !== 'string' || !Array.isArray(props.wordAt)) return [];
  return props.text.replace(/\*|==/g, ' ').split(/\s+/).filter(Boolean).map(normalizeToken);
}

/**
 * Casa as palavras de uma frase revelada com as palavras DITAS durante o overlay, na mesma ordem (subsequência comum
 * mais longa; no empate, a ocorrência mais perto do cue). Devolve, por palavra da frase, a palavra dita ou undefined.
 * Só vale quando pelo menos metade da frase é dita: abaixo disso a frase é síntese e casar "de" com "de" é acaso.
 */
export function alignPhrase(tokens: readonly string[], times: readonly (number | undefined)[], spoken: readonly SpokenWord[], from: number, to: number): (SpokenWord | undefined)[] {
  const said = spoken.filter((word) => word.start >= from - PHRASE_SEARCH_SEC && word.start <= to + PHRASE_SEARCH_SEC);
  const heard = said.map((word) => normalizeToken(word.text));
  const width = said.length + 1;
  // cada casamento vale 1000 menos a distância ao cue: a contagem manda, a proximidade desempata
  const best = new Float64Array((tokens.length + 1) * width);
  const gain = (i: number, j: number) => 1000 - Math.min(999, Math.abs((times[i] ?? said[j]!.start) - said[j]!.start));
  const match = (i: number, j: number) => tokens[i] !== '' && tokens[i] === heard[j];
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    for (let j = said.length - 1; j >= 0; j -= 1) {
      const skip = Math.max(best[(i + 1) * width + j]!, best[i * width + j + 1]!);
      best[i * width + j] = match(i, j) ? Math.max(skip, best[(i + 1) * width + j + 1]! + gain(i, j)) : skip;
    }
  }
  const aligned: (SpokenWord | undefined)[] = tokens.map(() => undefined);
  let i = 0;
  let j = 0;
  let matched = 0;
  while (i < tokens.length && j < said.length) {
    if (match(i, j) && best[i * width + j] === best[(i + 1) * width + j + 1]! + gain(i, j)) {
      aligned[i] = said[j];
      matched += 1;
      i += 1;
      j += 1;
    } else if (best[(i + 1) * width + j]! >= best[i * width + j + 1]!) i += 1;
    else j += 1;
  }
  return matched * 2 >= tokens.length ? aligned : tokens.map(() => undefined);
}

/**
 * Palavra de frase revelada (`wordAt[i]`): quando a própria palavra é dita, a entrada é cobrada contra ELA, e não contra
 * a mais próxima (uma cascata de passo fixo sempre cai perto de alguma palavra). Sem ela na fala, vale a regra geral.
 */
export function phraseMiss(time: number, said: SpokenWord | undefined, spoken: readonly SpokenWord[], window: SyncWindow): SyncMiss | null {
  if (!said) return syncMiss(time, spoken, window);
  const delta = time - said.start;
  return delta >= -window.before - SYNC_SLACK_SEC && delta <= window.after + SYNC_SLACK_SEC ? null : { word: said, delta };
}

/** Overlay em que nada aparece no `at`: a pilha sem palavra-título só escurece o canto; quem entra são as pílulas. */
const silentEntry = (overlay: Pick<Overlay, 'component' | 'props'>) => overlay.component === 'PillStack' && !overlay.props.title;

const LIST_MAX = 8;
const listed = (items: string[], separator: string) =>
  items.length > LIST_MAX ? `${items.slice(0, LIST_MAX).join(separator)}${separator}… e mais ${items.length - LIST_MAX}` : items.join(separator);
const quote = (text: string) => `"${text.replace(/\s+/g, ' ').trim()}"`;
const side = (delta: number) => `${Math.abs(delta).toFixed(2)}s ${delta > 0 ? 'depois' : 'antes'} de`;

/** Tempo de saída -> fonte, ficando no clipe que COMEÇA na fronteira (o overlay ancora no trecho que vem). */
function toSource(timeline: Timeline, outputTime: number): number | null {
  for (let index = timeline.clips.length - 1; index >= 0; index -= 1) {
    const clip = timeline.clips[index]!;
    if (outputTime >= clip.outputStart - 1e-6 && outputTime <= clip.outputEnd + 1e-6) {
      return Math.min(clip.sourceEnd, clip.sourceStart + Math.max(0, outputTime - clip.outputStart));
    }
  }
  return null;
}

/**
 * `fora-de-sincronia`: cada entrada declarada (o `at` do overlay e os cues internos) cai na janela da palavra que a
 * motiva. Um achado por overlay, com o ajuste de cada cue. O `at` do overlay pode adiantar mais `LAYOUT_LEAD_SEC`:
 * a troca de layout vem 0,15–0,25 s antes da frase.
 */
export function findOffSync(edl: Pick<Edl, 'overlays'>, timeline: Timeline, words: readonly TimedWord[], window: SyncWindow): Finding[] {
  const spoken = spokenWords(words, timeline);
  if (spoken.length === 0) return [];
  const findings: Finding[] = [];
  for (const overlay of edl.overlays) {
    const start = sourceToOutput(timeline, overlay.at);
    if (start === null) continue;
    // cue em 0 é a própria entrada do overlay; cue depois do fim nunca aparece
    const cues = namedCues(overlay.props).filter((cue) => cue.at > SYNC_EPSILON && cue.at < overlay.duration);
    const wordAt = Array.isArray(overlay.props.wordAt) ? overlay.props.wordAt : [];
    const said = alignPhrase(phraseTokens(overlay.props), wordAt.map((time) => (isCueTime(time) ? start + time : undefined)), spoken, start, start + overlay.duration);
    const entry = silentEntry(overlay) ? null : syncMiss(start, spoken, { before: window.before + LAYOUT_LEAD_SEC, after: window.after });
    // palavra-alvo do `at`: o overlay passa a começar `window.before` antes dela
    const movedStart = entry ? Math.max(0, entry.word.start - window.before) : start;
    const movedAt = entry ? toSource(timeline, movedStart) : null;
    const newStart = movedAt === null ? start : movedStart;

    const off: string[] = [];
    const fixes: string[] = [];
    if (entry && movedAt !== null) {
      off.push(`at ${side(entry.delta)} ${quote(entry.word.text)}`);
      fixes.push(`at ${overlay.at.toFixed(2)} → ${movedAt.toFixed(2)}`);
    }
    let kept = 0;
    for (const cue of cues) {
      const index = /^wordAt\[(\d+)\]$/.exec(cue.path)?.[1];
      const miss =
        index === undefined ? syncMiss(start + cue.at, spoken, window) : phraseMiss(start + cue.at, said[Number(index)], spoken, window);
      if (!miss) {
        kept += 1;
        continue;
      }
      const target = miss.word.start - Math.min(SYNC_LEAD_SEC, window.before) - newStart;
      // palavra fora do overlay: não há para onde levar o cue
      if (target < 0 || target >= overlay.duration) continue;
      off.push(`${cue.path} ${side(miss.delta)} ${quote(miss.word.text)}`);
      fixes.push(`${cue.path} ${cue.at.toFixed(2)} → ${target.toFixed(2)}`);
    }
    if (off.length === 0) continue;
    const shift = start - newStart;
    const carry =
      Math.abs(shift) >= 0.01 && kept > 0
        ? `; como o "at" muda, ${shift > 0 ? 'some' : 'subtraia'} ${Math.abs(shift).toFixed(2)} ${shift > 0 ? 'aos' : 'dos'} outros cues deste overlay`
        : '';
    findings.push({
      severity: 'warning',
      check: 'fora-de-sincronia',
      at: start,
      message: `"${overlay.id}": ${off.length} de ${cues.length + (silentEntry(overlay) ? 0 : 1)} entradas fora da palavra (janela −${window.before.toFixed(2)}s/+${window.after.toFixed(2)}s): ${listed(off, ', ')}`,
      fix: `acerte pelo início da palavra (pnpm mce words): ${listed(fixes, '; ')}${carry}`,
    });
  }
  return findings;
}

export interface ReadItem {
  /** o item de texto: `items[2]`, `cards[0]`, `note`, `text` */
  path: string;
  /** a prop do instante de entrada: `items[2].at`, `revealAt[0]`, `wordAt[3]` */
  cuePath: string;
  text: string;
  /** segundos relativos ao overlay */
  from: number;
  until: number;
  /** a prop que tira o item antes do fim do overlay (`items[0].strikeAt`), se houver */
  untilPath: string | null;
  /** tempo mínimo na tela */
  need: number;
  /** `last-word`: a última palavra de uma frase revelada, que só não pode entrar em cima do fim */
  kind: 'text' | 'last-word';
}

const TEXT_KEYS = ['text', 'label', 'title', 'caption', 'word'];
const PAIRED_LISTS = ['revealAt', 'checkAt'];

function textOf(node: unknown): string {
  if (typeof node === 'string') return node.trim();
  if (!isRecord(node)) return '';
  return TEXT_KEYS.map((key) => node[key]).filter((value): value is string => typeof value === 'string' && value.trim() !== '').join(' ');
}

/**
 * Os itens de texto de um overlay que têm instante de entrada declarado, com quanto tempo ficam na tela: do cue até o
 * fim do overlay, ou até o `strikeAt` (a ideia é negada). Reconhece item com `at` próprio (`items`, `lines`, `notes`,
 * `note`), lista casada com `revealAt` (`cards`) e frase revelada por `wordAt`.
 */
export function readItems(props: Record<string, unknown>, duration: number): ReadItem[] {
  const items: ReadItem[] = [];
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (!isRecord(node)) return;
    const at = (key: string) => (path ? `${path}.${key}` : key);
    const text = textOf(node);
    if (isCueTime(node.at) && text) {
      const struck = isCueTime(node.strikeAt) && node.strikeAt > node.at && node.strikeAt < duration;
      items.push({
        path: path || 'props',
        cuePath: at('at'),
        text,
        from: node.at,
        until: struck ? (node.strikeAt as number) : duration,
        untilPath: struck ? at('strikeAt') : null,
        need: minReadSec(text),
        kind: 'text',
      });
    }
    // frase revelada palavra a palavra: a frase inteira conta da primeira palavra; a última não entra em cima do fim
    if (typeof node.text === 'string' && node.text.trim() && Array.isArray(node.wordAt)) {
      const times = node.wordAt.filter(isCueTime);
      if (times.length > 0) {
        const first = Math.min(...times);
        const last = Math.max(...times);
        items.push({ path: at('text'), cuePath: at(`wordAt[${node.wordAt.indexOf(first)}]`), text: node.text.trim(), from: first, until: duration, untilPath: null, need: minReadSec(node.text), kind: 'text' });
        if (times.length > 1) {
          items.push({ path: at('text'), cuePath: at(`wordAt[${node.wordAt.lastIndexOf(last)}]`), text: node.text.trim(), from: last, until: duration, untilPath: null, need: LAST_ENTRY_SEC, kind: 'last-word' });
        }
      }
    }
    for (const list of PAIRED_LISTS) {
      const times = node[list];
      if (!Array.isArray(times)) continue;
      // a lista de textos que `revealAt` revela: a única irmã cujos itens têm texto e não têm `at` próprio
      const siblings = Object.entries(node).filter(
        ([key, value]) => !isCueKey(key) && Array.isArray(value) && value.length > 0 && value.every((item) => textOf(item) !== '' && !(isRecord(item) && isCueTime(item.at))),
      );
      if (siblings.length !== 1) continue;
      const [key, texts] = siblings[0] as [string, unknown[]];
      texts.forEach((item, index) => {
        const time = times[index];
        if (!isCueTime(time)) return;
        items.push({ path: at(`${key}[${index}]`), cuePath: at(`${list}[${index}]`), text: textOf(item), from: time, until: duration, untilPath: null, need: minReadSec(textOf(item)), kind: 'text' });
      });
    }
    for (const [key, value] of Object.entries(node)) if (!isCueKey(key)) walk(value, at(key));
  };
  walk(props, '');
  return items;
}

/** Quanto falta de tela para um item ser lido (0 = dá tempo). */
export function readShortfall(item: ReadItem): number {
  const stay = Math.max(0, item.until - item.from);
  return stay < item.need - SYNC_EPSILON ? item.need - stay : 0;
}

function describeShort(item: ReadItem, missing: number, duration: number): string {
  const stay = Math.max(0, item.until - item.from);
  if (item.from >= duration) return `${item.cuePath} ${quote(item.text)} nunca aparece (entra em ${item.from.toFixed(2)}s e o overlay dura ${duration.toFixed(2)}s; precisa de ${item.need.toFixed(2)}s)`;
  if (item.kind === 'last-word') return `${item.cuePath} (última palavra da frase) entra ${stay.toFixed(2)}s antes do fim (mínimo ${item.need.toFixed(2)}s, faltam ${missing.toFixed(2)}s)`;
  return `${item.cuePath} ${quote(item.text)} fica ${stay.toFixed(2)}s (mínimo ${item.need.toFixed(2)}s, faltam ${missing.toFixed(2)}s)`;
}

/**
 * `leitura-curta`: item de texto que fica na tela menos que `minReadSec` (1,2 s + 0,25 s por palavra).
 * Um achado por overlay, com quanto falta em cada item e o ajuste.
 */
export function findShortReads(edl: Pick<Edl, 'overlays'>, timeline: Timeline): Finding[] {
  const findings: Finding[] = [];
  for (const overlay of edl.overlays) {
    const items = readItems(overlay.props, overlay.duration);
    const short = items.map((item) => ({ item, missing: readShortfall(item) })).filter((entry) => entry.missing > 0);
    if (short.length === 0) continue;
    const texts = new Set(items.map((item) => item.path));
    const extend = Math.max(0, ...short.filter((entry) => entry.item.untilPath === null).map((entry) => entry.missing));
    const fixes: string[] = [];
    if (extend > 0) fixes.push(`aumente "duration" de ${overlay.duration.toFixed(2)} para ${(overlay.duration + extend).toFixed(2)} (ou adiante os cues em ${extend.toFixed(2)}s, se o próximo overlay vem colado)`);
    for (const { item, missing } of short) {
      if (item.untilPath !== null) fixes.push(`${item.untilPath} ${item.until.toFixed(2)} → ${(item.until + missing).toFixed(2)}`);
    }
    findings.push({
      severity: 'warning',
      check: 'leitura-curta',
      at: sourceToOutput(timeline, overlay.at) ?? 0,
      message: `"${overlay.id}": ${new Set(short.map((entry) => entry.item.path)).size} de ${texts.size} textos somem antes de serem lidos: ${listed(
        short.map((entry) => describeShort(entry.item, entry.missing, overlay.duration)),
        ', ',
      )}`,
      fix: listed(fixes, '; '),
    });
  }
  return findings;
}

export interface OutputSpan {
  from: number;
  to: number;
}

/** Um intervalo da fonte no tempo do vídeo final (do primeiro ao último instante dele que ficou); null se foi todo cortado. */
export function spanToOutput(timeline: Timeline, start: number, end: number): OutputSpan | null {
  let span: OutputSpan | null = null;
  for (const clip of timeline.clips) {
    const from = Math.max(start, clip.sourceStart);
    const to = Math.min(end, clip.sourceEnd);
    if (to <= from) continue;
    const placed = { from: clip.outputStart + (from - clip.sourceStart), to: clip.outputStart + (to - clip.sourceStart) };
    span = span ? { from: Math.min(span.from, placed.from), to: Math.max(span.to, placed.to) } : placed;
  }
  return span;
}

/** Um intervalo do vídeo final no tempo da fonte (o que escrever em `breathers`). */
export function spanToSource(timeline: Timeline, span: OutputSpan): { start: number; end: number } | null {
  const first = timeline.clips.findLast((clip) => clip.outputStart <= span.from + 1e-6);
  const last = timeline.clips.find((clip) => clip.outputEnd >= span.to - 1e-6);
  if (!first || !last) return null;
  return {
    start: Math.min(first.sourceEnd, first.sourceStart + (span.from - first.outputStart)),
    end: Math.max(last.sourceStart, last.sourceStart + (span.to - last.outputStart)),
  };
}

/** folga entre a borda do respiro declarado e a do trecho parado medido */
export const BREATHER_TOLERANCE_SEC = 0.5;

/** Os respiros declarados no tempo final, com os colados fundidos. */
export function breatherSpans(breathers: readonly Pick<Breather, 'start' | 'end'>[], timeline: Timeline): OutputSpan[] {
  const spans = breathers
    .map((breather) => spanToOutput(timeline, breather.start, breather.end))
    .filter((span): span is OutputSpan => span !== null)
    .sort((a, b) => a.from - b.from);
  const merged: OutputSpan[] = [];
  for (const span of spans) {
    const previous = merged.at(-1);
    if (previous && span.from <= previous.to + BREATHER_TOLERANCE_SEC) previous.to = Math.max(previous.to, span.to);
    else merged.push({ ...span });
  }
  return merged;
}

const covers = (spans: readonly OutputSpan[], gap: OutputSpan) =>
  spans.some((span) => gap.from >= span.from - BREATHER_TOLERANCE_SEC && gap.to <= span.to + BREATHER_TOLERANCE_SEC);

/** Trechos sem edição que cabem no teto do respiro e que nenhum respiro declarado cobre. */
export function undeclaredStalls(coverage: Coverage, timeline: Timeline, breathers: readonly Pick<Breather, 'start' | 'end'>[], maxPlainSec: number): OutputSpan[] {
  const declared = breatherSpans(breathers, timeline);
  return coverage.plain.filter((gap) => gap.to - gap.from <= maxPlainSec + 0.05 && !covers(declared, gap));
}

/**
 * `trecho-parado`: intervalo sem evento entre `maxIdleSec` e `maxPlainSec` que o diretor não declarou como respiro.
 * (Acima de `maxPlainSec` já é `tela-parada`, declarado ou não.)
 */
export function findStalls(coverage: Coverage, timeline: Timeline, breathers: readonly Pick<Breather, 'start' | 'end'>[], limits: Pick<StyleLimits, 'maxIdleSec' | 'maxPlainSec'>, level: string): Finding[] {
  if (limits.maxIdleSec === null || limits.maxPlainSec === null) return [];
  return undeclaredStalls(coverage, timeline, breathers, limits.maxPlainSec).map((gap) => {
    const source = spanToSource(timeline, gap);
    return {
      severity: 'warning' as const,
      check: 'trecho-parado',
      at: gap.from,
      message: `${(gap.to - gap.from).toFixed(1)}s sem nada novo na tela de ${formatClock(gap.from)} a ${formatClock(gap.to)} (máximo ${limits.maxIdleSec}s no trecho editado do nível ${level}) e o trecho não é um respiro declarado`,
      fix:
        'acrescente pílula (PillStack), item revelado, zoom ou troca de layout nesse intervalo' +
        (source ? `; se for respiro escolhido, declare em "breathers": { "start": ${source.start.toFixed(2)}, "end": ${source.end.toFixed(2)}, "reason": "..." }` : ''),
    };
  });
}

/** `respiros-colados`: dois trechos sem edição com menos de `minBetweenSec` de parte editada entre eles. */
export function findStackedBreathers(coverage: Coverage, minBetweenSec: number | null, level: string): Finding[] {
  if (minBetweenSec === null) return [];
  const gaps = [...coverage.plain].sort((a, b) => a.from - b.from);
  const findings: Finding[] = [];
  gaps.forEach((gap, index) => {
    const previous = gaps[index - 1];
    if (!previous || gap.from - previous.to >= minBetweenSec - 1e-6) return;
    findings.push({
      severity: 'warning',
      check: 'respiros-colados',
      at: gap.from,
      message: `trechos sem edição em ${formatClock(previous.from, 0)}–${formatClock(previous.to, 0)} e ${formatClock(gap.from, 0)}–${formatClock(gap.to, 0)} com só ${Math.max(0, gap.from - previous.to).toFixed(1)}s editados entre eles (mínimo ${minBetweenSec}s no nível ${level})`,
      fix: `edite um dos dois trechos (pílula, item revelado, zoom, palco) ou preencha até ter ${minBetweenSec}s editados entre eles: dois respiros não se colam`,
    });
  });
  return findings;
}

/**
 * Overlay cujo texto briga com a legenda pela base do quadro: palco de cartão lateral, `WindowStage` (em qualquer
 * slot) e cena de tela cheia. Devolve o que ele é, ou null.
 */
export function captionClash(overlay: Pick<Overlay, 'component' | 'presenter'>): string | null {
  if (overlay.component === 'WindowStage') return 'uma janela flutuante (WindowStage)';
  if (SCENE_COMPONENT.test(overlay.component)) return 'uma cena de tela cheia';
  if (overlay.presenter && (overlay.presenter.slot === 'right' || overlay.presenter.slot === 'left')) return 'um palco de tela cheia';
  return null;
}

/** Os respiros declarados e os trechos parados sem declarar, para `mce level` e para o relatório. Vazio se não há o que dizer. */
export function formatBreathers(edl: Pick<Edl, 'breathers'>, timeline: Timeline, coverage: Coverage | null, limits: Pick<StyleLimits, 'maxPlainSec'>): string {
  const lines: string[] = [];
  if (edl.breathers.length) lines.push(`respiros declarados: ${edl.breathers.length}`);
  for (const breather of edl.breathers) {
    const span = spanToOutput(timeline, breather.start, breather.end);
    if (!span) {
      lines.push(`  fonte ${breather.start.toFixed(2)}–${breather.end.toFixed(2)}s: trecho cortado — ${breather.reason}`);
      continue;
    }
    const idle = coverage?.plain.some((gap) => gap.from < span.to && gap.to > span.from) ?? true;
    lines.push(`  ${formatClock(span.from, 0)}–${formatClock(span.to, 0)} (${(span.to - span.from).toFixed(0)}s) — ${breather.reason}${idle ? '' : ' · há edição aqui: não é mais respiro'}`);
  }
  if (coverage && limits.maxPlainSec !== null) {
    const loose = undeclaredStalls(coverage, timeline, edl.breathers, limits.maxPlainSec);
    if (loose.length) {
      lines.push(`trechos parados sem declarar: ${loose.length} (${listed(loose.map((gap) => `${formatClock(gap.from, 0)}–${formatClock(gap.to, 0)}`), ', ')})`);
    }
  }
  return lines.join('\n');
}
