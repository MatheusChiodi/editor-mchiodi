import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';

import { type BaseProps, usePresence } from '../anim';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface MemeInsertProps {
  /** caminho relativo à pasta `assets/` (ex.: `memes/this-is-fine.png`) ou URL http(s) */
  src: string;
  caption?: string;
  position?: 'full' | 'corner';
}

const REMOTE = /^(?:https?:|data:)/i;

/** Aceita o caminho como a EDL costuma trazer (`assets/memes/x.png`, `\`, `./`) e devolve o relativo ao publicDir. */
export function normalizeAssetPath(src: string): string {
  if (REMOTE.test(src)) return src;
  return src
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(?:\.?\/)+/, '')
    .replace(/^assets\//i, '');
}

export function resolveMemeSrc(src: string): string {
  const path = normalizeAssetPath(src);
  return REMOTE.test(path) ? path : staticFile(path);
}

/** Rotação em graus: chega torta e assenta levemente inclinada. */
export function memeRotation(pop: number, position: 'full' | 'corner'): number {
  const [from, rest] = position === 'corner' ? [-9, 3] : [5, -1.5];
  return from + (rest - from) * pop;
}

const twoLines = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' } as const;

export const MemeInsert: React.FC<MemeInsertProps & BaseProps> = ({ src, caption, position = 'corner', durationInFrames }) => {
  const { frame, fps, enter, exit } = usePresence(durationInFrames);
  const pop = interpolate(frame, [0, motion.base * fps], [0, 1], {
    easing: motion.pop,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = (0.55 + 0.45 * pop) * (1 - 0.12 * exit);
  const opacity = Math.min(1, enter * 2) * (1 - exit);
  const rotate = `${memeRotation(pop, position)}deg`;
  const url = resolveMemeSrc(src);

  if (position === 'full') {
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ background: theme.color.night, opacity: 0.85 * enter * (1 - exit) }} />
        <AbsoluteFill
          style={{
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 36,
            padding: `${theme.safe.y}px ${theme.safe.x}px`,
            opacity,
          }}
        >
          <Img
            src={url}
            style={{
              display: 'block',
              maxWidth: 1500,
              maxHeight: caption ? 740 : 900,
              borderRadius: theme.radius.panel,
              boxShadow: theme.shadow.raised,
              scale: String(scale),
              rotate,
            }}
          />
          {caption ? (
            <div
              style={{
                ...twoLines,
                maxWidth: 1500,
                textAlign: 'center',
                fontFamily: theme.font.body,
                fontWeight: 800,
                fontSize: 52,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
                color: theme.color.white,
                translate: `0 ${(1 - enter) * 20}px`,
              }}
            >
              {caption}
            </div>
          ) : null}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        // folga extra: a polaroid inclinada não pode encostar na margem segura
        padding: `${theme.safe.y + 28}px ${theme.safe.x + 20}px`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: caption ? '20px 20px 0' : 20,
          background: theme.color.white,
          borderRadius: 6,
          boxShadow: theme.shadow.raised,
          opacity,
          scale: String(scale),
          rotate,
          transformOrigin: '70% 30%',
        }}
      >
        <Img src={url} style={{ display: 'block', maxWidth: 600, maxHeight: 440, minWidth: 320 }} />
        {caption ? (
          <div
            style={{
              // largura 0 + minWidth 100%: a legenda quebra na largura da imagem em vez de alargar a polaroid
              width: 0,
              minWidth: '100%',
              boxSizing: 'border-box',
              padding: '16px 4px 20px',
              textAlign: 'center',
              fontFamily: theme.font.body,
              fontWeight: 800,
              fontSize: 32,
              lineHeight: 1.3,
              color: theme.color.ink,
            }}
          >
            <div style={twoLines}>{caption}</div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const sample: MemeInsertProps = {
  src: 'memes/placeholder.png',
  caption: 'eu fazendo deploy na sexta às 18h',
  position: 'corner',
};

export const entry: ComponentEntry = {
  component: MemeInsert,
  sample: { ...sample },
  defaultDuration: 3,
  description: 'Imagem de meme em polaroid no canto ou em tela cheia; use no máximo 1 a cada 90s e só quando a piada já está na fala.',
};
