import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { run } from '../lib/exec.ts';
import type { DashboardItem } from './dashboard.ts';
import type { PanelAction } from './dashboard-keys.ts';
import { latestVideo } from './insight.ts';
import { PROJECTS_DIR, projectPaths, readJson } from './paths.ts';
import { currentStep, nextCommand } from './pipeline.ts';

export const SCENES_SERVER_FILE = join(PROJECTS_DIR, '.preview', 'server.json');
export const SCENES_OFFLINE = 'visor de cenas fora do ar: pnpm mce scenes watch';

/** Contrato do visor de cenas: quem sobe o servidor grava isto em `projects/.preview/server.json`. */
export interface ScenesServer {
  url: string;
  pid: number;
  startedAt: number;
}

/** O que a casca precisa saber do disco para decidir uma ação. */
export interface ActionFacts {
  slug: string;
  outputDir: string | null;
  projectDir: string | null;
  report: string | null;
  video: string | null;
  /** comando que faz a edição andar; null quando não há (concluída, ou a vez é do diretor) */
  command: string | null;
  scenes: { url: string; alive: boolean } | null;
}

export interface ActionPlan {
  /** aviso curto para o rodapé */
  notice: string;
  open?: string;
  copy?: string;
}

/**
 * `cmd /c start` reinterpreta o que recebe: `&`, `|`, `^`, `%VAR%` e aspas mudariam o comando mesmo com o
 * alvo passado como argumento separado. Alvo com esses caracteres não é aberto.
 */
export function isSafeTarget(target: string): boolean {
  return target.length > 0 && !/[&|<>^%!"`\r\n]/.test(target);
}

/** Só http(s) em localhost: o arquivo do visor é lido do disco e vai parar numa linha de comando. */
export function localUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    return local && (url.protocol === 'http:' || url.protocol === 'https:') && isSafeTarget(url.href) ? url.href : null;
  } catch {
    return null;
  }
}

/** Decide o que uma tecla faz com o que existe no disco: o que abrir ou copiar, e o aviso do rodapé. */
export function planAction(action: Exclude<PanelAction, { type: 'quit' }>, facts: ActionFacts): ActionPlan {
  const open = (target: string, notice: string): ActionPlan => (isSafeTarget(target) ? { notice, open: target } : { notice: `caminho com caractere especial, abra à mão: ${target}` });
  switch (action.type) {
    case 'open-output':
      return facts.outputDir ? open(facts.outputDir, `abrindo output/${facts.slug}`) : { notice: `output/${facts.slug} ainda não existe` };
    case 'open-project':
      return facts.projectDir ? open(facts.projectDir, `abrindo projects/${facts.slug}`) : { notice: `projects/${facts.slug} não existe` };
    case 'open-report':
      return facts.report ? open(facts.report, 'abrindo relatorio.md') : { notice: `sem relatório ainda: pnpm mce report ${facts.slug}` };
    case 'open-video':
      return facts.video
        ? open(facts.video, `abrindo ${basename(facts.video)}${basename(facts.video) === 'final.mp4' ? '' : ` (${basename(dirname(facts.video))})`}`)
        : { notice: `nenhum vídeo renderizado ainda: pnpm mce render ${facts.slug}` };
    case 'open-scenes':
      return facts.scenes?.alive ? open(facts.scenes.url, `abrindo o visor de cenas: ${facts.scenes.url}`) : { notice: SCENES_OFFLINE };
    case 'copy-next':
      return facts.command ? { notice: `copiado: ${facts.command}`, copy: facts.command } : { notice: 'nenhum comando para copiar agora' };
  }
}

/** Sinal 0 não mata ninguém: só pergunta se o processo existe. EPERM = existe, mas é de outro usuário. */
export function pidAlive(pid: number, kill: (pid: number, signal: 0) => unknown = process.kill.bind(process)): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function readScenesServer(file = SCENES_SERVER_FILE, alive: (pid: number) => boolean = pidAlive): ActionFacts['scenes'] {
  if (!existsSync(file)) return null;
  try {
    const server = readJson<Partial<ScenesServer>>(file);
    const url = localUrl(server.url);
    return url ? { url, alive: typeof server.pid === 'number' && alive(server.pid) } : null;
  } catch {
    return null;
  }
}

/** O próximo comando só é copiável quando é um comando de verdade (a direção é "o Claude dirige"). */
export function suggestedCommand(item: DashboardItem): string | null {
  const current = currentStep(item.steps);
  if (!current || current.state === 'running') return null;
  const command = nextCommand(current, item.snapshot.slug);
  return command.startsWith('pnpm ') && !command.includes('<') ? command : null;
}

export function gatherFacts(slug: string, item: DashboardItem | undefined): ActionFacts {
  const paths = projectPaths(slug);
  const report = join(paths.outputDir, 'relatorio.md');
  return {
    slug,
    outputDir: existsSync(paths.outputDir) ? paths.outputDir : null,
    projectDir: existsSync(paths.dir) ? paths.dir : null,
    report: existsSync(report) ? report : null,
    video: latestVideo(paths),
    command: item ? suggestedCommand(item) : null,
    scenes: null,
  };
}

/** Abre pasta, arquivo ou URL com o programa padrão do Windows. Os argumentos vão em array, sem shell. */
export async function openTarget(target: string, runner: (command: string, args: string[]) => Promise<unknown> = run): Promise<void> {
  if (!isSafeTarget(target)) throw new Error(`alvo recusado: ${target}`);
  await runner('cmd', ['/c', 'start', '', target]);
}

/** Copia para a área de transferência pelo `clip.exe`, em UTF-16 para os acentos chegarem inteiros. */
export function copyText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('clip.exe', [], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`clip.exe saiu com código ${code}`))));
    child.stdin.on('error', reject);
    child.stdin.end(Buffer.from(`﻿${text}`, 'utf16le'));
  });
}

export interface ActionEffects {
  open: (target: string) => Promise<void>;
  copy: (text: string) => Promise<void>;
  facts: (action: Exclude<PanelAction, { type: 'quit' }>, item: DashboardItem | undefined) => ActionFacts;
}

export const realEffects: ActionEffects = {
  open: (target) => openTarget(target),
  copy: copyText,
  facts: (action, item) =>
    action.type === 'open-scenes'
      ? { slug: '', outputDir: null, projectDir: null, report: null, video: null, command: null, scenes: readScenesServer() }
      : gatherFacts(action.slug, item),
};

/** Executa a ação de uma tecla e devolve o aviso do rodapé; falha ao abrir ou copiar vira aviso, nunca exceção. */
export async function performAction(action: Exclude<PanelAction, { type: 'quit' }>, item: DashboardItem | undefined, effects: ActionEffects = realEffects): Promise<string> {
  try {
    const plan = planAction(action, effects.facts(action, item));
    if (plan.open) await effects.open(plan.open);
    if (plan.copy) await effects.copy(plan.copy);
    return plan.notice;
  } catch (error) {
    return `não deu: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`;
  }
}
