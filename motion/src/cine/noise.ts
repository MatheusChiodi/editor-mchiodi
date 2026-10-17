// Ruído determinístico do kit: a mesma semente dá o mesmo quadro em qualquer máquina e em qualquer ordem de render.
// Nada aqui usa Math.random nem Date (o Remotion renderiza frames fora de ordem e em paralelo).

/** Inteiro de 32 bits bem misturado a partir de um inteiro e uma semente. */
function mix32(value: number, seed: number): number {
  let h = (Math.imul(value | 0, 0x9e3779b1) ^ Math.imul((seed | 0) + 0x7f4a7c15, 0x85ebca6b)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Número em [0, 1) a partir de um inteiro e uma semente. */
export function hash(value: number, seed = 0): number {
  return mix32(Math.floor(value), seed) / 4294967296;
}

/** Número em [0, 1) a partir de dois inteiros (célula de grade) e uma semente. */
export function hash2(x: number, y: number, seed = 0): number {
  return mix32(mix32(Math.floor(x), seed) ^ Math.imul(Math.floor(y), 0x27d4eb2f), seed + 101) / 4294967296;
}

/** Semente numérica a partir de um texto (id de overlay, palavra…): o mesmo texto treme sempre igual. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let index = 0; index < text.length; index += 1) h = Math.imul(h ^ text.charCodeAt(index), 16777619);
  return h >>> 0;
}

/** Gerador sequencial (mulberry32): use quando precisar de vários números em ordem a partir de uma semente. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quintic = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Ruído de valor 1D, contínuo e suave, em [-1, 1]. `x` em "células": some 1 e o valor já é outro. */
export function noise1D(x: number, seed = 0): number {
  const cell = Math.floor(x);
  const t = quintic(x - cell);
  return lerp(hash(cell, seed), hash(cell + 1, seed), t) * 2 - 1;
}

/** Ruído de valor 2D em [-1, 1]. */
export function noise2D(x: number, y: number, seed = 0): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const tx = quintic(x - cx);
  const ty = quintic(y - cy);
  const top = lerp(hash2(cx, cy, seed), hash2(cx + 1, cy, seed), tx);
  const bottom = lerp(hash2(cx, cy + 1, seed), hash2(cx + 1, cy + 1, seed), tx);
  return lerp(top, bottom, ty) * 2 - 1;
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

function gradient(ix: number, iy: number, seed: number, x: number, y: number): number {
  const angle = hash2(ix, iy, seed) * Math.PI * 2;
  return Math.cos(angle) * x + Math.sin(angle) * y;
}

/** Simplex 2D com semente, em [-1, 1]: mais orgânico que o ruído de valor (sem o aspecto de grade). */
export function simplex2D(x: number, y: number, seed = 0): number {
  const skew = (x + y) * F2;
  const i = Math.floor(x + skew);
  const j = Math.floor(y + skew);
  const unskew = (i + j) * G2;
  const x0 = x - (i - unskew);
  const y0 = y - (j - unskew);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  let total = 0;
  const corner = (cx: number, cy: number, ix: number, iy: number): void => {
    const falloff = 0.5 - cx * cx - cy * cy;
    if (falloff > 0) total += falloff ** 4 * gradient(ix, iy, seed, cx, cy);
  };
  corner(x0, y0, i, j);
  corner(x1, y1, i + i1, j + j1);
  corner(x2, y2, i + 1, j + 1);
  // 99.2 normaliza a soma dos três cantos para perto de [-1, 1]
  return Math.max(-1, Math.min(1, total * 99.2));
}

export interface FbmOptions {
  octaves?: number;
  /** quanto a frequência cresce por oitava */
  lacunarity?: number;
  /** quanto a amplitude cai por oitava */
  gain?: number;
  seed?: number;
}

/** Soma de oitavas de ruído 1D (movimento fractal), normalizada em [-1, 1]. */
export function fbm1D(x: number, { octaves = 3, lacunarity = 2, gain = 0.5, seed = 0 }: FbmOptions = {}): number {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += noise1D(x * frequency, seed + octave * 131) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return total / norm;
}

/** Soma de oitavas de ruído 2D, normalizada em [-1, 1]. */
export function fbm2D(x: number, y: number, { octaves = 3, lacunarity = 2, gain = 0.5, seed = 0 }: FbmOptions = {}): number {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += noise2D(x * frequency, y * frequency, seed + octave * 131) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return total / norm;
}

export interface WiggleOptions {
  /** oscilações por segundo (0,3–0,8 = respiração de câmera na mão; 6–12 = tremor de impacto) */
  frequency?: number;
  /** amplitude máxima, na unidade que você quiser (px, graus) */
  amplitude?: number;
  seed?: number;
  octaves?: number;
}

/** Vai-e-vem orgânico no tempo (o `wiggle` do After Effects), em [-amplitude, amplitude]. */
export function wiggle(frame: number, fps: number, { frequency = 0.5, amplitude = 1, seed = 0, octaves = 2 }: WiggleOptions = {}): number {
  return fbm1D((frame / fps) * frequency, { octaves, seed }) * amplitude;
}

/** `wiggle` em dois eixos independentes. */
export function wiggle2D(frame: number, fps: number, options: WiggleOptions = {}): { x: number; y: number } {
  const seed = options.seed ?? 0;
  return { x: wiggle(frame, fps, { ...options, seed }), y: wiggle(frame, fps, { ...options, seed: seed + 7919 }) };
}

/**
 * Relógio "em passos": o índice só muda a cada `1/rate` segundo. É o que faz o traço desenhado ferver
 * a 8–12 quadros por segundo dentro de um vídeo a 30 (animação "on twos/threes").
 */
export function steppedIndex(frame: number, fps: number, rate = 8): number {
  return Math.floor((frame / fps) * rate + 1e-6);
}
