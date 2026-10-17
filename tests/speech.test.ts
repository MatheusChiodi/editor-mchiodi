import { describe, expect, it } from 'vitest';

import {
  buildPhrases,
  detectFillers,
  detectMarkers,
  detectRestarts,
  detectRetakes,
  detectVoicedGaps,
  normalizeToken,
  prefixSimilarity,
} from '../src/analyze/speech.ts';
import { script } from './helpers.ts';

describe('normalizeToken', () => {
  it('remove acento, caixa e pontuação', () => {
    expect(normalizeToken('Então,')).toBe('entao');
    expect(normalizeToken('É...')).toBe('e');
  });
});

describe('buildPhrases', () => {
  it('quebra em pausa longa e em fim de frase', () => {
    const words = script('Hoje vamos falar de React. É simples |1 mas tem detalhe');
    const phrases = buildPhrases(words);
    expect(phrases.map((phrase) => phrase.text)).toEqual(['Hoje vamos falar de React.', 'É simples', 'mas tem detalhe']);
    expect(phrases[1]!.pauseAfter).toBeCloseTo(1.05, 2);
  });
});

describe('detectRetakes', () => {
  it('marca a primeira tentativa quando a frase recomeça igual', () => {
    const words = script('Hoje a gente vai falar sobre o |1 Hoje a gente vai falar sobre React e hooks.');
    const phrases = buildPhrases(words);
    const flags = detectRetakes(phrases, words);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.start).toBe(phrases[0]!.start);
    expect(flags[0]!.end).toBe(phrases[1]!.start);
  });

  it('em três tentativas, sobra só a última', () => {
    const words = script(
      'O hook de estado serve |1 O hook de estado serve para |1 O hook de estado serve para guardar valor.',
    );
    const phrases = buildPhrases(words);
    const flags = detectRetakes(phrases, words);
    expect(flags).toHaveLength(2);
    expect(flags[1]!.end).toBe(phrases[2]!.start);
  });

  it('pula uma interjeição curta entre as tentativas', () => {
    const words = script('Primeiro você instala o Node |1 não |1 Primeiro você instala o pnpm no terminal.');
    const phrases = buildPhrases(words);
    const flags = detectRetakes(phrases, words);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.end).toBe(phrases[2]!.start);
  });

  it('não confunde frases diferentes', () => {
    const words = script('O React renderiza componentes. |1 O Vue usa templates declarativos. |1 E o Angular traz tudo pronto.');
    const phrases = buildPhrases(words);
    expect(detectRetakes(phrases, words)).toHaveLength(0);
  });

  it('ignora frases muito distantes', () => {
    const words = script('Vamos falar sobre performance agora |30 Vamos falar sobre performance de novo.');
    const phrases = buildPhrases(words);
    expect(detectRetakes(phrases, words)).toHaveLength(0);
  });
});

describe('prefixSimilarity', () => {
  it('tolera uma palavra trocada', () => {
    const a = ['hoje', 'a', 'gente', 'vai', 'falar', 'de'];
    const b = ['hoje', 'a', 'gente', 'vai', 'falar', 'sobre'];
    expect(prefixSimilarity(a, b)).toBeCloseTo(5 / 6);
  });
});

describe('detectRestarts', () => {
  it('acha o recomeço dentro da mesma frase', () => {
    const words = script('O React usa o O React usa um virtual DOM');
    const flags = detectRestarts(buildPhrases(words), words);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.start).toBe(words[0]!.start);
    expect(flags[0]!.end).toBe(words[4]!.start);
    expect(flags[0]!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('palavra única repetida fica com confiança baixa (ênfase é comum)', () => {
    const words = script('isso é muito muito importante');
    const flags = detectRestarts(buildPhrases(words), words);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.confidence).toBeLessThan(0.65);
  });

  it('não marca frase normal', () => {
    const words = script('o componente recebe as props e devolve o JSX');
    expect(detectRestarts(buildPhrases(words), words)).toHaveLength(0);
  });
});

describe('detectMarkers', () => {
  it('"corta" descarta a frase anterior e o marcador', () => {
    const words = script('Então o servidor responde com |1 corta |1 Então o cliente manda a requisição.');
    const phrases = buildPhrases(words);
    const flags = detectMarkers(phrases, words);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.start).toBe(phrases[0]!.start);
    expect(flags[0]!.end).toBe(phrases[1]!.end);
  });

  it('"corta" no meio de uma frase normal não é marcador', () => {
    const words = script('esse comando corta o arquivo em duas partes iguais');
    expect(detectMarkers(buildPhrases(words), words)).toHaveLength(0);
  });
});

describe('detectFillers', () => {
  it('pega hesitações e poupa o verbo "é"', () => {
    const words = script('ééé o React é hum uma biblioteca');
    const flags = detectFillers(words);
    expect(flags.map((flag) => flag.reason)).toHaveLength(2);
    expect(flags.every((flag) => flag.confidence >= 0.65)).toBe(true);
  });

  it('não confunde artigo e preposição com hesitação', () => {
    expect(detectFillers(script('um sistema a mais e um ah detalhe'))).toHaveLength(1);
    expect(detectFillers(script('uhm hum ahn hmm eh')).length).toBe(5);
  });
});

describe('detectVoicedGaps', () => {
  it('acusa intervalo com som e sem palavra', () => {
    const words = script('primeira parte |1.5 segunda parte');
    const gapStart = words[1]!.end;
    const silent = detectVoicedGaps(words, [{ start: gapStart, end: gapStart + 1.5 }]);
    const voiced = detectVoicedGaps(words, [{ start: gapStart, end: gapStart + 0.3 }]);
    expect(silent).toHaveLength(0);
    expect(voiced).toHaveLength(1);
  });
});
