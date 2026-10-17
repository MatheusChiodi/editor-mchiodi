import { existsSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { type LevelId, matchLevel } from '../edl/levels.ts';
import { readJson, ROOT, slugFromFile, writeJson } from '../project/paths.ts';

export const QUEUE_FILE = join(ROOT, '.queue', 'queue.json');
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.m4v', '.webm', '.avi']);

export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  file: string;
  slug: string;
  /** nível de edição pedido pela pasta da inbox; null (ou ausente, em filas antigas) = o padrão do config */
  level?: LevelId | null;
  status: JobStatus;
  addedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  error: string | null;
}

export function isVideoFile(file: string): boolean {
  return VIDEO_EXTENSIONS.has(extname(file).toLowerCase());
}

/**
 * Gravações de tela que acompanham um vídeo ("aula.tela.mp4", "aula.screen.mov") não viram
 * um projeto próprio: são anexadas ao vídeo principal pelo diretor.
 */
export function isCompanionFile(file: string): boolean {
  return /\.(tela|screen)\.[a-z0-9]+$/i.test(file);
}

/**
 * Onde o arquivo caiu decide o nível: `inbox/video.mp4` usa o padrão, `inbox/pro/video.mp4` pede o
 * nível pro (vale apelido: `inbox/profissional/`). Pasta que não é um nível não é observada.
 */
export function inboxLevel(inbox: string, file: string): { accepted: boolean; level: LevelId | null } {
  const parts = relative(inbox, file).split(/[\\/]/);
  if (parts.length === 1) return { accepted: true, level: null };
  const level = parts.length === 2 ? matchLevel(parts[0]!) : null;
  return { accepted: level !== null, level };
}

/** Entra na fila uma vez só: o mesmo arquivo pendente, rodando ou concluído não é reenfileirado. */
export function enqueue(queue: Job[], file: string, now = new Date(), level: LevelId | null = null): { queue: Job[]; job: Job | null } {
  if (!isVideoFile(file) || isCompanionFile(file)) return { queue, job: null };
  const existing = queue.find((job) => job.file === file && job.status !== 'failed');
  if (existing) return { queue, job: null };
  const job: Job = {
    id: `${now.getTime().toString(36)}-${slugFromFile(file)}`,
    file,
    slug: slugFromFile(file),
    level,
    status: 'pending',
    addedAt: now.toISOString(),
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    error: null,
  };
  return { queue: [...queue.filter((item) => item.file !== file), job], job };
}

/** Um vídeo por vez: a máquina não aguenta dois renders (16 GB de RAM, 6 GB de VRAM). */
export function nextJob(queue: Job[]): Job | null {
  if (queue.some((job) => job.status === 'running')) return null;
  return queue.find((job) => job.status === 'pending') ?? null;
}

export function updateJob(queue: Job[], id: string, patch: Partial<Job>): Job[] {
  return queue.map((job) => (job.id === id ? { ...job, ...patch } : job));
}

/** Job que ficou "rodando" quando o watcher morreu volta para a fila ao reiniciar. */
export function recoverInterrupted(queue: Job[]): Job[] {
  return queue.map((job) => (job.status === 'running' ? { ...job, status: 'pending' as const, startedAt: null } : job));
}

export function summarize(queue: Job[]): string {
  const count = (status: JobStatus) => queue.filter((job) => job.status === status).length;
  return `${count('pending')} na fila · ${count('running')} rodando · ${count('done')} concluídos · ${count('failed')} com falha`;
}

export function loadQueue(file = QUEUE_FILE): Job[] {
  return existsSync(file) ? readJson<Job[]>(file) : [];
}

export function saveQueue(queue: Job[], file = QUEUE_FILE): void {
  writeJson(file, queue);
}
