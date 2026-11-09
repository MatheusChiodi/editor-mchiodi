import { describe, expect, it } from 'vitest';

import { MAX_PILLS } from '../motion/src/components/PillStack.tsx';
import { MAX_CARDS } from '../motion/src/components/SplitExplainer.tsx';
import { MAX_LINES, MAX_NOTES } from '../motion/src/components/WindowStage.tsx';
import { registry } from '../motion/src/components/registry.ts';
import { checkStageProps, LIMITS } from '../src/motion/props-check.ts';

describe('checkStageProps', () => {
  it('limites espelham as constantes dos componentes', () => {
    expect(LIMITS).toEqual({ pills: MAX_PILLS, cards: MAX_CARDS, lines: MAX_LINES, notes: MAX_NOTES });
  });

  it('as props de exemplo de cada componente checado passam limpas na duração padrão', () => {
    for (const name of ['PillStack', 'SplitExplainer', 'PhraseReveal', 'DocQuote', 'WindowStage'] as const) {
      const entry = registry[name] as { sample: Record<string, unknown>; defaultDuration: number };
      expect(checkStageProps(name, entry.sample, entry.defaultDuration), name).toEqual([]);
    }
  });

  it('componente sem checagem e props ausentes não quebram', () => {
    expect(checkStageProps('Quote', { text: 'x' }, 3)).toEqual([]);
    expect(checkStageProps('PillStack', undefined, 5)[0]).toContain('items: vazio');
    expect(checkStageProps('PillStack', { items: [{ text: 'a' }] }, Number.NaN)).toBeInstanceOf(Array);
  });

  it('PillStack: excesso, vazias, tom inválido, strike antes do at, instante tarde', () => {
    const items = [{ text: 'a', at: 1 }, { text: ' ' }, { text: 'b', tone: 'roxo', at: 2, strikeAt: 1 }, { text: 'c' }, { text: 'd' }, { text: 'e' }, { text: 'f', at: 40 }];
    const issues = checkStageProps('PillStack', { items }, 6).join('\n');
    expect(issues).toContain('sem texto');
    expect(issues).toContain('só as 5 primeiras');
    expect(issues).toContain('"roxo" não existe');
    expect(issues).toContain('strikeAt');
  });

  it('SplitExplainer: sem título, cartões demais, revealAt de sobra e tardio', () => {
    const cards = Array.from({ length: 8 }, (_, i) => ({ label: `c${i}` }));
    const issues = checkStageProps('SplitExplainer', { title: 'dois termos', cards, revealAt: [1, 2, 99], wordAt: [1, 2, 3, 4, 5, 6] }, 8).join('\n');
    expect(checkStageProps('SplitExplainer', {}, 8)[0]).toContain('title: obrigatório');
    expect(issues).toContain('só os 6 primeiros');
    expect(issues).toContain('revealAt: 1 instante(s) depois');
    expect(issues).toContain('wordAt');
  });

  it('PhraseReveal: vazio, frase longa, wordAt divergente, curto demais', () => {
    expect(checkStageProps('PhraseReveal', {}, 4)[0]).toContain('obrigatório');
    const issues = checkStageProps('PhraseReveal', { text: 'uma frase muito longa que passa de oitenta caracteres com folga para encolher a fonte demais', wordAt: [0.5, 1] }, 2).join('\n');
    expect(issues).toContain('encolhe');
    expect(issues).toContain('wordAt: 2 instantes');
    expect(issues).toContain('leitura mínima');
  });

  it('DocQuote: sem marca-texto, texto enorme, markAt tardio', () => {
    expect(checkStageProps('DocQuote', { text: 'sem marca' }, 6).join()).toContain('marca-texto não tem onde correr');
    expect(checkStageProps('DocQuote', { text: `${'a '.repeat(250)} ==x==`, markAt: 5.5 }, 6).join('\n')).toMatch(/caracteres[\s\S]*markAt/);
  });

  it('WindowStage: kind inválido, terminal vazio, linhas e notas demais, valor inválido', () => {
    expect(checkStageProps('WindowStage', { kind: 'x' }, 6).join()).toContain('"x" não existe');
    expect(checkStageProps('WindowStage', {}, 6).join()).toContain('lines: vazio');
    const lines = Array.from({ length: 11 }, () => ({ text: 'a', at: 'x' }));
    const notes = Array.from({ length: 6 }, () => ({ text: 'n' }));
    const issues = checkStageProps('WindowStage', { lines, notes }, 6).join('\n');
    expect(issues).toContain('11 linhas');
    expect(issues).toContain('6 pílulas');
    expect(issues).toContain('inválido');
  });
});
