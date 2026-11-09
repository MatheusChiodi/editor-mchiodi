import { noise2D } from '@remotion/noise';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

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
  exitSec: number = motion.leave,
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
 * Começo de cada item de uma cadeia: o próximo entra quando o anterior termina (`chain` do motion-canvas).
 * Para itens em paralelo use o mesmo `startSec`; para escalonar, `stagger`.
 */
export function chainStarts(durationsSec: readonly number[], gapSec = 0, startSec = 0): number[] {
  const starts: number[] = [];
  let cursor = startSec;
  for (const duration of durationsSec) {
    starts.push(cursor);
    cursor += duration + gapSec;
  }
  return starts;
}

/** Progresso 0→1 que se repete a cada `periodSec`; `pingpong` vai e volta (0→1→0) sem salto. */
export function loopProgress(frame: number, fps: number, periodSec: number, pingpong = false): number {
  if (!(periodSec > 0)) return 0;
  const phase = (((frame / fps) % periodSec) + periodSec) % periodSec / periodSec;
  return pingpong ? 1 - Math.abs(2 * phase - 1) : phase;
}

/** Mola física (overshoot e assentamento) a partir de `delaySec`; 0 antes, tende a 1 depois. */
export function springAt(
  frame: number,
  fps: number,
  delaySec = 0,
  config: { damping?: number; stiffness?: number; mass?: number } = { damping: 12, stiffness: 120, mass: 0.8 },
): number {
  const local = frame - delaySec * fps;
  return local <= 0 ? 0 : spring({ frame: local, fps, config });
}

/** Ruído suave e determinístico em [-amplitude, amplitude]: movimento orgânico sem `Math.random`. */
export function wobble(frame: number, fps: number, seed: string | number, amplitude = 1, speedHz = 0.5): number {
  return noise2D(String(seed), (frame / fps) * speedHz, 0) * amplitude;
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
