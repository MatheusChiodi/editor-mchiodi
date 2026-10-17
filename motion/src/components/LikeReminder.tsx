import { AbsoluteFill, interpolate, interpolateColors } from 'remotion';

import { type BaseProps, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { clamp } from './c3-kit';
import type { ComponentEntry } from './registry';
import { clickTimeline, pressScale, subscribedAt } from './SubscribeCTA';

export interface LikeReminderProps {
  text?: string;
}

const POP_SEC = 0.45;

/** Escala do joinha: afunda com o clique e volta passando um pouco do tamanho (o único "pop" do componente). */
export function likePop(sec: number, clickAt: number): number {
  if (sec <= clickAt) return pressScale(sec, clickAt);
  return interpolate(sec, [clickAt, clickAt + POP_SEC], [0.93, 1], { ...clamp, easing: motion.pop });
}

/** Anel que se abre a partir do ícone no clique: raio 0→1 e opacidade que some junto. */
export function likeRing(sec: number, clickAt: number): { scale: number; opacity: number } {
  const ring = interpolate(sec, [clickAt, clickAt + motion.base], [0, 1], { ...clamp, easing: motion.enter });
  return { scale: 1 + ring * 0.5, opacity: ring > 0 ? (1 - ring) * 0.7 : 0 };
}

const THUMB_BODY =
  'M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z';

export const LikeReminder: React.FC<LikeReminderProps & BaseProps> = ({ text = 'Curtiu? Deixa o like', durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const sec = frame / fps;
  const { cursorStart, clickAt, cursorEnd } = clickTimeline(durationInFrames / fps);
  const liked = subscribedAt(sec, clickAt);
  const ring = likeRing(sec, clickAt);
  const travel = interpolate(sec, [cursorStart, clickAt - 0.1], [0, 1], { ...clamp, easing: motion.move });
  const cursorOpacity =
    interpolate(sec, [cursorStart, cursorStart + motion.fast], [0, 1], clamp) *
    interpolate(sec, [cursorEnd - motion.fast, cursorEnd], [1, 0], { ...clamp, easing: motion.exit });
  const stroke = interpolateColors(liked, [0, 1], [theme.color.ink, theme.color.coral]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        paddingLeft: theme.safe.x,
        paddingBottom: theme.safe.y + 40,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          maxWidth: 900,
          padding: '14px 38px 14px 14px',
          background: theme.color.paper,
          borderRadius: theme.radius.pill,
          boxShadow: theme.shadow.raised,
          opacity: value,
          translate: `0 ${(1 - enter) * 48 + exit * 24}px`,
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0, width: 72, height: 72 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: theme.radius.pill,
              border: `3px solid ${theme.color.coral}`,
              opacity: ring.opacity,
              scale: String(ring.scale),
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.pill,
              background: theme.color.white,
              border: `1px solid ${theme.color.slate300}`,
              scale: String(likePop(sec, clickAt)),
            }}
          >
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d={THUMB_BODY} fill={theme.color.coral} fillOpacity={liked} stroke={stroke} />
              {/* o punho é um traço interno: com o joinha preenchido ele precisa clarear para continuar visível */}
              <path d="M7 10v12" stroke={interpolateColors(liked, [0, 1], [theme.color.ink, theme.color.white])} />
            </svg>
          </div>
          <svg
            width={44}
            height={44}
            viewBox="0 0 24 24"
            style={{
              position: 'absolute',
              left: '58%',
              top: '62%',
              opacity: cursorOpacity,
              translate: `${(1 - travel) * 80}px ${(1 - travel) * 50}px`,
              scale: String(pressScale(sec, clickAt)),
              transformOrigin: 'left top',
            }}
          >
            <path d="M4 2.5l15 8.2-6.6 1.7-1.9 6.6z" fill={theme.color.white} stroke={theme.color.ink} strokeWidth={1.8} strokeLinejoin="round" />
          </svg>
        </div>
        <div
          style={{
            minWidth: 0,
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: 34,
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            color: theme.color.ink,
            overflowWrap: 'anywhere',
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: LikeReminder,
  sample: {
    text: 'Curtiu? Deixa o like',
  },
  defaultDuration: 4,
  description: 'Lembrete compacto de curtir no canto inferior esquerdo, logo depois de uma dica que funcionou; no máximo uma vez por vídeo.',
};
