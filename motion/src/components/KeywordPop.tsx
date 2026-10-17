import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { techFor } from '../tech/glyph';
import { TechIcon } from '../tech/TechIcon';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';
import { withAlpha } from './SectionTitle';

export type KeywordPosition = 'center' | 'left' | 'right';

export interface KeywordPopProps {
  word: string;
  sub?: string;
  position?: KeywordPosition;
  /** false: palavra que é o nome de uma tecnologia não ganha o logo sozinha */
  autoTechIcons?: boolean;
}

/** largura média de um caractere de Inter 800, em em; folgada para caber caixa alta */
const CHAR_EM = 0.68;
export const KEYWORD_MAX = 300;
export const KEYWORD_MIN = 72;

/** Largura útil: a tela dentro da margem segura no centro, ou a metade dela quando vai para um lado. */
export function keywordMaxWidth(position: KeywordPosition = 'center'): number {
  const full = 1920 - 2 * theme.safe.x;
  return position === 'center' ? full : Math.round(full * 0.52);
}

/** Maior corpo (múltiplo de 4) em que a palavra cabe numa linha só, dentro dos limites. */
export function keywordFontSize(word: string, position: KeywordPosition = 'center'): number {
  const length = Math.max(1, word.trim().length);
  const fit = keywordMaxWidth(position) / (length * CHAR_EM);
  return Math.max(KEYWORD_MIN, Math.min(KEYWORD_MAX, Math.floor(fit / 4) * 4));
}

/** Contorno proporcional ao corpo, como nas legendas (9 px em 58). */
export function outlineWidth(fontSize: number): number {
  return Math.max(10, Math.min(30, Math.round(fontSize * 0.14)));
}

const ALIGN = { center: 'center', left: 'flex-start', right: 'flex-end' } as const;

export const KeywordPop: React.FC<KeywordPopProps & BaseProps> = ({ word, sub, position = 'center', autoTechIcons = true, durationInFrames }) => {
  const { frame, fps, exit, value } = usePresence(durationInFrames, motion.fast);
  const text = word.trim();
  const caption = sub?.trim();
  const fontSize = keywordFontSize(text, position);
  const pop = interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: motion.pop });
  const bar = progressAt(frame, fps, 0.25, motion.slow);
  const subIn = progressAt(frame, fps, 0.35);
  const tech = techFor(text, undefined, autoTechIcons);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: ALIGN[position], paddingLeft: theme.safe.x, paddingRight: theme.safe.x }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: ALIGN[position],
          maxWidth: keywordMaxWidth(position),
          opacity: value,
          translate: `0 ${exit * -24}px`,
        }}
      >
        {/* palavra-chave que é uma tecnologia ("React"): o logo, em ladrilho, entra junto e acima dela */}
        {tech ? <TechIcon name={tech.id} variant="brand" size={Math.round(Math.min(168, Math.max(112, fontSize * 0.7)))} progress={Math.min(1, pop)} style={{ marginBottom: 22 }} /> : null}
        <div
          style={{
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            color: theme.color.white,
            WebkitTextStroke: `${outlineWidth(fontSize)}px ${theme.color.ink}`,
            paintOrder: 'stroke fill',
            textShadow: '0 10px 30px rgba(0,0,0,0.45)',
            scale: 0.82 + 0.18 * pop,
            transformOrigin: `${position === 'center' ? 'center' : position} bottom`,
          }}
        >
          {text}
        </div>
        <div
          style={{
            width: Math.round(fontSize * 1.1),
            height: Math.max(8, Math.round(fontSize * 0.07)),
            marginTop: Math.round(fontSize * 0.08),
            borderRadius: theme.radius.pill,
            background: theme.color.coral,
            boxShadow: `0 0 0 4px ${theme.color.ink}`,
            scale: `${bar} 1`,
            transformOrigin: `${position === 'center' ? 'center' : position} center`,
          }}
        />
        {caption ? (
          <div
            style={{
              marginTop: 30,
              padding: '14px 32px 16px',
              borderRadius: theme.radius.pill,
              background: withAlpha(theme.color.ink, 0.94),
              boxShadow: theme.shadow.card,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: 40,
              lineHeight: 1.25,
              color: theme.color.paper,
              textAlign: position === 'center' ? 'center' : position,
              overflowWrap: 'anywhere',
              opacity: subIn,
              translate: `0 ${(1 - subIn) * 14}px`,
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
  component: KeywordPop,
  sample: {
    word: 'Latência',
    sub: 'o tempo entre pedir e receber',
  },
  defaultDuration: 2.5,
  vertical: { zone: 'top', scale: 0.6 },
  description: 'Uma única palavra-chave gigante no instante em que é dita, para cravar o conceito central da frase.',
};
