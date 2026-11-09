import { describe, expect, it } from 'vitest';

import type { MusicPlan } from '../motion/src/music/types.ts';
import { describeScenes, mergeScenes, setSceneMotif, splitScene } from '../src/music/edit.ts';

const plan = {
  fps: 30,
  durationInFrames: 900,
  scenes: [
    { startFrame: 0, endFrame: 300, motif: 'night', keyword: null, variant: 0 },
    { startFrame: 300, endFrame: 600, motif: 'phone', keyword: 'mensagem', variant: 0 },
    { startFrame: 600, endFrame: 900, motif: 'heart', keyword: null, variant: 1 },
  ],
  lyrics: [
    { text: 'Tento te mandar uma mensagem', startFrame: 320, endFrame: 400, words: [] },
    { text: 'Mas apago antes de enviar', startFrame: 420, endFrame: 500, words: [] },
    { text: 'Se o peito tá cheio de texto', startFrame: 620, endFrame: 700, words: [] },
  ],
} as unknown as MusicPlan;

describe('describeScenes', () => {
  it('numera a partir de 1, com tempo em segundos e os versos de cada cena', () => {
    const rows = describeScenes(plan);
    expect(rows.map((row) => row.n)).toEqual([1, 2, 3]);
    expect(rows[1]).toMatchObject({ start: 10, end: 20, motif: 'phone', keyword: 'mensagem' });
    expect(rows[1]!.lyric).toBe('Tento te mandar uma mensagem / Mas apago antes de enviar');
    expect(rows[0]!.lyric).toBe('');
  });
});

describe('setSceneMotif', () => {
  it('troca o motivo e a palavra, sem mexer nas outras cenas nem no plano original', () => {
    const next = setSceneMotif(plan, 2, 'rain', 'chuva');
    expect(next.scenes[1]).toMatchObject({ motif: 'rain', keyword: 'chuva', startFrame: 300, endFrame: 600 });
    expect(next.scenes[0]).toEqual(plan.scenes[0]);
    expect(plan.scenes[1]!.motif).toBe('phone');
  });
  it('sem palavra nova mantém a antiga; null apaga', () => {
    expect(setSceneMotif(plan, 2, 'rain').scenes[1]!.keyword).toBe('mensagem');
    expect(setSceneMotif(plan, 2, 'rain', null).scenes[1]!.keyword).toBeNull();
  });
  it('recusa cena e motivo que não existem', () => {
    expect(() => setSceneMotif(plan, 0, 'rain')).toThrow(/cena 0/);
    expect(() => setSceneMotif(plan, 4, 'rain')).toThrow(/cena 4/);
    expect(() => setSceneMotif(plan, 1, 'foguete' as never)).toThrow(/foguete/);
  });
});

describe('splitScene', () => {
  it('divide no instante e a segunda metade muda de variante', () => {
    const next = splitScene(plan, 2, 15);
    expect(next.scenes).toHaveLength(4);
    expect(next.scenes[1]).toMatchObject({ startFrame: 300, endFrame: 450, motif: 'phone', variant: 0 });
    expect(next.scenes[2]).toMatchObject({ startFrame: 450, endFrame: 600, motif: 'phone', variant: 1 });
  });
  it('recusa instante fora da cena ou colado nas bordas', () => {
    expect(() => splitScene(plan, 2, 5)).toThrow(/dentro/);
    expect(() => splitScene(plan, 2, 10.2)).toThrow(/dentro/);
    expect(() => splitScene(plan, 2, 19.9)).toThrow(/dentro/);
  });
});

describe('mergeScenes', () => {
  it('junta a cena com a seguinte, mantendo o motivo da primeira', () => {
    const next = mergeScenes(plan, 1);
    expect(next.scenes).toHaveLength(2);
    expect(next.scenes[0]).toMatchObject({ startFrame: 0, endFrame: 600, motif: 'night' });
  });
  it('a última não tem seguinte', () => {
    expect(() => mergeScenes(plan, 3)).toThrow(/seguinte/);
  });
});
