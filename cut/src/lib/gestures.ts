/**
 * Gesto na timeline → operação da EDL (CutOp). Tudo em segundos da FONTE. O servidor reaplica o snap e valida
 * pelo schema; aqui a conta é a mesma (src/cut/snap.ts) para mostrar o encaixe e o motivo de recusa na hora.
 */
import type { CutOp, ItemKind } from '../../../src/cut/ops.ts';
import { snapEdge, type SnapResult, type SpeechContext } from '../../../src/cut/snap.ts';
import type { Clip, Edl } from '../../../src/edl/schema.ts';
import { sourceToOutput, type Timeline } from '../../../src/edl/timeline.ts';
import { round3 } from '../../../src/lib/time.ts';
import { parseItemKey } from './tracks.ts';
import type { TimeMap } from './timemap.ts';

export interface Plan {
  ok: boolean;
  op: CutOp | null;
  /** aviso (encaixe) ou motivo da recusa */
  message: string | null;
  snap?: SnapResult;
}

const refuse = (message: string, snap?: SnapResult): Plan => ({ ok: false, op: null, message, ...(snap ? { snap } : {}) });

export const MIN_CLIP_SEC = 0.05;

/** Arrastar a borda de um clipe até `requested` (fonte): encaixa na pausa medida e respeita os vizinhos. */
export function planTrim(clips: Pick<Clip, 'id' | 'start' | 'end'>[], clipId: string, edge: 'start' | 'end', requested: number, speech: SpeechContext): Plan {
  const index = clips.findIndex((clip) => clip.id === clipId);
  const clip = clips[index];
  if (!clip) return refuse(`clipe "${clipId}" não existe`);
  const snap = snapEdge(requested, speech);
  if (!snap.ok) return refuse(snap.warning ?? 'sem pausa medida perto', snap);
  const time = snap.time;
  if (edge === 'start') {
    const previous = clips[index - 1];
    if (previous && time < previous.end - 1e-6) return refuse(`${clip.id} encostaria em ${previous.id}; para juntar os dois, restaure o trecho entre eles`, snap);
    if (clip.end - time < MIN_CLIP_SEC) return refuse(`o clipe ${clip.id} ficaria vazio`, snap);
  } else {
    const next = clips[index + 1];
    if (next && time > next.start + 1e-6) return refuse(`${clip.id} encostaria em ${next.id}; para juntar os dois, restaure o trecho entre eles`, snap);
    if (time - clip.start < MIN_CLIP_SEC) return refuse(`o clipe ${clip.id} ficaria vazio`, snap);
  }
  if (Math.abs(time - clip[edge]) < 1e-3) return { ok: true, op: null, message: snap.warning, snap };
  return { ok: true, op: { type: 'trimClip', clipId, edge, time }, message: snap.warning, snap };
}

export interface Range {
  start: number;
  end: number;
}

/** Entrada/saída (I/O) em qualquer ordem → intervalo; `null` se falta uma ponta ou é curto demais. */
export function normalizeRange(a: number | null, b: number | null, minSec = 0.05): Range | null {
  if (a === null || b === null) return null;
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  return end - start < minSec ? null : { start: round3(start), end: round3(end) };
}

/** Remover um trecho: as duas pontas precisam cair em pausa medida (mostra onde cada uma encaixa). */
export function planRemove(range: Range, speech: SpeechContext, reason?: string): Plan {
  const a = snapEdge(range.start, speech);
  if (!a.ok) return refuse(`início: ${a.warning}`, a);
  const b = snapEdge(range.end, speech);
  if (!b.ok) return refuse(`fim: ${b.warning}`, b);
  if (b.time - a.time < 0.02) return refuse('o trecho encolhe a nada depois do encaixe nas pausas');
  const message = [a.warning, b.warning].filter(Boolean).join(' · ') || null;
  return { ok: true, op: { type: 'removeRange', start: a.time, end: b.time, ...(reason?.trim() ? { reason: reason.trim() } : {}) }, message };
}

export function planRestore(range: Range, speech: SpeechContext): Plan {
  const a = snapEdge(range.start, speech);
  if (!a.ok) return refuse(`início: ${a.warning}`, a);
  const b = snapEdge(range.end, speech);
  if (!b.ok) return refuse(`fim: ${b.warning}`, b);
  if (b.time - a.time < 0.02) return refuse('o trecho encolhe a nada depois do encaixe nas pausas');
  const message = [a.warning, b.warning].filter(Boolean).join(' · ') || null;
  return { ok: true, op: { type: 'restoreRange', start: a.time, end: b.time }, message };
}

type AnyItem = { id: string; at?: number; duration?: number; start?: number; end?: number; intoClip?: string };

export function findItem(edl: Edl, kind: ItemKind, id: string): AnyItem | undefined {
  return (edl[kind] as AnyItem[]).find((item) => item.id === id);
}

const kept = (timeline: Timeline, source: number) => sourceToOutput(timeline, source) !== null;

/** Novo instante da fonte depois de deslocar `deltaView` segundos na vista; recusa trecho cortado. */
function shifted(map: TimeMap, timeline: Timeline, source: number, deltaView: number, allowCut = false): { source: number } | { error: string } {
  const view = map.viewTime(source);
  if (view === null) return { error: 'o item está num trecho cortado; mova-o pela vista da fonte (Tab)' };
  const target = map.sourceTime(view + deltaView);
  if (target === null) return { error: 'fora do vídeo' };
  if (!allowCut && !kept(timeline, target)) return { error: `${target.toFixed(2)}s cai num trecho cortado` };
  return { source: round3(target) };
}

/** Arrastar um item inteiro na timeline. */
export function planMove(edl: Edl, timeline: Timeline, map: TimeMap, kind: ItemKind, id: string, deltaView: number): Plan {
  const item = findItem(edl, kind, id);
  if (!item) return refuse(`${kind}: "${id}" não existe`);
  if (Math.abs(deltaView) < 1e-3) return { ok: true, op: null, message: null };
  if (kind === 'transitions') {
    const clip = timeline.clips.find((candidate) => candidate.id === item.intoClip);
    const cutView = clip ? map.viewTime(clip.sourceStart) : null;
    if (cutView === null) return refuse('a transição está num corte que não existe mais');
    const target = cutView + deltaView;
    let best: { id: string; distance: number } | null = null;
    for (const candidate of timeline.clips.slice(1)) {
      const view = map.viewTime(candidate.sourceStart);
      if (view === null) continue;
      const distance = Math.abs(view - target);
      if (!best || distance < best.distance) best = { id: candidate.id, distance };
    }
    if (!best || best.id === item.intoClip) return { ok: true, op: null, message: null };
    if (edl.transitions.some((other) => other.intoClip === best!.id && other.id !== id)) return refuse(`o corte de ${best.id} já tem transição`);
    return { ok: true, op: { type: 'moveItem', kind, id, intoClip: best.id }, message: `transição passa para o corte de ${best.id}` };
  }
  if (kind === 'broll') {
    const start = shifted(map, timeline, item.start!, deltaView);
    if ('error' in start) return refuse(start.error);
    const length = item.end! - item.start!;
    return { ok: true, op: { type: 'moveItem', kind, id, start: start.source, end: round3(start.source + length) }, message: null };
  }
  const at = shifted(map, timeline, item.at!, deltaView);
  if ('error' in at) return refuse(at.error);
  return { ok: true, op: { type: 'moveItem', kind, id, at: at.source }, message: null };
}

/** Puxar a borda de um item (início ou fim). Duração dos itens é em segundos de SAÍDA; o b-roll é de fonte. */
export function planResize(
  edl: Edl,
  timeline: Timeline,
  map: TimeMap,
  kind: ItemKind,
  id: string,
  edge: 'start' | 'end',
  deltaView: number,
  displayedDuration?: number,
): Plan {
  const item = findItem(edl, kind, id);
  if (!item) return refuse(`${kind}: "${id}" não existe`);
  if (Math.abs(deltaView) < 1e-3) return { ok: true, op: null, message: null };
  if (kind === 'transitions' || kind === 'sfx') return refuse(kind === 'sfx' ? 'SFX não tem duração' : 'a duração da transição se ajusta no painel de propriedades');
  if (kind === 'broll') {
    if (edge === 'end') {
      const end = shifted(map, timeline, item.end!, deltaView, true);
      if ('error' in end) return refuse(end.error);
      if (end.source - item.start! < 0.3) return refuse('o b-roll ficaria curto demais');
      return { ok: true, op: { type: 'moveItem', kind, id, end: end.source }, message: null };
    }
    const start = shifted(map, timeline, item.start!, deltaView);
    if ('error' in start) return refuse(start.error);
    if (item.end! - start.source < 0.3) return refuse('o b-roll ficaria curto demais');
    return { ok: true, op: { type: 'moveItem', kind, id, start: start.source }, message: null };
  }
  const duration = item.duration ?? displayedDuration ?? 1;
  if (edge === 'end') {
    const next = round3(duration + deltaView);
    if (next < 0.2) return refuse('duração mínima: 0,2 s');
    return { ok: true, op: { type: 'moveItem', kind, id, duration: next }, message: null };
  }
  const at = shifted(map, timeline, item.at!, deltaView);
  if ('error' in at) return refuse(at.error);
  const next = round3(duration - deltaView);
  if (next < 0.2) return refuse('duração mínima: 0,2 s');
  return { ok: true, op: { type: 'moveItem', kind, id, at: at.source, duration: next }, message: null };
}

const EDITABLE_KINDS: readonly string[] = ['overlays', 'broll', 'zooms', 'transitions', 'effects', 'sfx'];

/** Delete: itens selecionados saem; clipe selecionado vira remoção do trecho dele; senão, o trecho marcado. */
export function planDelete(edl: Edl, selected: string[], range: Range | null, speech: SpeechContext): Plan[] {
  const plans: Plan[] = [];
  for (const key of selected) {
    const { kind, id } = parseItemKey(key);
    if (EDITABLE_KINDS.includes(kind)) {
      plans.push({ ok: true, op: { type: 'removeItem', kind: kind as ItemKind, id }, message: null });
    } else if (kind === 'clip') {
      const clip = edl.clips.find((item) => item.id === id);
      if (clip) plans.push(planRemove({ start: clip.start, end: clip.end }, speech, `removeu o clipe ${clip.id}`));
    }
  }
  if (plans.length === 0 && range) plans.push(planRemove(range, speech));
  return plans;
}

/** Itens selecionáveis cujo intervalo toca o trecho (para "selecionar o que está no trecho" e o painel Claude). */
export function idsInRange(items: { key: string; sourceStart: number; sourceEnd: number }[], range: Range): string[] {
  return items.filter((item) => item.sourceEnd > range.start && item.sourceStart < range.end).map((item) => item.key);
}
