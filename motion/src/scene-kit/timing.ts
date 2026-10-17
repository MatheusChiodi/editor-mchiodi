import { interpolate } from 'remotion';

import { motion } from '../theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Segundos → frame inteiro. As props de tempo das cenas são em segundos; o Remotion conta frames. */
export function at(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/** Progresso 0→1 a partir de `delaySec`, na curva de entrada do canal. */
export function enter(frame: number, fps: number, delaySec = 0, durationSec: number = motion.base): number {
  return interpolate(frame, [delaySec * fps, (delaySec + durationSec) * fps], [0, 1], { ...clamp, easing: motion.enter });
}

/** Entrada padrão do kit: aparece subindo `distance` px conforme `progress` vai de 0 a 1. */
export function rise(progress: number, distance = 28): { opacity: number; translate: string } {
  return { opacity: progress, translate: `0px ${((1 - progress) * distance).toFixed(2)}px` };
}

/**
 * Presença 0→1→0 de algo que só existe entre `fromSec` e `toSec` (um rótulo, um destaque):
 * entra desacelerando e sai acelerando, cada borda durando `edgeSec`.
 */
export function window(frame: number, fromSec: number, toSec: number, fps: number, edgeSec: number = motion.fast): number {
  const edge = Math.max(1 / fps, Math.min(edgeSec, (toSec - fromSec) / 2));
  const fadeIn = interpolate(frame, [fromSec * fps, (fromSec + edge) * fps], [0, 1], { ...clamp, easing: motion.enter });
  const fadeOut = interpolate(frame, [(toSec - edge) * fps, toSec * fps], [0, 1], { ...clamp, easing: motion.exit });
  return fadeIn * (1 - fadeOut);
}

/** Progresso 0→1 com overshoot curto: reservado ao único destaque da cena. */
export function popIn(frame: number, fps: number, delaySec = 0, durationSec: number = motion.base): number {
  return interpolate(frame, [delaySec * fps, (delaySec + durationSec) * fps], [0, 1], { ...clamp, easing: motion.pop });
}
