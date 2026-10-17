import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { levelProfile } from '../edl/levels.ts';
import { listVersions, loadEdl } from '../edl/store.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { buildBudget } from '../eval/budget.ts';
import type { EvalReport } from '../eval/index.ts';
import { formatClock } from '../lib/time.ts';
import type { Job } from '../watcher/queue.ts';
import { isFresh, type Live, liveFile, readLive } from './live.ts';
import { PROJECTS_DIR, type ProjectPaths, projectPaths, readJson } from './paths.ts';

/** Sem arquivo novo por mais que isso, uma etapa pela metade é tratada como interrompida. */
export const STALE_AFTER_MS = 3 * 60_000;

export interface RenderSnapshot {
  files: string[];
  /** mtime mais recente da pasta, em ms */
  touchedAt: number;
  eval: { passed: boolean; errors: number; warnings: number } | null;
}

export interface EdlSnapshot {
  version: number;
  level: string;
  clips: number;
  graphics: number;
  scenes: number;
  zooms: number;
  transitions: number;
  effects: number;
  chapters: number;
  sourceSec: number;
  durationSec: number;
  /** quantas linhas do orçamento do nível estão dentro do alvo, e de quantas */
  budget: { ok: number; total: number };
  hasShorts: boolean;
}

/** Tudo o que se sabe de um projeto olhando só os arquivos dele. */
export interface Snapshot {
  slug: string;
  analysis: { started: boolean; done: boolean; touchedAt: number | null };
  edlVersions: number[];
  edl: EdlSnapshot | null;
  /** por nome de pasta: `v3-preview`, `v3-final`, `v3-shorts-final` */
  renders: Record<string, RenderSnapshot>;
  delivered: string[];
  job: Pick<Job, 'status' | 'error'> | null;
  /** etapa que está rodando agora, se alguma gravou progresso */
  live: Live | null;
}

export type StepState = 'done' | 'running' | 'problem' | 'next' | 'pending' | 'optional';

export interface Step {
  key: 'analysis' | 'draft' | 'direction' | 'preview' | 'eval' | 'final' | 'evalFinal' | 'shorts' | 'report';
  label: string;
  state: StepState;
  detail: string;
}

const RENDER_STAGES = [
  ['cut.mkv', 'cortes'],
  ['overlay.mov', 'gráficos'],
] as const;

/** Uma etapa de render vista pelos arquivos que ela deixa: cortes → gráficos → composição. */
export function renderProgress(render: RenderSnapshot | undefined, output: string, now: number): { state: StepState; detail: string } {
  if (!render) return { state: 'pending', detail: '' };
  if (render.files.includes(output)) return { state: 'done', detail: output };
  const reached = RENDER_STAGES.filter(([file]) => render.files.includes(file)).map(([, label]) => label);
  const current = reached.length === 0 ? 'cortes' : reached.length === 1 ? 'gráficos' : 'composição';
  const stale = now - render.touchedAt > STALE_AFTER_MS;
  return stale
    ? { state: 'problem', detail: `interrompido em ${current}` }
    : { state: 'running', detail: `${current}…` };
}

function evalDetail(result: NonNullable<RenderSnapshot['eval']>): { state: StepState; detail: string } {
  return {
    state: result.passed ? 'done' : 'problem',
    detail: `${result.passed ? 'aprovada' : 'reprovada'} (${result.errors} erros, ${result.warnings} avisos)`,
  };
}

/** As etapas de uma edição, na ordem, com o estado de cada uma. A primeira pendente vira "próxima". */
export function buildPipeline(snapshot: Snapshot, now: number): Step[] {
  const { edl } = snapshot;
  const steps: Step[] = [];
  const add = (key: Step['key'], label: string, state: StepState, detail = '') => steps.push({ key, label, state, detail });

  if (snapshot.analysis.done) add('analysis', 'Análise', 'done', 'proxy, transcrição e takes.md');
  else if (snapshot.analysis.started) {
    const stale = now - (snapshot.analysis.touchedAt ?? 0) > STALE_AFTER_MS;
    add('analysis', 'Análise', stale ? 'problem' : 'running', stale ? 'interrompida' : 'proxy e transcrição…');
  } else add('analysis', 'Análise', 'pending');

  add('draft', 'Corte automático', snapshot.edlVersions.length ? 'done' : 'pending', edl ? `${formatClock(edl.sourceSec, 0)} → ${formatClock(edl.durationSec, 0)} em ${edl.clips} clipes` : '');

  const directed = edl !== null && edl.graphics + edl.scenes + edl.zooms + edl.transitions + edl.chapters > 0;
  add(
    'direction',
    'Direção',
    directed ? 'done' : 'pending',
    edl && directed
      ? `EDL v${edl.version} · nível ${edl.level} · ${edl.graphics} gráficos, ${edl.scenes} cenas, ${edl.zooms} zooms, ${edl.transitions} transições, ${edl.effects} efeitos · orçamento ${edl.budget.ok}/${edl.budget.total} no alvo`
      : edl
        ? `nível ${edl.level}`
        : '',
  );

  const preview = edl ? snapshot.renders[`v${edl.version}-preview`] : undefined;
  const previewStep = renderProgress(preview, 'preview.mp4', now);
  add('preview', 'Preview', previewStep.state, previewStep.detail);
  if (preview?.eval) add('eval', 'Autoavaliação', ...Object.values(evalDetail(preview.eval)) as [StepState, string]);
  else add('eval', 'Autoavaliação', 'pending');

  const final = edl ? snapshot.renders[`v${edl.version}-final`] : undefined;
  const finalStep = renderProgress(final, 'final.mp4', now);
  if (finalStep.state === 'pending' && snapshot.delivered.includes('final.mp4')) {
    add('final', 'Render final', 'problem', 'final.mp4 é de uma versão anterior da EDL');
  } else add('final', 'Render final', finalStep.state, finalStep.state === 'done' ? 'output/final.mp4' : finalStep.detail);
  if (final?.eval) add('evalFinal', 'Avaliação do final', ...Object.values(evalDetail(final.eval)) as [StepState, string]);
  else add('evalFinal', 'Avaliação do final', 'pending');

  const shorts = renderProgress(edl ? snapshot.renders[`v${edl.version}-shorts-final`] : undefined, 'shorts-final.mp4', now);
  if (shorts.state !== 'pending') add('shorts', 'Short', shorts.state, shorts.state === 'done' ? 'output/final-shorts.mp4' : shorts.detail);
  else add('shorts', 'Short', edl?.hasShorts ? 'pending' : 'optional', edl?.hasShorts ? 'trecho escolhido' : 'opcional, sem trecho escolhido');

  const reported = snapshot.delivered.includes('relatorio.md') && snapshot.delivered.includes('capitulos.txt');
  add('report', 'Relatório e capítulos', reported ? 'done' : 'pending', reported ? 'relatorio.md, capitulos.txt' : '');

  // quem está rodando agora grava o próprio progresso: vale mais que o que os arquivos sugerem
  const { live } = snapshot;
  if (live && isFresh(live, now)) {
    const step = steps.find((item) => item.key === live.task);
    if (step) {
      step.state = 'running';
      step.detail = liveDetail(live, now);
    }
  }

  // um passo só conta como feito se os anteriores também estão: uma EDL nova invalida o que veio depois
  const blocked = steps.findIndex((step) => step.state !== 'done' && step.state !== 'optional');
  if (blocked >= 0 && steps[blocked]!.state === 'pending') steps[blocked]!.state = 'next';
  return steps;
}

/** "gráficos (Remotion) ████░░░░░░ 42% · faltam ~3min · há 1min 20s" */
export function liveDetail(live: Live, now: number): string {
  const elapsed = `há ${formatClock(Math.max(0, now - live.startedAt) / 1000, 0)}`;
  if (live.percent === null) return `${live.label} · ${elapsed}`;
  const eta = live.etaSec === null || live.percent >= 100 ? '' : ` · faltam ~${formatClock(live.etaSec, 0)}`;
  return `${live.label} ${progressBar(live.percent, 100)} ${live.percent}%${eta} · ${elapsed}`;
}

export function countProgress(steps: Step[]): { done: number; total: number } {
  const counted = steps.filter((step) => step.state !== 'optional');
  return { done: counted.filter((step) => step.state === 'done').length, total: counted.length };
}

/** O passo em que a edição está: o que roda, o que travou ou o próximo a fazer. */
export function currentStep(steps: Step[]): Step | null {
  return (
    steps.find((step) => step.state === 'running') ??
    steps.find((step) => step.state === 'problem') ??
    steps.find((step) => step.state === 'next') ??
    null
  );
}

const NEXT_COMMAND: Record<Step['key'], (slug: string) => string> = {
  analysis: () => 'pnpm mce analyze <arquivo>',
  draft: (slug) => `pnpm mce draft ${slug}`,
  direction: () => 'o Claude dirige: gráficos, cenas, zooms e transições na EDL',
  preview: (slug) => `pnpm mce render ${slug}`,
  eval: (slug) => `pnpm mce eval ${slug}`,
  final: (slug) => `pnpm mce render ${slug} --final`,
  evalFinal: (slug) => `pnpm mce eval ${slug} --final`,
  shorts: (slug) => `pnpm mce render ${slug} --final --shorts`,
  report: (slug) => `pnpm mce report ${slug}`,
};

/** O comando (ou quem) que faz a etapa andar. */
export function nextCommand(step: Pick<Step, 'key'>, slug: string): string {
  return NEXT_COMMAND[step.key](slug);
}

export function progressBar(done: number, total: number, width = 10): string {
  const filled = total ? Math.round((done / total) * width) : 0;
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

export const JOB_LABEL: Record<Job['status'], string> = { pending: 'na fila', running: 'sendo editado', done: 'concluído', failed: 'falhou' };

function touched(dir: string, files: string[]): number {
  return Math.max(0, ...files.map((file) => statSync(join(dir, file)).mtimeMs));
}

/** Lê do disco o estado de um projeto. Não roda nada. */
export function readSnapshot(paths: ProjectPaths, queue: Job[] = []): Snapshot {
  const analysisFiles = existsSync(paths.analysisDir) ? readdirSync(paths.analysisDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name) : [];
  const versions = listVersions(paths);
  let edl: EdlSnapshot | null = null;
  if (versions.length) {
    const current = loadEdl(paths);
    const { durationSec } = buildTimeline(current.clips, current.output.fps);
    const rows = buildBudget(current, durationSec, levelProfile(current.level));
    const scenes = rows.find((row) => row.key === 'scenes')!.count;
    edl = {
      version: current.version,
      level: current.level,
      clips: current.clips.length,
      graphics: current.overlays.length - scenes,
      scenes,
      zooms: current.zooms.length,
      transitions: current.transitions.length,
      effects: current.effects.length,
      chapters: current.chapters.length,
      sourceSec: current.source.durationSec,
      durationSec,
      budget: { ok: rows.filter((row) => row.count >= row.min && row.count <= row.max).length, total: rows.length },
      hasShorts: current.shorts !== null,
    };
  }
  const renders: Snapshot['renders'] = {};
  if (existsSync(paths.rendersDir)) {
    for (const entry of readdirSync(paths.rendersDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(paths.rendersDir, entry.name);
      const files = readdirSync(dir, { withFileTypes: true }).filter((item) => item.isFile()).map((item) => item.name);
      const report = files.includes('eval.json') ? readJson<EvalReport>(join(dir, 'eval.json')) : null;
      renders[entry.name] = {
        files,
        touchedAt: touched(dir, files),
        eval: report && {
          passed: report.passed,
          errors: report.findings.filter((finding) => finding.severity === 'error').length,
          warnings: report.findings.filter((finding) => finding.severity === 'warning').length,
        },
      };
    }
  }
  const job = [...queue].reverse().find((item) => item.slug === paths.slug) ?? null;
  return {
    slug: paths.slug,
    analysis: {
      started: analysisFiles.length > 0,
      done: existsSync(paths.analysis) && existsSync(paths.takes),
      touchedAt: analysisFiles.length ? touched(paths.analysisDir, analysisFiles) : null,
    },
    edlVersions: versions,
    edl,
    renders,
    delivered: existsSync(paths.outputDir) ? readdirSync(paths.outputDir).sort() : [],
    job: job && { status: job.status, error: job.error },
    live: readLive(liveFile(paths)),
  };
}

/** Projetos com pasta em projects/ (as de apoio, como `.gallery`, ficam de fora). */
export function listProjects(dir = PROJECTS_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

export function readAll(queue: Job[] = [], now = Date.now()): { snapshot: Snapshot; steps: Step[] }[] {
  return listProjects().map((slug) => {
    const snapshot = readSnapshot(projectPaths(slug), queue);
    return { snapshot, steps: buildPipeline(snapshot, now) };
  });
}
