import { outputToSource, sourceToOutput, type Timeline } from '../../../src/edl/timeline.ts';

/**
 * Como a timeline desenha o tempo. `output`: o vídeo editado (trechos cortados somem, viram um marcador no corte).
 * `source`: o arquivo fonte inteiro, com o que foi cortado hachurado (é onde se restaura um trecho).
 * Todo instante guardado no editor é em segundos da FONTE; a régua mostra o tempo da vista.
 */
export type ViewMode = 'output' | 'source';

export interface TimeMap {
  mode: ViewMode;
  /** pixels por segundo da vista */
  pps: number;
  /** duração da vista em segundos (saída ou fonte) */
  durationSec: number;
  width: number;
  /** instante da fonte → tempo da vista; `null` se foi cortado (vista de saída) */
  viewTime: (source: number) => number | null;
  /** tempo da vista → instante da fonte (`null` fora do vídeo) */
  sourceTime: (view: number) => number | null;
  /** instante da fonte → x; `null` se foi cortado (vista de saída) */
  toX: (source: number) => number | null;
  /** como `toX`, mas um instante cortado cai no corte onde ele sumiu */
  toXClamped: (source: number) => number;
  /** x → tempo da vista e instante da fonte */
  fromX: (x: number) => { view: number; source: number | null };
}

/** Instante cortado → instante de saída do corte onde ele sumiu (início do próximo clipe mantido). */
export function collapsedOutput(timeline: Timeline, source: number): number {
  const next = timeline.clips.find((clip) => clip.sourceStart >= source - 1e-6);
  return next ? next.outputStart : timeline.durationSec;
}

/** Próximo instante tocável da vista editada a partir de `source` (pula o cortado); `null` = acabou o vídeo. */
export function nextPlayable(timeline: Timeline, source: number): number | null {
  for (const clip of timeline.clips) {
    if (source < clip.sourceStart - 1e-3) return clip.sourceStart;
    if (source < clip.sourceEnd - 1e-3) return source;
  }
  return null;
}

export function createTimeMap(timeline: Timeline, sourceDurationSec: number, mode: ViewMode, pps: number): TimeMap {
  const durationSec = mode === 'output' ? timeline.durationSec : sourceDurationSec;
  const viewTime = (source: number) => (mode === 'output' ? sourceToOutput(timeline, source) : source);
  const sourceTime = (view: number) => {
    if (view < 0 || view > durationSec + 1e-6) return null;
    return mode === 'output' ? outputToSource(timeline, Math.min(view, durationSec - 1e-6)) : view;
  };
  return {
    mode,
    pps,
    durationSec,
    width: Math.max(1, durationSec * pps),
    viewTime,
    sourceTime,
    toX: (source) => {
      const view = viewTime(source);
      return view === null ? null : view * pps;
    },
    toXClamped: (source) => (viewTime(source) ?? collapsedOutput(timeline, source)) * pps,
    fromX: (x) => {
      const view = Math.min(Math.max(x / pps, 0), durationSec);
      return { view, source: sourceTime(view) };
    },
  };
}

export const ZOOM_MIN_PPS = 2;
export const ZOOM_MAX_PPS = 600;

export function clampPps(pps: number): number {
  return Math.min(Math.max(pps, ZOOM_MIN_PPS), ZOOM_MAX_PPS);
}

/** Zoom que cabe o vídeo inteiro na largura visível. */
export function fitPps(viewportWidth: number, durationSec: number): number {
  return clampPps(durationSec > 0 ? (viewportWidth - 24) / durationSec : 40);
}

/** Novo scrollLeft que mantém o ponto sob `anchorX` (relativo à área visível) parado depois do zoom. */
export function zoomScroll(oldPps: number, newPps: number, anchorX: number, scrollLeft: number): number {
  const time = (scrollLeft + anchorX) / oldPps;
  return Math.max(0, time * newPps - anchorX);
}

const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

export interface RulerTicks {
  major: { t: number; label: string }[];
  minor: number[];
  step: number;
}

/** Marcas da régua entre `from` e `to` (tempo da vista), com rótulo a cada `minLabelPx` no mínimo. */
export function rulerTicks(from: number, to: number, pps: number, minLabelPx = 72): RulerTicks {
  const step = TICK_STEPS.find((candidate) => candidate * pps >= minLabelPx) ?? TICK_STEPS.at(-1)!;
  const subdivisions = step >= 60 ? 4 : step === 0.2 || step === 2 ? 4 : 5;
  const minorStep = step / subdivisions;
  const major: RulerTicks['major'] = [];
  const minor: number[] = [];
  const first = Math.max(0, Math.floor(from / minorStep) * minorStep);
  for (let index = 0; ; index += 1) {
    const t = Math.round((first + index * minorStep) * 1000) / 1000;
    if (t > to) break;
    const ratio = t / step;
    if (Math.abs(ratio - Math.round(ratio)) < 1e-6) major.push({ t, label: formatClock(t, step < 1) });
    else if (minorStep * pps >= 5) minor.push(t);
  }
  return { major, minor, step };
}

/** `1:02` ou `1:02.4` (décimo) ou `1:02:03` com hora. */
export function formatClock(sec: number, tenths = false): string {
  const safe = Math.max(0, sec);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const whole = Math.floor(safe % 60);
  const tenth = Math.floor((safe * 10) % 10);
  const ss = String(whole).padStart(2, '0');
  const base = hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}` : `${minutes}:${ss}`;
  return tenths ? `${base}.${tenth}` : base;
}

/** Timecode `mm:ss:ff` no fps de saída. */
export function formatTimecode(sec: number, fps: number): string {
  const totalFrames = Math.max(0, Math.round(sec * fps));
  const frames = totalFrames % Math.round(fps);
  const seconds = Math.floor(totalFrames / Math.round(fps));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}:${String(frames).padStart(2, '0')}`;
}
