import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { type BaseProps, presence } from '../anim';
import { motion, theme } from '../theme';
import { status } from './c1-kit';
import type { ComponentEntry } from './registry';
import { withAlpha } from './SectionTitle';

export type StampTone = 'coral' | 'ink' | 'emerald';

export interface StampProps {
  text: string;
  tone?: StampTone;
  /** graus; negativo inclina para a esquerda */
  rotate?: number;
}

export const STAMP_ROTATE = -7;
const MAX_ROTATE = 20;
/** largura média de um caractere em caixa alta de Inter 800 com o tracking do carimbo, em em */
const CHAR_EM = 0.78;
const MAX_TEXT_WIDTH = 1040;
const MAX_SIZE = 170;
const MIN_SIZE = 56;
const WRAP_BELOW = 76;

/** emerald-400 não lê como texto sobre `paper`; o carimbo usa o emerald-600 do design system. */
export function stampColor(tone: StampTone = 'coral'): string {
  return tone === 'ink' ? theme.color.ink : tone === 'emerald' ? status.emeraldDeep : theme.color.coral;
}

/** Rotação fixa, limitada para o texto continuar legível. */
export function stampRotation(rotate: number = STAMP_ROTATE): number {
  if (!Number.isFinite(rotate)) return STAMP_ROTATE;
  return Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, rotate));
}

export interface StampGeometry {
  fontSize: number;
  /** false = cabe numa linha só; true = quebra em duas, equilibradas */
  wrap: boolean;
  outer: number;
  inner: number;
  gap: number;
  padX: number;
  padY: number;
}

const sizeFor = (chars: number) => Math.floor(MAX_TEXT_WIDTH / (Math.max(1, chars) * CHAR_EM) / 2) * 2;

/**
 * Corpo do texto e espessura das duas bordas, proporcionais entre si. Texto que ficaria pequeno
 * demais numa linha passa para duas, o que devolve tamanho de carimbo a frases como "na minha máquina".
 */
export function stampGeometry(text: string): StampGeometry {
  const length = text.trim().length;
  const single = sizeFor(length);
  const wrap = single < WRAP_BELOW;
  // em duas linhas a maior fica com pouco mais da metade do texto
  const fontSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, wrap ? sizeFor(Math.ceil(length / 2) + 3) : single));
  const outer = Math.max(6, Math.round(fontSize * 0.075));
  return {
    fontSize,
    wrap,
    outer,
    inner: Math.max(3, Math.round(outer * 0.4)),
    gap: Math.max(6, Math.round(outer * 0.9)),
    padX: Math.round(fontSize * 0.42),
    padY: Math.round(fontSize * 0.16),
  };
}

export const IMPACT_SEC = 0.2;
const SETTLE_SEC = 0.38;

/**
 * Batida do carimbo: cai grande e acelerando até encostar (IMPACT_SEC), afunda um pouco e assenta.
 * A queda acelera de propósito (é a única entrada do canal que não desacelera): carimbo bate, não pousa.
 */
export function stampImpact(sec: number): { scale: number; opacity: number } {
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const fall = interpolate(sec, [0, IMPACT_SEC], [2.1, 0.94], { ...clamp, easing: Easing.in(Easing.cubic) });
  const settle = interpolate(sec, [IMPACT_SEC, SETTLE_SEC], [0.94, 1], { ...clamp, easing: motion.enter });
  return {
    scale: sec <= IMPACT_SEC ? fall : settle,
    opacity: interpolate(sec, [0, IMPACT_SEC * 0.6], [0, 1], clamp),
  };
}

export const Stamp: React.FC<StampProps & BaseProps> = ({ text, tone, rotate, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { exit } = presence(frame, fps, durationInFrames);
  const label = text.trim();
  const color = stampColor(tone);
  const geometry = stampGeometry(label);
  const impact = stampImpact(frame / fps);
  const landed = interpolate(frame, [IMPACT_SEC * fps, (IMPACT_SEC + 0.15) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          padding: geometry.gap,
          background: withAlpha(theme.color.paper, 0.97),
          border: `${geometry.outer}px solid ${color}`,
          borderRadius: Math.round(geometry.fontSize * 0.2),
          // a sombra só aparece depois da batida: antes disso o carimbo ainda está "no ar"
          boxShadow: `0 30px 70px -30px rgba(15,23,42,${0.75 * landed})`,
          opacity: impact.opacity * (1 - exit),
          rotate: `${stampRotation(rotate)}deg`,
          scale: impact.scale * (1 + 0.06 * exit),
        }}
      >
        <div
          style={{
            padding: `${geometry.padY}px ${geometry.padX}px`,
            border: `${geometry.inner}px solid ${color}`,
            borderRadius: Math.round(geometry.fontSize * 0.11),
            maxWidth: MAX_TEXT_WIDTH + 2 * geometry.padX,
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: geometry.fontSize,
            lineHeight: 1.08,
            letterSpacing: '0.06em',
            // o tracking sobra depois da última letra; o recuo à esquerda recentra o texto
            textIndent: '0.06em',
            textTransform: 'uppercase',
            textAlign: 'center',
            whiteSpace: geometry.wrap ? 'normal' : 'nowrap',
            textWrap: 'balance',
            color,
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Stamp,
  sample: {
    text: 'Mito',
    tone: 'coral',
  },
  defaultDuration: 2.5,
  vertical: { zone: 'top' },
  description: 'Veredito de uma palavra batido como carimbo ("MITO", "VERDADE", "PLOT TWIST") logo depois de uma afirmação; tom de humor.',
};
