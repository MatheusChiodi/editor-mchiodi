import { useEffect, useState } from 'react';

import type { ItemKind } from '../../../../src/cut/ops.ts';
import { api, type ArsenalItem } from '../../api.ts';
import { type ArsenalKind, draftInsert, INSERTABLE } from '../../lib/insert.ts';
import { itemKey } from '../../lib/tracks.ts';
import { missingReason } from '../../lib/schema-form.ts';
import { currentEdl, currentTimeline, playhead, store, tryOps, useEditor } from '../../store.ts';
import { ItemForm } from '../ItemForm.tsx';
import { Badge, Button, Empty, inputClass } from '../ui.tsx';

const KINDS: { id: ArsenalKind; label: string }[] = [
  { id: 'components', label: 'Gráficos' },
  { id: 'models', label: 'Modelos' },
  { id: 'tech', label: 'Tech' },
  { id: 'entrances', label: 'Entradas' },
  { id: 'transitions', label: 'Transições' },
  { id: 'effects', label: 'Efeitos' },
  { id: 'themes', label: 'Temas' },
  { id: 'captions', label: 'Legendas' },
];

function InsertForm({ kind, item, onDone }: { kind: ArsenalKind; item: ArsenalItem; onDone: () => void }) {
  const [draft, setDraft] = useState<{ kind: ItemKind; item: Record<string, unknown> } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import('../../registry-lookup.ts').then(({ lookupComponent }) => {
      if (!alive) return;
      const state = store.get();
      const timeline = currentTimeline(state)!;
      const edl = currentEdl(state)!;
      const result = draftInsert(kind, item.id, playhead.get().source, timeline, edl.transitions, lookupComponent);
      setMessage(result.message);
      setDraft(result.ok && result.kind && result.item ? { kind: result.kind, item: result.item } : null);
    });
    return () => {
      alive = false;
    };
  }, [kind, item.id]);

  const insert = async () => {
    if (!draft) return;
    const ok = await tryOps([{ type: 'insertItem', kind: draft.kind, item: draft.item }], message);
    if (!ok) return;
    const edl = currentEdl(store.get());
    const created = edl ? (edl[draft.kind] as { id: string }[]).at(-1) : undefined;
    if (created) store.set({ selection: [itemKey(draft.kind, created.id)], right: 'properties' });
    onDone();
  };

  const noReason = draft ? missingReason(draft.kind, draft.item) : true;
  return (
    <div className="border-t border-coral/30 bg-s900/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold">
          inserir <span className="text-coral">{item.id}</span>
        </span>
        <Button small tone="ghost" onClick={onDone}>
          cancelar
        </Button>
      </div>
      {message && <p className="mb-2 text-[11px] text-peach">{message}</p>}
      {draft && (
        <>
          <p className="mb-2 text-[10px] text-s300/50">no playhead · {INSERTABLE[kind]}</p>
          <div className="max-h-[38vh] overflow-auto pr-1">
            <ItemForm key={item.id} kind={draft.kind} value={draft.item} onChange={(next) => setDraft({ ...draft, item: next })} />
          </div>
          <Button tone="primary" className="mt-2 w-full justify-center" disabled={noReason} onClick={() => void insert()}>
            {noReason ? 'escreva o motivo para inserir' : 'inserir na timeline'}
          </Button>
        </>
      )}
    </div>
  );
}

export function ArsenalPanel() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ArsenalKind>('components');
  const [kinds, setKinds] = useState<Record<string, ArsenalItem[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = useEditor((state) => state.arsenalPick);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api
        .arsenal(query)
        .then((result) => {
          setKinds(result.kinds);
          setError(null);
        })
        .catch((reason: unknown) => setError(String(reason)));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const items = kinds?.[kind] ?? [];
  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <input className={inputClass} placeholder="buscar no arsenal (ex.: lista, comparação, react)…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="mt-2 flex flex-wrap gap-1">
          {KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setKind(item.id)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${kind === item.id ? 'bg-coral text-paper' : 'bg-paper/[0.06] text-s300/70 hover:text-paper'}`}
            >
              {item.label} <span className="opacity-60">{kinds?.[item.id]?.length ?? ''}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {error && <Empty>{error}</Empty>}
        {!kinds && !error && <Empty>carregando o arsenal…</Empty>}
        {kinds && items.length === 0 && <Empty>nada encontrado</Empty>}
        <div className="grid grid-cols-2 gap-1.5">
          {items.slice(0, 120).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => store.set({ arsenalPick: { kind, item } })}
              className={`overflow-hidden rounded-md border text-left transition-colors ${pick?.item.id === item.id ? 'border-coral' : 'border-paper/10 hover:border-paper/30'}`}
              title={`${item.description}\n\n${item.usage}`}
            >
              <div className="flex aspect-video items-center justify-center bg-ink">
                {item.gallery ? (
                  <img src={item.gallery} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="px-1 text-center font-display text-[13px] text-s300/60 italic">{item.id.replace(/^tech:/, '')}</span>
                )}
              </div>
              <div className="px-1.5 py-1">
                <div className="truncate text-[11px] font-semibold">{item.id.replace(/^tech:/, '')}</div>
                <div className="line-clamp-2 text-[9px] leading-tight text-s300/50">{item.description}</div>
              </div>
            </button>
          ))}
        </div>
        {items.length > 120 && <p className="mt-2 text-center text-[10px] text-s300/40">+{items.length - 120}: refine a busca</p>}
      </div>
      {pick && !INSERTABLE[pick.kind as ArsenalKind] && (
        <div className="border-t border-paper/10 p-3 text-[11px] text-s300/70">
          <Badge>{pick.item.id}</Badge> <span className="ml-1">{pick.item.usage}</span>
        </div>
      )}
      {pick && INSERTABLE[pick.kind as ArsenalKind] && <InsertForm kind={pick.kind as ArsenalKind} item={pick.item} onDone={() => store.set({ arsenalPick: null })} />}
    </div>
  );
}
