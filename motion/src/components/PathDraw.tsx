import { evolvePath, getBoundingBox, getPointAtLength, getTangentAtLength, getLength } from '@remotion/paths';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { type BaseProps, presence, progressAt } from '../anim';
import { theme } from '../theme';
import { outlinedLabel } from './c4-kit';
import type { ComponentEntry } from './registry';
import { type StampTone, stampColor } from './Stamp';

export interface PathDrawProps {
  /** atributo `d` de um path SVG */
  d: string;
  label?: string;
  tone?: StampTone;
  strokeWidth?: number;
  /** bolinha que corre na ponta do traço */
  follower?: boolean;
  /** quanto leva para desenhar o path inteiro */
  drawSec?: number;
}

export interface PathDrawState {
  strokeDasharray: string;
  strokeDashoffset: number;
  /** ponta do traço: posição e direção (graus) */
  head: { x: number; y: number; angle: number };
}

/** Traço que se desenha (Create/Write do manim) e a ponta que o acompanha. `progress` em 0–1. */
export function pathDrawState(d: string, progress: number): PathDrawState {
  const p = Math.max(0, Math.min(1, progress));
  const length = getLength(d);
  const at = p * length;
  const point = getPointAtLength(d, at) ?? { x: 0, y: 0 };
  const tangent = getTangentAtLength(d, at) ?? { x: 1, y: 0 };
  return { ...evolvePath(p, d), head: { x: point.x, y: point.y, angle: (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI } };
}

/** Caixa do path com margem, para o SVG não cortar o traço grosso. */
export function pathViewBox(d: string, pad: number): { x: number; y: number; width: number; height: number } {
  const box = getBoundingBox(d);
  return { x: box.x1 - pad, y: box.y1 - pad, width: box.x2 - box.x1 + 2 * pad, height: box.y2 - box.y1 + 2 * pad };
}

const MAX_W = 1280;
const MAX_H = 640;

export const PathDraw: React.FC<PathDrawProps & BaseProps> = ({ d, label, tone, strokeWidth = 12, follower = true, drawSec = 1.4, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { value } = presence(frame, fps, durationInFrames);
  const color = stampColor(tone);
  const pad = strokeWidth * 2;
  const box = pathViewBox(d, pad);
  const scale = Math.min(MAX_W / box.width, MAX_H / box.height);
  const state = pathDrawState(d, progressAt(frame, fps, 0.2, drawSec));

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 28, opacity: value }}>
      <svg width={box.width * scale} height={box.height * scale} viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} style={{ overflow: 'visible' }}>
        <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={state.strokeDasharray} strokeDashoffset={state.strokeDashoffset} />
        {follower ? <circle cx={state.head.x} cy={state.head.y} r={strokeWidth * 0.9} fill={theme.color.paper} stroke={color} strokeWidth={strokeWidth * 0.4} /> : null}
      </svg>
      {label ? (
        <div style={outlinedLabel(56)}>{label}</div>
      ) : null}
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: PathDraw,
  sample: { d: 'M 0 120 C 120 0, 240 240, 360 120 S 560 0, 640 120', label: 'Fluxo', tone: 'coral' },
  defaultDuration: 3,
  vertical: { zone: 'top' },
  description: 'Traço que se desenha sozinho sobre um path SVG (seta curva, sublinhado, trajeto), com ponta que acompanha; para mostrar fluxo, caminho ou ênfase desenhada à mão.',
};
