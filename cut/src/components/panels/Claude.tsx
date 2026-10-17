import { useEffect, useRef, useState } from 'react';

import { api } from '../../api.ts';
import { normalizeRange } from '../../lib/gestures.ts';
import { parseItemKey } from '../../lib/tracks.ts';
import { askClaude, pendingOps, settleClaude, store, useEditor } from '../../store.ts';
import { Badge, Button, Section } from '../ui.tsx';

const EXAMPLES = ['tira as hesitações do bloco 3', 'põe um LowerThird quando eu falo do Vite', 'revisa as legendas do trecho marcado'];

export function ClaudePanel() {
  const slug = useEditor((state) => state.slug)!;
  const latest = useEditor((state) => state.project?.latest);
  const pending = useEditor((state) => pendingOps(state).length);
  const running = useEditor((state) => state.claudeRunning);
  const events = useEditor((state) => state.claudeEvents);
  const done = useEditor((state) => state.claudeDone);
  const markIn = useEditor((state) => state.markIn);
  const markOut = useEditor((state) => state.markOut);
  const selection = useEditor((state) => state.selection);
  const [instruction, setInstruction] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const range = normalizeRange(markIn, markOut);
  const ids = selection.map((key) => parseItemKey(key).id);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [events.length]);

  const send = () => {
    const text = instruction.trim();
    if (!text) return;
    const scope = range || ids.length ? { ...(range ? { start: range.start, end: range.end } : {}), ...(ids.length ? { ids } : {}) } : undefined;
    void askClaude(text, scope);
  };

  return (
    <div className="flex h-full flex-col">
      <Section title="Claude Code" right={<Badge tone="peri">parte da v{latest}</Badge>}>
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) send();
          }}
          rows={3}
          placeholder="o que mudar na edição… (Ctrl+Enter envia)"
          className="w-full resize-none rounded-md border border-paper/10 bg-night/60 p-2 text-xs text-paper outline-none placeholder:text-s600 focus:border-coral/60"
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" onClick={() => setInstruction(example)} className="rounded bg-paper/[0.05] px-1.5 py-0.5 text-[10px] text-s300/60 hover:text-paper">
              {example}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-s300/60">
          seleção enviada:{' '}
          {range ? (
            <span className="text-coral">
              {range.start.toFixed(2)}–{range.end.toFixed(2)}s
            </span>
          ) : (
            'nenhum trecho'
          )}
          {ids.length > 0 && <span className="text-peri"> · {ids.join(', ')}</span>}
        </div>
        <div className="mt-2 flex gap-2">
          <Button tone="primary" disabled={running || pending > 0 || !instruction.trim()} onClick={send}>
            {running ? 'trabalhando…' : 'pedir ao Claude'}
          </Button>
          {running && (
            <Button tone="ghost" onClick={() => void api.claudeCancel(slug)}>
              cancelar
            </Button>
          )}
        </div>
        {pending > 0 && <p className="mt-2 text-[10px] text-peach">salve ou descarte as {pending} operações locais antes: o Claude parte da versão salva.</p>}
        <p className="mt-2 text-[10px] leading-relaxed text-s300/40">
          Sessão headless com as skills edit-video/edl-reference. Responde sempre com uma nova versão da EDL; versões com notes “Matheus:” são decisão sua e
          não são desfeitas.
        </p>
      </Section>

      <div ref={log} className="min-h-0 flex-1 space-y-1.5 overflow-auto px-3 py-2">
        {events.length === 0 && !done && <p className="text-[11px] text-s300/40">o progresso da sessão aparece aqui</p>}
        {events.map((event, index) => {
          if (event.kind === 'start') return <div key={index} className="text-[10px] text-s300/50">▸ sessão começou sobre a v{event.baseVersion}</div>;
          if (event.kind === 'tool')
            return (
              <div key={index} className="truncate font-mono text-[10px] text-peri/80" title={event.detail}>
                ⚙ {event.name} {event.detail}
              </div>
            );
          if (event.kind === 'text') return <div key={index} className="text-xs leading-relaxed whitespace-pre-wrap text-paper/90">{event.text}</div>;
          return (
            <div key={index} className={`text-[10px] ${event.ok ? 'text-emerald' : 'text-coral'}`}>
              ■ {event.ok ? 'concluído' : 'falhou'}
              {event.turns !== null ? ` · ${event.turns} turnos` : ''}
              {event.costUsd !== null ? ` · US$ ${event.costUsd.toFixed(3)}` : ''}
            </div>
          );
        })}
        {running && <div className="animate-pulse text-[10px] text-s300/50">…</div>}
      </div>

      {done && (
        <div className="border-t border-paper/10 bg-s900/70 p-3">
          {done.proposedVersion ? (
            <>
              <div className="mb-1.5 text-xs font-bold">
                Proposta: <span className="text-coral">v{done.proposedVersion}</span> <span className="font-normal text-s300/60">(sobre a v{done.baseVersion})</span>
              </div>
              <ul className="mb-2 space-y-0.5 font-mono text-[11px]">
                {done.diff.map((line) => (
                  <li key={line} className="rounded bg-paper/[0.04] px-1.5 py-0.5">
                    {line}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button tone="ok" onClick={() => void settleClaude(true)}>
                  aceitar v{done.proposedVersion}
                </Button>
                <Button tone="danger" onClick={() => void settleClaude(false)}>
                  rejeitar (volta à v{done.baseVersion})
                </Button>
                <Button tone="ghost" onClick={() => store.set({ left: 'versions' })}>
                  comparar
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] text-s300/40">Rejeitar grava uma versão nova igual à base; nada é apagado.</p>
            </>
          ) : (
            <p className="text-[11px] text-peach">a sessão terminou sem gravar versão nova{done.result ? `: ${done.result.slice(0, 200)}` : ''}</p>
          )}
        </div>
      )}
    </div>
  );
}
