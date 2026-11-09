import { describe, expect, it } from 'vitest';

import type { LyricLine } from '../src/music/lyrics.ts';
import { MOTIF_IDS, motifForText, planScenes } from '../src/music/scenes.ts';
import type { Section } from '../src/music/sections.ts';

const line = (text: string, start: number, end: number): LyricLine => ({ text, start, end, words: [] });

describe('motifForText (o que o verso conta vira o motivo da cena)', () => {
  it('mensagem e celular', () => {
    expect(motifForText('Tento te mandar uma mensagem')).toMatchObject({ motif: 'phone', keyword: 'mensagem' });
    expect(motifForText('Mas apago antes de enviar')?.motif).toBe('phone');
  });
  it('frase vale mais que palavra solta: "bom dia" ganha de "dói"', () => {
    expect(motifForText("Dói saber que o seu 'bom dia' agora é de outro alguém")).toMatchObject({ motif: 'morning' });
  });
  it('empate resolve pela ordem de prioridade (caminho antes de dor)', () => {
    expect(motifForText('Dói saber que a culpa é minha por não ir além')?.motif).toBe('road');
  });
  it('outros temas da letra', () => {
    expect(motifForText('Vejo suas fotos recentes')?.motif).toBe('photos');
    expect(motifForText('E rasgar esse meu orgulho')?.motif).toBe('paper');
    expect(motifForText('Se eu pudesse voltar atrás')?.motif).toBe('clock');
    expect(motifForText('Desse silêncio covarde e fatal')?.motif).toBe('night');
    expect(motifForText('Se o peito tá cheio de texto')?.motif).toBe('heart');
    expect(motifForText('Eu gritava pro mundo inteiro o teu nome')?.motif).toBe('shout');
    expect(motifForText('Chorei de noite com a chuva')?.motif).toBe('rain');
  });
  it('sem palavra conhecida devolve null', () => {
    expect(motifForText('blá blá blá')).toBeNull();
    expect(motifForText('')).toBeNull();
  });
  it('todo motivo da lista é reconhecível por pelo menos uma palavra (exceto os de fallback)', () => {
    expect(MOTIF_IDS).toEqual(expect.arrayContaining(['phone', 'heart', 'night', 'morning', 'photos', 'clock', 'rain', 'road', 'shout', 'paper', 'words', 'burst', 'blob']));
  });
});

describe('planScenes', () => {
  const sections: Section[] = [
    { start: 0, end: 16, energy: 'low', mean: 0.2 },
    { start: 16, end: 40, energy: 'mid', mean: 0.5 },
    { start: 40, end: 60, energy: 'high', mean: 0.9 },
  ];
  const lyrics = [
    line('Tento te mandar uma mensagem', 16, 19),
    line('Mas apago antes de enviar', 19.5, 22),
    line('Se o peito tá cheio de texto', 23, 26),
    line('Vejo suas fotos recentes', 41, 44),
    line('Dói saber', 44.5, 46),
  ];
  const scenes = planScenes({ lyrics, sections, durationSec: 60 });

  it('cobre a música inteira sem buracos', () => {
    expect(scenes[0]!.start).toBe(0);
    expect(scenes.at(-1)!.end).toBe(60);
    scenes.forEach((scene, i) => {
      expect(scene.end).toBeGreaterThan(scene.start);
      if (i > 0) expect(scene.start).toBeCloseTo(scenes[i - 1]!.end, 6);
    });
  });
  it('nenhuma cena fica mais longa que o teto nem mais curta que o piso', () => {
    for (const scene of scenes) {
      expect(scene.end - scene.start).toBeLessThanOrEqual(8.001);
      expect(scene.end - scene.start).toBeGreaterThanOrEqual(2.499);
    }
  });
  it('versos seguidos do mesmo tema viram uma cena só', () => {
    const phone = scenes.filter((scene) => scene.motif === 'phone');
    expect(phone).toHaveLength(1);
    expect(phone[0]!.start).toBeLessThanOrEqual(16.5);
    expect(phone[0]!.end).toBeGreaterThanOrEqual(22);
  });
  it('instrumental recebe motivo pela energia da seção; verso sem tema herda ou cai em palavras', () => {
    expect(scenes[0]!.motif).toBe('night');
    const gap = scenes.find((scene) => scene.start <= 30 && scene.end > 30)!;
    expect(['heart', 'night', 'blob', 'words']).toContain(gap.motif);
    expect(scenes.some((scene) => scene.motif === 'photos')).toBe(true);
  });
  it('cena longa é dividida e cada pedaço tem uma variante diferente', () => {
    const long = planScenes({ lyrics: [line('Tento te mandar uma mensagem', 0, 3), line('Mas apago antes de enviar', 3, 30)], sections: [{ start: 0, end: 30, energy: 'mid', mean: 0.5 }], durationSec: 30 });
    const phone = long.filter((scene) => scene.motif === 'phone');
    expect(phone.length).toBeGreaterThanOrEqual(4);
    expect(new Set(phone.slice(0, 3).map((scene) => scene.variant)).size).toBe(3);
  });
  it('é determinístico e funciona sem letra (instrumental)', () => {
    expect(planScenes({ lyrics, sections, durationSec: 60 })).toEqual(scenes);
    const bare = planScenes({ lyrics: [], sections, durationSec: 60 });
    expect(bare[0]!.start).toBe(0);
    expect(bare.at(-1)!.end).toBe(60);
    expect(bare.map((scene) => scene.motif)).not.toContain('phone');
  });
  it('duração curtíssima vira uma cena só', () => {
    const tiny = planScenes({ lyrics: [], sections: [{ start: 0, end: 2, energy: 'mid', mean: 0.5 }], durationSec: 2 });
    expect(tiny).toHaveLength(1);
    expect(tiny[0]).toMatchObject({ start: 0, end: 2 });
  });
});
