import { AbsoluteFill, interpolate, interpolateColors } from 'remotion';

import { type BaseProps, usePresence } from '../anim';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface SubscribeCTAProps {
  text?: string;
  channel?: string;
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const CURSOR_TRAVEL = 0.7;
const PRESS_DOWN = 0.1;
const PRESS_UP = 0.25;

/** O clique cai no meio da duração; o cursor parte antes para chegar em cima do botão na hora. */
export function clickTimeline(totalSec: number): { cursorStart: number; clickAt: number; cursorEnd: number } {
  const clickAt = totalSec / 2;
  return { cursorStart: Math.max(0, clickAt - CURSOR_TRAVEL), clickAt, cursorEnd: clickAt + PRESS_UP + motion.base };
}

/** Escala do botão: afunda até o instante do clique e volta. */
export function pressScale(sec: number, clickAt: number): number {
  return interpolate(sec, [clickAt - PRESS_DOWN, clickAt, clickAt + PRESS_UP], [1, 0.93, 1], { ...clamp, easing: motion.move });
}

/** 0 = "Inscreva-se" (coral), 1 = "Inscrito" (ink). Vira no clique, nunca antes. */
export function subscribedAt(sec: number, clickAt: number): number {
  return interpolate(sec, [clickAt, clickAt + motion.fast], [0, 1], { ...clamp, easing: motion.enter });
}

const CHECK_LENGTH = 22;

const labelStyle: React.CSSProperties = {
  gridArea: '1 / 1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  whiteSpace: 'nowrap',
};

export const SubscribeCTA: React.FC<SubscribeCTAProps & BaseProps> = ({ text = 'Inscreva-se', channel = 'MChiodi', durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const sec = frame / fps;
  const { cursorStart, clickAt, cursorEnd } = clickTimeline(durationInFrames / fps);
  const subscribed = subscribedAt(sec, clickAt);
  const travel = interpolate(sec, [cursorStart, clickAt - PRESS_DOWN], [0, 1], { ...clamp, easing: motion.move });
  const cursorOpacity =
    interpolate(sec, [cursorStart, cursorStart + motion.fast], [0, 1], clamp) *
    interpolate(sec, [cursorEnd - motion.fast, cursorEnd], [1, 0], { ...clamp, easing: motion.exit });
  const ring = interpolate(sec, [clickAt, clickAt + motion.base], [0, 1], { ...clamp, easing: motion.enter });

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
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          maxWidth: 900,
          padding: '14px 14px 14px 16px',
          background: theme.color.paper,
          borderRadius: theme.radius.pill,
          boxShadow: theme.shadow.raised,
          opacity: value,
          translate: `0 ${(1 - enter) * 48 + exit * 24}px`,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.pill,
            background: theme.color.ink,
            color: theme.color.paper,
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: 38,
            lineHeight: 1,
          }}
        >
          {channel.trim().charAt(0).toUpperCase()}
        </div>
        <div
          style={{
            minWidth: 0,
            marginRight: 10,
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: 32,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: theme.color.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {channel}
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: theme.radius.pill,
              border: `3px solid ${theme.color.coral}`,
              opacity: (1 - ring) * (ring > 0 ? 0.7 : 0),
              scale: `${1 + ring * 0.16} ${1 + ring * 0.42}`,
            }}
          />
          <div
            style={{
              display: 'grid',
              height: 64,
              padding: '0 30px',
              borderRadius: theme.radius.pill,
              background: interpolateColors(subscribed, [0, 1], [theme.color.coral, theme.color.ink]),
              color: theme.color.white,
              fontFamily: theme.font.body,
              fontWeight: 800,
              fontSize: 28,
              lineHeight: 1,
              scale: String(pressScale(sec, clickAt)),
            }}
          >
            <div style={{ ...labelStyle, opacity: 1 - subscribed }}>{text}</div>
            <div style={{ ...labelStyle, opacity: subscribed }}>
              <svg width={30} height={30} viewBox="0 0 24 24" fill="none">
                <path
                  d="M4.5 12.5l5 5L19.5 7"
                  stroke={theme.color.emerald}
                  strokeWidth={3.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={CHECK_LENGTH}
                  strokeDashoffset={(1 - subscribed) * CHECK_LENGTH}
                />
              </svg>
              Inscrito
            </div>
          </div>
          <svg
            width={44}
            height={44}
            viewBox="0 0 24 24"
            style={{
              position: 'absolute',
              // a ponta pousa fora do texto do botão, para o rótulo continuar legível no clique
              left: '82%',
              top: '68%',
              opacity: cursorOpacity,
              translate: `${(1 - travel) * 70}px ${(1 - travel) * 54}px`,
              scale: String(pressScale(sec, clickAt)),
              transformOrigin: 'left top',
            }}
          >
            <path
              d="M4 2.5l15 8.2-6.6 1.7-1.9 6.6z"
              fill={theme.color.white}
              stroke={theme.color.ink}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: SubscribeCTA,
  sample: {
    text: 'Inscreva-se',
    channel: 'MChiodi',
  },
  defaultDuration: 4,
  description: 'Lembrete discreto de inscrição no canto da tela, depois de entregar o primeiro valor e no encerramento.',
};
