import { useState } from 'react';

import { canRedo, canUndo } from '../../../src/cut/history.ts';
import { SHORTCUTS } from '../lib/keys.ts';
import { currentEdl, discardEdits, pendingOps, redoEdit, saveEdits, store, undoEdit, useEditor } from '../store.ts';
import { Badge, Button, Kbd, Modal } from './ui.tsx';

export function TopBar() {
  const slug = useEditor((state) => state.slug);
  const latest = useEditor((state) => state.project?.latest);
  const level = useEditor((state) => currentEdl(state)?.level);
  const savedLevel = useEditor((state) => state.project?.edl?.level);
  const pending = useEditor((state) => pendingOps(state).length);
  const steps = useEditor((state) => state.history.done.length);
  const history = useEditor((state) => state.history);
  const notes = useEditor((state) => state.preview?.notes ?? '');
  const saving = useEditor((state) => state.saving);
  const conflict = useEditor((state) => state.conflict !== null);
  const [help, setHelp] = useState(false);
  const [message, setMessage] = useState('');

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-paper/10 bg-s900/60 px-3">
      <a href="/" className="font-display text-[15px] leading-none">
        MChiodi <span className="text-coral italic">Cut</span>
      </a>
      <span className="h-4 w-px bg-paper/15" />
      <span className="font-semibold text-s300">{slug}</span>
      <Badge tone="emerald">v{latest}</Badge>
      <button type="button" onClick={() => store.set({ right: 'level' })} title="nível de edição (só você troca)">
        <Badge tone={level !== savedLevel ? 'peach' : 'peri'}>nível {level}</Badge>
      </button>

      <div className="mx-2 flex min-w-0 flex-1 items-center gap-2">
        {pending > 0 ? (
          <>
            <Badge tone="coral">
              {steps} {steps === 1 ? 'edição' : 'edições'} não salvas
            </Badge>
            <span className="truncate text-[11px] text-s300/60" title={notes}>
              {notes}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-s300/40">sem edições locais · a EDL salva é a verdade</span>
        )}
      </div>

      <Button tone="ghost" small disabled={!canUndo(history)} onClick={undoEdit} title="desfazer (Ctrl+Z)">
        ↶ desfazer
      </Button>
      <Button tone="ghost" small disabled={!canRedo(history)} onClick={redoEdit} title="refazer (Ctrl+Shift+Z)">
        ↷ refazer
      </Button>
      {pending > 0 && (
        <>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="nota (opcional)"
            className="h-7 w-40 rounded-md border border-paper/10 bg-night/60 px-2 text-xs outline-none focus:border-coral/60"
          />
          <Button tone="ghost" small onClick={discardEdits} title="descarta o lote local (a EDL salva não muda)">
            descartar
          </Button>
        </>
      )}
      <Button
        tone="primary"
        disabled={pending === 0 || saving || conflict}
        onClick={() => void saveEdits(message.trim() || undefined).then(() => setMessage(''))}
        title={conflict ? 'resolva o conflito antes' : 'salvar como nova versão (Ctrl+S)'}
      >
        {saving ? 'salvando…' : `salvar v${(latest ?? 0) + 1}`}
      </Button>
      <Button tone="ghost" small onClick={() => setHelp(true)} title="atalhos">
        ?
      </Button>
      {help && (
        <Modal title="Atalhos" onClose={() => setHelp(false)}>
          <ul className="space-y-2">
            {SHORTCUTS.map((item) => (
              <li key={item.keys} className="flex items-center justify-between gap-4 text-xs">
                <Kbd>{item.keys}</Kbd>
                <span className="text-right text-s300">{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-s300/60">
            Arraste a borda de um clipe para aparar: ela só para em pausa medida (faixas verdes na trilha de áudio). Arraste no fundo das trilhas
            para marcar um trecho. Ctrl+roda dá zoom; a roda rola a timeline.
          </p>
        </Modal>
      )}
    </header>
  );
}
