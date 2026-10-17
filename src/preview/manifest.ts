import { createHash } from 'node:crypto';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { readJson, writeJson } from '../project/paths.ts';
import type { RenderResult, StripFrame, StripResult } from './types.ts';

/** Suba quando o formato das prévias mudar (tamanho, codec, nº de frames): invalida o que já foi gerado. */
export const RENDER_VERSION = 1;
export const MANIFEST_FILE = 'manifest.json';

export interface PreviewManifest {
  version: number;
  key: string;
  /** hash do fonte que gerou estes arquivos */
  hash: string;
  renderedAt: number;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  strip: StripFrame[];
  /** null enquanto só a tira existe */
  video: string | null;
  timings: { stripMs: number; videoMs: number | null };
}

export interface SourceFile {
  name: string;
  content: string;
}

/**
 * Hash da cena: o próprio arquivo + os auxiliares da pasta do projeto (kits, glifos, lógica),
 * porque mexer num auxiliar muda o que a cena desenha.
 */
export function sceneHash(source: string, helpers: SourceFile[] = []): string {
  const hash = createHash('sha256').update(source);
  for (const helper of [...helpers].sort((a, b) => a.name.localeCompare(b.name))) hash.update(`\0${helper.name}\0${helper.content}`);
  return hash.digest('hex');
}

export function filePrefix(hash: string): string {
  return hash.slice(0, 10);
}

/** Re-renderiza quando o fonte mudou, o formato mudou, a prévia não terminou ou algum arquivo sumiu do disco. */
export function needsRender(manifest: PreviewManifest | null, hash: string, exists: (file: string) => boolean, wantVideo = true): boolean {
  if (!manifest || manifest.version !== RENDER_VERSION || manifest.hash !== hash) return true;
  if (wantVideo ? !manifest.video || !exists(manifest.video) : manifest.video !== null && !exists(manifest.video)) return true;
  return manifest.strip.length === 0 || manifest.strip.some((frame) => !exists(frame.file));
}

export function buildManifest(key: string, hash: string, result: StripResult | RenderResult, now: number): PreviewManifest {
  return {
    version: RENDER_VERSION,
    key,
    hash,
    renderedAt: now,
    fps: result.fps,
    durationInFrames: result.durationInFrames,
    width: result.width,
    height: result.height,
    strip: result.strip,
    video: 'video' in result ? result.video : null,
    timings: { stripMs: result.stripMs, videoMs: 'videoMs' in result ? result.videoMs : null },
  };
}

/** Arquivos de renders antigos que o manifest atual não usa mais. */
export function staleFiles(files: string[], manifest: PreviewManifest): string[] {
  const keep = new Set([MANIFEST_FILE, ...manifest.strip.map((frame) => frame.file), ...(manifest.video ? [manifest.video] : [])]);
  return files.filter((file) => !keep.has(file));
}

export function readManifest(dir: string): PreviewManifest | null {
  const file = join(dir, MANIFEST_FILE);
  if (!existsSync(file)) return null;
  try {
    return readJson<PreviewManifest>(file);
  } catch {
    return null;
  }
}

export function writeManifest(dir: string, manifest: PreviewManifest): PreviewManifest {
  writeJson(join(dir, MANIFEST_FILE), manifest);
  return manifest;
}

/** Apaga o que sobrou de renders anteriores. Arquivo ainda aberto pelo navegador fica para a próxima. */
export function cleanStale(dir: string, manifest: PreviewManifest): void {
  for (const file of staleFiles(readdirSync(dir), manifest)) {
    try {
      rmSync(join(dir, file), { force: true });
    } catch {
      // em uso (Windows): some na próxima limpeza
    }
  }
}
