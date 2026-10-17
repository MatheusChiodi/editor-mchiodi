import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { decimalsFor, formatBarValue } from './BarChart';
import { cardSurface, rise } from './c1-kit';
import { sweep, tone } from './c3-kit';
import type { ComponentEntry } from './registry';

export interface Slice {
  label: string;
  value: number;
  highlight?: boolean;
}

export interface PieChartProps {
  title?: string;
  slices: Slice[];
  donut?: boolean;
  unit?: string;
}

export interface Arc {
  /** onde a fatia começa, em fração da volta (0 = 12h, sentido horário) */
  start: number;
  /** tamanho da fatia, em fração da volta */
  fraction: number;
}

const positive = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** Soma dos valores válidos (negativos e inválidos contam como 0). */
export function sliceTotal(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + positive(value), 0);
}

/** Início e tamanho de cada fatia em fração da volta. Conjunto vazio ou zerado não desenha nada. */
export function sliceArcs(values: readonly number[]): Arc[] {
  const total = sliceTotal(values);
  let start = 0;
  return values.map((value) => {
    const fraction = total === 0 ? 0 : positive(value) / total;
    const arc = { start, fraction };
    start += fraction;
    return arc;
  });
}

/** Quanto da fatia já apareceu quando o desenho da volta inteira está em `progress` (0–1). */
export function visibleFraction(arc: Arc, progress: number): number {
  return Math.min(arc.fraction, Math.max(0, progress - arc.start));
}

const NEUTRALS = [tone.slate800, theme.color.slate600, tone.slate400, theme.color.slate300] as const;

/** Coral só na fatia destacada; as demais percorrem os tons de slate, do mais escuro ao mais claro. */
export function sliceColors(highlights: readonly boolean[]): string[] {
  let neutral = 0;
  return highlights.map((highlight) => (highlight ? theme.color.coral : NEUTRALS[neutral++ % NEUTRALS.length]!));
}

/** Participação em porcentagem inteira; fatia que existe mas arredondaria para zero vira "<1%". */
export function formatShare(fraction: number): string {
  if (fraction > 0 && fraction < 0.005) return '<1%';
  return `${Math.round(fraction * 100)}%`;
}

/** Corpo do total no centro da rosca: o furo tem ~200 px de largura útil. */
export function totalFontSize(text: string): number {
  if (text.length <= 5) return 58;
  if (text.length <= 7) return 46;
  return 34;
}

const SIZE = 320;
const OUTER = 152;
const DONUT_STROKE = 46;
const DRAW_START = 0.3;
const DRAW_SEC = 1.3;

export const PieChart: React.FC<PieChartProps & BaseProps> = ({ title, slices, donut = false, unit, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const values = slices.map((slice) => slice.value);
  const arcs = sliceArcs(values);
  const colors = sliceColors(slices.map((slice) => slice.highlight === true));
  const decimals = decimalsFor(values);
  const total = sliceTotal(values);
  const draw = sweep(frame / fps, DRAW_START, DRAW_START + DRAW_SEC);

  // pizza cheia = traço com a largura do raio inteiro, desenhado na metade do raio
  const strokeWidth = donut ? DONUT_STROKE : OUTER;
  const radius = OUTER - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const drawable = arcs.filter((arc) => arc.fraction > 0).length;
  const gap = drawable > 1 ? (donut ? 5 : 2.5) : 0;
  const totalText = formatBarValue(total * draw, decimals, unit);
  const finalTotalText = formatBarValue(total, decimals, unit);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          gap: 30,
          width: 860,
          boxSizing: 'content-box',
          padding: '44px 52px 48px',
          opacity: value,
          translate: `${(1 - enter) * 64 + exit * 28}px 0`,
        }}
      >
        {title ? (
          <div
            style={{
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
          <div style={{ position: 'relative', flexShrink: 0, width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              {donut ? (
                <circle cx={SIZE / 2} cy={SIZE / 2} r={radius} fill="none" stroke={theme.color.slate300} strokeOpacity={0.35} strokeWidth={strokeWidth} />
              ) : null}
              {arcs.map((arc, index) => {
                const length = visibleFraction(arc, draw) * circumference - gap;
                if (length <= 0) return null;
                return (
                  <circle
                    key={index}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={radius}
                    fill="none"
                    stroke={colors[index]}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${length} ${circumference}`}
                    transform={`rotate(${-90 + arc.start * 360} ${SIZE / 2} ${SIZE / 2})`}
                  />
                );
              })}
            </svg>
            {donut ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.font.body,
                    fontWeight: 800,
                    fontSize: totalFontSize(finalTotalText),
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    color: theme.color.ink,
                  }}
                >
                  {totalText}
                </div>
                <div
                  style={{
                    fontFamily: theme.font.body,
                    fontWeight: 600,
                    fontSize: 22,
                    lineHeight: 1.2,
                    letterSpacing: '0.3em',
                    marginRight: '-0.3em',
                    textTransform: 'uppercase',
                    color: theme.color.slate600,
                  }}
                >
                  Total
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {slices.map((slice, index) => {
              const arc = arcs[index]!;
              // a linha da legenda entra quando a fatia dela começa a ser desenhada
              const shown = progressAt(frame, fps, DRAW_START + arc.start * DRAW_SEC * 0.8);
              return (
                <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, ...rise(shown, 10) }}>
                  <div
                    style={{
                      flexShrink: 0,
                      width: 20,
                      height: 20,
                      marginTop: 8,
                      borderRadius: 6,
                      background: colors[index],
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontFamily: theme.font.body,
                      fontWeight: slice.highlight ? 800 : 600,
                      fontSize: 28,
                      lineHeight: 1.25,
                      color: slice.highlight ? theme.color.ink : theme.color.slate600,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {slice.label}
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 2,
                      fontFamily: theme.font.body,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 30, lineHeight: 1.2, color: theme.color.ink }}>
                      {unit === '%' ? formatBarValue(slice.value, decimals, unit) : formatShare(arc.fraction)}
                    </div>
                    {unit === '%' ? null : (
                      <div style={{ fontWeight: 500, fontSize: 24, lineHeight: 1.2, color: theme.color.slate600 }}>
                        {formatBarValue(slice.value, decimals, unit)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: PieChart,
  sample: {
    title: 'Para onde vai o tempo do dev',
    unit: 'h',
    donut: true,
    slices: [
      { label: 'Lendo código', value: 21, highlight: true },
      { label: 'Escrevendo código', value: 9 },
      { label: 'Reuniões', value: 6 },
      { label: 'Deploy e incidentes', value: 4 },
    ],
  },
  defaultDuration: 6,
  vertical: { zone: 'full' },
  description: 'Mostra como um todo se divide (2 a 5 fatias) quando a fala cita proporções, com a fatia que importa em coral.',
};
