import { z } from 'zod';

import { normalizeToken } from '../analyze/speech.ts';
import { LEVEL_IDS } from '../edl/levels.ts';
import {
  brollSchema,
  type Clip,
  type Edl,
  type EdlInput,
  effectSchema,
  overlaySchema,
  type Removal,
  sfxSchema,
  transitionSchema,
  zoomSchema,
} from '../edl/schema.ts';
import { validateEdl } from '../edl/store.ts';
import { round3 } from '../lib/time.ts';
import { snapEdge, type SnapResult, type SpeechContext } from './snap.ts';

export const ITEM_KINDS = ['overlays', 'broll', 'zooms', 'transitions', 'effects', 'sfx'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** Itens que só entram com `reason` (STYLE.md §1: sem motivo, não entra). O SFX não tem o campo no schema. */
export const REASON_KINDS: readonly ItemKind[] = ['overlays', 'broll', 'zooms', 'transitions', 'effects'];

const ITEM_SCHEMAS: Record<ItemKind, z.ZodType> = {
  overlays: overlaySchema,
  broll: brollSchema,
  zooms: zoomSchema,
  transitions: transitionSchema,
  effects: effectSchema,
  sfx: sfxSchema,
};

const ID_PREFIX: Record<ItemKind, string> = { overlays: 'ov', broll: 'br', zooms: 'z', transitions: 'tr', effects: 'fx', sfx: 'sfx' };

const seconds = z.number().nonnegative();
const kind = z.enum(ITEM_KINDS);

/**
 * Operações de edição do MChiodi Cut. Todo tempo é em segundos da FONTE (o front converte da saída com
 * src/edl/timeline.ts antes de mandar). O servidor recebe o lote ao salvar e aplica em ordem.
 */
export const cutOpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('trimClip'), clipId: z.string(), edge: z.enum(['start', 'end']), time: seconds }),
  z.object({ type: z.literal('removeRange'), start: seconds, end: seconds, reason: z.string().optional() }),
  z.object({ type: z.literal('restoreRange'), start: seconds, end: seconds }),
  z.object({
    type: z.literal('moveItem'),
    kind,
    id: z.string(),
    at: seconds.optional(),
    duration: z.number().positive().optional(),
    start: seconds.optional(),
    end: seconds.optional(),
    intoClip: z.string().optional(),
    reason: z.string().optional(),
  }),
  z.object({ type: z.literal('insertItem'), kind, item: z.record(z.string(), z.unknown()) }),
  z.object({
    type: z.literal('updateItem'), kind, id: z.string(), patch: z.record(z.string(), z.unknown()),
    /** chaves a remover do item (campo opcional apagado no formulário; o schema reaplica o padrão, se houver) */
    unset: z.array(z.string()).optional(),
  }),
  z.object({ type: z.literal('removeItem'), kind, id: z.string() }),
  z.object({ type: z.literal('captionReplace'), from: z.string().min(1), to: z.string().nullable() }),
  z.object({ type: z.literal('captionHighlight'), word: z.string().min(1), on: z.boolean() }),
  /** só o Matheus troca o nível: a UI manda `confirm: true` depois de perguntar */
  z.object({ type: z.literal('setLevel'), level: z.enum(LEVEL_IDS), confirm: z.literal(true) }),
]);

export type CutOp = z.infer<typeof cutOpSchema>;

/** Fatos de uma operação já aplicada (depois do snap), de onde saem as `notes`. */
export interface OpDetail {
  from?: number;
  to?: number;
  start?: number;
  end?: number;
  previous?: string | null;
  label?: string;
  fields?: string[];
}

export interface AppliedOp {
  op: CutOp;
  detail: OpDetail;
}

export type EdlData = Omit<EdlInput, 'version' | 'createdAt'>;

export interface ApplyResult {
  edl: Edl;
  /** o que vai para `saveNewVersion` */
  data: EdlData;
  applied: AppliedOp[];
  warnings: string[];
  snaps: SnapResult[];
}

export class CutOpError extends Error {
  constructor(
    readonly opIndex: number,
    message: string,
  ) {
    super(`operação ${opIndex + 1}: ${message}`);
  }
}

interface Interval {
  start: number;
  end: number;
}

/** Fala dentro de um intervalo, no mesmo formato do `quote` do corte automático. */
export function quoteFor(words: SpeechContext['words'], span: Interval): string {
  const text = words
    .filter((word) => {
      const middle = (word.start + word.end) / 2;
      return middle >= span.start && middle < span.end;
    })
    .map((word) => word.text)
    .join(' ');
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

/**
 * Une intervalos sobrepostos; descarta o que tem menos de `minSec`. Clipes que só se encostam continuam
 * separados (há um corte ali, talvez com transição), a menos que `joinTouching`.
 */
export function mergeIntervals(intervals: Interval[], minSec = 0.02, joinTouching = false): Interval[] {
  const sorted = intervals.filter((item) => item.end - item.start >= minSec).sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const item of sorted) {
    const last = merged.at(-1);
    if (last && (joinTouching ? item.start <= last.end + 1e-3 : item.start < last.end - 1e-6)) last.end = Math.max(last.end, item.end);
    else merged.push({ ...item });
  }
  return merged;
}

export function subtractInterval(intervals: Interval[], cut: Interval, minSec = 0.02): Interval[] {
  return intervals.flatMap((item) => {
    if (cut.end <= item.start || cut.start >= item.end) return [item];
    return [
      { start: item.start, end: Math.min(item.end, cut.start) },
      { start: Math.max(item.start, cut.end), end: item.end },
    ].filter((part) => part.end - part.start >= minSec);
  });
}

export function uniqueId(base: string, taken: Set<string>): string {
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Redesenha os clipes a partir dos intervalos mantidos, preservando ids: cada intervalo herda o id (e o
 * `reason`) do primeiro clipe antigo que ele cobre; pedaço novo de um clipe partido ganha `<id>-2`.
 * Clipe que mudou de borda tem o `quote` refeito pelas palavras.
 */
export function rebuildClips(old: Clip[], intervals: Interval[], words: SpeechContext['words']): Clip[] {
  const taken = new Set(old.map((clip) => clip.id));
  const used = new Set<string>();
  return intervals.map((interval) => {
    const owner = old.find((clip) => clip.start < interval.end - 1e-6 && clip.end > interval.start + 1e-6 && !used.has(clip.id));
    const base = owner ?? old.find((clip) => clip.start < interval.end && clip.end > interval.start);
    let id = owner?.id;
    if (!id) {
      id = uniqueId(base?.id ?? 'c', taken);
      taken.add(id);
    }
    used.add(id);
    const start = round3(interval.start);
    const end = round3(interval.end);
    const same = owner && Math.abs(owner.start - start) < 1e-6 && Math.abs(owner.end - end) < 1e-6;
    return {
      id,
      start,
      end,
      quote: same ? owner.quote : quoteFor(words, interval),
      reason: owner?.reason ?? base?.reason ?? '',
    };
  });
}

/**
 * Mantém `removed` coerente com os clipes: cada remoção é recortada aos buracos que sobraram, e buraco
 * que nenhuma remoção explica vira `manual` (feito no editor).
 */
export function reconcileRemovals(clips: Interval[], removed: Removal[], durationSec: number, manualReason = 'Matheus: cortado no editor'): Removal[] {
  const gaps: Interval[] = [];
  let cursor = 0;
  for (const clip of clips) {
    if (clip.start - cursor > 0.01) gaps.push({ start: cursor, end: clip.start });
    cursor = Math.max(cursor, clip.end);
  }
  if (durationSec - cursor > 0.01) gaps.push({ start: cursor, end: durationSec });

  const result: Removal[] = [];
  for (const gap of gaps) {
    const inside = removed
      .map((item) => ({ ...item, start: Math.max(item.start, gap.start), end: Math.min(item.end, gap.end) }))
      .filter((item) => item.end - item.start > 0.01)
      .sort((a, b) => a.start - b.start);
    let at = gap.start;
    for (const item of inside) {
      if (item.start - at > 0.01) result.push({ start: round3(at), end: round3(item.start), kind: 'manual', reason: manualReason });
      if (item.end <= at) continue;
      result.push({ ...item, start: round3(Math.max(item.start, at)), end: round3(item.end) });
      at = item.end;
    }
    if (gap.end - at > 0.01) result.push({ start: round3(at), end: round3(gap.end), kind: 'manual', reason: manualReason });
  }
  return result;
}

type AnyItem = Record<string, unknown> & { id: string };

function itemsOf(edl: Edl, kind: ItemKind): AnyItem[] {
  return edl[kind] as unknown as AnyItem[];
}

function setItems(edl: Edl, kind: ItemKind, items: AnyItem[]): void {
  (edl as unknown as Record<ItemKind, AnyItem[]>)[kind] = items;
}

/**
 * Chaves que um `updateItem` tira do item: as de `unset` e as do patch sem valor (`undefined` ou texto vazio),
 * porque mesclar raso manteria o valor antigo. `null` fica: em campo anulável é um valor (presenter: null).
 */
export function unsetKeys(patch: Record<string, unknown>, unset: string[] = []): string[] {
  const empty = Object.keys(patch).filter((key) => patch[key] === undefined || (typeof patch[key] === 'string' && (patch[key] as string).trim() === ''));
  return [...new Set([...unset, ...empty])];
}

function parseItem(kind: ItemKind, raw: unknown): AnyItem {
  const parsed = ITEM_SCHEMAS[kind].safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${kind} inválido: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || '(item)'} ${issue.message}`).join('; ')}`);
  }
  return parsed.data as AnyItem;
}

function requireReason(kind: ItemKind, item: AnyItem): void {
  if (!REASON_KINDS.includes(kind)) return;
  if (typeof item.reason !== 'string' || !item.reason.trim()) {
    throw new Error(`"${item.id}" precisa de reason: diga o que ele reforça na fala (STYLE.md §1)`);
  }
}

function nextItemId(edl: Edl, kind: ItemKind): string {
  const taken = new Set([...edl.clips, ...ITEM_KINDS.flatMap((name) => itemsOf(edl, name))].map((item) => item.id));
  for (let n = 1; ; n += 1) {
    const candidate = `${ID_PREFIX[kind]}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function itemLabel(kind: ItemKind, item: AnyItem): string {
  const name = (item.component ?? item.preset ?? item.type ?? item.file) as string | undefined;
  return name ? `${name} ${item.id}` : item.id;
}

/** Aplica uma mudança nos clipes e devolve transições órfãs como aviso (o corte em que entravam sumiu). */
function commitClips(edl: Edl, intervals: Interval[], context: SpeechContext, warnings: string[], manualReason?: string): void {
  const clips = rebuildClips(edl.clips, mergeIntervals(intervals), context.words);
  if (clips.length === 0) throw new Error('não sobraria nenhum clipe');
  const ids = new Set(clips.map((clip) => clip.id));
  const first = clips[0]!.id;
  const kept = edl.transitions.filter((transition) => ids.has(transition.intoClip) && transition.intoClip !== first);
  for (const transition of edl.transitions) {
    if (!kept.includes(transition)) warnings.push(`transição ${transition.id} saiu: o corte em que ela entrava (${transition.intoClip}) não existe mais`);
  }
  edl.transitions = kept;
  edl.clips = clips;
  edl.removed = reconcileRemovals(clips, edl.removed, edl.source.durationSec, manualReason);
}

function snapOrThrow(time: number, context: SpeechContext, snaps: SnapResult[], warnings: string[]): number {
  const result = snapEdge(time, context);
  snaps.push(result);
  if (!result.ok) throw new Error(result.warning ?? 'sem silêncio medido perto');
  if (result.warning) warnings.push(result.warning);
  return result.time;
}

function applyOne(edl: Edl, op: CutOp, context: SpeechContext, snaps: SnapResult[], warnings: string[]): OpDetail {
  switch (op.type) {
    case 'trimClip': {
      const clip = edl.clips.find((item) => item.id === op.clipId);
      if (!clip) throw new Error(`clipe "${op.clipId}" não existe`);
      const time = snapOrThrow(op.time, context, snaps, warnings);
      const from = clip[op.edge];
      const next = { start: clip.start, end: clip.end, [op.edge]: time };
      if (next.end - next.start < 0.05) throw new Error(`o clipe ${clip.id} ficaria vazio`);
      const others = edl.clips.filter((item) => item !== clip);
      if (others.some((item) => item.start < next.end - 1e-6 && item.end > next.start + 1e-6)) {
        throw new Error(`${clip.id} encostaria em outro clipe; para juntar dois clipes, restaure o trecho entre eles`);
      }
      commitClips(edl, [...others, next], context, warnings);
      return { from, to: time };
    }
    case 'removeRange': {
      if (op.end <= op.start) throw new Error('fim do trecho precisa ser maior que o início');
      const start = snapOrThrow(op.start, context, snaps, warnings);
      const end = snapOrThrow(op.end, context, snaps, warnings);
      if (end - start < 0.02) throw new Error('o trecho encolheu a nada depois do encaixe nas pausas');
      const reason = op.reason?.trim() ? `Matheus: ${op.reason.trim()}` : 'Matheus: removido no editor';
      commitClips(edl, subtractInterval(edl.clips, { start, end }), context, warnings, reason);
      return { start, end };
    }
    case 'restoreRange': {
      if (op.end <= op.start) throw new Error('fim do trecho precisa ser maior que o início');
      const start = snapOrThrow(op.start, context, snaps, warnings);
      const end = snapOrThrow(op.end, context, snaps, warnings);
      // só os clipes que encostam no trecho se juntam a ele; cortes encostados em outro lugar continuam
      const joined = edl.clips.filter((clip) => clip.start <= end + 1e-3 && clip.end >= start - 1e-3);
      const restored = { start: Math.min(start, ...joined.map((clip) => clip.start)), end: Math.max(end, ...joined.map((clip) => clip.end)) };
      commitClips(edl, [...edl.clips.filter((clip) => !joined.includes(clip)), restored], context, warnings);
      return { start, end };
    }
    case 'moveItem': {
      const items = itemsOf(edl, op.kind);
      const index = items.findIndex((item) => item.id === op.id);
      if (index < 0) throw new Error(`${op.kind}: "${op.id}" não existe`);
      const before = items[index]!;
      const patch: Record<string, unknown> = {};
      for (const key of ['at', 'duration', 'start', 'end', 'intoClip', 'reason'] as const) {
        if (op[key] !== undefined) {
          if (!(key in before) && key !== 'reason' && key !== 'duration') throw new Error(`${op.kind} não tem "${key}"`);
          patch[key] = op[key];
        }
      }
      const moved = parseItem(op.kind, { ...before, ...patch });
      requireReason(op.kind, moved);
      setItems(edl, op.kind, items.map((item, position) => (position === index ? moved : item)));
      return { label: itemLabel(op.kind, before), fields: Object.keys(patch).filter((key) => key !== 'reason'), from: (before.at ?? before.start) as number | undefined, to: (moved.at ?? moved.start) as number | undefined };
    }
    case 'insertItem': {
      const raw = { ...op.item, id: typeof op.item.id === 'string' && op.item.id ? op.item.id : nextItemId(edl, op.kind) };
      const item = parseItem(op.kind, raw);
      requireReason(op.kind, item);
      setItems(edl, op.kind, [...itemsOf(edl, op.kind), item]);
      return { label: itemLabel(op.kind, item), to: (item.at ?? item.start) as number | undefined };
    }
    case 'updateItem': {
      if ('id' in op.patch && op.patch.id !== op.id) throw new Error('o id de um item não muda; remova e insira outro');
      const items = itemsOf(edl, op.kind);
      const index = items.findIndex((item) => item.id === op.id);
      if (index < 0) throw new Error(`${op.kind}: "${op.id}" não existe`);
      const unset = unsetKeys(op.patch, op.unset);
      if (unset.includes('id')) throw new Error('o id de um item não sai');
      const merged: Record<string, unknown> = { ...items[index], ...op.patch, id: op.id };
      for (const key of unset) delete merged[key];
      const updated = parseItem(op.kind, merged);
      requireReason(op.kind, updated);
      setItems(edl, op.kind, items.map((item, position) => (position === index ? updated : item)));
      return { label: itemLabel(op.kind, updated), fields: [...new Set([...Object.keys(op.patch), ...unset])] };
    }
    case 'removeItem': {
      const items = itemsOf(edl, op.kind);
      const item = items.find((candidate) => candidate.id === op.id);
      if (!item) throw new Error(`${op.kind}: "${op.id}" não existe`);
      setItems(edl, op.kind, items.filter((candidate) => candidate !== item));
      return { label: itemLabel(op.kind, item) };
    }
    case 'captionReplace': {
      const token = normalizeToken(op.from);
      if (!token) throw new Error(`"${op.from}" não tem letra nem número`);
      const replacements = { ...edl.captions.replacements };
      let previous: string | null = null;
      for (const key of Object.keys(replacements)) {
        if (normalizeToken(key) !== token) continue;
        previous = replacements[key] ?? null;
        delete replacements[key];
      }
      if (op.to !== null && op.to !== '') replacements[op.from.trim()] = op.to;
      edl.captions = { ...edl.captions, replacements };
      return { previous };
    }
    case 'captionHighlight': {
      const token = normalizeToken(op.word);
      if (!token) throw new Error(`"${op.word}" não tem letra nem número`);
      const others = edl.captions.highlights.filter((item) => normalizeToken(item) !== token);
      edl.captions = { ...edl.captions, highlights: op.on ? [...others, op.word.trim()] : others };
      return {};
    }
    case 'setLevel': {
      const previous = edl.level;
      edl.level = op.level;
      return { previous };
    }
  }
}

/**
 * Aplica um lote de operações sobre uma EDL, em ordem, e valida pelo schema depois de cada uma.
 * Nada é gravado aqui: o servidor passa `data` para `saveNewVersion`.
 */
export function applyOps(base: Edl, ops: CutOp[], context: SpeechContext): ApplyResult {
  let edl = structuredClone(base);
  const applied: AppliedOp[] = [];
  const warnings: string[] = [];
  const snaps: SnapResult[] = [];
  ops.forEach((raw, index) => {
    const parsed = cutOpSchema.safeParse(raw);
    if (!parsed.success) throw new CutOpError(index, `formato inválido: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
    const working = structuredClone(edl);
    try {
      const detail = applyOne(working, parsed.data, context, snaps, warnings);
      edl = validateEdl(working);
      applied.push({ op: parsed.data, detail });
    } catch (error) {
      throw new CutOpError(index, error instanceof Error ? error.message : String(error));
    }
  });
  const { version: _version, createdAt: _createdAt, ...data } = edl;
  return { edl, data, applied, warnings, snaps };
}
