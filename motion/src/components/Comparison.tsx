import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { techFor, TechMark } from '../tech/glyph';
import { motion, theme } from '../theme';
import { cardSurface, CheckMark, lastTime, splitTimes } from './c1-kit';
import type { ComponentEntry } from './registry';
import { withAlpha } from './SectionTitle';

export interface ComparisonSide {
  title: string;
  items: string[];
}

export interface ComparisonProps {
  left: ComparisonSide;
  right: ComparisonSide;
  winner?: 'left' | 'right';
  /** segundos relativos em que cada item aparece: primeiro todos os da esquerda, depois os da direita */
  revealAt?: number[];
  /** false: título ou item que nomeia uma tecnologia não ganha o logo sozinho */
  autoTechIcons?: boolean;
}

export const WINNER_DELAY = 0.6;

/** Tempos por coluna e o instante do veredito (depois do último item). */
export function comparisonTimes(leftCount: number, rightCount: number, revealAt?: readonly number[]) {
  const times = splitTimes(leftCount, rightCount, revealAt);
  return { ...times, winnerAt: lastTime(times.left, times.right) + WINNER_DELAY };
}

/** Corpo dos itens: listas curtas ganham letra maior; o piso é o mínimo legível em vídeo. */
export function comparisonItemSize(left: readonly string[], right: readonly string[]): number {
  const all = [...left, ...right];
  const longest = all.reduce((max, item) => Math.max(max, item.trim().length), 0);
  const rows = Math.max(left.length, right.length);
  if (rows <= 4 && longest <= 26) return 40;
  if (rows <= 5 && longest <= 56) return 36;
  return 34;
}

const COLUMN_WIDTH = 800;
const GAP = 64;

const Column: React.FC<{
  side: ComparisonSide;
  times: readonly number[];
  fontSize: number;
  /** 0–1: quanto esta coluna já foi coroada (1) */
  won: number;
  /** 0–1: quanto esta coluna já perdeu destaque */
  lost: number;
  frame: number;
  fps: number;
  enter: number;
  direction: -1 | 1;
  auto: boolean;
}> = ({ side, times, fontSize, won, lost, frame, fps, enter, direction, auto }) => (
  <div
    style={{
      ...cardSurface,
      display: 'flex',
      flexDirection: 'column',
      width: COLUMN_WIDTH,
      padding: '44px 52px 48px',
      boxShadow: `${theme.shadow.raised}, 0 0 0 ${won * 6}px ${theme.color.emerald}`,
      translate: `${(1 - enter) * 64 * direction}px 0`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
      <div
        style={{
          minWidth: 0,
          fontFamily: theme.font.display,
          fontWeight: 600,
          fontSize: 56,
          lineHeight: 1.12,
          letterSpacing: '-0.01em',
          color: theme.color.slate900,
          opacity: 1 - 0.35 * lost,
          overflowWrap: 'anywhere',
        }}
      >
        {/* "React vs Angular": cada lado que é uma tecnologia leva o logo junto do título */}
        <TechMark label={side.title} auto={auto} size={50} surface="light" style={{ verticalAlign: '-0.12em', marginRight: 18 }} />
        {side.title}
      </div>
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 60,
          height: 60,
          borderRadius: theme.radius.pill,
          background: theme.color.emerald,
          opacity: Math.min(1, won * 2),
          scale: 0.6 + 0.4 * won,
        }}
      >
        <CheckMark progress={won} size={38} color={theme.color.ink} strokeWidth={3.2} />
      </div>
    </div>
    <div style={{ height: 2, marginTop: 24, marginBottom: 8, background: withAlpha(theme.color.slate300, 0.8) }} />
    {side.items.map((item, index) => {
      const appear = progressAt(frame, fps, times[index] ?? 0);
      return (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 20,
            marginTop: 18,
            opacity: appear * (1 - 0.35 * lost),
            translate: `0 ${(1 - appear) * 14}px`,
          }}
        >
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', height: fontSize * 1.3 }}>
            {techFor(item, undefined, auto) ? (
              <TechMark label={item} size={fontSize * 0.9} surface="light" progress={appear} />
            ) : (
              <div style={{ width: 12, height: 12, borderRadius: theme.radius.pill, background: theme.color.slate600 }} />
            )}
          </div>
          <div
            style={{
              minWidth: 0,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize,
              lineHeight: 1.3,
              color: theme.color.ink,
              overflowWrap: 'anywhere',
            }}
          >
            {item}
          </div>
        </div>
      );
    })}
  </div>
);

export const Comparison: React.FC<ComparisonProps & BaseProps> = ({ left, right, winner, revealAt, autoTechIcons = true, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const times = comparisonTimes(left.items.length, right.items.length, revealAt);
  const fontSize = comparisonItemSize(left.items, right.items);
  const verdict = winner ? progressAt(frame, fps, times.winnerAt, motion.slow) : 0;
  const badge = interpolate(frame, [0.25 * fps, 0.65 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: motion.pop });
  const shared = { fontSize, frame, fps, enter, auto: autoTechIcons };

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: GAP, opacity: value, translate: `0 ${exit * -20}px` }}>
        <Column side={left} times={times.left} won={winner === 'left' ? verdict : 0} lost={winner === 'right' ? verdict : 0} direction={-1} {...shared} />
        <Column side={right} times={times.right} won={winner === 'right' ? verdict : 0} lost={winner === 'left' ? verdict : 0} direction={1} {...shared} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 104,
            height: 104,
            marginLeft: -52,
            borderRadius: theme.radius.pill,
            background: theme.color.ink,
            border: `4px solid ${theme.color.paper}`,
            boxShadow: theme.shadow.card,
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: 44,
            lineHeight: 1,
            color: theme.color.paper,
            opacity: Math.min(1, badge * 1.5),
            scale: 0.7 + 0.3 * badge,
          }}
        >
          <span style={{ translate: '0 -4px' }}>vs</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Comparison,
  sample: {
    left: { title: 'REST', items: ['Vários endpoints', 'Cache HTTP nativo', 'Traz dados de sobra'] },
    right: { title: 'GraphQL', items: ['Um endpoint só', 'O cliente escolhe os campos', 'Cache dá mais trabalho'] },
    winner: 'right',
    revealAt: [0.6, 1.6, 2.6, 3.8, 4.8, 5.8],
  },
  defaultDuration: 9,
  description: 'Confronto "A vs B" entre duas tecnologias ou abordagens, item a item; com `winner`, destaca a escolhida no fim.',
};
