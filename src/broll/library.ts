import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';

import { probe } from '../analyze/media.ts';
import { ASSETS_DIR } from '../project/paths.ts';
import { tagsOf } from './terms.ts';

export const BROLL_DIR = join(ASSETS_DIR, 'broll');
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.webm']);
export const LOCAL_LICENSE = 'própria/local (confira antes de publicar)';
export const PEXELS_LICENSE = 'Pexels License (https://www.pexels.com/license/)';

export interface BrollEntry {
  /** caminho relativo a assets/broll, com `/` */
  file: string;
  /** radicais normalizados (sem acento/caixa/plural); as do nome do arquivo + as que você acrescentar à mão */
  tags: string[];
  durationSec: number;
  width: number;
  height: number;
  source: 'local' | 'pexels';
  license: string;
  author?: string;
  url?: string;
  /** tamanho e data do arquivo quando foi medido: mudou, mede de novo */
  size: number;
  mtimeMs: number;
  addedAt: string;
}

export interface BrollIndex {
  updatedAt: string;
  entries: BrollEntry[];
}

export const indexFile = (root = BROLL_DIR) => join(root, 'index.json');

export function readIndex(root = BROLL_DIR): BrollIndex {
  const file = indexFile(root);
  if (!existsSync(file)) return { updatedAt: '', entries: [] };
  return JSON.parse(readFileSync(file, 'utf8')) as BrollIndex;
}

export function writeIndex(index: BrollIndex, root = BROLL_DIR): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(indexFile(root), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

/** Tags a partir do caminho: pastas + nome do arquivo (`cafe/caneca-fumaca_01.mp4` → cafe, caneca, fumaca). */
export function tagsFromName(file: string): string[] {
  const path = file.replace(/\\/g, '/');
  const name = basename(path, extname(path));
  const folders = path.split('/').slice(0, -1).filter((folder) => folder !== 'pexels');
  return tagsOf([...folders, name].join(' '));
}

export interface ScannedFile {
  file: string;
  size: number;
  mtimeMs: number;
}

/** Vídeos sob a pasta (recursivo), caminhos relativos com `/`. */
export function scanFiles(root = BROLL_DIR): ScannedFile[] {
  if (!existsSync(root)) return [];
  const found: ScannedFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (VIDEO_EXTENSIONS.has(extname(name).toLowerCase())) {
        found.push({ file: relative(root, full).split(sep).join('/'), size: stat.size, mtimeMs: Math.round(stat.mtimeMs) });
      }
    }
  };
  walk(root);
  return found.sort((a, b) => a.file.localeCompare(b.file));
}

export interface IndexPlan {
  /** entradas que continuam valendo (arquivo igual) */
  kept: BrollEntry[];
  /** arquivos novos ou alterados: precisam de ffprobe */
  toProbe: ScannedFile[];
  /** entradas cujo arquivo sumiu */
  removed: string[];
}

/** O que muda no índice: preserva tags, origem e licença de quem já estava lá; só mede o que é novo ou mudou. */
export function planIndex(current: BrollIndex, scanned: readonly ScannedFile[]): IndexPlan {
  const byFile = new Map(current.entries.map((entry) => [entry.file, entry]));
  const kept: BrollEntry[] = [];
  const toProbe: ScannedFile[] = [];
  for (const file of scanned) {
    const entry = byFile.get(file.file);
    if (entry && entry.size === file.size && entry.mtimeMs === file.mtimeMs) kept.push(entry);
    else toProbe.push(file);
  }
  const present = new Set(scanned.map((file) => file.file));
  return { kept, toProbe, removed: current.entries.filter((entry) => !present.has(entry.file)).map((entry) => entry.file) };
}

export interface Measured {
  durationSec: number;
  width: number;
  height: number;
}

/** Entrada nova (ou re-medida): tags do nome somadas às que já existiam; origem/licença preservadas. */
export function makeEntry(file: ScannedFile, measured: Measured, previous: BrollEntry | undefined, now: string): BrollEntry {
  const pexels = file.file.startsWith('pexels/');
  return {
    file: file.file,
    tags: [...new Set([...tagsFromName(file.file), ...(previous?.tags ?? [])])],
    ...measured,
    source: previous?.source ?? (pexels ? 'pexels' : 'local'),
    license: previous?.license ?? (pexels ? PEXELS_LICENSE : LOCAL_LICENSE),
    ...(previous?.author ? { author: previous.author } : {}),
    ...(previous?.url ? { url: previous.url } : {}),
    size: file.size,
    mtimeMs: file.mtimeMs,
    addedAt: previous?.addedAt ?? now,
  };
}

export interface IndexResult {
  index: BrollIndex;
  added: string[];
  removed: string[];
  failed: { file: string; error: string }[];
}

/** `mce broll index`: varre assets/broll, mede o que é novo (ffprobe) e grava o índice. */
export async function updateIndex(root = BROLL_DIR, measure: (path: string) => Promise<Measured> = probe): Promise<IndexResult> {
  const current = readIndex(root);
  const plan = planIndex(current, scanFiles(root));
  const previous = new Map(current.entries.map((entry) => [entry.file, entry]));
  const now = new Date().toISOString();
  const added: string[] = [];
  const failed: IndexResult['failed'] = [];
  const entries = [...plan.kept];
  for (const file of plan.toProbe) {
    try {
      const info = await measure(join(root, file.file));
      entries.push(makeEntry(file, { durationSec: info.durationSec, width: info.width, height: info.height }, previous.get(file.file), now));
      added.push(file.file);
    } catch (error) {
      failed.push({ file: file.file, error: (error as Error).message });
    }
  }
  const index = { updatedAt: now, entries: entries.sort((a, b) => a.file.localeCompare(b.file)) };
  writeIndex(index, root);
  return { index, added, removed: plan.removed, failed };
}
