import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import { stageMotion } from '../arsenal/stage';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';
import { cue, leave, markupWords, NotePill, plainText, RichText, rise, wordReveal, wordTimes } from './stage-kit';

export interface PhraseRevealProps {
  /** frase curta; `*trecho*` sai em itálico coral, `\n` quebra a linha */
  text: string;
  /** pílula pequena acima da frase (o contexto: "o mais interessante") */
  eyebrow?: string;
  side?: 'left' | 'right' | 'center';
  /** segundos, relativos ao início do overlay, em que cada palavra é dita */
  wordAt?: number[];
  /** `footage`: branco sobre o vídeo; `paper`: ink sobre papel (dentro de um palco) */
  surface?: 'footage' | 'paper';
}

export const WORD_START = 0.25;
/** defasagem da cascata quando não há `wordAt` (3,5 f, medida) */
export const WORD_STEP = stageMotion.word.stepSec;
/** ≈ 13% da altura do quadro, como a frase grande da referência */
export const PHRASE_MAX = 140;

/** Frase longa encolhe para caber em até 3 linhas na meia tela ao lado do rosto. */
export function phraseFontSize(text: string): number {
  const length = plainText(text).length;
  return length <= 22 ? PHRASE_MAX : Math.max(72, Math.round(PHRASE_MAX * Math.sqrt(22 / length)));
}

/**
 * Frase-chave em serifada grande, revelada palavra por palavra no ritmo da fala, com o trecho de
 * sentido em itálico coral. Fica ao lado do rosto, nunca em cima dele.
 */
export const PhraseReveal: React.FC<PhraseRevealProps & BaseProps> = ({ text, eyebrow, side = 'left', wordAt = [], surface = 'footage', durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = markupWords(text);
  // cada palavra entra quando é dita (`wordAt`); sem ele, cascata fixa depois do rótulo
  const times = wordTimes(wordAt, words.length, eyebrow ? WORD_START + 0.3 : WORD_START);
  const out = leave(frame, fps, durationInFrames);
  const footage = surface === 'footage';
  const align = side === 'center' ? 'center' : side === 'right' ? 'flex-end' : 'flex-start';
  const whole = cue(frame, fps, 0, 0.4);

  return (
    <AbsoluteFill>
      {footage ? (
        // escurece só o lado do texto: a frase lê em qualquer cenário sem precisar de contorno
        <AbsoluteFill
          style={{
            background:
              side === 'center'
                ? 'radial-gradient(60% 55% at 50% 45%, rgba(12,12,12,0.6), rgba(12,12,12,0))'
                : `linear-gradient(${side === 'left' ? 90 : 270}deg, rgba(12,12,12,0.72) 0%, rgba(12,12,12,0.4) 32%, rgba(12,12,12,0) 58%)`,
            opacity: whole * (1 - out),
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: align,
          gap: 26,
          padding: `${theme.safe.y}px ${theme.safe.x}px 220px`,
          // saída medida: só opacidade, tudo junto
          opacity: 1 - out,
        }}
      >
        {eyebrow ? <NotePill text={eyebrow} tone={footage ? 'paper' : 'ink'} fontSize={34} compact progress={rise(frame, fps, 0.05)} /> : null}
        <RichText
          text={text}
          color={footage ? theme.color.white : theme.color.ink}
          reveal={(index) => wordReveal(frame / fps - times[index]!, stageMotion.word.risePhrase)}
          style={{
            maxWidth: side === 'center' ? 1400 : 860,
            fontSize: phraseFontSize(text),
            lineHeight: 1,
            textAlign: side === 'center' ? 'center' : side,
            textShadow: footage ? '0 4px 28px rgba(12,12,12,0.6)' : undefined,
            opacity: whole,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: PhraseReveal,
  sample: { text: 'Sem abrir\no *terminal.*', eyebrow: 'o mais interessante', side: 'left', wordAt: [0.6, 0.9, 1.3, 1.6] },
  defaultDuration: 4.5,
  vertical: { zone: 'top' },
  description:
    'Frase-chave em serifada grande ao lado do rosto, revelada palavra por palavra no ritmo da fala, com o trecho de sentido em itálico coral (`*assim*`). Padrão obrigatório do nível max.',
};
