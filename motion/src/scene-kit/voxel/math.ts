import { interpolate, spring } from 'remotion';

import { motion } from '../../theme';

// Helpers de tempo do estilo voxel. Aqui tudo é em FRAMES (como no voxel-story), não em segundos.

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const easeOut = motion.enter;
export const easeInOut = motion.move;

export const springs = {
  pop: { damping: 11, stiffness: 190, mass: 0.6 },
  settle: { damping: 200 },
} as const;

/** Progresso 0→1 entre os frames `from` e `to`. */
export function progress(frame: number, from: number, to: number, easing: (t: number) => number = easeOut): number {
  return interpolate(frame, [from, to], [0, 1], { ...clamp, easing });
}

/** Mola curta com overshoot: bloco sendo colocado. */
export function pop(frame: number, start: number, fps: number): number {
  return frame < start ? 0 : spring({ frame: frame - start, fps, config: springs.pop });
}

/** Vai e volta suave entre 0 e 1, um ciclo a cada `period` frames. */
export function swing(frame: number, period: number): number {
  return 0.5 - 0.5 * Math.cos((frame / period) * Math.PI * 2);
}

/** Sobe até 1 em `peak` e volta a 0: golpes e flashes. */
export function pulse(frame: number, peak: number, spread: number): number {
  return Math.max(0, 1 - Math.abs(frame - peak) / spread);
}
