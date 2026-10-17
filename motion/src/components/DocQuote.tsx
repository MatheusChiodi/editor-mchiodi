import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import { stageMotion } from '../arsenal/stage';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';
import { cue, leave, NotePill, pillTilt, type PillTone, plainText, resolveTone, RichText, rise } from './stage-kit';

export interface DocQuoteProps {
  /** de onde vem o trecho ("docs oficiais · code.claude.com") */
  source?: string;
  title?: string;
  /** trecho citado; `==assim==` recebe o marca-texto */
  text: string;
  /** segundos, relativos ao início do overlay, em que o marca-texto começa a correr (quando o trecho é lido) */
  markAt?: number;
  note?: { text: string; tone?: PillTone; at?: number };
  tone?: 'ink' | 'paper';
  /** `left` deixa o lado direito livre para o cartão do apresentador */
  align?: 'left' | 'center';
}

export const MARK_SEC = 0.9;
/** inclinação medida do recorte */
export const CARD_TILT = -0.86;
/** fita: 129×38 px a ±37°, quase opaca, cantos retos */
export const TAPE = { width: 129, height: 38, angle: 37, alpha: 0.8 } as const;

/** Citação longa encolhe: o cartão nunca passa de ~7 linhas. */
export function quoteFontSize(text: string): number {
  const length = plainText(text).length;
  return length <= 170 ? 40 : Math.max(30, Math.round(40 * Math.sqrt(170 / length)));
}

/** O marca-texto começa em `markAt` ou, sem ele, logo depois que o cartão pousa. */
export function markStart(markAt: number | undefined): number {
  return markAt !== undefined && Number.isFinite(markAt) && markAt >= 0 ? markAt : 1.2;
}

const Tape: React.FC<{ side: 'left' | 'right' }> = ({ side }) => (
  <div
    style={{
      position: 'absolute',
      top: -26,
      [side]: -50,
      width: TAPE.width,
      height: TAPE.height,
      background: `rgba(255,85,85,${TAPE.alpha})`,
      rotate: `${side === 'left' ? -TAPE.angle : TAPE.angle}deg`,
      boxShadow: '0 4px 10px rgba(15,23,42,0.2)',
    }}
  />
);

/**
 * Trecho de documentação num cartão colado com fita, com o marca-texto correndo sobre a frase que
 * importa no instante em que ela é lida: a prova de que a afirmação vem da fonte.
 */
export const DocQuote: React.FC<DocQuoteProps & BaseProps> = ({ source, title, text, markAt, note, tone = 'ink', align = 'left', durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // entrada medida do recorte: fade + subida de 66 px em 10 f, sem escala
  const appear = rise(frame, fps, 0.2, stageMotion.doc.sec);
  const out = leave(frame, fps, durationInFrames);
  const ink = tone === 'ink';
  const start = markStart(markAt);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: 26,
        padding: `${theme.safe.y}px ${theme.safe.x}px 150px`,
        opacity: 1 - out,
      }}
    >
      {source ? <NotePill text={source} tone="paper" fontSize={32} compact progress={rise(frame, fps, 0.2)} /> : null}
      <div
        style={{
          position: 'relative',
          width: 1240,
          padding: '48px 56px 52px',
          background: ink ? '#17171c' : theme.color.white,
          // foto colada: moldura creme de 12 px, quase sem raio, sombra longa
          border: `12px solid ${theme.color.paper}`,
          borderRadius: 3,
          boxShadow: '0 24px 60px rgba(15,23,42,0.30)',
          opacity: Math.min(1, appear * 2),
          rotate: `${CARD_TILT}deg`,
          translate: `0 ${(1 - appear) * stageMotion.doc.rise}px`,
        }}
      >
        <Tape side="left" />
        <Tape side="right" />
        {title ? (
          <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: 58, lineHeight: 1.1, color: ink ? theme.color.white : theme.color.ink, marginBottom: 22 }}>
            {title}
          </div>
        ) : null}
        <RichText
          text={text}
          color={ink ? theme.color.slate300 : theme.color.slate600}
          mark={cue(frame, fps, start, MARK_SEC)}
          style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: quoteFontSize(text), lineHeight: 1.5, letterSpacing: 0 }}
        />
      </div>
      {note?.text ? (
        <NotePill text={note.text} tone={resolveTone(note.tone, 'coral')} tilt={pillTilt(0, 'conclusion')} from="bottom" progress={rise(frame, fps, note.at ?? start + MARK_SEC + 0.3)} />
      ) : null}
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: DocQuote,
  sample: {
    source: 'docs oficiais · code.claude.com',
    title: 'Mods overview',
    text: 'Add panes, commands, and tool call rules to Claude Code with a mod. ==A mod is a plugin that changes how Claude Code looks and behaves.== It is made of JavaScript or TypeScript event handlers.',
    markAt: 1.6,
    note: { text: 'o agente muda o próprio sistema', at: 3.2 },
  },
  defaultDuration: 7,
  vertical: { zone: 'top', scale: 0.75 },
  description:
    'Trecho de documentação num cartão colado com fita, com marca-texto correndo sobre a frase que importa (`==assim==`) quando ela é lida, e uma pílula de conclusão. Combine com `presenter: { "slot": "pip-br" }`. Padrão obrigatório do nível max.',
};
