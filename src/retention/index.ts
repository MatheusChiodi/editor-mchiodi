import type { Word } from '../analyze/types.ts';
import type { Edl } from '../edl/schema.ts';
import { mapSpan, outputToSource, sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { formatClock } from '../lib/time.ts';
import { buildChapters, type Chapter } from '../report/index.ts';

/**
 * Loop de retenção: a curva exportada do YouTube Studio volta para o projeto, cada queda é ligada ao trecho
 * da EDL e à fala que estavam na tela, e o conjunto dos vídeos vira lições para o diretor. Tudo puro;
 * arquivo e ffprobe ficam em `cli.ts`.
 */

/** Ponto da curva: tempo do vídeo FINAL (com vinhetas) em segundos e retenção absoluta (1 = 100%; rewatch passa de 1). */
export interface RetentionPoint {
  at: number;
  retention: number;
}

export type PositionAxis = 'percent' | 'seconds';

export interface ParsedCurve {
  axis: PositionAxis;
  /** posição como veio no arquivo: fração 0–1 do vídeo (`percent`) ou segundos */
  points: { position: number; retention: number }[];
  columns: { position: string; retention: string };
}

// ---------------------------------------------------------------- CSV

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeHeader(text: string): string {
  return stripAccents(text).toLowerCase().replace(/^﻿/, '').trim();
}

/** Separador pelo cabeçalho: o que mais aparece fora de aspas entre `;`, tab e `,`. */
export function detectSeparator(headerLine: string): string {
  const outside = headerLine.replace(/"[^"]*"/g, '');
  const counts = [';', '\t', ','].map((sep) => ({ sep, count: outside.split(sep).length - 1 }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0]!.count > 0 ? counts[0]!.sep : ',';
}

export function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === separator && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

/**
 * Número em qualquer formato do Studio: `12.5`, `12,5`, `1.234,5`, `1,234.5`, `85%`, `1:23` (m:ss) ou `1:02:03`.
 * `null` quando não é número.
 */
export function parseLocaleNumber(raw: string): number | null {
  const text = raw.replace(/[%\s ]/g, '');
  if (!text) return null;
  if (/^\d+(:\d{1,2}){1,2}([.,]\d+)?$/.test(text)) {
    return text
      .replace(',', '.')
      .split(':')
      .reduce((total, part) => total * 60 + Number(part), 0);
  }
  let normalized = text;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // o último separador é o decimal; o outro é milhar
    normalized = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = text.replace(',', '.');
  }
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(normalized)) return null;
  return Number(normalized);
}

const RETENTION_KEYS = ['retention', 'retencao', 'audience', 'publico'];
const POSITION_KEYS = ['position', 'posicao', 'time', 'tempo', 'second', 'segundo', 'momento', 'duracao', 'elapsed'];

function pickColumns(headers: string[]): { position: number; retention: number } | null {
  const normalized = headers.map(normalizeHeader);
  const retentionCandidates = normalized
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => RETENTION_KEYS.some((key) => header.includes(key)) && !/relativ/.test(header));
  const retention = (retentionCandidates.find(({ header }) => header.includes('absolut')) ?? retentionCandidates[0])?.index;
  const position = normalized.findIndex((header, index) => index !== retention && POSITION_KEYS.some((key) => header.includes(key)));
  if (retention === undefined || position < 0) return null;
  return { position, retention };
}

function positionAxis(header: string, values: string[]): PositionAxis {
  const name = normalizeHeader(header);
  if (values.some((value) => value.includes(':'))) return 'seconds';
  if (name.includes('%') || name.includes('percent') || name.includes('porcent')) return 'percent';
  if (/\b(s|seg|sec)\b|segundo|second|tempo|time/.test(name)) return 'seconds';
  return 'percent';
}

/**
 * CSV de retenção do YouTube Studio (EN ou PT, `,` ou `;`, decimal `.` ou `,`). Aceita posição em % do vídeo
 * (0–100 ou 0–1) ou em segundos/m:ss, e retenção em % ou em fração. Linhas que não são número são ignoradas.
 */
export function parseRetentionCsv(text: string): ParsedCurve {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  let headerIndex = -1;
  let columns: { position: number; retention: number } | null = null;
  let separator = ',';
  for (const [index, line] of lines.entries()) {
    separator = detectSeparator(line);
    columns = pickColumns(splitCsvLine(line, separator));
    if (columns) {
      headerIndex = index;
      break;
    }
  }
  if (!columns) {
    throw new Error('CSV sem colunas de retenção reconhecidas: espero algo como "Video position (%)" + "Absolute audience retention (%)" (ou em PT)');
  }
  const headers = splitCsvLine(lines[headerIndex]!, separator);
  const rows = lines.slice(headerIndex + 1).map((line) => splitCsvLine(line, separator));
  const rawPositions = rows.map((row) => row[columns!.position] ?? '');
  const axis = positionAxis(headers[columns.position]!, rawPositions);
  const parsed = rows
    .map((row) => ({ position: parseLocaleNumber(row[columns!.position] ?? ''), retention: parseLocaleNumber(row[columns!.retention] ?? '') }))
    .filter((row): row is { position: number; retention: number } => row.position !== null && row.retention !== null);
  if (parsed.length < 2) throw new Error('CSV de retenção com menos de 2 pontos numéricos');

  const retentionHeader = normalizeHeader(headers[columns.retention]!);
  const maxRetention = Math.max(...parsed.map((row) => row.retention));
  // rewatch passa de 100%, mas uma fração nunca chega a 3 (300%)
  const retentionScale = retentionHeader.includes('%') || maxRetention > 3 ? 100 : 1;
  const maxPosition = Math.max(...parsed.map((row) => row.position));
  const positionScale = axis === 'percent' && maxPosition > 1.0001 ? 100 : 1;
  return {
    axis,
    columns: { position: headers[columns.position]!, retention: headers[columns.retention]! },
    points: parsed.map((row) => ({ position: row.position / positionScale, retention: row.retention / retentionScale })),
  };
}

/** Converte para tempo de saída usando a duração do final renderizado; ordena e funde posições repetidas. */
export function normalizeCurve(curve: ParsedCurve, durationSec: number): RetentionPoint[] {
  const byTime = new Map<number, number>();
  for (const point of curve.points) {
    const at = curve.axis === 'percent' ? point.position * durationSec : point.position;
    const key = Math.round(Math.min(Math.max(at, 0), durationSec) * 1000) / 1000;
    byTime.set(key, point.retention);
  }
  return [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([at, retention]) => ({ at, retention: round4(retention) }));
}

// ---------------------------------------------------------------- análise da curva

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function retentionAt(points: readonly RetentionPoint[], at: number): number {
  if (points.length === 0) return 0;
  if (at <= points[0]!.at) return points[0]!.retention;
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index]!;
    if (at <= right.at) {
      const left = points[index - 1]!;
      const span = right.at - left.at;
      return span <= 0 ? right.retention : left.retention + ((at - left.at) / span) * (right.retention - left.retention);
    }
  }
  return points.at(-1)!.retention;
}

/** Retenção média ponderada pelo tempo (área sob a curva / duração coberta). */
export function averageRetention(points: readonly RetentionPoint[]): number {
  if (points.length < 2) return points[0]?.retention ?? 0;
  let area = 0;
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1]!;
    const right = points[index]!;
    area += ((left.retention + right.retention) / 2) * (right.at - left.at);
  }
  const span = points.at(-1)!.at - points[0]!.at;
  return span > 0 ? area / span : points[0]!.retention;
}

export interface CurveWindow {
  start: number;
  end: number;
  /** retenção no começo e no fim do trecho */
  from: number;
  to: number;
  /** variação em fração do público (queda positiva em `drops`, ganho positivo em `spikes`) */
  amount: number;
  /** p.p. de público por minuto no trecho */
  ratePerMin: number;
}

export interface DetectOptions {
  /** queda brusca = inclinação pior que `steepFactor` × a queda típica do vídeo */
  steepFactor: number;
  /** e também pior que isto (fração por segundo), para uma curva quase plana não acusar ruído */
  minSlopePerSec: number;
  /** quedas menores que isto (fração) são ruído */
  minDrop: number;
  /** picos de rewatch menores que isto (fração) são ruído */
  minSpike: number;
  /** a abertura e o encerramento não entram na queda típica */
  introSec: number;
  endFraction: number;
}

export const DETECT_DEFAULTS: DetectOptions = {
  steepFactor: 2.5,
  minSlopePerSec: 0.0015,
  minDrop: 0.02,
  minSpike: 0.01,
  introSec: 30,
  endFraction: 0.9,
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function slopes(points: readonly RetentionPoint[]): { start: number; end: number; from: number; to: number; slope: number }[] {
  const result = [];
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1]!;
    const right = points[index]!;
    const dt = right.at - left.at;
    if (dt <= 0) continue;
    result.push({ start: left.at, end: right.at, from: left.retention, to: right.retention, slope: (right.retention - left.retention) / dt });
  }
  return result;
}

/** Inclinação típica (fração/s, ≤ 0) do miolo do vídeo: a régua do que é "queda brusca". */
export function typicalSlope(points: readonly RetentionPoint[], options: DetectOptions = DETECT_DEFAULTS): number {
  const duration = points.at(-1)?.at ?? 0;
  const segments = slopes(points);
  const core = segments.filter((segment) => segment.start >= options.introSec && segment.end <= duration * options.endFraction);
  return Math.min(0, median((core.length >= 3 ? core : segments).map((segment) => segment.slope)));
}

function mergeRuns(
  segments: ReturnType<typeof slopes>,
  isMember: (slope: number) => boolean,
  sign: 1 | -1,
  minAmount: number,
): CurveWindow[] {
  const windows: CurveWindow[] = [];
  let run: ReturnType<typeof slopes> = [];
  const flush = () => {
    if (run.length === 0) return;
    const first = run[0]!;
    const last = run.at(-1)!;
    const amount = sign * (last.to - first.from);
    if (amount >= minAmount) {
      windows.push({
        start: first.start,
        end: last.end,
        from: first.from,
        to: last.to,
        amount: round4(amount),
        ratePerMin: round1(((amount * 100) / Math.max(1e-6, last.end - first.start)) * 60),
      });
    }
    run = [];
  };
  for (const segment of segments) {
    const previous = run.at(-1);
    if (isMember(segment.slope) && (!previous || Math.abs(previous.end - segment.start) < 1e-6)) run.push(segment);
    else {
      flush();
      if (isMember(segment.slope)) run.push(segment);
    }
  }
  flush();
  return windows;
}

/** Quedas bruscas: trechos contíguos com inclinação bem pior que a típica do próprio vídeo. */
export function detectDrops(points: readonly RetentionPoint[], options: DetectOptions = DETECT_DEFAULTS): CurveWindow[] {
  const threshold = Math.min(typicalSlope(points, options) * options.steepFactor, -options.minSlopePerSec);
  return mergeRuns(slopes(points), (slope) => slope < threshold, -1, options.minDrop);
}

/** Picos (rewatch): trechos em que a retenção sobe — gente voltando para rever. */
export function detectSpikes(points: readonly RetentionPoint[], options: DetectOptions = DETECT_DEFAULTS): CurveWindow[] {
  return mergeRuns(slopes(points), (slope) => slope > options.minSlopePerSec / 2, 1, options.minSpike);
}

// ---------------------------------------------------------------- mapeamento para a EDL

export interface OverlaySpan {
  id: string;
  component: string;
  /** em segundos do vídeo final */
  start: number;
  end: number;
}

export interface EdlContext {
  timeline: Timeline;
  introSec: number;
  outroSec: number;
  /** duração do vídeo final (com vinhetas) */
  durationSec: number;
  overlays: OverlaySpan[];
  chapters: Chapter[];
  words: Pick<Word, 'text' | 'start' | 'end'>[];
}

export function buildEdlContext(
  edl: Pick<Edl, 'overlays' | 'chapters'>,
  timeline: Timeline,
  bumpers: { introSec: number; outroSec: number },
  words: Pick<Word, 'text' | 'start' | 'end'>[],
): EdlContext {
  const overlays = edl.overlays
    .map((overlay) => {
      const at = sourceToOutput(timeline, overlay.at);
      return at === null ? null : { id: overlay.id, component: overlay.component, start: at + bumpers.introSec, end: at + bumpers.introSec + overlay.duration };
    })
    .filter((overlay): overlay is OverlaySpan => overlay !== null)
    .sort((a, b) => a.start - b.start);
  return {
    timeline,
    ...bumpers,
    durationSec: timeline.durationSec + bumpers.introSec + bumpers.outroSec,
    overlays,
    chapters: buildChapters(edl, timeline, bumpers.introSec).chapters,
    words,
  };
}

export type Region = 'intro' | 'main' | 'outro';

export interface MomentContext {
  region: Region;
  /** segundo da FONTE no começo do trecho (`null` nas vinhetas) */
  sourceAt: number | null;
  clip: { id: string; sourceStart: number; sourceEnd: number; sec: number } | null;
  /** segundos desde o último corte (começo do clipe) até o começo do trecho */
  sinceCutSec: number | null;
  chapter: string | null;
  /** segundos desde o começo do capítulo */
  chapterOffsetSec: number | null;
  /** gráficos na tela em algum momento do trecho (`Componente#id`) */
  overlays: string[];
  /** segundos sem gráfico até o começo do trecho; 0 se havia gráfico na tela */
  graphicGapSec: number;
  /** o que estava sendo dito (de alguns segundos antes até o fim do trecho) */
  text: string;
}

/** Quanto antes da queda a fala ainda conta: quem sai reage ao que ouviu há pouco. */
const SPEECH_LEAD_SEC = 5;
const MAX_TEXT_WORDS = 30;

export function regionAt(context: Pick<EdlContext, 'introSec' | 'timeline'>, at: number): Region {
  if (at < context.introSec) return 'intro';
  if (at >= context.introSec + context.timeline.durationSec) return 'outro';
  return 'main';
}

/** Segundos sem gráfico até `at` (0 se há um na tela); sem nenhum antes, conta desde o começo do conteúdo. */
export function graphicGapAt(context: Pick<EdlContext, 'overlays' | 'introSec'>, at: number): number {
  let lastEnd = context.introSec;
  for (const overlay of context.overlays) {
    if (overlay.start > at) break;
    if (overlay.end > at) return 0;
    lastEnd = Math.max(lastEnd, overlay.end);
  }
  return round1(Math.max(0, at - lastEnd));
}

export function describeMoment(context: EdlContext, start: number, end: number): MomentContext {
  const region = regionAt(context, start);
  const local = start - context.introSec;
  const sourceAt = region === 'main' ? outputToSource(context.timeline, local) : null;
  const placed = region === 'main' ? context.timeline.clips.find((clip) => local >= clip.outputStart - 1e-6 && local < clip.outputEnd) : undefined;
  const chapter = [...context.chapters].reverse().find((item) => item.at <= start + 1e-6) ?? null;
  const lead = start - SPEECH_LEAD_SEC - context.introSec;
  const tail = end - context.introSec;
  const spoken = context.words.filter((word) => {
    const mapped = mapSpan(context.timeline, word);
    return mapped !== null && mapped.end > lead && mapped.start < tail;
  });
  const text = spoken.slice(-MAX_TEXT_WORDS).map((word) => word.text.trim()).join(' ');
  return {
    region,
    sourceAt,
    clip: placed ? { id: placed.id, sourceStart: placed.sourceStart, sourceEnd: placed.sourceEnd, sec: round1(placed.outputEnd - placed.outputStart) } : null,
    sinceCutSec: placed ? round1(local - placed.outputStart) : null,
    chapter: chapter?.title ?? null,
    chapterOffsetSec: chapter ? round1(start - chapter.at) : null,
    overlays: context.overlays.filter((overlay) => overlay.start < end && overlay.end > start).map((overlay) => `${overlay.component}#${overlay.id}`),
    graphicGapSec: region === 'main' ? graphicGapAt(context, start) : 0,
    text: spoken.length > MAX_TEXT_WORDS ? `… ${text}` : text,
  };
}

export type DropHint = 'abertura' | 'vinheta' | 'encerramento' | 'sem-grafico' | 'com-grafico' | 'troca-de-capitulo' | 'clipe-longo';

/** Explicação longa sem reforço visual: o padrão que mais derruba aula (STYLE.md §1). */
export const LONG_GAP_SEC = 30;
/** tanto tempo sem nenhum corte = plano parado longo */
const LONG_TAKE_SEC = 45;
const CHAPTER_EDGE_SEC = 5;

export function dropHints(moment: MomentContext, window: Pick<CurveWindow, 'start' | 'end'>, durationSec: number, options = DETECT_DEFAULTS): DropHint[] {
  const hints: DropHint[] = [];
  if (moment.region === 'intro' || moment.region === 'outro') hints.push('vinheta');
  if (window.start < options.introSec) hints.push('abertura');
  if (moment.region === 'outro' || window.end >= durationSec * options.endFraction) hints.push('encerramento');
  if (moment.region === 'main' && moment.overlays.length === 0 && moment.graphicGapSec >= LONG_GAP_SEC) hints.push('sem-grafico');
  if (moment.overlays.length > 0) hints.push('com-grafico');
  if (moment.chapterOffsetSec !== null && moment.chapterOffsetSec <= CHAPTER_EDGE_SEC && moment.chapterOffsetSec >= 0 && window.start > 1) hints.push('troca-de-capitulo');
  if (moment.sinceCutSec !== null && moment.sinceCutSec >= LONG_TAKE_SEC) hints.push('clipe-longo');
  return hints;
}

export const HINT_LABEL: Record<DropHint, string> = {
  abertura: 'nos 30 s iniciais',
  vinheta: 'durante a vinheta',
  encerramento: 'no encerramento',
  'sem-grafico': 'explicação longa sem gráfico',
  'com-grafico': 'com gráfico na tela',
  'troca-de-capitulo': 'logo na troca de capítulo',
  'clipe-longo': 'muito tempo sem corte',
};

function hintText(hint: DropHint, moment: MomentContext): string {
  if (hint === 'sem-grafico') return `${HINT_LABEL[hint]} (${moment.graphicGapSec.toFixed(0)} s)`;
  if (hint === 'com-grafico') return `${HINT_LABEL[hint]} (${moment.overlays.join(', ')})`;
  if (hint === 'clipe-longo' && moment.sinceCutSec !== null) return `${HINT_LABEL[hint]} (${moment.sinceCutSec.toFixed(0)} s)`;
  return HINT_LABEL[hint];
}

export interface RetentionDrop extends CurveWindow {
  moment: MomentContext;
  hints: DropHint[];
  lesson: string;
}

export interface RetentionSpike extends CurveWindow {
  moment: MomentContext;
}

export function dropLesson(window: CurveWindow, moment: MomentContext, hints: DropHint[]): string {
  const where = moment.chapter ? ` (capítulo "${moment.chapter}")` : '';
  const why = hints.length ? hints.map((hint) => hintText(hint, moment)).join(', ') : 'sem causa óbvia na EDL — veja a fala';
  const speech = moment.text ? ` — fala: "${moment.text.length > 120 ? `${moment.text.slice(0, 117)}…` : moment.text}"` : '';
  return `queda de ${(window.amount * 100).toFixed(0)} p.p. em ${formatClock(window.start, 0)}${where}: ${why}${speech}`;
}

export type ExposureBucket = 'grafico' | 'curto' | 'medio' | 'longo';

/** Faixas de "segundos sem gráfico": com gráfico na tela, < 30 s, 30–60 s, > 60 s. */
export function exposureBucket(gapSec: number): ExposureBucket {
  if (gapSec <= 0) return 'grafico';
  if (gapSec < LONG_GAP_SEC) return 'curto';
  if (gapSec < 2 * LONG_GAP_SEC) return 'medio';
  return 'longo';
}

export type Exposure = Record<ExposureBucket, { sec: number; loss: number }>;

/**
 * Quanto tempo do miolo do vídeo passou em cada faixa de "segundos sem gráfico" e quanto público
 * se perdeu nela. A abertura e o encerramento ficam de fora: caem em todo vídeo, com ou sem gráfico.
 */
export function exposureByGraphicGap(points: readonly RetentionPoint[], context: EdlContext, options = DETECT_DEFAULTS): Exposure {
  const exposure: Exposure = { grafico: { sec: 0, loss: 0 }, curto: { sec: 0, loss: 0 }, medio: { sec: 0, loss: 0 }, longo: { sec: 0, loss: 0 } };
  const from = Math.max(options.introSec, context.introSec);
  const to = Math.min(context.durationSec * options.endFraction, context.introSec + context.timeline.durationSec);
  for (const segment of slopes(points)) {
    const middle = (segment.start + segment.end) / 2;
    if (middle < from || middle > to) continue;
    const bucket = exposure[exposureBucket(graphicGapAt(context, middle))];
    bucket.sec += segment.end - segment.start;
    bucket.loss += segment.from - segment.to;
  }
  for (const bucket of Object.values(exposure)) {
    bucket.sec = round1(bucket.sec);
    bucket.loss = round4(bucket.loss);
  }
  return exposure;
}

export interface RetentionAnalysis {
  version: 1;
  slug: string;
  importedAt: string;
  sourceFile: string;
  edlVersion: number;
  durationSec: number;
  introSec: number;
  /** primeiro gráfico no vídeo final (s); `null` se não há */
  firstGraphicAt: number | null;
  axis: PositionAxis;
  summary: { average: number; at30: number; end: number; typicalPerMin: number };
  points: RetentionPoint[];
  drops: RetentionDrop[];
  spikes: RetentionSpike[];
  exposure: Exposure;
  /** frases prontas para o project.md e o relatório, das quedas maiores para as menores */
  lessons: string[];
}

export interface AnalyzeInput {
  slug: string;
  sourceFile: string;
  edlVersion: number;
  axis: PositionAxis;
  points: RetentionPoint[];
  context: EdlContext;
  importedAt: string;
  options?: DetectOptions;
}

export function analyzeRetention(input: AnalyzeInput): RetentionAnalysis {
  const options = input.options ?? DETECT_DEFAULTS;
  const { points, context } = input;
  const drops = detectDrops(points, options).map((window) => {
    const moment = describeMoment(context, window.start, window.end);
    const hints = dropHints(moment, window, context.durationSec, options);
    return { ...window, moment, hints, lesson: dropLesson(window, moment, hints) };
  });
  const spikes = detectSpikes(points, options).map((window) => ({ ...window, moment: describeMoment(context, window.start, window.end) }));
  return {
    version: 1,
    slug: input.slug,
    importedAt: input.importedAt,
    sourceFile: input.sourceFile,
    edlVersion: input.edlVersion,
    durationSec: context.durationSec,
    introSec: context.introSec,
    firstGraphicAt: context.overlays[0]?.start ?? null,
    axis: input.axis,
    summary: {
      average: round4(averageRetention(points)),
      at30: round4(retentionAt(points, 30)),
      end: round4(points.at(-1)?.retention ?? 0),
      typicalPerMin: round1(typicalSlope(points, options) * 100 * 60),
    },
    points,
    drops,
    spikes,
    exposure: exposureByGraphicGap(points, context, options),
    lessons: [...drops].sort((a, b) => b.amount - a.amount).map((drop) => drop.lesson),
  };
}

// ---------------------------------------------------------------- textos

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

/** Bloco curto para o project.md: o diretor lê antes de mexer de novo neste vídeo. */
export function memorySummary(analysis: RetentionAnalysis, maxLessons = 5): string[] {
  const lines = [
    `- ${analysis.importedAt.slice(0, 10)}: retenção média ${pct(analysis.summary.average)}, aos 30 s ${pct(analysis.summary.at30)}, no fim ${pct(analysis.summary.end)} (EDL v${analysis.edlVersion}; quedas bruscas: ${analysis.drops.length}; picos de rewatch: ${analysis.spikes.length})`,
  ];
  for (const lesson of analysis.lessons.slice(0, maxLessons)) lines.push(`- lição: ${lesson}`);
  for (const spike of analysis.spikes.slice(0, 3)) {
    lines.push(`- rewatch: +${(spike.amount * 100).toFixed(0)} p.p. em ${formatClock(spike.start, 0)}${spike.moment.overlays.length ? ` com ${spike.moment.overlays.join(', ')}` : ''} — vale repetir o recurso`);
  }
  return lines;
}

// ---------------------------------------------------------------- agregação entre projetos

const BUCKET_LABEL: Record<ExposureBucket, string> = {
  grafico: 'com gráfico na tela',
  curto: `sem gráfico há < ${LONG_GAP_SEC} s`,
  medio: `sem gráfico há ${LONG_GAP_SEC}–${2 * LONG_GAP_SEC} s`,
  longo: `sem gráfico há > ${2 * LONG_GAP_SEC} s`,
};

/** Exposição mínima (s) de uma faixa para entrar na comparação: menos que isso é anedota. */
const MIN_EXPOSURE_SEC = 60;
/** primeiro gráfico até aqui = abertura com reforço visual */
const EARLY_GRAPHIC_SEC = 15;

function perMinute(entry: { sec: number; loss: number }): number {
  return entry.sec > 0 ? (entry.loss * 100 * 60) / entry.sec : 0;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

/** Padrões dos vídeos com retenção importada, em texto para o diretor ler antes de dirigir. */
export function aggregateLessons(items: readonly RetentionAnalysis[]): string {
  if (items.length === 0) return 'Sem dados de retenção. Importe a curva do YouTube Studio: pnpm mce retention import <slug> <arquivo.csv>';
  const lines = [`# Lições de retenção — ${items.length} vídeo(s): ${items.map((item) => item.slug).join(', ')}`, ''];

  const worst30 = [...items].sort((a, b) => a.summary.at30 - b.summary.at30)[0]!;
  lines.push(
    `- retenção média ${pct(mean(items.map((item) => item.summary.average)))} · aos 30 s ${pct(mean(items.map((item) => item.summary.at30)))} (pior: ${worst30.slug}, ${pct(worst30.summary.at30)})`,
    `- queda típica no miolo: ${mean(items.map((item) => -item.summary.typicalPerMin)).toFixed(1)} p.p./min`,
  );

  // abertura
  const early = items.filter((item) => item.firstGraphicAt !== null && item.firstGraphicAt <= EARLY_GRAPHIC_SEC);
  const late = items.filter((item) => !early.includes(item));
  if (early.length && late.length) {
    const a = mean(early.map((item) => item.summary.at30));
    const b = mean(late.map((item) => item.summary.at30));
    lines.push(
      `- abertura: com gráfico nos primeiros ${EARLY_GRAPHIC_SEC} s retém ${pct(a)} aos 30 s (${early.length} vídeo(s)) vs ${pct(b)} sem (${late.length})${a > b + 0.02 ? ' → abra com reforço visual cedo' : ''}`,
    );
  }
  const withBumper = items.filter((item) => item.introSec > 0);
  const noBumper = items.filter((item) => item.introSec === 0);
  if (withBumper.length && noBumper.length) {
    const a = mean(withBumper.map((item) => item.summary.at30));
    const b = mean(noBumper.map((item) => item.summary.at30));
    lines.push(`- vinheta de abertura: ${pct(a)} aos 30 s com (${withBumper.length}) vs ${pct(b)} sem (${noBumper.length})${b > a + 0.02 ? ' → a vinheta custa público' : ''}`);
  }

  // faixas de "segundos sem gráfico"
  const total: Exposure = { grafico: { sec: 0, loss: 0 }, curto: { sec: 0, loss: 0 }, medio: { sec: 0, loss: 0 }, longo: { sec: 0, loss: 0 } };
  for (const item of items) {
    for (const key of Object.keys(total) as ExposureBucket[]) {
      total[key].sec += item.exposure[key].sec;
      total[key].loss += item.exposure[key].loss;
    }
  }
  const measured = (Object.keys(total) as ExposureBucket[]).filter((key) => total[key].sec >= MIN_EXPOSURE_SEC);
  if (measured.length) {
    lines.push('', 'Perda de público por minuto (fora da abertura e do encerramento):');
    for (const key of measured) lines.push(`- ${BUCKET_LABEL[key]}: ${perMinute(total[key]).toFixed(1)} p.p./min em ${(total[key].sec / 60).toFixed(1)} min`);
    const merge = (keys: ExposureBucket[]) => ({ sec: keys.reduce((s, k) => s + total[k].sec, 0), loss: keys.reduce((s, k) => s + total[k].loss, 0) });
    const short = merge(['grafico', 'curto']);
    const long = merge(['medio', 'longo']);
    if (short.sec >= MIN_EXPOSURE_SEC && long.sec >= MIN_EXPOSURE_SEC && perMinute(short) > 0) {
      const ratio = perMinute(long) / perMinute(short);
      lines.push(
        ratio >= 1.2
          ? `→ trechos sem gráfico há mais de ${LONG_GAP_SEC} s perdem ${ratio.toFixed(1)}× mais público por minuto: não passe de ${LONG_GAP_SEC} s de explicação sem reforço visual`
          : `→ ficar mais de ${LONG_GAP_SEC} s sem gráfico não derrubou mais que o resto (${ratio.toFixed(1)}×): gráfico não é a alavanca aqui`,
      );
    }
  }

  // contexto das quedas
  const drops = items.flatMap((item) => item.drops.map((drop) => ({ slug: item.slug, drop })));
  if (drops.length) {
    const byHint = new Map<DropHint, number[]>();
    for (const { drop } of drops) for (const hint of drop.hints) byHint.set(hint, [...(byHint.get(hint) ?? []), drop.amount]);
    lines.push('', `Quedas bruscas: ${drops.length} (média ${(mean(drops.map(({ drop }) => drop.amount)) * 100).toFixed(1)} p.p.)`);
    for (const [hint, amounts] of [...byHint.entries()].sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`- ${HINT_LABEL[hint]}: ${amounts.length}× (média ${(mean(amounts) * 100).toFixed(1)} p.p.)`);
    }
    const unexplained = drops.filter(({ drop }) => drop.hints.length === 0).length;
    if (unexplained) lines.push(`- sem causa óbvia na EDL: ${unexplained}× — leia a fala nas piores abaixo`);
    lines.push('', 'Piores quedas:');
    for (const { slug, drop } of [...drops].sort((a, b) => b.drop.amount - a.drop.amount).slice(0, 5)) lines.push(`- [${slug}] ${drop.lesson}`);
  }

  const spikes = items.flatMap((item) => item.spikes);
  if (spikes.length) {
    const components = new Map<string, number>();
    for (const spike of spikes) for (const overlay of spike.moment.overlays) {
      const name = overlay.split('#')[0]!;
      components.set(name, (components.get(name) ?? 0) + 1);
    }
    const top = [...components.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    lines.push('', `Picos de rewatch: ${spikes.length}${top.length ? `; gráficos na tela: ${top.map(([name, count]) => `${name} (${count}×)`).join(', ')} → recursos que fazem rever` : ' (nenhum com gráfico na tela)'}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Render final que foi ao ar: o mais recente entre os `v<N>-final/final.mp4` (o `output/` é cópia do último). */
export function pickDeliveredRender(renders: readonly { dir: string; mtimeMs: number }[]): number | null {
  const finals = renders
    .map((render) => ({ version: Number(/^v(\d+)-final$/.exec(render.dir)?.[1] ?? Number.NaN), mtimeMs: render.mtimeMs }))
    .filter((render) => Number.isFinite(render.version))
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.version - a.version);
  return finals[0]?.version ?? null;
}
