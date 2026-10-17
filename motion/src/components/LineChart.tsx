import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { decimalsFor, formatBarValue } from './BarChart';
import { cardSurface, status } from './c1-kit';
import { sweep } from './c3-kit';
import type { ComponentEntry } from './registry';

export interface LineChartProps {
  title?: string;
  points: { x: string; y: number }[];
  unit?: string;
  highlightLast?: boolean;
}

export interface PlotPoint {
  x: number;
  y: number;
}

/**
 * Faixa do eixo Y. Parte do zero quando os dados chegam perto dele (a altura da linha vira proporção real);
 * série que oscila longe do zero ganha uma folga embaixo para a variação não ficar achatada.
 */
export function lineDomain(values: readonly number[]): { min: number; max: number } {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 1 };
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  if (low === high) return { min: low - 1, max: high + 1 };
  if (low >= 0 && low <= high * 0.6) return { min: 0, max: high };
  return { min: low - (high - low) * 0.15, max: high };
}

/** Pontos em pixels dentro de uma área `width`×`height` (Y cresce para baixo, como no SVG). */
export function plotPoints(values: readonly number[], width: number, height: number, domain = lineDomain(values)): PlotPoint[] {
  const span = domain.max - domain.min || 1;
  return values.map((value, index) => {
    const safe = Number.isFinite(value) ? value : domain.min;
    return {
      x: values.length === 1 ? width / 2 : (index * width) / (values.length - 1),
      y: height - ((safe - domain.min) / span) * height,
    };
  });
}

const round = (value: number) => Math.round(value * 100) / 100;

export function linePath(points: readonly PlotPoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`).join(' ');
}

/** Área sob a linha, fechada na base. */
export function areaPath(points: readonly PlotPoint[], baseY: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return '';
  return `${linePath(points)} L${round(last.x)} ${round(baseY)} L${round(first.x)} ${round(baseY)} Z`;
}

/** Ponto sobre a linha depois de percorrer a fração `t` do comprimento dela: é a "ponta" do traço. */
export function pointAtProgress(points: readonly PlotPoint[], t: number): PlotPoint {
  const first = points[0];
  if (!first) return { x: 0, y: 0 };
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y));
  let remaining = Math.min(1, Math.max(0, t)) * lengths.reduce((sum, length) => sum + length, 0);
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]!;
    const from = points[index]!;
    const to = points[index + 1]!;
    if (remaining <= length) {
      const ratio = length === 0 ? 0 : remaining / length;
      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
    }
    remaining -= length;
  }
  return points[points.length - 1]!;
}

/** Índices dos rótulos do eixo X: no máximo `max`, sempre com o primeiro e o último. */
export function tickIndexes(count: number, max = 5): number[] {
  if (count <= 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, index) => index);
  const picked = Array.from({ length: max }, (_, index) => Math.round((index * (count - 1)) / (max - 1)));
  return [...new Set(picked)];
}

/** Largura da coluna dos rótulos do eixo Y: acompanha o rótulo mais longo (≈14,5 px por caractere a 24 px). */
export function gutterWidth(labels: readonly string[]): number {
  const longest = Math.max(0, ...labels.map((label) => label.length));
  return Math.min(230, Math.max(80, Math.round(longest * 14.5 + 30)));
}

/** O eixo não precisa de casas decimais quando a faixa é larga: "39 mil" lê melhor que "38,5 mil". */
export function axisDecimals(domain: { min: number; max: number }, decimals: number): number {
  return domain.max - domain.min >= 10 ? 0 : decimals;
}

const CHART_WIDTH = 904;
const PLOT_HEIGHT = 310;
const TOP = 74;
const RIGHT = 26;
const BOTTOM = 58;
const DRAW_START = 0.4;
const DRAW_SEC = 1.5;

const axisText = { fontFamily: theme.font.body, fontWeight: 600, fontSize: 24, fill: status.slate500 } as const;

export const LineChart: React.FC<LineChartProps & BaseProps> = ({ title, points, unit, highlightLast = true, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const values = points.map((point) => point.y);
  const domain = lineDomain(values);
  const decimals = decimalsFor(values);
  const grid = [domain.max, (domain.max + domain.min) / 2, domain.min];
  const gridLabels = grid.map((level) => formatBarValue(level, axisDecimals(domain, decimals), unit));
  const gutter = gutterWidth(gridLabels);
  const plotWidth = CHART_WIDTH - gutter;
  const plot = plotPoints(values, plotWidth, PLOT_HEIGHT, domain);
  const draw = sweep(frame / fps, DRAW_START, DRAW_START + DRAW_SEC);
  const tip = pointAtProgress(plot, draw);
  const last = plot[plot.length - 1];
  const lastValue = values[values.length - 1];
  const badge = progressAt(frame, fps, DRAW_START + DRAW_SEC - 0.15);
  const axis = progressAt(frame, fps, 0.2);
  const width = gutter + plotWidth + RIGHT;
  const height = TOP + PLOT_HEIGHT + BOTTOM;
  const ticks = tickIndexes(points.length);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          width,
          boxSizing: 'content-box',
          padding: '44px 52px 36px 40px',
          opacity: value,
          translate: `${(1 - enter) * 64 + exit * 28}px 0`,
        }}
      >
        {title ? (
          <div
            style={{
              paddingLeft: 12,
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
        <div style={{ position: 'relative', width, height }}>
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id="mce-line-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={theme.color.slate600} stopOpacity={0.3} />
                <stop offset="1" stopColor={theme.color.slate600} stopOpacity={0} />
              </linearGradient>
              {/* a área aparece junto com a ponta do traço */}
              <clipPath id="mce-line-reveal">
                <rect x={0} y={-TOP} width={tip.x} height={height} />
              </clipPath>
            </defs>
            <g opacity={axis}>
              {grid.map((_, index) => {
                const y = TOP + (index * PLOT_HEIGHT) / (grid.length - 1);
                const baseline = index === grid.length - 1;
                return (
                  <g key={index}>
                    <line
                      x1={gutter}
                      x2={gutter + plotWidth}
                      y1={y}
                      y2={y}
                      stroke={theme.color.slate300}
                      strokeWidth={baseline ? 2.5 : 1.5}
                      strokeDasharray={baseline ? undefined : '3 9'}
                      strokeLinecap="round"
                    />
                    <text x={gutter - 18} y={y + 8} textAnchor="end" style={{ ...axisText, fontVariantNumeric: 'tabular-nums' }}>
                      {gridLabels[index]}
                    </text>
                  </g>
                );
              })}
              {ticks.map((index) => {
                const point = plot[index]!;
                const anchor = points.length === 1 ? 'middle' : index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle';
                return (
                  <text key={index} x={gutter + point.x} y={TOP + PLOT_HEIGHT + 42} textAnchor={anchor} style={axisText}>
                    {points[index]!.x}
                  </text>
                );
              })}
            </g>
            <g transform={`translate(${gutter} ${TOP})`}>
              <path d={areaPath(plot, PLOT_HEIGHT)} fill="url(#mce-line-area)" clipPath="url(#mce-line-reveal)" />
              {draw > 0 && plot.length > 1 ? (
                <path
                  d={linePath(plot)}
                  fill="none"
                  stroke={theme.color.ink}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - draw}
                />
              ) : null}
              {draw > 0 || plot.length === 1 ? (
                <circle
                  cx={tip.x}
                  cy={tip.y}
                  r={highlightLast ? 11 : 8}
                  fill={highlightLast ? theme.color.coral : theme.color.ink}
                  stroke={theme.color.paper}
                  strokeWidth={5}
                />
              ) : null}
            </g>
          </svg>
          {highlightLast && last && lastValue !== undefined ? (
            <div
              style={{
                position: 'absolute',
                right: RIGHT - 14,
                // acima do último ponto; a folga do topo garante espaço mesmo quando ele é o máximo
                top: TOP + last.y - 68,
                padding: '8px 20px',
                borderRadius: theme.radius.pill,
                background: theme.color.ink,
                color: theme.color.white,
                fontFamily: theme.font.body,
                fontWeight: 800,
                fontSize: 30,
                lineHeight: 1.2,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                opacity: badge,
                translate: `0 ${(1 - badge) * 10}px`,
              }}
            >
              {formatBarValue(lastValue, decimals, unit)}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: LineChart,
  sample: {
    title: 'Estrelas do repositório no GitHub',
    unit: 'mil',
    points: [
      { x: '2021', y: 12 },
      { x: '2022', y: 19 },
      { x: '2023', y: 31 },
      { x: '2024', y: 48 },
      { x: '2025', y: 77 },
    ],
  },
  defaultDuration: 6,
  description: 'Mostra a evolução de um número ao longo do tempo quando a fala fala de crescimento, queda ou tendência.',
};
