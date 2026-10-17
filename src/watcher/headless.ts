import { appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Config } from '../config.ts';
import { levelProfile } from '../edl/levels.ts';
import { run } from '../lib/exec.ts';
import { projectPaths, ROOT } from '../project/paths.ts';
import { checkDeliverables, DELIVERABLES } from './deliverables.ts';
import type { Job } from './queue.ts';

/** Ferramentas liberadas na sessão sem supervisão. O que não está aqui é negado, não perguntado. */
export const HEADLESS_TOOLS = [
  'Read', 'Glob', 'Grep', 'Edit', 'Write', 'Skill', 'Agent',
  'Bash(pnpm mce *)', 'Bash(pnpm test*)', 'Bash(pnpm typecheck*)', 'Bash(pnpm exec vitest *)', 'Bash(pnpm exec tsc *)', 'Bash(ffprobe *)',
  'PowerShell(pnpm mce *)', 'PowerShell(pnpm test*)', 'PowerShell(pnpm typecheck*)', 'PowerShell(pnpm exec vitest *)',
  'PowerShell(pnpm exec tsc *)', 'PowerShell(ffprobe *)',
] as const;

/** Pedido que o watcher entrega ao Claude: curto, porque o processo todo está na skill edit-video. */
export function headlessPrompt(job: Pick<Job, 'file' | 'slug' | 'level'>): string {
  return [
    `Edite o vídeo "${job.file}" do começo ao fim seguindo a skill edit-video (modo headless).`,
    `Use o projeto "${job.slug}" (pnpm mce analyze "${job.file}" -p ${job.slug}; se já existir, continue de pnpm mce status ${job.slug}).`,
    ...(job.level
      ? [`Nível de edição: ${job.level} (${levelProfile(job.level).label}). Crie o rascunho com pnpm mce draft ${job.slug} --level ${job.level} e cumpra o orçamento de pnpm mce level ${job.slug}.`]
      : []),
    `Entregue em output/${job.slug}/ o pacote completo para publicar: ${DELIVERABLES.map((item) => item.file).join(', ')} (e final-shorts.mp4 se houver um bom trecho de até 60s).`,
    'Capa, título e descrição são do sub-agente packager, depois do relatório: pensados para alcançar o máximo de views sem prometer o que o vídeo não entrega.',
    'Ninguém vai responder perguntas: decida e siga. Termine com uma linha "RESULTADO: ok — <resumo>" ou "RESULTADO: falha — <motivo>".',
  ].join('\n');
}

/**
 * Argumentos do `claude -p`. `--setting-sources project,local` deixa de fora os hooks e instruções
 * globais do usuário (um hook de SessionStart global mandaria criar um time de agentes a cada vídeo);
 * `dontAsk` nega em vez de perguntar; as permissões vão pela linha de comando porque as do
 * settings.json do projeto só valem depois que a pasta é marcada como confiável.
 */
export function headlessArgs(prompt: string, config: Config['headless']): string[] {
  return [
    '-p', prompt,
    '--setting-sources', 'project,local',
    '--permission-mode', 'dontAsk',
    '--allowedTools', ...HEADLESS_TOOLS, ...config.extraTools,
    '--output-format', 'json',
    ...(config.model ? ['--model', config.model] : []),
    ...(config.maxBudgetUsd ? ['--max-budget-usd', String(config.maxBudgetUsd)] : []),
  ];
}

/**
 * Ambiente da sessão filha. Variáveis da sessão que iniciou o watcher não podem vazar para ela,
 * e uma ANTHROPIC_API_KEY no ambiente tem precedência sobre o login da assinatura: por padrão
 * ela é removida, para a edição usar a assinatura (ligue `headless.useApiKey` para o contrário).
 */
export function headlessEnv(env: NodeJS.ProcessEnv, config: Config['headless']): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(env)) {
    if (/^(CLAUDECODE|CLAUDE_PID|CLAUDE_CODE_.*)$/.test(name)) continue;
    if (name === 'ANTHROPIC_API_KEY' && !config.useApiKey) continue;
    child[name] = value;
  }
  return child;
}

export interface HeadlessResult {
  ok: boolean;
  summary: string;
  costUsd: number | null;
  turns: number | null;
  /** o que entrou e o que faltou do pacote (vídeo, capa, título, descrição, capítulos, relatório) */
  present?: string[];
  missing?: string[];
}

/** Interpreta o JSON do `--output-format json` e a linha RESULTADO pedida no prompt. */
export function parseHeadlessOutput(stdout: string, delivered: boolean): HeadlessResult {
  let result = '';
  let costUsd: number | null = null;
  let turns: number | null = null;
  let failed = false;
  try {
    const json = JSON.parse(stdout.slice(stdout.indexOf('{'))) as {
      result?: string; is_error?: boolean; total_cost_usd?: number; num_turns?: number;
    };
    result = json.result ?? '';
    failed = Boolean(json.is_error);
    costUsd = json.total_cost_usd ?? null;
    turns = json.num_turns ?? null;
  } catch {
    result = stdout.trim();
    failed = true;
  }
  const verdict = /RESULTADO:\s*(ok|falha)\s*[—-]?\s*(.*)/i.exec(result);
  const saidOk = verdict ? verdict[1]!.toLowerCase() === 'ok' : !failed;
  // a prova é o arquivo: sem final.mp4 não há entrega, diga o que disser a sessão
  const ok = !failed && saidOk && delivered;
  let summary = verdict?.[2]?.trim() || result.trim().split('\n').at(-1) || '';
  if (!delivered && saidOk && !failed) summary = `sessão terminou sem gerar final.mp4${summary ? ` (${summary})` : ''}`;
  return { ok, summary: summary.slice(0, 300), costUsd, turns };
}

/** Roda uma edição completa sem supervisão e grava tudo em projects/<slug>/headless.log. */
export async function runHeadless(job: Job, config: Config['headless'], claude = 'claude'): Promise<HeadlessResult> {
  const paths = projectPaths(job.slug);
  mkdirSync(paths.dir, { recursive: true });
  const logFile = join(paths.dir, 'headless.log');
  const log = (text: string) => appendFileSync(logFile, `${new Date().toISOString()} ${text}\n`, 'utf8');
  log(`início: ${job.file}`);
  const timeout = AbortSignal.timeout(config.timeoutMin * 60_000);
  let stdout = '';
  try {
    ({ stdout } = await run(claude, headlessArgs(headlessPrompt(job), config), {
      cwd: ROOT,
      env: headlessEnv(process.env, config),
      signal: timeout,
      onStderrLine: (line) => log(`stderr: ${line}`),
    }));
  } catch (error) {
    const message = timeout.aborted ? `tempo esgotado (${config.timeoutMin} min)` : error instanceof Error ? error.message : String(error);
    log(`erro: ${message}`);
    return { ok: false, summary: message.split('\n')[0]!.slice(0, 300), costUsd: null, turns: null };
  }
  const check = checkDeliverables(existsSync(paths.outputDir) ? readdirSync(paths.outputDir) : []);
  const result = { ...parseHeadlessOutput(stdout, check.delivered), present: check.present, missing: check.missing };
  log(`fim: ${result.ok ? 'ok' : 'falha'} — ${result.summary} (turnos ${result.turns ?? '?'}, custo ${result.costUsd ?? '?'}; faltou: ${check.missing.join(', ') || 'nada'})`);
  return result;
}
