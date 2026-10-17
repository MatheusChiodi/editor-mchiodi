import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { formatPtBr } from './Counter';
import type { ComponentEntry } from './registry';

export interface Bar {
  label: string;
  value: number;
  highlight?: boolean;
}

export interface BarChartProps {
  title?: string;
  bars: Bar[];
  unit?: string;
}

/** Largura de cada barra em relação à maior (0–1). Valores negativos ou inválidos viram 0. */
export function barWidths(values: readonly number[]): number[] {
  const safe = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(0, ...safe);
  return safe.map((value) => (max === 0 ? 0 : value / max));
}

/** Casas decimais necessárias para mostrar todos os valores sem arredondar (até 2). */
export function decimalsFor(values: readonly number[]): number {
  return values.reduce((most, value) => {
    const fraction = String(Math.round(Math.abs(value) * 100) / 100).split('.')[1];
    return Math.max(most, fraction?.length ?? 0);
  }, 0);
}

/** "87%" colado, "120 ms" com espaço: só símbolos de um caractere encostam no número. */
export function formatBarValue(value: number, decimals: number, unit?: string): string {
  const text = formatPtBr(value, decimals);
  if (!unit) return text;
  return unit.length === 1 ? `${text}${unit}` : `${text} ${unit}`;
}

const INNER_WIDTH = 760;
const BAR_HEIGHT = 34;
const VALUE_GAP = 16;
const START = 0.3;

export const BarChart: React.FC<BarChartProps & BaseProps> = ({ title, bars, unit, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const values = bars.map((bar) => bar.value);
  const widths = barWidths(values);
  const decimals = decimalsFor(values);
  // a barra mais longa precisa deixar espaço para o valor dela na mesma linha
  const longest = Math.max(0, ...values.map((item) => formatBarValue(item, decimals, unit).length));
  const maxBar = INNER_WIDTH - VALUE_GAP - Math.max(90, longest * 20);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          width: INNER_WIDTH,
          boxSizing: 'content-box',
          padding: '44px 52px 50px',
          background: theme.color.paper,
          borderRadius: theme.radius.card,
          boxShadow: theme.shadow.raised,
          opacity: value,
          translate: `${(1 - enter) * 64 + exit * 28}px 0`,
        }}
      >
        {title ? (
          <div
            style={{
              marginBottom: 6,
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: 44,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: theme.color.ink,
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </div>
        ) : null}
        {bars.map((bar, index) => {
          const start = stagger(index, 0.12, START);
          const grow = progressAt(frame, fps, start, motion.slow);
          const fade = progressAt(frame, fps, start, motion.fast);
          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: fade }}>
              <div
                style={{
                  fontFamily: theme.font.body,
                  fontWeight: bar.highlight ? 800 : 600,
                  fontSize: 28,
                  lineHeight: 1.25,
                  color: bar.highlight ? theme.color.ink : theme.color.slate600,
                  overflowWrap: 'anywhere',
                }}
              >
                {bar.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: VALUE_GAP }}>
                <div
                  style={{
                    flexShrink: 0,
                    // mínimo visível: valor zero ainda mostra onde a barra começa
                    width: Math.max(6, widths[index]! * maxBar * grow),
                    height: BAR_HEIGHT,
                    borderRadius: 8,
                    background: bar.highlight ? theme.color.coral : theme.color.slate600,
                  }}
                />
                <div
                  style={{
                    fontFamily: theme.font.body,
                    fontWeight: 800,
                    fontSize: 30,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    color: theme.color.ink,
                  }}
                >
                  {formatBarValue(bar.value * grow, decimals, unit)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: BarChart,
  sample: {
    title: 'Tempo de build do projeto',
    unit: 's',
    bars: [
      { label: 'Webpack', value: 38.4 },
      { label: 'Rollup', value: 21.7 },
      { label: 'Vite', value: 4.2, highlight: true },
    ],
  },
  defaultDuration: 6,
  vertical: { zone: 'full' },
  description: 'Compara poucos valores citados na fala (2 a 5 barras), destacando o que importa em coral.',
};
