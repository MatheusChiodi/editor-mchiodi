import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, Arrow, enter, Eyebrow, IconBadge, longShadow, Pill, type Point, popIn, rise, SceneBackground, Statement, text } from '../../scene-kit';
import { motion, theme } from '../../theme';

export interface NaoAcabouReveal {
  /** primeiro degrau: aluno */
  student: number;
  /** "ter feito o Campus Expert": segundo degrau */
  expert: number;
  /** "acabou e já era": a placa "Fim?" */
  end: number;
  /** "nada disso": a placa é riscada */
  notEnd: number;
  /** "turma Alumni": o próximo degrau e a trilha que continua */
  alumni: number;
}

export interface NaoAcabouProps {
  /** segundos relativos ao início da cena */
  revealAt?: NaoAcabouReveal;
  eyebrow?: string;
  studentLabel?: string;
  expertLabel?: string;
  endLabel?: string;
  alumniLabel?: string;
  alumniHint?: string;
  title?: string;
  continueLabel?: string;
}

export const NAO_ACABOU_REVEAL: NaoAcabouReveal = { student: 0.4, expert: 1.4, end: 3.0, notEnd: 4.4, alumni: 5.6 };

const MARKER = 84;
const HOP = { delay: 0.2, seconds: 0.6, arc: 70 };

export interface Stair {
  x: number;
  width: number;
  height: number;
  /** y do topo do degrau */
  top: number;
}

export interface StairLayout {
  width: number;
  height: number;
  baseline: number;
  steps: [Stair, Stair, Stair];
  /** centro do bonequinho em cima de cada degrau */
  anchors: [Point, Point, Point];
  /** placa "Fim?": centro horizontal e base (apoiada no segundo degrau) */
  sign: { centerX: number; bottom: number; width: number; post: number };
  trail: { from: Point; to: Point; bend: number; label: Point };
  marker: number;
}

/** Escada de três degraus subindo para a direita, com a trilha que continua depois do último. */
export function stairLayout(width = 1728, height = 836): StairLayout {
  const stepWidth = 420;
  const gap = 20;
  const left = 40;
  const baseline = height - 26;
  const heights = [170, 310, 450] as const;
  const steps = heights.map((stepHeight, index) => ({
    x: left + index * (stepWidth + gap),
    width: stepWidth,
    height: stepHeight,
    top: baseline - stepHeight,
  })) as [Stair, Stair, Stair];
  const anchors = steps.map((step): Point => [step.x + 110, step.top - 12 - MARKER / 2]) as [Point, Point, Point];
  const last = steps[2];
  const end = last.x + last.width;
  return {
    width,
    height,
    baseline,
    steps,
    anchors,
    sign: { centerX: steps[1].x + steps[1].width - 120, bottom: steps[1].top, width: 196, post: 40 },
    trail: {
      from: [end + 26, last.top + 16],
      to: [width - 30, last.top - 200],
      bend: -18,
      label: [(end + width) / 2, last.top + 96],
    },
    marker: MARKER,
  };
}

/** Ponto de um pulo em arco de `from` a `to` (`t` 0→1): sobe `arc` px no meio. */
export function hop(from: Point, to: Point, t: number, arc = HOP.arc): Point {
  const clamped = Math.max(0, Math.min(1, t));
  return [from[0] + (to[0] - from[0]) * clamped, from[1] + (to[1] - from[1]) * clamped - Math.sin(Math.PI * clamped) * arc];
}

/** Onde o bonequinho está: parado no degrau do aluno, pula para o Campus Expert e depois para o Alumni. */
export function markerAt(frame: number, fps: number, revealAt: Pick<NaoAcabouReveal, 'expert' | 'alumni'>, anchors: readonly [Point, Point, Point]): Point {
  const jump = (start: number) =>
    interpolate(frame, [(start + HOP.delay) * fps, (start + HOP.delay + HOP.seconds) * fps], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: motion.move,
    });
  const second = jump(revealAt.alumni);
  return second > 0 ? hop(anchors[1], anchors[2], second) : hop(anchors[0], anchors[1], jump(revealAt.expert));
}

const Step: React.FC<{ stair: Stair; baseline: number; index: number; label: string; hint?: string; progress: number; done?: boolean }> = ({
  stair,
  baseline,
  index,
  label,
  hint,
  progress,
  done = false,
}) => (
  // o degrau cresce a partir do chão; o texto fica preso ao topo e é revelado pelo recorte
  <div
    style={{
      position: 'absolute',
      left: stair.x,
      top: baseline - stair.height * progress,
      width: stair.width,
      height: stair.height * progress,
      overflow: 'hidden',
      boxSizing: 'border-box',
      borderRadius: `${theme.radius.card}px ${theme.radius.card}px 0 0`,
      background: done ? alpha(theme.color.emerald, 0.14) : alpha(theme.color.white, 0.72),
      border: `2px solid ${done ? alpha(theme.color.emerald, 0.7) : alpha(theme.color.white, 0.9)}`,
      borderBottom: 'none',
      boxShadow: longShadow,
      opacity: Math.min(1, progress * 2),
    }}
  >
    <div style={{ padding: '26px 36px', display: 'flex', flexDirection: 'column', gap: 6, ...rise(progress, 18) }}>
      <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: text.eyebrow, letterSpacing: '0.2em', color: theme.color.slate600 }}>
        {String(index + 1).padStart(2, '0')}
      </div>
      <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: 48, lineHeight: 1.15, color: theme.color.slate900, whiteSpace: 'nowrap' }}>{label}</div>
      {hint ? (
        <div style={{ marginTop: 14, fontFamily: theme.font.body, fontWeight: 500, fontSize: text.label, lineHeight: 1.3, color: theme.color.slate600 }}>{hint}</div>
      ) : null}
    </div>
  </div>
);

/** "Achou que acabou? Nada disso": Aluno, Campus Expert, um falso "Fim?" riscado e o degrau seguinte, Alumni. */
export const NaoAcabou: React.FC<NaoAcabouProps & BaseProps> = ({
  revealAt = NAO_ACABOU_REVEAL,
  eyebrow = 'A trilha',
  studentLabel = 'Aluno',
  expertLabel = 'Campus Expert',
  endLabel = 'Fim?',
  alumniLabel = 'Alumni',
  alumniHint = 'A turma de quem já se formou.',
  title = 'Nada disso.',
  continueLabel = 'e continua',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const layout = stairLayout(width - theme.safe.x * 2, height - theme.safe.y - 180);
  const [student, expert, alumni] = layout.steps;
  const marker = markerAt(frame, fps, revealAt, layout.anchors);
  const sign = enter(frame, fps, revealAt.end, 0.4);
  const strike = enter(frame, fps, revealAt.notEnd, 0.35);
  const signHeight = 96;
  const strikeLength = layout.sign.width + 36;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        <div style={{ position: 'absolute', left: student.x, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 26 }}>
          <Eyebrow progress={enter(frame, fps, 0.1)} style={{ marginRight: 0 }}>
            {eyebrow}
          </Eyebrow>
          <div style={{ opacity: frame >= (revealAt.notEnd + 0.15) * fps ? 1 : 0 }}>
            <Statement text={title} atSec={revealAt.notEnd + 0.15} fontSize={104} align="left" maxWidth={820} />
          </div>
        </div>

        {/* linha do chão: a escada nasce dela */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: layout.baseline,
            width: layout.width * enter(frame, fps, 0.1, 0.7),
            height: 3,
            borderRadius: 2,
            background: theme.color.slate300,
          }}
        />
        <Step stair={student} baseline={layout.baseline} index={0} label={studentLabel} progress={enter(frame, fps, revealAt.student, 0.5)} />
        <Step stair={expert} baseline={layout.baseline} index={1} label={expertLabel} progress={enter(frame, fps, revealAt.expert, 0.5)} />
        <Step stair={alumni} baseline={layout.baseline} index={2} label={alumniLabel} hint={alumniHint} progress={enter(frame, fps, revealAt.alumni, 0.55)} done />

        {/* placa "Fim?" fincada no fim do segundo degrau; o risco é o único coral da tela */}
        <div
          style={{
            position: 'absolute',
            left: layout.sign.centerX - layout.sign.width / 2,
            top: layout.sign.bottom - layout.sign.post - signHeight,
            width: layout.sign.width,
            height: signHeight + layout.sign.post,
            opacity: sign * (1 - 0.4 * strike),
            scale: String(0.8 + 0.2 * popIn(frame, fps, revealAt.end, 0.4)),
            transformOrigin: '50% 100%',
          }}
        >
          <div style={{ position: 'absolute', left: layout.sign.width / 2 - 2, top: signHeight - 4, width: 4, height: layout.sign.post + 4, background: theme.color.slate900, borderRadius: 2 }} />
          <Pill fontSize={46} style={{ position: 'absolute', left: 0, top: 0, width: layout.sign.width, height: signHeight, boxSizing: 'border-box', justifyContent: 'center', background: theme.color.white }}>
            {endLabel}
          </Pill>
        </div>
        <svg
          style={{ position: 'absolute', left: layout.sign.centerX - strikeLength / 2, top: layout.sign.bottom - layout.sign.post - signHeight, overflow: 'visible' }}
          width={strikeLength}
          height={signHeight}
          fill="none"
          stroke={theme.color.coral}
          strokeWidth={8}
          strokeLinecap="round"
        >
          <path d={`M0 ${signHeight * 0.68}L${strikeLength} ${signHeight * 0.32}`} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - strike} opacity={strike > 0 ? 1 : 0} />
        </svg>

        <IconBadge
          icon="user"
          variant="ink"
          size={layout.marker}
          progress={enter(frame, fps, revealAt.student + 0.25, 0.4)}
          style={{ position: 'absolute', left: marker[0] - layout.marker / 2, top: marker[1] - layout.marker / 2, boxShadow: 'none' }}
        />

        <Arrow from={layout.trail.from} to={layout.trail.to} bend={layout.trail.bend} progress={enter(frame, fps, revealAt.alumni + 0.55, 0.6)} />
        <div style={{ position: 'absolute', left: layout.trail.label[0], top: layout.trail.label[1], width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Pill variant="emerald" dot progress={enter(frame, fps, revealAt.alumni + 0.8)}>
            {continueLabel}
          </Pill>
        </div>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: NaoAcabou,
  sample: { revealAt: NAO_ACABOU_REVEAL },
  defaultDuration: 7.5,
  description:
    'Cena papel: escada Aluno → Campus Expert, uma placa "Fim?" que é riscada e o degrau seguinte, Alumni, com a trilha continuando. Para a fala "achou que acabou? nada disso".',
};

export const MODEL = 'EscadaComProximoDegrau';
