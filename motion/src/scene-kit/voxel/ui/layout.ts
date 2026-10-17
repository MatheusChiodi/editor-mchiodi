import { useVideoConfig } from 'remotion';

export const SAFE = 80;

export interface AccentText {
  text: string;
  /** trecho de `text` na cor de acento */
  accent?: string;
}

/** Texto com janela de exibição em FRAMES relativos à cena. */
export type TimedText = AccentText & { from: number; to: number };

export function useLayout() {
  const { width, height, fps } = useVideoConfig();
  const vertical = height > width;
  return {
    width,
    height,
    fps,
    vertical,
    // paisagem tem mais largura por linha, então a UI cresce um pouco.
    unit: vertical ? 1 : 1.15,
    maxWidth: width - SAFE * 2,
  };
}

/** Meio pixel: mantém a borda nítida sem o deslocamento andar em degraus. */
export function snap(value: number): number {
  return Math.round(value * 2) / 2;
}

export interface Segment {
  text: string;
  accent: boolean;
}

export function splitAccent({ text, accent }: AccentText): Segment[] {
  const index = accent ? text.indexOf(accent) : -1;
  if (!accent || index < 0) return [{ text, accent: false }];
  return [
    { text: text.slice(0, index), accent: false },
    { text: accent, accent: true },
    { text: text.slice(index + accent.length), accent: false },
  ].filter((segment) => segment.text.length > 0);
}

/** Quantos caracteres de cada segmento já foram "digitados" (efeito terminal por fatiamento de string). */
export function typeSegments(segments: Segment[], typed: number): Segment[] {
  let remaining = Math.max(0, typed);
  return segments.map((segment) => {
    const visible = segment.text.slice(0, remaining);
    remaining = Math.max(0, remaining - segment.text.length);
    return { ...segment, text: visible };
  });
}
