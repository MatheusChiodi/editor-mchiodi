import type { Edl } from './schema.ts';

/**
 * Versões cuja `notes` começa com "Matheus:" são decisão do Matheus (gravadas pelo MChiodi Cut ou ditadas por ele).
 * O Claude não as desfaz sem ele pedir; `findReverts` aponta quando uma versão nova volta atrás numa delas.
 */
export const MATHEUS_PREFIX = 'Matheus:';

export function isMatheusDecision(notes: string): boolean {
  return notes.trimStart().startsWith(MATHEUS_PREFIX);
}

export interface Revert {
  /** versão do Matheus cuja decisão a candidata desfaz */
  version: number;
  what: string;
}

type Interval = [number, number];

// trecho menor que isto é ruído de snap (1 frame a 30 fps ≈ 33 ms)
const MIN_RANGE = 0.04;

function subtract(a: Interval[], b: Interval[]): Interval[] {
  let rest = a.map(([s, e]) => [s, e] as Interval);
  for (const [bs, be] of b) {
    rest = rest.flatMap(([s, e]): Interval[] => {
      if (be <= s || bs >= e) return [[s, e]];
      const out: Interval[] = [];
      if (bs > s) out.push([s, bs]);
      if (be < e) out.push([be, e]);
      return out;
    });
  }
  return rest.filter(([s, e]) => e - s >= MIN_RANGE);
}

function overlap(range: Interval, set: Interval[]): number {
  return set.reduce((sum, [s, e]) => sum + Math.max(0, Math.min(e, range[1]) - Math.max(s, range[0])), 0);
}

const kept = (edl: Pick<Edl, 'clips'>): Interval[] => edl.clips.map((clip) => [clip.start, clip.end]);
const keepsMost = (edl: Pick<Edl, 'clips'>, range: Interval) => overlap(range, kept(edl)) >= (range[1] - range[0]) / 2;
const fmt = ([s, e]: Interval) => `${s.toFixed(2)}–${e.toFixed(2)}s`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const norm = (word: string) => word.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const ITEM_KEYS = ['overlays', 'broll', 'zooms', 'transitions', 'effects', 'sfx'] as const;
const ITEM_LABEL: Record<(typeof ITEM_KEYS)[number], string> = {
  overlays: 'overlay', broll: 'b-roll', zooms: 'zoom', transitions: 'transição', effects: 'efeito', sfx: 'sfx',
};
const WHOLE_KEYS = ['grade', 'audio', 'music', 'shorts', 'stabilize', 'layout', 'chapters', 'breathers', 'intro', 'outro'] as const;
const CAPTION_FIELDS = ['enabled', 'style', 'preset', 'maxWordsPerPage'] as const;

type Item = { id: string } & Record<string, unknown>;
const byId = (list: readonly object[]) => new Map((list as Item[]).map((item) => [item.id, item]));
const itemName = (item: Item) => `${item.id}${typeof item.component === 'string' ? ` (${item.component})` : ''}`;

/** O que a candidata desfaz das mudanças que o Matheus fez de `before` para `decision`, ainda de pé em `latest`. */
function revertsOf(before: Edl, decision: Edl, latest: Edl, candidate: Edl): string[] {
  const found: string[] = [];

  if (before.level !== decision.level && latest.level !== before.level && candidate.level === before.level) {
    found.push(`voltou o nível para ${before.level} (o Matheus escolheu ${decision.level})`);
  }

  for (const range of subtract(kept(before), kept(decision))) {
    if (!keepsMost(latest, range) && keepsMost(candidate, range)) found.push(`restaurou ${fmt(range)}, que o Matheus cortou`);
  }
  for (const range of subtract(kept(decision), kept(before))) {
    if (keepsMost(latest, range) && !keepsMost(candidate, range)) found.push(`cortou ${fmt(range)}, que o Matheus restaurou`);
  }

  for (const key of ITEM_KEYS) {
    const [b, d, l, c] = [before, decision, latest, candidate].map((edl) => byId(edl[key]));
    for (const [id, item] of d!) {
      const prev = b!.get(id);
      if (!prev) {
        if (l!.has(id) && !c!.has(id)) found.push(`removeu ${ITEM_LABEL[key]} ${itemName(item)}, que o Matheus inseriu`);
        continue;
      }
      const now = l!.get(id);
      const next = c!.get(id);
      if (!now || !next) continue;
      const fields = Object.keys({ ...prev, ...item }).filter((field) => !same(prev[field], item[field]));
      const undone = fields.filter((field) => !same(now[field], prev[field]) && same(next[field], prev[field]));
      if (undone.length) found.push(`desfez a edição do Matheus em ${ITEM_LABEL[key]} ${itemName(item)} (${undone.join(', ')})`);
    }
    for (const [id, item] of b!) {
      if (!d!.has(id) && !l!.has(id) && c!.has(id)) found.push(`trouxe de volta ${ITEM_LABEL[key]} ${itemName(item)}, que o Matheus removeu`);
    }
  }

  const rb = before.captions.replacements;
  const rd = decision.captions.replacements;
  for (const word of new Set([...Object.keys(rb), ...Object.keys(rd)])) {
    if (rb[word] === rd[word]) continue;
    if (latest.captions.replacements[word] !== rb[word] && candidate.captions.replacements[word] === rb[word]) {
      found.push(rd[word] === undefined
        ? `recolocou a correção de legenda '${word}'→'${rb[word]}', que o Matheus tirou`
        : `desfez a correção de legenda '${word}'→'${rd[word]}'`);
    }
  }

  const words = (edl: Edl) => new Set(edl.captions.highlights.map(norm));
  const [hb, hd, hl, hc] = [before, decision, latest, candidate].map(words);
  for (const word of hd!) if (!hb!.has(word) && hl!.has(word) && !hc!.has(word)) found.push(`tirou o destaque de '${word}', que o Matheus pôs`);
  for (const word of hb!) if (!hd!.has(word) && !hl!.has(word) && hc!.has(word)) found.push(`recolocou o destaque de '${word}', que o Matheus tirou`);

  for (const field of CAPTION_FIELDS) {
    const prev = before.captions[field];
    if (prev !== decision.captions[field] && latest.captions[field] !== prev && candidate.captions[field] === prev) {
      found.push(`voltou captions.${field} para ${String(prev)}`);
    }
  }
  for (const key of WHOLE_KEYS) {
    if (!same(before[key], decision[key]) && !same(latest[key], before[key]) && same(candidate[key], before[key])) {
      found.push(`voltou ${key} ao que era antes da decisão do Matheus`);
    }
  }
  return found;
}

/**
 * Decisões do Matheus que `candidate` desfaz. `history` = versões já gravadas (qualquer ordem), sem a candidata.
 * Só conta o que ainda está de pé na última versão: se outra versão já voltou atrás, não é esta que desfaz.
 */
export function findReverts(history: Edl[], candidate: Edl): Revert[] {
  const ordered = [...history].sort((a, b) => a.version - b.version);
  const latest = ordered.at(-1);
  if (!latest) return [];
  return ordered.flatMap((decision, index) => {
    const before = ordered[index - 1];
    if (!before || !isMatheusDecision(decision.notes)) return [];
    return revertsOf(before, decision, latest, candidate).map((what) => ({ version: decision.version, what }));
  });
}

export function formatRevert({ version, what }: Revert): string {
  return `desfaz decisão do Matheus (v${version}): ${what}`;
}
