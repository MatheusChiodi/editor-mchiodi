/**
 * Ações de teclado/menu sobre os gráficos selecionados: voltar à posição original, nudge e duplicar.
 * Cada gesto é uma op da EDL (nova versão ao salvar; desfazer/refazer como as outras).
 */
import type { CutOp } from '../../src/cut/ops.ts';
import type { Overlay } from '../../src/edl/schema.ts';
import { duplicateOp, isZero, nudgeOffset, offsetOp } from './lib/graphic-drag.ts';
import { api } from './api.ts';
import { currentEdl, pendingOps, setHint, store, toast, tryOps } from './store.ts';

/** Overlays da seleção (chaves `overlays:<id>`), na ordem da EDL. */
export function selectedOverlays(): Overlay[] {
  const state = store.get();
  const edl = currentEdl(state);
  if (!edl) return [];
  const ids = new Set(state.selection.flatMap((key) => (key.startsWith('overlays:') ? [key.slice('overlays:'.length)] : [])));
  return edl.overlays.filter((overlay) => ids.has(overlay.id));
}

let guardTimer: ReturnType<typeof setTimeout> | undefined;
let guardSeq = 0;

/**
 * Pede ao servidor o plano de rosto livre da EDL com as ops pendentes (src/cut/guard.ts). Com debounce; a resposta
 * velha que chega depois de uma nova é descartada. Devolve o cancelamento (para o cleanup do useEffect).
 */
export function refreshGuard(): () => void {
  clearTimeout(guardTimer);
  guardTimer = setTimeout(() => {
    const state = store.get();
    if (!state.slug || !state.project?.latest) return;
    const seq = ++guardSeq;
    api
      .guard(state.slug, state.project.latest, pendingOps(state))
      .then((guard) => {
        if (seq === guardSeq) store.set({ guard });
      })
      .catch(() => {
        // sem plano o preview segue com o padrão (rosto no centro); o render usa o detector de qualquer jeito
      });
  }, 150);
  return () => clearTimeout(guardTimer);
}

let busy = false;

async function run(ops: CutOp[], hint?: string): Promise<void> {
  if (busy || ops.length === 0) return;
  busy = true;
  try {
    await tryOps(ops, hint ?? null);
  } finally {
    busy = false;
  }
}

const needSelection = () => toast('selecione um gráfico (clique nele no preview ou na timeline)');

/** Volta o gráfico à posição original (apaga `offset`). Sem id, vale para a seleção. */
export async function resetGraphic(id?: string): Promise<void> {
  const edl = currentEdl(store.get());
  const targets = id ? (edl?.overlays.filter((overlay) => overlay.id === id) ?? []) : selectedOverlays();
  if (targets.length === 0) return needSelection();
  const moved = targets.filter((overlay) => !isZero(overlay.offset));
  if (moved.length === 0) return setHint({ tone: 'info', text: 'já está na posição original' });
  await run(moved.map((overlay) => offsetOp(overlay.id, null)), 'gráfico voltou à posição original');
}

/** Empurra a seleção um passo (Alt+setas; Shift = passo grosso). */
export async function nudgeGraphics(direction: 'left' | 'right' | 'up' | 'down', big: boolean): Promise<void> {
  const targets = selectedOverlays();
  if (targets.length === 0) return needSelection();
  await run(targets.map((overlay) => offsetOp(overlay.id, nudgeOffset(overlay.offset, direction, big))));
}

/** Duplica a seleção no mesmo instante, deslocada; o duplicado fica selecionado quando o servidor devolve o id. */
export async function duplicateGraphics(): Promise<void> {
  const targets = selectedOverlays();
  if (targets.length === 0) return needSelection();
  const before = new Set((currentEdl(store.get())?.overlays ?? []).map((overlay) => overlay.id));
  await run(targets.map(duplicateOp), `${targets.length > 1 ? `${targets.length} gráficos duplicados` : 'gráfico duplicado'} (arraste o novo)`);
  const created = (currentEdl(store.get())?.overlays ?? []).filter((overlay) => !before.has(overlay.id));
  if (created.length) store.set({ selection: created.map((overlay) => `overlays:${overlay.id}`) });
}
