import { theme } from '../theme';

// Cor do kit: tudo parte dos tokens de `theme.ts`. A mistura é feita em OKLab, que não escurece nem
// acinzenta o meio do caminho como a mistura em sRGB (paper → coral em sRGB passa por um rosa sujo).

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` → canais 0–255 e alfa 0–1. */
export function parseColor(color: string): Rgba {
  const text = color.trim();
  if (text.startsWith('#')) {
    const hex = text.slice(1);
    const full = hex.length <= 4 ? [...hex].map((char) => char + char).join('') : hex;
    const channel = (index: number): number => Number.parseInt(full.slice(index, index + 2), 16);
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(full)) throw new Error(`cor inválida: ${color}`);
    return { r: channel(0), g: channel(2), b: channel(4), a: full.length === 8 ? channel(6) / 255 : 1 };
  }
  const match = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (!match) throw new Error(`cor inválida: ${color}`);
  const parts = match[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) throw new Error(`cor inválida: ${color}`);
  return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 };
}

/** Canais → `rgba(...)` pronto para CSS. */
export function toCss({ r, g, b, a }: Rgba): string {
  const round = (value: number): number => Math.round(Math.min(255, Math.max(0, value)));
  return `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${Math.round(clamp01(a) * 1000) / 1000})`;
}

/** A mesma cor com outro alfa (multiplica pelo alfa que a cor já tem). */
export function withAlpha(color: string, opacity: number): string {
  const rgba = parseColor(color);
  return toCss({ ...rgba, a: rgba.a * opacity });
}

const toLinear = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const toGamma = (value: number): number => 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * Math.max(0, value) ** (1 / 2.4) - 0.055);

function toOklab({ r, g, b }: Rgba): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]: [number, number, number], a: number): Rgba {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a,
  };
}

/** Mistura perceptual (OKLab) de duas cores: `t = 0` devolve `from`, `t = 1` devolve `to`. */
export function mix(from: string, to: string, t: number): string {
  const amount = clamp01(t);
  const a = parseColor(from);
  const b = parseColor(to);
  const la = toOklab(a);
  const lb = toOklab(b);
  const lab: [number, number, number] = [la[0] + (lb[0] - la[0]) * amount, la[1] + (lb[1] - la[1]) * amount, la[2] + (lb[2] - la[2]) * amount];
  return toCss(fromOklab(lab, a.a + (b.a - a.a) * amount));
}

/** Luminosidade perceptual 0–1 (o L do OKLab): decide se o texto por cima é `ink` ou `paper`. */
export function lightness(color: string): number {
  return toOklab(parseColor(color))[0];
}

/** Cor ao longo de uma rampa de paradas igualmente espaçadas. */
export function ramp(stops: readonly string[], t: number): string {
  if (stops.length === 0) throw new Error('rampa sem cores');
  if (stops.length === 1) return toCss(parseColor(stops[0]!));
  const position = clamp01(t) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(position));
  return mix(stops[index]!, stops[index + 1]!, position - index);
}

const c = theme.color;

/** Rampas da marca. Use para luz, sombra e profundidade; nunca invente um tom fora delas. */
export const ramps = {
  /** papel na luz → papel na sombra: faces de papel conforme a inclinação e a profundidade */
  paper: ['#ffffff', c.paper, '#ecebe2', '#d9d8cc'],
  /** tinta: do preto de marca ao cinza de apoio */
  ink: [c.ink, c.slate900, c.slate600, c.slate300],
  /** luz quente: varreduras, halation e vazamento de luz (só como luz, nunca como preenchimento) */
  warm: ['#ffffff', '#fff3e2', c.glowPeach, c.coral],
  /** luz fria de preenchimento, para o lado oposto à luz quente */
  cool: ['#ffffff', '#eef1ff', c.glowPeriwinkle],
  /** acento: do coral ao coral profundo (sombra do próprio coral) */
  coral: ['#ff8a80', c.coral, c.coralDeep],
  /** certo/ao vivo */
  emerald: [c.glowMint, c.emerald, '#0f9f6e'],
} as const;

export type RampName = keyof typeof ramps;

/** Cor de uma rampa da marca. */
export function brandRamp(name: RampName, t: number): string {
  return ramp(ramps[name], t);
}

/**
 * Cor de uma superfície a uma certa profundidade: quanto mais longe, mais ela se funde com o ar (o fundo).
 * É a perspectiva atmosférica que separa os planos sem precisar de contorno.
 */
export function atmosphere(color: string, depth01: number, air: string = c.paper): string {
  return mix(color, air, clamp01(depth01) * 0.55);
}

/** Sombra tingida de slate (nunca preto puro): `strength` 0–1 vira o alfa. */
export function shadowColor(strength: number, tint: string = c.slate900): string {
  return withAlpha(tint, clamp01(strength));
}
