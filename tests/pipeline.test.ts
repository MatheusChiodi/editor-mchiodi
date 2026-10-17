import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { clearLive, isFresh, type Live, LIVE_TTL_MS, liveFile, readLive, trackProgress, writeLive } from '../src/project/live.ts';
import {
  buildPipeline,
  countProgress,
  currentStep,
  type EdlSnapshot,
  JOB_LABEL,
  listProjects,
  liveDetail,
  nextCommand,
  progressBar,
  renderProgress,
  type RenderSnapshot,
  type Snapshot,
  STALE_AFTER_MS,
} from '../src/project/pipeline.ts';

const NOW = 1_800_000_000_000;

const edl = (extra: Partial<EdlSnapshot> = {}): EdlSnapshot => ({
  version: 2,
  level: 'max',
  clips: 30,
  graphics: 40,
  scenes: 11,
  zooms: 30,
  transitions: 9,
  effects: 8,
  chapters: 5,
  sourceSec: 439,
  durationSec: 400,
  budget: { ok: 6, total: 6 },
  hasShorts: false,
  ...extra,
});

const render = (files: string[], extra: Partial<RenderSnapshot> = {}): RenderSnapshot => ({ files, touchedAt: NOW, eval: null, ...extra });

const snapshot = (extra: Partial<Snapshot> = {}): Snapshot => ({
  slug: 'aula',
  analysis: { started: true, done: true, touchedAt: NOW },
  edlVersions: [1, 2],
  edl: edl(),
  renders: {},
  delivered: [],
  job: null,
  live: null,
  ...extra,
});

const states = (value: Snapshot, now = NOW) => Object.fromEntries(buildPipeline(value, now).map((step) => [step.key, step.state]));

describe('renderProgress', () => {
  it('lê a etapa pelos arquivos que o render já deixou', () => {
    expect(renderProgress(undefined, 'preview.mp4', NOW)).toEqual({ state: 'pending', detail: '' });
    expect(renderProgress(render([]), 'preview.mp4', NOW)).toEqual({ state: 'running', detail: 'cortes…' });
    expect(renderProgress(render(['cut.mkv']), 'preview.mp4', NOW).detail).toBe('gráficos…');
    expect(renderProgress(render(['cut.mkv', 'overlay.mov']), 'preview.mp4', NOW).detail).toBe('composição…');
    expect(renderProgress(render(['cut.mkv', 'preview.mp4']), 'preview.mp4', NOW)).toEqual({ state: 'done', detail: 'preview.mp4' });
  });

  it('sem arquivo novo há tempo demais, está interrompido', () => {
    const old = render(['cut.mkv'], { touchedAt: NOW - STALE_AFTER_MS - 1 });
    expect(renderProgress(old, 'final.mp4', NOW)).toEqual({ state: 'problem', detail: 'interrompido em gráficos' });
  });
});

describe('buildPipeline', () => {
  it('projeto recém-criado: a análise é a próxima', () => {
    const steps = buildPipeline(snapshot({ analysis: { started: false, done: false, touchedAt: null }, edlVersions: [], edl: null }), NOW);
    expect(steps.map((step) => step.key)).toEqual(['analysis', 'draft', 'direction', 'preview', 'eval', 'final', 'evalFinal', 'shorts', 'report']);
    expect(steps[0]!.state).toBe('next');
    expect(steps.slice(1).every((step) => step.state === 'pending' || step.state === 'optional')).toBe(true);
    expect(countProgress(steps)).toEqual({ done: 0, total: 8 });
  });

  it('análise pela metade roda ou está interrompida conforme a idade dos arquivos', () => {
    const half = { started: true, done: false, touchedAt: NOW - 10_000 };
    expect(states(snapshot({ analysis: half, edlVersions: [], edl: null })).analysis).toBe('running');
    expect(states(snapshot({ analysis: { ...half, touchedAt: NOW - STALE_AFTER_MS * 2 }, edlVersions: [], edl: null })).analysis).toBe('problem');
  });

  it('rascunho sem direção: a direção é a próxima', () => {
    const value = snapshot({ edlVersions: [1], edl: edl({ version: 1, graphics: 0, scenes: 0, zooms: 0, transitions: 0, chapters: 0 }) });
    expect(states(value)).toMatchObject({ analysis: 'done', draft: 'done', direction: 'next', preview: 'pending' });
    expect(buildPipeline(value, NOW)[2]!.detail).toBe('nível max');
  });

  it('caminho completo, com detalhe em cada etapa', () => {
    const evaluated = { eval: { passed: true, errors: 0, warnings: 3 } };
    const steps = buildPipeline(
      snapshot({
        edl: edl({ hasShorts: true }),
        renders: {
          'v2-preview': render(['cut.mkv', 'overlay.mov', 'preview.mp4', 'eval.json'], evaluated),
          'v2-final': render(['cut.mkv', 'overlay.mov', 'final.mp4', 'eval.json'], evaluated),
          'v2-shorts-final': render(['shorts-final.mp4']),
        },
        delivered: ['capitulos.txt', 'final-shorts.mp4', 'final.mp4', 'relatorio.md'],
      }),
      NOW,
    );
    expect(steps.every((step) => step.state === 'done')).toBe(true);
    expect(countProgress(steps)).toEqual({ done: 9, total: 9 });
    expect(currentStep(steps)).toBeNull();
    expect(steps[1]!.detail).toBe('07:19 → 06:40 em 30 clipes');
    expect(steps[2]!.detail).toContain('EDL v2 · nível max · 40 gráficos, 11 cenas, 30 zooms, 9 transições, 8 efeitos · orçamento 6/6 no alvo');
    expect(steps[4]!.detail).toBe('aprovada (0 erros, 3 avisos)');
    expect(steps[5]!.detail).toBe('output/final.mp4');
  });

  it('avaliação reprovada e render de versão antiga pedem atenção', () => {
    const value = snapshot({
      renders: {
        'v1-final': render(['final.mp4']),
        'v2-preview': render(['preview.mp4', 'eval.json'], { eval: { passed: false, errors: 2, warnings: 1 } }),
      },
      delivered: ['final.mp4'],
    });
    const steps = buildPipeline(value, NOW);
    expect(states(value)).toMatchObject({ preview: 'done', eval: 'problem', final: 'problem' });
    expect(steps[4]!.detail).toBe('reprovada (2 erros, 1 avisos)');
    expect(steps[5]!.detail).toBe('final.mp4 é de uma versão anterior da EDL');
    expect(currentStep(steps)!.key).toBe('eval');
  });

  it('Short sem trecho escolhido é opcional e não conta no total', () => {
    const steps = buildPipeline(snapshot(), NOW);
    expect(steps.find((step) => step.key === 'shorts')).toMatchObject({ state: 'optional', detail: 'opcional, sem trecho escolhido' });
    expect(countProgress(steps).total).toBe(8);
    expect(buildPipeline(snapshot({ edl: edl({ hasShorts: true }) }), NOW).find((step) => step.key === 'shorts')!.state).toBe('pending');
  });

  it('progresso ao vivo marca a etapa como rodando, com barra e tempo', () => {
    const live: Live = { task: 'preview', label: 'gráficos (Remotion)', percent: 42, etaSec: 185, startedAt: NOW - 80_000, updatedAt: NOW - 1000 };
    const steps = buildPipeline(snapshot({ live, renders: { 'v2-preview': render(['cut.mkv']) } }), NOW);
    const preview = steps.find((step) => step.key === 'preview')!;
    expect(preview.state).toBe('running');
    expect(preview.detail).toBe('gráficos (Remotion) ████░░░░░░ 42% · faltam ~03:05 · há 01:20');
    expect(currentStep(steps)).toBe(preview);
  });

  it('registro ao vivo velho é ignorado; o da direção vale por mais tempo', () => {
    const base = { label: 'x', percent: 10, etaSec: null, startedAt: NOW - 600_000 };
    const dead: Live = { ...base, task: 'preview', updatedAt: NOW - LIVE_TTL_MS.machine - 1 };
    expect(states(snapshot({ live: dead })).preview).toBe('next');
    const directing: Live = { task: 'direction', label: 'criando cenas 3/10', percent: null, etaSec: null, startedAt: NOW - 600_000, updatedAt: NOW - 600_000 };
    const steps = buildPipeline(snapshot({ live: directing }), NOW);
    expect(steps[2]).toMatchObject({ state: 'running', detail: 'criando cenas 3/10 · há 10:00' });
    expect(isFresh(directing, NOW + LIVE_TTL_MS.direction)).toBe(false);
  });
});

describe('formatação', () => {
  it('progressBar e liveDetail', () => {
    expect(progressBar(0, 8)).toBe('░░░░░░░░░░');
    expect(progressBar(4, 8)).toBe('█████░░░░░');
    expect(progressBar(8, 8)).toBe('██████████');
    expect(progressBar(0, 0)).toBe('░░░░░░░░░░');
    expect(liveDetail({ task: 'final', label: 'composição', percent: 100, etaSec: 0, startedAt: NOW - 5000, updatedAt: NOW }, NOW)).toBe('composição ██████████ 100% · há 00:05');
  });

  it('nextCommand: o comando que faz cada etapa andar', () => {
    expect(nextCommand({ key: 'eval' }, 'aula')).toBe('pnpm mce eval aula');
    expect(nextCommand({ key: 'final' }, 'aula')).toBe('pnpm mce render aula --final');
    expect(nextCommand({ key: 'direction' }, 'aula')).toContain('o Claude dirige');
    expect(JOB_LABEL.running).toBe('sendo editado');
  });
});

describe('live.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mce-live-'));
  const file = liveFile({ dir });

  it('grava, lê e limpa', () => {
    expect(readLive(file)).toBeNull();
    const live: Live = { task: 'eval', label: 'transcrição', percent: 50, etaSec: 20, startedAt: 1, updatedAt: 2 };
    writeLive(file, live);
    expect(readLive(file)).toEqual(live);
    writeFileSync(file, '{"task":', 'utf8');
    expect(readLive(file)).toBeNull();
    clearLive(file);
    clearLive(file);
    expect(readLive(file)).toBeNull();
  });

  it('trackProgress repassa tudo ao console e grava com intervalo mínimo', () => {
    let now = 1000;
    const seen: number[] = [];
    const track = trackProgress(file, 'preview', (info) => seen.push(info.percent), 500, () => now);
    track({ label: 'cortes', percent: 1.4, etaSec: 90 });
    expect(readLive(file)).toEqual({ task: 'preview', label: 'cortes', percent: 1, etaSec: 90, startedAt: 1000, updatedAt: 1000 });
    now = 1200;
    track({ label: 'cortes', percent: 20, etaSec: 70 });
    expect(readLive(file)!.percent).toBe(1);
    track({ label: 'gráficos', percent: 0, etaSec: null });
    expect(readLive(file)).toMatchObject({ label: 'gráficos', percent: 0, updatedAt: 1200 });
    now = 1300;
    track({ label: 'gráficos', percent: 100, etaSec: 0 });
    expect(readLive(file)!.percent).toBe(100);
    now = 2000;
    track({ label: 'gráficos', percent: 55, etaSec: 5 });
    expect(readLive(file)).toMatchObject({ percent: 55, startedAt: 1000, updatedAt: 2000 });
    expect(seen).toEqual([1.4, 20, 0, 100, 55]);
  });

  it('isFresh usa o prazo da máquina para render e análise', () => {
    const live: Live = { task: 'final', label: '', percent: 0, etaSec: null, startedAt: 0, updatedAt: NOW };
    expect(isFresh(live, NOW + LIVE_TTL_MS.machine)).toBe(true);
    expect(isFresh(live, NOW + LIVE_TTL_MS.machine + 1)).toBe(false);
  });

  it('listProjects ignora pastas de apoio e arquivos', () => {
    const root = mkdtempSync(join(tmpdir(), 'mce-projects-'));
    for (const name of ['b-video', 'a-video', '.gallery']) mkdirSync(join(root, name));
    writeFileSync(join(root, 'gallery.log'), '');
    expect(listProjects(root)).toEqual(['a-video', 'b-video']);
    expect(listProjects(join(root, 'nao-existe'))).toEqual([]);
  });
});
