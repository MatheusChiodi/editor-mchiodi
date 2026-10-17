import { isWindowSlot } from '../../motion/src/arsenal/stage.ts';
import type { Edl } from '../edl/schema.ts';
import type { Timeline } from '../edl/timeline.ts';
import type { ProjectPaths } from '../project/paths.ts';
import { loadFocusSamples, type ShortFocusOptions } from './shorts-focus.ts';
import { planStageFocus, type StageFocusPlan } from './stage-focus.ts';

/**
 * Casca do foco dos palcos: carrega a série do apresentador (cache do detector ou track à mão) só quando há palco
 * com apresentador, e planeja. Sem proxy, o plano sai sem amostras (auto cai no padrão) e `missing` explica.
 */
export async function loadStageFocus(paths: ProjectPaths, edl: Edl, timeline: Timeline, options: ShortFocusOptions = {}): Promise<{ plans: StageFocusPlan[]; missing: string | null }> {
  const staged = edl.overlays.some((overlay) => overlay.presenter && !isWindowSlot(overlay.presenter.slot) && overlay.layer !== 'persistent');
  if (!staged) return { plans: [], missing: null };
  try {
    const { samples } = await loadFocusSamples(paths, edl, options);
    return { plans: planStageFocus(edl, timeline, samples), missing: null };
  } catch (error) {
    return { plans: planStageFocus(edl, timeline, null), missing: (error as Error).message };
  }
}
