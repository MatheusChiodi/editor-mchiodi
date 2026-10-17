import { AbsoluteFill, interpolate, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export type CalloutShape = 'arrow' | 'circle' | 'box' | 'underline';
export type CalloutSide = 'top' | 'bottom' | 'left' | 'right';

export interface CalloutProps {
  shape: CalloutShape;
  /** centro do alvo (ou a ponta, no caso de `arrow`), normalizado 0–1 sobre a tela */
  x: number;
  y: number;
  /** tamanho do alvo, normalizado 0–1; em `arrow`, `width` é o comprimento da seta */
  width?: number;
  height?: number;
  label?: string;
  labelSide?: CalloutSide;
}

interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Stroke {
  d: string;
  /** janela do progresso geral (0–1) em que este traço é desenhado */
  from: number;
  to: number;
}

export interface CalloutGeometry {
  strokes: Stroke[];
  /** região a que o rótulo se encosta */
  bounds: Bounds;
  side: CalloutSide;
}

const CANVAS = { width: 1920, height: 1080 };
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const round = (value: number) => Math.round(value * 10) / 10;

/** Curva suave que passa por todos os pontos (Catmull-Rom convertida em Béziers cúbicas). */
export function smoothPath(points: Point[]): string {
  const first = points[0];
  if (!first) return '';
  let d = `M ${round(first.x)} ${round(first.y)}`;
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[Math.max(0, index - 1)]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[Math.min(points.length - 1, index + 2)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

/**
 * Elipse "à mão": dá um pouco mais de uma volta enquanto o raio cresce, então o fim do traço
 * passa por fora do começo em vez de fechar perfeito.
 */
export function loopPoints(center: Point, rx: number, ry: number, samples = 40): Point[] {
  const startAngle = (-115 * Math.PI) / 180;
  const sweep = Math.PI * 2 * 1.1;
  return Array.from({ length: samples + 1 }, (_, index) => {
    const t = index / samples;
    const angle = startAngle + sweep * t;
    const grow = 0.96 + 0.17 * t;
    return { x: center.x + Math.cos(angle) * rx * grow, y: center.y + Math.sin(angle) * ry * grow };
  });
}

const sideVector: Record<CalloutSide, Point> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Sem `labelSide`, o rótulo vai para o lado com mais espaço na vertical. */
export function defaultSide(y: number): CalloutSide {
  return y < 0.3 ? 'bottom' : 'top';
}

/** Traços (em pixels) de cada forma e a região a que o rótulo se encosta. */
export function calloutGeometry(
  props: Pick<CalloutProps, 'shape' | 'x' | 'y' | 'width' | 'height' | 'labelSide'>,
  canvas: { width: number; height: number } = CANVAS,
): CalloutGeometry {
  const center = { x: clamp01(props.x) * canvas.width, y: clamp01(props.y) * canvas.height };
  const side = props.labelSide ?? defaultSide(clamp01(props.y));

  if (props.shape === 'arrow') {
    const length = Math.max(90, clamp01(props.width ?? 0.12) * canvas.width);
    const away = sideVector[side];
    const across = { x: -away.y, y: away.x };
    // cauda um pouco de lado: seta perfeitamente reta parece régua, não mão
    const tail = { x: center.x + away.x * length + across.x * length * 0.28, y: center.y + away.y * length + across.y * length * 0.28 };
    const toTip = { x: center.x - tail.x, y: center.y - tail.y };
    const distance = Math.hypot(toTip.x, toTip.y);
    const unit = { x: toTip.x / distance, y: toTip.y / distance };
    const tip = { x: center.x - unit.x * 14, y: center.y - unit.y * 14 };
    const control = {
      x: (tail.x + tip.x) / 2 + unit.y * distance * 0.14,
      y: (tail.y + tip.y) / 2 - unit.x * distance * 0.14,
    };
    const heading = Math.atan2(tip.y - control.y, tip.x - control.x);
    const wing = (offset: number): Point => ({
      x: tip.x - Math.cos(heading + offset) * 44,
      y: tip.y - Math.sin(heading + offset) * 44,
    });
    const [a, b] = [wing(0.5), wing(-0.5)];
    return {
      strokes: [
        { d: `M ${round(tail.x)} ${round(tail.y)} Q ${round(control.x)} ${round(control.y)} ${round(tip.x)} ${round(tip.y)}`, from: 0, to: 0.68 },
        { d: `M ${round(a.x)} ${round(a.y)} L ${round(tip.x)} ${round(tip.y)} L ${round(b.x)} ${round(b.y)}`, from: 0.68, to: 1 },
      ],
      bounds: { left: tail.x, top: tail.y, right: tail.x, bottom: tail.y },
      side,
    };
  }

  if (props.shape === 'underline') {
    const half = (clamp01(props.width ?? 0.2) * canvas.width) / 2;
    const { x, y } = center;
    return {
      strokes: [
        {
          d: `M ${round(x - half)} ${round(y + 3)} C ${round(x - half / 3)} ${round(y - 8)} ${round(x + half / 3)} ${round(y + 8)} ${round(x + half)} ${round(y - 4)}`,
          from: 0,
          to: 1,
        },
      ],
      bounds: { left: x - half, top: y - 10, right: x + half, bottom: y + 10 },
      side,
    };
  }

  const width = clamp01(props.width ?? (props.shape === 'circle' ? 0.16 : 0.24)) * canvas.width;
  // sem altura, o círculo sai redondo em pixels (a tela não é quadrada)
  const height = props.height === undefined ? (props.shape === 'circle' ? width : width * 0.6) : clamp01(props.height) * canvas.height;
  const bounds: Bounds = {
    left: center.x - width / 2,
    top: center.y - height / 2,
    right: center.x + width / 2,
    bottom: center.y + height / 2,
  };

  if (props.shape === 'circle') {
    const points = loopPoints(center, width / 2, height / 2);
    return {
      strokes: [{ d: smoothPath(points), from: 0, to: 1 }],
      bounds: { left: bounds.left - width * 0.06, top: bounds.top - height * 0.06, right: bounds.right + width * 0.06, bottom: bounds.bottom + height * 0.06 },
      side,
    };
  }

  const { left, top, right, bottom } = bounds;
  const radius = Math.min(18, width / 4, height / 4);
  const overshoot = Math.min(40, width / 5);
  const d = [
    `M ${round(left + radius + 12)} ${round(top + 3)}`,
    `L ${round(right - radius)} ${round(top - 2)}`,
    `Q ${round(right + 2)} ${round(top - 2)} ${round(right + 1)} ${round(top + radius)}`,
    `L ${round(right - 1)} ${round(bottom - radius)}`,
    `Q ${round(right - 1)} ${round(bottom + 2)} ${round(right - radius)} ${round(bottom + 1)}`,
    `L ${round(left + radius)} ${round(bottom - 1)}`,
    `Q ${round(left - 2)} ${round(bottom - 1)} ${round(left - 1)} ${round(bottom - radius)}`,
    `L ${round(left + 1)} ${round(top + radius)}`,
    `Q ${round(left + 1)} ${round(top - 6)} ${round(left + radius)} ${round(top - 9)}`,
    `L ${round(left + radius + overshoot)} ${round(top - 22)}`,
  ].join(' ');
  return { strokes: [{ d, from: 0, to: 1 }], bounds, side };
}

const LABEL_FONT = 32;
const LABEL_PAD_X = 26;
const LABEL_HEIGHT = 64;
const LABEL_MAX_WIDTH = 760;
const LABEL_GAP = 22;

/** Estimativa da largura da pílula (Inter 600): só serve para mantê-la dentro da margem segura. */
export function estimateLabelWidth(text: string, fontSize = LABEL_FONT): number {
  return Math.min(LABEL_MAX_WIDTH, Math.ceil(text.length * fontSize * 0.58) + LABEL_PAD_X * 2);
}

/** Centro da pílula: encostada no lado pedido da forma e empurrada para dentro da margem segura. */
export function labelCenter(
  bounds: Bounds,
  side: CalloutSide,
  size: { width: number; height: number },
  canvas: { width: number; height: number } = CANVAS,
): Point {
  const middle = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  const raw: Record<CalloutSide, Point> = {
    top: { x: middle.x, y: bounds.top - LABEL_GAP - size.height / 2 },
    bottom: { x: middle.x, y: bounds.bottom + LABEL_GAP + size.height / 2 },
    left: { x: bounds.left - LABEL_GAP - size.width / 2, y: middle.y },
    right: { x: bounds.right + LABEL_GAP + size.width / 2, y: middle.y },
  };
  const point = raw[side];
  const limit = (value: number, half: number, margin: number, total: number) =>
    Math.max(margin + half, Math.min(total - margin - half, value));
  return {
    x: limit(point.x, size.width / 2, theme.safe.x, canvas.width),
    y: limit(point.y, size.height / 2, theme.safe.y, canvas.height),
  };
}

const DRAW_SEC = 0.6;

export const Callout: React.FC<CalloutProps & BaseProps> = ({ durationInFrames, label, ...shapeProps }) => {
  const { frame, fps, exit } = usePresence(durationInFrames);
  const { width, height } = useVideoConfig();
  const geometry = calloutGeometry(shapeProps, { width, height });

  const draw = interpolate(frame, [0, DRAW_SEC * fps], [0, 1], {
    easing: motion.move,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelIn = progressAt(frame, fps, DRAW_SEC * 0.55);
  const center = label
    ? labelCenter(geometry.bounds, geometry.side, { width: estimateLabelWidth(label), height: LABEL_HEIGHT }, { width, height })
    : null;
  const push = sideVector[geometry.side];

  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      <svg width={width} height={height} style={{ position: 'absolute', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.6))' }}>
        {geometry.strokes.map((stroke, index) => {
          const local = interpolate(draw, [stroke.from, stroke.to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          if (local <= 0) return null;
          return (
            <g key={index} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 2" strokeDashoffset={1 - local}>
              {/* contorno claro por baixo: o coral some em footage avermelhado ou escuro */}
              <path d={stroke.d} pathLength={1} stroke={theme.color.white} strokeWidth={16} />
              <path d={stroke.d} pathLength={1} stroke={theme.color.coral} strokeWidth={9} />
            </g>
          );
        })}
      </svg>
      {label && center ? (
        <div
          style={{
            position: 'absolute',
            left: center.x,
            top: center.y,
            translate: `calc(-50% + ${push.x * (1 - labelIn) * 16}px) calc(-50% + ${push.y * (1 - labelIn) * 16}px)`,
            boxSizing: 'border-box',
            maxWidth: LABEL_MAX_WIDTH,
            height: LABEL_HEIGHT,
            padding: `0 ${LABEL_PAD_X}px`,
            display: 'flex',
            alignItems: 'center',
            borderRadius: theme.radius.pill,
            background: theme.color.ink,
            boxShadow: `${theme.shadow.raised}, 0 0 0 2px ${theme.color.white}`,
            opacity: labelIn,
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: LABEL_FONT,
              color: theme.color.white,
            }}
          >
            {label}
          </span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const sample: CalloutProps = {
  shape: 'circle',
  x: 0.68,
  y: 0.42,
  width: 0.16,
  label: 'o erro está nesta linha',
  labelSide: 'top',
};

export const entry: ComponentEntry = {
  component: Callout,
  sample: { ...sample },
  defaultDuration: 4,
  description: 'Seta, círculo, caixa ou sublinhado desenhado sobre o vídeo; use para apontar algo que está na imagem (tela gravada, objeto).',
};
