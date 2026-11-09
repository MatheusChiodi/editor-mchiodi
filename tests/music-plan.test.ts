import { describe, expect, it } from 'vitest';

import { BARS, type AudioFeatures } from '../src/music/features.ts';
import { buildMusicPlan, PALETTES } from '../src/music/plan.ts';
import type { Section } from '../src/music/sections.ts';
import type { Tempo } from '../src/music/tempo.ts';

const fps = 30;
const frames = 600;
const series = (value: number) => new Array<number>(frames).fill(value);
const features: AudioFeatures = {
  fps,
  frames,
  durationSec: 20,
  bass: series(0.123456),
  mid: series(0.5),
  treble: series(0.25),
  rms: series(0.4),
  bars: Array.from({ length: frames }, () => new Array<number>(BARS).fill(0.33333)),
};
const tempo: Tempo = { bpm: 120, offsetSec: 0.25, beats: [0.25, 0.75, 1.25, 25], downbeats: [0.25, 25], confidence: 0.9 };
const sections: Section[] = [
  { start: 0, end: 8, energy: 'low', mean: 0.2 },
  { start: 8, end: 14, energy: 'high', mean: 0.9 },
  { start: 14, end: 20, energy: 'high', mean: 0.8 },
];

describe('buildMusicPlan', () => {
  const plan = buildMusicPlan({
    title: 'Minha música',
    size: { width: 1920, height: 1080 },
    features,
    tempo,
    sections,
    lyrics: [{ text: 'eu vou', start: 1, end: 2, words: [{ text: 'eu', start: 1, end: 1.5 }, { text: 'vou', start: 1.5, end: 2 }] }],
  });

  it('copia o quadro, o tamanho e o tempo', () => {
    expect(plan).toMatchObject({ title: 'Minha música', fps: 30, width: 1920, height: 1080, durationInFrames: 600, bpm: 120 });
  });
  it('batidas em quadros; as que passam do fim são descartadas', () => {
    expect(plan.beats).toEqual([8, 23, 38]);
    expect(plan.downbeats).toEqual([8]);
  });
  it('seções contíguas em quadros, até o último', () => {
    expect(plan.sections.map((s) => [s.startFrame, s.endFrame])).toEqual([[0, 240], [240, 420], [420, 600]]);
    expect(plan.sections.map((s) => s.energy)).toEqual(['low', 'high', 'high']);
  });
  it('duas seções altas seguidas não repetem a paleta', () => {
    expect(plan.sections[1]!.palette).not.toEqual(plan.sections[2]!.palette);
    for (const section of plan.sections) for (const color of section.palette) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(PALETTES.high.length).toBeGreaterThanOrEqual(2);
  });
  it('séries por quadro arredondadas (plano leve) e barras no formato certo', () => {
    expect(plan.bass).toHaveLength(600);
    expect(plan.bass[0]).toBe(0.123);
    expect(plan.bars).toHaveLength(600);
    expect(plan.bars[0]).toHaveLength(BARS);
    expect(plan.bars[0]![0]).toBe(0.33);
  });
  it('letra em quadros, com as palavras', () => {
    expect(plan.lyrics).toEqual([
      { text: 'eu vou', startFrame: 30, endFrame: 60, words: [{ text: 'eu', startFrame: 30, endFrame: 45 }, { text: 'vou', startFrame: 45, endFrame: 60 }] },
    ]);
  });
  it('sem letra e sem seções ainda gera um plano válido (instrumental curto)', () => {
    const bare = buildMusicPlan({ title: 'x', size: { width: 1080, height: 1920 }, features, tempo: { ...tempo, beats: [], downbeats: [], bpm: 0 }, sections: [], lyrics: [] });
    expect(bare.lyrics).toEqual([]);
    expect(bare.sections).toHaveLength(1);
    expect(bare.sections[0]).toMatchObject({ startFrame: 0, endFrame: 600 });
  });
});

describe('buildMusicPlan: cenas', () => {
  const base = { title: '', size: { width: 1920, height: 1080 }, features, tempo, sections, lyrics: [] };
  it('sem cenas planejadas, uma cena de reserva cobre a música', () => {
    expect(buildMusicPlan(base).scenes).toEqual([{ startFrame: 0, endFrame: 600, motif: 'blob', keyword: null, variant: 0 }]);
  });
  it('cenas viram quadros, contíguas até o último quadro', () => {
    const plan = buildMusicPlan({
      ...base,
      scenes: [
        { start: 0, end: 8.02, motif: 'phone', keyword: 'mensagem', variant: 0 },
        { start: 8.02, end: 19.9, motif: 'heart', keyword: null, variant: 1 },
      ],
    });
    expect(plan.scenes).toEqual([
      { startFrame: 0, endFrame: 241, motif: 'phone', keyword: 'mensagem', variant: 0 },
      { startFrame: 241, endFrame: 600, motif: 'heart', keyword: null, variant: 1 },
    ]);
  });
});
