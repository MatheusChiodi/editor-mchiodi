import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { motion } from './theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Progresso 0→1 que começa em `startSec` e dura `durationSec`, na curva de entrada do canal. */
export function progressAt(frame: number, fps: number, startSec: number, durationSec: number = motion.base): number {
  return interpolate(frame, [startSec * fps, (startSec + durationSec) * fps], [0, 1], { ...clamp, easing: motion.enter });
}

/**
 * Presença de um elemento: sobe de 0 a 1 na entrada e volta a 0 na saída.
 * `total` é a duração do elemento em frames. Função pura para poder ser testada.
 */
export function presence(
  frame: number,
  fps: number,
  total: number,
  enterSec: number = motion.base,
  exitSec: number = motion.fast,
): { enter: number; exit: number; value: number } {
  const enter = interpolate(frame, [0, enterSec * fps], [0, 1], { ...clamp, easing: motion.enter });
  const exit = interpolate(frame, [total - exitSec * fps, total], [0, 1], { ...clamp, easing: motion.exit });
  return { enter, exit, value: enter * (1 - exit) };
}

/** Atraso em segundos do i-ésimo item de uma sequência escalonada. */
export function stagger(index: number, stepSec = 0.12, startSec = 0): number {
  return startSec + index * stepSec;
}

/**
 * Hook: presença do componente dentro da sua <Sequence>. `durationInFrames` é a prop que o
 * Overlay injeta em todo componente (a duração do overlay, não a do vídeo).
 */
export function usePresence(durationInFrames: number, enterSec?: number, exitSec?: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { frame, fps, ...presence(frame, fps, durationInFrames, enterSec, exitSec) };
}

/** Props que todo componente da biblioteca recebe além das suas. */
export interface BaseProps {
  durationInFrames: number;
}
