import { describe, expect, it } from 'vitest';

import { CAMERA_IDS, MOOD_IDS, POSE_IDS, PROP_IDS, SETTING_IDS, TIME_IDS, TRANSITION_IDS, WEATHER_IDS } from '../motion/src/music/types.ts';
import type { LyricLine } from '../src/music/lyrics.ts';
import type { Section } from '../src/music/sections.ts';
import { planStory } from '../src/music/story.ts';

const DURATION = 120;
const sections: Section[] = [
  { start: 0, end: 20, energy: 'low', mean: 0.2 },
  { start: 20, end: 50, energy: 'mid', mean: 0.5 },
  { start: 50, end: 95, energy: 'high', mean: 0.9 },
  { start: 95, end: DURATION, energy: 'low', mean: 0.2 },
];
const beats = Array.from({ length: DURATION * 2 }, (_, i) => i * 0.5);
const downbeats = Array.from({ length: DURATION / 2 }, (_, i) => i * 2);
const line = (text: string, start: number, end: number): LyricLine => ({ text, start, end, words: [] });
const lyrics = [
  line('Tento te mandar uma mensagem', 22, 25),
  line('Mas apago antes de enviar', 25.5, 28.5),
  line('Se o peito tá cheio de texto', 31, 34),
  line('Vejo suas fotos recentes', 40, 43),
  line('Dói saber que a culpa é minha por não ir além', 56, 60),
  line('Eu gritava pro mundo inteiro o teu nome', 64, 68),
  line('Se eu pudesse voltar atrás', 72, 75),
  line('Quando amanhecer eu vou seguir', 100, 104),
];
const plan = (overrides: Partial<Parameters<typeof planStory>[0]> = {}) => planStory({ lyrics, sections, durationSec: DURATION, beats, downbeats, ...overrides });

describe('planStory: ritmo cinematográfico', () => {
  const scenes = plan();

  it('cobre a música inteira sem buracos', () => {
    expect(scenes[0]!.start).toBe(0);
    expect(scenes.at(-1)!.end).toBe(DURATION);
    scenes.forEach((scene, i) => {
      expect(scene.end).toBeGreaterThan(scene.start);
      if (i > 0) expect(scene.start).toBeCloseTo(scenes[i - 1]!.end, 6);
    });
  });
  it('muitas cenas curtas (nada de plano parado), nenhuma comprida', () => {
    expect(scenes.length).toBeGreaterThanOrEqual(DURATION / 5);
    for (const scene of scenes) {
      expect(scene.end - scene.start).toBeGreaterThanOrEqual(1.59);
      expect(scene.end - scene.start).toBeLessThanOrEqual(6.5);
    }
  });
  it('os cortes caem nas batidas', () => {
    const cuts = scenes.slice(1).map((scene) => scene.start);
    const onBeat = cuts.filter((cut) => beats.some((beat) => Math.abs(beat - cut) < 1e-6));
    expect(onBeat.length / cuts.length).toBeGreaterThanOrEqual(0.8);
  });
  it('no trecho forte os planos são mais curtos que no calmo', () => {
    const mean = (from: number, to: number) => {
      const inside = scenes.filter((scene) => scene.start >= from && scene.end <= to);
      return inside.reduce((sum, scene) => sum + (scene.end - scene.start), 0) / inside.length;
    };
    expect(mean(55, 90)).toBeLessThan(mean(0, 20) - 0.5);
  });
});

describe('planStory: a história', () => {
  const scenes = plan();
  const stories = scenes.filter((scene) => scene.motif === 'story');
  const firstIndex = (setting: string) => stories.findIndex((scene) => scene.shot!.setting === setting);

  it('começa na janela com chuva (sem personagem) e termina ao amanhecer, com esperança', () => {
    expect(stories[0]!.shot).toMatchObject({ setting: 'window', time: 'night', weather: 'rain' });
    const last = stories.at(-1)!.shot!;
    expect(last.setting).toBe('hills');
    expect(last.time).toBe('dawn');
    expect(['hopeful', 'smile']).toContain(last.mood);
  });
  it('o arco passa por quarto, rua, telhado, praça e colinas, nessa ordem', () => {
    const order = ['bedroom', 'street', 'rooftop', 'park', 'hills'].map(firstIndex);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it('o começo é triste e o clímax chora; ninguém chora no primeiro ato', () => {
    const early = stories.filter((scene) => scene.start > 3 && scene.start < 30);
    expect(early.length).toBeGreaterThan(0);
    for (const scene of early) expect(scene.shot!.mood).not.toBe('cry');
    const climax = stories.filter((scene) => scene.start >= 66 && scene.start < 88);
    expect(climax.some((scene) => scene.shot!.mood === 'cry' || scene.shot!.mood === 'angry')).toBe(true);
    expect(climax.every((scene) => scene.shot!.setting === 'rooftop' || scene.shot!.setting === 'street')).toBe(true);
  });
  it('a letra manda: "mensagem" põe o celular na mão ou vira o inseto do celular', () => {
    const covering = scenes.filter((scene) => scene.start < 25 && scene.end > 23);
    expect(covering.length).toBeGreaterThan(0);
    const usesPhone = covering.some((scene) => scene.motif === 'phone' || scene.shot?.props.includes('phone') || ['phone', 'typing'].includes(scene.shot?.pose ?? ''));
    expect(usesPhone).toBe(true);
  });
  it('"fotos" aparece como foto na mão ou como ilustração de fotos', () => {
    const covering = scenes.filter((scene) => scene.start < 43 && scene.end > 40);
    expect(covering.some((scene) => scene.motif === 'photos' || scene.shot?.props.includes('photo'))).toBe(true);
  });
  it('há ilustrações intercaladas entre os planos, nunca duas seguidas', () => {
    const inserts = scenes.filter((scene) => scene.motif !== 'story');
    expect(inserts.length).toBeGreaterThanOrEqual(3);
    scenes.forEach((scene, i) => {
      if (i > 0 && scene.motif !== 'story') expect(scenes[i - 1]!.motif).toBe('story');
    });
  });
  it('plano de história sempre tem shot válido; ilustração não tem', () => {
    for (const scene of scenes) {
      if (scene.motif === 'story') {
        const s = scene.shot!;
        expect(SETTING_IDS).toContain(s.setting);
        expect(TIME_IDS).toContain(s.time);
        expect(WEATHER_IDS).toContain(s.weather);
        expect(POSE_IDS).toContain(s.pose);
        expect(MOOD_IDS).toContain(s.mood);
        for (const prop of s.props) expect(PROP_IDS).toContain(prop);
      } else {
        expect(scene.shot).toBeUndefined();
      }
    }
  });
});

describe('planStory: câmera e transições', () => {
  const scenes = plan();
  it('toda cena tem câmera e transição válidas, com variedade', () => {
    for (const scene of scenes) {
      expect(CAMERA_IDS).toContain(scene.camera);
      expect(TRANSITION_IDS).toContain(scene.transition);
    }
    expect(new Set(scenes.map((scene) => scene.camera)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(scenes.map((scene) => scene.transition)).size).toBeGreaterThanOrEqual(4);
  });
  it('a primeira cena entra com fade; a fronteira de seção usa cortina', () => {
    expect(scenes[0]!.transition).toBe('fade');
    const atSection = scenes.find((scene) => scene.start === 50 || Math.abs(scene.start - 50) < 1e-6);
    expect(atSection?.transition).toBe('wipe');
  });
  it('o clímax aproxima a câmera', () => {
    const climax = scenes.filter((scene) => scene.motif === 'story' && scene.start >= 66 && scene.start < 88);
    expect(climax.filter((scene) => scene.camera === 'push' || scene.camera === 'orbit').length).toBeGreaterThanOrEqual(climax.length / 2);
  });
});

describe('planStory: robustez', () => {
  it('é determinístico', () => {
    expect(plan()).toEqual(plan());
  });
  it('funciona sem letra e sem batidas (instrumental)', () => {
    const bare = plan({ lyrics: [], beats: [], downbeats: [] });
    expect(bare[0]!.start).toBe(0);
    expect(bare.at(-1)!.end).toBe(DURATION);
    expect(bare.length).toBeGreaterThanOrEqual(DURATION / 5);
    expect(bare.some((scene) => scene.motif === 'story')).toBe(true);
  });
  it('música curtíssima vira uma cena só', () => {
    const tiny = planStory({ lyrics: [], sections: [{ start: 0, end: 2, energy: 'mid', mean: 0.5 }], durationSec: 2, beats: [], downbeats: [] });
    expect(tiny).toHaveLength(1);
    expect(tiny[0]).toMatchObject({ start: 0, end: 2 });
  });
});
