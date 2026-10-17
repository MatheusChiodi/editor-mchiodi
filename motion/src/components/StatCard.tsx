import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { cardSurface, rise, status } from './c1-kit';
import { tone } from './c3-kit';
import type { ComponentEntry } from './registry';

export type Trend = 'up' | 'down' | 'flat';

export interface StatCardProps {
  value: string;
  label: string;
  delta?: string;
  trend?: Trend;
  caption?: string;
}

/** Sem `trend` explícito, o sinal da variação decide: "+12%" sobe, "-3 ms" (ou "−3") desce. */
export function resolveTrend(delta?: string, trend?: Trend): Trend {
  if (trend) return trend;
  const text = delta?.trim() ?? '';
  if (/^[-−–]\s*\d/.test(text)) return 'down';
  if (/^\+\s*\d/.test(text)) return 'up';
  return 'flat';
}

/** Cor do texto/ícone e do fundo da pílula de variação. Verde = melhorou, rose = piorou. */
export function trendTone(trend: Trend): { color: string; background: string } {
  if (trend === 'up') return { color: status.emeraldDeep, background: tone.emeraldWash };
  if (trend === 'down') return { color: status.rose, background: tone.roseWash };
  return { color: theme.color.slate600, background: tone.slate100 };
}

/** Corpo do número: quanto mais longo o valor, menor, para caber no cartão sem quebrar. */
export function statFontSize(value: string): number {
  const length = value.trim().length;
  if (length <= 5) return 156;
  if (length <= 8) return 124;
  if (length <= 12) return 92;
  return 68;
}

const ARROWS: Record<Trend, string[]> = {
  up: ['M7 17L17 7', 'M8 7h9v9'],
  down: ['M7 7l10 10', 'M17 8v9H8'],
  flat: ['M5 12h14', 'M13 6l6 6-6 6'],
};

export const StatCard: React.FC<StatCardProps & BaseProps> = ({ value: figure, label, delta, trend, caption, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const resolved = resolveTrend(delta, trend);
  const { color, background } = trendTone(resolved);
  const accent = progressAt(frame, fps, 0.1, motion.slow);
  const deltaIn = progressAt(frame, fps, 0.45);
  const arrow = progressAt(frame, fps, 0.55, 0.5);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          minWidth: 520,
          maxWidth: 900,
          padding: '44px 60px 48px',
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
            marginBottom: 24,
            borderRadius: theme.radius.pill,
            background: theme.color.coral,
            scale: `${accent} 1`,
            transformOrigin: 'left center',
          }}
        />
        <div
          style={{
            ...rise(progressAt(frame, fps, 0.15)),
            maxWidth: 780,
            fontFamily: theme.font.body,
            fontWeight: 600,
            fontSize: 34,
            lineHeight: 1.25,
            color: theme.color.slate600,
            overflowWrap: 'anywhere',
          }}
        >
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 28, rowGap: 12, marginTop: 10 }}>
          <div
            style={{
              ...rise(progressAt(frame, fps, 0.22), 18),
              fontFamily: theme.font.body,
              fontWeight: 800,
              fontSize: statFontSize(figure),
              lineHeight: 1.05,
              letterSpacing: '-0.035em',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              color: theme.color.ink,
            }}
          >
            {figure}
          </div>
          {delta ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px 10px 16px',
                borderRadius: theme.radius.pill,
                background,
                color,
                fontFamily: theme.font.body,
                fontWeight: 800,
                fontSize: 34,
                lineHeight: 1.2,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                opacity: deltaIn,
                scale: String(0.9 + 0.1 * deltaIn),
              }}
            >
              <svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                {arrow > 0
                  ? ARROWS[resolved].map((d) => <path key={d} d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arrow} />)
                  : null}
              </svg>
              {delta}
            </div>
          ) : null}
        </div>
        {caption ? (
          <div
            style={{
              ...rise(progressAt(frame, fps, 0.6)),
              marginTop: 18,
              maxWidth: 780,
              fontFamily: theme.font.body,
              fontWeight: 500,
              fontSize: 28,
              lineHeight: 1.3,
              color: theme.color.slate600,
              overflowWrap: 'anywhere',
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: StatCard,
  sample: {
    value: '2,4 mi',
    label: 'Downloads semanais do Vite no npm',
    delta: '+38%',
    trend: 'up',
    caption: 'Em relação ao mesmo período do ano passado.',
  },
  defaultDuration: 5,
  vertical: { zone: 'top' },
  description: 'Cartão de métrica: um número com contexto e a variação em relação a antes (verde melhorou, rose piorou).',
};
