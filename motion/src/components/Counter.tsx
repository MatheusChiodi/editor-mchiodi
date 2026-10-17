import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface CounterProps {
  from?: number;
  to: number;
  prefix?: string;
  suffix?: string;
  label?: string;
  decimals?: number;
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Número no padrão pt-BR ("1.234.567,89"), sem depender do ICU da máquina que renderiza. */
export function formatPtBr(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(Math.max(0, decimals));
  const [integer = '0', fraction] = fixed.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const negative = value < 0 && Number(fixed) !== 0;
  return `${negative ? '-' : ''}${grouped}${fraction ? `,${fraction}` : ''}`;
}

/** Janela da contagem: começa logo após a entrada e termina com folga para ler o valor final. */
export function countWindow(totalSec: number): { startSec: number; durationSec: number } {
  return { startSec: 0.2, durationSec: Math.min(1.8, Math.max(0.6, totalSec * 0.4)) };
}

/** Valor mostrado no frame: sai de `from`, desacelera e para exatamente em `to`. */
export function counterValue(frame: number, fps: number, from: number, to: number, startSec: number, durationSec: number): number {
  return interpolate(frame, [startSec * fps, (startSec + durationSec) * fps], [from, to], { ...clamp, easing: motion.enter });
}

const numberStyle: React.CSSProperties = {
  gridArea: '1 / 1',
  fontFamily: theme.font.body,
  fontWeight: 800,
  fontSize: 168,
  lineHeight: 1,
  letterSpacing: '-0.035em',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  color: theme.color.ink,
};

const affixStyle: React.CSSProperties = {
  fontSize: '0.5em',
  letterSpacing: '-0.01em',
  color: theme.color.coral,
};

export const Counter: React.FC<CounterProps & BaseProps> = ({ from = 0, to, prefix, suffix, label, decimals = 0, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const { startSec, durationSec } = countWindow(durationInFrames / fps);
  const current = counterValue(frame, fps, from, to, startSec, durationSec);
  const accent = progressAt(frame, fps, 0.1, motion.slow);
  const labelIn = progressAt(frame, fps, 0.25);

  const figure = (shown: number, hidden: boolean) => (
    <div style={{ ...numberStyle, visibility: hidden ? 'hidden' : 'visible' }}>
      {prefix ? <span style={{ ...affixStyle, marginRight: '0.12em' }}>{prefix}</span> : null}
      {formatPtBr(shown, decimals)}
      {suffix ? <span style={{ ...affixStyle, marginLeft: '0.08em' }}>{suffix}</span> : null}
    </div>
  );

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          maxWidth: 1100,
          padding: '44px 60px 48px',
          background: theme.color.paper,
          borderRadius: theme.radius.card,
          boxShadow: theme.shadow.raised,
          opacity: value,
          scale: String(0.94 + 0.06 * enter - 0.03 * exit),
          translate: `0 ${(1 - enter) * 28}px`,
          transformOrigin: 'right center',
        }}
      >
        <div
          style={{
            width: 72,
            height: 8,
            marginBottom: 26,
            borderRadius: theme.radius.pill,
            background: theme.color.coral,
            scale: `${accent} 1`,
            transformOrigin: 'left center',
          }}
        />
        {/* o maior dos extremos fica invisível por baixo e fixa a largura: o cartão não respira enquanto conta */}
        <div style={{ display: 'grid' }}>
          {figure(from, true)}
          {figure(to, true)}
          {figure(current, false)}
        </div>
        {label ? (
          <div
            style={{
              marginTop: 20,
              maxWidth: 760,
              fontFamily: theme.font.body,
              fontWeight: 500,
              fontSize: 34,
              lineHeight: 1.3,
              color: theme.color.slate600,
              opacity: labelIn,
              translate: `0 ${(1 - labelIn) * 12}px`,
              overflowWrap: 'anywhere',
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Counter,
  sample: {
    to: 2400000,
    suffix: '+',
    label: 'downloads semanais do React no npm',
  },
  defaultDuration: 4,
  vertical: { zone: 'top' },
  description: 'Dá peso a um número citado na fala, contando até o valor final.',
};
