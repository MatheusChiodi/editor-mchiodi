// Máscaras de revelação: funções puras que devolvem o valor de `mask-image` / `clip-path` para um progresso 0→1.
// Servem tanto a transições (revelar a cena nova) quanto a tipografia (revelar uma palavra).
// Regra: máscara tem BORDA COM CARÁTER (pena suave, tinta, rasgo). Recorte reto e duro é o wipe de template.

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const OPAQUE = 'rgba(0,0,0,1)';
const CLEAR = 'rgba(0,0,0,0)';

export interface IrisOptions {
  progress: number;
  /** centro em fração da caixa */
  x?: number;
  y?: number;
  /** largura da pena em fração do raio máximo (0,04 = quase dura; 0,25 = bem difusa) */
  feather?: number;
  /** tamanho da caixa em px: o raio é calculado até o canto mais distante */
  width?: number;
  height?: number;
}

/** Raio (px) da íris totalmente aberta: do centro ao canto mais distante da caixa. */
export function irisReach(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, 1 - x) * width, Math.max(y, 1 - y) * height);
}

/** Íris de borda suave (`mask-image`). Em `progress` 1 a caixa inteira está visível. */
export function irisMask({ progress, x = 0.5, y = 0.5, feather = 0.12, width = 1920, height = 1080 }: IrisOptions): string {
  const reach = irisReach(x, y, width, height);
  const pen = reach * feather;
  const outer = clamp01(progress) * (reach + pen);
  const inner = Math.max(0, outer - pen);
  return `radial-gradient(circle at ${round(x * 100)}% ${round(y * 100)}%, ${OPAQUE} ${round(inner)}px, ${CLEAR} ${round(Math.max(inner + 0.01, outer))}px)`;
}

export interface BandOptions {
  progress: number;
  /** direção em que a revelação avança, em graus CSS (90 = da esquerda para a direita; 180 = de cima para baixo) */
  angle?: number;
  /** largura da pena em fração da caixa */
  feather?: number;
}

/** Faixa que varre a caixa com borda em pena (`mask-image`). */
export function bandMask({ progress, angle = 90, feather = 0.14 }: BandOptions): string {
  const edge = clamp01(progress) * (1 + feather);
  return `linear-gradient(${angle}deg, ${OPAQUE} ${round((edge - feather) * 100)}%, ${CLEAR} ${round(edge * 100)}%)`;
}

export interface BlindsOptions {
  progress: number;
  count?: number;
  angle?: number;
  /** 0–1: quanto cada lâmina atrasa em relação à anterior (0 = todas juntas) */
  cascade?: number;
}

/**
 * Lâminas: N faixas que abrem em cascata (`clip-path: polygon`). Com `cascade` alto vira uma onda que cruza
 * a caixa. Devolve um polígono único (as lâminas são ilhas unidas por arestas de largura zero).
 */
export function blindsClip({ progress, count = 7, cascade = 0.6 }: Omit<BlindsOptions, 'angle'>): string {
  const total = Math.max(1, Math.round(count));
  const points: string[] = [];
  for (let index = 0; index < total; index += 1) {
    const delay = (index / total) * cascade;
    const local = clamp01((clamp01(progress) - delay) / (1 - cascade || 1));
    const eased = 1 - (1 - local) ** 3;
    const left = (index / total) * 100;
    const right = left + (100 / total) * eased;
    points.push(`${round(left)}% 0%`, `${round(right)}% 0%`, `${round(right)}% 100%`, `${round(left)}% 100%`, `${round(left)}% 0%`);
  }
  return `polygon(${points.join(', ')})`;
}

export type ClipShape = 'circle' | 'diamond' | 'hexagon' | 'pill' | 'slant';

/** Recorte por forma que cresce do centro (`clip-path`). Em `progress` 1 a forma já passou das bordas. */
export function shapeClip(shape: ClipShape, progress: number): string {
  const p = clamp01(progress);
  switch (shape) {
    case 'circle':
      return `circle(${round(p * 75)}% at 50% 50%)`;
    case 'diamond': {
      const reach = p * 105;
      return `polygon(50% ${round(50 - reach)}%, ${round(50 + reach)}% 50%, 50% ${round(50 + reach)}%, ${round(50 - reach)}% 50%)`;
    }
    case 'hexagon': {
      const reach = p * 82;
      const corners = Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI / 3) * index;
        return `${round(50 + Math.cos(angle) * reach)}% ${round(50 + Math.sin(angle) * reach)}%`;
      });
      return `polygon(${corners.join(', ')})`;
    }
    case 'pill':
      return `inset(${round((1 - p) * 50)}% ${round((1 - p) * 30)}% round 9999px)`;
    default: {
      // paralelogramo que abre do centro, inclinado 12%
      const half = p * 70;
      return `polygon(${round(50 - half + 12)}% 0%, ${round(50 + half + 12)}% 0%, ${round(50 + half - 12)}% 100%, ${round(50 - half - 12)}% 100%)`;
    }
  }
}

export interface InkOptions {
  progress: number;
  seed?: number;
  /** `wipe`: a tinta avança numa direção; `bloom`: nasce de um ponto e se espalha */
  mode?: 'wipe' | 'bloom';
  /** direção do avanço em graus (0 = para a direita, 90 = para baixo). Só em `wipe` */
  angle?: number;
  /** origem em fração da caixa. Só em `bloom` */
  origin?: { x: number; y: number };
  /** 0–1: quanto a borda se deforma (0,3 = líquido calmo; 0,9 = tinta espirrada) */
  roughness?: number;
  /** tamanho das manchas: frequência do ruído numa caixa de 1920 px (0,005 = bolhas grandes; 0,02 = respingo fino). Em caixa menor, divida na mesma proporção */
  frequency?: number;
  /** 0–1: maciez da borda (0 = recorte seco; 1 = aquarela) */
  softness?: number;
  /** proporção da caixa */
  aspect?: number;
  /** largura da textura da máscara em px. É SUBAMOSTRADA de propósito: o ruído em tela cheia custaria ~10× mais */
  resolution?: number;
}

/** Números do filtro da tinta, separados para teste: viés que move o limiar e inclinação que define a borda. */
export function inkLevels(progress: number, roughness = 0.6, softness = 0.45): { bias: number; slope: number; intercept: number; gain: number } {
  const gain = clamp01(roughness);
  const slope = 4 + (1 - clamp01(softness)) * 44;
  // o campo vai de 0 a 1, o ruído soma ±gain/2 e a rampa do limiar tem meia-largura 0,5/slope:
  // a margem garante 0% coberto em progress 0 e 100% em progress 1
  const margin = 0.5 + gain / 2 + 0.5 / slope + 0.02;
  const bias = -margin + clamp01(progress) * margin * 2;
  return { bias: round(bias - gain / 2, 4), slope: round(slope), intercept: round(0.5 - slope * 0.5, 4), gain: round(gain, 3) };
}

/**
 * Máscara de tinta/líquido (`mask-image`): um gradiente (o avanço) somado a ruído de turbulência e passado por um
 * limiar. A borda borbulha e deixa ilhas, como tinta se espalhando em papel. A textura é pequena e o navegador
 * amplia: use com `mask-size: 100% 100%`.
 */
export function inkMask({ progress, seed = 1, mode = 'wipe', angle = 0, origin = { x: 0.5, y: 0.5 }, roughness = 0.6, frequency = 0.009, softness = 0.45, aspect = 16 / 9, resolution = 480 }: InkOptions): string {
  const width = Math.round(resolution);
  const height = Math.round(resolution / aspect);
  const { bias, slope, intercept, gain } = inkLevels(progress, roughness, softness);
  const radians = (angle * Math.PI) / 180;
  const x1 = round(0.5 - Math.cos(radians) * 0.5, 3);
  const y1 = round(0.5 - Math.sin(radians) * 0.5, 3);
  const gradient =
    mode === 'bloom'
      ? `<radialGradient id="a" gradientUnits="userSpaceOnUse" cx="${round(origin.x * width)}" cy="${round(origin.y * height)}" r="${round(Math.hypot(Math.max(origin.x, 1 - origin.x) * width, Math.max(origin.y, 1 - origin.y) * height))}"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
      : `<linearGradient id="a" x1="${x1}" y1="${y1}" x2="${round(1 - x1, 3)}" y2="${round(1 - y1, 3)}"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  // a escala do ruído acompanha a resolução, para a mancha ter o mesmo tamanho na tela em qualquer `resolution`
  const base = round(frequency * (1920 / width), 4);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${gradient}` +
    `<filter id="k" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${base} ${round(base * 1.35, 4)}" numOctaves="2" seed="${Math.floor(seed) % 9973}" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0" result="m"/>` +
    `<feComposite in="SourceGraphic" in2="m" operator="arithmetic" k1="0" k2="1" k3="${gain}" k4="${bias}"/>` +
    `<feComponentTransfer><feFuncA type="linear" slope="${slope}" intercept="${intercept}"/></feComponentTransfer>` +
    `</filter></defs><rect width="${width}" height="${height}" fill="url(#a)" filter="url(#k)"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/**
 * Revelação de palavra por máscara de linha de base: a palavra sobe por trás de uma régua invisível.
 * Devolve o `clip-path` do invólucro e o deslocamento (em em) do miolo. É a entrada-base de tipografia do canal.
 */
export function baselineReveal(progress: number, { distance = 1.05, bleed = 0.22 }: { distance?: number; bleed?: number } = {}): { clipPath: string; translateEm: number } {
  // a folga (`bleed`, em em) preserva descendentes e itálico, que passam da caixa da linha
  return { clipPath: `inset(-${bleed}em -${bleed}em -${round(bleed * 0.6)}em -${bleed}em)`, translateEm: round((1 - progress) * distance, 4) };
}

export type MaskSpec =
  | ({ type: 'iris' } & IrisOptions)
  | ({ type: 'band' } & BandOptions)
  | ({ type: 'ink' } & InkOptions)
  | ({ type: 'blinds' } & Omit<BlindsOptions, 'angle'>)
  | { type: 'shape'; shape: ClipShape; progress: number };

/**
 * Estilo CSS pronto para qualquer máscara do kit. Em `progress` ≥ 1 devolve `{}`: sem máscara, sem custo e sem
 * risco de cortar sombra ou descendente no repouso.
 */
export function maskStyle(spec: MaskSpec): Record<string, string> {
  if (spec.progress >= 1) return {};
  const image = (value: string): Record<string, string> => ({
    maskImage: value,
    WebkitMaskImage: value,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
  });
  switch (spec.type) {
    case 'iris':
      return image(irisMask(spec));
    case 'band':
      return image(bandMask(spec));
    case 'ink':
      return image(inkMask(spec));
    case 'blinds':
      return { clipPath: blindsClip(spec) };
    default:
      return { clipPath: shapeClip(spec.shape, spec.progress) };
  }
}
