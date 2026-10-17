import type { Span, Word } from '../src/analyze/types.ts';
import type { Edl } from '../src/edl/schema.ts';
import { validateEdl } from '../src/edl/store.ts';
import type { SpeechContext } from '../src/cut/snap.ts';
import { script } from './helpers.ts';

/**
 * Fala sintética: "ola pessoal hoje" (0–1.0) · pausa · "vamos falar de reakt" (2.05–3.4) · pausa ·
 * "e vite tambem" (4.65–5.65). Fonte de 6 s. Silêncios medidos nas pausas e no fim.
 */
export const WORDS: Word[] = script('ola pessoal hoje |1.0 vamos falar de reakt |1.2 e vite tambem');
export const SILENCES: Span[] = [
  { start: 1.02, end: 2.03 },
  { start: 3.42, end: 4.63 },
  { start: 5.67, end: 6 },
];
export const DURATION = 6;

export const SPEECH: SpeechContext = { words: WORDS, silences: SILENCES, durationSec: DURATION };

export function baseEdl(overrides: Record<string, unknown> = {}): Edl {
  return validateEdl({
    version: 1,
    project: 'demo',
    createdAt: '2026-10-17T00:00:00.000Z',
    notes: 'Corte automático',
    source: { path: 'fonte.mp4', durationSec: DURATION, fps: 30, width: 320, height: 180 },
    output: { fps: 30, width: 320, height: 180 },
    clips: [
      { id: 'c001', start: 0, end: 1.2, quote: 'ola pessoal hoje' },
      { id: 'c002', start: 1.9, end: 3.6, quote: 'vamos falar de reakt' },
      { id: 'c003', start: 4.5, end: 5.8, quote: 'e vite tambem' },
    ],
    removed: [
      { start: 1.2, end: 1.9, kind: 'silence', reason: 'pausa' },
      { start: 3.6, end: 4.5, kind: 'silence', reason: 'pausa' },
      { start: 5.8, end: 6, kind: 'silence', reason: 'pausa' },
    ],
    ...overrides,
  });
}

/** Nenhuma borda interna de clipe fica dentro de palavra. */
export function edgesInsideWords(edl: Pick<Edl, 'clips'>, words: Word[] = WORDS): string[] {
  return edl.clips.flatMap((clip) =>
    [clip.start, clip.end].flatMap((edge) => words.filter((word) => edge > word.start + 1e-6 && edge < word.end - 1e-6).map((word) => `${clip.id}@${edge} em "${word.text}"`)),
  );
}
