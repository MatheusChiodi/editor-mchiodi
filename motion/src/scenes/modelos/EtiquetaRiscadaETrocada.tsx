// MODELO de animação reutilizável: na EDL entra como `scene:modelos/EtiquetaRiscadaETrocada`, em qualquer vídeo.
// Forma: um ícone em coral se desenha com o título; depois um cartão mostra uma etiqueta (o que as pessoas supõem),
// ela é riscada, desliza para o lado e uma seta leva à etiqueta certa, em verde. 100% por props.

import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { Arrow, enter, Eyebrow, Icon, type IconName, Pill, type Point, popIn, rise, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { motion, theme } from '../../theme';
import { estimateLines, fitFontSize, pickSec, pillHeight, pillWidth } from './fit-b';

export interface EtiquetaRiscadaETrocadaReveal {
  /** o ícone se desenha e o título entra */
  icon?: number;
  /** o cartão aparece com a etiqueta errada */
  card?: number;
  /** a etiqueta errada é riscada (e a nota entra) */
  strike?: number;
  /** a etiqueta certa entra no lugar */
  swap?: number;
}

export interface EtiquetaRiscadaETrocadaProps {
  /** ícone grande em coral, acima do título: o único acento da tela */
  icon?: IconName;
  eyebrow?: string;
  title?: string;
  /** rótulo pequeno dentro do cartão */
  cardEyebrow?: string;
  /** a etiqueta que será riscada */
  wrongLabel?: string;
  /** a etiqueta que entra no lugar */
  rightLabel?: string;
  /** frase de apoio embaixo das etiquetas */
  note?: string;
  /** segundos relativos ao início da cena; o que faltar segue em sequência */
  revealAt?: EtiquetaRiscadaETrocadaReveal;
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const CARD_WIDTH = 1500;
const CARD_PADDING = 48;
const PILL_FONT = { base: 40, min: 34 } as const;
const ARROW_GAP = { min: 120, max: 220 } as const;
const ICON_SIZE = 150;
const TITLE_FONT = { base: 104, min: 64 } as const;
const BLOCK_GAP = 52;

export interface SwapLayout {
  width: number;
  height: number;
  fontSize: number;
  wrongWidth: number;
  rightWidth: number;
  /** x da etiqueta errada enquanto está sozinha (centralizada) */
  soloX: number;
  /** x de cada etiqueta depois da troca */
  wrongX: number;
  rightX: number;
  arrow: { from: Point; to: Point };
  /** false quando nem na menor fonte as duas etiquetas cabem lado a lado */
  fits: boolean;
}

/** Linha da troca: a etiqueta riscada vai para a esquerda, uma seta e a etiqueta nova à direita, o conjunto centralizado. */
export function swapLayout(wrongLabel: string, rightLabel: string, width = CARD_WIDTH - CARD_PADDING * 2): SwapLayout {
  const widths = (fontSize: number) => ({ wrong: Math.max(240, pillWidth(wrongLabel, fontSize)), right: Math.max(240, pillWidth(rightLabel, fontSize, 'icon')) });
  let fontSize: number = PILL_FONT.base;
  while (fontSize > PILL_FONT.min && widths(fontSize).wrong + widths(fontSize).right + ARROW_GAP.min > width) fontSize -= 2;
  const { wrong, right } = widths(fontSize);
  const gap = Math.max(ARROW_GAP.min, Math.min(ARROW_GAP.max, width - wrong - right));
  const start = (width - (wrong + gap + right)) / 2;
  const height = pillHeight(fontSize);
  // o risco passa 16 px da etiqueta: a seta começa depois dele
  const pad = Math.min(36, gap / 4);
  return {
    width,
    height,
    fontSize,
    wrongWidth: wrong,
    rightWidth: right,
    soloX: (width - wrong) / 2,
    wrongX: start,
    rightX: start + wrong + gap,
    arrow: { from: [start + wrong + pad, height / 2], to: [start + wrong + gap - pad, height / 2] },
    fits: start >= 0,
  };
}

/** Tempos da cena: ícone e título, o cartão, o risco e a troca. */
export function swapTimes(revealAt: EtiquetaRiscadaETrocadaReveal = {}): Required<EtiquetaRiscadaETrocadaReveal> {
  const pick = pickSec;
  const icon = pick(revealAt.icon, 0.4);
  const card = pick(revealAt.card, icon + 2.2);
  const strike = pick(revealAt.strike, card + 1);
  const swap = pick(revealAt.swap, strike + 1.2);
  return { icon, card, strike, swap };
}

/** Risco sobre a etiqueta: passa um pouco das bordas e sobe levemente, como um traço à mão. */
export function strikeLine(width: number, height: number, overshoot = 16, tilt = 7): { from: Point; to: Point; length: number } {
  const from: Point = [-overshoot, height / 2 + tilt];
  const to: Point = [width + overshoot, height / 2 - tilt];
  return { from, to, length: Math.hypot(to[0] - from[0], to[1] - from[1]) };
}

/** Escala do ícone: duas batidas curtas a partir de `startSec`, depois repouso em 1. */
export function pulse(sec: number, startSec: number, amount = 0.07): number {
  const beat = (offset: number, strength: number) => {
    const t = (sec - startSec - offset) / 0.32;
    return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) * strength;
  };
  return 1 + beat(0, amount) + beat(0.36, amount * 0.6);
}

/** Título em uma linha sempre que der (104 → 64 px); mais longo que isso, quebra na menor fonte. */
export function swapTitleFont(title: string, width = CARD_WIDTH): { fontSize: number; lines: number } {
  const fontSize = fitFontSize(title, width, TITLE_FONT.base, TITLE_FONT.min, 'display');
  return { fontSize, lines: estimateLines(title, width, fontSize, 'display') };
}

/** Altura do cartão (com as etiquetas e a nota) e da pilha inteira, para conferir contra a área útil. */
export function swapStackHeight(options: { title: string; hasEyebrow: boolean; hasCardEyebrow: boolean; note?: string; pill: number }): { card: number; total: number } {
  const heading = swapTitleFont(options.title);
  const eyebrow = options.hasEyebrow ? text.eyebrow * 1.2 + heading.fontSize * 0.3 : 0;
  const top = ICON_SIZE + 30 + eyebrow + heading.lines * heading.fontSize * 1.12;
  const noteLines = options.note ? estimateLines(options.note, CARD_WIDTH - CARD_PADDING * 2, text.label) : 0;
  const card = 40 + (options.hasCardEyebrow ? text.eyebrow * 1.2 + 30 : 0) + options.pill + (noteLines ? 30 + noteLines * text.label * 1.3 : 0) + 44 + 4;
  return { card: Math.ceil(card), total: Math.ceil(top + BLOCK_GAP + card) };
}

export const EtiquetaRiscadaETrocada: React.FC<EtiquetaRiscadaETrocadaProps & BaseProps> = ({
  icon = 'check',
  eyebrow,
  title = 'O que isto é de verdade.',
  cardEyebrow,
  wrongLabel = 'O que parece',
  rightLabel = 'O que é',
  note,
  revealAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = swapLayout(wrongLabel, rightLabel);
  const times = swapTimes(revealAt);
  const strike = strikeLine(layout.wrongWidth, layout.height);
  const heading = swapTitleFont(title);
  const stack = swapStackHeight({ title, hasEyebrow: Boolean(eyebrow), hasCardEyebrow: Boolean(cardEyebrow), note, pill: layout.height });

  const drawn = enter(frame, fps, times.icon, 0.9);
  const card = enter(frame, fps, times.card, 0.5);
  const struck = enter(frame, fps, times.strike, 0.4);
  const swap = interpolate(frame, [(times.swap - 0.15) * fps, (times.swap + 0.35) * fps], [0, 1], { ...clamp, easing: motion.move });
  const right = enter(frame, fps, times.swap + 0.15, 0.4);
  // até o cartão entrar, ícone e frase ficam no centro da área útil; depois sobem e abrem espaço
  const lift = (1 - enter(frame, fps, times.card - 0.35, 0.7)) * (stack.card + BLOCK_GAP) * 0.5;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: BLOCK_GAP }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, translate: `0px ${lift.toFixed(2)}px` }}>
        <div style={{ opacity: Math.min(1, drawn * 2), scale: String(pulse(frame / fps, times.icon + 1)) }}>
          <Icon name={icon} size={ICON_SIZE} color={theme.color.coral} strokeWidth={1.4} draw={drawn} />
        </div>
        <Statement text={title} eyebrow={eyebrow} atSec={times.icon + 0.5} fontSize={heading.fontSize} maxWidth={CARD_WIDTH} />
      </div>

      <SceneCard progress={card} padding={`40px ${CARD_PADDING}px 44px`} width={CARD_WIDTH} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        {cardEyebrow ? <Eyebrow progress={enter(frame, fps, times.card + 0.1)}>{cardEyebrow}</Eyebrow> : null}
        <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
          <div
            style={{
              position: 'absolute',
              left: layout.soloX + (layout.wrongX - layout.soloX) * swap,
              top: 0,
              width: layout.wrongWidth,
              height: layout.height,
              ...rise(enter(frame, fps, times.card + 0.2), 16),
            }}
          >
            <Pill fontSize={layout.fontSize} style={{ boxSizing: 'border-box', width: layout.wrongWidth, height: layout.height, justifyContent: 'center', opacity: 1 - 0.5 * struck }}>
              {wrongLabel}
            </Pill>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none">
              <line
                x1={strike.from[0]}
                y1={strike.from[1]}
                x2={strike.to[0]}
                y2={strike.to[1]}
                stroke={theme.color.slate900}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={strike.length}
                strokeDashoffset={strike.length * (1 - struck)}
                opacity={struck > 0 ? 1 : 0}
              />
            </svg>
          </div>
          <Arrow {...layout.arrow} progress={enter(frame, fps, times.swap, 0.4)} />
          <div
            style={{
              position: 'absolute',
              left: layout.rightX,
              top: 0,
              width: layout.rightWidth,
              height: layout.height,
              opacity: right,
              scale: String(0.85 + 0.15 * popIn(frame, fps, times.swap + 0.15, 0.45)),
            }}
          >
            <Pill variant="emerald" fontSize={layout.fontSize} style={{ boxSizing: 'border-box', width: layout.rightWidth, height: layout.height, justifyContent: 'center' }}>
              <Icon name="check" size={layout.fontSize} color={theme.color.slate900} strokeWidth={2.2} draw={enter(frame, fps, times.swap + 0.3, 0.35)} />
              {rightLabel}
            </Pill>
          </div>
        </div>
        {note ? (
          <div style={{ textAlign: 'center', fontFamily: theme.font.body, fontWeight: 500, fontSize: text.label, lineHeight: 1.3, color: theme.color.slate600, ...rise(enter(frame, fps, times.strike + 0.35), 16) }}>{note}</div>
        ) : null}
      </SceneCard>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: EtiquetaRiscadaETrocada,
  sample: {
    icon: 'lock',
    eyebrow: 'Sobre a senha',
    title: 'Guardada do jeito certo.',
    cardEyebrow: 'No banco de dados',
    wrongLabel: 'Texto puro',
    rightLabel: 'Hash com sal — irreversível',
    note: 'Nem quem administra o banco consegue ler.',
    revealAt: { icon: 0.4, card: 2.6, strike: 3.6, swap: 4.8 },
  },
  defaultDuration: 6.5,
  description:
    'Para a fala "não é X, é Y" ou um aviso que corrige uma suposição: um ícone em coral e o título entram; depois um cartão mostra a etiqueta errada, ' +
    'ela é riscada, desliza para o lado e uma seta leva à etiqueta certa, em verde. Serve para aviso de transparência, mito e verdade, nome antigo e nome novo, jeito errado e jeito certo.',
  tags: ['troca', 'correção', 'etiqueta', 'antes-depois', 'mito-verdade'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/DeCoracao' },
  slots: [
    { name: 'icon', type: 'IconName?', description: 'ícone grande em coral acima do título (o único acento da tela); padrão check' },
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do título' },
    { name: 'title', type: 'string', description: 'a frase da cena; até ~40 caracteres fica em uma linha' },
    { name: 'cardEyebrow', type: 'string?', description: 'rótulo pequeno dentro do cartão' },
    { name: 'wrongLabel', type: 'string', description: 'a etiqueta que é riscada (o que se supõe)' },
    { name: 'rightLabel', type: 'string', description: 'a etiqueta que entra no lugar, em verde; as duas juntas até ~50 caracteres' },
    { name: 'note', type: 'string?', description: 'frase de apoio embaixo das etiquetas, entra com o risco' },
    { name: 'revealAt', type: '{ icon?: number; card?: number; strike?: number; swap?: number }', description: 'segundo do ícone com o título, do cartão, do risco e da troca' },
  ],
};
