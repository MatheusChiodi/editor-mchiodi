// MODELO de animação reutilizável: na EDL entra como `scene:modelos/ColunasComLinhaParada`, em qualquer vídeo.
// Forma: em cima, colunas de blocos cada vez mais altas (o esforço cresce); embaixo, uma linha que se desenha reta (o resultado não).

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { formatPtBr } from '../../components/Counter';
import { alpha, enter, Pill, rise, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';
import { CHAR, clampInt, CLIP, type Extent, fitFont, fitPill, MIN_TEXT, pillClamp, sequence, statementHeight, textWidth, timeOr, titleSize } from './kit-a';

export interface ColunasCounter {
  /** quanto cada coluna soma ao total (inteiro) */
  perStep: number;
  prefix?: string;
  suffix?: string;
  /** linha de apoio embaixo do número */
  caption?: string;
}

export interface ColunasComLinhaParadaProps {
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral (o rótulo da linha parada já leva o coral: evite os dois juntos) */
  accent?: string;
  /** nome da faixa de cima (o que cresce) */
  effortLabel?: string;
  /** nome da faixa de baixo (o que não sai do lugar) */
  resultLabel?: string;
  /** de 2 a 6 colunas: o rótulo embaixo de cada uma, na ordem da fala (texto vazio = coluna sem rótulo) */
  steps?: string[];
  /** segundo (relativo ao início da cena) em que cada coluna empilha, por índice; o que faltar segue em sequência */
  revealAt?: number[];
  /** segundo em que a linha de resultado se desenha, reta (padrão: depois da última coluna) */
  flatAt?: number;
  /** rótulo com o acento coral no fim da linha parada */
  flatLabel?: string;
  /** total que sobe a cada coluna, ao lado do gráfico (omitido = sem número) */
  counter?: ColunasCounter;
}

export const COLUNAS_MIN = 2;
export const COLUNAS_MAX = 6;
/** atraso entre os blocos de uma mesma coluna (s) */
export const COLUNAS_BLOCK_STAGGER = 0.06;
const CARD_PADDING = 44;
const SIDE_INSET = 24;

const DEFAULT_STEPS = ['etapa 1', 'etapa 2', 'etapa 3', 'etapa 4'];

export interface ColunasColumn {
  x: number;
  center: number;
  /** y do topo de cada bloco, do de baixo para o de cima */
  blocks: number[];
}

export interface ColunasLayout {
  width: number;
  height: number;
  labelWidth: number;
  chart: { x: number; width: number };
  column: { width: number; gap: number };
  block: { height: number; gap: number };
  /** y da base das colunas (e altura da pilha mais alta) */
  baseline: number;
  stepLabelY: number;
  dividerY: number;
  /** y da linha de resultado: constante, é o ponto da cena */
  resultY: number;
  side: { x: number; width: number };
  columns: ColunasColumn[];
}

/** Gráfico da cena: a coluna i tem i+1 blocos; os blocos encolhem para a pilha mais alta caber na mesma altura com 2 ou com 6 colunas. */
export function colunasLayout(steps = 4, width = 1548): ColunasLayout {
  const count = clampInt(steps, COLUNAS_MIN, COLUNAS_MAX);
  const labelWidth = 290;
  const sideWidth = 420;
  const chartX = labelWidth + 20;
  const chartWidth = width - chartX - sideWidth - 30;
  const gap = 28;
  const columnWidth = (chartWidth - gap * (count - 1)) / count;
  const blockGap = 10;
  const block = { height: Math.min(96, Math.floor((286 - blockGap * (count - 1)) / count)), gap: blockGap };
  const baseline = count * block.height + (count - 1) * block.gap;
  const stepLabelY = baseline + 14;
  const dividerY = stepLabelY + MIN_TEXT * 1.2 + 26;
  const resultY = dividerY + 76;
  const columns: ColunasColumn[] = Array.from({ length: count }, (_, i) => {
    const x = chartX + i * (columnWidth + gap);
    return { x, center: x + columnWidth / 2, blocks: Array.from({ length: i + 1 }, (_, j) => baseline - (j + 1) * block.height - j * block.gap) };
  });
  return {
    width,
    height: resultY + 60,
    labelWidth,
    chart: { x: chartX, width: chartWidth },
    column: { width: columnWidth, gap },
    block,
    baseline,
    stepLabelY,
    dividerY,
    resultY,
    side: { x: chartX + chartWidth + 30, width: sideWidth },
    columns,
  };
}

/** Segundo em que cada coluna começa a empilhar. */
export function colunasTimes(count: number, revealAt?: readonly number[]): number[] {
  return sequence(clampInt(count, COLUNAS_MIN, COLUNAS_MAX), revealAt, 1.6, 0.5);
}

/** Segundo em que o bloco `blockIndex` (0 = o de baixo) da coluna começa a cair. */
export function colunasBlockDelay(columnStart: number, blockIndex: number, stagger: number = COLUNAS_BLOCK_STAGGER): number {
  return columnStart + blockIndex * stagger;
}

/** Total acumulado no instante `timeSec`: cada coluna soma `perStep` ao longo de `rampSec`. */
export function colunasTotal(timeSec: number, starts: readonly number[], perStep = 1, rampSec = 0.4): number {
  return Math.round(starts.reduce((sum, start) => sum + Math.max(0, Math.min(1, (timeSec - start) / rampSec)) * perStep, 0));
}

export function colunasCounterText(value: number, counter: Pick<ColunasCounter, 'prefix' | 'suffix'>): string {
  return `${counter.prefix ?? ''}${formatPtBr(value)}${counter.suffix ?? ''}`;
}

/** Os rótulos das colunas só aparecem se o mais longo couber embaixo da coluna (colunas estreitas pedem rótulo curto). */
export function colunasShowLabels(labels: readonly string[], layout: ColunasLayout): boolean {
  const room = layout.column.width + layout.column.gap * 0.6;
  return labels.some((label) => label.trim() !== '') && labels.every((label) => textWidth(label, MIN_TEXT) <= room);
}

const laneTitle: React.CSSProperties = { position: 'absolute', left: 0, fontFamily: theme.font.display, fontWeight: 600, lineHeight: 1, color: theme.color.slate900, whiteSpace: 'nowrap' };

export const ColunasComLinhaParada: React.FC<ColunasComLinhaParadaProps & BaseProps> = ({
  eyebrow,
  title = 'Muito esforço, nenhum resultado.',
  accent,
  effortLabel = 'Esforço',
  resultLabel = 'Resultado',
  steps = DEFAULT_STEPS,
  revealAt,
  flatAt,
  flatLabel = 'no mesmo lugar',
  counter,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = clampInt(steps.length, COLUNAS_MIN, COLUNAS_MAX);
  const layout = colunasLayout(count);
  const starts = colunasTimes(count, revealAt);
  const flatSec = timeOr(flatAt, starts.at(-1)! + 1.1);
  const cardAt = Math.max(0, Math.min(0.6, starts[0]! - 0.6));
  const card = enter(frame, fps, cardAt, 0.5);
  const flat = enter(frame, fps, flatSec, 0.8);
  const lineEnd = layout.chart.x + layout.chart.width;
  const showLabels = colunasShowLabels(steps.slice(0, count), layout);
  const sideRoom = layout.side.width - SIDE_INSET;
  const laneSize = Math.min(fitFont(effortLabel, layout.labelWidth, text.cardTitle, 40, CHAR.display), fitFont(resultLabel, layout.labelWidth, text.cardTitle, 40, CHAR.display));

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44 }}>
      <Statement text={title} accent={accent} eyebrow={eyebrow} fontSize={titleSize(title, 80)} />
      <SceneCard progress={card} padding={CARD_PADDING} width={layout.width + CARD_PADDING * 2 + 4}>
        <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
          <div style={{ ...laneTitle, fontSize: laneSize, top: layout.baseline - laneSize, ...rise(enter(frame, fps, cardAt + 0.15), 16) }}>{effortLabel}</div>
          <div style={{ ...laneTitle, fontSize: laneSize, top: layout.resultY - laneSize / 2, ...rise(enter(frame, fps, cardAt + 0.25), 16) }}>{resultLabel}</div>

          {/* chão das colunas e divisória entre as duas faixas */}
          <div style={{ position: 'absolute', left: layout.chart.x, width: layout.chart.width, top: layout.baseline + 4, height: 2, background: theme.color.slate300, opacity: card }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: layout.dividerY, height: 2, background: alpha(theme.color.slate300, 0.6), opacity: card }} />

          {layout.columns.map((column, i) => {
            const start = starts[i]!;
            return (
              <div key={i}>
                {column.blocks.map((y, j) => {
                  const progress = enter(frame, fps, colunasBlockDelay(start, j), 0.4);
                  return (
                    <div
                      key={j}
                      style={{
                        position: 'absolute',
                        left: column.x,
                        top: y,
                        width: layout.column.width,
                        height: layout.block.height,
                        borderRadius: Math.min(theme.radius.panel, layout.block.height / 3),
                        // cada coluna mais escura que a anterior: o esforço cresce
                        background: alpha(theme.color.slate900, 0.3 + (0.7 * (i + 1)) / layout.columns.length),
                        opacity: progress,
                        translate: `0px ${((progress - 1) * 44).toFixed(2)}px`,
                      }}
                    />
                  );
                })}
                {showLabels ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: column.x - layout.column.gap * 0.3,
                      width: layout.column.width + layout.column.gap * 0.6,
                      top: layout.stepLabelY,
                      textAlign: 'center',
                      fontFamily: theme.font.body,
                      fontWeight: 500,
                      fontSize: MIN_TEXT,
                      lineHeight: 1.2,
                      color: theme.color.slate600,
                      whiteSpace: 'nowrap',
                      ...rise(enter(frame, fps, start + 0.1), 12),
                    }}
                  >
                    {steps[i]}
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* total acumulado: sobe a cada coluna */}
          {counter ? (
            <div
              style={{
                position: 'absolute',
                left: layout.side.x,
                width: layout.side.width,
                bottom: layout.height - layout.baseline,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingLeft: SIDE_INSET,
                boxSizing: 'border-box',
                ...rise(enter(frame, fps, starts[0]!), 16),
              }}
            >
              <span
                style={{
                  fontFamily: theme.font.body,
                  fontWeight: 800,
                  // o tamanho sai do valor final: o número não muda de corpo enquanto conta
                  fontSize: fitFont(colunasCounterText(counter.perStep * count, counter), sideRoom, 128, 56, CHAR.digits),
                  lineHeight: 1,
                  letterSpacing: '-0.035em',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  color: theme.color.slate900,
                }}
              >
                {colunasCounterText(colunasTotal(frame / fps, starts, counter.perStep), counter)}
              </span>
              {counter.caption ? (
                <span style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: fitFont(counter.caption, sideRoom, text.label), lineHeight: 1.2, color: theme.color.slate600, maxWidth: sideRoom, ...CLIP }}>
                  {counter.caption}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* trilho apagado desde o início; em `flatAt` a linha se desenha por cima, reta */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none" strokeLinecap="round">
            <line x1={layout.chart.x} x2={lineEnd} y1={layout.resultY} y2={layout.resultY} stroke={theme.color.slate300} strokeWidth={4} strokeDasharray="2 16" opacity={card} />
            <line
              x1={layout.chart.x}
              x2={layout.chart.x + layout.chart.width * flat}
              y1={layout.resultY}
              y2={layout.resultY}
              stroke={theme.color.slate900}
              strokeWidth={6}
              opacity={flat > 0 ? 1 : 0}
            />
            {layout.columns.map((column, i) => {
              const reached = flat * layout.chart.width >= column.center - layout.chart.x ? 1 : 0;
              return <circle key={i} cx={column.center} cy={layout.resultY} r={11} fill={theme.color.paper} stroke={theme.color.slate900} strokeWidth={5} opacity={reached} />;
            })}
            <circle cx={layout.chart.x + layout.chart.width * flat} cy={layout.resultY} r={13} fill={theme.color.coral} opacity={flat > 0 ? 1 : 0} />
          </svg>

          <div style={{ position: 'absolute', left: layout.side.x + SIDE_INSET, top: layout.resultY, height: 0, display: 'flex', alignItems: 'center' }}>
            <Pill variant="coral" dot fontSize={fitPill(flatLabel, sideRoom - 24, 36, 'dot')} progress={enter(frame, fps, flatSec + 0.45)} style={pillClamp(sideRoom)}>
              <span style={CLIP}>{flatLabel}</span>
            </Pill>
          </div>
        </div>
      </SceneCard>
    </SceneBackground>
  );
};

/** Caixa ocupada pela cena com estas props (título + cartão do gráfico), para conferir contra a área útil sem renderizar. */
export function colunasExtent(props: ColunasComLinhaParadaProps = {}): Extent {
  const title = props.title ?? 'Muito esforço, nenhum resultado.';
  const layout = colunasLayout((props.steps ?? DEFAULT_STEPS).length);
  const frame = CARD_PADDING * 2 + 4;
  return { width: layout.width + frame, height: statementHeight(title, titleSize(title, 80), { eyebrow: Boolean(props.eyebrow) }) + 44 + layout.height + frame };
}

export const entry: ComponentEntry = {
  component: ColunasComLinhaParada,
  sample: {
    eyebrow: 'Academia',
    title: 'Treino todo dia. A balança, nada.',
    effortLabel: 'Treino',
    resultLabel: 'Peso',
    steps: ['seg', 'ter', 'qua', 'qui', 'sex'],
    revealAt: [1.4, 1.9, 2.4, 2.9, 3.4],
    flatAt: 4.4,
    flatLabel: 'nada mudou',
    counter: { perStep: 1, suffix: ' h', caption: 'de treino' },
  },
  defaultDuration: 6.5,
  description:
    'Para a fala de esforço que não vira resultado ("faço, faço, faço e não vejo nada mudar"): a cada repetição uma coluna mais alta empilha ' +
    'e um total sobe ao lado, enquanto a linha de baixo se desenha reta, com um rótulo em coral no fim. ' +
    'Serve para estudo sem evolução, anúncio sem venda, treino sem mudança, horas extras sem aumento.',
  tags: ['gráfico', 'colunas', 'contraste', 'esforço-resultado', 'estagnação'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/EstudoSemEvoluir' },
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do título' },
    { name: 'title', type: 'string', description: 'a frase da cena' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral (o rótulo da linha parada já é o acento: evite os dois)' },
    { name: 'effortLabel', type: 'string', description: 'nome da faixa de cima, a que cresce (até ~10 letras)' },
    { name: 'resultLabel', type: 'string', description: 'nome da faixa de baixo, a que fica parada (até ~10 letras)' },
    { name: 'steps', type: 'string[] (2 a 6)', description: 'uma coluna por item, com o rótulo embaixo dela; com 5 ou 6 colunas o rótulo precisa ser curto, senão some' },
    { name: 'revealAt', type: 'number[]', description: 'segundo em que cada coluna empilha, por índice; o que faltar segue em sequência' },
    { name: 'flatAt', type: 'number?', description: 'segundo em que a linha de resultado se desenha reta (padrão: depois da última coluna)' },
    { name: 'flatLabel', type: 'string', description: 'rótulo com o acento coral no fim da linha parada' },
    { name: 'counter', type: '{ perStep: number; prefix?: string; suffix?: string; caption?: string }?', description: 'total que soma `perStep` a cada coluna, ao lado do gráfico; omitido = sem número' },
  ],
};
