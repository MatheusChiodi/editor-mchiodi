import { describe, expect, it } from 'vitest';

import { isNativeCrash, transcribeArgs } from '../src/analyze/transcribe.ts';
import { configSchema } from '../src/config.ts';
import { edlSchema, type Zoom } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { gradeFilters, placeZooms, zoomEnvelope, zoomFilters } from '../src/render/video.ts';

const grade = edlSchema.shape.grade;

describe('gradeFilters', () => {
  it('"none" sem ajustes não aplica nada', () => {
    expect(gradeFilters(grade.parse({ preset: 'none' }))).toEqual([]);
  });

  it('o preset neutro é um eq leve', () => {
    expect(gradeFilters(grade.parse({}))).toEqual(['eq=contrast=1.04:saturation=1.06']);
  });

  it('combina exposição, LUT (com caminho escapado), preset e nitidez na ordem certa', () => {
    const filters = gradeFilters(grade.parse({ preset: 'warm', exposure: 0.2, lut: 'D:\\luts\\canal.cube', contrast: 1.1, sharpen: 0.5 }));
    expect(filters.map((filter) => filter.split('=')[0])).toEqual(['exposure', 'lut3d', 'eq', 'colorbalance', 'unsharp']);
    expect(filters[1]).toBe("lut3d=file='D\\:/luts/canal.cube'");
    expect(filters[2]).toBe('eq=contrast=1.155:saturation=1.08');
  });
});

describe('zoom', () => {
  const timeline = buildTimeline(
    [
      { id: 'c1', start: 0, end: 10 },
      { id: 'c2', start: 20, end: 30 },
    ],
    30,
  );
  const zoom = (extra: Partial<Zoom>): Zoom => ({
    id: 'z', at: 2, duration: 3, scale: 1.15, focus: { x: 0.5, y: 0.4 }, mode: 'ease', reason: '', ...extra,
  });

  it('coloca o zoom no tempo de saída e o encerra no corte', () => {
    expect(placeZooms([zoom({ at: 22 })], timeline)[0]).toMatchObject({ start: 12, end: 15 });
    expect(placeZooms([zoom({ at: 8, duration: 5 })], timeline)[0]).toMatchObject({ start: 8, end: 10 });
  });

  it('descarta zoom em trecho cortado ou curto demais', () => {
    expect(placeZooms([zoom({ at: 15 })], timeline)).toEqual([]);
    expect(placeZooms([zoom({ at: 9.9, duration: 4 })], timeline)).toEqual([]);
  });

  it('gera um envelope por modo', () => {
    const [placed] = placeZooms([zoom({})], timeline);
    expect(zoomEnvelope({ ...placed!, mode: 'punch' })).toBe('between(t,2,5)');
    expect(zoomEnvelope({ ...placed!, mode: 'ken-burns' })).toBe('(between(t,2,5)*clip((t-2)/3,0,1))');
    const ease = zoomEnvelope(placed!);
    expect(ease).toContain('clip((t-2)/0.4,0,1)');
    expect(ease).toContain('clip((t-4.6)/0.4,0,1)');
  });

  it('sem zoom não gera filtro; com zoom gera scale por frame + crop em função de t', () => {
    expect(zoomFilters([], 1920, 1080)).toEqual([]);
    const [scale, crop] = zoomFilters(placeZooms([zoom({}), zoom({ id: 'z2', at: 24, focus: { x: 0.3, y: 0.5 } })], timeline), 1920, 1080);
    expect(scale).toContain('eval=frame');
    expect(scale).toContain("w='trunc(1920*(1+0.15*");
    expect(crop).toMatch(/^crop=1920:1080:x='1920\*/);
    expect(crop).toContain('0.3*between(t,14,17)');
    expect(crop).not.toContain('iw');
  });
});

describe('transcribe (wrapper)', () => {
  it('reconhece queda nativa do processo no Windows', () => {
    expect(isNativeCrash(0xc000070a)).toBe(true);
    expect(isNativeCrash(null)).toBe(true);
    expect(isNativeCrash(1)).toBe(false);
    expect(isNativeCrash(2)).toBe(false);
  });

  it('só passa --prompt quando configurado (o padrão é vazio)', () => {
    const config = configSchema.parse({}).transcribe;
    const args = transcribeArgs('a.wav', 'w.json', config);
    expect(args).not.toContain('--prompt');
    expect(args.slice(1, 5)).toEqual(['--input', 'a.wav', '--output', 'w.json']);
    expect(transcribeArgs('a.wav', 'w.json', { ...config, prompt: 'React, Vite' })).toContain('React, Vite');
  });
});
