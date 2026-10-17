import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { killTree } from '../preview/session.ts';
import { ROOT } from '../project/paths.ts';
import { EXPORT_FITS, EXPORT_FORMATS, type ExportRequest } from '../render/formats.ts';

export const JOB_KINDS = ['render', 'final', 'shorts', 'eval', 'evalFinal', 'export'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export interface JobRequest {
  kind: JobKind;
  /** versão da EDL (padrão: a mais recente) */
  edl?: number;
  export?: ExportRequest;
}

const TSX_CLI = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const MCE_CLI = join(ROOT, 'src', 'cli', 'index.ts');

/** Argumentos do `mce` para cada ação da UI. O render é sempre o `mce render` existente. */
export function mceArgs(slug: string, request: JobRequest): string[] {
  const version = request.edl !== undefined ? ['--edl', String(request.edl)] : [];
  switch (request.kind) {
    case 'render':
      return ['render', slug, ...version];
    case 'final':
      return ['render', slug, '--final', ...version];
    case 'shorts':
      return ['render', slug, '--shorts', '--final', ...version];
    case 'eval':
      return ['eval', slug, ...version];
    case 'evalFinal':
      return ['eval', slug, '--final', ...version];
    case 'export': {
      const spec = request.export;
      if (!spec || !EXPORT_FORMATS.includes(spec.format)) throw new Error(`export precisa de format: ${EXPORT_FORMATS.join(' | ')}`);
      if (spec.fit && !EXPORT_FITS.includes(spec.fit)) throw new Error(`fit: ${EXPORT_FITS.join(' | ')}`);
      return [
        'export', slug, '--format', spec.format,
        ...(spec.fit ? ['--fit', spec.fit] : []),
        ...(spec.focusX !== undefined ? ['--focus', String(spec.focusX)] : []),
        ...(spec.scope === 'shorts' ? ['--shorts'] : []),
        ...version,
      ];
    }
  }
}

/**
 * Onde o `mce render` deixa o vídeo de cada job (relativo à pasta do projeto), para a UI abrir o resultado.
 * Mesma convenção de `renderDir`/`outputNames` (src/render/index.ts): renders/v<N>-[shorts-]<modo>/.
 */
export function jobOutputRel(kind: JobKind, version: number): string | null {
  if (kind === 'render') return `renders/v${version}-preview/preview.mp4`;
  if (kind === 'final') return `renders/v${version}-final/final.mp4`;
  if (kind === 'shorts') return `renders/v${version}-shorts-final/shorts-final.mp4`;
  return null;
}

/** `mce eval` sai com 2 quando a avaliação reprova: o processo funcionou, os achados é que pedem correção. */
export function jobSucceeded(kind: JobKind, code: number | null): boolean {
  return code === 0 || ((kind === 'eval' || kind === 'evalFinal') && code === 2);
}

export interface SpawnedJob {
  done: Promise<number | null>;
  cancel: () => void;
}

/**
 * Roda `pnpm mce <args>` como processo filho, sem shell: o mesmo que `pnpm mce` (tsx + src/cli/index.ts),
 * chamado pelo node direto porque `pnpm.cmd` no Windows exigiria shell. Cada linha de saída vai para `onLine`.
 */
export function spawnMce(args: string[], onLine: (line: string) => void): SpawnedJob {
  const child = spawn(process.execPath, [TSX_CLI, MCE_CLI, ...args], { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const feed = () => {
    let pending = '';
    return (chunk: string) => {
      pending += chunk;
      const parts = pending.split(/\r?\n|\r/);
      pending = parts.pop() ?? '';
      for (const part of parts) if (part.trim()) onLine(part);
    };
  };
  child.stdout.setEncoding('utf8').on('data', feed());
  child.stderr.setEncoding('utf8').on('data', feed());
  const done = new Promise<number | null>((resolve) => {
    child.on('error', (error) => {
      onLine(`erro: ${error.message}`);
      resolve(null);
    });
    child.on('close', (code) => resolve(code));
  });
  // o tsx roda o script num processo neto: mata a árvore inteira
  return { done, cancel: () => (child.pid ? killTree(child.pid) : undefined) };
}
