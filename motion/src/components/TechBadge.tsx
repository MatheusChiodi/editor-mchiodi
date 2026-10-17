import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import { TechIcon, techOrPlaceholder } from '../tech/TechIcon';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export type TechBadgeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const TECH_BADGE_CORNERS: readonly TechBadgeCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export interface TechBadgeProps {
  /** id do catálogo, apelido ou `tech:<id>` */
  tech: string;
  corner?: TechBadgeCorner;
  /** texto ao lado do ícone quando não é o nome oficial; `false` mostra só o ícone */
  label?: string | false;
}

/** Duração sugerida: o suficiente para reconhecer o logo sem virar enfeite fixo. */
export const TECH_BADGE_SEC = 3;

export const resolveCorner = (corner: unknown): TechBadgeCorner => (TECH_BADGE_CORNERS.includes(corner as TechBadgeCorner) ? (corner as TechBadgeCorner) : 'top-right');

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * Selo discreto de canto: o ícone (e o nome) da tecnologia na primeira vez em que ela é citada sobre o talking head.
 * Entra deslizando do lado em que está e some sozinho depois de ~3 s.
 */
export const TechBadge: React.FC<TechBadgeProps & BaseProps> = ({ tech, corner: cornerProp, label, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const corner = resolveCorner(cornerProp);
  const right = corner.endsWith('right');
  const bottom = corner.startsWith('bottom');
  const enter = interpolate(frame, [0, motion.base * fps], [0, 1], { ...clamp, easing: motion.enter });
  const exit = interpolate(frame, [durationInFrames - motion.fast * fps, durationInFrames], [0, 1], { ...clamp, easing: motion.exit });
  const icon = interpolate(frame, [0.08 * fps, (0.08 + motion.base) * fps], [0, 1], { ...clamp, easing: motion.pop });
  const text = label === false ? null : (label ?? techOrPlaceholder(tech).name);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        justifyContent: bottom ? 'flex-end' : 'flex-start',
        alignItems: right ? 'flex-end' : 'flex-start',
        // embaixo, o selo fica acima da faixa das legendas
        padding: `${theme.safe.y}px ${theme.safe.x}px ${bottom ? 250 : theme.safe.y}px`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: right ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 20,
          padding: text ? (right ? '14px 14px 14px 30px' : '14px 30px 14px 14px') : 14,
          borderRadius: 30,
          background: theme.color.paper,
          boxShadow: theme.shadow.raised,
          opacity: enter * (1 - exit),
          translate: `${(right ? 1 : -1) * ((1 - enter) * 48 + exit * 20)}px 0`,
        }}
      >
        <TechIcon name={tech} variant="brand" size={84} progress={icon} style={{ boxShadow: 'none', translate: '0 0', opacity: 1 }} />
        {text ? (
          <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: 40, lineHeight: 1, letterSpacing: '-0.01em', whiteSpace: 'nowrap', color: theme.color.ink }}>
            {text}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: TechBadge,
  sample: { tech: 'react', corner: 'top-right' },
  defaultDuration: TECH_BADGE_SEC,
  description:
    'Selo de canto com o ícone e o nome de UMA tecnologia, para a primeira vez em que ela é citada sobre o talking head; some sozinho em ~3 s. É o jeito mais leve de cumprir "toda tecnologia citada ganha ícone".',
};
