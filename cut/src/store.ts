/**
 * Estado do editor. Não há estado de edição próprio: a verdade é a EDL salva (`project`) + o lote de operações
 * ainda não salvas (`history`), que o servidor aplica no /preview para a UI mostrar o resultado.
 */
import { useSyncExternalStore } from 'react';

import type { CutOp } from '../../src/cut/ops.ts';
import type { SpeechContext } from '../../src/cut/snap.ts';
import type { Edl } from '../../src/edl/schema.ts';
import type { Timeline } from '../../src/edl/timeline.ts';
import { canRedo, canUndo, emptyHistory, type OpHistory, pushOp, redo, undo } from '../../src/cut/history.ts';
import { api, ApiError, type ArsenalItem, type EvalPayload, type JobView, type PreviewResult, type ProjectPayload, type Waveform } from './api.ts';
import { type Conflict, conflictFromResponse, decideVersion, rebaseOutcome, settleDeferred, versionOrigin } from './lib/reconcile.ts';
import type { ViewMode } from './lib/timemap.ts';

export type LeftPanel = 'arsenal' | 'captions' | 'versions' | 'claude';
export type RightPanel = 'properties' | 'level' | 'render' | 'eval';

export interface Toast {
  id: number;
  tone: 'info' | 'warn' | 'error' | 'ok';
  text: string;
}

export type ClaudeEvent =
  | { kind: 'start'; baseVersion: number }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | { kind: 'result'; ok: boolean; text: string; costUsd: number | null; turns: number | null };

export interface ClaudeDone {
  ok: boolean;
  baseVersion: number;
  proposedVersion: number | null;
  diff: string[];
  result: string;
}

export interface EditorState {
  slug: string | null;
  projects: { slug: string; analyzed: boolean; latest: number | null; versions: number }[] | null;
  project: ProjectPayload | null;
  loadError: string | null;
  /** cada passo é o lote de um gesto (um undo desfaz o gesto inteiro) */
  history: OpHistory<CutOp[]>;
  preview: PreviewResult | null;
  previewError: string | null;
  saving: boolean;
  deferred: number[];
  conflict: Conflict | null;
  /** operação que não coube na versão nova ao reaplicar */
  rebaseDropped: { index: number; op: CutOp; error: string } | null;
  mode: ViewMode;
  pps: number;
  selection: string[];
  markIn: number | null;
  markOut: number | null;
  left: LeftPanel;
  right: RightPanel;
  waveform: Waveform | null;
  job: JobView | null;
  jobLog: string[];
  jobProgress: { label: string; percent: number; etaSec: number | null } | null;
  evals: EvalPayload | null;
  claudeRunning: boolean;
  claudeEvents: ClaudeEvent[];
  claudeDone: ClaudeDone | null;
  toasts: Toast[];
  /** aviso persistente do último gesto recusado ou encaixado */
  hint: { tone: 'warn' | 'error' | 'info'; text: string } | null;
  graphics: 'all' | 'selected' | 'off';
  focusWord: number | null;
  arsenalPick: { kind: string; item: ArsenalItem } | null;
  /** formulário de confirmação de troca de nível */
  levelConfirm: string | null;
  still: string | null;
}

const initial: EditorState = {
  slug: null,
  projects: null,
  project: null,
  loadError: null,
  history: emptyHistory(),
  preview: null,
  previewError: null,
  saving: false,
  deferred: [],
  conflict: null,
  rebaseDropped: null,
  mode: 'output',
  pps: 20,
  selection: [],
  markIn: null,
  markOut: null,
  left: 'arsenal',
  right: 'properties',
  waveform: null,
  job: null,
  jobLog: [],
  jobProgress: null,
  evals: null,
  claudeRunning: false,
  claudeEvents: [],
  claudeDone: null,
  toasts: [],
  hint: null,
  graphics: 'all',
  focusWord: null,
  arsenalPick: null,
  levelConfirm: null,
  still: null,
};

type Listener = () => void;

function createStore<S extends object>(start: S) {
  let state = start;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (patch: Partial<S> | ((current: S) => Partial<S>)) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      for (const listener of listeners) listener();
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const store = createStore<EditorState>(initial);

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

/** O playhead muda a cada frame: store separado para só o playhead e o relógio re-renderizarem. */
export const playhead = createStore({ source: 0, playing: false, rate: 0 });

export function usePlayhead<T>(selector: (state: { source: number; playing: boolean; rate: number }) => T): T {
  return useSyncExternalStore(playhead.subscribe, () => selector(playhead.get()));
}

// ── derivados ────────────────────────────────────────────────────────────────

export function currentEdl(state: EditorState): Edl | null {
  return state.preview?.edl ?? state.project?.edl ?? null;
}

export function currentTimeline(state: EditorState): Timeline | null {
  return state.preview?.timeline ?? state.project?.timeline ?? null;
}

export function pendingOps(state: EditorState): CutOp[] {
  return state.history.done.flat();
}

const speechCache = new WeakMap<ProjectPayload, SpeechContext>();

export function speechOf(project: ProjectPayload): SpeechContext {
  let speech = speechCache.get(project);
  if (!speech) {
    speech = { words: project.words, silences: project.silences, durationSec: project.source.durationSec };
    speechCache.set(project, speech);
  }
  return speech;
}

// ── avisos ───────────────────────────────────────────────────────────────────

let toastId = 0;

export function toast(text: string, tone: Toast['tone'] = 'info', ms = 4500): void {
  const id = ++toastId;
  store.set((state) => ({ toasts: [...state.toasts.slice(-3), { id, tone, text }] }));
  window.setTimeout(() => store.set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })), ms);
}

export function setHint(hint: EditorState['hint']): void {
  store.set({ hint });
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

// ── projeto ──────────────────────────────────────────────────────────────────

let events: EventSource | null = null;

export async function listProjects(): Promise<void> {
  try {
    const { projects } = await api.projects();
    store.set({ projects });
  } catch (error) {
    store.set({ loadError: message(error) });
  }
}

export async function openProject(slug: string): Promise<void> {
  store.set({ slug, loadError: null });
  try {
    const project = await api.project(slug);
    if (!project.edl) throw new Error(`projeto sem EDL: rode pnpm mce draft ${slug}`);
    store.set({ project, history: emptyHistory(), preview: null, previewError: null, conflict: null, selection: [] });
    // abre no primeiro instante que ficou no vídeo (o começo da fonte costuma estar cortado)
    playhead.set({ source: project.timeline?.clips[0]?.sourceStart ?? 0 });
    connectEvents(slug);
    void api.waveform(slug).then((waveform) => store.set({ waveform })).catch(() => toast('forma de onda indisponível', 'warn'));
    void refreshEvals();
    void api.jobs(slug).then(({ job }) => store.set({ job })).catch(() => undefined);
  } catch (error) {
    store.set({ loadError: message(error) });
  }
}

/** Recarrega a EDL salva (sem tocar no lote local). */
async function reloadProject(): Promise<ProjectPayload | null> {
  const { slug } = store.get();
  if (!slug) return null;
  const project = await api.project(slug);
  store.set({ project });
  return project;
}

function connectEvents(slug: string): void {
  events?.close();
  events = api.events(slug);
  const on = (name: string, handler: (data: Record<string, unknown>) => void) =>
    events!.addEventListener(name, (event) => handler(JSON.parse((event as MessageEvent).data as string) as Record<string, unknown>));
  on('hello', (data) => void onVersion(typeof data.latest === 'number' ? data.latest : null, ''));
  on('version', (data) => void onVersion(Number(data.version), String(data.notes ?? '')));
  on('job', (data) => store.set({ job: data as unknown as JobView, jobLog: [], jobProgress: null }));
  on('job-log', (data) => store.set((state) => ({ jobLog: [...state.jobLog.slice(-300), String(data.line)] })));
  on('job-progress', (data) => store.set({ jobProgress: { label: String(data.label ?? ''), percent: Number(data.percent ?? 0), etaSec: typeof data.etaSec === 'number' ? data.etaSec : null } }));
  on('job-done', (data) => {
    store.set((state) => ({ job: state.job ? { ...state.job, status: data.ok ? 'done' : 'failed', url: (data.url as string | null) ?? null, file: (data.file as string | null) ?? null } : null }));
    toast(data.ok ? `${String(data.kind)} terminou` : `${String(data.kind)} falhou (código ${String(data.code)})`, data.ok ? 'ok' : 'error');
    if (String(data.kind).startsWith('eval')) void refreshEvals();
  });
  on('claude', (data) => {
    const event = data as unknown as ClaudeEvent;
    store.set((state) => ({ claudeRunning: event.kind === 'start' ? true : state.claudeRunning, claudeEvents: event.kind === 'start' ? [event] : [...state.claudeEvents, event] }));
  });
  on('claude-done', (data) => {
    store.set({ claudeRunning: false, claudeDone: data as unknown as ClaudeDone });
    toast(data.proposedVersion ? `Claude propôs a v${String(data.proposedVersion)}` : 'Claude terminou sem nova versão', data.proposedVersion ? 'ok' : 'warn');
  });
  events.onerror = () => store.set({ hint: { tone: 'warn', text: 'conexão com o servidor caiu; tentando de novo…' } });
  events.onopen = () => store.set((state) => (state.hint?.text.startsWith('conexão') ? { hint: null } : {}));
}

/** Versão nova (SSE, hello): recarrega se não há edição local; senão, conflito explícito. */
async function onVersion(incoming: number | null, notes: string): Promise<void> {
  const state = store.get();
  const decision = decideVersion({ base: state.project?.latest ?? null, pendingOps: pendingOps(state).length, saving: state.saving }, incoming);
  if (decision === 'ignore' || incoming === null) return;
  if (decision === 'defer') {
    store.set({ deferred: [...state.deferred, incoming] });
    return;
  }
  if (decision === 'reload') {
    const before = state.project?.latest;
    const project = await reloadProject();
    const info = project?.versions.find((item) => item.version === incoming);
    toast(`nova versão v${incoming} (${versionOrigin(info?.notes ?? notes)}): ${(info?.notes ?? notes).slice(0, 90) || 'sem notes'}`, 'info', 7000);
    if (before !== undefined) store.set({ preview: null });
    return;
  }
  // conflito: busca o diff para mostrar o que mudou
  const base = state.project!.latest!;
  let diff: string[] = [];
  try {
    diff = (await api.diff(state.slug!, base, incoming)).lines;
  } catch {
    /* o aviso aparece mesmo sem diff */
  }
  const project = await api.project(state.slug!).catch(() => null);
  store.set({
    conflict: {
      origin: 'external',
      base,
      current: incoming,
      diff,
      since: project ? project.versions.filter((item) => item.version > base).map((item) => ({ version: item.version, notes: item.notes })) : [{ version: incoming, notes }],
      pendingOps: pendingOps(state).length,
    },
  });
}

// ── edição ───────────────────────────────────────────────────────────────────

/**
 * Tenta um gesto: o servidor aplica o lote pendente + as operações novas sem gravar. Aceito → entra no histórico
 * (undo desfaz o gesto inteiro); recusado → o motivo aparece e nada muda.
 */
export async function tryOps(ops: CutOp[], hint?: string | null): Promise<boolean> {
  const state = store.get();
  if (!state.slug || !state.project?.latest || ops.length === 0) return false;
  const next = [...pendingOps(state), ...ops];
  try {
    const preview = await api.preview(state.slug, state.project.latest, next);
    store.set((current) => ({ history: pushOp(current.history, ops), preview, previewError: null }));
    const warnings = [hint, ...preview.warnings.slice(-2)].filter(Boolean);
    setHint(warnings.length ? { tone: 'info', text: warnings.join(' · ') } : null);
    return true;
  } catch (error) {
    const index = error instanceof ApiError && typeof error.body.opIndex === 'number' ? error.body.opIndex : null;
    const text = index !== null && index >= next.length - ops.length ? message(error).replace(/^operação \d+: /, '') : message(error);
    setHint({ tone: 'error', text: `recusado: ${text}` });
    return false;
  }
}

async function recompute(history: OpHistory<CutOp[]>): Promise<void> {
  const state = store.get();
  const ops = history.done.flat();
  if (!state.slug || !state.project?.latest) return;
  if (ops.length === 0) {
    store.set({ history, preview: null, previewError: null });
    return;
  }
  try {
    const preview = await api.preview(state.slug, state.project.latest, ops);
    store.set({ history, preview, previewError: null });
  } catch (error) {
    store.set({ history, previewError: message(error) });
  }
}

export function undoEdit(): void {
  const { history } = store.get();
  if (!canUndo(history)) return toast('nada para desfazer');
  void recompute(undo(history));
}

export function redoEdit(): void {
  const { history } = store.get();
  if (!canRedo(history)) return toast('nada para refazer');
  void recompute(redo(history));
}

export function discardEdits(): void {
  store.set({ history: emptyHistory(), preview: null, previewError: null, hint: null });
}

/** Salva o lote como v(N+1) (notes "Matheus: ..."). 409 → conflito explícito, sem perder o lote. */
export async function saveEdits(note?: string): Promise<void> {
  const state = store.get();
  const ops = pendingOps(state);
  if (!state.slug || !state.project?.latest) return;
  if (ops.length === 0) return toast('nada para salvar');
  if (state.conflict) return toast('resolva o conflito de versão antes de salvar', 'warn');
  store.set({ saving: true, deferred: [] });
  try {
    const saved = await api.save(state.slug, state.project.latest, ops, note);
    store.set({ history: emptyHistory(), preview: null });
    await reloadProject();
    toast(`salvo como v${saved.version}: ${saved.notes.slice(0, 120)}`, 'ok', 6000);
    if (saved.warnings.length) setHint({ tone: 'warn', text: saved.warnings.join(' · ') });
    const later = settleDeferred(store.get().deferred, saved.version);
    store.set({ saving: false, deferred: [] });
    if (later !== null) await onVersion(later, '');
  } catch (error) {
    store.set({ saving: false });
    const deferred = store.get().deferred;
    store.set({ deferred: [] });
    if (error instanceof ApiError && error.status === 409) {
      const conflict = conflictFromResponse(error.body, state.project.latest, ops.length);
      if (conflict) store.set({ conflict });
      return;
    }
    if (error instanceof ApiError && error.status === 422) {
      setHint({ tone: 'error', text: `não salvou: ${message(error)}` });
    } else toast(`não salvou: ${message(error)}`, 'error');
    for (const version of deferred) await onVersion(version, '');
  }
}

/** Conflito → reaplicar o lote local sobre a versão atual. A operação que não couber é apontada (não some sozinha). */
export async function rebaseEdits(dropIndex?: number): Promise<void> {
  const state = store.get();
  if (!state.slug || !state.conflict) return;
  let ops = pendingOps(state);
  if (dropIndex !== undefined) ops = ops.filter((_, index) => index !== dropIndex);
  const project = await api.project(state.slug);
  const target = project.latest!;
  try {
    const preview = ops.length ? await api.preview(state.slug, target, ops) : null;
    store.set({ project, preview, history: ops.length ? pushOp(emptyHistory(), ops) : emptyHistory(), conflict: null, rebaseDropped: null });
    toast(`edições reaplicadas sobre a v${target}`, 'ok');
  } catch (error) {
    const outcome = rebaseOutcome(ops, { ok: false, opIndex: error instanceof ApiError ? (error.body.opIndex as number | undefined) : undefined, error: message(error) });
    store.set({ rebaseDropped: outcome.dropped });
    if (!outcome.dropped) toast(`não deu para reaplicar: ${message(error)}`, 'error');
  }
}

export async function discardAndReload(): Promise<void> {
  discardEdits();
  store.set({ conflict: null, rebaseDropped: null });
  await reloadProject();
}

export async function revertVersion(version: number): Promise<void> {
  const state = store.get();
  if (!state.slug || !state.project?.latest) return;
  if (pendingOps(state).length) return toast('salve ou descarte as edições antes de voltar de versão', 'warn');
  try {
    const result = await api.revert(state.slug, version, state.project.latest);
    store.set({ saving: false });
    await reloadProject();
    toast(`v${version} restaurada como v${result.version} (nada foi apagado)`, 'ok');
  } catch (error) {
    toast(`não voltou: ${message(error)}`, 'error');
  }
}

// ── jobs, avaliação, Claude ──────────────────────────────────────────────────

export async function refreshEvals(): Promise<void> {
  const { slug } = store.get();
  if (!slug) return;
  try {
    store.set({ evals: (await api.evals(slug)).eval });
  } catch {
    /* sem avaliação ainda */
  }
}

export async function startJob(body: Parameters<typeof api.startJob>[1]): Promise<void> {
  const { slug } = store.get();
  if (!slug) return;
  if (pendingOps(store.get()).length) toast('há edições não salvas: o render usa a última versão salva', 'warn', 6000);
  try {
    const { job } = await api.startJob(slug, body);
    store.set({ job, jobLog: [], jobProgress: null, right: body.kind.startsWith('eval') ? 'eval' : 'render' });
  } catch (error) {
    toast(message(error), 'error');
  }
}

export async function askClaude(instruction: string, selection?: { start?: number; end?: number; ids?: string[] }): Promise<void> {
  const state = store.get();
  if (!state.slug || !state.project?.latest) return;
  if (pendingOps(state).length) return toast('salve ou descarte as edições antes de pedir ao Claude (ele parte da versão salva)', 'warn', 6000);
  store.set({ claudeDone: null, claudeEvents: [], claudeRunning: true });
  try {
    await api.claude(state.slug, instruction, state.project.latest, selection);
  } catch (error) {
    store.set({ claudeRunning: false });
    toast(message(error), 'error', 7000);
  }
}

export async function settleClaude(accept: boolean): Promise<void> {
  const { slug, claudeDone } = store.get();
  if (!slug || !claudeDone?.proposedVersion) return;
  try {
    if (accept) {
      await api.claudeAccept(slug, claudeDone.proposedVersion);
      toast(`v${claudeDone.proposedVersion} aceita`, 'ok');
    } else {
      const result = await api.claudeReject(slug, claudeDone.proposedVersion);
      toast(`proposta rejeitada: v${result.version} volta ao conteúdo da v${claudeDone.baseVersion}`, 'ok');
    }
    store.set({ claudeDone: null });
    await reloadProject();
  } catch (error) {
    toast(message(error), 'error');
  }
}
