import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';

import type { Transcript } from '../analyze/types.ts';
import { levelProfile } from '../edl/levels.ts';
import { edlPath, loadEdl, saveNewVersion } from '../edl/store.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { readJson, requireProject, writeJson } from '../project/paths.ts';
import { findTechMentions } from '../tech/detect.ts';
import { BROLL_DIR, readIndex, updateIndex } from './library.ts';
import { fetchBroll } from './pexels.ts';
import { applyBroll, type BrollCandidate, brollCap, formatBroll, suggestBroll } from './suggest.ts';

const candidatesFile = (analysisDir: string) => join(analysisDir, 'broll-candidates.json');

/** Termos "faltando" de broll-candidates.json, sem repetição, na ordem da nota. */
export function missingQueries(candidates: readonly Pick<BrollCandidate, 'missing' | 'score'>[], limit: number): string[] {
  const sorted = [...candidates].filter((candidate) => candidate.missing).sort((a, b) => b.score - a.score);
  return [...new Set(sorted.map((candidate) => candidate.missing!))].slice(0, limit);
}

/** `mce broll index | suggest | fetch`: biblioteca local de b-roll e sugestão a partir da fala. */
export function registerBroll(program: Command, log: (message: string) => void): void {
  const broll = program.command('broll').description('B-roll assistido: biblioteca local (assets/broll), sugestão a partir da fala e busca opcional no Pexels');

  broll
    .command('index')
    .description('Varre assets/broll (ffprobe), gera/atualiza assets/broll/index.json; tags a partir do nome do arquivo e das pastas')
    .action(async () => {
      const result = await updateIndex();
      log(`${result.index.entries.length} arquivo(s) no índice; +${result.added.length} medido(s), -${result.removed.length} removido(s)`);
      for (const file of result.added) log(`+ ${file}: ${result.index.entries.find((entry) => entry.file === file)?.tags.join(', ')}`);
      for (const file of result.removed) log(`- ${file}`);
      for (const failure of result.failed) log(`! ${failure.file}: ${failure.error}`);
      log(join(BROLL_DIR, 'index.json'));
    });

  broll
    .command('suggest <project>')
    .description('Trechos da fala que pedem b-roll (objeto/lugar/ação/tecnologia citada, trecho longo sem gráfico), casados com a biblioteca; respeita o nível da EDL')
    .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
    .option('--apply', 'grava os candidatos que têm arquivo como `broll` numa nova versão da EDL')
    .action((project: string, options: { edl?: number; apply?: boolean }) => {
      const paths = requireProject(project);
      const current = loadEdl(paths, options.edl);
      const { words } = readJson<Transcript>(paths.words);
      const library = readIndex().entries;
      const budget = levelProfile(current.level).broll;
      const timeline = buildTimeline(current.clips, current.output.fps);
      const candidates = suggestBroll({ words, edl: current, library, tech: findTechMentions(words), budget });
      const file = candidatesFile(paths.analysisDir);
      writeJson(file, { project: paths.slug, edlVersion: current.version, level: current.level, createdAt: new Date().toISOString(), budget, candidates });
      log(formatBroll(candidates, { level: current.level, cap: brollCap(budget, timeline.durationSec), libraryCount: library.length }));
      log(`\n${file}`);
      if (!options.apply) return;
      const { data, applied } = applyBroll(current, candidates);
      if (applied.length === 0) {
        log('nada aplicado: nenhuma sugestão tem arquivo na biblioteca (pnpm mce broll fetch, ou coloque vídeos em assets/broll e rode broll index)');
        return;
      }
      const saved = saveNewVersion(paths, data);
      log(`aplicado: ${applied.length} b-roll → ${edlPath(paths, saved.version)}`);
    });

  broll
    .command('fetch <project>')
    .description('Baixa do Pexels (licença Pexels, HD, curto) os termos "faltando" do último broll suggest; só com a env PEXELS_API_KEY')
    .option('-n, --limit <n>', 'quantos termos buscar', Number, 5)
    .action(async (project: string, options: { limit: number }) => {
      const apiKey = process.env.PEXELS_API_KEY?.trim();
      if (!apiKey) {
        log('PEXELS_API_KEY não definida: busca no Pexels desligada. Crie uma chave grátis em https://www.pexels.com/api/ e defina a env (ou coloque vídeos em assets/broll e rode pnpm mce broll index).');
        return;
      }
      const paths = requireProject(project);
      const file = candidatesFile(paths.analysisDir);
      if (!existsSync(file)) throw new Error(`Sem ${file}. Rode antes: pnpm mce broll suggest ${paths.slug}`);
      const { candidates } = readJson<{ candidates: BrollCandidate[] }>(file);
      const queries = missingQueries(candidates, Math.max(1, options.limit));
      if (queries.length === 0) {
        log('nenhum termo faltando: a biblioteca já cobre as sugestões');
        return;
      }
      const results = await fetchBroll({ apiKey, queries, log });
      for (const result of results) log(`${result.file ? 'ok' : '--'} "${result.query}": ${result.file ?? result.note}`);
      log(`\nrode de novo: pnpm mce broll suggest ${paths.slug}`);
    });
}
