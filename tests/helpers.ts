import type { Word } from '../src/analyze/types.ts';

/**
 * Monta palavras a partir de um roteiro: cada palavra dura 0.3s com 0.05s entre elas;
 * "|1.2" insere uma pausa de 1.2s.
 */
export function script(text: string, startAt = 0): Word[] {
  const words: Word[] = [];
  let cursor = startAt;
  for (const token of text.split(/\s+/).filter(Boolean)) {
    const pause = /^\|([\d.]+)$/.exec(token);
    if (pause) {
      cursor += Number(pause[1]);
      continue;
    }
    words.push({ text: token, start: round(cursor), end: round(cursor + 0.3), score: 0.9, segment: 0, interpolated: false });
    cursor += 0.35;
  }
  return words;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
