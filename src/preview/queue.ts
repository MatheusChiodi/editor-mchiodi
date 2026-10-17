import { isFresh, type Live } from '../project/live.ts';
import type { RenderStage, SceneStatus } from './types.ts';

export interface QueueItem {
  key: string;
  project: string;
  /** quando o arquivo da cena mudou (ms): a mais recente renderiza primeiro */
  changedAt: number;
}

/** Fila de render das prévias: um trabalho ativo por vez, pendentes sem repetição. */
export interface Queue {
  pending: QueueItem[];
  active: QueueItem | null;
}

export function emptyQueue(): Queue {
  return { pending: [], active: null };
}

/** Entrar de novo na fila só atualiza o item (dedupe). Vale também para a cena que está renderizando: ela roda outra vez depois. */
export function enqueue(queue: Queue, item: QueueItem): Queue {
  return { ...queue, pending: [...queue.pending.filter((other) => other.key !== item.key), item] };
}

/** Próxima cena: primeiro as do projeto em foco, depois a que mudou por último. */
export function pickNext(queue: Queue, focus?: string): QueueItem | null {
  const rank = (item: QueueItem) => (focus && item.project === focus ? 0 : 1);
  const sorted = [...queue.pending].sort((a, b) => rank(a) - rank(b) || b.changedAt - a.changedAt || a.key.localeCompare(b.key));
  return sorted[0] ?? null;
}

export function start(queue: Queue, key: string): Queue {
  const item = queue.pending.find((other) => other.key === key);
  if (!item) return queue;
  if (queue.active) throw new Error(`fila: "${queue.active.key}" ainda está renderizando`);
  return { pending: queue.pending.filter((other) => other.key !== key), active: item };
}

export function finish(queue: Queue, key: string): Queue {
  return queue.active?.key === key ? { ...queue, active: null } : queue;
}

/** Cena apagada (ou com erro de compilação): sai da espera. */
export function drop(queue: Queue, key: string): Queue {
  return { ...queue, pending: queue.pending.filter((other) => other.key !== key) };
}

export function countStatuses(statuses: SceneStatus[]): Record<SceneStatus, number> {
  const counts: Record<SceneStatus, number> = { queued: 0, rendering: 0, ready: 0, error: 0 };
  for (const status of statuses) counts[status] += 1;
  return counts;
}

/** Fatia de cada fase no progresso total do trabalho. */
const STAGE_SPAN: Record<RenderStage, [number, number]> = { bundle: [0, 10], strip: [10, 30], video: [30, 100] };

export function overallPercent(stage: RenderStage, fraction: number): number {
  const [from, to] = STAGE_SPAN[stage];
  return Math.round(from + (to - from) * Math.min(1, Math.max(0, fraction)));
}

export const PAUSED_BY_MAIN = 'render principal em andamento';

/**
 * A máquina tem pouca RAM: enquanto um render, análise ou avaliação principal roda em qualquer projeto,
 * as prévias esperam. A direção (`direction`) é o próprio Claude pensando, não pesa.
 */
export function pauseReason(lives: (Live | null)[], now: number): string | null {
  return lives.some((live) => live !== null && live.task !== 'direction' && isFresh(live, now)) ? PAUSED_BY_MAIN : null;
}

/** Cenas citadas na mensagem de erro do bundler (o caminho do arquivo aparece nela). */
export function blameScenes<T extends { project: string; name: string }>(message: string, scenes: T[]): T[] {
  const normalized = message.replaceAll('\\', '/');
  return scenes.filter((scene) => normalized.includes(`/${scene.project}/${scene.name}.tsx`));
}

/** Mensagem de erro pronta para a página: sem cores de terminal e sem a pilha inteira. */
export function cleanError(error: unknown, limit = 1200): string {
  const raw = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/\u001b\[[0-9;]*m/g, '').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
