import { wobble } from '../anim';
import type { CameraId, TransitionId } from './types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Sobe e desce entre 0 e 1 (seno); exatamente 0 nas pontas, sem sobra de ponto flutuante. */
const bump = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));

/** Duração da transição entre cenas, em quadros (≈ 0,45 s a 30 fps). */
export const TRANSITION_FRAMES = 14;

export interface CameraState {
  scale: number;
  /** deslocamento em unidades de 1080p */
  x: number;
  y: number;
  /** graus */
  rotate: number;
}

/**
 * Câmera da cena: movimento lento escolhido para o plano (aproxima, afasta, panorâmica, inclina, balança) mais uma
 * tremida de câmera na mão e um tranco de aproximação em cada batida. `progress` é 0–1 ao longo da cena.
 */
export function cameraTransform(camera: CameraId, progress: number, frame: number, fps: number, pulse: number): CameraState {
  const p = smooth(progress);
  let scale = 1.05;
  let x = 0;
  let y = 0;
  let rotate = 0;
  switch (camera) {
    case 'push':
      scale = lerp(1.04, 1.17, p);
      break;
    case 'pull':
      scale = lerp(1.17, 1.04, p);
      break;
    case 'panL':
      scale = 1.12;
      x = lerp(46, -46, p);
      break;
    case 'panR':
      scale = 1.12;
      x = lerp(-46, 46, p);
      break;
    case 'tilt':
      scale = 1.1;
      y = lerp(30, -30, p);
      break;
    case 'orbit':
      scale = 1.1;
      rotate = lerp(-2.2, 2.2, p);
      x = lerp(-20, 20, p);
      break;
    case 'still':
      break;
  }
  return {
    scale: scale + 0.012 * clamp01(pulse),
    x: x + wobble(frame, fps, 'camx', 2.2, 0.7),
    y: y + wobble(frame, fps, 'camy', 1.8, 0.9),
    rotate: rotate + wobble(frame, fps, 'camr', 0.18, 0.5),
  };
}

export interface TransitionState {
  inOpacity: number;
  outOpacity: number;
  inScale: number;
  outScale: number;
  /** deslocamento horizontal em frações da largura */
  inX: number;
  outX: number;
  /** desfoque em px (1080p) */
  blur: number;
  /** brilho branco por cima, 0–1 */
  flash: number;
  /** intensidade do glitch, 0–1 */
  glitch: number;
  /** fração revelada da cena nova pela cortina, 0–1 (1 = inteira) */
  wipe: number;
}

/** Estado da transição de entrada de uma cena; `t` é 0–1 ao longo dos `TRANSITION_FRAMES`. */
export function transitionState(kind: TransitionId, t: number): TransitionState {
  const x = clamp01(t);
  const base: TransitionState = { inOpacity: smooth(x), outOpacity: 1 - smooth(x), inScale: 1, outScale: 1, inX: 0, outX: 0, blur: 0, flash: 0, glitch: 0, wipe: 1 };
  switch (kind) {
    case 'cut':
      return { ...base, inOpacity: 1, outOpacity: 0 };
    case 'fade':
      return base;
    case 'flash':
      return { ...base, inOpacity: x < 0.5 ? 0 : smooth((x - 0.5) * 2), outOpacity: x < 0.5 ? 1 : 0, flash: bump(x) ** 2 };
    case 'wipe':
      return { ...base, inOpacity: 1, outOpacity: x >= 1 ? 0 : 1, wipe: smooth(x) };
    case 'zoom':
      return { ...base, inScale: lerp(0.8, 1, smooth(x)), outScale: lerp(1, 1.4, smooth(x)), blur: bump(x) * 10 };
    case 'glitch':
      return { ...base, inOpacity: x < 0.5 ? 0 : 1, outOpacity: x < 0.5 ? 1 : 0, glitch: bump(x) ** 0.5 };
    case 'whip':
      return { ...base, inOpacity: 1, outOpacity: x >= 1 ? 0 : 1, inX: 1 - smooth(x), outX: -smooth(x), blur: bump(x) * 14 };
  }
}

export interface Bokeh {
  /** posição inicial, 0–1 do quadro */
  x: number;
  y: number;
  /** raio em px (1080p) */
  r: number;
  /** 0 = fundo (lento, pequeno) … 1 = frente (rápido, grande) */
  depth: number;
  speed: number;
  phase: number;
  /** mistura da cor de destaque com a de brilho, 0–1 */
  hue: number;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Partículas de luz desfocada (poeira, bokeh) em camadas de profundidade, para o quadro nunca ficar vazio. */
export function bokehParticles(seed: number, count: number): Bokeh[] {
  const random = mulberry(seed);
  return Array.from({ length: count }, () => {
    const depth = 0.15 + random() * 0.85;
    return { x: random(), y: random(), r: 5 + depth * 34 * (0.5 + random() * 0.8), depth, speed: 6 + depth * 40 * (0.5 + random()), phase: random() * Math.PI * 2, hue: random() };
  });
}

/** Altura de cada faixa preta cinemascope (2,39:1); só em quadro largo, nunca em vertical ou quadrado. */
export function letterboxBar(width: number, height: number): number {
  if (width / height < 1.5) return 0;
  return Math.max(0, (height - width / 2.39) / 2);
}
