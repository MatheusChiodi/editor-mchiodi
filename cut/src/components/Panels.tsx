import { type LeftPanel, pendingOps, type RightPanel, store, useEditor } from '../store.ts';
import { ArsenalPanel } from './panels/Arsenal.tsx';
import { CaptionsPanel } from './panels/Captions.tsx';
import { ClaudePanel } from './panels/Claude.tsx';
import { EvalPanel } from './panels/Eval.tsx';
import { LevelPanel } from './panels/Level.tsx';
import { PropertiesPanel } from './panels/Properties.tsx';
import { RenderPanel } from './panels/Render.tsx';
import { VersionsPanel } from './panels/Versions.tsx';
import { Badge, Tabs } from './ui.tsx';

export function LeftPanels() {
  const left = useEditor((state) => state.left);
  const claudeRunning = useEditor((state) => state.claudeRunning);
  const proposal = useEditor((state) => Boolean(state.claudeDone?.proposedVersion));
  const versions = useEditor((state) => state.project?.versions.length ?? 0);
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-paper/10 bg-s900/40">
      <Tabs<LeftPanel>
        value={left}
        onChange={(value) => store.set({ left: value })}
        items={[
          { id: 'arsenal', label: 'Arsenal' },
          { id: 'captions', label: 'Legendas' },
          { id: 'versions', label: 'Versões', badge: <span className="text-[10px] text-s300/40">{versions}</span> },
          { id: 'claude', label: 'Claude', badge: claudeRunning ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-peri" /> : proposal ? <Badge tone="coral">!</Badge> : undefined },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {left === 'arsenal' && <ArsenalPanel />}
        {left === 'captions' && <CaptionsPanel />}
        {left === 'versions' && <VersionsPanel />}
        {left === 'claude' && <ClaudePanel />}
      </div>
    </aside>
  );
}

export function RightPanels() {
  const right = useEditor((state) => state.right);
  const running = useEditor((state) => state.job?.status === 'running');
  const findings = useEditor((state) => state.evals?.findings.length ?? 0);
  const pending = useEditor((state) => pendingOps(state).length);
  return (
    <aside className="flex w-[350px] shrink-0 flex-col border-l border-paper/10 bg-s900/40">
      <Tabs<RightPanel>
        value={right}
        onChange={(value) => store.set({ right: value })}
        items={[
          { id: 'properties', label: 'Propriedades', badge: pending ? <span className="h-1.5 w-1.5 rounded-full bg-coral" /> : undefined },
          { id: 'level', label: 'Nível' },
          { id: 'render', label: 'Render', badge: running ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-peri" /> : undefined },
          { id: 'eval', label: 'Avaliação', badge: findings ? <span className="text-[10px] text-peach">{findings}</span> : undefined },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        {right === 'properties' && <PropertiesPanel />}
        {right === 'level' && <LevelPanel />}
        {right === 'render' && <RenderPanel />}
        {right === 'eval' && <EvalPanel />}
      </div>
    </aside>
  );
}
