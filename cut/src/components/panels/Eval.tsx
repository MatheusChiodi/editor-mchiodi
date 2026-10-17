import { seek } from '../../playback.ts';
import { startJob, useEditor } from '../../store.ts';
import { Badge, Button, Empty, Section } from '../ui.tsx';

const TONE = { error: 'coral', warning: 'peach', info: 'peri' } as const;

export function EvalPanel() {
  const evals = useEditor((state) => state.evals);
  const latest = useEditor((state) => state.project?.latest);
  const running = useEditor((state) => state.job?.status === 'running');
  return (
    <>
      <Section
        title="Avaliação"
        right={
          <Button small disabled={running} onClick={() => void startJob({ kind: 'eval' })}>
            pedir avaliação
          </Button>
        }
      >
        {!evals && <Empty>sem avaliação ainda: o `mce eval` precisa de um render da versão</Empty>}
        {evals && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge tone={evals.passed ? 'emerald' : 'coral'}>{evals.passed ? 'aprovado' : 'reprovado'}</Badge>
            <span className="text-s300/70">da v{evals.edlVersion}</span>
            {evals.edlVersion !== latest && <Badge tone="peach">versão atual é v{latest}: os marcadores são pelo tempo da fonte</Badge>}
            <span className="text-s300/50">{evals.findings.length} achados</span>
          </div>
        )}
        {evals?.contactSheet && (
          <a href={evals.contactSheet} target="_blank" rel="noreferrer" className="mt-2 block">
            <img src={evals.contactSheet} alt="prancha dos cortes suspeitos" className="w-full rounded border border-paper/10" />
          </a>
        )}
      </Section>
      {evals && (
        <ul>
          {evals.findings.map((finding, index) => (
            <li key={index} className="border-b border-paper/[0.05] px-3 py-2">
              <button type="button" className="w-full text-left" disabled={finding.sourceSec === null} onClick={() => finding.sourceSec !== null && seek(finding.sourceSec)}>
                <div className="mb-0.5 flex items-center gap-2">
                  <Badge tone={TONE[finding.severity as keyof typeof TONE] ?? 'default'}>{finding.check}</Badge>
                  {finding.outputSec !== null && <span className="font-mono text-[10px] text-s300/60">{finding.outputSec.toFixed(2)}s</span>}
                </div>
                <div className="text-[11px] leading-snug text-paper/90">{finding.message}</div>
                <div className="mt-0.5 text-[10px] leading-snug text-s300/50">→ {finding.fix}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
