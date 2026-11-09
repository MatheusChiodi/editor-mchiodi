/**
 * Props da composição `Overlay` como o render as monta (src/render/index.ts), a partir do plano de garantia do
 * servidor (src/cut/guard.ts): deslocamento automático dos gráficos, foco `auto` dos palcos e trilha de foco.
 * O Cut usa esta função para a camada de gráficos E para o enquadramento do footage, para que os dois leiam
 * exatamente os mesmos itens (e o mesmo palco) que o render.
 */
import type { FocusKey, Point } from '../../motion/src/arsenal/stage.ts';
import type { Word } from '../analyze/types.ts';
import type { Edl } from '../edl/schema.ts';
import type { Timeline } from '../edl/timeline.ts';
import { buildOverlayProps } from './overlay-props.ts';
import { applyStageTracks } from './stage-focus.ts';

export interface PreviewGuard {
  shifts: Record<string, Point>;
  stageFocus: Record<string, Point>;
  stageTracks: Record<string, FocusKey[]>;
}

export function buildPreviewProps(edl: Edl, timeline: Timeline, transcript: { words: Word[] }, guard?: PreviewGuard | null) {
  const props = buildOverlayProps(
    edl,
    timeline,
    transcript,
    undefined,
    guard ? new Map(Object.entries(guard.stageFocus)) : undefined,
    guard ? new Map(Object.entries(guard.shifts)) : undefined,
  );
  if (guard) applyStageTracks(props.overlays, new Map(Object.entries(guard.stageTracks ?? {})));
  return props;
}
