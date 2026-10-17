import { AbsoluteFill, interpolate, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface IntroProps {
  title?: string;
  tagline?: string;
}

/** Fonte de título que cabe em `maxWidth` numa linha (largura média de caractere estimada). */
export function fitTitle(text: string, maxWidth: number, max: number, min: number, ratio = 0.56): number {
  if (!text.length) return max;
  return Math.max(min, Math.min(max, Math.floor(maxWidth / (text.length * ratio))));
}

const DISC = 112;
const DISC_BIG = 2.2;
const GAP = 40;
const TAGLINE_GAP = 26;
const TAGLINE_HEIGHT = 40;

/** Alturas do bloco central; o disco nasce no centro da tela e assenta no topo do bloco. */
export function introLayout(titleSize: number, hasTagline: boolean) {
  const titleHeight = Math.round(titleSize * 1.3);
  const blockHeight = DISC + GAP + titleHeight + (hasTagline ? TAGLINE_GAP + TAGLINE_HEIGHT : 0);
  return { titleHeight, blockHeight, discOffset: blockHeight / 2 - DISC / 2 };
}

/** Estado do disco no frame: cresce com overshoot no centro e depois encolhe e sobe para o lugar. */
export function discState(frame: number, fps: number, discOffset: number): { scale: number; y: number } {
  const options = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const grow = interpolate(frame, [0, 0.5 * fps], [0, 1], { ...options, easing: motion.pop });
  const settle = interpolate(frame, [0.5 * fps, 1.1 * fps], [0, 1], { ...options, easing: motion.move });
  return { scale: grow * (DISC_BIG + (1 - DISC_BIG) * settle), y: discOffset * (1 - settle) };
}

export const Intro: React.FC<IntroProps & BaseProps> = ({ title = 'MChiodi', tagline = 'tecnologia sem enrolação', durationInFrames }) => {
  // sem saída: a vinheta termina parada e o corte para o vídeo é seco
  const { frame, fps } = usePresence(durationInFrames);
  const { width } = useVideoConfig();

  const titleSize = fitTitle(title, width - theme.safe.x * 2, 168, 72);
  const { titleHeight, discOffset } = introLayout(titleSize, Boolean(tagline));
  const disc = discState(frame, fps, discOffset);
  const reveal = progressAt(frame, fps, 0.7, motion.slow);
  const taglineIn = progressAt(frame, fps, 1.15, motion.slow);

  return (
    <AbsoluteFill
      style={{ background: theme.color.paper, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
    >
      <div
        style={{
          width: DISC,
          height: DISC,
          flexShrink: 0,
          marginBottom: GAP,
          borderRadius: theme.radius.pill,
          background: theme.color.coral,
          translate: `0 ${disc.y}px`,
          scale: String(disc.scale),
        }}
      />
      <div style={{ height: titleHeight, overflow: 'hidden', flexShrink: 0 }}>
        <div
          style={{
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: titleSize,
            lineHeight: `${titleHeight}px`,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            color: theme.color.ink,
            translate: `0 ${(1 - reveal) * 104}%`,
          }}
        >
          {title}
        </div>
      </div>
      {tagline ? (
        <div
          style={{
            marginTop: TAGLINE_GAP,
            height: TAGLINE_HEIGHT,
            maxWidth: width - theme.safe.x * 2,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            fontFamily: theme.font.body,
            fontWeight: 600,
            fontSize: fitTitle(tagline, width - theme.safe.x * 2, 30, 18, 0.95),
            lineHeight: `${TAGLINE_HEIGHT}px`,
            // o tracking fecha enquanto entra; o recuo compensa o espaço depois da última letra
            letterSpacing: `${0.5 - 0.18 * taglineIn}em`,
            textIndent: `${0.5 - 0.18 * taglineIn}em`,
            textTransform: 'uppercase',
            color: theme.color.slate600,
            opacity: taglineIn,
          }}
        >
          {tagline}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const sample: IntroProps = { title: 'MChiodi', tagline: 'tecnologia sem enrolação' };

export const entry: ComponentEntry = {
  component: Intro,
  sample: { ...sample },
  defaultDuration: 2.5,
  description: 'Vinheta de abertura em tela cheia (2,5s) com o disco coral e o nome do canal; use uma vez, logo depois do gancho.',
};
