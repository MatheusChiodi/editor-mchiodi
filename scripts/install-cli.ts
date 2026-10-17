import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT } from '../src/project/paths.ts';

/** Marca os arquivos gerados aqui: só eles são sobrescritos ou apagados. */
export const SHIM_MARKER = 'editor-mchiodi:mce-shim';
/** Marca de antes da troca de nome do projeto: shims já instalados com ela continuam sendo nossos. */
export const LEGACY_SHIM_MARKERS = ['mchiodi-editor:mce-shim'] as const;
export const SHIM_NAMES = { cmd: 'mce.cmd', ps1: 'mce.ps1' } as const;

export interface ShimTargets {
  tsx: string;
  tsconfig: string;
  entry: string;
}

/** O shim chama o tsx do próprio projeto; `--tsconfig` porque o tsx procura o tsconfig na pasta atual. */
export function shimTargets(root: string): ShimTargets {
  return {
    tsx: win32.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    tsconfig: win32.join(root, 'tsconfig.json'),
    entry: win32.join(root, 'src', 'cli', 'index.ts'),
  };
}

/** `mce.cmd`: repassa todos os argumentos (`%*`) e o código de saída. Só ASCII e CRLF, como o cmd espera. */
export function cmdShim(root: string): string {
  const { tsx, tsconfig, entry } = shimTargets(root);
  const quote = (path: string) => `"${path.replaceAll('%', '%%')}"`;
  return [
    '@echo off',
    `rem ${SHIM_MARKER} - gerado por "pnpm run install-cli" em ${root.replaceAll('%', '%%')}`,
    `node ${quote(tsx)} --tsconfig ${quote(tsconfig)} ${quote(entry)} %*`,
    'exit /b %ERRORLEVEL%',
    '',
  ].join('\r\n');
}

/** `mce.ps1`: o PowerShell prefere este ao .cmd; não passa pelo cmd (sem "Deseja finalizar o arquivo em lotes?"). */
export function ps1Shim(root: string): string {
  const { tsx, tsconfig, entry } = shimTargets(root);
  const quote = (path: string) => `'${path.replaceAll("'", "''")}'`;
  return [
    `# ${SHIM_MARKER} - gerado por "pnpm run install-cli" em ${root}`,
    `& node ${quote(tsx)} --tsconfig ${quote(tsconfig)} ${quote(entry)} @args`,
    'exit $LASTEXITCODE',
    '',
  ].join('\r\n');
}

export function isOurShim(content: string): boolean {
  return [SHIM_MARKER, ...LEGACY_SHIM_MARKERS].some((marker) => content.includes(marker));
}

const normalizeDir = (dir: string) => win32.normalize(dir.trim().replace(/^"|"$/g, '')).replace(/[\\/]+$/, '').toLowerCase();

export interface BinDir {
  dir: string;
  /** está no PATH mas ainda não existe em disco */
  create: boolean;
}

/**
 * Pasta do usuário que JÁ está no PATH para receber o shim: `~\.local\bin` ou `~\bin`,
 * de preferência a que existe. null = nenhuma serve (o instalador não mexe no PATH).
 */
export function pickBinDir(pathValue: string, home: string, exists: (dir: string) => boolean): BinDir | null {
  const onPath = new Set(pathValue.split(';').filter((entry) => entry.trim()).map(normalizeDir));
  const candidates = [win32.join(home, '.local', 'bin'), win32.join(home, 'bin')].filter((dir) => onPath.has(normalizeDir(dir)));
  const existing = candidates.find(exists);
  if (existing) return { dir: existing, create: false };
  return candidates[0] ? { dir: candidates[0], create: true } : null;
}

/** Política de execução do PowerShell que deixa rodar um .ps1 local sem assinatura. */
export function allowsLocalScripts(policy: string): boolean {
  return ['remotesigned', 'unrestricted', 'bypass'].includes(policy.trim().toLowerCase());
}

function executionPolicy(): string {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-ExecutionPolicy'], { encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : '';
}

function ours(file: string): boolean {
  return isOurShim(readFileSync(file, 'utf8'));
}

function install(bin: BinDir): void {
  const targets = shimTargets(ROOT);
  if (!existsSync(targets.tsx)) throw new Error(`tsx não encontrado em ${targets.tsx}\nRode "pnpm install" nesta pasta antes.`);
  if (bin.create) mkdirSync(bin.dir, { recursive: true });

  const policy = executionPolicy();
  const withPs1 = allowsLocalScripts(policy);
  const files: [string, string | null][] = [
    [join(bin.dir, SHIM_NAMES.cmd), cmdShim(ROOT)],
    // BOM: o Windows PowerShell 5.1 lê .ps1 sem BOM como ANSI
    [join(bin.dir, SHIM_NAMES.ps1), withPs1 ? `﻿${ps1Shim(ROOT)}` : null],
  ];
  for (const [file] of files) {
    if (existsSync(file) && !ours(file)) throw new Error(`${file} já existe e não foi criado por este instalador. Apague ou renomeie e rode de novo.`);
  }
  for (const [file, content] of files) {
    if (content === null) rmSync(file, { force: true });
    else writeFileSync(file, content, 'utf8');
  }

  console.log(`mce instalado em ${bin.dir} (${files.filter(([, content]) => content !== null).map(([file]) => win32.basename(file)).join(', ')})`);
  console.log(`aponta para ${ROOT}`);
  if (!withPs1) console.log(`mce.ps1 não foi criado: a política de execução do PowerShell é "${policy || 'desconhecida'}"; o mce.cmd atende o PowerShell também.`);
  if (/[^\x20-\x7E]/.test(ROOT)) console.log('atenção: o caminho do projeto tem acento; o mce.cmd pode falhar no cmd. Use o PowerShell ou mova o projeto.');
  console.log('Rode de qualquer pasta, no PowerShell ou no cmd: mce levels');
  console.log('Se mover a pasta do projeto, rode "pnpm run install-cli" de novo.');
}

function uninstall(home: string): void {
  const removed: string[] = [];
  for (const dir of [win32.join(home, '.local', 'bin'), win32.join(home, 'bin')]) {
    for (const name of Object.values(SHIM_NAMES)) {
      const file = join(dir, name);
      if (!existsSync(file) || !ours(file)) continue;
      rmSync(file);
      removed.push(file);
    }
  }
  console.log(removed.length ? `removido:\n${removed.join('\n')}` : 'nada a remover: o mce global não está instalado');
}

function main(): void {
  if (process.platform !== 'win32') throw new Error('instalador só para Windows; em outros sistemas crie um alias para "pnpm --dir <projeto> mce".');
  const home = homedir();
  if (process.argv.includes('--uninstall')) return uninstall(home);
  const bin = pickBinDir(process.env.PATH ?? '', home, existsSync);
  if (!bin) {
    throw new Error(
      `nenhuma pasta sua está no PATH para receber o comando.\nAdicione ${win32.join(home, '.local', 'bin')} ao PATH do usuário ` +
        '(Configurações → "variáveis de ambiente" → Path do usuário → Novo), abra um terminal novo e rode "pnpm run install-cli" de novo.',
    );
  }
  install(bin);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`erro: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
