import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { activeIndex } from './BulletList';
import { cardSurface, rise, sequenceTimes, status } from './c1-kit';
import type { ComponentEntry } from './registry';

export interface TimelineEvent {
  date: string;
  title: string;
  detail?: string;
}

export interface TimelineProps {
  title?: string;
  events: TimelineEvent[];
  /** índice (a partir de 0) do marco em destaque; sem ele, o destaque acompanha o último marco revelado */
  active?: number;
  /** segundos, relativos ao início do overlay, em que cada marco aparece */
  revealAt?: number[];
}

export const TIMELINE_START = 0.5;
export const TIMELINE_STEP = 0.8;

/** Centro (px) de cada marco: a largura é dividida em colunas iguais e o marco fica no meio da sua. */
export function timelinePositions(count: number, width: number): number[] {
  return Array.from({ length: count }, (_, index) => ((index + 0.5) * width) / count);
}

/**
 * Até onde a linha já foi desenhada (px). Ela nasce no primeiro marco e avança um trecho
 * a cada marco que entra, na proporção do progresso de entrada dele.
 */
export function lineExtent(positions: readonly number[], progresses: readonly number[]): number {
  let extent = positions[0] ?? 0;
  for (let index = 1; index < positions.length; index++) {
    extent += (positions[index]! - positions[index - 1]!) * Math.min(1, Math.max(0, progresses[index] ?? 0));
  }
  return extent;
}

/** Corpos por quantidade de marcos: mais marcos, colunas mais estreitas, texto menor (nunca abaixo de 24). */
export function timelineScale(count: number): { title: number; detail: number; date: number } {
  if (count <= 3) return { title: 36, detail: 28, date: 26 };
  if (count === 4) return { title: 32, detail: 26, date: 24 };
  return { title: 28, detail: 24, date: 24 };
}

/** Marco em destaque: o `active` informado (se existir na lista) ou o último já revelado. */
export function highlightedEvent(count: number, times: readonly number[], sec: number, active?: number): number {
  if (active !== undefined && Number.isInteger(active) && active >= 0 && active < count) return active;
  return activeIndex(times, sec);
}

const INNER_WIDTH = 1600;
const DOT = 26;
const RAIL = 4;

export const Timeline: React.FC<TimelineProps & BaseProps> = ({ title, events, active, revealAt, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const sec = frame / fps;
  const times = sequenceTimes(events.length, revealAt, TIMELINE_START, TIMELINE_STEP);
  const positions = timelinePositions(events.length, INNER_WIDTH);
  const progresses = times.map((time) => progressAt(frame, fps, time, motion.slow));
  const extent = lineExtent(positions, progresses);
  const highlighted = highlightedEvent(events.length, times, sec, active);
  const scale = timelineScale(events.length);
  const first = positions[0] ?? 0;
  const last = positions[positions.length - 1] ?? 0;
  const column = events.length > 0 ? INNER_WIDTH / events.length : INNER_WIDTH;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          width: INNER_WIDTH,
          boxSizing: 'content-box',
          padding: '44px 56px 52px',
          opacity: value,
          translate: `0 ${(1 - enter) * 40 + exit * 20}px`,
        }}
      >
        {title ? (
          <div
            style={{
              marginBottom: 36,
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: 46,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: theme.color.ink,
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          {events.map((event, index) => (
            <div
              key={index}
              style={{
                ...rise(progresses[index]!, -10),
                width: column,
                padding: '0 14px',
                boxSizing: 'border-box',
                textAlign: 'center',
                fontFamily: theme.font.body,
                fontWeight: 600,
                fontSize: scale.date,
                lineHeight: 1.25,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: index === highlighted ? theme.color.ink : status.slate500,
                overflowWrap: 'anywhere',
              }}
            >
              {event.date}
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', height: DOT + 12, margin: '14px 0 16px' }}>
          <div
            style={{
              position: 'absolute',
              left: first,
              top: (DOT + 12 - RAIL) / 2,
              width: Math.max(0, last - first),
              height: RAIL,
              borderRadius: theme.radius.pill,
              background: theme.color.slate300,
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: first,
              top: (DOT + 12 - RAIL) / 2,
              width: Math.max(0, extent - first),
              height: RAIL,
              borderRadius: theme.radius.pill,
              background: theme.color.ink,
            }}
          />
          {events.map((_, index) => {
            const on = index === highlighted;
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: positions[index]! - DOT / 2,
                  top: 6,
                  width: DOT,
                  height: DOT,
                  boxSizing: 'border-box',
                  borderRadius: theme.radius.pill,
                  background: on ? theme.color.coral : theme.color.ink,
                  border: `5px solid ${theme.color.paper}`,
                  boxShadow: `0 0 0 2px ${on ? theme.color.coral : theme.color.ink}`,
                  scale: String(progresses[index]! * (on ? 1.15 : 1)),
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {events.map((event, index) => (
            <div
              key={index}
              style={{
                ...rise(progresses[index]!),
                width: column,
                padding: '0 14px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                textAlign: 'center',
                fontFamily: theme.font.body,
                overflowWrap: 'anywhere',
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: scale.title,
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                  color: index === highlighted ? theme.color.ink : theme.color.slate600,
                }}
              >
                {event.title}
              </div>
              {event.detail ? (
                <div style={{ fontWeight: 500, fontSize: scale.detail, lineHeight: 1.3, color: theme.color.slate600 }}>{event.detail}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Timeline,
  sample: {
    title: 'Como o front-end chegou até aqui',
    events: [
      { date: '2006', title: 'jQuery', detail: 'O DOM deixa de doer' },
      { date: '2013', title: 'React', detail: 'A interface vira função do estado' },
      { date: '2016', title: 'Next.js', detail: 'Renderização no servidor volta' },
      { date: '2020', title: 'Vite', detail: 'Dev server instantâneo' },
    ],
  },
  defaultDuration: 8,
  vertical: { zone: 'full', scale: 0.55 },
  description: 'Linha do tempo horizontal (3 a 6 marcos) para contar uma história em ordem cronológica, um marco por vez.',
};
