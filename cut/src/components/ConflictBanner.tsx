import { useState } from 'react';

import { discardAndReload, rebaseEdits, store, useEditor } from '../store.ts';
import { Button } from './ui.tsx';

/** Versão nova chegou com edição local não salva: o Matheus escolhe; nada é descartado sozinho. */
export function ConflictBanner() {
  const conflict = useEditor((state) => state.conflict);
  const dropped = useEditor((state) => state.rebaseDropped);
  const [open, setOpen] = useState(false);
  if (!conflict) return null;
  return (
    <div className="shrink-0 border-b border-peach/40 bg-peach/10 px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-peach">Conflito de versão.</strong>
        <span className="text-paper/90">
          {conflict.origin === 'external' ? 'Chegou' : 'O servidor recusou o salvamento: já existe'} a v{conflict.current} (Claude, terminal ou outra aba) e você tem{' '}
          {conflict.pendingOps} {conflict.pendingOps === 1 ? 'operação' : 'operações'} sobre a v{conflict.base} sem salvar.
        </span>
        <Button small onClick={() => setOpen(!open)}>
          {open ? 'esconder' : 'ver o que mudou'}
        </Button>
        <Button small tone="ok" onClick={() => void rebaseEdits()}>
          reaplicar minhas edições na v{conflict.current}
        </Button>
        <Button small tone="danger" onClick={() => void discardAndReload()}>
          descartar as minhas e abrir a v{conflict.current}
        </Button>
        <Button small tone="ghost" onClick={() => store.set({ conflict: null })} title="continua editando; salvar seguirá recusado até escolher">
          decidir depois
        </Button>
      </div>
      {dropped && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-coral">
          A operação {dropped.index + 1} ({dropped.op.type}) não cabe na v{conflict.current}: {dropped.error}
          <Button small tone="danger" onClick={() => void rebaseEdits(dropped.index)}>
            reaplicar sem ela
          </Button>
        </div>
      )}
      {open && (
        <div className="mt-2 grid gap-1 rounded-md bg-night/50 p-2 font-mono text-[11px]">
          {conflict.since.map((item) => (
            <div key={item.version}>
              <span className="text-emerald">v{item.version}</span> {item.notes}
            </div>
          ))}
          {conflict.diff.map((line) => (
            <div key={line} className="text-s300">
              · {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
