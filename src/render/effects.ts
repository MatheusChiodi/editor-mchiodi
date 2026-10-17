import type { OverlayItem } from '../../motion/src/types.ts';
import { buildEffectFilters, effects } from '../arsenal/effects.ts';
import type { Effect } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';

export interface PlacedEffect {
  id: string;
  preset: string;
  /** segundos do vídeo final */
  start: number;
  end: number;
  intensity: number;
  focus: { x: number; y: number };
}

/**
 * Efeitos no tempo de saída. Sem `duration`, vale a padrão do preset; preset sem duração padrão
 * (looks, textura, moldura) vai até o fim do vídeo.
 */
export function placeEffects(items: Effect[], timeline: Timeline): PlacedEffect[] {
  const placed: PlacedEffect[] = [];
  for (const item of items) {
    const preset = effects[item.preset];
    const start = sourceToOutput(timeline, item.at);
    if (!preset || start === null) continue;
    const duration = item.duration ?? preset.defaultDuration;
    const end = Math.min(timeline.durationSec, duration === null ? timeline.durationSec : start + duration);
    if (end - start < 0.1) continue;
    placed.push({ id: item.id, preset: item.preset, start, end, intensity: item.intensity ?? preset.defaultIntensity, focus: item.focus });
  }
  return placed.sort((a, b) => a.start - b.start);
}

/** Filtros do ffmpeg dos efeitos do tipo `filter`, na ordem em que acontecem. */
export function effectFilters(placed: PlacedEffect[], size: { width: number; height: number }, fps: number): string[] {
  return placed
    .filter((effect) => effects[effect.preset]?.kind === 'filter')
    .flatMap((effect) =>
      buildEffectFilters(effect.preset, { start: effect.start, end: effect.end, intensity: effect.intensity, focus: effect.focus, fps, ...size }),
    );
}

/** Efeitos do tipo `overlay` viram itens da camada de gráficos (componente `Fx`). */
export function effectOverlays(placed: PlacedEffect[], fps: number, totalFrames: number): OverlayItem[] {
  const items: OverlayItem[] = [];
  for (const effect of placed) {
    const preset = effects[effect.preset];
    if (!preset || preset.kind !== 'overlay' || !preset.overlay) continue;
    const from = Math.round(effect.start * fps);
    items.push({
      id: effect.id,
      component: 'Fx',
      from,
      durationInFrames: Math.max(1, Math.min(Math.round((effect.end - effect.start) * fps), totalFrames - from)),
      props: { ...preset.overlay.props?.(effect.intensity), variant: preset.overlay.variant, intensity: effect.intensity, focus: effect.focus },
      hidesCaptions: false,
    });
  }
  return items;
}
