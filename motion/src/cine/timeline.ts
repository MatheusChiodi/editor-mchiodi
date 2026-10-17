import { hash } from './noise';

// Orquestração declarativa: em vez de espalhar números mágicos de frame pelo componente, descreva as deixas
// ("A entra em 0, B 3 frames depois de A começar, C quando A termina") e leia os tempos resolvidos.

export interface Cue {
  id: string;
  /** frame absoluto de início (padrão 0 quando não há `after` nem `with`) */
  at?: number;
  /** começa quando esta outra deixa TERMINA (+ `offset`) */
  after?: string;
  /** começa junto com esta outra deixa (+ `offset`): "acompanha" */
  with?: string;
  /** frames somados ao início calculado (pode ser negativo: antecipa) */
  offset?: number;
  /** duração em frames (padrão 0: um instante) */
  duration?: number;
}

export interface ResolvedCue {
  start: number;
  end: number;
  duration: number;
}

/** Resolve as deixas em frames absolutos. Erra cedo em referência inexistente, id repetido ou ciclo. */
export function resolveTimeline(cues: readonly Cue[]): Record<string, ResolvedCue> {
  const byId = new Map<string, Cue>();
  for (const cue of cues) {
    if (byId.has(cue.id)) throw new Error(`deixa repetida: ${cue.id}`);
    byId.set(cue.id, cue);
  }
  const resolved: Record<string, ResolvedCue> = {};
  const visiting = new Set<string>();
  const resolve = (id: string): ResolvedCue => {
    const done = resolved[id];
    if (done) return done;
    const cue = byId.get(id);
    if (!cue) throw new Error(`deixa desconhecida: ${id}`);
    if (visiting.has(id)) throw new Error(`ciclo na timeline em: ${id}`);
    visiting.add(id);
    const offset = cue.offset ?? 0;
    const duration = Math.max(0, cue.duration ?? 0);
    const base = cue.after ? resolve(cue.after).end : cue.with ? resolve(cue.with).start : (cue.at ?? 0);
    visiting.delete(id);
    const start = base + offset;
    return (resolved[id] = { start, end: start + duration, duration });
  };
  for (const cue of cues) resolve(cue.id);
  return resolved;
}

/** Último frame em que alguma deixa ainda está ativa: a duração mínima do componente. */
export function timelineEnd(timeline: Record<string, ResolvedCue>): number {
  return Math.max(0, ...Object.values(timeline).map((cue) => cue.end));
}

/** Progresso linear 0→1 dentro de uma deixa (passe por uma curva ou use o `start` numa mola). */
export function cueProgress(frame: number, cue: ResolvedCue): number {
  if (cue.duration <= 0) return frame >= cue.start ? 1 : 0;
  return Math.min(1, Math.max(0, (frame - cue.start) / cue.duration));
}

export type StaggerOrigin = 'start' | 'end' | 'center' | 'edges' | 'random';

export interface StaggerOptions {
  /** frames entre um item e o próximo na ordem de entrada */
  step?: number;
  /** de onde a onda parte */
  origin?: StaggerOrigin;
  /** frame em que o primeiro item entra */
  start?: number;
  /** se definido, a sequência inteira cabe nesses frames (o passo é recalculado) */
  total?: number;
  /** > 1 aperta o fim (os últimos entram quase juntos); < 1 aperta o começo */
  ease?: number;
  seed?: number;
}

/** Posição (0…n-1) de cada índice na ordem de entrada. */
export function staggerOrder(count: number, origin: StaggerOrigin = 'start', seed = 0): number[] {
  const indices = Array.from({ length: count }, (_, index) => index);
  const middle = (count - 1) / 2;
  const key = (index: number): number => {
    switch (origin) {
      case 'end':
        return count - 1 - index;
      case 'center':
        return Math.abs(index - middle);
      case 'edges':
        return middle - Math.abs(index - middle);
      case 'random':
        return hash(index, seed);
      default:
        return index;
    }
  };
  // ordena por distância à origem; empate (centro, bordas) entra junto
  const keys = indices.map(key);
  const distinct = [...new Set(keys)].sort((a, b) => a - b);
  return keys.map((value) => distinct.indexOf(value));
}

/** Frame de entrada de cada item de uma sequência escalonada. */
export function staggerDelays(count: number, { step = 3, origin = 'start', start = 0, total, ease = 1, seed = 0 }: StaggerOptions = {}): number[] {
  if (count <= 0) return [];
  const order = staggerOrder(count, origin, seed);
  const last = Math.max(1, ...order);
  const span = total ?? step * last;
  return order.map((rank) => start + span * (1 - (1 - rank / last) ** ease));
}

/** Segundos → frames (as props dos componentes são em segundos; a timeline conta frames). */
export function frames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}
