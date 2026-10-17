import { useState } from 'react';

import { api } from '../../api.ts';
import { percentFromLine } from '../../lib/ui.ts';
import { currentEdl, startJob, useEditor } from '../../store.ts';
import { Badge, Button, inputClass, Section } from '../ui.tsx';

const FORMATS = [
  { id: '16x9', label: '16:9', hint: 'YouTube (padrão)' },
  { id: '9x16', label: '9:16', hint: 'Shorts/Reels' },
  { id: '1x1', label: '1:1', hint: 'feed' },
] as const;

export function RenderPanel() {
  const slug = useEditor((state) => state.slug)!;
  const latest = useEditor((state) => state.project?.latest);
  const hasShorts = useEditor((state) => Boolean(currentEdl(state)?.shorts));
  const job = useEditor((state) => state.job);
  const log = useEditor((state) => state.jobLog);
  const progress = useEditor((state) => state.jobProgress);
  const [format, setFormat] = useState<(typeof FORMATS)[number]['id']>('16x9');
  const [fit, setFit] = useState<'blur-pad' | 'center-crop'>('blur-pad');
  const [focusX, setFocusX] = useState(0.5);
  const [scope, setScope] = useState<'full' | 'shorts'>('full');
  const running = job?.status === 'running';
  const lastPercent = progress?.percent ?? [...log].reverse().map(percentFromLine).find((value) => value !== null) ?? null;

  return (
    <>
      <Section title={`Render da v${latest}`}>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={running} onClick={() => void startJob({ kind: 'render' })} title="mce render (preview rápido)">
            render preview
          </Button>
          <Button tone="primary" disabled={running} onClick={() => void startJob({ kind: 'final' })} title="mce render --final">
            render final
          </Button>
          <Button disabled={running || !hasShorts} onClick={() => void startJob({ kind: 'shorts' })} title={hasShorts ? 'mce render --shorts --final' : 'a EDL não tem trecho de Short'}>
            render Short
          </Button>
          <Button disabled={running} onClick={() => void startJob({ kind: 'eval' })} title="mce eval: os achados viram marcadores na timeline">
            pedir avaliação
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-s300/50">O render é sempre o `mce render` sobre a última versão salva da EDL.</p>
      </Section>

      <Section title="Exportar formato">
        <div className="grid grid-cols-3 gap-1">
          {FORMATS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFormat(item.id)}
              className={`rounded-md border px-1 py-1.5 text-[11px] ${format === item.id ? 'border-coral bg-coral/15 font-bold' : 'border-paper/10 text-s300/70'}`}
            >
              {item.label}
              <div className="text-[9px] font-normal text-s300/50">{item.hint}</div>
            </button>
          ))}
        </div>
        {format !== '16x9' && (
          <div className="mt-2 grid gap-2">
            <label className="grid gap-1">
              <span className="text-[10px] font-semibold text-s300/70">encaixe</span>
              <select className={inputClass} value={fit} onChange={(event) => setFit(event.target.value as typeof fit)}>
                <option value="blur-pad">blur-pad (quadro inteiro sobre fundo desfocado)</option>
                <option value="center-crop">center-crop (recorte com foco)</option>
              </select>
            </label>
            {fit === 'center-crop' && (
              <label className="grid gap-1">
                <span className="text-[10px] font-semibold text-s300/70">foco horizontal: {focusX.toFixed(2)}</span>
                <input type="range" min={0} max={1} step={0.01} value={focusX} onChange={(event) => setFocusX(Number(event.target.value))} className="accent-coral" />
              </label>
            )}
          </div>
        )}
        <label className="mt-2 flex items-center gap-2 text-[11px] text-s300">
          <input type="checkbox" checked={scope === 'shorts'} disabled={!hasShorts} onChange={(event) => setScope(event.target.checked ? 'shorts' : 'full')} className="accent-coral" />
          só o trecho do Short
        </label>
        <Button
          className="mt-2 w-full justify-center"
          disabled={running}
          onClick={() =>
            void startJob({ kind: 'export', export: { format, ...(format !== '16x9' ? { fit } : {}), ...(format !== '16x9' && fit === 'center-crop' ? { focusX } : {}), scope } })
          }
        >
          exportar renders/{slug}-{format}.mp4
        </Button>
      </Section>

      <Section
        title="Job"
        right={
          job && (
            <Badge tone={job.status === 'done' ? 'emerald' : job.status === 'running' ? 'peri' : 'coral'}>
              {job.kind} · {job.status}
            </Badge>
          )
        }
      >
        {!job && <p className="text-[11px] text-s300/50">nenhum job ainda</p>}
        {job && (
          <>
            {running && (
              <>
                <div className="mb-1 flex justify-between text-[10px] text-s300/70">
                  <span>{progress?.label ?? 'rodando…'}</span>
                  <span>
                    {lastPercent !== null ? `${Math.round(lastPercent)}%` : ''}
                    {progress?.etaSec ? ` · ${Math.round(progress.etaSec)}s` : ''}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-paper/10">
                  <div className="h-full bg-coral transition-all" style={{ width: `${lastPercent ?? 3}%` }} />
                </div>
                <Button small tone="ghost" className="mt-2" onClick={() => void api.cancelJob(slug)}>
                  cancelar
                </Button>
              </>
            )}
            {job.status === 'done' && job.url && (
              <div className="grid gap-2">
                <video src={job.url} controls className="w-full rounded border border-paper/10" />
                <a href={job.url} target="_blank" rel="noreferrer" className="text-[11px] text-coral underline">
                  abrir resultado
                </a>
              </div>
            )}
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-night/70 p-2 font-mono text-[10px] leading-snug whitespace-pre-wrap text-s300/70">
              {(log.length ? log : (job.log ?? [])).slice(-40).join('\n') || '…'}
            </pre>
          </>
        )}
      </Section>
    </>
  );
}
