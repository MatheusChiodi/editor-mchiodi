import { theme } from '../theme';

/** Faixa inferior que a cena deixa livre: as legendas passam por cima dela. */
export const CAPTION_ZONE = 180;

/** Atraso entre palavras de um texto revelado palavra a palavra, em segundos. */
export const WORD_STAGGER = 0.05;

/** Cor do tema com transparência: o tema só guarda hex opaco. */
export function alpha(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

export type Tone = 'paper' | 'night';

/** Cores de texto e superfície por tom de cena: `night` inverte papel e tinta. */
export function toneColors(tone: Tone) {
  const night = tone === 'night';
  return {
    background: night ? theme.color.night : theme.color.paper,
    title: night ? theme.color.white : theme.color.slate900,
    text: night ? theme.color.slate300 : theme.color.slate600,
    surface: night ? alpha(theme.color.white, 0.08) : alpha(theme.color.white, 0.72),
    border: night ? alpha(theme.color.white, 0.16) : alpha(theme.color.white, 0.8),
    hairline: night ? alpha(theme.color.white, 0.2) : theme.color.slate300,
  };
}

/** `shadow-card` do site em escala de vídeo (1080p é ~3x a densidade de um cartão da página). */
export const longShadow = `0 54px 105px -60px ${alpha(theme.color.slate900, 0.45)}`;
export const pillShadow = `0 3px 9px 0 ${alpha(theme.color.slate900, 0.1)}, 0 3px 6px -3px ${alpha(theme.color.slate900, 0.1)}`;

/** Tamanhos de texto do kit (px em 1080p). Nada abaixo de 34. */
export const text = {
  eyebrow: 34,
  label: 36,
  body: 40,
  cardTitle: 60,
  statement: 104,
} as const;
