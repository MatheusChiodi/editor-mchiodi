import { useCurrentFrame, useVideoConfig } from 'remotion';

import { theme } from '../theme';
import { Eyebrow } from './Pill';
import { enter, rise } from './timing';
import { text as sizes, type Tone, toneColors } from './tokens';
import { Words, wordsEnd } from './Words';

export interface StatementProps {
  text: string;
  /** trecho de `text` em coral: o único acento da tela */
  accent?: string;
  eyebrow?: string;
  eyebrowColor?: 'slate' | 'coral';
  support?: string;
  /** segundo (relativo à cena) em que a frase começa a entrar */
  atSec?: number;
  fontSize?: number;
  align?: 'center' | 'left';
  maxWidth?: number;
  tone?: Tone;
}

/** Tempos internos da frase: eyebrow, depois o título palavra a palavra, depois o apoio. */
export function statementTimes(text: string, atSec = 0, hasEyebrow = false): { eyebrow: number; title: number; support: number } {
  const title = atSec + (hasEyebrow ? 0.15 : 0);
  return { eyebrow: atSec, title, support: wordsEnd(text, title) + 0.3 };
}

/** Uma frase grande em Playfair, palavra por palavra, com um trecho em coral. */
export const Statement: React.FC<StatementProps> = ({
  text,
  accent,
  eyebrow,
  eyebrowColor = 'slate',
  support,
  atSec = 0,
  fontSize = sizes.statement,
  align = 'center',
  maxWidth = 1500,
  tone = 'paper',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = toneColors(tone);
  const times = statementTimes(text, atSec, Boolean(eyebrow));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
        gap: fontSize * 0.3,
        maxWidth,
      }}
    >
      {eyebrow ? (
        <Eyebrow tone={tone} color={eyebrowColor} progress={enter(frame, fps, times.eyebrow)}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      <div
        style={{
          fontFamily: theme.font.display,
          fontWeight: 600,
          fontSize,
          lineHeight: 1.12,
          letterSpacing: '-0.01em',
          color: colors.title,
        }}
      >
        <Words text={text} accent={accent} delay={times.title} />
      </div>
      {support ? (
        <div
          style={{
            maxWidth: maxWidth * 0.8,
            fontFamily: theme.font.body,
            fontWeight: 500,
            fontSize: sizes.body,
            lineHeight: 1.4,
            color: colors.text,
            ...rise(enter(frame, fps, times.support)),
          }}
        >
          {support}
        </div>
      ) : null}
    </div>
  );
};
