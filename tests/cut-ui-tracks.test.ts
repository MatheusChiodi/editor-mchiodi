import { describe, expect, it } from 'vitest';

import { createTimeMap } from '../cut/src/lib/timemap.ts';
import { assignLanes, cutMarkers, edgeBands, itemKey, layoutTracks, parseItemKey, sourceEndAfter, trackHeight, visibleWords } from '../cut/src/lib/tracks.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { baseEdl, SPEECH, WORDS } from './cut-fixture.ts';

const edl = baseEdl({
  overlays: [
    { id: 'ov1', component: 'LowerThird', at: 0.2, duration: 2, reason: 'apresenta' },
    { id: 'ov2', component: 'Callout', at: 0.5, duration: 1, reason: 'reforça' },
  ],
  zooms: [{ id: 'z1', at: 2.1, duration: 0.5, reason: 'ênfase' }],
  transitions: [{ id: 't1', intoClip: 'c002', type: 'cross-dissolve', reason: 'troca' }],
});
const timeline = buildTimeline(edl.clips, 30);

describe('layoutTracks', () => {
  const map = createTimeMap(timeline, 6, 'output', 100);
  const layout = layoutTracks(edl, timeline, map);

  it('coloca clipes, overlays, zooms e transições na trilha certa', () => {
    expect(layout.items.clips.map((item) => item.id)).toEqual(['c001', 'c002', 'c003']);
    expect(layout.items.clips[1]!.x).toBeCloseTo(120, 1);
    expect(layout.items.overlays.map((item) => item.key)).toEqual(['overlays:ov1', 'overlays:ov2']);
    expect(layout.items.fx[0]!.key).toBe('zooms:z1');
    expect(layout.items.transitions[0]!.x).toBeCloseTo(120 - 20, 1);
  });

  it('itens sobrepostos ganham sub-faixas', () => {
    expect(layout.lanes.overlays).toBe(2);
    expect(layout.items.overlays.map((item) => item.lane)).toEqual([0, 1]);
    expect(trackHeight('overlays', 2)).toBeGreaterThan(trackHeight('overlays', 1));
  });

  it('o fim de um overlay atravessa o corte (duração de saída)', () => {
    // ov1: 0.2 + 2 s de saída → passa pelo corte 1.2→1.9 e termina em 2.9 na fonte
    expect(sourceEndAfter(timeline, 0.2, 2)).toBeCloseTo(2.9, 2);
    expect(layout.items.overlays[0]!.sourceEnd).toBeCloseTo(2.9, 2);
  });

  it('marca o overlay ancorado num trecho cortado', () => {
    const orphan = layoutTracks({ ...edl, overlays: [{ ...edl.overlays[0]!, at: 1.5 }] }, timeline, map);
    expect(orphan.items.overlays[0]!.orphan).toBe(true);
  });

  it('a vista da fonte mostra os trechos removidos', () => {
    const source = layoutTracks(edl, timeline, createTimeMap(timeline, 6, 'source', 100));
    const removed = source.items.clips.filter((item) => item.kind === 'removed');
    expect(removed).toHaveLength(3);
    expect(removed[0]!.x).toBeCloseTo(120, 1);
  });
});

describe('cortes, bordas válidas e palavras', () => {
  const map = createTimeMap(timeline, 6, 'output', 100);

  it('marcador em cada corte com o que sumiu', () => {
    const markers = cutMarkers(edl, timeline, map);
    expect(markers.map((marker) => marker.intoClip)).toEqual(['c002', 'c003', '']);
    expect(markers[0]!.removedSec).toBeCloseTo(0.7, 3);
    expect(markers[0]!.kinds).toEqual(['silence']);
  });

  it('faixas de borda válida ficam nas pausas medidas', () => {
    const bands = edgeBands(SPEECH, createTimeMap(timeline, 6, 'source', 100));
    expect(bands.length).toBeGreaterThanOrEqual(3);
    for (const band of bands) {
      expect(WORDS.some((word) => band.start > word.start + 1e-6 && band.start < word.end - 1e-6)).toBe(false);
    }
  });

  it('só as palavras da janela visível', () => {
    const all = visibleWords(WORDS, map, 0, 1e6);
    const some = visibleWords(WORDS, map, 0, 60);
    expect(some.length).toBeLessThan(all.length);
    expect(some.every((word) => word.x <= 60)).toBe(true);
  });

  it('assignLanes reaproveita a faixa livre', () => {
    const items = [
      { x: 0, w: 10, lane: 0 },
      { x: 5, w: 10, lane: 0 },
      { x: 20, w: 5, lane: 0 },
    ];
    expect(assignLanes(items)).toBe(2);
    expect(items.map((item) => item.lane)).toEqual([0, 1, 0]);
  });

  it('chave de item ida e volta', () => {
    expect(parseItemKey(itemKey('overlays', 'ov-1'))).toEqual({ kind: 'overlays', id: 'ov-1' });
  });
});
