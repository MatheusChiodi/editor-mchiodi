import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, enter, Eyebrow, IconBadge, longShadow, Pill, type Point, popIn, rise, SceneBackground, SceneCard, text, window as presenceWindow, Words } from '../../scene-kit';
import { motion, theme } from '../../theme';

export interface MentoriaAoVivoProps {
  /** segundos relativos ao início da cena */
  revealAt?: {
    /** pensamento "nunca imaginei" */
    dream: number;
    /** a janela da chamada abre ("acabei podendo conhecer") */
    call: number;
    /** selo "ao vivo" e a conversa começa */
    live: number;
    /** destaque final "incrível" */
    wow: number;
  };
  dreamEyebrow?: string;
  dreamText?: string;
  callTitle?: string;
  windowTitle?: string;
  mentorName?: string;
  meName?: string;
  liveLabel?: string;
  /** balões da conversa, na ordem em que saem */
  bubbles?: BubbleSpec[];
  wowText?: string;
  /** trecho de `wowText` em coral */
  wowAccent?: string;
}

export interface BubbleSpec {
  text: string;
  from: 'mentor' | 'me';
}

const DEFAULT_REVEAL = { dream: 0.3, call: 2.6, live: 4.2, wow: 5.6 };
const DEFAULT_BUBBLES: BubbleSpec[] = [
  { text: 'feedback', from: 'mentor' },
  { text: 'minha dúvida', from: 'me' },
  { text: 'direção', from: 'mentor' },
];
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const BUBBLE_STAGGER = 0.4;
export const BUBBLE_TRAVEL = 0.9;
/** quanto o conjunto fica deslocado para baixo enquanto a frase final não entrou */
const WOW_LIFT = 50;

export interface CallLayout {
  width: number;
  height: number;
  titleY: number;
  window: { x: number; y: number; width: number; height: number };
  bar: number;
  tile: { y: number; width: number; height: number };
  mentorTileX: number;
  meTileX: number;
  avatar: number;
  /** centros dos avatares, em px da janela */
  mentor: Point;
  me: Point;
  /** borda esquerda de um balão parado ao lado da mentora e borda direita de um parado ao meu lado */
  travel: { fromX: number; toX: number };
  /** y do centro de cada faixa de balão, em px da janela */
  lanes: number[];
  wowY: number;
}

/** Janela de videochamada com dois quadros lado a lado; os balões cruzam de um avatar ao outro em três faixas. */
export function callLayout(width = 1728, lanes = 3): CallLayout {
  const window = { x: Math.round((width - 1400) / 2), y: 150, width: 1400, height: 500 };
  const bar = 96;
  const pad = 28;
  const avatar = 150;
  const inset = 130;
  const tile = { y: bar, width: (window.width - pad * 3) / 2, height: window.height - bar - pad };
  const centerY = tile.y + tile.height / 2;
  const mentorTileX = pad;
  const meTileX = pad * 2 + tile.width;
  const reach = inset + avatar / 2 + 28;
  const laneGap = 100;
  return {
    width,
    height: 800,
    titleY: 30,
    window,
    bar,
    tile,
    mentorTileX,
    meTileX,
    avatar,
    mentor: [mentorTileX + inset, centerY],
    me: [meTileX + tile.width - inset, centerY],
    travel: { fromX: mentorTileX + reach, toX: meTileX + tile.width - reach },
    lanes: Array.from({ length: lanes }, (_, index) => centerY + (index - (lanes - 1) / 2) * laneGap),
    wowY: window.y + window.height + 36,
  };
}

/** Segundo em que cada balão sai, a partir do "ao vivo". */
export function bubbleTimes(count: number, liveSec: number, stagger = BUBBLE_STAGGER): number[] {
  return Array.from({ length: count }, (_, index) => liveSec + 0.15 + index * stagger);
}

/**
 * Posição de um balão em viagem. `progress` 0→1 vai de quem fala até quem ouve.
 * O balão é ancorado por `left` e deslocado pela própria largura (`shift`, em %), então
 * encosta pela borda esquerda no lado da mentora e pela direita no meu lado, sem medir o texto.
 */
export function bubblePosition(progress: number, from: BubbleSpec['from'], travel: CallLayout['travel']): { left: number; shift: number } {
  const side = from === 'mentor' ? progress : 1 - progress;
  return { left: travel.fromX + (travel.toX - travel.fromX) * side, shift: -side * 100 };
}

const Avatar: React.FC<{ center: Point; size: number; name: string; variant: 'ink' | 'paper'; progress: number }> = ({ center, size, name, variant, progress }) => (
  <>
    <IconBadge icon="user" variant={variant} size={size} progress={progress} style={{ position: 'absolute', left: center[0] - size / 2, top: center[1] - size / 2 }} />
    <div
      style={{
        position: 'absolute',
        left: center[0] - 130,
        width: 260,
        top: center[1] + size / 2 + 18,
        textAlign: 'center',
        fontFamily: theme.font.body,
        fontWeight: 600,
        fontSize: text.label,
        lineHeight: 1.2,
        color: theme.color.slate900,
        ...rise(progress, 16),
      }}
    >
      {name}
    </div>
  </>
);

/** "Nunca imaginei conhecer ela" vira uma mentoria ao vivo: o pensamento distante dá lugar à chamada com a conversa acontecendo. */
export const MentoriaAoVivo: React.FC<MentoriaAoVivoProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  dreamEyebrow = 'Parecia impossível',
  dreamText = 'Conhecer ela? Nunca imaginei.',
  callTitle = 'Mas aconteceu.',
  windowTitle = 'Mentoria',
  mentorName = 'Mentora',
  meName = 'Eu',
  liveLabel = 'ao vivo',
  bubbles = DEFAULT_BUBBLES,
  wowText = 'Foi incrível pra mim.',
  wowAccent = 'incrível',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const layout = callLayout(width - theme.safe.x * 2, Math.max(1, bubbles.length));
  const middle = layout.width / 2;

  const dream = presenceWindow(frame, revealAt.dream, revealAt.call + 0.05, fps, 0.35);
  const call = enter(frame, fps, revealAt.call, 0.5);
  const wow = enter(frame, fps, revealAt.wow, 0.4);
  const lift = (1 - enter(frame, fps, revealAt.wow - 0.3, 0.6)) * WOW_LIFT;
  const times = bubbleTimes(bubbles.length, revealAt.live);
  const thoughtDots = [
    { y: 575, size: 18 },
    { y: 528, size: 28 },
    { y: 470, size: 40 },
  ];

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        {/* ato 1: o pensamento distante */}
        <div style={{ position: 'absolute', inset: 0, opacity: dream, translate: `0px ${((1 - dream) * (frame > revealAt.call * fps ? -24 : 0)).toFixed(2)}px` }}>
          <IconBadge
            icon="user"
            size={150}
            progress={enter(frame, fps, revealAt.dream, 0.5)}
            style={{ position: 'absolute', left: middle - 75, top: 610 }}
          />
          {thoughtDots.map((dot, index) => {
            const progress = enter(frame, fps, revealAt.dream + 0.15 + index * 0.1, 0.35);
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
              left: middle - 560,
              top: 110,
              width: 1120,
              height: 320,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 26,
              borderRadius: 160,
              background: alpha(theme.color.white, 0.78),
              border: `2px solid ${alpha(theme.color.white, 0.9)}`,
              boxShadow: longShadow,
              ...rise(enter(frame, fps, revealAt.dream + 0.4, 0.5), 28),
            }}
          >
            <Eyebrow progress={enter(frame, fps, revealAt.dream + 0.5)}>{dreamEyebrow}</Eyebrow>
            <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: 68, lineHeight: 1.12, letterSpacing: '-0.01em', color: theme.color.slate900 }}>
              <Words text={dreamText} delay={revealAt.dream + 0.6} />
            </div>
          </div>
        </div>

        {/* ato 2: a chamada */}
        <div style={{ position: 'absolute', inset: 0, translate: `0px ${lift.toFixed(2)}px`, opacity: frame >= revealAt.call * fps ? 1 : 0 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: layout.titleY,
              textAlign: 'center',
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: 76,
              lineHeight: 1.12,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
            }}
          >
            <Words text={callTitle} delay={revealAt.call + 0.1} />
          </div>
          <SceneCard
            progress={call}
            padding={0}
            style={{ position: 'absolute', left: layout.window.x, top: layout.window.y, width: layout.window.width, height: layout.window.height, background: alpha(theme.color.white, 0.82) }}
          >
            <div style={{ position: 'absolute', left: 36, right: 28, top: 0, height: layout.bar, display: 'flex', alignItems: 'center', gap: 14 }}>
              {[0, 1, 2].map((index) => (
                <span key={index} style={{ width: 18, height: 18, borderRadius: theme.radius.pill, background: theme.color.slate300 }} />
              ))}
              <span style={{ marginLeft: 18, fontFamily: theme.font.body, fontWeight: 600, fontSize: text.label, color: theme.color.slate900 }}>{windowTitle}</span>
              <span style={{ flex: 1 }} />
              <Pill variant="emerald" dot fontSize={34} progress={enter(frame, fps, revealAt.live, 0.45)}>
                {liveLabel}
              </Pill>
            </div>
            {[layout.mentorTileX, layout.meTileX].map((x) => (
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
            <Avatar center={layout.mentor} size={layout.avatar} name={mentorName} variant="ink" progress={enter(frame, fps, revealAt.call + 0.2, 0.5)} />
            <Avatar center={layout.me} size={layout.avatar} name={meName} variant="paper" progress={enter(frame, fps, revealAt.call + 0.32, 0.5)} />
            {bubbles.map((bubble, index) => {
              const start = times[index] ?? revealAt.live;
              const travel = interpolate(frame, [start * fps, (start + BUBBLE_TRAVEL) * fps], [0, 1], { ...clamp, easing: motion.move });
              const position = bubblePosition(travel, bubble.from, layout.travel);
              return (
                <div key={index} style={{ position: 'absolute', left: position.left, top: layout.lanes[index] ?? 0, width: 0, height: 0, display: 'flex', alignItems: 'center' }}>
                  <Pill
                    variant={bubble.from === 'mentor' ? 'ink' : 'glass'}
                    fontSize={34}
                    style={{
                      flexShrink: 0,
                      background: bubble.from === 'mentor' ? theme.color.slate900 : theme.color.white,
                      color: bubble.from === 'mentor' ? theme.color.white : theme.color.slate900,
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
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: layout.wowY,
            textAlign: 'center',
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: 88,
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            color: theme.color.slate900,
            opacity: wow,
            scale: String(0.8 + 0.2 * popIn(frame, fps, revealAt.wow, 0.45)),
          }}
        >
          <Words text={wowText} accent={wowAccent} delay={revealAt.wow} mode="rise" step={0} />
        </div>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: MentoriaAoVivo,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 7,
  description:
    'Cena papel: o sonho distante ("nunca imaginei conhecer ela") vira uma videochamada de mentoria ao vivo, com balões de conversa indo e voltando e o fecho "incrível".',
};

export const MODEL = 'PensamentoViraChamada';
