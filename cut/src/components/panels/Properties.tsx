import { useEffect, useState } from 'react';

import type { ItemKind } from '../../../../src/cut/ops.ts';
import { sourceToOutput } from '../../../../src/edl/timeline.ts';
import { findItem, planRemove, planTrim } from '../../lib/gestures.ts';
import { buildPatch, missingReason } from '../../lib/schema-form.ts';
import { parseItemKey } from '../../lib/tracks.ts';
import { seek } from '../../playback.ts';
import { currentEdl, currentTimeline, setHint, speechOf, store, tryOps, useEditor } from '../../store.ts';
import { ItemForm } from '../ItemForm.tsx';
import { Badge, Button, Empty, inputClass, Section } from '../ui.tsx';

function ClipProps({ id }: { id: string }) {
  const edl = useEditor(currentEdl)!;
  const project = useEditor((state) => state.project)!;
  const timeline = useEditor(currentTimeline)!;
  const clip = edl.clips.find((item) => item.id === id);
  const [edges, setEdges] = useState({ start: '', end: '' });
  useEffect(() => setEdges({ start: clip ? String(clip.start) : '', end: clip ? String(clip.end) : '' }), [clip]);
  if (!clip) return <Empty>o clipe {id} não existe mais nesta versão</Empty>;
  const placed = timeline.clips.find((item) => item.id === id);
  const trim = (edge: 'start' | 'end') => {
    const value = Number(edges[edge].replace(',', '.'));
    if (!Number.isFinite(value)) return;
    const plan = planTrim(edl.clips, id, edge, value, speechOf(project));
    if (!plan.ok) return setHint({ tone: 'error', text: `recusado: ${plan.message}` });
    if (plan.op) void tryOps([plan.op], plan.message);
  };
  return (
    <>
      <Section title={`Clipe ${clip.id}`} right={<Badge>{(clip.end - clip.start).toFixed(2)}s</Badge>}>
        <p className="mb-3 text-xs leading-relaxed text-paper/90">“{clip.quote || '…'}”</p>
        {clip.reason && <p className="mb-3 text-[11px] text-s300/60">motivo: {clip.reason}</p>}
        <div className="grid grid-cols-2 gap-2">
          {(['start', 'end'] as const).map((edge) => (
            <label key={edge} className="grid gap-1">
              <span className="text-[10px] font-semibold text-s300/70">{edge === 'start' ? 'início' : 'fim'} (s da fonte)</span>
              <input
                className={inputClass}
                value={edges[edge]}
                onChange={(event) => setEdges({ ...edges, [edge]: event.target.value })}
                onBlur={() => trim(edge)}
                onKeyDown={(event) => event.key === 'Enter' && trim(edge)}
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-s300/50">A borda só para em pausa medida; um valor dentro de palavra encaixa na pausa mais próxima (até 1,5 s) ou é recusado.</p>
        {placed && <p className="mt-1 font-mono text-[10px] text-s600">saída {placed.outputStart.toFixed(2)}–{placed.outputEnd.toFixed(2)}s</p>}
      </Section>
      <Section title="Ações">
        <div className="flex flex-wrap gap-2">
          <Button small onClick={() => seek(clip.start)}>
            ir para o início
          </Button>
          <Button
            small
            tone="danger"
            onClick={() => {
              const plan = planRemove({ start: clip.start, end: clip.end }, speechOf(project), `removeu o clipe ${clip.id}`);
              if (!plan.ok || !plan.op) return setHint({ tone: 'error', text: `recusado: ${plan.message}` });
              void tryOps([plan.op], plan.message).then((ok) => ok && store.set({ selection: [] }));
            }}
          >
            remover clipe
          </Button>
        </div>
      </Section>
    </>
  );
}

function ItemProps({ kind, id }: { kind: ItemKind; id: string }) {
  const edl = useEditor(currentEdl)!;
  const timeline = useEditor(currentTimeline)!;
  const item = findItem(edl, kind, id) as Record<string, unknown> | undefined;
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  useEffect(() => setDraft(item ? structuredClone(item) : null), [item]);
  if (!item || !draft) return <Empty>{kind} “{id}” não existe mais nesta versão</Empty>;
  const patch = buildPatch(item, draft);
  const changed = Object.keys(patch).length > 0;
  const noReason = missingReason(kind, draft);
  const at = (item.at ?? item.start) as number | undefined;
  const orphan = at !== undefined && sourceToOutput(timeline, at) === null;
  return (
    <>
      <Section title={`${kind} · ${id}`} right={<Badge tone={orphan ? 'coral' : 'peri'}>{orphan ? 'em trecho cortado' : String(item.component ?? item.preset ?? item.type ?? item.file ?? '')}</Badge>}>
        <ItemForm key={`${kind}:${id}`} kind={kind} value={draft} onChange={setDraft} />
      </Section>
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-paper/10 bg-s900 px-3 py-2">
        <Button
          tone="primary"
          small
          disabled={!changed || noReason}
          title={noReason ? 'reason é obrigatório (STYLE.md §1)' : ''}
          onClick={() => void tryOps([{ type: 'updateItem', kind, id, patch }])}
        >
          aplicar
        </Button>
        <Button small tone="ghost" disabled={!changed} onClick={() => setDraft(structuredClone(item))}>
          desfazer campos
        </Button>
        <div className="flex-1" />
        {at !== undefined && (
          <Button small tone="ghost" onClick={() => seek(at)}>
            ir
          </Button>
        )}
        <Button small tone="danger" onClick={() => void tryOps([{ type: 'removeItem', kind, id }]).then((ok) => ok && store.set({ selection: [] }))}>
          remover
        </Button>
        {noReason && <span className="w-full text-[10px] text-coral">sem reason não salva: diga o que este item reforça na fala</span>}
      </div>
    </>
  );
}

export function PropertiesPanel() {
  const selection = useEditor((state) => state.selection);
  const edl = useEditor(currentEdl)!;
  if (selection.length === 0) {
    return (
      <>
        <Empty>Selecione um item ou clipe na timeline para editar. Formulário gerado do schema da EDL; reason é obrigatório.</Empty>
        <Section title="Esta versão">
          <ul className="grid grid-cols-2 gap-1 text-[11px] text-s300">
            <li>{edl.clips.length} clipes</li>
            <li>{edl.overlays.length} gráficos</li>
            <li>{edl.zooms.length} zooms</li>
            <li>{edl.effects.length} efeitos</li>
            <li>{edl.transitions.length} transições</li>
            <li>{edl.broll.length} b-roll</li>
          </ul>
        </Section>
      </>
    );
  }
  if (selection.length > 1) return <Empty>{selection.length} itens selecionados · Delete remove todos</Empty>;
  const { kind, id } = parseItemKey(selection[0]!);
  if (kind === 'clip') return <ClipProps id={id} />;
  if (kind === 'removed') return <Empty>trecho cortado: restaure pela timeline</Empty>;
  return <ItemProps kind={kind} id={id} />;
}
