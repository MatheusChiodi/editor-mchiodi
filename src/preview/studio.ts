import { type ChildProcess, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';

import { ROOT } from '../project/paths.ts';
import { reelCompositionId, type SceneFile, sceneCompositionId } from '../scenes/sync.ts';

export const REMOTION_CLI = join(ROOT, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
export const STUDIO_ENTRY = 'motion/src/index.ts';

/** `remotion studio` sem abrir navegador por conta própria: quem abre o Chrome (na cena certa) é o visor. */
export function studioArgs(port: number, cli = REMOTION_CLI): string[] {
  return [cli, 'studio', STUDIO_ENTRY, '--port', String(port), '--no-open'];
}

export function studioUrl(port: number): string {
  return `http://localhost:${port}`;
}

export interface DatedScene extends SceneFile {
  /** mtime do arquivo (ms) */
  changedAt: number;
}

/**
 * Onde o Chrome abre: a cena gravada por último (do projeto, se houver slug). Sem cena ainda,
 * a raiz do Studio; a cena nova entra na barra lateral sozinha.
 */
export function studioTarget(base: string, scenes: DatedScene[], slug?: string): string {
  const root = base.replace(/\/+$/, '');
  const pool = slug ? scenes.filter((scene) => scene.project === slug) : scenes;
  const latest = [...pool].sort((a, b) => b.changedAt - a.changedAt)[0];
  return latest ? `${root}/${sceneCompositionId(latest)}` : root;
}

/** Composição que toca todas as cenas do projeto em sequência. */
export function reelTarget(base: string, slug: string): string {
  return `${base.replace(/\/+$/, '')}/${reelCompositionId(slug)}`;
}

function portFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(false));
    probe.listen(port, () => probe.close(() => done(true)));
  });
}

/** Primeira porta livre a partir de `from` (pulando as de `skip`). */
export async function findFreePort(from: number, skip: number[] = [], attempts = 30): Promise<number> {
  for (let port = from; port < from + attempts; port += 1) {
    if (!skip.includes(port) && (await portFree(port))) return port;
  }
  throw new Error(`nenhuma porta livre entre ${from} e ${from + attempts - 1}`);
}

/** Sobe o Remotion Studio como filho deste processo; a saída dele vai para `logFile`. */
export function spawnStudio(port: number, logFile: string): ChildProcess {
  mkdirSync(dirname(logFile), { recursive: true });
  const log = openSync(logFile, 'w');
  try {
    return spawn(process.execPath, studioArgs(port), { cwd: ROOT, stdio: ['ignore', log, log], windowsHide: true });
  } finally {
    closeSync(log);
  }
}

/** Espera o Studio aceitar conexão. false = o tempo acabou ou o processo morreu antes. */
export async function waitForStudio(url: string, child: ChildProcess, timeoutMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return false;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      await response.body?.cancel();
      if (response.status < 500) return true;
    } catch {
      // ainda subindo
    }
    await new Promise((wake) => setTimeout(wake, 300));
  }
  return false;
}
