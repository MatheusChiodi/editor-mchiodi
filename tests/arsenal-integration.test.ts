import { describe, expect, it } from 'vitest';

import { entrances } from '../motion/src/arsenal/entrances.ts';
import { fxVariants } from '../motion/src/arsenal/fx/Fx.tsx';
import { stingerVariants } from '../motion/src/arsenal/stingers/Stinger.tsx';
import { registry } from '../motion/src/components/registry.ts';
import { DEFAULT_ENTRANCE, fitSize, placement, resolveEntrance, TEXT_SIZES } from '../motion/src/components/TextReveal.tsx';
import type { Transcript } from '../src/analyze/types.ts';
import { ARSENAL_KINDS, catalog, counts, formatCatalog, search } from '../src/arsenal/catalog.ts';
import { representativeFrame, sheetPages, xstackLayout } from '../src/arsenal/gallery.ts';
import { effects } from '../src/arsenal/effects.ts';
import { transitions } from '../src/arsenal/transitions.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { collectSfx } from '../src/render/audio.ts';
import { buildCutGraph, planTransitions, transitionDuration } from '../src/render/cuts.ts';
import { effectFilters, effectOverlays, placeEffects } from '../src/render/effects.ts';
import { buildOverlayProps, stingerItems } from '../src/render/overlay.ts';

const firstOf = (kind: 'filter' | 'overlay') => Object.values(effects).find((preset) => preset.kind === kind)!;
const wholeVideo = Object.values(effects).find((preset) => preset.defaultDuration === null)!;
const stinger = Object.values(transitions).find((preset) => preset.kind === 'stinger')!;

function edlWith(extra: Record<string, unknown>) {
  return edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-12T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 120, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [
      { id: 'c1', start: 0, end: 20 },
      { id: 'c2', start: 30, end: 60 },
      { id: 'c3', start: 70, end: 100 },
    ],
    ...extra,
  });
}

describe('arsenal: tamanho do catálogo', () => {
  it('tem ao menos 50 modelos em cada categoria', () => {
    const totals = counts();
    expect(Object.keys(entrances)).toHaveLength(50);
    expect(Object.keys(transitions)).toHaveLength(50);
    expect(Object.keys(effects)).toHaveLength(50);
    expect(totals.entrances).toBe(50);
    expect(totals.transitions).toBe(50);
    expect(totals.effects).toBe(50);
    expect(totals.components).toBeGreaterThanOrEqual(50);
  });

  it('todo item explica quando usar e como entra na EDL', () => {
    for (const kind of ARSENAL_KINDS) {
      const items = catalog(kind);
      expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
      for (const item of items) {
        expect(item.description.length, `${kind}/${item.id}`).toBeGreaterThan(10);
        expect(item.usage).toContain(item.id);
      }
    }
  });

  it('componentes internos não aparecem para o diretor', () => {
    const ids = catalog('components').map((item) => item.id);
    for (const hidden of ['Stinger', 'Fx', 'Intro', 'Outro']) expect(ids).not.toContain(hidden);
    expect(ids).toContain('TextReveal');
  });

  it('busca sem acento nem caixa, exigindo todos os termos', () => {
    const items = catalog('transitions');
    expect(search(items, '').length).toBe(items.length);
    expect(search(items, 'DISSOLUCAO').map((item) => item.id)).toContain('cross-dissolve');
    expect(search(items, 'stinger').every((item) => item.group.includes('stinger'))).toBe(true);
    expect(search(items, 'xyzzy inexistente')).toEqual([]);
    expect(formatCatalog(items.slice(0, 1), true)).toContain('transitions[]');
    expect(formatCatalog(items.slice(0, 2), false).split('\n')).toHaveLength(2);
  });
});

describe('arsenal: o que o catálogo promete existe no motor', () => {
  it('toda stinger e todo efeito de overlay têm variante implementada, e os componentes estão registrados', () => {
    for (const preset of Object.values(transitions)) {
      if (preset.kind === 'stinger') expect(stingerVariants, preset.id).toContain(preset.stinger!.variant);
    }
    for (const preset of Object.values(effects)) {
      if (preset.kind === 'overlay') expect(fxVariants, preset.id).toContain(preset.overlay!.variant);
    }
    expect(registry.Stinger).toBeDefined();
    expect(registry.Fx).toBeDefined();
  });
});

describe('transições na EDL', () => {
  it('o schema aceita qualquer id do catálogo e recusa o que não existe', () => {
    for (const id of Object.keys(transitions)) {
      expect(edlSchema.safeParse({ ...edlWith({}), transitions: [{ id: 't1', intoClip: 'c2', type: id }] }).success, id).toBe(true);
    }
    expect(edlSchema.safeParse({ ...edlWith({}), transitions: [{ id: 't1', intoClip: 'c2', type: 'estrelinhas' }] }).success).toBe(false);
  });

  it('sem duração, vale a padrão do preset', () => {
    expect(transitionDuration({ type: 'cross-dissolve' })).toBe(transitions['cross-dissolve']!.defaultDuration);
    expect(transitionDuration({ type: 'cross-dissolve', duration: 0.9 })).toBe(0.9);
  });

  it('stinger não mexe no corte do ffmpeg e vira um overlay centrado no corte', () => {
    const edl = edlWith({
      transitions: [
        { id: 't-x', intoClip: 'c2', type: 'cross-dissolve', duration: 0.4 },
        { id: 't-s', intoClip: 'c3', type: stinger.id, duration: 0.6 },
      ],
    });
    const timeline = buildTimeline(edl.clips, 30);
    const options = { fps: 30, width: 1920, height: 1080, fadeMs: 12, transitions: edl.transitions, sourceFrames: 3600 };
    expect(planTransitions(timeline, options).map((item) => item.index)).toEqual([1]);
    expect((buildCutGraph(timeline, options).match(/xfade=/g) ?? []).length).toBe(1);

    const items = stingerItems(edl, timeline);
    // o corte para c3 cai em 50 s = frame 1500; 18 frames de duração, metade antes
    expect(items).toEqual([
      { id: 't-s', component: 'Stinger', from: 1491, durationInFrames: 18, props: { variant: stinger.stinger!.variant }, hidesCaptions: true },
    ]);
    const props = buildOverlayProps(edl, timeline, { words: [] } as unknown as Transcript);
    expect(props.overlays.at(-1)!.component).toBe('Stinger');
  });

  it('o SFX segue o que o preset pede', () => {
    const quiet = Object.values(transitions).find((preset) => preset.sfx === null)!;
    const loud = Object.values(transitions).find((preset) => preset.sfx === 'whoosh')!;
    const edl = edlWith({
      transitions: [
        { id: 't1', intoClip: 'c2', type: quiet.id },
        { id: 't2', intoClip: 'c3', type: loud.id },
      ],
    });
    const cues = collectSfx(edl, buildTimeline(edl.clips, 30), (file) => file);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.file).toBe('whoosh.wav');
    expect(cues[0]!.at).toBeCloseTo(50 - loud.defaultDuration / 2, 3);
  });
});

describe('efeitos na EDL', () => {
  const filter = firstOf('filter');
  const overlay = firstOf('overlay');

  it('o schema aceita qualquer id do catálogo, recusa desconhecido e âncora em trecho cortado', () => {
    for (const id of Object.keys(effects)) {
      expect(edlSchema.safeParse({ ...edlWith({}), effects: [{ id: 'e1', preset: id, at: 5 }] }).success, id).toBe(true);
    }
    expect(edlSchema.safeParse({ ...edlWith({}), effects: [{ id: 'e1', preset: 'nao-existe', at: 5 }] }).success).toBe(false);
    expect(edlSchema.safeParse({ ...edlWith({}), effects: [{ id: 'e1', preset: filter.id, at: 25 }] }).success).toBe(false);
  });

  it('coloca no tempo de saída com duração e intensidade padrão do preset', () => {
    const edl = edlWith({
      effects: [
        { id: 'e-late', preset: filter.id, at: 35, duration: 2, intensity: 0.8 },
        { id: 'e-default', preset: filter.id, at: 5 },
        { id: 'e-whole', preset: wholeVideo.id, at: 1 },
      ],
    });
    const timeline = buildTimeline(edl.clips, 30);
    const placed = placeEffects(edl.effects, timeline);
    expect(placed.map((effect) => effect.id)).toEqual(['e-whole', 'e-default', 'e-late']);
    expect(placed[0]).toMatchObject({ start: 1, end: timeline.durationSec, intensity: wholeVideo.defaultIntensity });
    expect(placed[2]).toMatchObject({ start: 25, end: 27, intensity: 0.8 });
    if (filter.defaultDuration !== null) expect(placed[1]!.end - placed[1]!.start).toBeCloseTo(filter.defaultDuration, 6);
  });

  it('efeito de filtro vira filtro do ffmpeg; efeito de overlay vira item do componente Fx', () => {
    const edl = edlWith({
      effects: [
        { id: 'e-f', preset: filter.id, at: 5, duration: 2 },
        { id: 'e-o', preset: overlay.id, at: 40, duration: 3, focus: { x: 0.3, y: 0.6 } },
      ],
    });
    const timeline = buildTimeline(edl.clips, 30);
    const placed = placeEffects(edl.effects, timeline);
    const filters = effectFilters(placed, { width: 1920, height: 1080 }, 30);
    expect(filters.length).toBeGreaterThan(0);
    expect(filters.join(',')).not.toMatch(/NaN|undefined/);
    const items = effectOverlays(placed, 30, 2400);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'e-o', component: 'Fx', from: 900, durationInFrames: 90, hidesCaptions: false });
    expect(items[0]!.props).toMatchObject({ variant: overlay.overlay!.variant, focus: { x: 0.3, y: 0.6 } });
    // na camada de gráficos, o efeito fica por baixo dos demais overlays
    const props = buildOverlayProps(
      edlWith({ effects: edl.effects, overlays: [{ id: 'o1', component: 'LowerThird', at: 41, duration: 3, reason: 'nome' }] }),
      timeline,
      { words: [] } as unknown as Transcript,
    );
    expect(props.overlays.map((item) => item.component)).toEqual(['Fx', 'LowerThird']);
  });
});

describe('TextReveal', () => {
  it('usa o efeito pedido e cai no padrão quando o id não existe', () => {
    expect(resolveEntrance('words-rise')).toBe('words-rise');
    expect(resolveEntrance('nao-existe')).toBe(DEFAULT_ENTRANCE);
    expect(resolveEntrance(undefined)).toBe(DEFAULT_ENTRANCE);
    expect(resolveEntrance('x', { outro: 1 })).toBe('outro');
  });

  it('posiciona e ajusta o tamanho ao comprimento do texto', () => {
    expect(placement('left')).toEqual({ justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left' });
    expect(placement('center').textAlign).toBe('center');
    expect(fitSize('curto', 'huge')).toBe(TEXT_SIZES.huge);
    const long = fitSize('uma frase bem mais longa do que cabe em letras gigantes na tela', 'huge');
    expect(long).toBeLessThan(TEXT_SIZES.huge);
    expect(long).toBeGreaterThanOrEqual(TEXT_SIZES.small);
  });
});

describe('galeria (folhas de contato)', () => {
  it('pagina os ids em folhas de 12', () => {
    const ids = Array.from({ length: 27 }, (_, index) => `C${index}`);
    expect(sheetPages(ids).map((page) => page.length)).toEqual([12, 12, 3]);
    expect(sheetPages([])).toEqual([]);
  });

  it('escolhe um frame com a entrada já assentada, sempre dentro da duração', () => {
    expect(representativeFrame(100)).toBe(60);
    expect(representativeFrame(100, 1)).toBe(99);
    expect(representativeFrame(1)).toBe(0);
  });

  it('monta a grade do xstack somando larguras e alturas dos quadros anteriores', () => {
    expect(xstackLayout(1)).toBe('0_0');
    expect(xstackLayout(5)).toBe('0_0|w0_0|w0+w1_0|w0+w1+w2_0|0_h0');
    expect(xstackLayout(9).split('|').at(-1)).toBe('0_h0+h4');
    expect(xstackLayout(3, 2)).toBe('0_0|w0_0|0_h0');
  });
});
