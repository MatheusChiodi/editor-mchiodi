import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { cardSurface, fitFontSize, type FontTier, Pill, rise } from './c1-kit';
import { clamp } from './c3-kit';
import { displayLink } from './LowerThird';
import type { ComponentEntry } from './registry';

export interface LinkCardProps {
  title: string;
  url: string;
  description?: string;
  cta?: string;
}

export const LINK_TITLE_TIERS: readonly FontTier[] = [
  { fontSize: 50, maxChars: 28 },
  { fontSize: 44, maxChars: 56 },
  { fontSize: 38, maxChars: Number.POSITIVE_INFINITY },
];

/** A URL cabe inteira em ~36 caracteres a 30 px; daí para cima o corpo diminui antes de apelar para as reticências. */
export const LINK_URL_TIERS: readonly FontTier[] = [
  { fontSize: 30, maxChars: 36 },
  { fontSize: 26, maxChars: 42 },
  { fontSize: 24, maxChars: Number.POSITIVE_INFINITY },
];

const NUDGE_AT = 1;
const NUDGE_SEC = 0.5;

/** Deslocamento (0–1–0) da seta: um único "vai ali" na diagonal depois que o cartão assentou. */
export function arrowNudge(sec: number, startSec = NUDGE_AT): number {
  return interpolate(sec, [startSec, startSec + NUDGE_SEC / 2, startSec + NUDGE_SEC], [0, 1, 0], { ...clamp, easing: motion.move });
}

export const LinkCard: React.FC<LinkCardProps & BaseProps> = ({ title, url, description, cta = 'Link na descrição', durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const nudge = arrowNudge(frame / fps);
  const arrow = progressAt(frame, fps, 0.45, 0.5);
  const link = displayLink(url);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        paddingRight: theme.safe.x,
        paddingBottom: theme.safe.y + 40,
      }}
    >
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: 800,
          boxSizing: 'border-box',
          padding: '36px 40px 40px',
          opacity: value,
          translate: `0 ${(1 - enter) * 48 + exit * 24}px`,
        }}
      >
        <Pill style={rise(progressAt(frame, fps, 0.1))}>{cta}</Pill>
        <div
          style={{
            ...rise(progressAt(frame, fps, 0.18)),
            marginTop: 20,
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: fitFontSize(title, LINK_TITLE_TIERS),
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: theme.color.ink,
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              ...rise(progressAt(frame, fps, 0.26)),
              marginTop: 12,
              fontFamily: theme.font.body,
              fontWeight: 500,
              fontSize: 28,
              lineHeight: 1.3,
              color: theme.color.slate600,
              overflowWrap: 'anywhere',
            }}
          >
            {description}
          </div>
        ) : null}
        <div
          style={{
            ...rise(progressAt(frame, fps, 0.34)),
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            maxWidth: '100%',
            boxSizing: 'border-box',
            marginTop: 26,
            padding: '10px 10px 10px 30px',
            borderRadius: theme.radius.pill,
            background: theme.color.ink,
            boxShadow: theme.shadow.card,
          }}
        >
          <div
            style={{
              minWidth: 0,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: fitFontSize(link, LINK_URL_TIERS),
              lineHeight: 1.2,
              color: theme.color.white,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {link}
          </div>
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: theme.radius.pill,
              background: theme.color.coral,
            }}
          >
            <svg
              width={30}
              height={30}
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.color.white}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ translate: `${nudge * 4}px ${nudge * -4}px` }}
            >
              {arrow > 0 ? (
                <>
                  <path d="M7 17L17 7" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arrow} />
                  <path d="M8 7h9v9" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arrow} />
                </>
              ) : null}
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: LinkCard,
  sample: {
    title: 'Repositório com o código do vídeo',
    url: 'https://github.com/MatheusChiodi',
    description: 'Tudo que eu mostro aqui está lá, pronto para clonar.',
    cta: 'Link na descrição',
  },
  defaultDuration: 5,
  description: 'Cartão de link quando a fala manda o espectador para a descrição (repositório, documentação, artigo).',
};
