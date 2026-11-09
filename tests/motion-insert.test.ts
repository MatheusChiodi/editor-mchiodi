import { describe, expect, it } from 'vitest';

import type { Word } from '../src/analyze/types.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { describeOverlays, findPhrase, insertOverlay, nextOverlayId, normalizeText, removeOverlay } from '../src/motion/insert.ts';
import { baseEdl } from './cut-fixture.ts';

const word = (text: string, start: number): Word => ({ text, start, end: start + 0.3, score: 0.9, segment: 0, interpolated: false });
const words = [word('Hoje', 0.1), word('a', 0.5), word('gente', 0.7), word('usa', 1.0), word('React,', 2.0), word('e', 2.4), word('Vite', 2.6), word('depois', 3.0), word('a', 4.6), word('gente', 4.9), word('fecha.', 5.2)];

describe('normalizeText', () => {
  it('minúsculas, sem acento nem pontuação', () => {
    expect(normalizeText('Açúcar, é "Ótimo"!')).toBe('acucar e otimo');
  });
});

describe('findPhrase (ancorar na fala)', () => {
  it('acha a frase em palavras consecutivas, ignorando caixa, acento e pontuação', () => {
    expect(findPhrase(words, 'usa react')).toEqual([{ index: 3, start: 1.0, end: 2.3 }]);
    expect(findPhrase(words, 'VITE')).toEqual([{ index: 6, start: 2.6, end: 2.9 }]);
  });
  it('devolve todas as ocorrências, em ordem', () => {
    expect(findPhrase(words, 'a gente').map((m) => m.start)).toEqual([0.5, 4.6]);
  });
  it('sem ocorrência ou frase vazia: lista vazia', () => {
    expect(findPhrase(words, 'angular')).toEqual([]);
    expect(findPhrase(words, '   ')).toEqual([]);
  });
});

describe('nextOverlayId', () => {
  it('kebab-case do componente com contador', () => {
    expect(nextOverlayId([], 'PathDraw')).toBe('path-draw-1');
    expect(nextOverlayId([{ id: 'path-draw-1' }, { id: 'path-draw-2' }, { id: 'burst-1' }], 'PathDraw')).toBe('path-draw-3');
    expect(nextOverlayId([], 'scene:meu-video/FluxoDeDados')).toBe('fluxo-de-dados-1');
  });
});

describe('insertOverlay / removeOverlay', () => {
  const edl = baseEdl();
  const known = new Set(['PathDraw', 'Burst']);

  it('insere o gráfico no meio de um trecho que ficou, com motivo, e valida a EDL', () => {
    const next = insertOverlay(edl, { component: 'PathDraw', at: 2.5, duration: 3, props: { d: 'M 0 0 L 10 0' }, reason: 'mostra o fluxo citado' }, known);
    expect(next.overlays).toHaveLength(1);
    expect(next.overlays[0]).toMatchObject({ id: 'path-draw-1', component: 'PathDraw', at: 2.5, duration: 3, reason: 'mostra o fluxo citado', props: { d: 'M 0 0 L 10 0' } });
    expect(next.notes).toContain('PathDraw');
    expect(edl.overlays).toHaveLength(0);
  });

  it('recusa componente que não existe, sem motivo e instante em trecho cortado', () => {
    const base = { component: 'PathDraw', at: 2.5, duration: 2, reason: 'x' };
    expect(() => insertOverlay(edl, { ...base, component: 'Inexistente' }, known)).toThrow(/Inexistente/);
    expect(() => insertOverlay(edl, { ...base, reason: '  ' }, known)).toThrow(/motivo|reason/i);
    expect(() => insertOverlay(edl, { ...base, at: 3.9 }, known)).toThrow(/cortado/);
  });

  it('cena sob medida passa sem estar no registro', () => {
    const next = insertOverlay(edl, { component: 'scene:demo/Fluxo', at: 2.5, duration: 2, reason: 'explica o fluxo' }, known);
    expect(next.overlays[0]!.component).toBe('scene:demo/Fluxo');
  });

  it('remove por id e recusa id que não existe', () => {
    const withOne = insertOverlay(edl, { component: 'Burst', at: 2.5, duration: 1.5, reason: 'comemora' }, known);
    expect(removeOverlay(withOne, 'burst-1').overlays).toHaveLength(0);
    expect(() => removeOverlay(withOne, 'nada')).toThrow(/nada/);
  });
});

describe('describeOverlays', () => {
  it('mostra tempo da fonte e do vídeo final', () => {
    const edl = insertOverlay(baseEdl(), { component: 'Burst', at: 2.5, duration: 1.5, reason: 'comemora' }, new Set(['Burst']));
    const rows = describeOverlays(edl, buildTimeline(edl.clips, edl.output.fps));
    // c001 tem 1.2 s; c002 começa na fonte em 1.9, então 2.5 é 0.6 s dentro dele: 1.2 + 0.6
    expect(rows).toEqual([{ id: 'burst-1', component: 'Burst', source: 2.5, output: 1.8, duration: 1.5, reason: 'comemora' }]);
  });
});
