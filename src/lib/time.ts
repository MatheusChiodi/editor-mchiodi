/** Arredonda um tempo para a grade de frames; cortes fora da grade causam drift no concat. */
export function quantize(seconds: number, fps: number, mode: 'round' | 'floor' | 'ceil' = 'round'): number {
  const frame = Math[mode](seconds * fps + (mode === 'round' ? 0 : mode === 'floor' ? 1e-6 : -1e-6));
  return frame / fps;
}

export function toFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** 83.456 -> "01:23.46" */
export function formatClock(seconds: number, decimals = 2): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  const width = decimals > 0 ? decimals + 3 : 2;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(decimals).padStart(width, '0')}`;
}

/** Timestamp de capítulo do YouTube: "0:00", "12:34", "1:02:03" */
export function formatChapter(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function parseRational(value: string): number {
  const [num, den] = value.split('/').map(Number);
  if (num === undefined || Number.isNaN(num)) return 0;
  return den ? num / den : num;
}
