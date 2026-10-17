// MODELO de animação reutilizável: na EDL entra como `scene:modelos/CicloDeDoisPassos`, em qualquer vídeo.
// Forma: um passo sozinho é um caminho que para num bloqueio; quando o segundo passo entra, os dois viram um
// ciclo que gira e o medidor à direita sobe. 100% por props; os tempos vêm de `revealAt` (por chave).

import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, Arrow, enter, Eyebrow, IconBadge, type IconName, Pill, type Point, popIn, rise, SceneBackground, SceneCard, text, window as presenceWindow, Words } from '../../scene-kit';
import { motion, theme } from '../../theme';
import { clampCount, fitFontSize, pickSec } from './fit-b';

export interface CicloDeDoisPassosStep {
  label: string;
  /** linha de apoio embaixo do nome */
  hint?: string;
  icon?: IconName;
}

export interface CicloDeDoisPassosReveal {
  /** entra o primeiro passo e o caminho começa a se desenhar */
  first?: number;
  /** "e não só isso": o caminho bate no bloqueio */
  stall?: number;
  /** entra o segundo passo */
  second?: number;
  /** o ciclo fecha, gira e o medidor sobe */
  loop?: number;
}

export interface CicloDeDoisPassosCaptions {
  first?: string;
  stalled?: string;
  loop?: string;
}

export interface CicloDeDoisPassosProps {
  eyebrow?: string;
  first?: CicloDeDoisPassosStep;
  second?: CicloDeDoisPassosStep;
  /** pílula em cima do bloqueio */
  stopLabel?: string;
  /** título do medidor */
  meterLabel?: string;
  /** valor em que o medidor chega com o ciclo girando (2 a 9) */
  meterMax?: number;
  /** frase embaixo, uma por fase: só o primeiro passo, o caminho parado e o ciclo completo */
  captions?: CicloDeDoisPassosCaptions;
  /** segundos relativos ao início da cena; chaves omitidas seguem em sequência */
  revealAt?: CicloDeDoisPassosReveal;
}

const DEFAULT_FIRST: CicloDeDoisPassosStep = { label: 'Primeiro passo', hint: 'sozinho, não fecha', icon: 'bolt' };
const DEFAULT_SECOND: CicloDeDoisPassosStep = { label: 'Segundo passo', hint: 'o que faltava', icon: 'gear' };
const DEFAULT_CAPTIONS: Required<CicloDeDoisPassosCaptions> = { first: 'Um passo é o começo.', stalled: 'Sozinho, o caminho para.', loop: 'Com os dois, o nível sobe.' };
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** fração do medidor em que o passo sozinho estaciona */
export const STALL_LEVEL = 0.2;
export const METER_RANGE = { min: 2, max: 9, default: 5 } as const;
/** segundos de uma volta do ciclo e de uma tentativa no caminho parado */
export const CYCLE_SECONDS = 1.3;
const LABEL_WIDTH = 440;
const LABEL_FONT = { base: 48, min: 36 } as const;
const CAPTION_FONT = { base: 72, min: 48 } as const;

interface Curve {
  from: Point;
  to: Point;
  bend: number;
}

export interface CycleLayout {
  width: number;
  height: number;
  badge: number;
  first: Point;
  second: Point;
  labelY: number;
  labelWidth: number;
  /** caminho reto do passo sozinho, que termina no bloqueio */
  path: { from: Point; to: Point };
  stop: { x: number; y: number; height: number };
  go: Curve;
  back: Curve;
  meter: { x: number; y: number; width: number; height: number; track: { width: number; height: number } };
}

/** Primeiro passo à esquerda, segundo no meio e o medidor à direita. */
export function cycleLayout(width = 1728): CycleLayout {
  const badge = 190;
  const centerY = 185;
  const first: Point = [Math.round(width * 0.17), centerY];
  const second: Point = [Math.round(width * 0.58), centerY];
  const reach = badge / 2 + 30;
  const left = first[0] + reach;
  const right = second[0] - reach;
  const offset = 50;
  const meterWidth = 380;
  return {
    width,
    height: 440,
    badge,
    first,
    second,
    labelY: centerY + badge / 2 + 22,
    labelWidth: LABEL_WIDTH,
    path: { from: [left, centerY], to: [right, centerY] },
    stop: { x: right + 14, y: centerY, height: 100 },
    // `bend` negativo nas duas: indo para a direita curva para cima; voltando, para baixo
    go: { from: [left, centerY - offset], to: [right, centerY - offset], bend: -60 },
    back: { from: [right, centerY + offset], to: [left, centerY + offset], bend: -60 },
    meter: { x: width - meterWidth, y: 10, width: meterWidth, height: 420, track: { width: 52, height: 250 } },
  };
}

/** Os quatro tempos da cena: o que veio em `revealAt` e, onde falta, uma sequência a partir do anterior. */
export function cycleTimes(revealAt: CicloDeDoisPassosReveal = {}): Required<CicloDeDoisPassosReveal> {
  const pick = pickSec;
  const first = pick(revealAt.first, 1.2);
  const stall = pick(revealAt.stall, first + 2.2);
  const second = pick(revealAt.second, stall + 3);
  const loop = pick(revealAt.loop, second + 1.2);
  return { first, stall, second, loop };
}

/** Ponto em `t` (0→1) da mesma curva que o `Arrow` do kit desenha. */
export function quadPoint(from: Point, to: Point, bend: number, t: number): Point {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const span = Math.hypot(dx, dy) || 1;
  const control: Point = [from[0] + dx / 2 + (-dy / span) * bend * 2, from[1] + dy / 2 + (dx / span) * bend * 2];
  const u = 1 - t;
  return [u * u * from[0] + 2 * u * t * control[0] + t * t * to[0], u * u * from[1] + 2 * u * t * control[1] + t * t * to[1]];
}

/** Ponto do ciclo em `turn` voltas: a primeira metade vai do primeiro passo ao segundo, a segunda volta. */
export function cyclePoint(turn: number, layout: Pick<CycleLayout, 'go' | 'back'>): Point {
  const phase = ((turn % 1) + 1) % 1;
  return phase < 0.5 ? quadPoint(layout.go.from, layout.go.to, layout.go.bend, phase * 2) : quadPoint(layout.back.from, layout.back.to, layout.back.bend, (phase - 0.5) * 2);
}

/** Tentativa no caminho parado: o ponto avança, bate no bloqueio e some. `travel` 0→1, `opacity` 0→1. */
export function stallAttempt(sec: number, startSec: number, period = CYCLE_SECONDS): { travel: number; opacity: number } {
  if (sec < startSec) return { travel: 0, opacity: 0 };
  const phase = ((sec - startSec) % period) / period;
  const travel = interpolate(phase, [0, 0.6], [0, 1], { ...clamp, easing: motion.enter });
  const opacity = interpolate(phase, [0, 0.1, 0.65, 0.95], [0, 1, 1, 0], clamp);
  return { travel, opacity };
}

/**
 * Quanto do medidor está cheio (0→1): sobe um pouco com o primeiro passo, estaciona em `STALL_LEVEL`
 * enquanto ele está sozinho e dispara quando o ciclo fecha.
 */
export function meterFill(sec: number, times: Pick<Required<CicloDeDoisPassosReveal>, 'first' | 'stall' | 'loop'>, riseSec = 1.2): number {
  const start = times.first + 0.4;
  const stalled = Math.max(times.stall, start + 0.1);
  const before = interpolate(sec, [start, stalled], [0, STALL_LEVEL], { ...clamp, easing: motion.enter });
  const after = interpolate(sec, [times.loop, times.loop + riseSec], [0, 1 - STALL_LEVEL], { ...clamp, easing: motion.move });
  return before + after;
}

/** `meterMax` dentro do intervalo que cabe em um dígito grande. */
export function meterMaxOf(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? clampCount(value, METER_RANGE.min, METER_RANGE.max) : METER_RANGE.default;
}

export function meterNumber(fill: number, max: number = METER_RANGE.default): number {
  return Math.max(0, Math.min(max, Math.round(fill * max)));
}

/** Tamanho do nome de um passo: encolhe até 36 px para caber numa linha; mais longo que isso, quebra. */
export function cycleLabelFont(label: string, width = LABEL_WIDTH): number {
  return fitFontSize(label, width, LABEL_FONT.base, LABEL_FONT.min);
}

/** Tamanho da frase de baixo para caber numa linha da área útil. */
export function cycleCaptionFont(caption: string, width: number): number {
  return fitFontSize(caption, width, CAPTION_FONT.base, CAPTION_FONT.min, 'display');
}

const Node: React.FC<{ step: CicloDeDoisPassosStep; fallbackIcon: IconName; center: Point; size: number; labelY: number; labelWidth: number; progress: number; scale?: number; variant?: 'paper' | 'ink' }> = ({
  step,
  fallbackIcon,
  center,
  size,
  labelY,
  labelWidth,
  progress,
  scale,
  variant = 'paper',
}) => (
  <>
    <IconBadge
      icon={step.icon ?? fallbackIcon}
      variant={variant}
      size={size}
      progress={progress}
      style={{ position: 'absolute', left: center[0] - size / 2, top: center[1] - size / 2, ...(scale === undefined ? {} : { scale: String(scale) }) }}
    />
    <div style={{ position: 'absolute', left: center[0] - labelWidth / 2, width: labelWidth, top: labelY, textAlign: 'center', ...rise(progress, 16) }}>
      <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: cycleLabelFont(step.label, labelWidth), lineHeight: 1.2, color: theme.color.slate900 }}>{step.label}</div>
      {step.hint ? <div style={{ marginTop: 6, fontFamily: theme.font.body, fontWeight: 500, fontSize: text.eyebrow, lineHeight: 1.3, color: theme.color.slate600 }}>{step.hint}</div> : null}
    </div>
  </>
);

const Caption: React.FC<{ presence: number; atSec: number; width: number; children: string }> = ({ presence, atSec, width, children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      fontFamily: theme.font.display,
      fontWeight: 600,
      fontSize: cycleCaptionFont(children, width),
      lineHeight: 1.12,
      letterSpacing: '-0.01em',
      color: theme.color.slate900,
      opacity: presence,
    }}
  >
    <span>
      <Words text={children} delay={atSec} />
    </span>
  </div>
);

export const CicloDeDoisPassos: React.FC<CicloDeDoisPassosProps & BaseProps> = ({
  eyebrow,
  first = DEFAULT_FIRST,
  second = DEFAULT_SECOND,
  stopLabel = 'para aqui',
  meterLabel = 'Nível',
  meterMax,
  captions,
  revealAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const sec = frame / fps;
  const layout = cycleLayout(width - theme.safe.x * 2);
  const times = cycleTimes(revealAt);
  const lines = { ...DEFAULT_CAPTIONS, ...captions };
  const max = meterMaxOf(meterMax);
  const endSec = durationInFrames / fps + 1;

  const firstIn = enter(frame, fps, times.first, 0.5);
  const pathDraw = enter(frame, fps, times.first + 0.35, 0.9);
  const stop = presenceWindow(frame, times.stall, times.second + 0.1, fps, 0.3);
  const ghost = presenceWindow(frame, times.stall + 0.3, times.second + 0.15, fps, 0.3);
  const secondIn = enter(frame, fps, times.second, 0.5);
  const loop = enter(frame, fps, times.loop, 0.5);
  const attempt = stallAttempt(sec, times.first + 1);
  const attemptOn = 1 - enter(frame, fps, times.loop - 0.1, 0.2);
  const fill = meterFill(sec, times);
  const orbit = cyclePoint((sec - times.loop - 0.3) / CYCLE_SECONDS, layout);
  const orbitOn = enter(frame, fps, times.loop + 0.3, 0.3);
  const pathEndX = layout.path.from[0] + (layout.path.to[0] - layout.path.from[0]) * pathDraw;
  const { meter } = layout;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44 }}>
      {eyebrow ? <Eyebrow progress={enter(frame, fps, 0.1)}>{eyebrow}</Eyebrow> : null}

      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none">
          {/* caminho do passo sozinho: tracejado, some quando o ciclo fecha */}
          <line
            x1={layout.path.from[0]}
            y1={layout.path.from[1]}
            x2={pathEndX}
            y2={layout.path.to[1]}
            stroke={theme.color.slate600}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="4 18"
            opacity={(pathDraw > 0 ? 1 : 0) * (1 - loop)}
          />
          {/* o lugar vazio onde falta o segundo passo */}
          <circle cx={layout.second[0]} cy={layout.second[1]} r={layout.badge / 2 - 4} stroke={theme.color.slate300} strokeWidth={4} strokeDasharray="14 14" opacity={ghost} />
          <line
            x1={layout.stop.x}
            y1={layout.stop.y - (layout.stop.height / 2) * stop}
            x2={layout.stop.x}
            y2={layout.stop.y + (layout.stop.height / 2) * stop}
            stroke={theme.color.coral}
            strokeWidth={10}
            strokeLinecap="round"
            opacity={stop}
          />
        </svg>
        <Arrow from={layout.go.from} to={layout.go.to} bend={layout.go.bend} progress={loop} />
        <Arrow from={layout.back.from} to={layout.back.to} bend={layout.back.bend} progress={enter(frame, fps, times.loop + 0.2, 0.5)} />

        {/* ponto que tenta avançar pelo caminho e bate no bloqueio */}
        <div
          style={{
            position: 'absolute',
            left: layout.path.from[0] + (layout.path.to[0] - layout.path.from[0]) * attempt.travel - 13,
            top: layout.path.from[1] - 13,
            width: 26,
            height: 26,
            borderRadius: theme.radius.pill,
            background: theme.color.slate900,
            opacity: attempt.opacity * attemptOn * (pathDraw >= 1 ? 1 : 0),
          }}
        />
        {/* ponto que gira no ciclo */}
        <div
          style={{
            position: 'absolute',
            left: orbit[0] - 17,
            top: orbit[1] - 17,
            width: 34,
            height: 34,
            boxSizing: 'border-box',
            borderRadius: theme.radius.pill,
            background: theme.color.emerald,
            border: `4px solid ${theme.color.white}`,
            boxShadow: `0 6px 14px -4px ${alpha(theme.color.slate900, 0.4)}`,
            opacity: orbitOn,
          }}
        />

        {stopLabel ? (
          <div style={{ position: 'absolute', left: layout.stop.x, top: layout.stop.y - layout.stop.height / 2 - 62, width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Pill variant="coral" dot fontSize={34} progress={Math.min(1, stop)} style={{ flexShrink: 0, background: theme.color.paper, opacity: stop }}>
              {stopLabel}
            </Pill>
          </div>
        ) : null}

        <Node step={first} fallbackIcon="bolt" center={layout.first} size={layout.badge} labelY={layout.labelY} labelWidth={layout.labelWidth} progress={firstIn} />
        <Node
          step={second}
          fallbackIcon="gear"
          variant="ink"
          center={layout.second}
          size={layout.badge}
          labelY={layout.labelY}
          labelWidth={layout.labelWidth}
          progress={secondIn}
          scale={0.8 + 0.2 * popIn(frame, fps, times.second, 0.45)}
        />

        <SceneCard
          progress={enter(frame, fps, times.first + 0.15, 0.5)}
          padding="34px 40px"
          style={{ position: 'absolute', left: meter.x, top: meter.y, width: meter.width, height: meter.height, display: 'flex', flexDirection: 'column', gap: 26 }}
        >
          <Eyebrow style={{ whiteSpace: 'nowrap' }}>{meterLabel}</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40 }}>
            <div style={{ position: 'relative', width: meter.track.width, height: meter.track.height, borderRadius: theme.radius.pill, background: alpha(theme.color.slate300, 0.55), overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: meter.track.height * fill, borderRadius: theme.radius.pill, background: theme.color.emerald }} />
            </div>
            <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: 190, lineHeight: 0.9, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums', color: theme.color.slate900 }}>
              {meterNumber(fill, max)}
            </div>
          </div>
        </SceneCard>
      </div>

      <div style={{ position: 'relative', width: layout.width, height: 100 }}>
        <Caption width={layout.width} presence={presenceWindow(frame, times.first + 0.3, times.stall + 0.05, fps, 0.3)} atSec={times.first + 0.3}>
          {lines.first}
        </Caption>
        <Caption width={layout.width} presence={presenceWindow(frame, times.stall + 0.05, times.second + 0.05, fps, 0.3)} atSec={times.stall + 0.1}>
          {lines.stalled}
        </Caption>
        <Caption width={layout.width} presence={presenceWindow(frame, times.second + 0.05, endSec, fps, 0.3)} atSec={times.second + 0.1}>
          {lines.loop}
        </Caption>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: CicloDeDoisPassos,
  sample: {
    eyebrow: 'O que faz evoluir',
    first: { label: 'Treinar', hint: 'carga e repetição', icon: 'bolt' },
    second: { label: 'Descansar', hint: 'sono e recuperação', icon: 'cloud' },
    stopLabel: 'trava aqui',
    meterLabel: 'Força',
    meterMax: 5,
    captions: { first: 'Treinar é o começo.', stalled: 'Só treinar: o corpo trava.', loop: 'Treinar e descansar: a força sobe.' },
    revealAt: { first: 1.2, stall: 3.4, second: 6.4, loop: 7.6 },
  },
  defaultDuration: 9,
  description:
    'Para a fala "não basta só A, precisa de A e B": o primeiro passo sozinho vira um caminho que bate num bloqueio; quando o segundo entra, ' +
    'os dois fecham um ciclo que gira e o medidor à direita sobe. Serve para estudar e praticar, treinar e descansar, medir e ajustar, escrever e revisar.',
  tags: ['ciclo', 'medidor', 'dois-passos', 'causa-efeito'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/EstudarEPraticar' },
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno no topo' },
    { name: 'first', type: '{ label: string; hint?: string; icon?: IconName }', description: 'o passo que existe desde o começo (disco claro, à esquerda)' },
    { name: 'second', type: '{ label: string; hint?: string; icon?: IconName }', description: 'o passo que faltava (disco escuro, no meio); nomes de até ~14 caracteres cabem em uma linha' },
    { name: 'stopLabel', type: 'string?', description: 'pílula coral em cima do bloqueio; texto vazio tira a pílula' },
    { name: 'meterLabel', type: 'string', description: 'título do medidor (uma palavra curta: nível, força, receita)' },
    { name: 'meterMax', type: 'number? (2 a 9)', description: 'número em que o medidor chega com o ciclo girando; padrão 5' },
    { name: 'captions', type: '{ first?: string; stalled?: string; loop?: string }', description: 'frase de baixo em cada fase: só o primeiro passo, o caminho parado, o ciclo completo' },
    { name: 'revealAt', type: '{ first?: number; stall?: number; second?: number; loop?: number }', description: 'segundo de cada fase: primeiro passo, bloqueio, segundo passo e ciclo fechando' },
  ],
};
