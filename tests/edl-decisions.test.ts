import { describe, expect, it } from 'vitest';

import { findReverts, formatRevert, isMatheusDecision } from '../src/edl/decisions.ts';
import type { Edl } from '../src/edl/schema.ts';
import { baseEdl } from './cut-fixture.ts';

const CLIPS = baseEdl().clips;
const v = (version: number, notes: string, overrides: Record<string, unknown> = {}) => baseEdl({ version, notes, ...overrides });
const whats = (history: Edl[], candidate: Edl) => findReverts(history, candidate).map((revert) => revert.what);

const lt = { id: 'lt', component: 'LowerThird', at: 2.2, duration: 1, reason: 'nome', props: { title: 'Matheus' } };

describe('isMatheusDecision', () => {
  it('reconhece o prefixo, com espaço antes', () => {
    expect(isMatheusDecision('Matheus: moveu corte')).toBe(true);
    expect(isMatheusDecision('  Matheus: x')).toBe(true);
    expect(isMatheusDecision('Claude: Matheus: x')).toBe(false);
    expect(isMatheusDecision('Corte automático')).toBe(false);
  });
});

describe('findReverts', () => {
  it('trecho que o Matheus cortou volta → aviso; versão do Claude não conta', () => {
    const v1 = v(1, 'Corte automático');
    const cut = [CLIPS[0]!, { ...CLIPS[1]!, start: 2.03 }, CLIPS[2]!];
    const v2 = v(2, 'Matheus: moveu início de c002 +0.13s', { clips: cut });
    const restored = v(3, 'Claude: mais respiro');
    const found = findReverts([v1, v2], restored);
    expect(found).toEqual([{ version: 2, what: 'restaurou 1.90–2.03s, que o Matheus cortou' }]);
    expect(formatRevert(found[0]!)).toBe('desfaz decisão do Matheus (v2): restaurou 1.90–2.03s, que o Matheus cortou');
    // o mesmo trim numa versão do Claude não é decisão do Matheus
    expect(findReverts([v1, v(2, 'Claude: aparou', { clips: cut })], restored)).toEqual([]);
  });

  it('trecho que o Matheus restaurou cortado de novo', () => {
    const tight = [CLIPS[0]!, { ...CLIPS[1]!, start: 2.03 }, CLIPS[2]!];
    expect(whats([v(1, 'auto', { clips: tight }), v(2, 'Matheus: restaurou 1.90–2.03s')], v(3, 'x', { clips: tight }))).toEqual([
      'cortou 1.90–2.03s, que o Matheus restaurou',
    ]);
  });

  it('decisão já desfeita por outra versão não acusa a candidata', () => {
    const cut = [CLIPS[0]!, { ...CLIPS[1]!, start: 2.03 }, CLIPS[2]!];
    const history = [v(1, 'auto'), v(2, 'Matheus: aparou', { clips: cut }), v(3, 'Matheus: voltou para a v1')];
    expect(findReverts(history, v(4, 'Claude: legenda'))).toEqual([]);
  });

  it('item que o Matheus inseriu, removeu ou editou', () => {
    const inserted = [v(1, 'auto'), v(2, 'Matheus: inseriu overlay LowerThird', { overlays: [lt] })];
    expect(whats(inserted, v(3, 'x'))).toEqual(['removeu overlay lt (LowerThird), que o Matheus inseriu']);
    expect(whats(inserted, v(3, 'x', { overlays: [{ ...lt, at: 2.5 }] }))).toEqual([]);

    const removed = [v(1, 'auto', { overlays: [lt] }), v(2, 'Matheus: removeu overlay lt')];
    expect(whats(removed, v(3, 'x', { overlays: [lt] }))).toEqual(['trouxe de volta overlay lt (LowerThird), que o Matheus removeu']);

    const edited = [v(1, 'auto', { overlays: [lt] }), v(2, 'Matheus: editou overlay lt (props)', { overlays: [{ ...lt, props: { title: 'Matheus Chiodi' } }] })];
    expect(whats(edited, v(3, 'x', { overlays: [{ ...lt, duration: 2 }] }))).toEqual(['desfez a edição do Matheus em overlay lt (LowerThird) (props)']);
    // mexer em outro campo do mesmo item não desfaz a decisão
    expect(whats(edited, v(3, 'x', { overlays: [{ ...lt, props: { title: 'Matheus Chiodi' }, duration: 2 }] }))).toEqual([]);
  });

  it('legendas: correção, destaque e campos; nível', () => {
    const history = [
      v(1, 'auto', { captions: { replacements: { pra: 'para' } } }),
      v(2, "Matheus: corrigiu legenda 'reakt'→'React'; destacou 'vite'", {
        level: 'pro',
        captions: { replacements: { pra: 'para', reakt: 'React' }, highlights: ['Vite'], maxWordsPerPage: 3 },
      }),
    ];
    const candidate = v(3, 'Claude', { level: 'normal', captions: { replacements: { pra: 'para' }, highlights: [], maxWordsPerPage: 5 } });
    expect(whats(history, candidate)).toEqual([
      'voltou o nível para normal (o Matheus escolheu pro)',
      "desfez a correção de legenda 'reakt'→'React'",
      "tirou o destaque de 'vite', que o Matheus pôs",
      'voltou captions.maxWordsPerPage para 5',
    ]);
    const kept = v(3, 'Claude', { level: 'pro', captions: { replacements: { pra: 'para', reakt: 'React', vit: 'Vite' }, highlights: ['vite'], maxWordsPerPage: 3 } });
    expect(whats(history, kept)).toEqual([]);
  });

  it('correção que o Matheus tirou recolocada', () => {
    const history = [v(1, 'auto', { captions: { replacements: { pra: 'para' } } }), v(2, "Matheus: desfez a correção de legenda 'pra'")];
    expect(whats(history, v(3, 'x', { captions: { replacements: { pra: 'para' } } }))).toEqual(["recolocou a correção de legenda 'pra'→'para', que o Matheus tirou"]);
  });

  it('sem histórico ou sem antecessora, nada a acusar', () => {
    expect(findReverts([], v(1, 'auto'))).toEqual([]);
    expect(findReverts([v(1, 'Matheus: primeira')], v(2, 'x', { level: 'max' }))).toEqual([]);
  });
});
