import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { cardSurface, type FontTier, fitFontSize, rise } from './c1-kit';
import type { ComponentEntry } from './registry';

export interface QuoteProps {
  text: string;
  author?: string;
  role?: string;
}

export const QUOTE_TIERS: readonly FontTier[] = [
  { fontSize: 66, maxChars: 60 },
  { fontSize: 56, maxChars: 110 },
  { fontSize: 48, maxChars: 180 },
  { fontSize: 40, maxChars: 280 },
  { fontSize: 34, maxChars: Number.POSITIVE_INFINITY },
];

/** Tira as aspas que vierem no texto: o componente já desenha a sua. */
export function stripQuotes(text: string): string {
  return text.trim().replace(/^["“”«'‘]+/, '').replace(/["“”»'’]+$/, '').trim();
}

/** Autor e cargo limpos; sem autor não há atribuição (cargo sozinho não identifica ninguém). */
export function attribution(author?: string, role?: string): { author: string; role?: string } | undefined {
  const name = author?.trim();
  if (!name) return undefined;
  return { author: name, role: role?.trim() || undefined };
}

export const Quote: React.FC<QuoteProps & BaseProps> = ({ text, author, role, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const quote = stripQuotes(text);
  const credit = attribution(author, role);
  const mark = interpolate(frame, [0.1 * fps, 0.55 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: motion.pop });
  const rule = progressAt(frame, fps, 0.5, motion.slow);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 40,
          maxWidth: 1280,
          padding: '68px 88px 68px 72px',
          opacity: value,
          translate: `0 ${(1 - enter) * 36 - exit * 20}px`,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 150,
            height: 130,
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: 330,
            lineHeight: '300px',
            color: theme.color.coral,
            opacity: Math.min(1, mark * 1.5),
            scale: 0.6 + 0.4 * mark,
            transformOrigin: 'left top',
          }}
        >
          “
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <div
            style={{
              ...rise(progressAt(frame, fps, 0.2, motion.slow), 18),
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: fitFontSize(quote, QUOTE_TIERS),
              lineHeight: 1.24,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
              textWrap: 'balance',
              overflowWrap: 'anywhere',
            }}
          >
            {quote}
          </div>
          {credit ? (
            <div style={{ ...rise(progressAt(frame, fps, 0.5)), display: 'flex', alignItems: 'flex-start', gap: 22, marginTop: 36 }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 4,
                  marginTop: 20,
                  borderRadius: theme.radius.pill,
                  background: theme.color.ink,
                  scale: `${rule} 1`,
                  transformOrigin: 'left center',
                }}
              />
              <div style={{ minWidth: 0, fontFamily: theme.font.body, fontSize: 34, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                <span style={{ fontWeight: 600, color: theme.color.ink }}>{credit.author}</span>
                {credit.role ? <span style={{ fontWeight: 500, color: theme.color.slate600 }}>{` · ${credit.role}`}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Quote,
  sample: {
    text: 'Falar é fácil. Me mostre o código.',
    author: 'Linus Torvalds',
    role: 'criador do Linux e do Git',
  },
  defaultDuration: 6,
  vertical: { zone: 'top' },
  description: 'Citação literal de alguém (frase famosa, trecho de documentação, fala de entrevista) no momento em que é lida em voz alta.',
};
