/**
 * Mão dupla com o terminal e o Claude: uma versão nova da EDL pode chegar a qualquer momento (evento `version`
 * do SSE, `hello` ao reconectar ou 409 no /save). Regra: edição local não salva nunca é perdida em silêncio.
 */
export interface SyncState {
  /** versão em que a UI está (base das edições locais) */
  base: number | null;
  /** operações locais ainda não salvas */
  pendingOps: number;
  /** um /save está em voo: a versão que ele grava chega pelo SSE antes da resposta */
  saving: boolean;
}

export type VersionDecision =
  /** versão já conhecida (inclusive a que acabamos de salvar) */
  | 'ignore'
  /** decide depois da resposta do /save */
  | 'defer'
  /** sem edição local: recarrega e avisa */
  | 'reload'
  /** há edição local: conflito explícito, o Matheus escolhe */
  | 'conflict';

export function decideVersion(state: SyncState, incoming: number | null): VersionDecision {
  if (incoming === null) return 'ignore';
  if (state.base !== null && incoming <= state.base) return 'ignore';
  if (state.saving) return 'defer';
  return state.pendingOps > 0 ? 'conflict' : 'reload';
}

/** Depois do /save: das versões que chegaram durante ele, só as posteriores à gravada contam. */
export function settleDeferred(deferred: number[], saved: number): number | null {
  const newer = deferred.filter((version) => version > saved);
  return newer.length ? Math.max(...newer) : null;
}

export interface Conflict {
  /** de onde veio: versão nova pelo SSE ou recusa do /save */
  origin: 'external' | 'save';
  base: number;
  current: number;
  /** o que mudou da base para a atual (diffEdl) */
  diff: string[];
  since: { version: number; notes: string }[];
  pendingOps: number;
}

interface ConflictBody {
  error?: string;
  baseVersion?: number;
  currentVersion?: number;
  diff?: unknown;
  since?: unknown;
}

/** Corpo do 409 do /save (ou do /claude) → conflito para a faixa de aviso. `null` se não é conflito de versão. */
export function conflictFromResponse(body: ConflictBody, base: number, pendingOps: number): Conflict | null {
  if (body.error !== 'conflict' && body.currentVersion === undefined) return null;
  const current = typeof body.currentVersion === 'number' ? body.currentVersion : base;
  return {
    origin: 'save',
    base: typeof body.baseVersion === 'number' ? body.baseVersion : base,
    current,
    diff: Array.isArray(body.diff) ? body.diff.map(String) : [],
    since: Array.isArray(body.since) ? (body.since as Conflict['since']) : [],
    pendingOps,
  };
}

/**
 * Saídas do conflito. `rebase`: reaplica as edições locais sobre a versão nova (o servidor valida op a op; a que não
 * couber mais é apontada e fica de fora só se o Matheus mandar). `discard`: descarta as locais. `keep`: segue editando
 * sobre a base antiga (salvar continuará recusado até escolher).
 */
export type ConflictChoice = 'rebase' | 'discard' | 'keep';

export interface RebaseResult<T> {
  ok: boolean;
  /** operações que entram na nova base */
  ops: T[];
  /** operação recusada pela versão nova (índice no lote original) e o motivo */
  dropped: { index: number; op: T; error: string } | null;
}

/** Resultado do /preview da reaplicação: 200 → tudo entra; 422 com `opIndex` → aquela operação não cabe mais. */
export function rebaseOutcome<T>(ops: T[], response: { ok: boolean; opIndex?: number; error?: string }): RebaseResult<T> {
  if (response.ok) return { ok: true, ops, dropped: null };
  const index = typeof response.opIndex === 'number' && response.opIndex >= 0 && response.opIndex < ops.length ? response.opIndex : -1;
  if (index < 0) return { ok: false, ops, dropped: null };
  return { ok: false, ops: ops.filter((_, position) => position !== index), dropped: { index, op: ops[index]!, error: response.error ?? 'recusada' } };
}

/** Texto curto da origem de uma versão a partir das notes (para o aviso). */
export function versionOrigin(notes: string): 'Matheus' | 'Claude/terminal' {
  return notes.startsWith('Matheus:') ? 'Matheus' : 'Claude/terminal';
}
