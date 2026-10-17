import type { Command } from 'commander';

import { buildPhrases } from '../analyze/speech.ts';
import type { Transcript } from '../analyze/types.ts';
import { listVersions, loadEdl } from '../edl/store.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { readJson, requireProject } from '../project/paths.ts';
import { findAnalogies, HIGH_CONFIDENCE } from './detect.ts';
import { themedOverlay } from './lint.ts';
import { formatAnalogies } from './report.ts';

/** `mce analogies <projeto>`: as analogias de universo da fala, o tema de cada uma e se a EDL atual já veste o trecho. */
export function registerAnalogies(program: Command, log: (message: string) => void): void {
  program
    .command('analogies <project>')
    .description('Analogias de universo na fala (Batman, Minecraft, RPG…): tema disponível, modelo sugerido e se a EDL atual já cobre; código 2 se faltar tema numa de confiança alta')
    .option('-v, --verbose', 'mostra o trecho pronto para colar em overlays[]')
    .option('--edl <n>', 'versão da EDL (padrão: a mais recente, se houver)', Number)
    .action((project: string, options: { verbose?: boolean; edl?: number }) => {
      const paths = requireProject(project);
      const { words } = readJson<Transcript>(paths.words);
      const analogies = findAnalogies(words, buildPhrases(words));
      const edl = listVersions(paths).length ? loadEdl(paths, options.edl) : null;
      const timeline = edl ? buildTimeline(edl.clips, edl.output.fps) : null;
      log(formatAnalogies(analogies, { edl, timeline, verbose: options.verbose }));
      if (edl && timeline && analogies.some((analogy) => analogy.confidence >= HIGH_CONFIDENCE && !themedOverlay(edl, timeline, analogy))) process.exitCode = 2;
    });
}
