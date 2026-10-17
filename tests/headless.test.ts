import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { configSchema } from '../src/config.ts';
import { CommandError, run } from '../src/lib/exec.ts';
import { HEADLESS_TOOLS, headlessArgs, headlessEnv, headlessPrompt, parseHeadlessOutput } from '../src/watcher/headless.ts';
import { jobNotification, runWatcher } from '../src/watcher/index.ts';
import { enqueue, type Job, loadQueue, saveQueue } from '../src/watcher/queue.ts';

const config = configSchema.parse({}).headless;
const dir = mkdtempSync(join(tmpdir(), 'mce-headless-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('sessão headless', () => {
  it('o prompt aponta o arquivo, o projeto, as entregas e o veredito final', () => {
    const prompt = headlessPrompt({ file: 'D:\\inbox\\Aula 1.mp4', slug: 'aula-1' });
    expect(prompt).toContain('"D:\\inbox\\Aula 1.mp4"');
    expect(prompt).toContain('skill edit-video');
    expect(prompt).toContain('-p aula-1');
    expect(prompt).toContain('output/aula-1/');
    expect(prompt).toContain('RESULTADO:');
  });

  it('roda sem as configurações globais do usuário, sem perguntar e só com as ferramentas liberadas', () => {
    const args = headlessArgs('edite', config);
    expect(args.slice(0, 2)).toEqual(['-p', 'edite']);
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('project,local');
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('dontAsk');
    expect(args[args.indexOf('--output-format') + 1]).toBe('json');
    const tools = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--output-format'));
    expect(tools).toEqual([...HEADLESS_TOOLS]);
    expect(tools).toContain('PowerShell(pnpm mce *)');
    expect(tools.some((tool) => /rm |Remove-Item|git push/.test(tool))).toBe(false);
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('--model');
    expect(args).not.toContain('--max-budget-usd');
  });

  it('modelo, teto de gasto e ferramentas extras entram quando configurados', () => {
    const args = headlessArgs('edite', { ...config, model: 'opus', maxBudgetUsd: 5, extraTools: ['Bash(magick *)'] });
    expect(args[args.indexOf('--model') + 1]).toBe('opus');
    expect(args[args.indexOf('--max-budget-usd') + 1]).toBe('5');
    expect(args).toContain('Bash(magick *)');
  });

  it('o ambiente da sessão filha não herda a sessão atual nem a API key (por padrão)', () => {
    const env = { PATH: 'x', ANTHROPIC_API_KEY: 'k', CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 's', CLAUDE_PID: '9', OUTRA: 'y' };
    expect(headlessEnv(env, config)).toEqual({ PATH: 'x', OUTRA: 'y' });
    expect(headlessEnv(env, { ...config, useApiKey: true })).toEqual({ PATH: 'x', OUTRA: 'y', ANTHROPIC_API_KEY: 'k' });
  });

  it('interpreta o resultado: só é sucesso se a sessão disse ok E o arquivo existe', () => {
    const json = (result: string, extra = {}) => JSON.stringify({ result, is_error: false, total_cost_usd: 1.25, num_turns: 40, ...extra });
    expect(parseHeadlessOutput(json('pronto\nRESULTADO: ok — 7 min, 42 cortes'), true)).toEqual({
      ok: true, summary: '7 min, 42 cortes', costUsd: 1.25, turns: 40,
    });
    const noFile = parseHeadlessOutput(json('RESULTADO: ok — tudo certo'), false);
    expect(noFile.ok).toBe(false);
    expect(noFile.summary).toContain('sem gerar final.mp4');
    expect(parseHeadlessOutput(json('RESULTADO: falha — transcrição quebrou'), true)).toMatchObject({ ok: false, summary: 'transcrição quebrou' });
    expect(parseHeadlessOutput(json('Credit balance is too low', { is_error: true }), true).ok).toBe(false);
    expect(parseHeadlessOutput('aviso solto\n' + json('RESULTADO: ok - feito'), true).ok).toBe(true);
    expect(parseHeadlessOutput('isso não é json', true)).toMatchObject({ ok: false, costUsd: null });
  });
});

describe('exec: cancelamento', () => {
  it('o sinal encerra o processo e a promessa rejeita', async () => {
    const started = Date.now();
    await expect(
      run(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { signal: AbortSignal.timeout(300) }),
    ).rejects.toBeInstanceOf(CommandError);
    expect(Date.now() - started).toBeLessThan(10_000);
  });
});

describe('watcher', () => {
  const job = (file: string) => enqueue([], file, new Date('2026-10-12T03:00:00Z')).job!;

  it('a notificação diz onde está o vídeo ou onde está o log do erro', () => {
    const done = jobNotification(job('D:/inbox/aula.mp4'), { ok: true, summary: '42 cortes', costUsd: null, turns: 30 }, 754);
    expect(done).toMatchObject({ ok: true, title: 'Vídeo pronto: aula' });
    expect(done.message).toContain('12:34');
    const failed = jobNotification(job('D:/inbox/aula.mp4'), { ok: false, summary: 'tempo esgotado', costUsd: null, turns: null }, 5);
    expect(failed).toMatchObject({ ok: false, title: 'Falha na edição: aula' });
    expect(failed.message).toContain('headless.log');
  });

  it('processa a fila inteira, um por vez, registra o resultado e recupera job interrompido', async () => {
    const queueFile = join(dir, 'queue.json');
    const notifyLog = join(dir, 'notificacoes.log');
    let queue: Job[] = [];
    ({ queue } = enqueue(queue, 'D:/inbox/a.mp4', new Date('2026-10-12T03:00:00Z')));
    ({ queue } = enqueue(queue, 'D:/inbox/b.mp4', new Date('2026-10-12T03:01:00Z')));
    // simula um watcher que morreu no meio do primeiro job
    queue[0] = { ...queue[0]!, status: 'running', startedAt: '2026-10-12T03:00:30.000Z', attempts: 1 };
    saveQueue(queue, queueFile);

    const order: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const logs: string[] = [];
    await runWatcher({
      once: true,
      queueFile,
      notifyLog,
      inbox: join(dir, 'inbox'),
      log: (message) => logs.push(message),
      edit: async (item) => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        order.push(item.slug);
        await new Promise((done) => setTimeout(done, 20));
        running -= 1;
        return item.slug === 'a'
          ? { ok: true, summary: 'feito', costUsd: null, turns: 10 }
          : { ok: false, summary: 'transcrição quebrou', costUsd: null, turns: 3 };
      },
    });

    expect(order).toEqual(['a', 'b']);
    expect(maxRunning).toBe(1);
    const final = loadQueue(queueFile);
    expect(final.map((item) => [item.slug, item.status, item.error])).toEqual([
      ['a', 'done', null],
      ['b', 'failed', 'transcrição quebrou'],
    ]);
    expect(final[0]!.attempts).toBe(2);
    expect(final.every((item) => item.finishedAt !== null)).toBe(true);
    const notified = readFileSync(notifyLog, 'utf8');
    expect(notified).toContain('[OK] Vídeo pronto: a');
    expect(notified).toContain('[FALHA] Falha na edição: b');
    expect(logs.some((line) => line.includes('editando a'))).toBe(true);
  });
});
