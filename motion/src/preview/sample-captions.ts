import type { StyledCaption } from '../types';

const TEXT =
  'Hoje a gente vai entender como o React decide o que renderizar. | Spoiler: não é mágica, | é um algoritmo chamado reconciliação.';
const HIGHLIGHTS = new Set(['react', 'reconciliação.']);

/** Legendas de exemplo: 320 ms por palavra, "|" força quebra de página. */
export const sampleCaptions: StyledCaption[] = (() => {
  const captions: StyledCaption[] = [];
  let cursor = 300;
  for (const token of TEXT.split(' ')) {
    if (token === '|') {
      const last = captions.at(-1);
      if (last) last.pageBreakAfter = true;
      cursor += 250;
      continue;
    }
    captions.push({
      text: ` ${token}`,
      startMs: cursor,
      endMs: cursor + 290,
      timestampMs: cursor + 145,
      confidence: null,
      highlight: HIGHLIGHTS.has(token.toLowerCase()),
      pageBreakAfter: captions.length % 5 === 4,
    });
    cursor += 320;
  }
  return captions;
})();
