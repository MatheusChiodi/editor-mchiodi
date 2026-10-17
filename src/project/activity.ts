import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { formatClock } from '../lib/time.ts';
import type { ProjectPaths } from './paths.ts';

export type ActivityKind = 'step-start' | 'step-done' | 'step-failed' | 'note';

/** Uma linha de `projects/<slug>/activity.log`: o que aconteceu na edição e quando. */
export interface ActivityEntry {
  /** epoch em ms */
  at: number;
  kind: ActivityKind;
  /** etapa do pipeline (mesmas chaves de `Step.key`) */
  step?: string;
  text: string;
  durationSec?: number;
}

const KINDS = new Set<ActivityKind>(['step-start', 'step-done', 'step-failed', 'note']);

/** Como a etapa aparece no histórico, com o gênero para a concordância ("análise concluída"). */
const STEP_NAME: Record<string, { name: string; feminine: boolean }> = {
  analysis: { name: 'análise', feminine: true },
  direction: { name: 'direção', feminine: true },
  preview: { name: 'render preview', feminine: false },
  eval: { name: 'autoavaliação', feminine: true },
  final: { name: 'render final', feminine: false },
  evalFinal: { name: 'avaliação do final', feminine: true },
  shorts: { name: 'render do Short', feminine: false },
};

export function activityFile(paths: Pick<ProjectPaths, 'dir'>): string {
  return join(paths.dir, 'activity.log');
}

const firstLine = (message: string) => message.split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';

/** O texto de uma linha de etapa: "render preview concluído em 10:29". */
export function stepText(kind: Exclude<ActivityKind, 'note'>, step: string, durationSec?: number, message?: string): string {
  const { name, feminine } = STEP_NAME[step] ?? { name: step, feminine: false };
  const ending = feminine ? 'a' : 'o';
  if (kind === 'step-start') return `${name} iniciad${ending}`;
  const took = durationSec === undefined ? '' : formatClock(durationSec, 0);
  if (kind === 'step-done') return `${name} concluíd${ending}${took ? ` em ${took}` : ''}`;
  const why = message ? firstLine(message) : '';
  return `${name} falhou${took ? ` após ${took}` : ''}${why ? `: ${why}` : ''}`;
}

/** Histórico é acessório: disco cheio ou pasta travada não pode derrubar um render. */
export function appendActivity(file: string, entry: ActivityEntry): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // sem histórico, a etapa segue
  }
}

/** Lê o log linha a linha; linha quebrada (gravação pela metade) ou fora do formato é ignorada. */
export function parseActivity(text: string): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const raw = JSON.parse(line) as Partial<ActivityEntry> | null;
      if (!raw || typeof raw.at !== 'number' || typeof raw.text !== 'string' || !KINDS.has(raw.kind as ActivityKind)) continue;
      entries.push({
        at: raw.at,
        kind: raw.kind as ActivityKind,
        text: raw.text,
        ...(typeof raw.step === 'string' ? { step: raw.step } : {}),
        ...(typeof raw.durationSec === 'number' && Number.isFinite(raw.durationSec) ? { durationSec: raw.durationSec } : {}),
      });
    } catch {
      // linha pela metade
    }
  }
  return entries;
}

export function readActivity(file: string): ActivityEntry[] {
  if (!existsSync(file)) return [];
  try {
    return parseActivity(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

/** "07:41 render preview concluído em 10:29" (hora local). */
export function formatActivity(entry: ActivityEntry): string {
  const date = new Date(entry.at);
  const time = [date.getHours(), date.getMinutes()].map((part) => String(part).padStart(2, '0')).join(':');
  return `${time} ${entry.text}`;
}

/** Quanto levou a última execução concluída de cada etapa. */
export function stepDurations(entries: ActivityEntry[]): Record<string, number> {
  const durations: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.kind === 'step-done' && entry.step && entry.durationSec !== undefined) durations[entry.step] = entry.durationSec;
  }
  return durations;
}

/** Tempo de máquina gasto na edição: toda etapa que rodou até o fim ou até falhar, repetições incluídas. */
export function totalSpent(entries: ActivityEntry[]): { seconds: number; runs: number } {
  const ran = entries.filter((entry) => (entry.kind === 'step-done' || entry.kind === 'step-failed') && entry.durationSec !== undefined);
  return { seconds: ran.reduce((sum, entry) => sum + (entry.durationSec ?? 0), 0), runs: ran.length };
}

/** Roda uma etapa registrando início, fim (com duração) e falha (com a mensagem) no histórico. */
export async function withActivity<T>(file: string, step: string, work: () => Promise<T>, clock: () => number = Date.now): Promise<T> {
  const startedAt = clock();
  const elapsed = () => Math.max(0, Math.round((clock() - startedAt) / 1000));
  appendActivity(file, { at: startedAt, kind: 'step-start', step, text: stepText('step-start', step) });
  try {
    const result = await work();
    const durationSec = elapsed();
    appendActivity(file, { at: clock(), kind: 'step-done', step, text: stepText('step-done', step, durationSec), durationSec });
    return result;
  } catch (error) {
    const durationSec = elapsed();
    const message = error instanceof Error ? error.message : String(error);
    appendActivity(file, { at: clock(), kind: 'step-failed', step, text: stepText('step-failed', step, durationSec, message), durationSec });
    throw error;
  }
}
