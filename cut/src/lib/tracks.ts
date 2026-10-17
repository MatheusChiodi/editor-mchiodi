import { effects } from '../../../src/arsenal/effects.ts';
import { transitionDuration } from '../../../src/arsenal/transitions.ts';
import type { ItemKind } from '../../../src/cut/ops.ts';
import { validEdgeSpans, type SpeechContext } from '../../../src/cut/snap.ts';
import type { Edl } from '../../../src/edl/schema.ts';
import { outputToSource, sourceToOutput, type Timeline } from '../../../src/edl/timeline.ts';
import type { TimeMap } from './timemap.ts';

export const TRACKS = [
  { id: 'overlays', label: 'Gráficos', hint: 'overlays e cenas' },
  { id: 'fx', label: 'Zoom / FX', hint: 'zooms e efeitos' },
  { id: 'transitions', label: 'Transições', hint: 'no corte' },
  { id: 'broll', label: 'B-roll', hint: 'insertos' },
  { id: 'clips', label: 'Vídeo', hint: 'clipes da fonte' },
  { id: 'words', label: 'Legendas', hint: 'palavras' },
  { id: 'audio', label: 'Áudio', hint: 'forma de onda e pausas' },
] as const;

export type TrackId = (typeof TRACKS)[number]['id'];

export const TRACK_HEIGHT: Record<TrackId, number> = {
  overlays: 30,
  fx: 28,
  transitions: 28,
  broll: 28,
  clips: 52,
  words: 30,
  audio: 56,
};

export type LaneItemKind = ItemKind | 'clip' | 'removed';

export interface LaneItem {
  /** chave única na timeline: `<kind>:<id>` */
  key: string;
  kind: LaneItemKind;
  id: string;
  track: TrackId;
  x: number;
  w: number;
  lane: number;
  label: string;
  /** início/fim na fonte (para seleção e ops) */
  sourceStart: number;
  sourceEnd: number;
  /** ancorado num trecho cortado: o render recusa (a EDL inválida não salva) */
  orphan: boolean;
  reason?: string;
}

export function itemKey(kind: LaneItemKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseItemKey(key: string): { kind: LaneItemKind; id: string } {
  const at = key.indexOf(':');
  return { kind: key.slice(0, at) as LaneItemKind, id: key.slice(at + 1) };
}

/**
 * Distribui itens sobrepostos em sub-faixas (o primeiro que couber), para nada ficar escondido atrás de outro.
 * Devolve o número de sub-faixas usadas.
 */
export function assignLanes<T extends { x: number; w: number; lane: number }>(items: T[], gapPx = 2): number {
  const ends: number[] = [];
  for (const item of [...items].sort((a, b) => a.x - b.x)) {
    let lane = ends.findIndex((end) => end + gapPx <= item.x);
    if (lane < 0) {
      lane = ends.length;
      ends.push(0);
    }
    ends[lane] = item.x + Math.max(item.w, 1);
    item.lane = lane;
  }
  return Math.max(1, ends.length);
}

/** Fim na fonte de algo que dura `durationSec` de SAÍDA a partir de `at` (atravessa cortes). */
export function sourceEndAfter(timeline: Timeline, at: number, durationSec: number): number {
  const start = sourceToOutput(timeline, at);
  if (start === null) return at + durationSec;
  return outputToSource(timeline, Math.min(start + durationSec, timeline.durationSec - 1e-6)) ?? at + durationSec;
}

function spanX(map: TimeMap, timeline: Timeline, at: number, durationSec: number): { x: number; w: number; orphan: boolean } {
  const x = map.toX(at);
  if (x === null) return { x: map.toXClamped(at), w: Math.max(6, durationSec * map.pps), orphan: true };
  if (map.mode === 'output') return { x, w: durationSec * map.pps, orphan: false };
  const end = sourceEndAfter(timeline, at, durationSec);
  return { x, w: (end - at) * map.pps, orphan: false };
}

export interface TrackLayout {
  items: Record<TrackId, LaneItem[]>;
  lanes: Record<TrackId, number>;
}

const short = (text: string, max = 28) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Itens da EDL posicionados na timeline. Palavras e forma de onda são desenhadas à parte (muitas). */
export function layoutTracks(edl: Edl, timeline: Timeline, map: TimeMap): TrackLayout {
  const items: Record<TrackId, LaneItem[]> = { overlays: [], fx: [], transitions: [], broll: [], clips: [], words: [], audio: [] };
  const push = (item: Omit<LaneItem, 'key' | 'lane'>) => items[item.track].push({ ...item, key: itemKey(item.kind, item.id), lane: 0 });

  for (const clip of timeline.clips) {
    const x = map.toX(clip.sourceStart) ?? map.toXClamped(clip.sourceStart);
    const quote = edl.clips.find((item) => item.id === clip.id)?.quote ?? '';
    push({ kind: 'clip', id: clip.id, track: 'clips', x, w: (clip.sourceEnd - clip.sourceStart) * map.pps, label: quote || clip.id, sourceStart: clip.sourceStart, sourceEnd: clip.sourceEnd, orphan: false });
  }
  if (map.mode === 'source') {
    edl.removed.forEach((removal, index) => {
      push({
        kind: 'removed',
        id: String(index),
        track: 'clips',
        x: removal.start * map.pps,
        w: (removal.end - removal.start) * map.pps,
        label: removal.kind,
        sourceStart: removal.start,
        sourceEnd: removal.end,
        orphan: false,
        reason: removal.reason,
      });
    });
  }

  for (const overlay of edl.overlays) {
    const place = spanX(map, timeline, overlay.at, overlay.duration);
    push({ kind: 'overlays', id: overlay.id, track: 'overlays', ...place, label: short(overlay.component.replace(/^scene:/, '')), sourceStart: overlay.at, sourceEnd: sourceEndAfter(timeline, overlay.at, overlay.duration), reason: overlay.reason });
  }
  for (const zoom of edl.zooms) {
    const place = spanX(map, timeline, zoom.at, zoom.duration);
    push({ kind: 'zooms', id: zoom.id, track: 'fx', ...place, label: `zoom ${zoom.scale.toFixed(2)}×`, sourceStart: zoom.at, sourceEnd: sourceEndAfter(timeline, zoom.at, zoom.duration), reason: zoom.reason });
  }
  for (const effect of edl.effects) {
    const start = sourceToOutput(timeline, effect.at);
    const preset = effects[effect.preset];
    const fallback = preset?.defaultDuration ?? (start === null ? 1 : timeline.durationSec - start);
    const duration = Math.max(0.1, effect.duration ?? fallback);
    const place = spanX(map, timeline, effect.at, duration);
    push({ kind: 'effects', id: effect.id, track: 'fx', ...place, label: short(effect.preset), sourceStart: effect.at, sourceEnd: sourceEndAfter(timeline, effect.at, duration), reason: effect.reason });
  }
  for (const sfx of edl.sfx) {
    const place = spanX(map, timeline, sfx.at, 0.6);
    push({ kind: 'sfx', id: sfx.id, track: 'fx', ...place, label: `♪ ${short(sfx.file.split(/[\\/]/).pop() ?? sfx.file, 16)}`, sourceStart: sfx.at, sourceEnd: sfx.at + 0.6 });
  }
  for (const transition of edl.transitions) {
    const clip = timeline.clips.find((item) => item.id === transition.intoClip);
    const duration = transitionDuration(transition);
    const cut = clip ? map.toX(clip.sourceStart) : null;
    const x = cut ?? 0;
    push({
      kind: 'transitions',
      id: transition.id,
      track: 'transitions',
      x: x - (duration * map.pps) / 2,
      w: Math.max(8, duration * map.pps),
      label: transition.type,
      sourceStart: clip?.sourceStart ?? 0,
      sourceEnd: clip?.sourceStart ?? 0,
      orphan: cut === null,
      reason: transition.reason,
    });
  }
  for (const broll of edl.broll) {
    const x = map.toX(broll.start);
    const endX = map.toXClamped(broll.end);
    push({
      kind: 'broll',
      id: broll.id,
      track: 'broll',
      x: x ?? map.toXClamped(broll.start),
      w: Math.max(6, endX - (x ?? map.toXClamped(broll.start))),
      label: short(broll.file.split(/[\\/]/).pop() ?? broll.file),
      sourceStart: broll.start,
      sourceEnd: broll.end,
      orphan: x === null,
      reason: broll.reason,
    });
  }

  const lanes = {} as Record<TrackId, number>;
  for (const track of TRACKS) lanes[track.id] = track.id === 'clips' ? 1 : assignLanes(items[track.id]);
  return { items, lanes };
}

/** Altura de uma trilha com suas sub-faixas. */
export function trackHeight(track: TrackId, lanes: number): number {
  const base = TRACK_HEIGHT[track];
  if (track === 'clips' || track === 'words' || track === 'audio') return base;
  return Math.max(base, lanes * (base - 4) + 6);
}

/** Cortes da vista de saída: onde dois clipes se encostam, com o que sumiu entre eles. */
export interface CutMarker {
  x: number;
  /** trecho cortado na fonte (vazio quando o corte é só a fronteira entre clipes encostados) */
  start: number;
  end: number;
  intoClip: string;
  removedSec: number;
  kinds: string[];
}

export function cutMarkers(edl: Edl, timeline: Timeline, map: TimeMap): CutMarker[] {
  const markers: CutMarker[] = [];
  let previousEnd = 0;
  timeline.clips.forEach((clip, index) => {
    const gapStart = index === 0 ? 0 : previousEnd;
    const gapEnd = clip.sourceStart;
    previousEnd = clip.sourceEnd;
    if (gapEnd - gapStart < 0.01) return;
    const kinds = [...new Set(edl.removed.filter((removal) => removal.end > gapStart && removal.start < gapEnd).map((removal) => removal.kind))];
    markers.push({ x: map.toXClamped(gapEnd), start: gapStart, end: gapEnd, intoClip: clip.id, removedSec: gapEnd - gapStart, kinds });
  });
  const last = timeline.clips.at(-1);
  if (last && edl.source.durationSec - last.sourceEnd > 0.01) {
    markers.push({ x: map.width, start: last.sourceEnd, end: edl.source.durationSec, intoClip: '', removedSec: edl.source.durationSec - last.sourceEnd, kinds: ['fim'] });
  }
  return markers;
}

/** Faixas onde uma borda de corte pode ficar (silêncio medido, sem palavra), já na vista. */
export function edgeBands(speech: SpeechContext, map: TimeMap): { x: number; w: number; start: number; end: number }[] {
  const bands: { x: number; w: number; start: number; end: number }[] = [];
  for (const span of validEdgeSpans(speech)) {
    const x = map.toX(span.start);
    const endX = map.toX(span.end);
    if (x === null && endX === null) continue;
    const left = x ?? map.toXClamped(span.start);
    const right = endX ?? map.toXClamped(span.end);
    bands.push({ x: left, w: Math.max(2, right - left), start: span.start, end: span.end });
  }
  return bands;
}

/** Palavras visíveis na janela [left, right] em px, já posicionadas. */
export function visibleWords(
  words: SpeechContext['words'],
  map: TimeMap,
  left: number,
  right: number,
): { index: number; x: number; w: number; text: string }[] {
  const result: { index: number; x: number; w: number; text: string }[] = [];
  words.forEach((word, index) => {
    const x = map.toX(word.start);
    const endX = map.toX(word.end);
    if (x === null || endX === null) return;
    if (endX < left || x > right) return;
    result.push({ index, x, w: Math.max(1, endX - x), text: word.text });
  });
  return result;
}
