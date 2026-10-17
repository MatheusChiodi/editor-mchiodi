import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { cardSurface, rise } from './c1-kit';
import { clamp01, sweep, tone } from './c3-kit';
import { formatPtBr } from './Counter';
import type { ComponentEntry } from './registry';

export interface RatingProps {
  label?: string;
  value: number;
  max?: number;
  caption?: string;
}

/** Quantidade de estrelas: inteiro entre 1 e 10 (padrão 5). */
export function starCount(max = 5): number {
  return Number.isFinite(max) ? Math.min(10, Math.max(1, Math.round(max))) : 5;
}

/** Nota arredondada para o meio ponto mais próximo, dentro de 0..max. */
export function roundToHalf(value: number, max = 5): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(starCount(max), Math.max(0, Math.round(value * 2) / 2));
}

/** Preenchimento (0–1) de cada estrela para uma nota já "andada" até `shown`. */
export function starFills(shown: number, max = 5): number[] {
  return Array.from({ length: starCount(max) }, (_, index) => clamp01(shown - index));
}

const STAR = 'M12 2.6l2.9 5.88 6.5.95-4.7 4.58 1.1 6.47L12 17.42l-5.8 3.06 1.1-6.47-4.7-4.58 6.5-.95z';
const FILL_START = 0.35;

const Star: React.FC<{ size: number; fill: number }> = ({ size, fill }) => (
  <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', inset: 0 }}>
      <path d={STAR} fill="none" stroke={tone.slate400} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
    {/* a parte preenchida é a mesma estrela recortada pela largura: é o que permite meio ponto */}
    <div style={{ position: 'absolute', left: 0, top: 0, width: size * fill, height: size, overflow: 'hidden' }}>
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d={STAR} fill={theme.color.coral} stroke={theme.color.coral} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    </div>
  </div>
);

export const Rating: React.FC<RatingProps & BaseProps> = ({ label, value: rating, max = 5, caption, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const count = starCount(max);
  const target = roundToHalf(rating, max);
  // cada estrela leva o mesmo tempo para encher, então nota maior demora um pouco mais
  const shown = target * sweep(frame / fps, FILL_START, FILL_START + 0.5 + target * 0.18);
  const fills = starFills(shown, max);
  const size = count <= 5 ? 72 : 56;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          maxWidth: 820,
          padding: '40px 52px 44px',
          opacity: value,
          scale: String(0.95 + 0.05 * enter - 0.03 * exit),
          translate: `0 ${(1 - enter) * 28}px`,
          transformOrigin: 'right center',
        }}
      >
        {label ? (
          <div
            style={{
              marginBottom: 20,
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
        ) : null}
        {/* com mais de 5 estrelas a fileira não cabe ao lado do número: ela desce para a linha de baixo */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 32, rowGap: 14 }}>
          <div
            style={{
              flexShrink: 0,
              fontFamily: theme.font.body,
              fontWeight: 800,
              fontSize: 112,
              lineHeight: 1,
              letterSpacing: '-0.035em',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              color: theme.color.ink,
            }}
          >
            {formatPtBr(shown, 1)}
            <span style={{ fontSize: '0.34em', fontWeight: 600, letterSpacing: 0, marginLeft: '0.3em', color: theme.color.slate600 }}>
              de {count}
            </span>
          </div>
          <div style={{ display: 'flex', gap: count <= 5 ? 8 : 4 }}>
            {fills.map((fill, index) => (
              <Star key={index} size={size} fill={fill} />
            ))}
          </div>
        </div>
        {caption ? (
          <div
            style={{
              ...rise(progressAt(frame, fps, 0.5)),
              marginTop: 20,
              fontFamily: theme.font.body,
              fontWeight: 500,
              fontSize: 30,
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
  component: Rating,
  sample: {
    label: 'Bun como runtime de produção',
    value: 4.5,
    caption: 'Rápido de verdade — só perde ponto na compatibilidade com pacotes nativos.',
  },
  defaultDuration: 5,
  description: 'Dá a nota de uma ferramenta, biblioteca ou produto em review, em estrelas (aceita meio ponto).',
};
