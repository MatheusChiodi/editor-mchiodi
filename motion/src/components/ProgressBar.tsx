import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { decimalsFor } from './BarChart';
import { cardSurface, rise, status } from './c1-kit';
import { clamp01, sweep } from './c3-kit';
import { formatPtBr } from './Counter';
import type { ComponentEntry } from './registry';
import { wrapLines } from './SectionTitle';

export interface ProgressBarProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  steps?: string[];
}

/** Quanto da barra enche (0–1). `max` inválido ou não positivo esvazia a barra em vez de dividir por zero. */
export function progressFraction(value: number, max = 100): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  return clamp01(value / max);
}

/** Posição (0–1) de cada marco: o primeiro no início, o último no fim; um único marco fica no fim. */
export function stepPositions(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  return Array.from({ length: count }, (_, index) => index / (count - 1));
}

/** Quantos marcos a barra já alcançou. A tolerância evita que 1/3 "quase" chegue por erro de ponto flutuante. */
export function reachedSteps(fraction: number, positions: readonly number[]): number {
  return positions.filter((position) => fraction >= position - 1e-6).length;
}

const STEP_FONT = 26;
const STEP_LINE = 33;
const STEP_MAX_LINES = 3;

/** Linhas que a faixa de rótulos precisa reservar (1 a 3): o rótulo mais longo decide; o que passar disso é truncado. */
export function stepLabelLines(steps: readonly string[], labelWidth: number): number {
  // Inter 600/800 a 26 px ocupa em média ~15 px por caractere
  const maxChars = Math.max(1, Math.floor(labelWidth / (STEP_FONT * 0.58)));
  const lines = Math.max(1, ...steps.map((step) => wrapLines(step, maxChars).length));
  return Math.min(STEP_MAX_LINES, lines);
}

const INNER_WIDTH = 860;
const TRACK_HEIGHT = 24;
const FILL_START = 0.35;
const FILL_SEC = 1.3;

export const ProgressBar: React.FC<ProgressBarProps & BaseProps> = ({ label, value: amount, max = 100, unit, steps = [], durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const fraction = progressFraction(amount, max);
  const grow = sweep(frame / fps, FILL_START, FILL_START + FILL_SEC);
  const filled = fraction * grow;
  const positions = stepPositions(steps.length);
  const reached = reachedSteps(filled, positions);
  const decimals = decimalsFor([amount, max]);
  const stepWidth = steps.length > 0 ? (INNER_WIDTH / steps.length) * 0.94 : 0;
  const stepHeight = stepLabelLines(steps, stepWidth) * STEP_LINE;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          width: INNER_WIDTH,
          boxSizing: 'content-box',
          padding: '40px 52px 44px',
          opacity: value,
          translate: `${(1 - enter) * 64 + exit * 28}px 0`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontFamily: theme.font.display,
                fontWeight: 600,
                fontSize: 42,
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
                color: theme.color.ink,
                overflowWrap: 'anywhere',
              }}
            >
              {label}
            </div>
            {unit ? (
              <div
                style={{
                  ...rise(progressAt(frame, fps, 0.3)),
                  fontFamily: theme.font.body,
                  fontWeight: 500,
                  fontSize: 28,
                  lineHeight: 1.25,
                  fontVariantNumeric: 'tabular-nums',
                  color: theme.color.slate600,
                }}
              >
                {`${formatPtBr(Math.min(amount, max) * grow, decimals)} de ${formatPtBr(max, decimals)} ${unit}`}
              </div>
            ) : null}
          </div>
          <div
            style={{
              flexShrink: 0,
              fontFamily: theme.font.body,
              fontWeight: 800,
              fontSize: 76,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              color: theme.color.ink,
            }}
          >
            {Math.round(filled * 100)}
            <span style={{ fontSize: '0.5em', marginLeft: '0.06em', color: theme.color.slate600 }}>%</span>
          </div>
        </div>
        <div
          style={{
            position: 'relative',
            height: TRACK_HEIGHT,
            marginTop: 28,
            borderRadius: theme.radius.pill,
            background: 'rgba(203, 213, 225, 0.55)',
          }}
        >
          {filled > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                // nunca mais estreita que a altura: abaixo disso a pílula deforma
                width: Math.max(TRACK_HEIGHT, filled * INNER_WIDTH),
                height: TRACK_HEIGHT,
                borderRadius: theme.radius.pill,
                background: theme.color.coral,
              }}
            />
          ) : null}
          {positions.map((position, index) => {
            // marcos das pontas ficam dentro da barra, não pendurados para fora
            const left = TRACK_HEIGHT / 2 + position * (INNER_WIDTH - TRACK_HEIGHT);
            const done = index < reached;
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: left - 6,
                  top: TRACK_HEIGHT / 2 - 6,
                  width: 12,
                  height: 12,
                  borderRadius: theme.radius.pill,
                  background: done ? theme.color.white : status.slate500,
                  opacity: done ? 1 : 0.55,
                }}
              />
            );
          })}
        </div>
        {steps.length > 0 ? (
          <div style={{ position: 'relative', height: stepHeight, marginTop: 14 }}>
            {steps.map((step, index) => {
              const position = positions[index]!;
              const edge = steps.length === 1 || index === steps.length - 1 ? 'end' : index === 0 ? 'start' : 'middle';
              const done = index < reached;
              return (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: position * INNER_WIDTH,
                    width: stepWidth,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: STEP_MAX_LINES,
                    overflow: 'hidden',
                    translate: edge === 'start' ? '0 0' : edge === 'end' ? '-100% 0' : '-50% 0',
                    textAlign: edge === 'start' ? 'left' : edge === 'end' ? 'right' : 'center',
                    fontFamily: theme.font.body,
                    fontWeight: done ? 800 : 600,
                    fontSize: STEP_FONT,
                    lineHeight: `${STEP_LINE}px`,
                    color: done ? theme.color.ink : status.slate500,
                  }}
                >
                  {step}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: ProgressBar,
  sample: {
    label: 'Migração para TypeScript',
    value: 340,
    max: 500,
    unit: 'arquivos',
    steps: ['Configurar', 'Utils', 'Componentes', 'Strict'],
  },
  defaultDuration: 5,
  vertical: { zone: 'top' },
  description: 'Mostra o quanto de algo já foi feito (migração, cobertura, etapa do tutorial), com marcos opcionais.',
};
