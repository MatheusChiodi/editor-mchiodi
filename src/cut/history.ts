/**
 * Undo/redo local do editor: uma pilha pura de operações ainda não salvas. O front guarda o estado; o servidor
 * só recebe `pending` (o lote) ao salvar. Imutável: cada função devolve um estado novo.
 */
export interface OpHistory<T> {
  done: readonly T[];
  undone: readonly T[];
}

export function emptyHistory<T>(): OpHistory<T> {
  return { done: [], undone: [] };
}

export function pushOp<T>(history: OpHistory<T>, op: T): OpHistory<T> {
  return { done: [...history.done, op], undone: [] };
}

export function undo<T>(history: OpHistory<T>): OpHistory<T> {
  const last = history.done.at(-1);
  if (last === undefined) return history;
  return { done: history.done.slice(0, -1), undone: [...history.undone, last] };
}

export function redo<T>(history: OpHistory<T>): OpHistory<T> {
  const next = history.undone.at(-1);
  if (next === undefined) return history;
  return { done: [...history.done, next], undone: history.undone.slice(0, -1) };
}

export const canUndo = <T>(history: OpHistory<T>) => history.done.length > 0;
export const canRedo = <T>(history: OpHistory<T>) => history.undone.length > 0;

/** O lote que vai para o servidor ao salvar. */
export function pending<T>(history: OpHistory<T>): T[] {
  return [...history.done];
}
