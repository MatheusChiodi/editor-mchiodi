import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { cardSurface, type FontTier, fitFontSize, rise } from './c1-kit';
import type { ComponentEntry } from './registry';

export interface QuestionCardProps {
  question: string;
  hint?: string;
}

export const QUESTION_TIERS: readonly FontTier[] = [
  { fontSize: 88, maxChars: 36 },
  { fontSize: 72, maxChars: 64 },
  { fontSize: 58, maxChars: 110 },
  { fontSize: 46, maxChars: Number.POSITIVE_INFINITY },
];

/** Pergunta sempre termina em "?": é o que a identifica mesmo sem ouvir a fala. */
export function asQuestion(text: string): string {
  const clean = text.trim().replace(/[.!…\s]+$/, '');
  if (!clean) return '';
  return clean.endsWith('?') ? clean : `${clean}?`;
}

export const QuestionCard: React.FC<QuestionCardProps & BaseProps> = ({ question, hint, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const text = asQuestion(question);
  const note = hint?.trim();
  const mark = interpolate(frame, [0.2 * fps, 0.7 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: motion.pop });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          alignItems: 'center',
          gap: 56,
          width: 1400,
          padding: '68px 72px 72px 84px',
          opacity: value,
          translate: `0 ${(1 - enter) * 36 - exit * 20}px`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...rise(progressAt(frame, fps, 0.15, motion.slow), 20),
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: fitFontSize(text, QUESTION_TIERS),
              lineHeight: 1.16,
              letterSpacing: '-0.015em',
              color: theme.color.slate900,
              overflowWrap: 'anywhere',
            }}
          >
            {text}
          </div>
          {note ? (
            <div
              style={{
                ...rise(progressAt(frame, fps, 0.45)),
                marginTop: 28,
                fontFamily: theme.font.body,
                fontWeight: 500,
                fontSize: 36,
                lineHeight: 1.34,
                color: theme.color.slate600,
                overflowWrap: 'anywhere',
              }}
            >
              {note}
            </div>
          ) : null}
        </div>
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 220,
            height: 300,
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: 380,
            lineHeight: 1,
            color: theme.color.coral,
            opacity: Math.min(1, mark * 1.5),
            scale: 0.7 + 0.3 * mark,
            rotate: '8deg',
          }}
        >
          ?
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: QuestionCard,
  sample: {
    question: 'Você sabe o que acontece quando digita uma URL e aperta Enter?',
    hint: 'Responde nos comentários antes de continuar.',
  },
  defaultDuration: 6,
  description: 'Pergunta feita diretamente ao espectador (gancho, pausa para pensar, chamada para comentar).',
};
