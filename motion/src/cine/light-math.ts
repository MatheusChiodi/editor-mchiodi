import { theme } from '../theme';
import type { Vec2 } from './blur';
import { withAlpha } from './color';
import { wiggle } from './noise';

// Luz motivada: existe UMA fonte por cena (padrão: alto à esquerda, quente). Sombra, brilho de borda e
// varredura obedecem a essa mesma direção; é isso que faz os elementos parecerem estar no mesmo lugar.

/** Direção da luz-chave em graus: 0 = vem da direita, 90 = vem de baixo. O padrão do canal é o alto à esquerda. */
export const KEY_LIGHT_ANGLE = 235;

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export interface SweepOptions {
  /** 0 = a faixa ainda não entrou; 1 = já saiu pelo outro lado */
  progress: number;
  /** inclinação da faixa em graus (padrão 115: levemente deitada, como reflexo de janela) */
  angle?: number;
  /** largura da faixa em fração do elemento (0,18–0,35) */
  width?: number;
  color?: string;
  /** pico de opacidade da faixa (0,25–0,6 sobre papel; 0,6–0,9 sobre tinta) */
  intensity?: number;
}

/**
 * Gradiente de uma varredura de luz: núcleo estreito e forte + halo largo e fraco (uma faixa só, de borda
 * dura, é o brilho de template). Aplique como `background` de uma camada por cima do elemento.
 */
export function sweepGradient({ progress, angle = 115, width = 0.26, color = theme.color.white, intensity = 0.5 }: SweepOptions): string {
  // o centro corre de -width a 1 + width: a faixa entra e sai inteira
  const center = (-width + clamp01(progress) * (1 + 2 * width)) * 100;
  const half = (width / 2) * 100;
  const stop = (offset: number, opacity: number): string => `${withAlpha(color, opacity)} ${round(center + offset)}%`;
  return `linear-gradient(${angle}deg, ${[
    stop(-half * 2.2, 0),
    stop(-half, intensity * 0.18),
    stop(-half * 0.22, intensity * 0.7),
    stop(0, intensity),
    stop(half * 0.22, intensity * 0.7),
    stop(half, intensity * 0.18),
    stop(half * 2.2, 0),
  ].join(', ')})`;
}

export interface ShadowOptions {
  /** altura do objeto sobre a superfície, em px (0 = encostado; 8 = cartão pousado; 40+ = voando) */
  elevation: number;
  /** velocidade do objeto em px/frame: a sombra alonga e atrasa na direção contrária */
  velocity?: Vec2;
  lightAngle?: number;
  /** 0–1: multiplica a opacidade */
  strength?: number;
  tint?: string;
}

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  opacity: number;
}

/**
 * Sombra projetada em três camadas (contato, chave, ambiente). Com a altura, a sombra se afasta, alarga e
 * clareia; com a velocidade, alonga contra o movimento. Uma sombra só, fixa, é o que deixa o cartão "colado".
 */
export function castShadow({ elevation, velocity = { x: 0, y: 0 }, lightAngle = KEY_LIGHT_ANGLE, strength = 1 }: ShadowOptions): ShadowLayer[] {
  const height = Math.max(0, elevation);
  const radians = (lightAngle * Math.PI) / 180;
  // a sombra cai para o lado oposto ao da luz
  const dx = -Math.cos(radians);
  const dy = -Math.sin(radians);
  const lagX = -velocity.x * 0.35;
  const lagY = -velocity.y * 0.35;
  const speed = Math.hypot(velocity.x, velocity.y);
  const fade = 1 / (1 + height / 90);
  return [
    { x: dx * height * 0.08, y: dy * height * 0.08 + 1, blur: 2 + height * 0.12, spread: 0, opacity: 0.26 * strength * fade },
    { x: dx * height * 0.7 + lagX, y: dy * height * 0.7 + lagY, blur: 6 + height * 0.9 + speed * 0.4, spread: -height * 0.12, opacity: 0.26 * strength * fade },
    { x: dx * height * 1.6 + lagX * 1.6, y: dy * height * 1.6 + lagY * 1.6, blur: 18 + height * 2.4 + speed * 0.8, spread: -height * 0.25, opacity: 0.2 * strength * fade },
  ].map((layer) => ({ x: round(layer.x), y: round(layer.y), blur: round(layer.blur), spread: round(layer.spread), opacity: round(layer.opacity, 3) }));
}

/** `box-shadow` a partir das camadas (para caixas com `border-radius`). */
export function boxShadowCss(layers: readonly ShadowLayer[], tint: string = theme.color.slate900): string {
  return layers.map((layer) => `${layer.x}px ${layer.y}px ${layer.blur}px ${layer.spread}px ${withAlpha(tint, layer.opacity)}`).join(', ');
}

/** `filter: drop-shadow(...)` a partir das camadas (segue o recorte: papel rasgado, SVG, texto). Mais caro que `box-shadow`. */
export function dropShadowCss(layers: readonly ShadowLayer[], tint: string = theme.color.slate900): string {
  // drop-shadow não tem spread e o raio equivale a metade do blur de box-shadow
  return layers.map((layer) => `drop-shadow(${layer.x}px ${layer.y}px ${round(layer.blur / 2)}px ${withAlpha(tint, layer.opacity)})`).join(' ');
}

export interface RimOptions {
  lightAngle?: number;
  intensity?: number;
  /** espessura do filete de luz em px */
  width?: number;
  color?: string;
}

/**
 * Brilho de borda: filete claro na aresta virada para a luz e um escuro na oposta (`box-shadow` interno).
 * É o que dá espessura a um cartão sem desenhar contorno.
 */
export function rimLight({ lightAngle = KEY_LIGHT_ANGLE, intensity = 0.9, width = 1.5, color = theme.color.white }: RimOptions = {}): string {
  const radians = (lightAngle * Math.PI) / 180;
  const x = round(-Math.cos(radians) * width);
  const y = round(-Math.sin(radians) * width);
  return [
    `inset ${x}px ${y}px 0 0 ${withAlpha(color, clamp01(intensity))}`,
    `inset ${-x}px ${-y}px 0 0 ${withAlpha(theme.color.slate900, clamp01(intensity) * 0.1)}`,
    `inset ${round(x * 8)}px ${round(y * 8)}px ${round(width * 14)}px ${round(-width * 6)}px ${withAlpha(color, clamp01(intensity) * 0.5)}`,
  ].join(', ');
}

export interface GlowOptions {
  color?: string;
  /** raio do halo mais largo em px */
  radius?: number;
  /** 0–1 */
  strength?: number;
}

/**
 * Halation: três halos de raio crescente e força decrescente (o brilho de filme em torno do que é claro ou
 * saturado). Serve em `text-shadow` e em `box-shadow`. Sem filtro: custo zero.
 */
export function glowShadow({ color = theme.color.coral, radius = 36, strength = 0.6 }: GlowOptions = {}): string {
  const power = clamp01(strength);
  return [
    `0 0 ${round(radius * 0.12)}px ${withAlpha(color, power * 0.55)}`,
    `0 0 ${round(radius * 0.45)}px ${withAlpha(color, power * 0.32)}`,
    `0 0 ${round(radius)}px ${withAlpha(color, power * 0.2)}`,
  ].join(', ');
}

export interface VignetteOptions {
  /** 0–1: escurecimento nos cantos (0,18–0,3 sobre papel; 0,35–0,5 sobre footage) */
  strength?: number;
  /** centro da área clara, em fração do quadro: aponte para o assunto */
  focus?: Vec2;
  /** raio (fração da diagonal) em que o escurecimento começa */
  inner?: number;
  tint?: string;
  /** respiração: variação relativa da força ao longo do tempo (0 = parada) */
  breathe?: number;
  seed?: number;
}

/**
 * Vinheta viva: o centro segue o assunto e a força respira devagar. `frame`/`fps` só entram na respiração.
 * Devolve um `radial-gradient` para uma camada de tela cheia (sem filtro).
 */
export function vignetteGradient(frame: number, fps: number, { strength = 0.24, focus = { x: 0.5, y: 0.46 }, inner = 0.42, tint = theme.color.slate900, breathe = 0.12, seed = 3 }: VignetteOptions = {}): string {
  const live = strength * (1 + wiggle(frame, fps, { frequency: 0.25, amplitude: breathe, seed }));
  const drift = wiggle(frame, fps, { frequency: 0.18, amplitude: 0.012, seed: seed + 11 });
  const stops = [
    `${withAlpha(tint, 0)} ${round(inner * 100)}%`,
    `${withAlpha(tint, live * 0.28)} ${round((inner + (1 - inner) * 0.45) * 100)}%`,
    `${withAlpha(tint, live * 0.7)} ${round((inner + (1 - inner) * 0.8) * 100)}%`,
    `${withAlpha(tint, live)} 100%`,
  ];
  return `radial-gradient(ellipse 85% 85% at ${round((focus.x + drift) * 100)}% ${round((focus.y + drift * 0.6) * 100)}%, ${stops.join(', ')})`;
}

/**
 * Light wrap aproximado para um cartão sobre fundo claro: a luz do ambiente "invade" a borda do objeto.
 * Devolve um `box-shadow` interno claro e difuso em toda a volta.
 */
export function lightWrap(intensity = 0.5, radius = 26, color: string = theme.color.white): string {
  return `inset 0 0 ${radius}px 0 ${withAlpha(color, clamp01(intensity) * 0.6)}`;
}

/**
 * Varredura de luz DENTRO das letras: `background` para usar com `background-clip: text` e `color: transparent`.
 * A cor-base do texto fica por baixo e a faixa passa por cima, só onde há tinta.
 */
export function sweepTextBackground(baseColor: string, sweep: SweepOptions): string {
  return `${sweepGradient(sweep)}, linear-gradient(${baseColor}, ${baseColor})`;
}
