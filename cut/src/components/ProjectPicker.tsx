import { useEffect } from 'react';

import { listProjects, useEditor } from '../store.ts';
import { Badge, Empty } from './ui.tsx';

export function ProjectPicker({ error }: { error?: string }) {
  const projects = useEditor((state) => state.projects);
  useEffect(() => {
    void listProjects();
  }, []);
  return (
    <div className="flex h-full flex-col items-center overflow-auto py-16">
      <h1 className="font-display text-3xl">
        MChiodi <span className="text-coral italic">Cut</span>
      </h1>
      <p className="mt-2 text-xs text-s300/60">editor visual sobre a EDL · tudo local</p>
      {error && <p className="mt-6 max-w-lg rounded-md border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">{error}</p>}
      <div className="mt-8 w-[min(520px,90vw)] overflow-hidden rounded-xl border border-paper/10">
        {projects === null && <Empty>carregando projetos…</Empty>}
        {projects?.length === 0 && <Empty>nenhum projeto. Rode pnpm mce analyze &lt;vídeo&gt;.</Empty>}
        {projects?.map((project) => (
          <a
            key={project.slug}
            href={project.analyzed && project.latest ? `/?p=${project.slug}` : undefined}
            className={`flex items-center justify-between border-b border-paper/[0.06] px-4 py-3 last:border-0 ${project.analyzed && project.latest ? 'hover:bg-paper/[0.05]' : 'cursor-not-allowed opacity-40'}`}
          >
            <span className="font-semibold">{project.slug}</span>
            <span className="flex gap-2">
              {!project.analyzed && <Badge>sem análise</Badge>}
              {project.latest ? <Badge tone="emerald">v{project.latest}</Badge> : <Badge>sem EDL</Badge>}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
