import { type DashboardItem, finishedSteps, type Flash, pickFocus, renderDashboard } from './dashboard.ts';
import { performAction } from './dashboard-actions.ts';
import { initialState, type PanelAction, parseKeys, reduce, syncState } from './dashboard-keys.ts';
import type { Health } from './health.ts';
import type { QueueSummary } from './insight.ts';

/** Buffer alternativo (a tela de antes volta intacta ao sair) e cursor escondido. */
export const ENTER_SCREEN = '\u001b[?1049h\u001b[?25l';
export const LEAVE_SCREEN = '\u001b[?25h\u001b[?1049l';
export const BELL = '\u0007';
const CLEAR = '\u001b[2J';
const FALLBACK = { columns: 100, rows: 24 };
/** Quanto dura o aviso de uma tecla no rodapé e o destaque da etapa que terminou. */
export const TOAST_MS = 3000;
export const FLASH_MS = 8000;

/**
 * Um quadro redesenhado no lugar: cada linha é posicionada pelo número e limpa antes de escrever.
 * Sem `\n` nenhum, então a tela nunca rola; e sem depender do fim de linha, que apaga o último
 * caractere quando a linha ocupa a largura toda. O par ?2026 pede ao terminal para pintar de uma vez.
 */
export function paintFrame(lines: string[], rows: number): string {
  const shown = lines.slice(0, Math.max(0, rows));
  const body = shown.map((line, index) => `\u001b[${index + 1};1H\u001b[2K${line}`).join('');
  const below = shown.length < rows ? `\u001b[${shown.length + 1};1H\u001b[J` : '';
  return `\u001b[?2026h${body}${below}\u001b[?2026l`;
}

export interface DashboardOut {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  write(text: string): unknown;
  on(event: 'resize', listener: () => void): unknown;
  off(event: 'resize', listener: () => void): unknown;
}

/** O pedaço do stdin que o painel usa: teclas soltas, sem eco e sem esperar Enter. */
export interface DashboardIn {
  isTTY?: boolean;
  setRawMode?(mode: boolean): unknown;
  setEncoding?(encoding: 'utf8'): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown;
  off(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown;
}

export interface Ambient {
  health?: Health;
  queue?: QueueSummary;
}

export interface WatchOptions {
  /** lê o estado das edições do disco */
  load: () => DashboardItem[];
  /** o que não é de uma edição só: saúde da máquina e fila; relido junto com `load` */
  ambient?: () => Ambient;
  intervalSec: number;
  focus?: string;
  color?: boolean;
  out?: DashboardOut;
  /** de onde vêm as teclas; só liga o teclado se for um terminal (padrão: process.stdin) */
  input?: DashboardIn;
  /** executa a ação de uma tecla (abrir, copiar) e devolve o aviso do rodapé */
  perform?: (action: Exclude<PanelAction, { type: 'quit' }>, item: DashboardItem | undefined) => Promise<string> | string;
  /** toca o sino do terminal quando uma etapa de máquina termina (padrão: sim) */
  bell?: boolean;
  clock?: () => number;
  /** quando resolver, o painel fecha; por padrão, Ctrl+C (e `q`, com teclado) */
  stop?: Promise<void>;
  /** intervalo de redesenho (spinner e relógio), independente da leitura do disco */
  frameMs?: number;
}

const decoder = new TextDecoder();

/** Painel ao vivo: relê o disco a cada `intervalSec`, redesenha no lugar e devolve o terminal como estava. */
export async function runDashboard(options: WatchOptions): Promise<void> {
  const out: DashboardOut = options.out ?? process.stdout;
  const clock = options.clock ?? Date.now;
  const tty = Boolean(out.isTTY);
  const color = options.color ?? tty;
  const intervalMs = options.intervalSec * 1000;
  const input: DashboardIn | undefined = options.input ?? (options.out ? undefined : process.stdin);
  const keys = tty && Boolean(input?.isTTY);
  const perform = options.perform ?? performAction;
  const readAmbient = (): Ambient => {
    try {
      return options.ambient?.() ?? {};
    } catch {
      return {};
    }
  };

  let items = options.load();
  let ambient = readAmbient();
  let notice: string | undefined;
  let loadedAt = clock();
  let tick = 0;
  let last = '';
  // com um projeto pedido, o painel já abre no foco dele
  let state = initialState(items.map((item) => item.snapshot.slug), pickFocus(items, options.focus), Boolean(options.focus));
  let toast: { text: string; until: number } | null = null;
  let flashes: (Flash & { until: number })[] = [];

  const reload = () => {
    loadedAt = clock();
    try {
      const next = options.load();
      const finished = finishedSteps(items, next);
      if (finished.length) {
        flashes = [...flashes, ...finished.map((flash) => ({ ...flash, until: loadedAt + FLASH_MS }))];
        if (tty && options.bell !== false) out.write(BELL);
      }
      items = next;
      notice = undefined;
      state = syncState(state, items.map((item) => item.snapshot.slug), pickFocus(items, options.focus));
    } catch (error) {
      // arquivo lido no meio de uma gravação: fica o quadro anterior e a próxima leitura corrige
      notice = `leitura falhou: ${error instanceof Error ? error.message : String(error)}`;
    }
    ambient = readAmbient();
  };
  const frame = (live: boolean) => {
    const now = clock();
    if (toast && now >= toast.until) toast = null;
    flashes = flashes.filter((flash) => now < flash.until);
    return renderDashboard({
      items,
      now,
      columns: out.columns ?? FALLBACK.columns,
      rows: live ? (out.rows ?? FALLBACK.rows) : undefined,
      color,
      tick,
      focus: options.focus,
      intervalSec: live ? options.intervalSec : undefined,
      notice,
      health: ambient.health,
      queue: ambient.queue,
      flash: flashes,
      ...(keys && live ? { keys: true, selected: state.selected ?? undefined, expanded: state.expanded, help: state.help, toast: toast?.text } : {}),
    });
  };
  const draw = () => {
    const text = paintFrame(frame(true), out.rows ?? FALLBACK.rows);
    if (text === last) return;
    last = text;
    out.write(text);
  };

  const signals = ['SIGINT', 'SIGTERM'] as const;
  let release: () => void = () => {};
  let quit: () => void = () => {};
  const stopped = Promise.race([
    new Promise<void>((resolve) => (quit = resolve)),
    options.stop ??
      new Promise<void>((resolve) => {
        for (const signal of signals) process.once(signal, resolve);
        release = () => signals.forEach((signal) => process.off(signal, resolve));
      }),
  ]);

  if (!tty) {
    // saída redirecionada: sem códigos de tela, um quadro por leitura
    const print = () => out.write(`${frame(false).join('\n')}\n\n`);
    print();
    const timer = setInterval(() => {
      reload();
      print();
    }, intervalMs);
    try {
      await stopped;
    } finally {
      clearInterval(timer);
      release();
    }
    return;
  }

  let closed = false;
  const say = (text: string) => {
    if (closed) return;
    toast = { text, until: clock() + TOAST_MS };
    draw();
  };
  const onData = (chunk: string | Uint8Array) => {
    for (const key of parseKeys(typeof chunk === 'string' ? chunk : decoder.decode(chunk))) {
      const result = reduce(state, key);
      state = result.state;
      const { action } = result;
      if (!action) continue;
      if (action.type === 'quit') {
        quit();
        return;
      }
      const item = 'slug' in action ? items.find((candidate) => candidate.snapshot.slug === action.slug) : undefined;
      // abrir e copiar não seguram o painel: o aviso entra quando terminarem
      void Promise.resolve()
        .then(() => perform(action, item))
        .then(say, (error: unknown) => say(`não deu: ${error instanceof Error ? error.message : String(error)}`));
    }
    draw();
  };

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (keys && input) {
      // o terminal volta a ecoar e a esperar Enter, e o stdin para de segurar o processo aberto
      input.off('data', onData);
      input.setRawMode?.(false);
      input.pause();
    }
    out.write(LEAVE_SCREEN);
  };
  const onResize = () => {
    last = '';
    out.write(CLEAR);
    draw();
  };
  // rede de segurança: se o processo cair por outro caminho, o terminal não fica no buffer alternativo sem cursor
  process.once('exit', restore);
  out.on('resize', onResize);
  out.write(ENTER_SCREEN + CLEAR);
  if (keys && input) {
    input.setRawMode?.(true);
    input.setEncoding?.('utf8');
    input.on('data', onData);
    input.resume();
  }
  const timer = setInterval(
    () => {
      tick += 1;
      if (clock() - loadedAt >= intervalMs) reload();
      draw();
    },
    options.frameMs ?? Math.min(250, intervalMs),
  );
  try {
    draw();
    await stopped;
  } finally {
    closed = true;
    clearInterval(timer);
    out.off('resize', onResize);
    process.off('exit', restore);
    release();
    restore();
  }
}
