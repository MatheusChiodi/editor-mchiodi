import { existsSync } from 'node:fs';

import { loadQueue } from '../watcher/queue.ts';
import type { DashboardItem } from './dashboard.ts';
import type { Ambient } from './dashboard-watch.ts';
import { readHealth, type Vram } from './health.ts';
import { queueSummary, readExtras } from './insight.ts';
import { PROJECTS_DIR, projectPaths, ROOT } from './paths.ts';
import { buildPipeline, listProjects, readSnapshot } from './pipeline.ts';

/** Tudo o que o painel mostra das edições (uma, ou todas), lido do disco agora. */
export function loadItems(project?: string, now = Date.now()): DashboardItem[] {
  const queue = loadQueue();
  return (project ? [project] : listProjects()).map((slug) => {
    const paths = projectPaths(slug);
    const snapshot = readSnapshot(paths, queue);
    return { snapshot, steps: buildPipeline(snapshot, now), extra: readExtras(paths) };
  });
}

/** Saúde da máquina e fila do modo autônomo. A VRAM vem de fora: o nvidia-smi é lento para rodar a cada quadro. */
export function loadAmbient(vram: Vram | null): Ambient {
  let queue: Ambient['queue'];
  try {
    queue = queueSummary(loadQueue());
  } catch {
    // fila sendo gravada: a linha some até a próxima leitura
  }
  return { health: readHealth(existsSync(PROJECTS_DIR) ? PROJECTS_DIR : ROOT, vram), queue };
}
