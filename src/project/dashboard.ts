import { formatClock } from '../lib/time.ts';
import { formatActivity, stepDurations, totalSpent } from './activity.ts';
import { KEY_HELP } from './dashboard-keys.ts';
import { type Health, healthParts } from './health.ts';
import type { ItemExtras, QueueSummary } from './insight.ts';
import { isFresh } from './live.ts';
import { countProgress, currentStep, JOB_LABEL, nextCommand, type Snapshot, type Step, type StepState } from './pipeline.ts';

export interface DashboardItem {
  snapshot: Snapshot;
  steps: Step[];
  /** histórico, última avaliação e orçamento: aparecem na edição em foco */
  extra?: ItemExtras;
}

/** Etapa que acabou de terminar com o painel aberto: fica destacada por alguns segundos. */
export interface Flash {
  slug: string;
  key: Step['key'];
}

export interface DashboardOptions {
  items: DashboardItem[];
  now: number;
  columns: number;
  /** altura disponível; sem ela (impressão única) o quadro tem o tamanho que precisar */
  rows?: number;
  color?: boolean;
  /** contador de quadros: move o spinner */
  tick?: number;
  /** slug da edição que ganha o espaço quando falta altura; sem ele, a que está rodando */
  focus?: string;
  /** modo watch: mostra o rodapé e o fixa na última linha */
  intervalSec?: number;
  /** aviso no rodapé (ex.: leitura que falhou) */
  notice?: string;
  /** teclado ligado: o rodapé mostra as teclas em vez de "Ctrl+C sai" */
  keys?: boolean;
  /** edição selecionada pelo teclado: ganha o marcador e a prioridade de `focus` */
  selected?: string;
  /** a selecionada ocupa a tela (todas as etapas e detalhes) e as outras viram uma linha */
  expanded?: boolean;
  /** mostra a ajuda de teclas no lugar das edições */
  help?: boolean;
  /** resposta curta a uma tecla ("copiado: …"), no rodapé */
  toast?: string;
  flash?: Flash[];
  /** saúde da máquina, no cabeçalho */
  health?: Health;
  /** fila do modo autônomo: uma linha acima do rodapé quando há algo pendente, rodando ou com falha */
  queue?: QueueSummary;
}

type Tone = 'done' | 'running' | 'problem' | 'next' | 'muted' | 'strong' | 'brand' | 'flash';
type Paint = (tone: Tone, text: string) => string;

/** Acima disso o painel para de esticar: linha longa demais cansa de ler. */
export const MAX_WIDTH = 120;
/** A partir daqui o detalhe vai ao lado da etapa, inteiro; abaixo, empilha e abrevia. */
export const WIDE_FROM = 100;
const STATE_COLUMN_FROM = 120;
const LABEL_WIDTH = 21;
const MIN_CUT_CARD = 5;
/** Cartão cortado de uma edição que não é a principal só vale a pena se mostrar umas 3 etapas. */
const MIN_SIDE_CARD = 7;
/** Coluna do rótulo das seções extras do cartão ("qualidade", "histórico"). */
const EXTRA_LABEL = 11;
/** Linhas de histórico: no painel ao vivo, na impressão única da edição pedida e das demais. */
const HISTORY_MAX = { watch: 12, printFocus: 10, print: 4 };
const MACHINE_STEPS = new Set<Step['key']>(['analysis', 'preview', 'eval', 'final', 'evalFinal', 'shorts']);

const SGR: Record<Tone, string> = {
  done: '32',
  running: '36',
  problem: '31',
  next: '33',
  muted: '90',
  strong: '1',
  brand: '1;38;2;255;85;85',
  flash: '7',
};
const RESET = '\u001b[0m';
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const ANSI_SPLIT = /(\u001b\[[0-9;?]*[ -/]*[@-~])/;

export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;
const MARK: Record<StepState, string> = { done: '✓', running: '▶', problem: '!', next: '→', pending: '·', optional: '·' };
const STATE_LABEL: Record<StepState, string> = {
  done: 'feito',
  running: 'em andamento',
  problem: 'atenção',
  next: 'próximo',
  pending: 'pendente',
  optional: 'opcional',
};
const TONE: Record<StepState, Tone> = { done: 'done', running: 'running', problem: 'problem', next: 'next', pending: 'muted', optional: 'muted' };

const painter =
  (on: boolean): Paint =>
  (tone, text) =>
    on && text ? `\u001b[${SGR[tone]}m${text}${RESET}` : text;

/** Cor só em terminal de verdade e sem NO_COLOR (https://no-color.org). */
export function shouldColor(isTTY: boolean | undefined, env: Record<string, string | undefined>): boolean {
  return Boolean(isTTY) && !env.NO_COLOR;
}

/** `--watch` sem número atualiza a cada 1s, para a barra parecer viva. */
export function watchInterval(option: string | boolean | undefined): number {
  if (typeof option !== 'string') return 1;
  const seconds = Number(option);
  return Number.isFinite(seconds) && seconds > 0 ? Math.max(0.25, seconds) : 1;
}

function charWidth(code: number): number {
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0;
  if ((code >= 0x300 && code <= 0x36f) || (code >= 0x200b && code <= 0x200f) || (code >= 0xfe00 && code <= 0xfe0f)) return 0;
  const wide =
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff) ||
    (code >= 0x20000 && code <= 0x3fffd);
  return wide ? 2 : 1;
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/** Quantas colunas o texto ocupa na tela: ignora códigos ANSI, conta 2 para ideogramas e emoji. */
export function visibleWidth(text: string): number {
  let width = 0;
  for (const char of stripAnsi(text)) width += charWidth(char.codePointAt(0)!);
  return width;
}

/** Corta em `width` colunas visíveis, com "…" no fim, preservando os códigos ANSI do trecho que fica. */
export function truncate(text: string, width: number): string {
  if (width <= 0) return '';
  if (visibleWidth(text) <= width) return text;
  let out = '';
  let used = 0;
  let styled = false;
  const tokens = text.split(ANSI_SPLIT);
  outer: for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (index % 2 === 1) {
      out += token;
      styled = token !== RESET;
      continue;
    }
    for (const char of token) {
      const size = charWidth(char.codePointAt(0)!);
      if (used + size > width - 1) break outer;
      out += char;
      used += size;
    }
  }
  return `${out}…${styled ? RESET : ''}`;
}

/** Corta ou completa com espaços até ocupar exatamente `width` colunas. */
export function pad(text: string, width: number): string {
  const cut = truncate(text, width);
  return cut + ' '.repeat(Math.max(0, width - visibleWidth(cut)));
}

/** Quebra texto simples (sem ANSI) em linhas de até `width` colunas, nas palavras. */
export function wrap(text: string, width: number): string[] {
  if (width <= 0 || !text) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ').filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (visibleWidth(candidate) <= width) line = candidate;
    else {
      if (line) lines.push(line);
      line = truncate(word, width);
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** `left` e `right` nas pontas de uma linha de `width` colunas; sem espaço, `right` cai fora. */
export function spread(left: string, right: string, width: number): string {
  const gap = width - visibleWidth(left) - visibleWidth(right);
  return gap >= 1 && right ? left + ' '.repeat(gap) + right : truncate(left, width);
}

/** `left` + `right`, encurtando `left` para `right` (o número que importa) não sumir. */
function joinFit(left: string, right: string, width: number, separator = '  '): string {
  const fixed = visibleWidth(right) + visibleWidth(separator);
  if (!right) return truncate(left, width);
  if (visibleWidth(left) + fixed <= width) return left + separator + right;
  if (fixed + 4 <= width) return truncate(left, width - fixed) + separator + right;
  return truncate(left, width);
}

export function meter(fraction: number, width: number, paint: Paint = painter(false), tone: Tone = 'done'): string {
  const size = Math.max(0, Math.floor(width));
  const filled = Math.min(size, Math.max(0, Math.round((Number.isFinite(fraction) ? fraction : 0) * size)));
  return paint(tone, '█'.repeat(filled)) + paint('muted', '░'.repeat(size - filled));
}

export interface BoxOptions {
  /** largura total, bordas incluídas */
  width: number;
  title?: string;
  right?: string;
  color?: boolean;
}

/** Cartão com borda: título à esquerda da borda de cima, `right` à direita. Toda linha sai com `width` colunas. */
export function box(lines: string[], options: BoxOptions): string[] {
  const { width } = options;
  const paint = painter(options.color ?? false);
  if (width < 4) return lines.map((line) => truncate(line, width));
  const budget = width - 2;
  const title = options.title ? truncate(options.title, Math.max(0, budget - 4)) : '';
  const titleWidth = title ? visibleWidth(title) + 3 : 0;
  const right = options.right && titleWidth + visibleWidth(options.right) + 4 <= budget ? options.right : '';
  const fill = Math.max(0, budget - titleWidth - (right ? visibleWidth(right) + 3 : 0));
  const top =
    paint('muted', title ? '╭─' : '╭') +
    (title ? ` ${title} ` : '') +
    paint('muted', '─'.repeat(fill)) +
    (right ? ` ${right} ${paint('muted', '─╮')}` : paint('muted', '╮'));
  const side = paint('muted', '│');
  return [top, ...lines.map((line) => `${side} ${pad(line, width - 4)} ${side}`), paint('muted', `╰${'─'.repeat(budget)}╯`)];
}

interface Context {
  /** largura útil dentro do cartão */
  inner: number;
  wide: boolean;
  stateColumn: boolean;
  paint: Paint;
  now: number;
  tick: number;
  /** `slug:etapa` das etapas que acabaram de terminar */
  flash: Set<string>;
  selected?: string;
}

const spinner = (context: Context) => context.paint('running', SPINNER[((context.tick % SPINNER.length) + SPINNER.length) % SPINNER.length]!);

function liveOf(item: DashboardItem, step: Step, now: number) {
  const { live } = item.snapshot;
  return step.state === 'running' && live && live.task === step.key && isFresh(live, now) ? live : null;
}

const elapsedText = (startedAt: number, now: number) => `há ${formatClock(Math.max(0, now - startedAt) / 1000, 0)}`;

/** Uma etapa: uma linha; a que está rodando ganha spinner, barra, % e tempos (empilhados em tela estreita). */
function stepBlock(item: DashboardItem, index: number, context: Context, wrapDetail: boolean): string[] {
  const step = item.steps[index]!;
  const { inner, paint } = context;
  const tone = TONE[step.state];
  const labelWidth = Math.min(LABEL_WIDTH, Math.max(0, inner - 4));
  const label = pad(step.label, labelWidth);
  const flashed = context.flash.has(`${item.snapshot.slug}:${step.key}`);
  let head = `${paint(tone, MARK[step.state])} ${paint('muted', String(index + 1))} ${flashed ? paint('flash', label) : step.state === 'done' ? label : paint(step.state === 'running' ? 'strong' : tone, label)}`;
  let headWidth = 4 + labelWidth;
  if (context.stateColumn) {
    head += ` ${paint(tone, STATE_LABEL[step.state].padEnd(12))}`;
    headWidth += 13;
  }
  const detailWidth = inner - headWidth - 2;
  const indent = ' '.repeat(4);
  const live = liveOf(item, step, context.now);

  if (live) {
    const elapsed = elapsedText(live.startedAt, context.now);
    const what = `${spinner(context)} ${live.label}`;
    if (live.percent === null) {
      if (context.wide && wrapDetail && visibleWidth(what) + visibleWidth(elapsed) + 2 > detailWidth) {
        // o recado do diretor pode ser uma frase: com altura de sobra, vai por extenso
        const lines = wrap(live.label, detailWidth - 2);
        const fits = visibleWidth(lines.at(-1) ?? '') + 2 + visibleWidth(elapsed) <= detailWidth - 2;
        if (fits) lines[lines.length - 1] += `  ${paint('muted', elapsed)}`;
        else lines.push(paint('muted', elapsed));
        const hang = ' '.repeat(headWidth + 4);
        return [`${head}  ${spinner(context)} ${lines[0]}`, ...lines.slice(1).map((line) => hang + line)];
      }
      if (context.wide) return [`${head}  ${joinFit(what, paint('muted', elapsed), detailWidth)}`];
      return [head, indent + joinFit(what, paint('muted', elapsed), inner - 4)];
    }
    const eta = live.etaSec === null || live.percent >= 100 ? '' : `faltam ~${formatClock(live.etaSec, 0)} · `;
    const tail = ` ${String(live.percent).padStart(3)}%  ${paint('muted', eta + elapsed)}`;
    if (context.wide) {
      // a barra cede espaço antes de o nome da etapa ser cortado
      const barWidth = Math.min(20, Math.max(10, detailWidth - visibleWidth(what) - visibleWidth(tail) - 2));
      const right = meter(live.percent / 100, barWidth, paint, 'running') + tail;
      return [`${head}  ${joinFit(what, right, detailWidth)}`];
    }
    const barWidth = Math.min(30, Math.max(6, inner - 4 - visibleWidth(tail)));
    return [head, indent + truncate(what, inner - 4), indent + truncate(meter(live.percent / 100, barWidth, paint, 'running') + tail, inner - 4)];
  }

  // quanto a etapa levou, numa coluna à direita
  const seconds = step.state === 'done' && item.extra ? stepDurations(item.extra.activity)[step.key] : undefined;
  const took = seconds === undefined ? '' : formatClock(seconds, 0);
  const detail = flashed ? `acabou agora${step.detail ? ` · ${step.detail}` : ''}` : step.detail;
  if (detailWidth < 10) return [head];
  if (!detail) return [took ? `${head}  ${' '.repeat(detailWidth - visibleWidth(took))}${paint('muted', took)}` : head];
  const detailTone: Tone = flashed || step.state === 'problem' || step.state === 'running' ? tone : 'muted';
  const prefix = step.state === 'running' ? `${spinner(context)} ` : '';
  const room = detailWidth - visibleWidth(prefix) - (took ? visibleWidth(took) + 2 : 0);
  const tail = took ? `  ${paint('muted', took)}` : '';
  if (wrapDetail && context.wide) {
    const [first = '', ...rest] = wrap(detail, room);
    const hang = ' '.repeat(headWidth + 2 + visibleWidth(prefix));
    return [`${head}  ${prefix}${took ? pad(paint(detailTone, first), room) : paint(detailTone, first)}${tail}`, ...rest.map((line) => hang + paint(detailTone, line))];
  }
  const cut = paint(detailTone, truncate(detail, room));
  return [`${head}  ${prefix}${took ? pad(cut, room) : cut}${tail}`];
}

function overallLine(item: DashboardItem, context: Context): string {
  const { done, total } = countProgress(item.steps);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const text = `  ${done}/${total} etapas · ${percent}%`;
  const barWidth = Math.min(40, Math.max(8, context.inner - visibleWidth(text)));
  return meter(total ? done / total : 0, barWidth, context.paint) + text;
}

function hintLine(item: DashboardItem, context: Context): string | null {
  const current = currentStep(item.steps);
  const { paint } = context;
  if (!current) return `${paint('done', 'concluído')}${paint('muted', ' · novas correções viram uma nova versão da EDL')}`;
  if (current.state === 'next') return `${paint('next', 'próximo')}  ${nextCommand(current, item.snapshot.slug)}`;
  if (current.state === 'problem') return `${paint('problem', 'retomar')}  ${nextCommand(current, item.snapshot.slug)}`;
  return null;
}

function jobLine(item: DashboardItem, context: Context): string | null {
  const { job } = item.snapshot;
  if (!job) return null;
  return context.paint(job.status === 'failed' ? 'problem' : 'muted', `modo autônomo: ${JOB_LABEL[job.status]}${job.error ? ` — ${job.error}` : ''}`);
}

type CardMode = 'roomy' | 'compact';

function frameCard(item: DashboardItem, body: string[], context: Context, width: number, color: boolean): string[] {
  const { edl, slug } = item.snapshot;
  return box(body, {
    width,
    color,
    title: context.paint('strong', slug === context.selected ? `▸ ${slug}` : slug),
    right: edl ? context.paint('muted', `nível ${edl.level} · EDL v${edl.version}`) : '',
  });
}

/** Cartão inteiro. `roomy` respira e quebra o detalhe longo em linhas; `compact` é uma linha por etapa. */
function cardBody(item: DashboardItem, context: Context, mode: CardMode): string[] {
  const roomy = mode === 'roomy';
  const job = jobLine(item, context);
  const hint = hintLine(item, context);
  return [
    overallLine(item, context),
    ...(job ? [job] : []),
    ...(roomy ? [''] : []),
    ...item.steps.flatMap((_, index) => stepBlock(item, index, context, roomy)),
    ...(hint ? [...(roomy ? [''] : []), hint] : []),
  ];
}

/** Cartão que cabe em `budget` linhas: a etapa atual e as vizinhas, e "+N etapas" para o resto. */
function cutCardBody(item: DashboardItem, context: Context, budget: number): string[] {
  const room = budget - 3;
  const blocks = item.steps.map((_, index) => stepBlock(item, index, context, false));
  const current = currentStep(item.steps);
  const focus = current ? item.steps.indexOf(current) : item.steps.length - 1;
  let from = focus;
  let to = focus;
  let used = Math.min(blocks[focus]!.length, room - 1);
  const first = blocks[focus]!.slice(0, used);
  let forward = true;
  for (;;) {
    const after = to + 1 < blocks.length && used + blocks[to + 1]!.length <= room - 1;
    const before = from > 0 && used + blocks[from - 1]!.length <= room - 1;
    if (!after && !before) break;
    if ((forward && after) || !before) {
      to += 1;
      used += blocks[to]!.length;
    } else {
      from -= 1;
      used += blocks[from]!.length;
    }
    forward = !forward;
  }
  const hiddenBefore = from;
  const hiddenAfter = blocks.length - 1 - to;
  const where = hiddenBefore && hiddenAfter ? ` (${hiddenBefore} antes, ${hiddenAfter} depois)` : hiddenBefore ? ' antes' : ' depois';
  const shown = [...blocks.slice(from, focus).flat(), ...first, ...blocks.slice(focus + 1, to + 1).flat()];
  if (hiddenBefore + hiddenAfter === 0) {
    const hint = hintLine(item, context);
    return [overallLine(item, context), ...shown, ...(hint ? [hint] : [])];
  }
  return [overallLine(item, context), ...shown, context.paint('muted', `+${hiddenBefore + hiddenAfter} etapas${where}`)];
}

/** Uma edição em uma linha: onde está e quanto falta. */
function summaryLine(item: DashboardItem, context: Context, slugWidth: number, width: number): string {
  const { paint } = context;
  const { done, total } = countProgress(item.steps);
  const current = currentStep(item.steps);
  let where = paint('done', '✓ concluído');
  if (current) {
    const live = liveOf(item, current, context.now);
    const extra = live
      ? ` ${spinner(context)} ${live.percent === null ? live.label : `${live.percent}%${live.etaSec === null || live.percent >= 100 ? '' : ` · faltam ~${formatClock(live.etaSec, 0)}`}`}`
      : current.detail && current.state !== 'next'
        ? paint('muted', ` · ${current.detail}`)
        : '';
    where = paint(TONE[current.state], `${MARK[current.state]} ${current.label}`) + extra;
  }
  const level = context.wide ? `${paint('muted', (item.snapshot.edl?.level ?? '—').padEnd(6))} ` : '';
  const marker = item.snapshot.slug === context.selected ? paint('strong', '▸') : ' ';
  return truncate(`${marker}${pad(item.snapshot.slug, slugWidth)}  ${level}${meter(total ? done / total : 0, context.wide ? 10 : 6, paint)} ${done}/${total}  ${where}`, width);
}

/** Quem leva o espaço primeiro quando falta altura: o foco, depois quem roda, quem travou, quem está no meio. */
function priority(item: DashboardItem, focus: string | undefined): number {
  if (focus && item.snapshot.slug === focus) return 0;
  const state = currentStep(item.steps)?.state;
  return state === 'running' ? 1 : state === 'problem' ? 2 : state ? 3 : 4;
}

/** A edição que o painel destaca sozinho: `focus` se existir, senão a que roda, a que travou, a do meio. */
export function pickFocus(items: DashboardItem[], focus?: string): string | null {
  const sorted = items.map((_, index) => index).sort((a, b) => priority(items[a]!, focus) - priority(items[b]!, focus) || a - b);
  return sorted.length ? items[sorted[0]!]!.snapshot.slug : null;
}

/** Etapas de máquina que estavam rodando na leitura anterior e agora terminaram (feitas ou com problema). */
export function finishedSteps(before: DashboardItem[], after: DashboardItem[]): Flash[] {
  const finished: Flash[] = [];
  for (const item of after) {
    const previous = before.find((other) => other.snapshot.slug === item.snapshot.slug);
    if (!previous) continue;
    for (const step of item.steps) {
      if (!MACHINE_STEPS.has(step.key) || (step.state !== 'done' && step.state !== 'problem')) continue;
      if (previous.steps.find((other) => other.key === step.key)?.state === 'running') finished.push({ slug: item.snapshot.slug, key: step.key });
    }
  }
  return finished;
}

/** Itens inteiros separados por " · " em até `maxLines` linhas; o que não couber vira "+N". */
export function packItems(items: string[], width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let at = 0;
  while (at < items.length && lines.length < maxLines) {
    const lastLine = lines.length === maxLines - 1;
    let line = '';
    while (at < items.length) {
      const candidate = line ? `${line} · ${items[at]}` : items[at]!;
      const rest = items.length - at - 1;
      // na última linha, guarda lugar para o "+N" do que ficar de fora
      const reserve = lastLine && rest > 0 ? ` · +${rest}`.length : 0;
      if (line && visibleWidth(candidate) + reserve > width) break;
      line = candidate;
      at += 1;
    }
    lines.push(lastLine && at < items.length ? `${line} · +${items.length - at}` : line);
  }
  return lines.map((line) => truncate(line, width));
}

function dayTime(at: number): string {
  const date = new Date(at);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/**
 * Tempo, qualidade, orçamento e histórico da edição, em até `room` linhas. Com pouco espaço fica o essencial
 * (uma linha por seção e as 3 últimas do histórico); sobrando, entram os achados e mais histórico.
 */
function extrasBlock(item: DashboardItem, context: Context, room: number, historyMax: number, spaced: boolean): string[] {
  const { extra } = item;
  if (!extra || room <= 0) return [];
  const { paint } = context;
  const width = Math.max(0, context.inner - EXTRA_LABEL);
  const section = (label: string, lines: string[]) => lines.map((line, index) => (index === 0 ? paint('muted', label.padEnd(EXTRA_LABEL)) : ' '.repeat(EXTRA_LABEL)) + line);

  const spent = totalSpent(extra.activity);
  const first = extra.activity[0];
  // só o que o histórico mediu: etapa rodada antes de existir o log não entra na conta
  const time =
    first && spent.runs
      ? [`${formatClock(spent.seconds, 0)} de máquina em ${spent.runs} ${spent.runs === 1 ? 'execução' : 'execuções'}${paint('muted', ` · desde ${dayTime(first.at)}`)}`]
      : [];
  const report = extra.eval;
  const verdict = report
    ? [
        `${paint(report.passed ? 'done' : 'problem', report.passed ? 'aprovada' : 'reprovada')} · ${report.errors} ${report.errors === 1 ? 'erro' : 'erros'}, ` +
          `${report.warnings} ${report.warnings === 1 ? 'aviso' : 'avisos'}${paint('muted', ` · ${report.render}`)}`,
      ]
    : [];
  const findings = (report?.top ?? []).map((finding) =>
    finding.severity === 'error' ? paint('problem', truncate(`! ${finding.text}`, width)) : paint('muted', truncate(`· ${finding.text}`, width)),
  );
  const off = extra.budgetGaps ?? [];
  const gaps = extra.budgetGaps === null ? [] : off.length ? packItems(off, width, 2) : ['no alvo do nível'];
  const budget = gaps.map((line) => paint(off.length ? 'next' : 'muted', line));
  const history = extra.activity.slice(-Math.max(1, historyMax)).map((entry) => {
    const text = truncate(formatActivity(entry), width);
    return entry.kind === 'step-failed' ? paint('problem', text) : `${paint('muted', text.slice(0, 5))}${text.slice(5)}`;
  });

  let left = room;
  const take = (wanted: number) => {
    const got = Math.max(0, Math.min(wanted, left));
    left -= got;
    return got;
  };
  const showTime = take(time.length);
  const showVerdict = take(verdict.length);
  const showBudget = take(Math.min(1, budget.length));
  let showHistory = take(Math.min(3, history.length));
  const separator = spaced && showTime + showVerdict + showBudget + showHistory > 0 ? take(1) : 0;
  const showFindings = showVerdict ? take(findings.length) : 0;
  const moreBudget = showBudget ? take(budget.length - 1) : 0;
  showHistory += take(history.length - showHistory);

  return [
    ...Array<string>(separator).fill(''),
    ...section('tempo', time.slice(0, showTime)),
    ...section('qualidade', [...verdict.slice(0, showVerdict), ...findings.slice(0, showFindings)]),
    ...section('orçamento', budget.slice(0, showBudget + moreBudget)),
    ...section('histórico', showHistory ? history.slice(-showHistory) : []),
  ];
}

/** Foco: a edição selecionada com todas as etapas, os detalhes e as seções extras; as outras, uma linha cada. */
function focusBody(options: DashboardOptions, context: Context, width: number, available: number, summary: (index: number) => string): string[] | null {
  const { items } = options;
  const at = items.findIndex((item) => item.snapshot.slug === context.selected);
  if (at < 0) return null;
  const others = items.map((_, index) => index).filter((index) => index !== at);
  let otherRoom = Math.min(others.length, Math.floor(available / 4));
  if (available - otherRoom < MIN_CUT_CARD) otherRoom = 0;
  const cardRoom = available - otherRoom;
  if (cardRoom < MIN_CUT_CARD) return null;

  const item = items[at]!;
  const compact = cardBody(item, context, 'compact');
  let body: string[];
  if (compact.length > cardRoom - 2) body = cutCardBody(item, context, cardRoom);
  else {
    const roomy = cardBody(item, context, 'roomy');
    const spaced = roomy.length <= cardRoom - 2;
    const base = spaced ? roomy : compact;
    body = [...base, ...extrasBlock(item, context, cardRoom - 2 - base.length, HISTORY_MAX.watch, spaced)];
  }
  const shown = others.length <= otherRoom ? others : others.slice(0, Math.max(0, otherRoom - 1));
  const hidden = others.length - shown.length;
  const more = hidden && otherRoom ? [context.paint('muted', truncate(` +${hidden} edições`, width))] : [];
  return [...frameCard(item, body, context, width, options.color ?? false), ...shown.map(summary), ...more];
}

function layoutBody(options: DashboardOptions, context: Context, width: number, available: number): string[] {
  const { items } = options;
  const color = options.color ?? false;
  const focus = options.selected ?? options.focus;
  if (items.length === 0) return [truncate(' nenhum projeto ainda: pnpm mce analyze <arquivo>', width)];
  if (available <= 0) return [];
  const order = items.map((_, index) => index).sort((a, b) => priority(items[a]!, focus) - priority(items[b]!, focus) || a - b);
  const slugWidth = Math.max(4, Math.min(24, Math.floor(width / 3), Math.max(...items.map((item) => visibleWidth(item.snapshot.slug)))));
  const line = (index: number) => summaryLine(items[index]!, context, slugWidth, width);

  if (options.expanded) {
    const focused = focusBody(options, context, width, available, line);
    if (focused) return focused;
  }

  if (items.length > available) {
    const kept = new Set(order.slice(0, available - 1));
    const hidden = items.length - kept.size;
    return [...items.map((_, index) => index).filter((index) => kept.has(index)).map(line), context.paint('muted', truncate(` +${hidden} edições`, width))];
  }

  const cards = new Map<number, string[]>();
  const modes = new Map<number, CardMode>();
  let left = available - items.length;
  order.forEach((index, rank) => {
    const body = cardBody(items[index]!, context, 'compact');
    const cost = body.length + 2 - 1;
    if (cost <= left) {
      cards.set(index, body);
      modes.set(index, 'compact');
      left -= cost;
    } else if ((rank === 0 && left + 1 >= MIN_CUT_CARD) || (priority(items[index]!, focus) <= 2 && left + 1 >= MIN_SIDE_CARD)) {
      const cut = cutCardBody(items[index]!, context, left + 1);
      cards.set(index, cut);
      left -= cut.length + 2 - 1;
    }
  });
  // sobrou altura: quem já tem cartão inteiro ganha respiro e o detalhe por extenso
  for (const index of order) {
    if (modes.get(index) !== 'compact') continue;
    const roomy = cardBody(items[index]!, context, 'roomy');
    const extra = roomy.length - cards.get(index)!.length;
    if (extra <= left) {
      cards.set(index, roomy);
      modes.set(index, 'roomy');
      left -= extra;
    }
  }
  // e o que ainda sobrar vai para tempo, qualidade e histórico: no painel, só a edição em foco; impresso, todas
  const printing = !Number.isFinite(available);
  for (const index of printing ? order : order.slice(0, 1)) {
    const mode = modes.get(index);
    if (!mode) continue;
    const max = printing ? (items[index]!.snapshot.slug === focus ? HISTORY_MAX.printFocus : HISTORY_MAX.print) : HISTORY_MAX.watch;
    const extras = extrasBlock(items[index]!, context, left, max, mode === 'roomy');
    cards.set(index, [...cards.get(index)!, ...extras]);
    left -= extras.length;
  }
  const indexes = items.map((_, index) => index);
  return [
    ...indexes.filter((index) => cards.has(index)).flatMap((index) => frameCard(items[index]!, cards.get(index)!, context, width, color)),
    ...indexes.filter((index) => !cards.has(index)).map(line),
  ];
}

const LEGEND_STATES = ['done', 'running', 'problem', 'next', 'pending'] as const;

function legend(paint: Paint): string {
  return LEGEND_STATES.map((state) => `${paint(TONE[state], MARK[state])} ${paint('muted', state === 'running' ? 'rodando' : STATE_LABEL[state])}`).join('  ');
}

/** A ajuda de teclas (`?`), no lugar das edições: em cartão se couber, senão as linhas que derem. */
function helpBody(context: Context, width: number, available: number, color: boolean): string[] {
  const { paint } = context;
  const keyWidth = Math.max(...KEY_HELP.map(([keys]) => visibleWidth(keys)));
  const lines = KEY_HELP.map(([keys, what]) => `${paint('strong', pad(keys, keyWidth))}  ${what}`);
  if (available >= lines.length + 4) return box([...lines, '', legend(paint)], { width, color, title: paint('strong', 'teclas') });
  if (available >= lines.length + 2) return box(lines, { width, color, title: paint('strong', 'teclas') });
  return lines.slice(0, Math.max(0, available)).map((line) => truncate(` ${line}`, width));
}

function queueLine(queue: QueueSummary, paint: Paint, width: number): string | null {
  const { pending, running, failed } = queue;
  if (pending.length + running.length + failed.length === 0) return null;
  const counts = [
    `${pending.length} ${pending.length === 1 ? 'pendente' : 'pendentes'}`,
    paint(running.length ? 'running' : 'muted', `${running.length} rodando`),
    paint(failed.length ? 'problem' : 'muted', `${failed.length} ${failed.length === 1 ? 'falha' : 'falhas'}`),
  ].join(paint('muted', ' · '));
  const names = pending.length ? paint('muted', `  próximos: ${pending.join(', ')}`) : '';
  return truncate(` ${paint('muted', 'fila')}  ${counts}${names}`, width);
}

function clock(now: number): string {
  const date = new Date(now);
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
}

function headerLine(options: DashboardOptions, paint: Paint, width: number): string {
  const running = options.items.filter((item) => item.steps.some((step) => step.state === 'running')).length;
  const count = options.items.length;
  const summary = `${count} ${count === 1 ? 'edição' : 'edições'}${running ? ` · ${running} rodando` : ''}`;
  const title = ` ${paint('brand', 'MChiodi Editor')}`;
  const time = `${paint('muted', clock(options.now))} `;
  const full = `${title}${paint('muted', `  ${summary}`)}`;
  // saúde da máquina: por extenso, abreviada, só os alertas; some antes de apertar o título
  const parts = options.health ? healthParts(options.health) : [];
  const health = (list: typeof parts, short: boolean) => list.map((part) => paint(part.alert ? 'problem' : 'muted', short ? part.short : part.text)).join(paint('muted', ' · '));
  const alerts = parts.filter((part) => part.alert);
  const candidates: [left: string, status: string][] = [];
  if (parts.length) candidates.push([full, health(parts, false)], [full, health(parts, true)], [title, health(parts, true)]);
  if (alerts.length) candidates.push([title, health(alerts, true)]);
  candidates.push([full, '']);
  for (const [left, status] of candidates) {
    const right = status ? `${status}  ${time}` : time;
    if (visibleWidth(left) + visibleWidth(right) + (status ? 2 : 1) <= width) return spread(left, right, width);
  }
  return spread(title, time, width);
}

function keyHints(options: DashboardOptions, width: number): string {
  const enter = options.expanded ? 'Enter visão geral' : 'Enter foco';
  const variants = [
    ` ↑↓ edição · ${enter} · o pasta · p vídeo · r relatório · g cenas · c copiar · ? ajuda · q sai`,
    ` ↑↓ · ${enter} · o p r e g c abrir/copiar · ? ajuda · q sai`,
    ' ↑↓ Enter · ? ajuda · q sai',
    ' ? ajuda · q sai',
  ];
  return variants.find((text) => visibleWidth(text) <= width) ?? variants.at(-1)!;
}

function footerLine(options: DashboardOptions, paint: Paint, width: number): string {
  const seconds = options.intervalSec!;
  const left = options.toast
    ? ` ${paint('next', options.toast)}`
    : options.notice
      ? ` ${paint('problem', options.notice)}`
      : options.keys
        ? paint('muted', options.help ? ' ? ou Esc fecha a ajuda · q sai' : keyHints(options, width))
        : paint('muted', ` atualiza a cada ${Number.isInteger(seconds) ? seconds : seconds.toFixed(2).replace(/0+$/, '')}s · Ctrl+C sai`);
  if (width < WIDE_FROM) return truncate(left, width);
  return spread(left, `${legend(paint)} `, width);
}

/**
 * O painel inteiro, já no tamanho da tela: nenhuma linha passa de `columns` e, com `rows`, o quadro tem
 * no máximo `rows` linhas (exatamente `rows` no modo watch, com o rodapé na última).
 */
export function renderDashboard(options: DashboardOptions): string[] {
  const columns = Math.max(1, Math.floor(options.columns));
  const width = Math.min(columns, MAX_WIDTH);
  const rows = options.rows && options.rows > 0 ? Math.floor(options.rows) : Number.POSITIVE_INFINITY;
  const color = options.color ?? false;
  const paint = painter(color);
  const context: Context = {
    inner: Math.max(0, width - 4),
    wide: width >= WIDE_FROM,
    stateColumn: width >= STATE_COLUMN_FROM,
    paint,
    now: options.now,
    tick: options.tick ?? 0,
    flash: new Set((options.flash ?? []).map((flash) => `${flash.slug}:${flash.key}`)),
    selected: options.selected,
  };
  const footer = options.intervalSec === undefined ? [] : [footerLine(options, paint, width)];
  const queued = options.queue && rows >= 10 ? queueLine(options.queue, paint, width) : null;
  const queue = queued === null ? [] : [queued];
  const gap = rows >= 16 ? [''] : [];
  const available = Math.max(0, rows - 1 - gap.length - queue.length - footer.length);
  const body = (options.help ? helpBody(context, width, available, color) : layoutBody(options, context, width, available)).slice(0, available);
  const filler = footer.length && Number.isFinite(rows) ? Array<string>(Math.max(0, available - body.length)).fill('') : [];
  return [headerLine(options, paint, width), ...gap, ...body, ...filler, ...queue, ...footer].slice(0, rows).map((line) => truncate(line, columns));
}
