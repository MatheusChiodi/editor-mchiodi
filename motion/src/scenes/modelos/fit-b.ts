// Estimativa de largura de texto para os modelos decidirem o layout sem medir o DOM (função pura, testável).
// Nome em minúsculas: o `scenes sync` só registra arquivos PascalCase.

/** Largura média de um caractere, em fração do tamanho da fonte. Arredondado para cima: melhor sobrar que estourar. */
export const CHAR_WIDTH = { body: 0.58, display: 0.56, pixelTitle: 1.02, pixelMono: 0.42 } as const;

export type FontKind = keyof typeof CHAR_WIDTH;

/** Largura estimada (px) de `text` numa linha só. */
export function estimateWidth(text: string, fontSize: number, kind: FontKind = 'body'): number {
  return [...text].length * fontSize * CHAR_WIDTH[kind];
}

/** Maior tamanho entre `min` e `base` em que `text` cabe em `maxWidth` numa linha; `min` quando nem assim cabe (aí o texto quebra). */
export function fitFontSize(text: string, maxWidth: number, base: number, min: number, kind: FontKind = 'body'): number {
  const width = estimateWidth(text, 1, kind);
  if (width <= 0) return base;
  return Math.max(min, Math.min(base, Math.floor(maxWidth / width)));
}

/** Quantas linhas `text` ocupa em `maxWidth` (estimativa por palavras). */
export function estimateLines(text: string, maxWidth: number, fontSize: number, kind: FontKind = 'body'): number {
  const space = fontSize * CHAR_WIDTH[kind];
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const width = estimateWidth(word, fontSize, kind);
    if (used > 0 && used + space + width > maxWidth) {
      lines += 1;
      used = width;
    } else {
      used += (used > 0 ? space : 0) + width;
    }
  }
  return lines;
}

/** Largura estimada de uma `Pill` do kit: texto + padding (0.9em de cada lado) + borda, mais bolinha/ícone se houver. */
export function pillWidth(label: string, fontSize: number, extra: 'none' | 'dot' | 'icon' = 'none'): number {
  const adornment = extra === 'dot' ? fontSize * 0.76 : extra === 'icon' ? fontSize * 1.35 : 0;
  return Math.ceil(estimateWidth(label, fontSize) + fontSize * 1.8 + 4 + adornment);
}

/** Altura de uma `Pill` do kit: linha (1.15) + padding (0.42em em cima e embaixo) + borda. */
export function pillHeight(fontSize: number): number {
  return Math.round(fontSize * 1.15 + fontSize * 0.42 * 2 + 4);
}

/** Centésimos de segundo: somar tempos em ponto flutuante deixa resíduo (3.4000000000000004) que vazaria para a EDL. */
export function roundSec(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}

/** Um tempo de `revealAt`: o que veio, ou o padrão arredondado. */
export function pickSec(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : roundSec(fallback);
}

/** Preenche uma lista de tempos: usa o que veio e, onde falta, segue em sequência depois do anterior. */
export function fillTimes(count: number, given: readonly (number | undefined)[] = [], firstSec = 1, staggerSec = 0.7): number[] {
  const times: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = given[index];
    times.push(typeof value === 'number' && Number.isFinite(value) ? value : roundSec(index === 0 ? firstSec : times[index - 1]! + staggerSec));
  }
  return times;
}

export function clampCount(count: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(count)));
}
