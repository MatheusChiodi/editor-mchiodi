import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { PROJECTS_DIR, readJson, writeJson } from '../project/paths.ts';

export const PREVIEW_DIR = join(PROJECTS_DIR, '.preview');
/** Contrato com o painel do terminal (tecla "abrir visor"): `{ url, pid, startedAt }`. */
export const SERVER_FILE = join(PREVIEW_DIR, 'server.json');
export const DEFAULT_PORT = 4173;
export const SHUTDOWN_HEADER = 'x-mce-preview';

export interface ServerInfo {
  /** endereço do Remotion Studio (a experiência principal) */
  url: string;
  /** processo do visor (`mce scenes watch`); o Studio é filho dele */
  pid: number;
  /** ms desde a época, como em live.json */
  startedAt: number;
  /** índice leve das cenas (estado, erros, trecho da EDL) */
  galleryUrl?: string;
  studioPid?: number;
}

export function readServerInfo(file = SERVER_FILE): ServerInfo | null {
  if (!existsSync(file)) return null;
  try {
    const info = readJson<ServerInfo>(file);
    return typeof info.url === 'string' && typeof info.pid === 'number' ? info : null;
  } catch {
    return null;
  }
}

export function writeServerInfo(info: ServerInfo, file = SERVER_FILE): void {
  writeJson(file, info);
}

/** Só apaga o registro que é deste processo: outro visor pode ter subido depois. */
export function removeServerInfo(pid: number, file = SERVER_FILE): void {
  if (readServerInfo(file)?.pid === pid) rmSync(file, { force: true });
}

/** Endereço da página, já filtrada pelo projeto quando há slug. */
export function viewerUrl(base: string, slug?: string): string {
  const url = new URL('/', base);
  if (slug) url.searchParams.set('projeto', slug);
  return url.toString();
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** O Studio responde na porta registrada. */
export async function pingServer(info: ServerInfo, timeoutMs = 2500): Promise<boolean> {
  try {
    const response = await fetch(info.url, { signal: AbortSignal.timeout(timeoutMs) });
    await response.body?.cancel();
    return response.status < 500;
  } catch {
    return false;
  }
}

/** Visor no ar, ou null. Registro de um processo que morreu sem limpar é apagado aqui. */
export async function findLiveServer(file = SERVER_FILE): Promise<ServerInfo | null> {
  const info = readServerInfo(file);
  if (!info) return null;
  if (pidAlive(info.pid) && (await pingServer(info))) return info;
  rmSync(file, { force: true });
  return null;
}

export interface OpenCommand {
  command: string;
  args: string[];
}

/** Tentativas de abrir a URL, em ordem: Chrome, depois o navegador padrão. Args em array, nada interpolado em shell. */
export function openCommands(url: string, platform: NodeJS.Platform = process.platform): OpenCommand[] {
  if (platform === 'win32') {
    return [
      { command: 'cmd', args: ['/c', 'start', '', 'chrome', url] },
      { command: 'cmd', args: ['/c', 'start', '', url] },
    ];
  }
  if (platform === 'darwin') {
    return [
      { command: 'open', args: ['-a', 'Google Chrome', url] },
      { command: 'open', args: [url] },
    ];
  }
  return [
    { command: 'google-chrome', args: [url] },
    { command: 'xdg-open', args: [url] },
  ];
}

function tryOpen({ command, args }: OpenCommand): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    child.on('error', () => done(false));
    child.on('close', (code) => done(code === 0));
  });
}

export async function openInBrowser(url: string, commands = openCommands(url)): Promise<boolean> {
  for (const command of commands) if (await tryOpen(command)) return true;
  return false;
}

/** Mata o processo e os filhos dele (o Studio é filho do visor). */
export function killTree(pid: number): void {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // já morreu
    }
  }
}

async function waitDead(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!pidAlive(pid)) return true;
    await new Promise((wake) => setTimeout(wake, 150));
  }
  return !pidAlive(pid);
}

/**
 * Encerra o visor registrado: pede com educação (ele fecha o Studio e apaga o registro) e, se não
 * sair, derruba a árvore de processos. O registro some de qualquer jeito.
 */
export async function stopServer(info: ServerInfo, file = SERVER_FILE, graceMs = 8000): Promise<boolean> {
  let dead = !pidAlive(info.pid);
  if (!dead && info.galleryUrl) {
    try {
      await fetch(new URL('/api/shutdown', info.galleryUrl), { method: 'POST', headers: { [SHUTDOWN_HEADER]: '1' }, signal: AbortSignal.timeout(3000) });
      dead = await waitDead(info.pid, graceMs);
    } catch {
      // não respondeu: vai na força
    }
  }
  if (!dead) {
    killTree(info.pid);
    dead = await waitDead(info.pid, 5000);
  }
  // o Studio pode ter ficado órfão se o visor foi morto por fora
  if (info.studioPid && pidAlive(info.studioPid)) killTree(info.studioPid);
  if (readServerInfo(file)?.pid === info.pid) rmSync(file, { force: true });
  return dead;
}
