import { describe, expect, it } from 'vitest';

import { beatPulse, lyricAt, mixHex, paletteAt, sectionIndexAt, wordStates } from '../motion/src/music/visuals.ts';
import type { MusicPlan } from '../motion/src/music/types.ts';

const plan = {
  fps: 30,
  durationInFrames: 600,
  sections: [
    { startFrame: 0, endFrame: 300, energy: 'low', palette: ['#000000', '#ff0000', '#00ff00'] },
    { startFrame: 300, endFrame: 600, energy: 'high', palette: ['#ffffff', '#0000ff', '#ffff00'] },
  ],
  lyrics: [
    { text: 'eu vou seguir', startFrame: 60, endFrame: 120, words: [{ text: 'eu', startFrame: 60, endFrame: 80 }, { text: 'vou', startFrame: 80, endFrame: 100 }, { text: 'seguir', startFrame: 100, endFrame: 120 }] },
    { text: 'sem olhar', startFrame: 200, endFrame: 260, words: [{ text: 'sem', startFrame: 200, endFrame: 230 }, { text: 'olhar', startFrame: 230, endFrame: 260 }] },
  ],
} as unknown as MusicPlan;

describe('mixHex', () => {
  it('interpola canal a canal', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ff0000', 0.5)).toBe('#800000');
  });
  it('aceita cor curta (#rgb)', () => {
    expect(mixHex('#000', '#fff', 1)).toBe('#ffffff');
    expect(mixHex('#f00', '#000000', 0)).toBe('#ff0000');
  });
});

describe('sectionIndexAt', () => {
  it('acha a seção do quadro, limitando nas pontas', () => {
    expect(sectionIndexAt(plan, 0)).toBe(0);
    expect(sectionIndexAt(plan, 299)).toBe(0);
    expect(sectionIndexAt(plan, 300)).toBe(1);
    expect(sectionIndexAt(plan, 9999)).toBe(1);
  });
});

describe('paletteAt', () => {
  it('no meio da seção usa a paleta dela; perto da fronteira mistura com a próxima', () => {
    expect(paletteAt(plan, 100, 30)).toEqual(['#000000', '#ff0000', '#00ff00']);
    const near = paletteAt(plan, 299, 30);
    expect(near[0]).not.toBe('#000000');
    expect(near[0]).not.toBe('#ffffff');
    expect(paletteAt(plan, 400, 30)).toEqual(['#ffffff', '#0000ff', '#ffff00']);
  });
});

describe('beatPulse', () => {
  const beats = [30, 60, 90];
  it('1 na batida e decai; 0 antes da primeira', () => {
    expect(beatPulse(10, beats, 8)).toBe(0);
    expect(beatPulse(30, beats, 8)).toBe(1);
    expect(beatPulse(34, beats, 8)).toBeCloseTo(Math.exp(-0.5), 6);
    expect(beatPulse(34, beats, 8)).toBeLessThan(beatPulse(31, beats, 8));
    expect(beatPulse(60, beats, 8)).toBe(1);
  });
  it('lista vazia', () => {
    expect(beatPulse(10, [], 8)).toBe(0);
  });
});

describe('lyricAt', () => {
  it('verso atual com progresso; some fora da janela; entra um pouco antes', () => {
    expect(lyricAt(plan, 10)).toBeNull();
    const early = lyricAt(plan, 55);
    expect(early?.index).toBe(0);
    const mid = lyricAt(plan, 90);
    expect(mid?.index).toBe(0);
    expect(mid?.progress).toBeCloseTo(0.5, 6);
    expect(lyricAt(plan, 150)).toBeNull();
    expect(lyricAt(plan, 205)?.index).toBe(1);
  });
});

describe('wordStates', () => {
  it('palavra dita, em curso e por vir', () => {
    const line = plan.lyrics[0]!;
    expect(wordStates(line, 90).map((word) => word.state)).toEqual(['done', 'active', 'next']);
    expect(wordStates(line, 50).map((word) => word.state)).toEqual(['next', 'next', 'next']);
    expect(wordStates(line, 130).map((word) => word.state)).toEqual(['done', 'done', 'done']);
  });
});

describe('sceneAt', () => {
  const scenes = { scenes: [{ startFrame: 0, endFrame: 100, motif: 'night', keyword: null, variant: 0 }, { startFrame: 100, endFrame: 300, motif: 'phone', keyword: 'mensagem', variant: 1 }] } as unknown as MusicPlan;
  it('acha a cena, os quadros dentro dela e o progresso', async () => {
    const { sceneAt } = await import('../motion/src/music/visuals.ts');
    expect(sceneAt(scenes, 0)).toMatchObject({ index: 0, local: 0, progress: 0 });
    expect(sceneAt(scenes, 150)).toMatchObject({ index: 1, local: 50, duration: 200, progress: 0.25 });
    expect(sceneAt(scenes, 9999).index).toBe(1);
    expect(sceneAt(scenes, -5).index).toBe(0);
  });
});
