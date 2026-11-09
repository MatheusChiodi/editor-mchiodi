import { getBoundingBox, interpolatePath, translatePath } from '@remotion/paths';
import { makeCircle, makeHeart, makePolygon, makeSpark, makeStar, makeTriangle } from '@remotion/shapes';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { type BaseProps, presence } from '../anim';
import { motion, theme } from '../theme';
import { outlinedLabel } from './c4-kit';
import type { ComponentEntry } from './registry';
import { type StampTone, stampColor } from './Stamp';

export const SHAPE_IDS = ['circle', 'star', 'heart', 'triangle', 'hexagon', 'spark'] as const;
export type ShapeId = (typeof SHAPE_IDS)[number];

export interface ShapeMorphProps {
  from: ShapeId;
  to: ShapeId;
  label?: string;
  tone?: StampTone;
  /** segundos parada na forma inicial antes de transformar */
  holdSec?: number;
  /** duração da transformação */
  morphSec?: number;
}

const BOX = 400;

function rawShape(id: ShapeId) {
  switch (id) {
    case 'star':
      return makeStar({ points: 5, innerRadius: 80, outerRadius: 190 });
    case 'heart':
      return makeHeart({ height: 340 });
    case 'triangle':
      return makeTriangle({ length: 360, direction: 'up', cornerRadius: 16 });
    case 'hexagon':
      return makePolygon({ points: 6, radius: 185, cornerRadius: 14 });
    case 'spark':
      return makeSpark({ width: 300, height: 380 });
    default:
      return makeCircle({ radius: 180 });
  }
}

/** Path da forma, centrado numa caixa 400×400 para todas poderem se transformar entre si. */
export function shapePath(id: ShapeId): string {
  const { path } = rawShape(id);
  // centraliza pela caixa real do traçado: `width/height` da forma é o do círculo circunscrito (estrela e coração não são simétricos)
  const box = getBoundingBox(path);
  return translatePath(path, BOX / 2 - (box.x1 + box.x2) / 2, BOX / 2 - (box.y1 + box.y2) / 2);
}

/** Forma intermediária entre duas formas (`Transform` do manim). `progress` em 0–1. */
export function morphPath(from: ShapeId, to: ShapeId, progress: number): string {
  return interpolatePath(Math.max(0, Math.min(1, progress)), shapePath(from), shapePath(to));
}

export const ShapeMorph: React.FC<ShapeMorphProps & BaseProps> = ({ from, to, label, tone, holdSec = 0.5, morphSec = 0.9, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { value } = presence(frame, fps, durationInFrames);
  const t = interpolate(frame, [holdSec * fps, (holdSec + morphSec) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: motion.stage });
  const color = stampColor(tone);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 24, opacity: value }}>
      <svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} style={{ overflow: 'visible', rotate: `${t * 12}deg` }}>
        <path d={morphPath(from, to, t)} fill={color} stroke={theme.color.paper} strokeWidth={8} strokeLinejoin="round" />
      </svg>
      {label ? (
        <div style={outlinedLabel(56)}>{label}</div>
      ) : null}
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: ShapeMorph,
  sample: { from: 'circle', to: 'star', label: 'Antes e depois', tone: 'coral' },
  defaultDuration: 3,
  vertical: { zone: 'top' },
  description: 'Uma forma vira outra (círculo, estrela, coração, triângulo, hexágono, faísca) com transformação fluida; para metáfora de mudança, evolução ou "de X para Y".',
};
