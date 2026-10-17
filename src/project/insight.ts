import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { type BudgetKey, levelProfile } from '../edl/levels.ts';
import { listVersions, loadEdl } from '../edl/store.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { type BudgetRow, buildBudget, buildRequired, type RequiredRow } from '../eval/budget.ts';
import type { EvalReport } from '../eval/index.ts';
import type { Job } from '../watcher/queue.ts';
import { type ActivityEntry, activityFile, readActivity } from './activity.ts';
import { type ProjectPaths, readJson } from './paths.ts';

export interface EvalFinding {
  severity: 'error' | 'warning';
  text: string;
}

/** A última avaliação de uma edição, no tamanho de um cartão do painel. */
export interface EvalSummary {
  /** pasta do render avaliado: `v4-preview` */
  render: string;
  passed: boolean;
  errors: number;
  warnings: number;
  /** os primeiros achados, erros antes de avisos */
  top: EvalFinding[];
}

export function summarizeEval(report: Pick<EvalReport, 'passed' | 'findings'>, render: string, limit = 3): EvalSummary {
  const errors = report.findings.filter((finding) => finding.severity === 'error');
  const warnings = report.findings.filter((finding) => finding.severity === 'warning');
  return {
    render,
    passed: report.passed,
    errors: errors.length,
    warnings: warnings.length,
    top: [...errors, ...warnings].slice(0, limit).map((finding) => ({ severity: finding.severity === 'error' ? 'error' : 'warning', text: `${finding.check}: ${finding.message}` })),
  };
}

const SHORT_LABEL: Partial<Record<BudgetKey, string>> = { scenes: 'cenas' };

/** Só o que está fora do alvo do nível: "faltam 3 cenas", "sobram 2 zooms", "falta trilha". */
export function budgetGaps(rows: BudgetRow[], required: RequiredRow[] = [], musicMissing = false): string[] {
  const gaps: string[] = [];
  for (const row of rows) {
    const label = SHORT_LABEL[row.key] ?? row.label;
    if (row.count < row.min) gaps.push(`faltam ${row.min - row.count} ${label}`);
    else if (row.count > row.max) gaps.push(`sobram ${row.count - row.max} ${label}`);
  }
  if (musicMissing) gaps.push('falta trilha');
  for (const row of required) if (row.count < row.min) gaps.push(`faltam ${row.min - row.count} ${row.label}`);
  return gaps;
}

export interface QueueSummary {
  pending: string[];
  running: string[];
  failed: string[];
}

/** A fila do modo autônomo em três listas de slugs. */
export function queueSummary(jobs: Job[]): QueueSummary {
  const of = (status: Job['status']) => jobs.filter((job) => job.status === status).map((job) => job.slug);
  return { pending: of('pending'), running: of('running'), failed: of('failed') };
}

/** O que o painel mostra além das etapas, na edição em foco. */
export interface ItemExtras {
  activity: ActivityEntry[];
  eval: EvalSummary | null;
  /** linhas do orçamento fora do alvo; null quando ainda não há EDL */
  budgetGaps: string[] | null;
}

export interface VideoCandidate {
  file: string;
  mtimeMs: number;
}

/** O vídeo que vale a pena abrir: o final entregue, senão o preview mais novo. */
export function pickVideo(finalFile: string | null, previews: VideoCandidate[]): string | null {
  if (finalFile) return finalFile;
  return [...previews].sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.file ?? null;
}

const renderDirs = (paths: Pick<ProjectPaths, 'rendersDir'>) =>
  existsSync(paths.rendersDir)
    ? readdirSync(paths.rendersDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

export function latestVideo(paths: Pick<ProjectPaths, 'rendersDir' | 'outputDir'>): string | null {
  const final = join(paths.outputDir, 'final.mp4');
  const previews = renderDirs(paths)
    .map((name) => join(paths.rendersDir, name, 'preview.mp4'))
    .filter((file) => existsSync(file))
    .map((file) => ({ file, mtimeMs: statSync(file).mtimeMs }));
  return pickVideo(existsSync(final) ? final : null, previews);
}

function latestEval(paths: Pick<ProjectPaths, 'rendersDir'>): EvalSummary | null {
  let best: { report: EvalReport; render: string } | null = null;
  for (const render of renderDirs(paths)) {
    const file = join(paths.rendersDir, render, 'eval.json');
    if (!existsSync(file)) continue;
    try {
      const report = readJson<EvalReport>(file);
      if (!best || report.createdAt.localeCompare(best.report.createdAt) > 0) best = { report, render };
    } catch {
      // avaliação sendo gravada: a próxima leitura pega
    }
  }
  return best && summarizeEval(best.report, best.render);
}

function currentGaps(paths: ProjectPaths): string[] | null {
  if (listVersions(paths).length === 0) return null;
  try {
    const edl = loadEdl(paths);
    const profile = levelProfile(edl.level);
    const { durationSec } = buildTimeline(edl.clips, edl.output.fps);
    return budgetGaps(buildBudget(edl, durationSec, profile), buildRequired(edl, durationSec, profile), profile.music && edl.music === null);
  } catch {
    return null;
  }
}

/** Lê do disco histórico, última avaliação e orçamento de um projeto. Não roda nada. */
export function readExtras(paths: ProjectPaths): ItemExtras {
  return { activity: readActivity(activityFile(paths)), eval: latestEval(paths), budgetGaps: currentGaps(paths) };
}
