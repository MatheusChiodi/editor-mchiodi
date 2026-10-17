// MODELO de animação reutilizável: na EDL entra como `scene:modelos/PensamentoViraChamada`, em qualquer vídeo.
// Forma: ato 1, um balão de pensamento (o que parecia distante); ato 2, uma janela de chamada com duas pessoas,
// selo "ao vivo" e balões de conversa cruzando de um lado ao outro; fecho com uma frase em destaque. 100% por props.

import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, enter, Eyebrow, IconBadge, type IconName, longShadow, Pill, type Point, popIn, rise, SceneBackground, SceneCard, text, window as presenceWindow, Words } from '../../scene-kit';
import { motion, theme } from '../../theme';
import { clampCount, estimateLines, fillTimes, fitFontSize, pickSec, pillWidth } from './fit-b';

export type CallSide = 'left' | 'right';

export interface PensamentoViraChamadaPerson {
  name: string;
  icon?: IconName;
}

export interface PensamentoViraChamadaBubble {
  text: string;
  /** quem fala: o balão sai desse lado e atravessa até o outro */
  from: CallSide;
}

export interface PensamentoViraChamadaReveal {
  /** o balão de pensamento */
  thought?: number;
  /** a janela da chamada abre no lugar do pensamento */
  call?: number;
  /** selo "ao vivo" e a conversa começa */
  live?: number;
  /** segundo em que cada balão sai, por índice */
  bubbles?: number[];
  /** frase final em destaque */
  closing?: number;
}

export interface PensamentoViraChamadaProps {
  thoughtEyebrow?: string;
  thought?: string;
  /** frase acima da janela, quando a chamada abre */
  callTitle?: string;
  /** nome na barra da janela */
  windowTitle?: string;
  /** pessoa do quadro esquerdo (disco escuro) */
  left?: PensamentoViraChamadaPerson;
  /** pessoa do quadro direito (disco claro) */
  right?: PensamentoViraChamadaPerson;
  liveLabel?: string;
  /** de 1 a 4 balões, na ordem em que saem */
  bubbles?: PensamentoViraChamadaBubble[];
  closing?: string;
  /** trecho de `closing` em coral */
  closingAccent?: string;
  /** segundos relativos ao início da cena; o que faltar segue em sequência */
  revealAt?: PensamentoViraChamadaReveal;
}

export const BUBBLE_RANGE = { min: 1, max: 4 } as const;
export const BUBBLE_STAGGER = 0.4;
export const BUBBLE_TRAVEL = 0.9;
const BUBBLE_FONT = 34;
/** quanto o conjunto fica deslocado para baixo enquanto a frase final não entrou */
const CLOSING_LIFT = 50;
const THOUGHT = { width: 1120, height: 320, pad: 70, font: 68, min: 50 } as const;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const DEFAULT_LEFT: PensamentoViraChamadaPerson = { name: 'Do outro lado', icon: 'user' };
const DEFAULT_RIGHT: PensamentoViraChamadaPerson = { name: 'Eu', icon: 'user' };
const DEFAULT_BUBBLES: PensamentoViraChamadaBubble[] = [
  { text: 'uma pergunta', from: 'right' },
  { text: 'a resposta', from: 'left' },
];

export interface CallLayout {
  width: number;
  height: number;
  titleY: number;
  window: { x: number; y: number; width: number; height: number };
  bar: number;
  tile: { y: number; width: number; height: number };
  leftTileX: number;
  rightTileX: number;
  avatar: number;
  /** centros dos avatares, em px da janela */
  left: Point;
  right: Point;
  /** borda esquerda de um balão parado ao lado da pessoa da esquerda e borda direita de um parado ao lado da direita */
  travel: { fromX: number; toX: number };
  /** y do centro de cada faixa de balão, em px da janela */
  lanes: number[];
  closingY: number;
}

/** Janela de chamada com dois quadros lado a lado; os balões cruzam de um avatar ao outro, um por faixa. */
export function callLayout(width = 1728, lanes = 3): CallLayout {
  const count = clampCount(lanes, BUBBLE_RANGE.min, BUBBLE_RANGE.max);
  const window = { x: Math.round((width - 1400) / 2), y: 150, width: 1400, height: 500 };
  const bar = 96;
  const pad = 28;
  const avatar = 150;
  const inset = 130;
  const tile = { y: bar, width: (window.width - pad * 3) / 2, height: window.height - bar - pad };
  const centerY = tile.y + tile.height / 2;
  const leftTileX = pad;
  const rightTileX = pad * 2 + tile.width;
  const reach = inset + avatar / 2 + 28;
  // com 4 balões as faixas apertam para sobrar respiro entre o primeiro/último e a borda do quadro
  const laneGap = count <= 3 ? 100 : 86;
  return {
    width,
    height: 800,
    titleY: 30,
    window,
    bar,
    tile,
    leftTileX,
    rightTileX,
    avatar,
    left: [leftTileX + inset, centerY],
    right: [rightTileX + tile.width - inset, centerY],
    travel: { fromX: leftTileX + reach, toX: rightTileX + tile.width - reach },
    lanes: Array.from({ length: count }, (_, index) => centerY + (index - (count - 1) / 2) * laneGap),
    closingY: window.y + window.height + 36,
  };
}

/** Tempos da cena: pensamento, chamada, "ao vivo", cada balão e o fecho (depois do último balão chegar). */
export function callTimes(count: number, revealAt: PensamentoViraChamadaReveal = {}): Required<PensamentoViraChamadaReveal> {
  const thought = pickSec(revealAt.thought, 0.3);
  const call = pickSec(revealAt.call, thought + 2.3);
  const live = pickSec(revealAt.live, call + 1.6);
  const bubbles = fillTimes(clampCount(count, BUBBLE_RANGE.min, BUBBLE_RANGE.max), revealAt.bubbles, live + 0.15, BUBBLE_STAGGER);
  const closing = pickSec(revealAt.closing, bubbles.at(-1)! + 0.45);
  return { thought, call, live, bubbles, closing };
}

/**
 * Posição de um balão em viagem. `progress` 0→1 vai de quem fala até quem ouve.
 * O balão é ancorado por `left` e deslocado pela própria largura (`shift`, em %), então encosta pela
 * borda esquerda no lado esquerdo e pela direita no lado direito, sem medir o texto.
 */
export function bubblePosition(progress: number, from: CallSide, travel: CallLayout['travel']): { left: number; shift: number } {
  const side = from === 'left' ? progress : 1 - progress;
  return { left: travel.fromX + (travel.toX - travel.fromX) * side, shift: -side * 100 };
}

/** Quanto um balão realmente anda (px): o vão entre os avatares menos a própria largura. Abaixo de ~120 px ele mal se move. */
export function bubbleRoom(label: string, travel: CallLayout['travel'], fontSize = BUBBLE_FONT): number {
  return travel.toX - travel.fromX - pillWidth(label, fontSize);
}

/** Texto do pensamento: 68 px numa linha; se não couber, encolhe até 50 px e quebra (cabem três linhas no balão). */
export function thoughtFont(thought: string, width: number = THOUGHT.width - THOUGHT.pad * 2): { fontSize: number; lines: number } {
  const fontSize = fitFontSize(thought, width, THOUGHT.font, THOUGHT.min, 'display');
  return { fontSize, lines: estimateLines(thought, width, fontSize, 'display') };
}

/** Frases de uma linha (acima e abaixo da janela) encolhem para caber na largura útil. */
export function lineFont(line: string, width: number, base: number): number {
  return fitFontSize(line, width, base, 52, 'display');
}

const Avatar: React.FC<{ center: Point; size: number; person: PensamentoViraChamadaPerson; variant: 'ink' | 'paper'; progress: number }> = ({ center, size, person, variant, progress }) => (
  <>
    <IconBadge icon={person.icon ?? 'user'} variant={variant} size={size} progress={progress} style={{ position: 'absolute', left: center[0] - size / 2, top: center[1] - size / 2 }} />
    <div
      style={{
        position: 'absolute',
        left: center[0] - 130,
        width: 260,
        top: center[1] + size / 2 + 18,
        textAlign: 'center',
        fontFamily: theme.font.body,
        fontWeight: 600,
        fontSize: fitFontSize(person.name, 260, text.label, 34),
        lineHeight: 1.2,
        color: theme.color.slate900,
        ...rise(progress, 16),
      }}
    >
      {person.name}
    </div>
  </>
);

export const PensamentoViraChamada: React.FC<PensamentoViraChamadaProps & BaseProps> = ({
  thoughtEyebrow,
  thought = 'Isso parecia distante.',
  callTitle = 'E aconteceu.',
  windowTitle = 'Chamada',
  left = DEFAULT_LEFT,
  right = DEFAULT_RIGHT,
  liveLabel = 'ao vivo',
  bubbles = DEFAULT_BUBBLES,
  closing,
  closingAccent,
  revealAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const shown = bubbles.slice(0, BUBBLE_RANGE.max);
  const layout = callLayout(width - theme.safe.x * 2, Math.max(1, shown.length));
  const times = callTimes(shown.length, revealAt);
  const middle = layout.width / 2;
  const thoughtFit = thoughtFont(thought);

  const dream = presenceWindow(frame, times.thought, times.call + 0.05, fps, 0.35);
  const call = enter(frame, fps, times.call, 0.5);
  const closingIn = enter(frame, fps, times.closing, 0.4);
  // sem frase final a janela fica centralizada desde o início
  const lift = closing ? (1 - enter(frame, fps, times.closing - 0.3, 0.6)) * CLOSING_LIFT : CLOSING_LIFT;
  const thoughtDots = [
    { y: 575, size: 18 },
    { y: 528, size: 28 },
    { y: 470, size: 40 },
  ];

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        {/* ato 1: o pensamento distante */}
        <div style={{ position: 'absolute', inset: 0, opacity: dream, translate: `0px ${((1 - dream) * (frame > times.call * fps ? -24 : 0)).toFixed(2)}px` }}>
          <IconBadge icon={right.icon ?? 'user'} size={150} progress={enter(frame, fps, times.thought, 0.5)} style={{ position: 'absolute', left: middle - 75, top: 610 }} />
          {thoughtDots.map((dot, index) => {
            const progress = enter(frame, fps, times.thought + 0.15 + index * 0.1, 0.35);
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: middle - dot.size / 2,
                  top: dot.y - dot.size / 2,
                  width: dot.size,
                  height: dot.size,
                  borderRadius: theme.radius.pill,
                  background: alpha(theme.color.white, 0.85),
                  border: `2px solid ${alpha(theme.color.slate300, 0.9)}`,
                  opacity: progress,
                  scale: String(0.6 + 0.4 * progress),
                }}
              />
            );
          })}
          <div
            style={{
              position: 'absolute',
              left: middle - THOUGHT.width / 2,
              top: 110,
              width: THOUGHT.width,
              height: THOUGHT.height,
              boxSizing: 'border-box',
              padding: `0 ${THOUGHT.pad}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 26,
              textAlign: 'center',
              borderRadius: 160,
              background: alpha(theme.color.white, 0.78),
              border: `2px solid ${alpha(theme.color.white, 0.9)}`,
              boxShadow: longShadow,
              ...rise(enter(frame, fps, times.thought + 0.4, 0.5), 28),
            }}
          >
            {thoughtEyebrow ? <Eyebrow progress={enter(frame, fps, times.thought + 0.5)}>{thoughtEyebrow}</Eyebrow> : null}
            <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: thoughtFit.fontSize, lineHeight: 1.12, letterSpacing: '-0.01em', color: theme.color.slate900 }}>
              <Words text={thought} delay={times.thought + 0.6} />
            </div>
          </div>
        </div>

        {/* ato 2: a chamada */}
        <div style={{ position: 'absolute', inset: 0, translate: `0px ${lift.toFixed(2)}px`, opacity: frame >= times.call * fps ? 1 : 0 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: layout.titleY,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: lineFont(callTitle, layout.width, 76),
              lineHeight: 1.12,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
            }}
          >
            <Words text={callTitle} delay={times.call + 0.1} />
          </div>
          <SceneCard progress={call} padding={0} style={{ position: 'absolute', left: layout.window.x, top: layout.window.y, width: layout.window.width, height: layout.window.height, background: alpha(theme.color.white, 0.82) }}>
            <div style={{ position: 'absolute', left: 36, right: 28, top: 0, height: layout.bar, display: 'flex', alignItems: 'center', gap: 14 }}>
              {[0, 1, 2].map((index) => (
                <span key={index} style={{ width: 18, height: 18, borderRadius: theme.radius.pill, background: theme.color.slate300 }} />
              ))}
              <span style={{ marginLeft: 18, fontFamily: theme.font.body, fontWeight: 600, fontSize: text.label, color: theme.color.slate900, whiteSpace: 'nowrap' }}>{windowTitle}</span>
              <span style={{ flex: 1 }} />
              {liveLabel ? (
                <Pill variant="emerald" dot fontSize={34} progress={enter(frame, fps, times.live, 0.45)}>
                  {liveLabel}
                </Pill>
              ) : null}
            </div>
            {[layout.leftTileX, layout.rightTileX].map((x) => (
              <div
                key={x}
                style={{
                  position: 'absolute',
                  left: x,
                  top: layout.tile.y,
                  width: layout.tile.width,
                  height: layout.tile.height,
                  borderRadius: theme.radius.panel,
                  background: alpha(theme.color.slate900, 0.05),
                  border: `2px solid ${alpha(theme.color.slate300, 0.6)}`,
                  boxSizing: 'border-box',
                }}
              />
            ))}
            <Avatar center={layout.left} size={layout.avatar} person={left} variant="ink" progress={enter(frame, fps, times.call + 0.2, 0.5)} />
            <Avatar center={layout.right} size={layout.avatar} person={right} variant="paper" progress={enter(frame, fps, times.call + 0.32, 0.5)} />
            {shown.map((bubble, index) => {
              const start = times.bubbles[index] ?? times.live;
              const travel = interpolate(frame, [start * fps, (start + BUBBLE_TRAVEL) * fps], [0, 1], { ...clamp, easing: motion.move });
              const position = bubblePosition(travel, bubble.from, layout.travel);
              const dark = bubble.from === 'left';
              return (
                <div key={index} style={{ position: 'absolute', left: position.left, top: layout.lanes[index] ?? 0, width: 0, height: 0, display: 'flex', alignItems: 'center' }}>
                  <Pill
                    variant={dark ? 'ink' : 'glass'}
                    fontSize={BUBBLE_FONT}
                    style={{
                      flexShrink: 0,
                      background: dark ? theme.color.slate900 : theme.color.white,
                      color: dark ? theme.color.white : theme.color.slate900,
                      opacity: enter(frame, fps, start, 0.25),
                      translate: `${position.shift.toFixed(2)}% 0px`,
                    }}
                  >
                    {bubble.text}
                  </Pill>
                </div>
              );
            })}
          </SceneCard>
        </div>

        {/* destaque final: o único pop da cena */}
        {closing ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: layout.closingY,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: lineFont(closing, layout.width, 88),
              lineHeight: 1.12,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
              opacity: closingIn,
              scale: String(0.8 + 0.2 * popIn(frame, fps, times.closing, 0.45)),
            }}
          >
            <Words text={closing} accent={closingAccent} delay={times.closing} mode="rise" step={0} />
          </div>
        ) : null}
      </div>
    </SceneBackground>
  );
};

const SAMPLE_BUBBLES: PensamentoViraChamadaBubble[] = [
  { text: 'o que você precisa?', from: 'left' },
  { text: 'um app de pedidos', from: 'right' },
  { text: 'qual o prazo?', from: 'left' },
  { text: 'três semanas', from: 'right' },
];

export const entry: ComponentEntry = {
  component: PensamentoViraChamada,
  sample: {
    thoughtEyebrow: 'Parecia longe',
    thought: 'Um cliente de fora? Um dia, quem sabe.',
    callTitle: 'Até a primeira reunião.',
    windowTitle: 'Reunião',
    left: { name: 'Cliente', icon: 'user' },
    right: { name: 'Eu', icon: 'code' },
    liveLabel: 'ao vivo',
    bubbles: SAMPLE_BUBBLES,
    closing: 'E fechamos o projeto.',
    closingAccent: 'fechamos',
    revealAt: { thought: 0.3, call: 2.6, live: 4.2, bubbles: [4.4, 4.8, 5.2, 5.6], closing: 6.4 },
  },
  defaultDuration: 8,
  description:
    'Para a fala "eu nunca imaginei que ia falar com X, e acabei numa conversa com X": um balão de pensamento (o que parecia distante) dá lugar a uma ' +
    'janela de chamada com duas pessoas, selo "ao vivo" e balões cruzando de um lado ao outro, com uma frase de fecho. Serve para mentoria, entrevista, reunião com cliente, suporte, primeira call de um projeto.',
  tags: ['antes-depois', 'chamada', 'conversa', 'duas-pessoas', 'pensamento'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/MentoriaAoVivo' },
  slots: [
    { name: 'thoughtEyebrow', type: 'string?', description: 'rótulo pequeno dentro do balão de pensamento' },
    { name: 'thought', type: 'string', description: 'o pensamento do ato 1 (até ~35 caracteres em uma linha; no máximo ~100, em três)' },
    { name: 'callTitle', type: 'string', description: 'frase acima da janela quando a chamada abre' },
    { name: 'windowTitle', type: 'string', description: 'nome na barra da janela' },
    { name: 'left', type: '{ name: string; icon?: IconName }', description: 'pessoa do quadro esquerdo (disco escuro)' },
    { name: 'right', type: '{ name: string; icon?: IconName }', description: 'pessoa do quadro direito (disco claro); é ela que aparece pensando no ato 1' },
    { name: 'liveLabel', type: 'string?', description: 'selo verde na barra da janela; vazio tira o selo' },
    { name: 'bubbles', type: '{ text: string; from: "left" | "right" }[] (1 a 4)', description: 'balões da conversa na ordem em que saem; textos curtos (até ~28 caracteres)' },
    { name: 'closing', type: 'string?', description: 'frase final em destaque embaixo da janela; sem ela a janela fica centralizada' },
    { name: 'closingAccent', type: 'string?', description: 'trecho de closing em coral' },
    { name: 'revealAt', type: '{ thought?: number; call?: number; live?: number; bubbles?: number[]; closing?: number }', description: 'segundo de cada ato; bubbles é por índice e, sem ele, os balões saem a cada 0,4 s depois do "ao vivo"' },
  ],
};
