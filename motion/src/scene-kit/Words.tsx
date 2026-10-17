import { useCurrentFrame, useVideoConfig } from 'remotion';

import { theme } from '../theme';
import { enter, rise } from './timing';
import { WORD_STAGGER } from './tokens';

export interface MarkedWord {
  word: string;
  accent: boolean;
}

/** Quebra o texto em palavras e marca as que pertencem ao trecho `accent` (primeira ocorrência). */
export function markWords(text: string, accent?: string): MarkedWord[] {
  const start = accent ? text.indexOf(accent) : -1;
  const end = start < 0 || !accent ? -1 : start + accent.length;
  return [...text.matchAll(/\S+/g)].map((match) => ({
    word: match[0],
    accent: match.index >= start && match.index < end,
  }));
}

/** Atraso (s) da i-ésima palavra. */
export function wordDelay(index: number, startSec = 0, stepSec: number = WORD_STAGGER): number {
  return startSec + index * stepSec;
}

/** Momento em que a última palavra começa a entrar: âncora para o que vem depois do texto. */
export function wordsEnd(text: string, startSec = 0, stepSec: number = WORD_STAGGER): number {
  return wordDelay(Math.max(0, markWords(text).length - 1), startSec, stepSec);
}

export interface MaskedWordProps {
  progress: number;
  color?: string;
  children: React.ReactNode;
}

/** Palavra que sobe por trás de uma máscara, como o hero do site. */
export const MaskedWord: React.FC<MaskedWordProps> = ({ progress, color, children }) => (
  // o padding dá espaço a descendentes e serifas (g, ç, f) que a máscara cortaria; a margem negativa devolve o espaço
  <span
    style={{
      display: 'inline-block',
      overflow: 'hidden',
      verticalAlign: 'bottom',
      padding: '0.1em 0.06em 0.16em',
      margin: '-0.1em -0.06em -0.16em',
    }}
  >
    <span style={{ display: 'inline-block', color, translate: `0px ${((1 - progress) * 115).toFixed(2)}%` }}>{children}</span>
  </span>
);

export interface WordsProps {
  text: string;
  /** trecho do texto que recebe a cor de acento */
  accent?: string;
  accentColor?: string;
  /** segundo (relativo à cena) em que a primeira palavra entra */
  delay?: number;
  step?: number;
  mode?: 'mask' | 'rise';
}

/** Texto revelado palavra a palavra. `mask` para títulos; `rise` para frases de apoio. */
export const Words: React.FC<WordsProps> = ({ text, accent, accentColor = theme.color.coral, delay = 0, step = WORD_STAGGER, mode = 'mask' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = markWords(text, accent);

  return (
    <>
      {words.map((item, index) => {
        const progress = enter(frame, fps, wordDelay(index, delay, step), mode === 'mask' ? 0.6 : 0.5);
        const color = item.accent ? accentColor : undefined;
        const gap = index < words.length - 1 ? '0.25em' : 0;
        return mode === 'mask' ? (
          <span key={index} style={{ display: 'inline-block', marginRight: gap }}>
            <MaskedWord progress={progress} color={color}>
              {item.word}
            </MaskedWord>
          </span>
        ) : (
          <span key={index} style={{ display: 'inline-block', marginRight: gap, color, ...rise(progress, 24) }}>
            {item.word}
          </span>
        );
      })}
    </>
  );
};
