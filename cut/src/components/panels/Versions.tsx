import { useEffect, useState } from 'react';

import { api } from '../../api.ts';
import { formatClock } from '../../lib/timemap.ts';
import { revertVersion, useEditor } from '../../store.ts';
import { Badge, Button, Section } from '../ui.tsx';

export function VersionsPanel() {
  const project = useEditor((state) => state.project)!;
  const versions = [...project.versions].reverse();
  const latest = project.latest!;
  const [pair, setPair] = useState<[number, number]>([Math.max(1, latest - 1), latest]);
  const [diff, setDiff] = useState<string[] | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);

  useEffect(() => setPair([Math.max(1, latest - 1), latest]), [latest]);
  useEffect(() => {
    if (pair[0] === pair[1]) return setDiff([]);
    let alive = true;
    api
      .diff(project.slug, pair[0], pair[1])
      .then((result) => alive && setDiff(result.lines))
      .catch(() => alive && setDiff(null));
    return () => {
      alive = false;
    };
  }, [project.slug, pair]);

  return (
    <div className="flex h-full flex-col">
      <Section title={`Diferença v${pair[0]} → v${pair[1]}`}>
        <div className="mb-2 flex items-center gap-2 text-[11px] text-s300/70">
          <span className="inline-block h-2 w-2 rounded-full bg-peri" /> A <span className="inline-block h-2 w-2 rounded-full bg-coral" /> B — clique nas bolinhas da lista
        </div>
        {diff === null && <p className="text-[11px] text-coral">não consegui comparar</p>}
        {diff?.length === 0 && <p className="text-[11px] text-s300/50">sem diferença</p>}
        <ul className="space-y-0.5 font-mono text-[11px]">
          {diff?.map((line) => {
            const plus = /\+[1-9]/.test(line);
            const minus = /-[1-9]/.test(line);
            return (
              <li key={line} className={`rounded px-1.5 py-0.5 ${plus && !minus ? 'bg-emerald/10 text-emerald' : minus && !plus ? 'bg-coral/10 text-coral' : 'bg-paper/[0.04] text-paper/90'}`}>
                {line}
              </li>
            );
          })}
        </ul>
      </Section>
      <div className="min-h-0 flex-1 overflow-auto">
        {versions.map((info) => (
          <div key={info.version} className="flex gap-2 border-b border-paper/[0.05] px-3 py-2">
            <div className="flex flex-col gap-1 pt-0.5">
              <button
                type="button"
                title="comparar como A"
                onClick={() => setPair([info.version, pair[1]])}
                className={`h-3 w-3 rounded-full border ${pair[0] === info.version ? 'border-peri bg-peri' : 'border-paper/25'}`}
              />
              <button
                type="button"
                title="comparar como B"
                onClick={() => setPair([pair[0], info.version])}
                className={`h-3 w-3 rounded-full border ${pair[1] === info.version ? 'border-coral bg-coral' : 'border-paper/25'}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold">v{info.version}</span>
                {info.version === latest && <Badge tone="emerald">atual</Badge>}
                {info.byMatheus ? <Badge tone="coral">Matheus</Badge> : <Badge tone="peri">Claude/mce</Badge>}
                <Badge>{info.level}</Badge>
                {info.durationSec !== null && <span className="font-mono text-[10px] text-s300/50">{formatClock(info.durationSec)}</span>}
              </div>
              <p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-s300/70" title={info.notes}>
                {info.notes || 'sem notes'}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-s600">
                {info.createdAt ? new Date(info.createdAt).toLocaleString('pt-BR') : ''}
                {info.version !== latest &&
                  (confirm === info.version ? (
                    <>
                      <Button small tone="danger" onClick={() => void revertVersion(info.version).then(() => setConfirm(null))}>
                        criar v{latest + 1} igual à v{info.version}
                      </Button>
                      <Button small tone="ghost" onClick={() => setConfirm(null)}>
                        não
                      </Button>
                    </>
                  ) : (
                    <Button small tone="ghost" onClick={() => setConfirm(info.version)}>
                      voltar para esta
                    </Button>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
