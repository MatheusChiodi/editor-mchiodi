import { interpolate } from 'remotion';

import { motion } from '../theme';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Tons do design system que o `theme.ts` ainda não expõe (slate-800/400/100 e os "wash" de status). */
export const tone = {
  slate800: '#1e293b',
  slate400: '#94a3b8',
  slate100: '#f1f5f9',
  emeraldWash: '#ecfdf5',
  roseWash: '#fff1f2',
  amberWash: '#fffbeb',
  periwinkleInk: '#5264d8',
  periwinkleWash: '#f2f4ff',
} as const;

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

type FlexEdge = 'flex-start' | 'flex-end';

/**
 * Canto da tela em termos de flex (o AbsoluteFill é uma coluna: `justifyContent` é o eixo vertical).
 * `side` diz para que lado fica "fora da tela": -1 esquerda, 1 direita.
 */
export function cornerPlacement(corner: Corner): { justifyContent: FlexEdge; alignItems: FlexEdge; side: -1 | 1 } {
  const bottom = corner.startsWith('bottom');
  const right = corner.endsWith('right');
  return {
    justifyContent: bottom ? 'flex-end' : 'flex-start',
    alignItems: right ? 'flex-end' : 'flex-start',
    side: right ? 1 : -1,
  };
}

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Progresso 0→1 entre dois instantes (s) na curva de deslocamento: para traços que se desenham em ritmo constante. */
export function sweep(sec: number, fromSec: number, toSec: number): number {
  return interpolate(sec, [fromSec, Math.max(toSec, fromSec + 0.001)], [0, 1], { ...clamp, easing: motion.move });
}
