import { random } from 'remotion';

import type { Block, Vec3 } from './types';

export interface BurstOptions {
  /** frame em que a explosão começa */
  start: number;
  seed: string;
  origin: Vec3;
  type: string;
  count?: number;
  speed?: number;
  gravity?: number;
  /** vida em frames */
  life?: number;
  size?: number;
}

/** Estilhaços que saltam de um ponto e caem: bloco quebrado, bloco colocado, conquista. */
export function burstBlocks(frame: number, { start, seed, origin, type, count = 14, speed = 0.16, gravity = 0.012, life = 24, size = 0.2 }: BurstOptions): Block[] {
  const age = frame - start;
  if (age < 0 || age > life) return [];
  const fade = 1 - age / life;
  return new Array(count).fill(0).map((_, i) => {
    const angle = random(`${seed}-a-${i}`) * Math.PI * 2;
    const lift = 0.4 + random(`${seed}-l-${i}`) * 1.1;
    const velocity = speed * (0.5 + random(`${seed}-v-${i}`));
    return {
      x: origin[0] + Math.cos(angle) * velocity * age,
      y: origin[1] + lift * speed * age - gravity * age * age,
      z: origin[2] + Math.sin(angle) * velocity * age * 0.6,
      type,
      scale: size * fade,
      rotY: age * 0.2 + i,
    };
  });
}

export interface RisingOptions {
  seed: string;
  center: Vec3;
  type: string;
  count?: number;
  radius?: number;
  height?: number;
  speed?: number;
  size?: number;
  /** 0 desliga; 1 é o tamanho cheio */
  intensity?: number;
}

/** Partículas que sobem em espiral em volta de um ponto, em laço: energia, "ao vivo", conquista. */
export function risingBlocks(frame: number, { seed, center, type, count = 24, radius = 3.4, height = 16, speed = 0.09, size = 0.22, intensity = 1 }: RisingOptions): Block[] {
  if (intensity <= 0) return [];
  return new Array(count).fill(0).map((_, i) => {
    const angle = random(`${seed}-a-${i}`) * Math.PI * 2;
    const distance = 1.8 + random(`${seed}-d-${i}`) * radius;
    const travel = (frame * speed * (0.6 + random(`${seed}-s-${i}`) * 0.8) + random(`${seed}-p-${i}`) * height) % height;
    const life = travel / height;
    return {
      x: center[0] + Math.cos(angle + frame * 0.01) * distance,
      y: center[1] + travel,
      z: center[2] + Math.sin(angle + frame * 0.01) * distance,
      type,
      scale: size * Math.sin(life * Math.PI) * intensity,
      rotY: frame * 0.05 + i,
    };
  });
}
