import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { ProgressFn } from '../lib/ffmpeg.ts';
import { type ProjectPaths, readJson } from './paths.ts';

export type LiveTask = 'analysis' | 'direction' | 'preview' | 'eval' | 'final' | 'evalFinal' | 'shorts';

/** O que está rodando agora num projeto, gravado pela própria etapa para o `mce progress` mostrar ao vivo. */
export interface Live {
  task: LiveTask;
  label: string;
  /** 0–100; null quando a etapa não mede (direção) */
  percent: number | null;
  etaSec: number | null;
  startedAt: number;
  updatedAt: number;
}

/** Depois disso sem atualização, o registro é de um processo que morreu. A direção não mede, então tem prazo maior. */
export const LIVE_TTL_MS: Record<'machine' | 'direction', number> = { machine: 3 * 60_000, direction: 30 * 60_000 };

export function liveFile(paths: Pick<ProjectPaths, 'dir'>): string {
  return join(paths.dir, 'live.json');
}

export function isFresh(live: Live, now: number): boolean {
  return now - live.updatedAt <= LIVE_TTL_MS[live.task === 'direction' ? 'direction' : 'machine'];
}

export function writeLive(file: string, live: Live): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(live), 'utf8');
}

export function readLive(file: string): Live | null {
  if (!existsSync(file)) return null;
  try {
    return readJson<Live>(file);
  } catch {
    // lido no meio de uma gravação: a próxima leitura pega
    return null;
  }
}

export function clearLive(file: string): void {
  rmSync(file, { force: true });
}

/**
 * Envolve o progresso de uma etapa: repassa para `inner` (o console) e grava em live.json, no máximo
 * a cada `everyMs`, para não escrever em disco a cada linha do ffmpeg.
 */
export function trackProgress(file: string, task: LiveTask, inner?: ProgressFn, everyMs = 500, clock: () => number = Date.now): ProgressFn {
  const startedAt = clock();
  let lastWrite = -Infinity;
  let lastLabel = '';
  return (info) => {
    inner?.(info);
    const now = clock();
    if (now - lastWrite < everyMs && info.label === lastLabel && info.percent < 100) return;
    lastWrite = now;
    lastLabel = info.label;
    writeLive(file, { task, label: info.label, percent: Math.round(info.percent), etaSec: info.etaSec, startedAt, updatedAt: now });
  };
}
