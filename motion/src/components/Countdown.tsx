import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { clamp, clamp01 } from './c3-kit';
import type { ComponentEntry } from './registry';

export interface CountdownProps {
  from: number;
  label?: string;
  endLabel?: string;
}

/** Segundos inteiros de partida (nunca negativo). */
export function countdownStart(from: number): number {
  return Number.isFinite(from) ? Math.max(0, Math.floor(from)) : 0;
}

/** Número na tela: troca a cada segundo real e para em 0. */
export function countdownNumber(frame: number, fps: number, from: number): number {
  return Math.max(0, countdownStart(from) - Math.floor(Math.max(0, frame) / fps));
}

/** Fração do tempo já consumida (0–1). É linear de propósito: aqui o anel é um relógio. */
export function countdownProgress(frame: number, fps: number, from: number): number {
  const start = countdownStart(from);
  return start === 0 ? 1 : clamp01(frame / (start * fps));
}

/** Posição (0–1) dentro do segundo corrente: dá o "tique" de cada troca de número. */
export function tickPhase(frame: number, fps: number): number {
  const sec = Math.max(0, frame) / fps;
  return sec - Math.floor(sec);
}

/** Corpo do texto final, que divide o mesmo disco com o número. */
export function endFontSize(text: string): number {
  const length = text.trim().length;
  if (length <= 5) return 84;
  if (length <= 9) return 58;
  return 42;
}

const DISC = 380;
const RADIUS = 164;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const Countdown: React.FC<CountdownProps & BaseProps> = ({ from, label, endLabel, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const start = countdownStart(from);
  const current = countdownNumber(frame, fps, from);
  const consumed = countdownProgress(frame, fps, from);
  const finished = frame >= start * fps;
  const tick = interpolate(tickPhase(frame, fps), [0, 0.3], [0, 1], { ...clamp, easing: motion.enter });
  const done = interpolate(frame, [start * fps, (start + motion.slow) * fps], [0, 1], { ...clamp, easing: motion.enter });
  const ending = finished && endLabel ? endLabel : undefined;
  // depois do zero não há mais tique: o que entra é o estado final, uma vez só
  const pulse = finished ? done : tick;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x + 40 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          opacity: value,
          scale: String(0.92 + 0.08 * enter - 0.04 * exit),
        }}
      >
        <div
          style={{
            position: 'relative',
            width: DISC,
            height: DISC,
            borderRadius: theme.radius.pill,
            background: theme.color.paper,
            boxShadow: theme.shadow.raised,
          }}
        >
          <svg width={DISC} height={DISC} viewBox={`0 0 ${DISC} ${DISC}`} style={{ position: 'absolute', inset: 0 }}>
            <circle cx={DISC / 2} cy={DISC / 2} r={RADIUS} fill="none" stroke={theme.color.slate300} strokeOpacity={0.5} strokeWidth={STROKE} />
            {consumed < 1 ? (
              <circle
                cx={DISC / 2}
                cy={DISC / 2}
                r={RADIUS}
                fill="none"
                stroke={theme.color.coral}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${(1 - consumed) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                transform={`rotate(-90 ${DISC / 2} ${DISC / 2})`}
              />
            ) : null}
            {/* chegou a zero: o anel fecha em emerald, que no canal significa "valendo" */}
            {done > 0 ? (
              <circle
                cx={DISC / 2}
                cy={DISC / 2}
                r={RADIUS}
                fill="none"
                stroke={theme.color.emerald}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${done * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                transform={`rotate(-90 ${DISC / 2} ${DISC / 2})`}
              />
            ) : null}
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: theme.color.ink,
              opacity: 0.35 + 0.65 * pulse,
              scale: String(0.9 + 0.1 * pulse),
            }}
          >
            {ending ? (
              <div
                style={{
                  fontFamily: theme.font.display,
                  fontWeight: 600,
                  fontSize: endFontSize(ending),
                  lineHeight: 1.1,
                  letterSpacing: '-0.01em',
                  overflowWrap: 'anywhere',
                }}
              >
                {ending}
              </div>
            ) : (
              <div
                style={{
                  fontFamily: theme.font.body,
                  fontWeight: 800,
                  fontSize: current > 99 ? 124 : 176,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {current}
              </div>
            )}
          </div>
        </div>
        {label ? (
          <div
            style={{
              maxWidth: 560,
              padding: '12px 30px',
              // raio fixo: vira pílula com uma linha e continua um cartão arredondado quando o rótulo quebra
              borderRadius: 31,
              background: theme.color.paper,
              boxShadow: theme.shadow.card,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: 30,
              lineHeight: 1.25,
              textAlign: 'center',
              color: theme.color.ink,
              overflowWrap: 'anywhere',
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Countdown,
  sample: {
    from: 5,
    label: 'Tente achar o bug antes do zero',
    endLabel: 'Tempo!',
  },
  defaultDuration: 6.5,
  description: 'Contagem regressiva em segundos reais para desafios e pausas ("pause e tente"); a duração deve ser `from` + ~1,5 s.',
};
