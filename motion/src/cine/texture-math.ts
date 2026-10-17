import type { Vec2 } from './blur';
import { brandRamp } from './color';
import { KEY_LIGHT_ANGLE } from './light-math';
import { fbm1D, hash, noise1D, steppedIndex } from './noise';

// Textura: o que tira o quadro do "vetor chapado". Tudo procedural e com semente; nenhum arquivo de imagem.
// Custo: os grãos são LADRILHOS (o Chrome rasteriza um SVG pequeno uma vez e repete); nunca ruído em tela cheia.

const round = (value: number): number => Math.round(value * 100) / 100;

export interface GrainOptions {
  seed?: number;
  /** lado do ladrilho em px */
  size?: number;
  /** frequência do ruído: 0,9 = grão fino de filme; 0,5 = grão grosso */
  frequency?: number;
  /** 0–1: contraste do grão em torno do cinza médio */
  contrast?: number;
}

function svgUri(svg: string): string {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/**
 * Ladrilho de grão de filme: ruído cinza em torno de 50% (para `mix-blend-mode: overlay` ou `soft-light`,
 * em que cinza médio não altera a imagem). Devolve um `url(...)` para `background-image`.
 */
export function filmGrainTile({ seed = 1, size = 256, frequency = 0.85, contrast = 0.55 }: GrainOptions = {}): string {
  const slope = round(contrast * 3);
  const intercept = round(0.5 - (slope * 0.5));
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="2" seed="${Math.floor(seed) % 9973}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="0.34 0.33 0.33 0 0  0.34 0.33 0.33 0 0  0.34 0.33 0.33 0 0  0 0 0 0 1"/>` +
      `<feComponentTransfer><feFuncR type="linear" slope="${slope}" intercept="${intercept}"/><feFuncG type="linear" slope="${slope}" intercept="${intercept}"/><feFuncB type="linear" slope="${slope}" intercept="${intercept}"/></feComponentTransfer>` +
      `</filter><rect width="${size}" height="${size}" filter="url(#g)"/></svg>`,
  );
}

/**
 * Ladrilho de grão de papel: dente fino + fibras alongadas, em tinta translúcida (para `multiply`).
 * Estático: papel não ferve. `fibers` 0 tira as fibras (papel liso de escritório).
 */
export function paperGrainTile({ seed = 7, size = 320, frequency = 0.8, fibers = 0.3 }: GrainOptions & { fibers?: number } = {}): string {
  const s = Math.floor(seed) % 9973;
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<filter id="t" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="3" seed="${s}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.2  0 0 0 0 0.14  0 0 0 1.5 -0.55"/></filter>` +
      `<filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.045 0.2" numOctaves="2" seed="${s + 17}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.2  0 0 0 0 0.14  0 0 0 1.7 -0.86"/></filter>` +
      `<rect width="${size}" height="${size}" filter="url(#t)" opacity="0.5"/>` +
      (fibers > 0 ? `<rect width="${size}" height="${size}" filter="url(#f)" opacity="${round(fibers)}"/>` : '') +
      `</svg>`,
  );
}

/**
 * Deslocamento do ladrilho de grão neste frame: o grão de filme é outro a cada quadro. `hold` > 1 segura o
 * mesmo grão por N frames (grão "preguiçoso", de película mais lenta).
 */
export function grainOffset(frame: number, { seed = 1, size = 256, hold = 1 }: { seed?: number; size?: number; hold?: number } = {}): Vec2 {
  const tick = Math.floor(frame / Math.max(1, hold));
  return { x: Math.floor(hash(tick, seed) * size), y: Math.floor(hash(tick, seed + 31) * size) };
}

export interface TornOptions {
  /** quanto a borda entra/sai, em px (6–14 = rasgo à mão; 2–4 = borda orgânica de recorte) */
  amplitude?: number;
  seed?: number;
  /** distância entre pontos da borda em px (menor = mais fibra, path maior) */
  step?: number;
  /** 0–1: peso do serrilhado fino (fibra) sobre a ondulação larga */
  roughness?: number;
}

/**
 * Perfil de uma borda rasgada: deslocamentos (px, em [-amplitude, amplitude]) ao longo de `length`.
 * Ondulação larga (a mão puxando) + fibra fina (o papel cedendo): nunca dente de serra regular.
 */
export function tornProfile(length: number, { amplitude = 10, seed = 1, step = 7, roughness = 0.45 }: TornOptions = {}): number[] {
  const count = Math.max(2, Math.ceil(length / step) + 1);
  return Array.from({ length: count }, (_, index) => {
    const position = (index / (count - 1)) * length;
    const wave = fbm1D(position / 140, { octaves: 2, seed });
    const fiber = noise1D(position / 9, seed + 211) * 0.6 + (hash(index, seed + 5) - 0.5) * 0.8;
    return round(amplitude * ((1 - roughness) * wave + roughness * fiber));
  });
}

export interface TornRectOptions extends TornOptions {
  width: number;
  height: number;
  /** quais lados são rasgados (os outros ficam retos) */
  edges?: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };
}

/**
 * Path SVG (para `clip-path: path('…')`) de um retângulo com lados rasgados. A borda rasgada fica por DENTRO
 * da caixa `width × height`, então o layout não muda.
 */
export function tornRectPath({ width, height, edges = { top: true, right: true, bottom: true, left: true }, amplitude = 10, seed = 1, step = 7, roughness = 0.45 }: TornRectOptions): string {
  const options = { amplitude, step, roughness };
  const side = (length: number, torn: boolean | undefined, sideSeed: number): number[] =>
    torn ? tornProfile(length, { ...options, seed: sideSeed }).map((value) => value + amplitude) : [0, 0];
  const top = side(width, edges.top, seed);
  const right = side(height, edges.right, seed + 1);
  const bottom = side(width, edges.bottom, seed + 2);
  const left = side(height, edges.left, seed + 3);
  const points: string[] = [];
  const along = (profile: number[], length: number, place: (position: number, inset: number) => [number, number], skipFirst: boolean): void => {
    profile.forEach((inset, index) => {
      if (skipFirst && index === 0) return;
      const [x, y] = place((index / (profile.length - 1)) * length, inset);
      points.push(`${round(x)} ${round(y)}`);
    });
  };
  along(top, width, (position, inset) => [position, inset], false);
  along(right, height, (position, inset) => [width - inset, position], true);
  along(bottom, width, (position, inset) => [width - position, height - inset], true);
  along(left, height, (position, inset) => [inset, height - position], true);
  return `M${points.join('L')}Z`;
}

export interface TornWipeOptions extends TornOptions {
  width: number;
  height: number;
  /** 0 = nada coberto; 1 = quadro inteiro coberto */
  progress: number;
  /** inclinação do rasgo em px: quanto o topo vai à frente do pé */
  lean?: number;
  /** lado de onde a folha entra */
  from?: 'left' | 'right';
}

export interface TornWipe {
  /** região coberta (para `clip-path`) */
  path: string;
  /** só a linha do rasgo (para desenhar o miolo branco do papel e a sombra) */
  edge: string;
  /** x médio do rasgo */
  x: number;
}

/**
 * Rasgo que atravessa o quadro. Os pontos da borda são fixos no papel (não "nadam" enquanto o rasgo anda):
 * o perfil é amostrado uma vez por semente e só transladado.
 */
export function tornWipe({ width, height, progress, lean = 90, from = 'left', amplitude = 16, seed = 1, step = 9, roughness = 0.5 }: TornWipeOptions): TornWipe {
  const margin = amplitude * 2 + Math.abs(lean);
  const travel = width + margin * 2;
  const clamped = Math.min(1, Math.max(0, progress));
  const base = from === 'left' ? -margin + clamped * travel : width + margin - clamped * travel;
  const profile = tornProfile(height, { amplitude, seed, step, roughness });
  const edgePoints = profile.map((offset, index) => {
    const t = index / (profile.length - 1);
    return [round(base + offset + lean * (0.5 - t) * (from === 'left' ? 1 : -1)), round(t * height)] as const;
  });
  const edge = `M${edgePoints.map(([x, y]) => `${x} ${y}`).join('L')}`;
  const outer = from === 'left' ? -margin * 2 : width + margin * 2;
  return { path: `${edge}L${outer} ${height}L${outer} 0Z`, edge, x: round(base) };
}

/**
 * Semente que muda `rate` vezes por segundo: passe para o `seed` de um `feTurbulence` (ou para `boilPoints`)
 * e o traço desenhado "ferve" como animação feita à mão, em vez de ficar congelado ou tremer a 30 fps.
 */
export function boilSeed(frame: number, fps: number, { rate = 8, seed = 1 }: { rate?: number; seed?: number } = {}): number {
  return (seed + steppedIndex(frame, fps, rate) * 7) % 9973;
}

/** Pontos de um traço com o tremor do "boil" aplicado (para paths desenhados em SVG). */
export function boilPoints(points: readonly Vec2[], frame: number, fps: number, { amplitude = 1.6, rate = 8, seed = 1 }: { amplitude?: number; rate?: number; seed?: number } = {}): Vec2[] {
  const tick = steppedIndex(frame, fps, rate);
  return points.map((point, index) => ({
    x: round(point.x + (hash(index * 2, seed + tick * 13) - 0.5) * 2 * amplitude),
    y: round(point.y + (hash(index * 2 + 1, seed + tick * 13) - 0.5) * 2 * amplitude),
  }));
}

/** Path SVG suave (Catmull-Rom → Bézier) passando pelos pontos: traço de caneta, sublinhado, seta à mão. */
export function smoothPath(points: readonly Vec2[], tension = 0.5): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0]!.x} ${points[0]!.y}`;
  let d = `M${round(points[0]!.x)} ${round(points[0]!.y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[Math.min(points.length - 1, index + 2)]!;
    const k = tension / 3;
    d += `C${round(p1.x + (p2.x - p0.x) * k)} ${round(p1.y + (p2.y - p0.y) * k)} ${round(p2.x - (p3.x - p1.x) * k)} ${round(p2.y - (p3.y - p1.y) * k)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

/**
 * Sublinhado à mão: pontos de um traço quase reto, com a barriga e o tremor de quem riscou rápido.
 * Combine com `boilPoints` + `smoothPath` e revele com `stroke-dashoffset`.
 */
export function handStroke(width: number, { seed = 1, wobble = 4, segments = 6, rise = -3 }: { seed?: number; wobble?: number; segments?: number; rise?: number } = {}): Vec2[] {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    return { x: round(t * width), y: round(Math.sin(t * Math.PI) * rise + noise1D(t * 2.3, seed) * wobble) };
  });
}

export interface PaperEdge {
  x: number;
  y: number;
  color: string;
}

/**
 * Espessura do papel: cópias da face empilhadas atrás, deslocadas para o lado oposto à luz, escurecendo.
 * `thickness` em px (2 = folha; 5 = cartão; 9 = papelão). Devolve da mais próxima da face à mais funda.
 */
export function paperEdges(thickness: number, lightAngle: number = KEY_LIGHT_ANGLE): PaperEdge[] {
  const count = Math.max(0, Math.round(thickness));
  const radians = (lightAngle * Math.PI) / 180;
  const dx = -Math.cos(radians);
  const dy = -Math.sin(radians);
  return Array.from({ length: count }, (_, index) => ({
    x: round(dx * (index + 1) * 0.75),
    y: round(dy * (index + 1) * 0.75),
    color: brandRamp('paper', 0.55 + 0.45 * ((index + 1) / count)),
  }));
}
