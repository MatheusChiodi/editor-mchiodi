import { describe, expect, it } from 'vitest';

import { buildPhrases } from '../src/analyze/speech.ts';
import { configSchema } from '../src/config.ts';
import { autocut } from '../src/edl/autocut.ts';
import { script } from './helpers.ts';

describe('autocut com movimento', () => {
  const cuts = configSchema.parse({}).cuts;
  const words = script('abre o editor |2 agora salva o arquivo.', 0.5);
  const phrases = buildPhrases(words);
  const durationSec = words.at(-1)!.end + 1;
  const gap = { start: words[3]!.start - 2 + 0.01, end: words[3]!.start - 0.01 };
  const silences = [gap];

  const run = (stills?: { start: number; end: number }[]) =>
    autocut({ words, phrases, flags: [], silences, stills, durationSec, fps: 30, cuts });

  it('sem análise de movimento, pausa muda longa é cortada como sempre', () => {
    expect(run().clips).toHaveLength(2);
  });

  it('pausa muda com a tela parada é cortada', () => {
    expect(run([gap]).clips).toHaveLength(2);
  });

  it('pausa muda com a tela se mexendo vira conteúdo: não é cortada', () => {
    expect(run([]).clips).toHaveLength(1);
  });
});
