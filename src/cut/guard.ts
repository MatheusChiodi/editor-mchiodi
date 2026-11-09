/**
 * Garantia de rosto livre para o preview do MChiodi Cut: o MESMO plano que o render usa (`planGuard` em
 * src/edl/fit.ts, foco dos palcos em src/render/stage-focus.ts), servido ao navegador para que o preview
 * mostre os deslocamentos, os zooms de ajuste e o enquadramento do palco como o vídeo final.
 * O miolo é puro (`buildGuardPayload`); a casca só lê as amostras do detector (cache em analysis/).
 */
import type { FocusKey, Point } from '../../motion/src/arsenal/stage.ts';
import { DEFAULT_FACE, faceForOverlay, type FitItem, type Footprints, planGuard } from '../edl/fit.ts';
import { loadFootprints } from '../edl/fit-io.ts';
import type { Edl, Zoom } from '../edl/schema.ts';
import type { Timeline } from '../edl/timeline.ts';
import type { ProjectPaths } from '../project/paths.ts';
import type { FocusSample } from '../render/focus.ts';
import { loadFocusSamples } from '../render/shorts-focus.ts';
import { formatStageFocus, planStageFocus, stageFocusMap, stageTrackMap } from '../render/stage-focus.ts';

export interface GuardPayload {
  /** de onde veio o rosto: detector, track à mão (`manual`) ou o rosto padrão no centro */
  origin: 'detector' | 'manual' | 'padrão';
  items: FitItem[];
  /** zooms de ajuste (`fit-*`) para somar aos da EDL */
  zooms: Zoom[];
  /** deslocamento automático por overlay (fração do quadro); o `offset` manual soma por cima */
  shifts: Record<string, Point>;
  /** rosto medido no trecho de cada overlay (detector) ou o padrão */
  faces: Record<string, Point>;
  /** foco dos palcos com `focus: "auto"` já resolvido, por overlay */
  stageFocus: Record<string, Point>;
  /** trilha de foco dos palcos que seguem o rosto (`applyStageTracks` no render), por overlay */
  stageTracks: Record<string, FocusKey[]>;
  /** avisos do render (rosto cortado no palco etc.) */
  warnings: string[];
}

const record = <T>(map: ReadonlyMap<string, T>): Record<string, T> => Object.fromEntries(map);

/** Plano de garantia + foco dos palcos de uma EDL, sem tocar em disco. `samples` null = sem detector. */
export function buildGuardPayload(
  edl: Pick<Edl, 'overlays' | 'zooms' | 'output'> & { shorts?: { faceBand?: { top: number; bottom: number } } | null },
  timeline: Timeline,
  footprints: Footprints,
  samples: readonly FocusSample[] | null,
  origin: GuardPayload['origin'],
): GuardPayload {
  const guard = planGuard(edl, footprints, timeline, samples);
  const stages = planStageFocus(edl, timeline, samples);
  const faces = new Map<string, Point>();
  for (const overlay of edl.overlays) faces.set(overlay.id, faceForOverlay(samples, timeline, overlay) ?? DEFAULT_FACE);
  return {
    origin: samples?.length ? origin : 'padrão',
    items: guard.items,
    zooms: guard.zooms,
    shifts: record(guard.shifts),
    faces: record(faces),
    stageFocus: record(stageFocusMap(stages)),
    stageTracks: record(stageTrackMap(stages)),
    warnings: formatStageFocus(stages).filter((line) => line.startsWith('aviso')),
  };
}

/** Detecções em andamento por projeto: dois pedidos juntos (ao abrir o editor) não rodam o detector duas vezes. */
const inflight = new Map<string, Promise<{ samples: FocusSample[]; origin: GuardPayload['origin'] }>>();

/** Casca: lê o rosto (cache do detector ou track à mão); sem proxy ou detector, cai no rosto padrão. */
export async function previewGuard(paths: ProjectPaths, edl: Edl, timeline: Timeline): Promise<GuardPayload> {
  let loading = inflight.get(paths.analysisDir);
  if (!loading) {
    loading = loadFocusSamples(paths, edl, {}).finally(() => inflight.delete(paths.analysisDir));
    inflight.set(paths.analysisDir, loading);
  }
  try {
    const { samples, origin } = await loading;
    return buildGuardPayload(edl, timeline, loadFootprints(), samples, origin);
  } catch {
    return buildGuardPayload(edl, timeline, loadFootprints(), null, 'padrão');
  }
}
