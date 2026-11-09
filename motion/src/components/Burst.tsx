import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from 'remotion';

import { type BaseProps } from '../anim';
import { theme } from '../theme';
import { outlinedLabel } from './c4-kit';
import type { ComponentEntry } from './registry';
import { type StampTone, stampColor } from './Stamp';

export interface BurstProps {
  seed?: number;
  count?: number;
  tone?: StampTone;
  label?: string;
  /** alcance das partículas, em px */
  radius?: number;
}

export interface Particle {
  /** graus, 0 = direita */
  angle: number;
  /** fração do alcance que esta partícula percorre */
  speed: number;
  size: number;
  /** 0 = bolinha, 1 = risco */
  streak: boolean;
}

const MIN_COUNT = 6;
const MAX_COUNT = 48;

/** PRNG determinístico (mulberry32): o mesmo seed dá o mesmo estouro em qualquer render. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Partículas do estouro (`burst` do mojs): ângulos espalhados com jitter, para não parecer régua. */
export function burstParticles(seed: number, count: number): Particle[] {
  const total = Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.round(count)));
  const random = mulberry32(seed);
  const step = 360 / total;
  return Array.from({ length: total }, (_, index) => ({
    angle: index * step + (random() - 0.5) * step * 0.7,
    speed: 0.55 + random() * 0.45,
    size: 8 + random() * 14,
    streak: random() > 0.55,
  }));
}

/** Estado da partícula em `t` (0–1): sai do centro desacelerando e some no fim. */
export function particleState(particle: Particle, t: number, radius: number): { x: number; y: number; opacity: number; scale: number } {
  const p = Math.max(0, Math.min(1, t));
  const distance = radius * particle.speed * Easing.out(Easing.cubic)(p);
  const rad = (particle.angle * Math.PI) / 180;
  return { x: Math.cos(rad) * distance, y: Math.sin(rad) * distance, opacity: p >= 1 ? 0 : 1 - p * p, scale: 1 - p * 0.6 };
}

export const Burst: React.FC<BurstProps & BaseProps> = ({ seed = 7, count = 24, tone, label, radius = 360, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.min(1, frame / Math.max(1, Math.min(durationInFrames, 1.1 * fps)));
  const color = stampColor(tone);
  const particles = burstParticles(seed, count);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {particles.map((particle, index) => {
          const state = particleState(particle, t, radius);
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: state.x - particle.size / 2,
                top: state.y - particle.size / 2,
                width: particle.streak ? particle.size * 2.4 : particle.size,
                height: particle.size,
                borderRadius: theme.radius.pill,
                background: index % 3 === 0 ? theme.color.paper : color,
                opacity: state.opacity,
                scale: state.scale,
                rotate: `${particle.angle}deg`,
              }}
            />
          );
        })}
      </div>
      {label ? (
        <div style={{ ...outlinedLabel(72), position: 'absolute', opacity: Math.min(1, frame / (0.15 * fps)) }}>{label}</div>
      ) : null}
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Burst,
  sample: { seed: 7, count: 24, tone: 'coral', label: 'Boom!' },
  defaultDuration: 1.6,
  vertical: { zone: 'top' },
  description: 'Estouro de partículas a partir do centro, com palavra opcional; para comemorar, dar impacto ou marcar o momento de uma revelação.',
};
