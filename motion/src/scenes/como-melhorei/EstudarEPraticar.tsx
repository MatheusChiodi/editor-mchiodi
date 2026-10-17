import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, Arrow, enter, Eyebrow, Pill, type Point, popIn, rise, SceneBackground, SceneCard, text, window as presenceWindow, Words } from '../../scene-kit';
import { motion, theme } from '../../theme';
import { GlyphBadge, type GlyphName } from './glyphs-d';

export interface EstudarEPraticarProps {
  /** segundos relativos ao início da cena */
  revealAt?: {
    /** "estudarem": entra o nó Estudar e o caminho começa */
    study: number;
    /** "e não só estudarem": o caminho para */
    notOnly: number;
    /** "fazer a prática": entra o nó Praticar */
    practice: number;
    /** o ciclo fecha, gira e o nível sobe */
    loop: number;
  };
  eyebrow?: string;
  studyLabel?: string;
  studyHint?: string;
  practiceLabel?: string;
  practiceHint?: string;
  stopLabel?: string;
  levelLabel?: string;
  /** legendas da cena: só estudar, o caminho parado, e o ciclo completo */
  captions?: { study: string; stalled: string; loop: string };
}

const DEFAULT_REVEAL = { study: 1.2, notOnly: 3.4, practice: 6.4, loop: 7.6 };
const DEFAULT_CAPTIONS = { study: 'Estudar é o começo.', stalled: 'Só estudar: o caminho para.', loop: 'Estudar e praticar: o nível sobe.' };
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** fração do medidor em que "só estudar" estaciona */
export const STALL_LEVEL = 0.2;
export const MAX_LEVEL = 5;
/** segundos de uma volta do ciclo e de uma tentativa no caminho parado */
export const CYCLE_SECONDS = 1.3;

interface Curve {
  from: Point;
  to: Point;
  bend: number;
}

export interface StudyLayout {
  width: number;
  height: number;
  badge: number;
  study: Point;
  practice: Point;
  labelY: number;
  /** caminho reto de "só estudar", que termina no bloqueio */
  path: { from: Point; to: Point };
  stop: { x: number; y: number; height: number };
  go: Curve;
  back: Curve;
  meter: { x: number; y: number; width: number; height: number; track: { width: number; height: number } };
}

/** Estudar à esquerda, Praticar no meio e o medidor de nível à direita. */
export function studyLayout(width = 1728): StudyLayout {
  const badge = 190;
  const centerY = 185;
  const study: Point = [Math.round(width * 0.17), centerY];
  const practice: Point = [Math.round(width * 0.58), centerY];
  const reach = badge / 2 + 30;
  const left = study[0] + reach;
  const right = practice[0] - reach;
  const offset = 50;
  const meterWidth = 380;
  return {
    width,
    height: 440,
    badge,
    study,
    practice,
    labelY: centerY + badge / 2 + 22,
    path: { from: [left, centerY], to: [right, centerY] },
    stop: { x: right + 14, y: centerY, height: 100 },
    // `bend` negativo nas duas: indo para a direita curva para cima; voltando, para baixo
    go: { from: [left, centerY - offset], to: [right, centerY - offset], bend: -60 },
    back: { from: [right, centerY + offset], to: [left, centerY + offset], bend: -60 },
    meter: { x: width - meterWidth, y: 10, width: meterWidth, height: 420, track: { width: 52, height: 250 } },
  };
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

/** Ponto do ciclo em `turn` voltas: a primeira metade vai de Estudar a Praticar, a segunda volta. */
export function cyclePoint(turn: number, layout: Pick<StudyLayout, 'go' | 'back'>): Point {
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
 * Quanto do medidor está cheio (0→1): sobe um pouco com o estudo, estaciona em `STALL_LEVEL`
 * enquanto é só estudo e dispara quando o ciclo fecha.
 */
export function levelFill(sec: number, revealAt: { study: number; notOnly: number; loop: number }, riseSec = 1.2): number {
  const start = revealAt.study + 0.4;
  const stalled = Math.max(revealAt.notOnly, start + 0.1);
  const first = interpolate(sec, [start, stalled], [0, STALL_LEVEL], { ...clamp, easing: motion.enter });
  const second = interpolate(sec, [revealAt.loop, revealAt.loop + riseSec], [0, 1 - STALL_LEVEL], { ...clamp, easing: motion.move });
  return first + second;
}

export function levelNumber(fill: number, max = MAX_LEVEL): number {
  return Math.max(0, Math.min(max, Math.round(fill * max)));
}

const Node: React.FC<{ glyph: GlyphName; name: string; hint: string; center: Point; size: number; labelY: number; progress: number; scale?: number; variant?: 'paper' | 'ink' }> = ({
  glyph,
  name,
  hint,
  center,
  size,
  labelY,
  progress,
  scale,
  variant = 'paper',
}) => (
  <>
    <GlyphBadge
      glyph={glyph}
      variant={variant}
      size={size}
      progress={progress}
      style={{ position: 'absolute', left: center[0] - size / 2, top: center[1] - size / 2, ...(scale === undefined ? {} : { scale: String(scale) }) }}
    />
    <div style={{ position: 'absolute', left: center[0] - 220, width: 440, top: labelY, textAlign: 'center', ...rise(progress, 16) }}>
      <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: 48, lineHeight: 1.2, color: theme.color.slate900 }}>{name}</div>
      <div style={{ marginTop: 6, fontFamily: theme.font.body, fontWeight: 500, fontSize: text.eyebrow, lineHeight: 1.3, color: theme.color.slate600 }}>{hint}</div>
    </div>
  </>
);

const Caption: React.FC<{ presence: number; atSec: number; children: string }> = ({ presence, atSec, children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: theme.font.display,
      fontWeight: 600,
      fontSize: 72,
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

/** Só estudar é um caminho que para; com a prática vira um ciclo que gira e faz o nível subir. */
export const EstudarEPraticar: React.FC<EstudarEPraticarProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  eyebrow = 'O que realmente importa',
  studyLabel = 'Estudar',
  studyHint = 'livro, vídeo, curso',
  practiceLabel = 'Praticar',
  practiceHint = 'código, projeto',
  stopLabel = 'para aqui',
  levelLabel = 'Nível',
  captions = DEFAULT_CAPTIONS,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const sec = frame / fps;
  const layout = studyLayout(width - theme.safe.x * 2);
  const endSec = durationInFrames / fps + 1;

  const study = enter(frame, fps, revealAt.study, 0.5);
  const pathDraw = enter(frame, fps, revealAt.study + 0.35, 0.9);
  const stop = presenceWindow(frame, revealAt.notOnly, revealAt.practice + 0.1, fps, 0.3);
  const ghost = presenceWindow(frame, revealAt.notOnly + 0.3, revealAt.practice + 0.15, fps, 0.3);
  const practice = enter(frame, fps, revealAt.practice, 0.5);
  const loop = enter(frame, fps, revealAt.loop, 0.5);
  const attempt = stallAttempt(sec, revealAt.study + 1);
  const attemptOn = 1 - enter(frame, fps, revealAt.loop - 0.1, 0.2);
  const fill = levelFill(sec, revealAt);
  const orbit = cyclePoint((sec - revealAt.loop - 0.3) / CYCLE_SECONDS, layout);
  const orbitOn = enter(frame, fps, revealAt.loop + 0.3, 0.3);
  const pathEndX = layout.path.from[0] + (layout.path.to[0] - layout.path.from[0]) * pathDraw;
  const { meter } = layout;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44 }}>
      <Eyebrow progress={enter(frame, fps, 0.1)}>{eyebrow}</Eyebrow>

      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none">
          {/* caminho de "só estudar": tracejado, some quando o ciclo fecha */}
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
          {/* o lugar vazio onde falta a prática */}
          <circle
            cx={layout.practice[0]}
            cy={layout.practice[1]}
            r={layout.badge / 2 - 4}
            stroke={theme.color.slate300}
            strokeWidth={4}
            strokeDasharray="14 14"
            opacity={ghost}
          />
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
        <Arrow from={layout.back.from} to={layout.back.to} bend={layout.back.bend} progress={enter(frame, fps, revealAt.loop + 0.2, 0.5)} />

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

        <div style={{ position: 'absolute', left: layout.stop.x, top: layout.stop.y - layout.stop.height / 2 - 62, width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Pill variant="coral" dot fontSize={34} progress={Math.min(1, stop)} style={{ flexShrink: 0, background: theme.color.paper, opacity: stop }}>
            {stopLabel}
          </Pill>
        </div>

        <Node glyph="book" name={studyLabel} hint={studyHint} center={layout.study} size={layout.badge} labelY={layout.labelY} progress={study} />
        <Node
          glyph="code"
          variant="ink"
          name={practiceLabel}
          hint={practiceHint}
          center={layout.practice}
          size={layout.badge}
          labelY={layout.labelY}
          progress={practice}
          scale={0.8 + 0.2 * popIn(frame, fps, revealAt.practice, 0.45)}
        />

        <SceneCard
          progress={enter(frame, fps, revealAt.study + 0.15, 0.5)}
          padding="34px 40px"
          style={{ position: 'absolute', left: meter.x, top: meter.y, width: meter.width, height: meter.height, display: 'flex', flexDirection: 'column', gap: 26 }}
        >
          <Eyebrow>{levelLabel}</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40 }}>
            <div
              style={{
                position: 'relative',
                width: meter.track.width,
                height: meter.track.height,
                borderRadius: theme.radius.pill,
                background: alpha(theme.color.slate300, 0.55),
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: meter.track.height * fill, borderRadius: theme.radius.pill, background: theme.color.emerald }} />
            </div>
            <div
              style={{
                fontFamily: theme.font.body,
                fontWeight: 800,
                fontSize: 190,
                lineHeight: 0.9,
                letterSpacing: '-0.035em',
                fontVariantNumeric: 'tabular-nums',
                color: theme.color.slate900,
              }}
            >
              {levelNumber(fill)}
            </div>
          </div>
        </SceneCard>
      </div>

      <div style={{ position: 'relative', width: layout.width, height: 100 }}>
        <Caption presence={presenceWindow(frame, revealAt.study + 0.3, revealAt.notOnly + 0.05, fps, 0.3)} atSec={revealAt.study + 0.3}>
          {captions.study}
        </Caption>
        <Caption presence={presenceWindow(frame, revealAt.notOnly + 0.05, revealAt.practice + 0.05, fps, 0.3)} atSec={revealAt.notOnly + 0.1}>
          {captions.stalled}
        </Caption>
        <Caption presence={presenceWindow(frame, revealAt.practice + 0.05, endSec, fps, 0.3)} atSec={revealAt.practice + 0.1}>
          {captions.loop}
        </Caption>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: EstudarEPraticar,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 9,
  description:
    'Cena papel: só estudar é um caminho que para no bloqueio; ao entrar a prática, vira o ciclo estudar → praticar → estudar, que gira e faz o medidor de nível subir.',
};

export const MODEL = 'CicloDeDoisPassos';
