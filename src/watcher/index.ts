import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { watch } from 'chokidar';

import { loadConfig } from '../config.ts';
import { LEVEL_IDS, type LevelId } from '../edl/levels.ts';
import { formatClock } from '../lib/time.ts';
import { INBOX_DIR, projectPaths } from '../project/paths.ts';
import { describeDelivery } from './deliverables.ts';
import { type HeadlessResult, runHeadless } from './headless.ts';
import { notify, type Notification } from './notify.ts';
import { enqueue, inboxLevel, type Job, loadQueue, nextJob, recoverInterrupted, saveQueue, summarize, updateJob } from './queue.ts';

export interface WatchOptions {
  log: (message: string) => void;
  /** processa a fila atual e sai, sem ficar observando (útil em teste e em agendador) */
  once?: boolean;
  /** injeção para teste: quem edita um job */
  edit?: (job: Job) => Promise<HeadlessResult>;
  /**
   * Abre o visor de cenas (Remotion Studio no Chrome) no começo de cada edição. Padrão: `ensureViewer` quando
   * `preview.autoOpen` está ligado e a edição é a de verdade (com `edit` injetado, nada sobe).
   */
  openViewer?: (slug: string) => Promise<boolean>;
  inbox?: string;
  queueFile?: string;
  notifyLog?: string;
}

/** Mensagem de fim de job, para o log e para o push no celular. */
export function jobNotification(job: Job, result: HeadlessResult, elapsedSec: number): Notification {
  const paths = projectPaths(job.slug);
  return result.ok
    ? {
        ok: true,
        title: `Vídeo pronto: ${job.slug}`,
        message: [
          paths.outputDir,
          `final.mp4 em ${formatClock(elapsedSec, 0)} de processamento`,
          ...(result.present ? [describeDelivery({ delivered: true, present: result.present, missing: result.missing ?? [] })] : []),
          result.summary,
        ].join('\n'),
      }
    : {
        ok: false,
        title: `Falha na edição: ${job.slug}`,
        message: `${result.summary || 'sem detalhes'}\nlog: ${paths.dir}\\headless.log`,
      };
}

/**
 * Observa a inbox e edita um vídeo por vez. A fila fica em disco: se o watcher cair no meio,
 * o job interrompido volta para a fila na próxima subida.
 */
/** Põe um arquivo de qualquer pasta na fila, sem copiar nem mover o original. */
export function sendToQueue(file: string, level: LevelId | null, queueFile?: string, now = new Date()): Job | null {
  const { queue, job } = enqueue(loadQueue(queueFile), resolve(file), now, level);
  if (job) saveQueue(queue, queueFile);
  return job;
}

export async function runWatcher(options: WatchOptions): Promise<void> {
  const config = loadConfig();
  const inbox = options.inbox ?? INBOX_DIR;
  const edit = options.edit ?? ((job: Job) => runHeadless(job, config.headless));
  const openViewer =
    options.openViewer ??
    (config.preview.autoOpen && !options.edit
      ? (slug: string) => import('../preview/index.ts').then((preview) => preview.ensureViewer(slug, { port: config.preview.port, log: options.log }))
      : null);
  const load = () => loadQueue(options.queueFile);
  const save = (queue: Job[]) => saveQueue(queue, options.queueFile);
  // uma pasta por nível: soltar o vídeo em inbox/pro/ é escolher a edição profissional
  for (const level of LEVEL_IDS) mkdirSync(join(inbox, level), { recursive: true });
  save(recoverInterrupted(load()));

  let working = false;
  const drain = async () => {
    if (working) return;
    working = true;
    try {
      for (let job = nextJob(load()); job; job = nextJob(load())) {
        const startedAt = Date.now();
        save(updateJob(load(), job.id, { status: 'running', startedAt: new Date().toISOString(), attempts: job.attempts + 1 }));
        options.log(`editando ${job.slug} (${job.file})`);
        // sem await: o visor leva alguns segundos para subir e nunca pode segurar nem derrubar a edição
        void openViewer?.(job.slug).catch((error: unknown) => options.log(`visor de cenas: ${error instanceof Error ? error.message : String(error)}`));
        const result = await edit(job);
        save(
          updateJob(load(), job.id, {
            status: result.ok ? 'done' : 'failed',
            finishedAt: new Date().toISOString(),
            error: result.ok ? null : result.summary,
          }),
        );
        const notification = jobNotification(job, result, (Date.now() - startedAt) / 1000);
        const pushed = await notify(config.notify, notification, options.notifyLog);
        options.log(`${notification.title}${pushed ? ' (push enviado)' : ''} · ${summarize(load())}`);
      }
    } finally {
      working = false;
    }
  };

  const add = (file: string) => {
    const { accepted, level } = inboxLevel(resolve(inbox), resolve(file));
    if (!accepted) return;
    const { queue, job } = enqueue(load(), resolve(file), new Date(), level);
    if (!job) return;
    save(queue);
    options.log(`na fila: ${job.slug}${level ? ` (nível ${level})` : ''} · ${summarize(queue)}`);
    void drain();
  };

  if (options.once) {
    await drain();
    return;
  }

  // awaitWriteFinish: só enfileira quando a cópia do arquivo terminou (tamanho estável por 5 s)
  const watcher = watch(inbox, {
    depth: 1,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 5000, pollInterval: 500 },
  });
  watcher.on('add', add);
  options.log(`observando ${inbox} · ${summarize(load())}`);
  await drain();
  await new Promise<void>((done) => {
    process.once('SIGINT', () => {
      void watcher.close().then(done);
    });
  });
}
