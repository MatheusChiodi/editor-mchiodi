import type { Grade, Zoom } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { escapeFilterPath } from '../lib/ffpath.ts';

const PRESETS: Record<Grade['preset'], { contrast: number; saturation: number; balance: string | null }> = {
  none: { contrast: 1, saturation: 1, balance: null },
  neutral: { contrast: 1.04, saturation: 1.06, balance: null },
  warm: { contrast: 1.05, saturation: 1.08, balance: 'colorbalance=rm=0.04:bm=-0.04:rh=0.02:bh=-0.02' },
  cool: { contrast: 1.05, saturation: 1.04, balance: 'colorbalance=rm=-0.03:bm=0.04:bh=0.02' },
  punchy: { contrast: 1.1, saturation: 1.18, balance: null },
};

const fixed = (value: number) => Number(value.toFixed(3)).toString();

/** Cadeia de cor: a mesma para o vídeo inteiro, o que garante consistência entre os clipes. */
export function gradeFilters(grade: Grade): string[] {
  const preset = PRESETS[grade.preset];
  const filters: string[] = [];
  if (grade.exposure !== 0) filters.push(`exposure=exposure=${fixed(grade.exposure)}`);
  if (grade.lut) filters.push(`lut3d=file=${escapeFilterPath(grade.lut)}`);
  const contrast = preset.contrast * grade.contrast;
  const saturation = preset.saturation * grade.saturation;
  if (contrast !== 1 || saturation !== 1) filters.push(`eq=contrast=${fixed(contrast)}:saturation=${fixed(saturation)}`);
  if (preset.balance) filters.push(preset.balance);
  if (grade.sharpen > 0) filters.push(`unsharp=5:5:${fixed(grade.sharpen * 1.2)}:5:5:0`);
  return filters;
}

export interface PlacedZoom {
  /** segundos do vídeo final */
  start: number;
  end: number;
  scale: number;
  focus: { x: number; y: number };
  mode: Zoom['mode'];
}

/** Zooms no tempo de saída. Um zoom nunca atravessa um corte: termina no fim do clipe onde começou. */
export function placeZooms(zooms: Zoom[], timeline: Timeline): PlacedZoom[] {
  const placed: PlacedZoom[] = [];
  for (const zoom of zooms) {
    const start = sourceToOutput(timeline, zoom.at);
    if (start === null) continue;
    const clip = timeline.clips.find((item) => start >= item.outputStart - 1e-6 && start < item.outputEnd);
    const end = Math.min(start + zoom.duration, clip ? clip.outputEnd : timeline.durationSec);
    if (end - start < 0.2) continue;
    placed.push({ start, end, scale: zoom.scale, focus: zoom.focus, mode: zoom.mode });
  }
  return placed.sort((a, b) => a.start - b.start);
}

const RAMP = 0.4;

/** Envelope 0..1 do zoom em função de `t`, como expressão do ffmpeg. */
export function zoomEnvelope(zoom: PlacedZoom): string {
  const a = fixed(zoom.start);
  const b = fixed(zoom.end);
  const inside = `between(t,${a},${b})`;
  if (zoom.mode === 'punch') return inside;
  if (zoom.mode === 'ken-burns') return `(${inside}*clip((t-${a})/${fixed(zoom.end - zoom.start)},0,1))`;
  // 'ease': smoothstep na entrada; a saída coincide com o fim do zoom (ou com o corte)
  const ramp = Math.min(RAMP, (zoom.end - zoom.start) / 3);
  const up = `clip((t-${a})/${fixed(ramp)},0,1)`;
  const down = `clip((t-${fixed(zoom.end - ramp)})/${fixed(ramp)},0,1)`;
  const smooth = (p: string) => `(${p}*${p}*(3-2*${p}))`;
  return `(${inside}*${smooth(up)}*(1-${smooth(down)}))`;
}

/**
 * Punch-in digital: escala o quadro por frame e recorta de volta ao tamanho original.
 * O recorte usa `t` (e não `iw`), porque o crop só reavalia as dimensões de entrada na configuração.
 */
export function zoomFilters(zooms: PlacedZoom[], width: number, height: number): string[] {
  if (zooms.length === 0) return [];
  const terms = zooms.map((zoom) => `${fixed(zoom.scale - 1)}*${zoomEnvelope(zoom)}`);
  const z = `(1+${terms.join('+')})`;
  const focus = (axis: 'x' | 'y') =>
    `(${zooms.map((zoom) => `${fixed(zoom.focus[axis])}*between(t,${fixed(zoom.start)},${fixed(zoom.end)})`).join('+')})`;
  return [
    `scale=w='trunc(${width}*${z}/2)*2':h='trunc(${height}*${z}/2)*2':eval=frame:flags=bicubic`,
    `crop=${width}:${height}:x='${width}*(${z}-1)*${focus('x')}':y='${height}*(${z}-1)*${focus('y')}'`,
  ];
}
