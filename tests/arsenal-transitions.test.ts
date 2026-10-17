import { describe, expect, it } from 'vitest';

import {
  coverage,
  COVER_END,
  entry,
  REVEAL_START,
  shapePath,
  stingerColor,
  stingerProgress,
  stingerShapes,
  stingerVariants,
} from '../motion/src/arsenal/stingers/Stinger.tsx';
import { type TransitionPreset, transitions, xfadeArgs } from '../src/arsenal/transitions.ts';

const all = Object.entries(transitions);
const byKind = (kind: TransitionPreset['kind']) => Object.values(transitions).filter((preset) => preset.kind === kind);

describe('arsenal de transições: catálogo', () => {
  it('tem exatamente 50 presets', () => {
    expect(all).toHaveLength(50);
  });

  it('ids únicos, em kebab-case e iguais à chave', () => {
    for (const [key, preset] of all) {
      expect(preset.id).toBe(key);
      expect(key).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    }
    expect(new Set(all.map(([, preset]) => preset.id)).size).toBe(50);
  });

  it('campos obrigatórios preenchidos e dentro dos limites', () => {
    for (const preset of Object.values(transitions)) {
      expect(preset.label.trim().length, preset.id).toBeGreaterThan(2);
      expect(preset.description.trim().length, preset.id).toBeGreaterThan(20);
      expect(['xfade', 'stinger']).toContain(preset.kind);
      expect(preset.defaultDuration, preset.id).toBeGreaterThanOrEqual(0.2);
      expect(preset.defaultDuration, preset.id).toBeLessThanOrEqual(1);
      expect(['calm', 'medium', 'high']).toContain(preset.energy);
      expect(['any', 'sober', 'playful']).toContain(preset.tone);
      expect(['whoosh', 'pop', 'glitch', null]).toContain(preset.sfx);
    }
  });

  it('rótulos não se repetem', () => {
    expect(new Set(Object.values(transitions).map((preset) => preset.label)).size).toBe(50);
  });

  it('todo xfade tem `xfade` (e só ele); todo stinger tem `stinger` com variante existente', () => {
    for (const preset of byKind('xfade')) {
      expect(preset.xfade, preset.id).toBeDefined();
      expect(preset.stinger, preset.id).toBeUndefined();
      const value = 'expr' in preset.xfade! ? preset.xfade!.expr : preset.xfade!.transition;
      expect(value.length, preset.id).toBeGreaterThan(0);
    }
    for (const preset of byKind('stinger')) {
      expect(preset.xfade, preset.id).toBeUndefined();
      expect(stingerVariants, preset.id).toContain(preset.stinger?.variant);
    }
  });

  it('nenhum efeito xfade nem variante de stinger aparece duas vezes', () => {
    const effects = byKind('xfade').map(xfadeArgs);
    expect(new Set(effects).size).toBe(effects.length);
    const variants = byKind('stinger').map((preset) => preset.stinger!.variant);
    expect(new Set(variants).size).toBe(variants.length);
    // toda variante do componente está no catálogo
    expect([...variants].sort()).toEqual([...stingerVariants].sort());
  });

  it('os 5 ids legados da EDL mantêm o efeito de hoje', () => {
    const legacy = {
      'cross-dissolve': 'fade',
      wipe: 'smoothleft',
      'whip-pan': 'hblur',
      'zoom-blur': 'zoomin',
      glitch: 'pixelize',
    };
    for (const [id, transition] of Object.entries(legacy)) {
      expect(transitions[id]?.kind, id).toBe('xfade');
      expect(transitions[id]?.xfade, id).toEqual({ transition });
    }
  });
});

describe('xfadeArgs', () => {
  it('formata efeito nativo', () => {
    expect(xfadeArgs(transitions.wipe!)).toBe('transition=smoothleft');
  });

  it('formata expressão custom entre aspas simples', () => {
    const preset: TransitionPreset = { ...transitions['cross-dissolve']!, id: 'x', xfade: { expr: 'A*P+B*(1-P)' } };
    expect(xfadeArgs(preset)).toBe("transition=custom:expr='A*P+B*(1-P)'");
    for (const custom of byKind('xfade').filter((item) => 'expr' in item.xfade!)) {
      expect(xfadeArgs(custom)).toMatch(/^transition=custom:expr='[^']+'$/);
    }
  });

  it('recusa stinger e expressão com aspas simples', () => {
    expect(() => xfadeArgs(transitions['paper-curtain']!)).toThrow(/não é xfade/);
    expect(() => xfadeArgs({ ...transitions.wipe!, xfade: { expr: "A'B" } })).toThrow(/aspas/);
  });
});

describe('Stinger', () => {
  it('tem 20 variantes', () => {
    expect(stingerVariants).toHaveLength(20);
  });

  it.each(stingerVariants)('%s: nada no início e no fim, tela 100%% coberta no meio', (variant) => {
    expect(coverage(variant, 0)).toBe(0);
    expect(coverage(variant, 1)).toBe(0);
    expect(coverage(variant, 0.5)).toBe(1);
    // a janela coberta inteira, não só o instante central
    expect(coverage(variant, COVER_END)).toBe(1);
    expect(coverage(variant, REVEAL_START)).toBe(1);
  });

  it.each(stingerVariants)('%s: cobre de forma monotônica e depois descobre', (variant) => {
    const steps = Array.from({ length: 41 }, (_, index) => coverage(variant, index / 40));
    for (let index = 1; index <= 16; index++) expect(steps[index]!).toBeGreaterThanOrEqual(steps[index - 1]!);
    for (let index = 25; index <= 40; index++) expect(steps[index]!).toBeLessThanOrEqual(steps[index - 1]!);
    expect(steps[4]!).toBeGreaterThan(0);
    expect(steps[36]!).toBeGreaterThan(0);
  });

  it.each(stingerVariants)('%s: os dois frames vizinhos do corte estão cobertos, mesmo com 6 frames', (variant) => {
    for (const duration of [6, 9, 12, 15, 21, 30]) {
      const before = Math.ceil(duration / 2) - 1;
      const after = Math.floor(duration / 2);
      expect(coverage(variant, stingerProgress(before, duration)), `${duration}f`).toBe(1);
      expect(coverage(variant, stingerProgress(after, duration)), `${duration}f`).toBe(1);
    }
  });

  it('no meio a cor de cima é a principal: coral só domina na íris coral', () => {
    for (const variant of stingerVariants) {
      const top = stingerShapes(variant, 0.5).at(-1)!;
      const fill = top.fill === 'main' ? stingerColor(variant) : top.fill;
      if (variant === 'iris-coral') expect(fill).toBe('coral');
      // nas folhas o fio coral de 20 px fica por cima do paper: é acento, não fundo
      else if (variant !== 'doors-horizontal') expect(fill, variant).not.toBe('coral');
    }
  });

  it('progresso amostra o meio do frame e é simétrico', () => {
    expect(stingerProgress(0, 10)).toBeCloseTo(0.05);
    expect(stingerProgress(9, 10)).toBeCloseTo(0.95);
    expect(stingerProgress(4, 10) + stingerProgress(5, 10)).toBeCloseTo(1);
    expect(stingerProgress(99, 10)).toBe(1);
    expect(stingerProgress(0, 0)).toBe(0.5);
  });

  it('cor: padrão da variante, troca por cor do tema, recusa o resto', () => {
    expect(stingerColor('paper-curtain')).toBe('paper');
    expect(stingerColor('paper-curtain', 'night')).toBe('night');
    expect(() => stingerColor('paper-curtain', '#00ff00')).toThrow(/não é do tema/);
    expect(() => stingerShapes('nope', 0.5)).toThrow(/não existe/);
  });

  it('gera path SVG para polígono e para anel com furo', () => {
    expect(shapePath({ kind: 'poly', fill: 'main', points: [[0, 0], [10, 0], [10, 5]] })).toBe('M0 0L10 0L10 5Z');
    const ring = shapePath({ kind: 'ring', fill: 'main', cx: 100, cy: 50, inner: 10, outer: 40 });
    expect(ring.match(/M/g)).toHaveLength(2);
    expect(shapePath({ kind: 'ring', fill: 'main', cx: 100, cy: 50, inner: 0, outer: 40 }).match(/M/g)).toHaveLength(1);
  });

  it('entry aponta para uma variante real', () => {
    expect(stingerVariants).toContain(entry.sample.variant);
    expect(entry.defaultDuration).toBeGreaterThan(0);
  });
});
