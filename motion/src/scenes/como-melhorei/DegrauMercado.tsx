import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { enter, IconBadge, Pill, type Point, popIn, rise, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';

export interface DegrauMercadoProps {
  /** segundos relativos ao início da cena */
  revealAt?: {
    /** "tecnologias bem básicas": a base pequena, com ele em cima */
    base: number;
    /** o paredão do mercado sobe */
    market: number;
    /** "grande dificuldade": o vão entre os dois fica medido */
    gap: number;
    /** "acabei sentindo": a confirmação */
    felt: number;
  };
  eyebrow?: string;
  title?: string;
  baseLabel?: string;
  baseHint?: string;
  marketLabel?: string;
  gapLabel?: string;
  feltLabel?: string;
}

const DEFAULT_REVEAL = { base: 0.4, market: 2.0, gap: 3.4, felt: 5.2 };
/** atraso entre as fiadas do paredão (s) */
export const ROW_STAGGER = 0.09;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GapLayout {
  width: number;
  height: number;
  base: Box;
  wall: Box;
  /** fiadas do paredão, de baixo para cima */
  rows: Box[];
  person: { size: number; center: Point };
  /** régua vertical do vão: do topo da base ao topo do paredão */
  gap: { x: number; from: number; to: number; size: number; label: Point };
  /** onde entra a confirmação, no chão entre os dois */
  felt: Point;
}

/** Base baixa à esquerda, paredão alto à direita e, no corredor entre eles, a régua que mede o vão. */
export function gapLayout(width = 1640, height = 540, rowCount = 5): GapLayout {
  const baseWidth = 580;
  const baseHeight = 160;
  const wallWidth = 600;
  const rowGap = 10;
  const rowHeight = (height - rowGap * (rowCount - 1)) / rowCount;
  const base: Box = { x: 0, y: height - baseHeight, width: baseWidth, height: baseHeight };
  const wall: Box = { x: width - wallWidth, y: 0, width: wallWidth, height };
  const rows: Box[] = Array.from({ length: rowCount }, (_, i) => ({
    x: wall.x,
    y: height - (i + 1) * rowHeight - i * rowGap,
    width: wallWidth,
    height: rowHeight,
  }));
  const corridor = (base.x + base.width + wall.x) / 2;
  const personSize = 108;
  return {
    width,
    height,
    base,
    wall,
    rows,
    person: { size: personSize, center: [base.x + base.width / 2, base.y - 16 - personSize / 2] },
    gap: { x: corridor, from: base.y, to: wall.y, size: base.y - wall.y, label: [corridor, (base.y + wall.y) / 2] },
    felt: [corridor, base.y + base.height / 2],
  };
}

/** Quantas vezes o paredão é mais alto que a base. */
export function gapRatio(layout: GapLayout): number {
  return layout.wall.height / layout.base.height;
}

/** Segundo em que cada fiada do paredão sobe, de baixo para cima. */
export function rowTimes(marketAt: number, rowCount: number, stagger: number = ROW_STAGGER): number[] {
  return Array.from({ length: rowCount }, (_, i) => marketAt + i * stagger);
}

const At: React.FC<{ point: Point; children: React.ReactNode }> = ({ point, children }) => (
  <div style={{ position: 'absolute', left: point[0], top: point[1], width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
);

/** O que eu sabia contra o que o mercado pede: uma base pequena diante de um paredão, com o vão medido. */
export const DegrauMercado: React.FC<DegrauMercadoProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  eyebrow = 'Tecnologias bem básicas',
  title = 'O básico não bastava.',
  baseLabel = 'O que eu sabia',
  baseHint = 'HTML, CSS, JavaScript, PHP',
  marketLabel = 'O que o mercado pede',
  gapLabel = 'grande dificuldade',
  feltLabel = 'acabei sentindo',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = gapLayout();
  const base = enter(frame, fps, revealAt.base, 0.5);
  const times = rowTimes(revealAt.market, layout.rows.length);
  const gap = enter(frame, fps, revealAt.gap, 0.7);
  const felt = enter(frame, fps, revealAt.felt, 0.4);
  const { person } = layout;
  const cap = 22;
  // a régua cresce de baixo (o topo da base) para cima (o topo do paredão)
  const tip = layout.gap.from - layout.gap.size * gap;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 52 }}>
      <Statement text={title} eyebrow={eyebrow} fontSize={80} />
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        {/* chão comum: as duas alturas partem da mesma linha */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: layout.height + 6, height: 3, borderRadius: 2, background: theme.color.slate300, opacity: base }} />

        <SceneCard
          progress={base}
          padding="0 36px"
          style={{
            position: 'absolute',
            left: layout.base.x,
            top: layout.base.y,
            width: layout.base.width,
            height: layout.base.height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: text.body, lineHeight: 1.1, color: theme.color.slate900 }}>{baseLabel}</div>
          <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: 34, lineHeight: 1.1, color: theme.color.slate600, whiteSpace: 'nowrap' }}>{baseHint}</div>
        </SceneCard>
        <IconBadge
          icon="user"
          variant="ink"
          size={person.size}
          progress={enter(frame, fps, revealAt.base + 0.25, 0.5)}
          style={{ position: 'absolute', left: person.center[0] - person.size / 2, top: person.center[1] - person.size / 2 }}
        />

        {layout.rows.map((row, i) => {
          const progress = enter(frame, fps, times[i]!, 0.45);
          const top = i === layout.rows.length - 1;
          return (
            <div
              key={row.y}
              style={{
                position: 'absolute',
                left: row.x,
                top: row.y,
                width: row.width,
                height: row.height,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.panel,
                background: theme.color.slate900,
                boxShadow: theme.shadow.card,
                fontFamily: theme.font.body,
                fontWeight: 600,
                fontSize: text.body,
                lineHeight: 1,
                color: theme.color.white,
                whiteSpace: 'nowrap',
                ...rise(progress, 36),
              }}
            >
              {top ? marketLabel : null}
            </div>
          );
        })}

        {/* o vão: guias tracejadas na altura de cada topo e a régua em coral entre elas */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none" strokeLinecap="round">
          <line
            x1={layout.base.x + layout.base.width + 20}
            x2={layout.wall.x - 20}
            y1={layout.gap.from}
            y2={layout.gap.from}
            stroke={theme.color.slate300}
            strokeWidth={3}
            strokeDasharray="4 14"
            opacity={Math.min(1, gap * 3)}
          />
          <line
            x1={layout.gap.x - cap * 3}
            x2={layout.wall.x - 20}
            y1={layout.gap.to}
            y2={layout.gap.to}
            stroke={theme.color.slate300}
            strokeWidth={3}
            strokeDasharray="4 14"
            opacity={gap >= 0.98 ? 1 : 0}
          />
          <g stroke={theme.color.coral} strokeWidth={6} opacity={gap > 0 ? 1 : 0}>
            <line x1={layout.gap.x} x2={layout.gap.x} y1={layout.gap.from} y2={tip} />
            <line x1={layout.gap.x - cap} x2={layout.gap.x + cap} y1={layout.gap.from} y2={layout.gap.from} />
            <line x1={layout.gap.x - cap} x2={layout.gap.x + cap} y1={tip} y2={tip} />
          </g>
        </svg>
        <At point={layout.gap.label}>
          {/* fundo opaco: a pílula interrompe a régua em vez de deixar o traço passar por trás do texto */}
          <Pill progress={enter(frame, fps, revealAt.gap + 0.45)} style={{ background: theme.color.paper }}>
            {gapLabel}
          </Pill>
        </At>

        <At point={layout.felt}>
          <Pill variant="ink" icon="check" style={{ opacity: felt, scale: String(0.8 + 0.2 * popIn(frame, fps, revealAt.felt, 0.4)), translate: '0px 0px' }}>
            {feltLabel}
          </Pill>
        </At>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: DegrauMercado,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 6.5,
  description:
    'Cena papel: a distância entre "o que eu sabia" (base pequena) e "o que o mercado pede" (paredão alto), com o vão medido em coral e a confirmação "acabei sentindo".',
};

export const MODEL = 'DegrauEVao';
