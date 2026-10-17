import { useCurrentFrame, useVideoConfig } from 'remotion';

import { enter, popIn, rise } from './timing';

export interface RevealProps {
  /** segundo (relativo à cena) em que o filho aparece */
  atSec: number;
  durationSec?: number;
  distance?: number;
  /** entrada com overshoot curto: só para o destaque da cena */
  pop?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** Mostra o filho a partir de `atSec` com a entrada padrão do kit (sobe e aparece). */
export const Reveal: React.FC<RevealProps> = ({ atSec, durationSec, distance = 28, pop = false, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = enter(frame, fps, atSec, durationSec);
  const motionStyle = pop
    ? { opacity: progress, scale: String(0.8 + 0.2 * popIn(frame, fps, atSec, durationSec)) }
    : rise(progress, distance);
  return <div style={{ ...motionStyle, ...style }}>{children}</div>;
};
