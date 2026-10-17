import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, Arrow, enter, Eyebrow, Icon, Pill, type Point, popIn, rise, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { motion, theme } from '../../theme';
import { Glyph } from './glyphs-d';

export interface DeCoracaoProps {
  /** segundos relativos ao início da cena */
  revealAt?: {
    /** o coração se desenha e entra "feito de coração" */
    heart: number;
    /** aparece a etiqueta "Patrocinado" */
    sponsored: number;
    /** a etiqueta é riscada ("não fui patrocinado") */
    strike: number;
    /** entra "100% sincero" no lugar */
    sincere: number;
  };
  eyebrow?: string;
  title?: string;
  cardEyebrow?: string;
  sponsoredLabel?: string;
  sincereLabel?: string;
  note?: string;
}

const DEFAULT_REVEAL = { heart: 0.4, sponsored: 2.6, strike: 3.6, sincere: 4.8 };
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const CARD_WIDTH = 1500;
const CARD_PADDING = 48;
const PILL_FONT = 40;
/** altura da pílula de 40 px: linha + padding + borda */
export const PILL_HEIGHT = Math.round(PILL_FONT * 1.15 + PILL_FONT * 0.42 * 2 + 4);
/** altura aproximada do cartão de transparência com o espaçamento acima dele */
const CARD_BLOCK = 380;

export interface SwapLayout {
  width: number;
  height: number;
  sponsoredWidth: number;
  sincereWidth: number;
  /** x da etiqueta "Patrocinado" enquanto está sozinha (centralizada) */
  soloX: number;
  /** x de cada etiqueta depois da troca */
  sponsoredX: number;
  sincereX: number;
  arrow: { from: Point; to: Point };
}

/** Linha da troca: a etiqueta riscada vai para a esquerda, uma seta e a etiqueta nova à direita. */
export function swapLayout(width = CARD_WIDTH - CARD_PADDING * 2, sponsoredWidth = 400, sincereWidth = 860, height = PILL_HEIGHT): SwapLayout {
  const gap = width - sponsoredWidth - sincereWidth;
  const pad = Math.min(24, gap / 4);
  return {
    width,
    height,
    sponsoredWidth,
    sincereWidth,
    soloX: (width - sponsoredWidth) / 2,
    sponsoredX: 0,
    sincereX: width - sincereWidth,
    arrow: { from: [sponsoredWidth + pad, height / 2], to: [width - sincereWidth - pad, height / 2] },
  };
}

/** Risco sobre a etiqueta: passa um pouco das bordas e sobe levemente, como um traço à mão. */
export function strikeLine(width: number, height: number, overshoot = 16, tilt = 7): { from: Point; to: Point; length: number } {
  const from: Point = [-overshoot, height / 2 + tilt];
  const to: Point = [width + overshoot, height / 2 - tilt];
  return { from, to, length: Math.hypot(to[0] - from[0], to[1] - from[1]) };
}

/** Escala do coração: duas batidas curtas (tum-tum) a partir de `startSec`, depois repouso em 1. */
export function heartbeat(sec: number, startSec: number, amount = 0.07): number {
  const beat = (offset: number, strength: number) => {
    const t = (sec - startSec - offset) / 0.32;
    return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) * strength;
  };
  return 1 + beat(0, amount) + beat(0.36, amount * 0.6);
}

/** Aviso de transparência: feito de coração; a etiqueta "Patrocinado" é riscada e dá lugar a "100% sincero". */
export const DeCoracao: React.FC<DeCoracaoProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  eyebrow = 'Este vídeo',
  title = 'Feito de coração.',
  cardEyebrow = 'Transparência',
  sponsoredLabel = 'Patrocinado',
  sincereLabel = '100% sincero — minha experiência',
  note = 'Não fui patrocinado em nada pela empresa.',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = swapLayout();
  const strike = strikeLine(layout.sponsoredWidth, layout.height);

  const heart = enter(frame, fps, revealAt.heart, 0.9);
  const heartFill = enter(frame, fps, revealAt.heart + 0.7, 0.5);
  const card = enter(frame, fps, revealAt.sponsored, 0.5);
  const struck = enter(frame, fps, revealAt.strike, 0.4);
  const swap = interpolate(frame, [(revealAt.sincere - 0.15) * fps, (revealAt.sincere + 0.35) * fps], [0, 1], { ...clamp, easing: motion.move });
  const sincere = enter(frame, fps, revealAt.sincere + 0.15, 0.4);
  // até o cartão entrar, coração e frase ficam no centro da área útil; depois sobem e abrem espaço
  const lift = (1 - enter(frame, fps, revealAt.sponsored - 0.35, 0.7)) * CARD_BLOCK * 0.5;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 52 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, translate: `0px ${lift.toFixed(2)}px` }}>
        <div style={{ opacity: Math.min(1, heart * 2), scale: String(heartbeat(frame / fps, revealAt.heart + 1)) }}>
          <Glyph name="heart" size={150} color={theme.color.coral} strokeWidth={1.4} draw={heart} fill={alpha(theme.color.coral, 0.16 * heartFill)} />
        </div>
        <Statement text={title} eyebrow={eyebrow} atSec={revealAt.heart + 0.5} fontSize={104} />
      </div>

      <SceneCard progress={card} padding={`40px ${CARD_PADDING}px 44px`} width={CARD_WIDTH} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        <Eyebrow progress={enter(frame, fps, revealAt.sponsored + 0.1)}>{cardEyebrow}</Eyebrow>
        <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
          <div
            style={{
              position: 'absolute',
              left: layout.soloX + (layout.sponsoredX - layout.soloX) * swap,
              top: 0,
              width: layout.sponsoredWidth,
              height: layout.height,
              ...rise(enter(frame, fps, revealAt.sponsored + 0.2), 16),
            }}
          >
            <Pill
              fontSize={PILL_FONT}
              style={{ boxSizing: 'border-box', width: layout.sponsoredWidth, height: layout.height, justifyContent: 'center', opacity: 1 - 0.5 * struck }}
            >
              <Glyph name="tag" size={PILL_FONT * 0.95} color={theme.color.slate600} />
              {sponsoredLabel}
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
          <Arrow {...layout.arrow} progress={enter(frame, fps, revealAt.sincere, 0.4)} />
          <div
            style={{
              position: 'absolute',
              left: layout.sincereX,
              top: 0,
              width: layout.sincereWidth,
              height: layout.height,
              opacity: sincere,
              scale: String(0.85 + 0.15 * popIn(frame, fps, revealAt.sincere + 0.15, 0.45)),
            }}
          >
            <Pill variant="emerald" fontSize={PILL_FONT} style={{ boxSizing: 'border-box', width: layout.sincereWidth, height: layout.height, justifyContent: 'center' }}>
              <Icon name="check" size={PILL_FONT} color={theme.color.slate900} strokeWidth={2.2} draw={enter(frame, fps, revealAt.sincere + 0.3, 0.35)} />
              {sincereLabel}
            </Pill>
          </div>
        </div>
        <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: text.label, lineHeight: 1.3, color: theme.color.slate600, ...rise(enter(frame, fps, revealAt.strike + 0.35), 16) }}>
          {note}
        </div>
      </SceneCard>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: DeCoracao,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 6.5,
  description:
    'Cena papel: aviso de transparência. Coração em traço fino e "Feito de coração"; depois a etiqueta "Patrocinado" é riscada e trocada por "100% sincero — minha experiência".',
};

export const MODEL = 'EtiquetaRiscadaETrocada';
