import { spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from '../project/paths.ts';
import { scanScenes, SCENES_DIR } from '../scenes/sync.ts';
import { startPreviewServer } from './server.ts';
import {
  DEFAULT_PORT,
  findLiveServer,
  killTree,
  openInBrowser,
  PREVIEW_DIR,
  readServerInfo,
  removeServerInfo,
  SERVER_FILE,
  type ServerInfo,
  stopServer,
  viewerUrl,
  writeServerInfo,
} from './session.ts';
import { type DatedScene, findFreePort, spawnStudio, studioTarget, studioUrl, waitForStudio } from './studio.ts';
import type { PreviewMode } from './types.ts';

export const STUDIO_LOG = join(PREVIEW_DIR, 'studio.log');
const TSX_CLI = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const MCE_CLI = join(ROOT, 'src', 'cli', 'index.ts');

type Log = (message: string) => void;

export function datedScenes(dir = SCENES_DIR): DatedScene[] {
  return scanScenes(dir).flatMap((scene) => {
    try {
      return [{ ...scene, changedAt: statSync(join(dir, scene.project, `${scene.name}.tsx`)).mtimeMs }];
    } catch {
      return [];
    }
  });
}

export interface RunViewerOptions {
  port?: number;
  open?: boolean;
  /** prévias renderizadas no índice; `off` (padrão) deixa só o Studio tocando ao vivo */
  previews?: PreviewMode;
  force?: boolean;
  log: Log;
}

/**
 * `mce scenes watch`: sobe o Remotion Studio (player ao vivo, linha do tempo, hot reload) e o índice
 * leve das cenas, mantém o índice do Remotion em dia e fica no ar até Ctrl+C ou `mce scenes stop`.
 * Se já houver um visor vivo, só abre o Chrome nele e volta.
 */
export async function runViewer(slug: string | undefined, options: RunViewerOptions): Promise<void> {
  const live = await findLiveServer();
  if (live) {
    const target = studioTarget(live.url, datedScenes(), slug);
    if (options.open !== false) await openInBrowser(target);
    options.log(`visor já está no ar: ${target}`);
    return;
  }

  const port = await findFreePort(options.port ?? DEFAULT_PORT);
  const url = studioUrl(port);
  const studio = spawnStudio(port, STUDIO_LOG);
  const previews = options.previews ?? 'off';
  let stopping = false;
  const cleanup = () => {
    if (studio.pid && studio.exitCode === null) killTree(studio.pid);
    removeServerInfo(process.pid);
  };
  const shutdown = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    cleanup();
    await gallery?.close().catch(() => undefined);
    process.exit(code);
  };
  process.on('exit', cleanup);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(signal, () => void shutdown());

  const gallery = await startPreviewServer({
    port: await findFreePort(port + 1, [port]),
    // o renderizador puxa o bundler do Remotion: só carrega se as prévias foram pedidas
    renderer: previews === 'off' ? null : (await import('./render.ts')).createRemotionRenderer(),
    previews,
    studioUrl: url,
    focus: slug,
    force: options.force,
    onShutdown: () => void shutdown(),
  });

  if (!(await waitForStudio(url, studio))) {
    let tail = '';
    try {
      tail = readFileSync(STUDIO_LOG, 'utf8').split('\n').slice(-12).join('\n');
    } catch {
      // sem log
    }
    cleanup();
    await gallery.close();
    throw new Error(`o Remotion Studio não subiu na porta ${port}\n${tail}`);
  }
  studio.on('exit', () => {
    if (!stopping) options.log('o Remotion Studio encerrou; fechando o visor');
    void shutdown(stopping ? 0 : 1);
  });

  writeServerInfo({ url, pid: process.pid, startedAt: Date.now(), galleryUrl: gallery.url, studioPid: studio.pid });
  const target = studioTarget(url, datedScenes(), slug);
  options.log(`Studio:  ${target}`);
  options.log(`índice:  ${viewerUrl(gallery.url, slug)}`);
  options.log('cena nova ou apagada entra na barra lateral sozinha · encerrar: Ctrl+C ou `pnpm mce scenes stop`');
  if (options.open !== false) await openInBrowser(target);
}

export interface EnsureViewerOptions {
  port?: number;
  /** quanto esperar o visor subir antes de desistir */
  timeoutMs?: number;
  log?: Log;
  /** injeções para teste */
  findLive?: () => Promise<ServerInfo | null>;
  launch?: (slug: string, port: number) => void;
  open?: (url: string) => Promise<boolean>;
  scenes?: () => DatedScene[];
}

/** Sobe `mce scenes watch <slug> --no-open` solto do processo atual: não morre com ele nem o segura. */
export function launchDetached(slug: string, port: number): void {
  const child = spawn(process.execPath, [TSX_CLI, MCE_CLI, 'scenes', 'watch', slug, '--no-open', '--port', String(port)], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', () => undefined);
  child.unref();
}

/**
 * Garante o visor no ar e abre o Chrome na cena mais recente do projeto. É o que o watcher chama no
 * começo de cada edição autônoma. Nunca lança: falha vira `false` e uma linha no log.
 */
export async function ensureViewer(slug: string, options: EnsureViewerOptions = {}): Promise<boolean> {
  const log = options.log ?? (() => undefined);
  try {
    const findLive = options.findLive ?? (() => findLiveServer());
    let live = await findLive();
    if (!live) {
      (options.launch ?? launchDetached)(slug, options.port ?? DEFAULT_PORT);
      const deadline = Date.now() + (options.timeoutMs ?? 60_000);
      while (!live && Date.now() < deadline) {
        await new Promise((wake) => setTimeout(wake, Math.min(400, options.timeoutMs ?? 400)));
        live = await findLive();
      }
      if (!live) {
        log('visor de cenas: não subiu a tempo (veja projects/.preview/studio.log)');
        return false;
      }
    }
    const target = studioTarget(live.url, (options.scenes ?? datedScenes)(), slug);
    const opened = await (options.open ?? openInBrowser)(target);
    log(opened ? `visor de cenas: ${target}` : `visor de cenas no ar, mas não consegui abrir o navegador: ${target}`);
    return opened;
  } catch (error) {
    log(`visor de cenas: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/** `mce scenes open`: abre o Chrome no visor que já está no ar. */
export async function openViewer(slug: string | undefined, log: Log): Promise<boolean> {
  const live = await findLiveServer();
  if (!live) {
    log(`o visor não está no ar. Suba com: pnpm mce scenes watch${slug ? ` ${slug}` : ''}`);
    return false;
  }
  const target = studioTarget(live.url, datedScenes(), slug);
  await openInBrowser(target);
  log(target);
  return true;
}

/** `mce scenes stop`: encerra o visor (Studio incluído) e apaga o server.json. Devolve a RAM antes de um render pesado. */
export async function stopViewer(log: Log = () => undefined, file = SERVER_FILE): Promise<boolean> {
  const info = readServerInfo(file);
  if (!info) {
    log('o visor não está no ar');
    return false;
  }
  const stopped = await stopServer(info, file);
  log(stopped ? 'visor encerrado' : `não consegui encerrar o processo ${info.pid}`);
  return stopped;
}
