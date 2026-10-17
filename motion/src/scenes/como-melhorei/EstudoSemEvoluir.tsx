import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, enter, Pill, rise, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';

export interface EstudoSemEvoluirProps {
  /** segundos relativos ao início da cena */
  revealAt?: {
    /** cada "estudo" da fala empilha mais uma coluna de horas */
    study1: number;
    study2: number;
    study3: number;
    study4: number;
    /** "não vejo nada evoluindo": a linha de evolução se desenha reta e entra o rótulo */
    flat: number;
  };
  eyebrow?: string;
  title?: string;
  studyLabel?: string;
  evolutionLabel?: string;
  /** rótulo de cada coluna */
  stepLabel?: string;
  /** rótulo em coral no fim da linha parada */
  flatLabel?: string;
  /** horas (ilustrativas) somadas ao contador a cada "estudo" */
  hoursPerStudy?: number;
  hoursCaption?: string;
}

const DEFAULT_REVEAL = { study1: 1.6, study2: 2.1, study3: 2.6, study4: 3.1, flat: 4.2 };
const CARD_PADDING = 44;
/** atraso entre os blocos de uma mesma coluna (s) */
export const BLOCK_STAGGER = 0.06;

/** Os quatro "estudo" na ordem da fala. */
export function studyTimes(revealAt: NonNullable<EstudoSemEvoluirProps['revealAt']>): number[] {
  return [revealAt.study1, revealAt.study2, revealAt.study3, revealAt.study4];
}

export interface StudyColumn {
  x: number;
  center: number;
  /** y do topo de cada bloco, do de baixo para o de cima */
  blocks: number[];
}

export interface StudyLayout {
  width: number;
  height: number;
  labelWidth: number;
  chart: { x: number; width: number };
  column: { width: number; gap: number };
  block: { height: number; gap: number };
  /** y da base das colunas (e altura da pilha mais alta) */
  baseline: number;
  /** y do rótulo embaixo de cada coluna */
  stepLabelY: number;
  dividerY: number;
  /** y da linha de evolução: constante, é a piada da cena */
  evolutionY: number;
  side: { x: number; width: number };
  columns: StudyColumn[];
}

/** Gráfico da cena: a coluna i tem i+1 blocos (as horas acumulam); embaixo, a faixa da evolução, sempre na mesma altura. */
export function studyLayout(width = 1548, steps = 4): StudyLayout {
  const labelWidth = 290;
  const sideWidth = 420;
  const chartX = labelWidth + 20;
  const chartWidth = width - chartX - sideWidth - 30;
  const gap = 28;
  const columnWidth = (chartWidth - gap * (steps - 1)) / steps;
  const block = { height: 64, gap: 10 };
  const baseline = steps * block.height + (steps - 1) * block.gap;
  const stepLabelY = baseline + 14;
  const dividerY = stepLabelY + 34 * 1.2 + 26;
  const evolutionY = dividerY + 76;
  const columns: StudyColumn[] = Array.from({ length: steps }, (_, i) => {
    const x = chartX + i * (columnWidth + gap);
    return {
      x,
      center: x + columnWidth / 2,
      blocks: Array.from({ length: i + 1 }, (_, j) => baseline - (j + 1) * block.height - j * block.gap),
    };
  });
  return {
    width,
    height: evolutionY + 60,
    labelWidth,
    chart: { x: chartX, width: chartWidth },
    column: { width: columnWidth, gap },
    block,
    baseline,
    stepLabelY,
    dividerY,
    evolutionY,
    side: { x: chartX + chartWidth + 30, width: sideWidth },
    columns,
  };
}

/** Segundo em que o bloco `blockIndex` (0 = o de baixo) da coluna começa a cair. */
export function blockDelay(columnStart: number, blockIndex: number, stagger: number = BLOCK_STAGGER): number {
  return columnStart + blockIndex * stagger;
}

/** Horas acumuladas no instante `timeSec`: cada estudo soma `hoursPerStudy` ao longo de `rampSec`. */
export function studyHours(timeSec: number, starts: number[], hoursPerStudy = 10, rampSec = 0.4): number {
  const total = starts.reduce((sum, start) => sum + Math.max(0, Math.min(1, (timeSec - start) / rampSec)) * hoursPerStudy, 0);
  return Math.round(total);
}

export function formatHours(hours: number): string {
  return `${hours} h`;
}

const laneTitle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  fontFamily: theme.font.display,
  fontWeight: 600,
  fontSize: text.cardTitle,
  lineHeight: 1,
  color: theme.color.slate900,
};

/** "Estudo, estudo, estudo, estudo, mas não vejo nada evoluindo": as horas empilham e a linha da evolução não sai do lugar. */
export const EstudoSemEvoluir: React.FC<EstudoSemEvoluirProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  eyebrow = 'Aquela sensação',
  title = 'Estudo sem ver resultado.',
  studyLabel = 'Estudo',
  evolutionLabel = 'Evolução',
  stepLabel = 'estudo',
  flatLabel = 'nada evoluindo',
  hoursPerStudy = 10,
  hoursCaption = 'de estudo',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = studyLayout();
  const starts = studyTimes(revealAt);
  const cardAt = Math.max(0, Math.min(0.6, starts[0]! - 0.6));
  const card = enter(frame, fps, cardAt, 0.5);
  const flat = enter(frame, fps, revealAt.flat, 0.8);
  const hours = studyHours(frame / fps, starts, hoursPerStudy);
  const lineEnd = layout.chart.x + layout.chart.width;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44 }}>
      <Statement text={title} eyebrow={eyebrow} fontSize={80} />
      <SceneCard progress={card} padding={CARD_PADDING} width={layout.width + CARD_PADDING * 2 + 4}>
        <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
          <div style={{ ...laneTitle, top: layout.baseline - text.cardTitle, ...rise(enter(frame, fps, cardAt + 0.15), 16) }}>{studyLabel}</div>
          <div style={{ ...laneTitle, top: layout.evolutionY - text.cardTitle / 2, ...rise(enter(frame, fps, cardAt + 0.25), 16) }}>{evolutionLabel}</div>

          {/* chão das colunas e divisória entre as duas faixas */}
          <div style={{ position: 'absolute', left: layout.chart.x, width: layout.chart.width, top: layout.baseline + 4, height: 2, background: theme.color.slate300, opacity: card }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: layout.dividerY, height: 2, background: alpha(theme.color.slate300, 0.6), opacity: card }} />

          {layout.columns.map((column, i) => {
            const start = starts[i]!;
            return (
              <div key={column.x}>
                {column.blocks.map((y, j) => {
                  const progress = enter(frame, fps, blockDelay(start, j), 0.4);
                  return (
                    <div
                      key={y}
                      style={{
                        position: 'absolute',
                        left: column.x,
                        top: y,
                        width: layout.column.width,
                        height: layout.block.height,
                        borderRadius: theme.radius.panel,
                        // cada coluna mais escura que a anterior: o esforço cresce
                        background: alpha(theme.color.slate900, 0.3 + (0.7 * (i + 1)) / layout.columns.length),
                        opacity: progress,
                        translate: `0px ${((progress - 1) * 44).toFixed(2)}px`,
                      }}
                    />
                  );
                })}
                <div
                  style={{
                    position: 'absolute',
                    left: column.x,
                    width: layout.column.width,
                    top: layout.stepLabelY,
                    textAlign: 'center',
                    fontFamily: theme.font.body,
                    fontWeight: 500,
                    fontSize: 34,
                    lineHeight: 1.2,
                    color: theme.color.slate600,
                    ...rise(enter(frame, fps, start + 0.1), 12),
                  }}
                >
                  {stepLabel}
                </div>
              </div>
            );
          })}

          {/* contador de horas: sobe a cada "estudo" */}
          <div
            style={{
              position: 'absolute',
              left: layout.side.x,
              width: layout.side.width,
              bottom: layout.height - layout.baseline,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              paddingLeft: 24,
              boxSizing: 'border-box',
              ...rise(enter(frame, fps, starts[0]!), 16),
            }}
          >
            <span
              style={{
                fontFamily: theme.font.body,
                fontWeight: 800,
                fontSize: 128,
                lineHeight: 1,
                letterSpacing: '-0.035em',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                color: theme.color.slate900,
              }}
            >
              {formatHours(hours)}
            </span>
            <span style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: text.label, lineHeight: 1.2, color: theme.color.slate600 }}>{hoursCaption}</span>
          </div>

          {/* trilho apagado desde o início; em `flat` a linha se desenha por cima, reta */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none" strokeLinecap="round">
            <line
              x1={layout.chart.x}
              x2={lineEnd}
              y1={layout.evolutionY}
              y2={layout.evolutionY}
              stroke={theme.color.slate300}
              strokeWidth={4}
              strokeDasharray="2 16"
              opacity={card}
            />
            <line
              x1={layout.chart.x}
              x2={layout.chart.x + layout.chart.width * flat}
              y1={layout.evolutionY}
              y2={layout.evolutionY}
              stroke={theme.color.slate900}
              strokeWidth={6}
              opacity={flat > 0 ? 1 : 0}
            />
            {layout.columns.map((column) => {
              const reached = flat * layout.chart.width >= column.center - layout.chart.x ? 1 : 0;
              return <circle key={column.x} cx={column.center} cy={layout.evolutionY} r={11} fill={theme.color.paper} stroke={theme.color.slate900} strokeWidth={5} opacity={reached} />;
            })}
            <circle cx={layout.chart.x + layout.chart.width * flat} cy={layout.evolutionY} r={13} fill={theme.color.coral} opacity={flat > 0 ? 1 : 0} />
          </svg>

          <div style={{ position: 'absolute', left: layout.side.x + 24, top: layout.evolutionY, height: 0, display: 'flex', alignItems: 'center' }}>
            <Pill variant="coral" dot progress={enter(frame, fps, revealAt.flat + 0.45)}>
              {flatLabel}
            </Pill>
          </div>
        </div>
      </SceneCard>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: EstudoSemEvoluir,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 5.6,
  description:
    'Cena papel: muito estudo e nenhuma evolução. Quatro colunas de horas empilham (uma a cada "estudo" da fala) enquanto a linha de evolução se desenha reta, com o rótulo "nada evoluindo".',
};

export const MODEL = 'ColunasComLinhaParada';
