import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { sequenceTimes, status } from './c1-kit';
import { clamp } from './c3-kit';
import type { ComponentEntry } from './registry';

export interface ChatMessage {
  from: 'me' | 'them';
  text: string;
  name?: string;
}

export interface ChatBubblesProps {
  messages: ChatMessage[];
  /** segundos, relativos ao início do overlay, em que cada mensagem aparece */
  revealAt?: number[];
}

export const CHAT_START = 0.9;
export const CHAT_STEP = 1.4;
export const TYPING_LEAD = 0.9;
const TYPING_MIN = 0.3;
const TYPING_GAP = 0.25;

export interface ChatMoment {
  /** instante em que a mensagem aparece */
  at: number;
  /** instante em que o "digitando..." começa; null quando não há (mensagem minha ou sem tempo para ele) */
  typingFrom: number | null;
}

/**
 * Quando cada mensagem entra e, para as do outro, desde quando ele "está digitando".
 * O indicador começa até 0.9s antes, mas nunca por cima da mensagem anterior.
 */
export function chatTimeline(messages: readonly Pick<ChatMessage, 'from'>[], revealAt: readonly number[] = []): ChatMoment[] {
  const times = sequenceTimes(messages.length, revealAt, CHAT_START, CHAT_STEP);
  return messages.map((message, index) => {
    const at = times[index]!;
    if (message.from !== 'them') return { at, typingFrom: null };
    const earliest = index === 0 ? 0 : times[index - 1]! + TYPING_GAP;
    const typingFrom = Math.max(earliest, at - TYPING_LEAD);
    return { at, typingFrom: at - typingFrom >= TYPING_MIN ? typingFrom : null };
  });
}

/** Subida (0–1) de cada um dos três pontinhos: uma onda que passa da esquerda para a direita, sem piscar. */
export function dotLift(sec: number, index: number): number {
  return Math.max(0, Math.sin(2 * Math.PI * (sec * 1.3 - index * 0.17)));
}

/** O nome só aparece na primeira mensagem de uma sequência do mesmo remetente. */
export function showsName(messages: readonly ChatMessage[], index: number): boolean {
  const message = messages[index];
  if (!message?.name?.trim()) return false;
  const previous = messages[index - 1];
  return !previous || previous.from !== message.from || previous.name !== message.name;
}

/** Corpo do texto: conversa longa encolhe um pouco para caber na altura da tela. */
export function chatFontSize(messages: readonly ChatMessage[]): number {
  const chars = messages.reduce((sum, message) => sum + message.text.length, 0);
  if (messages.length <= 4 && chars <= 220) return 36;
  if (messages.length <= 6 && chars <= 360) return 32;
  return 28;
}

const COLUMN = 840;
const BUBBLE_MAX = 660;

export const ChatBubbles: React.FC<ChatBubblesProps & BaseProps> = ({ messages, revealAt, durationInFrames }) => {
  const { frame, fps, exit, value } = usePresence(durationInFrames, motion.fast);
  const sec = frame / fps;
  const moments = chatTimeline(messages, revealAt);
  const fontSize = chatFontSize(messages);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: COLUMN, opacity: value, translate: `0 ${exit * 20}px` }}>
        {messages.map((message, index) => {
          const moment = moments[index]!;
          const mine = message.from === 'me';
          const shown = progressAt(frame, fps, moment.at, 0.35);
          const sameAsPrevious = index > 0 && messages[index - 1]!.from === message.from;
          const typing =
            moment.typingFrom === null
              ? 0
              : interpolate(sec, [moment.typingFrom, moment.typingFrom + 0.2, moment.at - 0.12, moment.at], [0, 1, 1, 0], clamp);
          return (
            // todas as mensagens ocupam seu lugar desde o início: nada pula quando a próxima entra
            <div
              key={index}
              style={{
                position: 'relative',
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: BUBBLE_MAX,
                marginTop: index === 0 ? 0 : sameAsPrevious ? 8 : 20,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '18px 28px 20px',
                  borderRadius: 30,
                  ...(mine ? { borderBottomRightRadius: 8 } : { borderBottomLeftRadius: 8 }),
                  background: mine ? theme.color.ink : theme.color.paper,
                  border: `1.5px solid ${mine ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.7)'}`,
                  boxShadow: theme.shadow.raised,
                  fontFamily: theme.font.body,
                  opacity: shown,
                  scale: String(0.9 + 0.1 * shown),
                  translate: `0 ${(1 - shown) * 16}px`,
                  transformOrigin: mine ? 'right bottom' : 'left bottom',
                }}
              >
                {showsName(messages, index) ? (
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 24,
                      lineHeight: 1.25,
                      color: mine ? theme.color.slate300 : status.slate500,
                    }}
                  >
                    {message.name}
                  </div>
                ) : null}
                <div
                  style={{
                    fontWeight: 500,
                    fontSize,
                    lineHeight: 1.3,
                    color: mine ? theme.color.white : theme.color.ink,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {message.text}
                </div>
              </div>
              {typing > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    height: 62,
                    padding: '0 26px',
                    borderRadius: 30,
                    borderBottomLeftRadius: 8,
                    background: theme.color.paper,
                    border: '1.5px solid rgba(255,255,255,0.7)',
                    boxShadow: theme.shadow.card,
                    opacity: typing,
                  }}
                >
                  {[0, 1, 2].map((dot) => {
                    const lift = dotLift(sec, dot);
                    return (
                      <div
                        key={dot}
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: theme.radius.pill,
                          background: theme.color.slate600,
                          opacity: 0.45 + 0.55 * lift,
                          translate: `0 ${-7 * lift}px`,
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: ChatBubbles,
  sample: {
    messages: [
      { from: 'them', name: 'Cliente', text: 'O sistema caiu de novo. Vocês mexeram em alguma coisa?' },
      { from: 'me', text: 'Só um ajuste pequeno no CSS, sexta à tarde.' },
      { from: 'them', text: 'No CSS do checkout?' },
      { from: 'me', text: 'Vou abrir o rollback.' },
    ],
  },
  defaultDuration: 8,
  description: 'Recria uma conversa de chat (cliente, chefe, IA) quando a fala narra um diálogo; até ~6 mensagens curtas.',
};
