import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { type BaseProps, presence, wobble } from '../anim';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';
import { type StampTone, stampColor } from './Stamp';
import { withAlpha } from './SectionTitle';

export interface OrganicBlobProps {
  text?: string;
  tone?: StampTone;
  seed?: string;
  /** quão deformada (0–0.4) */
  amp?: number;
}

export interface BlobOptions {
  points: number;
  radius: number;
  amp: number;
  /** Hz do ruído: maior = mais agitado */
  speed: number;
}

/** Pontos de uma bolha que respira: raio de cada ponto vira ruído suave em radius × (1 ± amp). */
export function blobPoints(frame: number, fps: number, seed: string, options: BlobOptions): { x: number; y: number }[] {
  const { points, radius, amp, speed } = options;
  return Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2;
    const r = radius * (1 + wobble(frame, fps, `${seed}:${index}`, amp, speed));
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  });
}

/** Curva fechada e suave por todos os pontos (Catmull-Rom convertida em cúbicas de Bézier). */
export function blobPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  const at = (i: number) => pts[(i + n) % n]!;
  let d = `M ${at(0).x.toFixed(2)} ${at(0).y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return `${d} Z`;
}

const RADIUS = 260;

export const OrganicBlob: React.FC<OrganicBlobProps & BaseProps> = ({ text, tone, seed = 'blob', amp = 0.18, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { value } = presence(frame, fps, durationInFrames);
  const color = stampColor(tone);
  const size = RADIUS * 2.6;
  const safeAmp = Math.max(0, Math.min(0.4, amp));
  const d = blobPath(blobPoints(frame, fps, seed, { points: 8, radius: RADIUS, amp: safeAmp, speed: 0.35 }));

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: value, scale: 0.9 + 0.1 * value }}>
      <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} style={{ position: 'absolute', overflow: 'visible' }}>
        <path d={d} fill={withAlpha(color, 0.92)} stroke={theme.color.paper} strokeWidth={10} />
      </svg>
      {text ? (
        <div style={{ position: 'relative', maxWidth: RADIUS * 1.5, textAlign: 'center', fontFamily: theme.font.body, fontWeight: 800, fontSize: 64, lineHeight: 1.1, color: theme.color.white, textWrap: 'balance' }}>{text}</div>
      ) : null}
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: OrganicBlob,
  sample: { text: 'Respira', tone: 'emerald', seed: 'blob', amp: 0.18 },
  defaultDuration: 3,
  vertical: { zone: 'top' },
  description: 'Bolha orgânica que respira (ruído suave, sem repetição) com texto dentro; para destacar uma ideia com movimento vivo em vez de cartão rígido.',
};
