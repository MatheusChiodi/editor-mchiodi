import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, usePresence } from '../anim';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';
import { withAlpha, wrapLines } from './SectionTitle';

export type BubbleSide = 'left' | 'right';

export interface SpeechBubbleProps {
  text: string;
  /** lado do balão em que fica a cauda: `left` = quem fala está à esquerda do balão */
  from?: BubbleSide;
  /** ponto para onde a cauda aponta (a boca de quem fala), normalizado 0–1 sobre a tela */
  x?: number;
  y?: number;
}

export interface BubbleLayout {
  lines: string[];
  fontSize: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** ponta da cauda e o ponto do balão em que ela nasce, em px de tela */
  tip: { x: number; y: number };
  attachY: number;
}

const CANVAS = { width: 1920, height: 1080 };
export const TAIL_LENGTH = 54;
export const TAIL_HALF = 22;
const RADIUS = 36;
const PAD_X = 44;
const PAD_Y = 32;
const LINE_HEIGHT = 1.28;
/** largura média de um caractere de Inter 600, em em; folgada para não estourar o balão */
const CHAR_EM = 0.56;

const TIERS = [
  { fontSize: 44, maxChars: 24, maxLines: 3 },
  { fontSize: 40, maxChars: 30, maxLines: 4 },
  { fontSize: 36, maxChars: 36, maxLines: 5 },
  { fontSize: 34, maxChars: 42, maxLines: Number.POSITIVE_INFINITY },
] as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const unit = (value: number | undefined, fallback: number) => (value !== undefined && Number.isFinite(value) ? clamp(value, 0, 1) : fallback);

/**
 * Geometria do balão: quebra o texto, estima o tamanho e encaixa tudo dentro da margem segura.
 * Se o balão precisar ser empurrado para caber, a ponta da cauda acompanha na horizontal e a
 * base desliza na vertical, para a cauda nunca se soltar do balão.
 */
export function bubbleLayout(text: string, from: BubbleSide = 'left', x?: number, y?: number): BubbleLayout {
  const tier = TIERS.find((candidate) => wrapLines(text, candidate.maxChars).length <= candidate.maxLines) ?? TIERS[TIERS.length - 1]!;
  const lines = wrapLines(text, tier.maxChars);
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 1);
  const width = Math.round(longest * tier.fontSize * CHAR_EM + 2 * PAD_X);
  const height = Math.round(Math.max(1, lines.length) * tier.fontSize * LINE_HEIGHT + 2 * PAD_Y);

  const pointX = unit(x, from === 'left' ? 0.42 : 0.58) * CANVAS.width;
  const pointY = unit(y, 0.3) * CANVAS.height;
  const minLeft = theme.safe.x + (from === 'left' ? TAIL_LENGTH : 0);
  const maxLeft = CANVAS.width - theme.safe.x - width - (from === 'right' ? TAIL_LENGTH : 0);
  const wantedLeft = from === 'left' ? pointX + TAIL_LENGTH : pointX - TAIL_LENGTH - width;
  const left = Math.round(clamp(wantedLeft, minLeft, Math.max(minLeft, maxLeft)));
  const top = Math.round(clamp(pointY - height / 2, theme.safe.y, Math.max(theme.safe.y, CANVAS.height - theme.safe.y - height)));
  const attachY = Math.round(clamp(pointY, top + RADIUS + TAIL_HALF, top + height - RADIUS - TAIL_HALF));

  return {
    lines,
    fontSize: tier.fontSize,
    left,
    top,
    width,
    height,
    tip: { x: from === 'left' ? left - TAIL_LENGTH : left + width + TAIL_LENGTH, y: attachY },
    attachY,
  };
}

export const SpeechBubble: React.FC<SpeechBubbleProps & BaseProps> = ({ text, from = 'left', x, y, durationInFrames }) => {
  const { frame, fps, exit, value } = usePresence(durationInFrames, motion.fast);
  const layout = bubbleLayout(text, from, x, y);
  const pop = interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: motion.pop });
  const fill = withAlpha(theme.color.paper, 0.97);
  // o balão cresce a partir da ponta da cauda, como se saísse da boca de quem fala
  const origin = `${layout.tip.x}px ${layout.tip.y}px`;
  const tailX = from === 'left' ? layout.left - TAIL_LENGTH : layout.left + layout.width - 2;
  const tail = from === 'left' ? `M ${TAIL_LENGTH + 2} 0 L 0 ${TAIL_HALF} L ${TAIL_LENGTH + 2} ${2 * TAIL_HALF} Z` : `M 0 0 L ${TAIL_LENGTH + 2} ${TAIL_HALF} L 0 ${2 * TAIL_HALF} Z`;

  return (
    <AbsoluteFill style={{ opacity: value, scale: 0.8 + 0.2 * pop - 0.04 * exit, transformOrigin: origin }}>
      <div style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 26px 34px rgba(15,23,42,0.5))' }}>
        <svg
          width={TAIL_LENGTH + 2}
          height={2 * TAIL_HALF}
          style={{ position: 'absolute', left: tailX, top: layout.attachY - TAIL_HALF }}
        >
          <path d={tail} fill={fill} strokeLinejoin="round" />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingLeft: PAD_X,
            paddingRight: PAD_X,
            background: fill,
            borderRadius: RADIUS,
          }}
        >
          {layout.lines.map((line, index) => (
            <div
              key={index}
              style={{
                fontFamily: theme.font.body,
                fontWeight: 600,
                fontSize: layout.fontSize,
                lineHeight: LINE_HEIGHT,
                whiteSpace: 'nowrap',
                color: theme.color.ink,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: SpeechBubble,
  sample: {
    text: 'Mas na minha máquina funciona!',
    from: 'left',
    x: 0.42,
    y: 0.3,
  },
  defaultDuration: 3.5,
  vertical: { zone: 'top', scale: 0.75 },
  description: 'Balão de fala saindo de alguém na imagem: pensamento em voz alta, resposta imaginária ou a frase clássica de dev; tom de humor.',
};
