import { useCurrentFrame, useVideoConfig } from 'remotion';

import { counterValue, formatPtBr } from '../components/Counter';
import { theme } from '../theme';

export interface CounterProps {
  to: number;
  from?: number;
  /** segundo (relativo à cena) em que a contagem começa */
  atSec?: number;
  durationSec?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  fontSize?: number;
  color?: string;
}

/** Número que conta até o valor final, para compor dentro de uma cena (o componente `Counter` da biblioteca é o cartão pronto). */
export const Counter: React.FC<CounterProps> = ({
  to,
  from = 0,
  atSec = 0,
  durationSec = 1.2,
  decimals = 0,
  prefix = '',
  suffix = '',
  fontSize = 120,
  color = theme.color.slate900,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const value = counterValue(frame, fps, from, to, atSec, durationSec);
  return (
    <span
      style={{
        fontFamily: theme.font.body,
        fontWeight: 800,
        fontSize,
        lineHeight: 1,
        letterSpacing: '-0.035em',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        color,
      }}
    >
      {prefix}
      {formatPtBr(value, decimals)}
      {suffix}
    </span>
  );
};
