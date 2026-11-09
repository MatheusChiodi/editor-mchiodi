import { planGuard, type Guard } from '../edl/fit.ts';
import { loadFootprints } from '../edl/fit-io.ts';
import type { Edl } from '../edl/schema.ts';
import type { Timeline } from '../edl/timeline.ts';
import type { ProjectPaths } from '../project/paths.ts';
import { loadFocusSamples } from './shorts-focus.ts';

/**
 * Casca da garantia de rosto livre: lê o rosto do detector (cache em analysis/focus-detect.json ou track à mão);
 * sem amostras, cai no rosto padrão no centro. Nunca derruba o render.
 */
export async function loadGuard(paths: ProjectPaths, edl: Edl, timeline: Timeline): Promise<Guard & { origin: 'detector' | 'manual' | 'padrão' }> {
  let samples = null as Awaited<ReturnType<typeof loadFocusSamples>>['samples'] | null;
  let origin: 'detector' | 'manual' | 'padrão' = 'padrão';
  try {
    const loaded = await loadFocusSamples(paths, edl, {});
    samples = loaded.samples;
    origin = loaded.origin;
  } catch {
    samples = null;
  }
  return { ...planGuard(edl, loadFootprints(), timeline, samples), origin };
}
