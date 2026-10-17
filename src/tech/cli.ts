import type { Command } from 'commander';

import type { Transcript } from '../analyze/types.ts';
import { levelProfile } from '../edl/levels.ts';
import { listVersions, loadEdl } from '../edl/store.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { findMissingTechIcons } from '../eval/tech.ts';
import { readJson, requireProject } from '../project/paths.ts';
import { findTechMentions } from './detect.ts';
import { formatTechCoverage, techCoverage } from './report.ts';

/** `mce tech <projeto>`: as tecnologias citadas na fala, onde, e se a EDL atual já mostra o ícone de cada uma. */
export function registerTech(program: Command, log: (message: string) => void): void {
  program
    .command('tech <project>')
    .description('Tecnologias citadas na fala (React, Docker, VS Code…): quantas vezes, onde, e se a EDL atual já mostra o ícone; código 2 se faltar ícone no nível da EDL')
    .option('--edl <n>', 'versão da EDL (padrão: a mais recente, se houver)', Number)
    .action((project: string, options: { edl?: number }) => {
      const paths = requireProject(project);
      const { words } = readJson<Transcript>(paths.words);
      const mentions = findTechMentions(words);
      const edl = listVersions(paths).length ? loadEdl(paths, options.edl) : null;
      const timeline = edl ? buildTimeline(edl.clips, edl.output.fps) : null;
      log(formatTechCoverage(techCoverage(mentions, edl, timeline), edl !== null));
      if (!edl || !timeline) return;
      const missing = findMissingTechIcons(edl, timeline, mentions, levelProfile(edl.level));
      if (missing.length === 0) return;
      log(`\nfaltando no nível ${edl.level} (EDL v${edl.version}):`);
      for (const finding of missing) log(`- ${finding.message}\n    → ${finding.fix}`);
      process.exitCode = 2;
    });
}
