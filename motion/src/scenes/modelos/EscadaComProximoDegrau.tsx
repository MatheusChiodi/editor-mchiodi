// MODELO de animação reutilizável: na EDL entra como `scene:modelos/EscadaComProximoDegrau`, em qualquer vídeo.
// Forma: uma escada sobe degrau a degrau com um marcador pulando; no penúltimo aparece uma placa de falso fim,
// que é riscada, e então nasce o degrau seguinte (verde) com a trilha continuando. 100% por props.

import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, Arrow, enter, Eyebrow, IconBadge, type IconName, longShadow, Pill, type Point, popIn, rise, SceneBackground, Statement, text } from '../../scene-kit';
import { motion, theme } from '../../theme';
import { clampCount, estimateLines, fillTimes, fitFontSize, pickSec, pillHeight, pillWidth } from './fit-b';

export interface EscadaComProximoDegrauStep {
  label: string;
  /** linha de apoio: só aparece nos degraus altos o bastante (em geral o último) */
  hint?: string;
}

export interface EscadaComProximoDegrauReveal {
  /** segundo em que cada degrau nasce, por índice; o último é o "próximo degrau" */
  steps?: number[];
  /** a placa de falso fim aparece no penúltimo degrau */
  end?: number;
  /** a placa é riscada e a frase entra */
  strike?: number;
}

export interface EscadaComProximoDegrauProps {
  eyebrow?: string;
  /** de 2 a 5 degraus, do mais baixo ao mais alto; o último é o que vem depois do falso fim */
  steps?: EscadaComProximoDegrauStep[];
  /** texto da placa fincada no penúltimo degrau */
  endLabel?: string;
  /** frase que entra quando a placa é riscada */
  title?: string;
  /** trecho do título em coral */
  accent?: string;
  /** pílula ao lado da seta que continua depois do último degrau (vazio = só a seta) */
  continueLabel?: string;
  /** ícone do marcador que sobe a escada */
  markerIcon?: IconName;
  /** segundos relativos ao início da cena; o que faltar segue em sequência */
  revealAt?: EscadaComProximoDegrauReveal;
}

export const STEP_RANGE = { min: 2, max: 5 } as const;

const DEFAULT_STEPS: EscadaComProximoDegrauStep[] = [{ label: 'Começo' }, { label: 'Meio' }, { label: 'O próximo', hint: 'O que vem depois do que parecia o fim.' }];

const GAP = 20;
const HOP = { delay: 0.2, seconds: 0.6 } as const;
const STEP_PAD_Y = 26;
const INDEX_BLOCK = 47;
const HINT_FONT = text.label;
const TITLE_FONT = { base: 104, min: 60 } as const;
const EYEBROW_BLOCK = 67;

export interface Stair {
  x: number;
  width: number;
  height: number;
  /** y do topo do degrau */
  top: number;
}

export interface StairLayout {
  count: number;
  width: number;
  height: number;
  baseline: number;
  steps: Stair[];
  /** centro do marcador em cima de cada degrau */
  anchors: Point[];
  marker: number;
  /** altura do arco do pulo: maior em degrau estreito, para o marcador passar por cima da placa */
  arc: number;
  /** padding lateral do texto dentro do degrau */
  padX: number;
  /** placa do falso fim: centro horizontal, base (topo do penúltimo degrau), largura máxima e altura da haste */
  sign: { centerX: number; bottom: number; maxWidth: number; post: number };
  trail: { from: Point; to: Point; bend: number; label: Point; labelWidth: number };
  /** canto do bloco eyebrow + frase e o espaço que ele pode ocupar sem encostar na placa */
  title: { x: number; maxWidth: number; maxHeight: number };
}

/** Escada de `count` degraus subindo para a direita, com a trilha que continua depois do último. */
export function stairLayout(count = 3, width = 1728, height = 836): StairLayout {
  const n = clampCount(count, STEP_RANGE.min, STEP_RANGE.max);
  const trailZone = n <= 3 ? 388 : 320;
  const stepWidth = Math.min(420, Math.floor((width - 40 - trailZone - GAP * (n - 1)) / n));
  const stairsWidth = n * stepWidth + GAP * (n - 1);
  const left = Math.max(40, Math.round((width - stairsWidth - trailZone) / 2));
  const baseline = height - 26;
  const lowest = n === 2 ? 250 : 170;
  const tallest = 450;
  const wide = stepWidth >= 380;
  const marker = wide ? 84 : 68;
  const steps: Stair[] = Array.from({ length: n }, (_, index) => {
    const stepHeight = Math.round(lowest + ((tallest - lowest) * index) / (n - 1));
    return { x: left + index * (stepWidth + GAP), width: stepWidth, height: stepHeight, top: baseline - stepHeight };
  });
  const anchorOffset = wide ? 110 : 20 + marker / 2;
  const anchors = steps.map((step): Point => [step.x + anchorOffset, step.top - 12 - marker / 2]);
  const before = steps[n - 2]!;
  const last = steps[n - 1]!;
  const end = last.x + last.width;
  // degrau largo: placa ao lado do marcador; estreito: placa em haste alta, acima do marcador
  const post = wide ? 40 : marker + 28;
  const signMax = wide ? stepWidth - anchorOffset - marker / 2 - 46 : stepWidth - 24;
  const titleX = n === 2 ? 0 : left;
  return {
    count: n,
    width,
    height,
    baseline,
    steps,
    anchors,
    marker,
    arc: wide ? 70 : 130,
    padX: wide ? 36 : 24,
    sign: { centerX: before.x + before.width - (wide ? 22 : 12) - signMax / 2, bottom: before.top, maxWidth: signMax, post },
    trail: {
      from: [end + 26, last.top + 16],
      to: [Math.min(width - 30, end + trailZone - 30), last.top - 200],
      bend: -18,
      label: [end + trailZone / 2, last.top + 96],
      labelWidth: trailZone - 16,
    },
    title: { x: titleX, maxWidth: last.x - titleX - 40, maxHeight: before.top - post - pillHeight(46) - 16 },
  };
}

/** Tempos da cena: degraus anteriores em sequência, a placa, o risco e, por último, o próximo degrau. */
export function stairTimes(count: number, revealAt: EscadaComProximoDegrauReveal = {}): { steps: number[]; end: number; strike: number } {
  const n = clampCount(count, STEP_RANGE.min, STEP_RANGE.max);
  const given = revealAt.steps ?? [];
  const before = fillTimes(n - 1, given, 0.4, 1);
  const end = pickSec(revealAt.end, before[n - 2]! + 1.6);
  const strike = pickSec(revealAt.strike, end + 1.4);
  const next = pickSec(given[n - 1], strike + 1.2);
  return { steps: [...before, next], end, strike };
}

/** Ponto de um pulo em arco de `from` a `to` (`t` 0→1): sobe `arc` px no meio. */
export function hop(from: Point, to: Point, t: number, arc = 70): Point {
  const clamped = Math.max(0, Math.min(1, t));
  return [from[0] + (to[0] - from[0]) * clamped, from[1] + (to[1] - from[1]) * clamped - Math.sin(Math.PI * clamped) * arc];
}

/** Onde o marcador está: parado no primeiro degrau e pulando para cada degrau quando ele nasce. */
export function markerAt(frame: number, fps: number, stepTimes: readonly number[], anchors: readonly Point[], arc = 70): Point {
  let position = anchors[0]!;
  for (let index = 1; index < anchors.length; index += 1) {
    const start = (stepTimes[index] ?? 0) + HOP.delay;
    const t = interpolate(frame, [start * fps, (start + HOP.seconds) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: motion.move });
    if (t <= 0) break;
    position = hop(anchors[index - 1]!, anchors[index]!, t, arc);
  }
  return position;
}

export interface StepText {
  fontSize: number;
  lines: number;
  /** a linha de apoio só entra quando o degrau tem altura para ela */
  showHint: boolean;
  /** altura do conteúdo, com o padding */
  height: number;
}

/** Como o texto de um degrau cabe nele: encolhe o nome até 36 px, quebra em linhas e decide se a linha de apoio cabe. */
export function stepText(step: EscadaComProximoDegrauStep, stair: Stair, padX: number): StepText {
  const inner = stair.width - padX * 2 - 4;
  const fontSize = fitFontSize(step.label, inner, 48, 36, 'display');
  const lines = estimateLines(step.label, inner, fontSize, 'display');
  const base = STEP_PAD_Y * 2 + INDEX_BLOCK + lines * fontSize * 1.15;
  const hintHeight = step.hint ? 14 + estimateLines(step.hint, inner, HINT_FONT) * HINT_FONT * 1.3 : 0;
  const showHint = Boolean(step.hint) && base + hintHeight <= stair.height;
  return { fontSize, lines, showHint, height: Math.ceil(base + (showHint ? hintHeight : 0)) };
}

/** Placa do falso fim: maior fonte (46 → 34) em que o texto cabe na largura reservada. */
export function signSize(label: string, maxWidth: number): { fontSize: number; width: number; height: number } {
  let fontSize = 46;
  while (fontSize > 34 && pillWidth(label, fontSize) > maxWidth) fontSize -= 2;
  return { fontSize, width: Math.max(150, pillWidth(label, fontSize)), height: pillHeight(fontSize) };
}

/** Frase do risco: maior fonte (104 → 60) em que eyebrow + frase cabem no espaço acima da placa. */
export function stairTitle(title: string, maxWidth: number, maxHeight: number, hasEyebrow: boolean): { fontSize: number; lines: number; height: number } {
  const measure = (fontSize: number) => {
    const lines = estimateLines(title, maxWidth, fontSize, 'display');
    return { fontSize, lines, height: Math.ceil((hasEyebrow ? EYEBROW_BLOCK : 0) + lines * fontSize * 1.12) };
  };
  let fontSize: number = TITLE_FONT.base;
  let result = measure(fontSize);
  while (result.height > maxHeight && fontSize > TITLE_FONT.min) {
    fontSize -= 4;
    result = measure(fontSize);
  }
  return result;
}

const Step: React.FC<{ stair: Stair; baseline: number; index: number; step: EscadaComProximoDegrauStep; padX: number; progress: number; next?: boolean }> = ({ stair, baseline, index, step, padX, progress, next = false }) => {
  const fit = stepText(step, stair, padX);
  return (
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
        background: next ? alpha(theme.color.emerald, 0.14) : alpha(theme.color.white, 0.72),
        border: `2px solid ${next ? alpha(theme.color.emerald, 0.7) : alpha(theme.color.white, 0.9)}`,
        borderBottom: 'none',
        boxShadow: longShadow,
        opacity: Math.min(1, progress * 2),
      }}
    >
      <div style={{ padding: `${STEP_PAD_Y}px ${padX}px`, display: 'flex', flexDirection: 'column', gap: 6, ...rise(progress, 18) }}>
        <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: text.eyebrow, lineHeight: 1.2, letterSpacing: '0.2em', color: theme.color.slate600 }}>{String(index + 1).padStart(2, '0')}</div>
        <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: fit.fontSize, lineHeight: 1.15, color: theme.color.slate900 }}>{step.label}</div>
        {fit.showHint ? <div style={{ marginTop: 8, fontFamily: theme.font.body, fontWeight: 500, fontSize: HINT_FONT, lineHeight: 1.3, color: theme.color.slate600 }}>{step.hint}</div> : null}
      </div>
    </div>
  );
};

export const EscadaComProximoDegrau: React.FC<EscadaComProximoDegrauProps & BaseProps> = ({
  eyebrow,
  steps = DEFAULT_STEPS,
  endLabel = 'Fim?',
  title = 'Ainda não.',
  accent,
  continueLabel = 'e continua',
  markerIcon = 'user',
  revealAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const shown = (steps.length ? steps : DEFAULT_STEPS).slice(0, STEP_RANGE.max);
  const layout = stairLayout(shown.length, width - theme.safe.x * 2, height - theme.safe.y - 180);
  const count = Math.min(shown.length, layout.count);
  const times = stairTimes(count, revealAt);
  const marker = markerAt(frame, fps, times.steps, layout.anchors.slice(0, count), layout.arc);
  const signIn = enter(frame, fps, times.end, 0.4);
  const strike = enter(frame, fps, times.strike, 0.35);
  const sign = signSize(endLabel, layout.sign.maxWidth);
  const signLeft = layout.sign.centerX - sign.width / 2;
  const signTop = layout.sign.bottom - layout.sign.post - sign.height;
  const strikeLength = sign.width + 36;
  const heading = stairTitle(title, layout.title.maxWidth, layout.title.maxHeight, Boolean(eyebrow));
  const nextAt = times.steps[count - 1] ?? 0;
  const continueFont = fitFontSize(continueLabel, layout.trail.labelWidth - 100, text.label, 34);

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        <div style={{ position: 'absolute', left: layout.title.x, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 26 }}>
          {eyebrow ? (
            <Eyebrow progress={enter(frame, fps, 0.1)} style={{ marginRight: 0 }}>
              {eyebrow}
            </Eyebrow>
          ) : null}
          <div style={{ opacity: frame >= (times.strike + 0.15) * fps ? 1 : 0 }}>
            <Statement text={title} accent={accent} atSec={times.strike + 0.15} fontSize={heading.fontSize} align="left" maxWidth={layout.title.maxWidth} />
          </div>
        </div>

        {/* linha do chão: a escada nasce dela */}
        <div style={{ position: 'absolute', left: 0, top: layout.baseline, width: layout.width * enter(frame, fps, 0.1, 0.7), height: 3, borderRadius: 2, background: theme.color.slate300 }} />
        {shown.slice(0, count).map((step, index) => (
          <Step
            key={index}
            stair={layout.steps[index]!}
            baseline={layout.baseline}
            index={index}
            step={step}
            padX={layout.padX}
            progress={enter(frame, fps, times.steps[index]!, index === count - 1 ? 0.55 : 0.5)}
            next={index === count - 1}
          />
        ))}

        {/* placa fincada no fim do penúltimo degrau; o risco é o único coral da tela */}
        <div
          style={{
            position: 'absolute',
            left: signLeft,
            top: signTop,
            width: sign.width,
            height: sign.height + layout.sign.post,
            opacity: signIn * (1 - 0.4 * strike),
            scale: String(0.8 + 0.2 * popIn(frame, fps, times.end, 0.4)),
            transformOrigin: '50% 100%',
          }}
        >
          <div style={{ position: 'absolute', left: sign.width / 2 - 2, top: sign.height - 4, width: 4, height: layout.sign.post + 4, background: theme.color.slate900, borderRadius: 2 }} />
          <Pill fontSize={sign.fontSize} style={{ position: 'absolute', left: 0, top: 0, width: sign.width, height: sign.height, boxSizing: 'border-box', justifyContent: 'center', background: theme.color.white }}>
            {endLabel}
          </Pill>
        </div>
        <svg style={{ position: 'absolute', left: layout.sign.centerX - strikeLength / 2, top: signTop, overflow: 'visible' }} width={strikeLength} height={sign.height} fill="none" stroke={theme.color.coral} strokeWidth={8} strokeLinecap="round">
          <path d={`M0 ${sign.height * 0.68}L${strikeLength} ${sign.height * 0.32}`} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - strike} opacity={strike > 0 ? 1 : 0} />
        </svg>

        <IconBadge
          icon={markerIcon}
          variant="ink"
          size={layout.marker}
          progress={enter(frame, fps, times.steps[0]! + 0.25, 0.4)}
          style={{ position: 'absolute', left: marker[0] - layout.marker / 2, top: marker[1] - layout.marker / 2, boxShadow: 'none' }}
        />

        <Arrow from={layout.trail.from} to={layout.trail.to} bend={layout.trail.bend} progress={enter(frame, fps, nextAt + 0.55, 0.6)} />
        {continueLabel ? (
          <div style={{ position: 'absolute', left: layout.trail.label[0], top: layout.trail.label[1], width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Pill variant="emerald" dot fontSize={continueFont} progress={enter(frame, fps, nextAt + 0.8)} style={{ flexShrink: 0 }}>
              {continueLabel}
            </Pill>
          </div>
        ) : null}
      </div>
    </SceneBackground>
  );
};

const SAMPLE_STEPS: EscadaComProximoDegrauStep[] = [
  { label: 'Estágio' },
  { label: 'Júnior' },
  { label: 'Pleno' },
  { label: 'Sênior', hint: 'Onde a maioria acha que para.' },
];

export const entry: ComponentEntry = {
  component: EscadaComProximoDegrau,
  sample: {
    eyebrow: 'A carreira',
    steps: SAMPLE_STEPS,
    endLabel: 'Topo?',
    title: 'Ainda tem degrau.',
    continueLabel: 'e segue',
    markerIcon: 'user',
    revealAt: { steps: [0.4, 1.2, 2, 5.6], end: 3.2, strike: 4.4 },
  },
  defaultDuration: 7.5,
  description:
    'Para a fala "achou que acabava aqui? tem mais": a escada sobe degrau a degrau com um marcador pulando, uma placa de falso fim aparece ' +
    'no penúltimo degrau, é riscada, e nasce o próximo degrau com a trilha continuando. Serve para níveis de carreira, etapas de um curso, versões de um produto, fases de um projeto.',
  tags: ['escada', 'degraus', 'trilha', 'progressão', 'falso-fim'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/NaoAcabou' },
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno no alto à esquerda' },
    { name: 'steps', type: '{ label: string; hint?: string }[] (2 a 5)', description: 'degraus do mais baixo ao mais alto; o último é o "próximo" (verde). Com 4 ou 5, nomes curtos (até ~12 caracteres por linha)' },
    { name: 'endLabel', type: 'string', description: 'texto da placa de falso fim, curto ("Fim?", "Topo?")' },
    { name: 'title', type: 'string', description: 'frase que entra quando a placa é riscada' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral; use com parcimônia, o risco da placa já é coral' },
    { name: 'continueLabel', type: 'string?', description: 'pílula verde ao lado da seta que continua; vazio deixa só a seta' },
    { name: 'markerIcon', type: 'IconName?', description: 'ícone do marcador que sobe a escada; padrão user' },
    { name: 'revealAt', type: '{ steps?: number[]; end?: number; strike?: number }', description: 'segundo de cada degrau por índice (o último nasce depois do risco), da placa e do risco' },
  ],
};
