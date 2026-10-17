import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { Command } from 'commander';

import { probe } from '../analyze/media.ts';
import type { Transcript } from '../analyze/types.ts';
import { loadEdl } from '../edl/store.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { formatClock } from '../lib/time.ts';
import { RETENTION_SECTION, writeSection } from '../project/memory.ts';
import { PROJECTS_DIR, type ProjectPaths, readJson, requireProject, writeJson } from '../project/paths.ts';
import { bumperDurations } from '../render/bumpers.ts';
import { retentionFile, writeReport } from '../report/write.ts';
import {
  aggregateLessons,
  analyzeRetention,
  buildEdlContext,
  memorySummary,
  normalizeCurve,
  parseRetentionCsv,
  pickDeliveredRender,
  type RetentionAnalysis,
} from './index.ts';

/** Versão da EDL e arquivo do final que foi ao ar. */
function deliveredRender(paths: ProjectPaths): { version: number; file: string } {
  const renders = existsSync(paths.rendersDir)
    ? readdirSync(paths.rendersDir)
        .filter((dir) => existsSync(join(paths.rendersDir, dir, 'final.mp4')))
        .map((dir) => ({ dir, mtimeMs: statSync(join(paths.rendersDir, dir, 'final.mp4')).mtimeMs }))
    : [];
  const version = pickDeliveredRender(renders);
  if (version === null) throw new Error(`Nenhum render final em ${paths.rendersDir}. Rode: pnpm mce render ${paths.slug} --final`);
  const delivered = join(paths.outputDir, 'final.mp4');
  return { version, file: existsSync(delivered) ? delivered : join(paths.rendersDir, `v${version}-final`, 'final.mp4') };
}

export interface ImportOptions {
  edl?: number;
  duration?: number;
  now?: Date;
}

export async function importRetention(paths: ProjectPaths, csvFile: string, options: ImportOptions = {}): Promise<RetentionAnalysis> {
  const curve = parseRetentionCsv(readFileSync(csvFile, 'utf8'));
  const delivered = options.edl === undefined ? deliveredRender(paths) : null;
  const edl = loadEdl(paths, options.edl ?? delivered!.version);
  const timeline = buildTimeline(edl.clips, edl.output.fps);
  const bumpers = bumperDurations(edl);
  const durationSec = options.duration ?? (delivered ? (await probe(delivered.file)).durationSec : timeline.durationSec + bumpers.introSec + bumpers.outroSec);
  const words = existsSync(paths.words) ? readJson<Transcript>(paths.words).words : [];
  const analysis = analyzeRetention({
    slug: paths.slug,
    sourceFile: basename(csvFile),
    edlVersion: edl.version,
    axis: curve.axis,
    points: normalizeCurve(curve, durationSec),
    context: { ...buildEdlContext(edl, timeline, bumpers, words), durationSec },
    importedAt: (options.now ?? new Date()).toISOString(),
  });
  writeJson(retentionFile(paths), analysis);
  writeSection(paths.memory, paths.slug, RETENTION_SECTION, memorySummary(analysis));
  return analysis;
}

export function loadAllRetention(dir = PROJECTS_DIR): RetentionAnalysis[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name, 'analysis', 'retention.json'))
    .filter((file) => existsSync(file))
    .map((file) => readJson<RetentionAnalysis>(file));
}

export function registerRetention(program: Command, log: (message: string) => void, resolvePath: (file: string) => string = resolve): void {
  const retention = program.command('retention').description('Loop de retenção: curva do YouTube Studio → quedas ligadas à EDL → lições');

  retention
    .command('import <project> <arquivo>')
    .description('Importa o CSV de retenção do YouTube Studio → analysis/retention.json, project.md e relatorio.md')
    .option('-v, --edl <n>', 'versão da EDL que foi ao ar (padrão: a do render final mais recente)', Number)
    .option('--duration <s>', 'duração do vídeo publicado em segundos (padrão: ffprobe do final)', Number)
    .action(async (project: string, file: string, options: { edl?: number; duration?: number }) => {
      const paths = requireProject(project);
      const analysis = await importRetention(paths, resolvePath(file), options);
      const { summary } = analysis;
      log(`${retentionFile(paths)}\nmédia ${(summary.average * 100).toFixed(0)}% · aos 30 s ${(summary.at30 * 100).toFixed(0)}% · fim ${(summary.end * 100).toFixed(0)}% · ${analysis.points.length} pontos em ${formatClock(analysis.durationSec, 0)}`);
      for (const lesson of analysis.lessons) log(`- ${lesson}`);
      if (existsSync(join(paths.outputDir, 'relatorio.md'))) log(writeReport(paths).report);
    });

  retention
    .command('lessons')
    .description('Padrões de retenção de todos os projetos importados, para o diretor ler antes de dirigir')
    .action(() => log(aggregateLessons(loadAllRetention()).trimEnd()));
}
