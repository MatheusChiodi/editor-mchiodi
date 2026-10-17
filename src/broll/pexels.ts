import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { slugify } from '../project/paths.ts';
import { BROLL_DIR, type BrollEntry, type BrollIndex, PEXELS_LICENSE, readIndex, tagsFromName, writeIndex } from './library.ts';
import { expandTags, tagsOf } from './terms.ts';

/** Só o que usamos da resposta de https://api.pexels.com/videos/search */
export interface PexelsVideoFile {
  id: number;
  quality: string | null;
  file_type: string;
  width: number | null;
  height: number | null;
  link: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

export interface PexelsSearch {
  videos: PexelsVideo[];
}

export const PEXELS_SEARCH = 'https://api.pexels.com/videos/search';
export const PEXELS_DIR = join(BROLL_DIR, 'pexels');

export interface PexelsLimits {
  /** b-roll curto: nem menor que o inserto, nem um arquivo enorme */
  minSec: number;
  maxSec: number;
  /** largura alvo (HD do canal) */
  targetWidth: number;
}

export const PEXELS_LIMITS: PexelsLimits = { minSec: 4, maxSec: 30, targetWidth: 1920 };

export function searchUrl(query: string, perPage = 10): string {
  const params = new URLSearchParams({ query, per_page: String(perPage), orientation: 'landscape', size: 'medium' });
  return `${PEXELS_SEARCH}?${params.toString()}`;
}

/** Arquivo HD em mp4 mais perto da largura alvo, sem passar dela (4K pesa e não melhora um vídeo 1080p). */
export function pickFile(video: PexelsVideo, limits: PexelsLimits = PEXELS_LIMITS): PexelsVideoFile | null {
  const files = video.video_files.filter((file) => file.file_type === 'video/mp4' && file.quality === 'hd' && (file.width ?? 0) > 0 && (file.width ?? 0) <= limits.targetWidth);
  files.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return files[0] ?? null;
}

/** Primeiro vídeo da busca com duração curta e um arquivo HD; ids já baixados ficam de fora. */
export function pickVideo(search: PexelsSearch, skip: ReadonlySet<number>, limits: PexelsLimits = PEXELS_LIMITS): { video: PexelsVideo; file: PexelsVideoFile } | null {
  for (const video of search.videos) {
    if (skip.has(video.id) || video.duration < limits.minSec || video.duration > limits.maxSec) continue;
    const file = pickFile(video, limits);
    if (file) return { video, file };
  }
  return null;
}

export const pexelsFileName = (query: string, video: Pick<PexelsVideo, 'id'>) => `${slugify(query)}-${video.id}.mp4`;

/** Entrada do índice com origem, autor e licença (a licença Pexels dispensa crédito, mas o registro fica). */
export function pexelsEntry(query: string, video: PexelsVideo, file: PexelsVideoFile, name: string, stat: { size: number; mtimeMs: number }, now: string): BrollEntry {
  return {
    file: `pexels/${name}`,
    tags: [...new Set([...expandTags(tagsOf(query)), ...tagsFromName(name)])],
    durationSec: video.duration,
    width: file.width ?? video.width,
    height: file.height ?? video.height,
    source: 'pexels',
    license: PEXELS_LICENSE,
    author: `${video.user.name} (${video.user.url})`,
    url: video.url,
    size: stat.size,
    mtimeMs: Math.round(stat.mtimeMs),
    addedAt: now,
  };
}

/** Ids do Pexels já na biblioteca (pelo link guardado no índice). */
export function knownPexelsIds(index: BrollIndex): Set<number> {
  const ids = index.entries.map((entry) => /(\d+)\/?$/.exec(entry.url ?? '')?.[1]).filter((id): id is string => Boolean(id));
  return new Set(ids.map(Number));
}

export type FetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface FetchBrollOptions {
  apiKey: string;
  queries: readonly string[];
  fetch?: FetchFn;
  root?: string;
  log?: (message: string) => void;
}

export interface FetchedBroll {
  query: string;
  file: string | null;
  note: string;
}

/**
 * `mce broll fetch`: para cada termo faltando, busca no Pexels, baixa um vídeo curto em HD para assets/broll/pexels/
 * e registra origem/autor/licença no índice. Casca fina: a escolha é das funções puras acima.
 */
export async function fetchBroll(options: FetchBrollOptions): Promise<FetchedBroll[]> {
  const root = options.root ?? BROLL_DIR;
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchFn);
  const log = options.log ?? (() => {});
  const dir = join(root, 'pexels');
  mkdirSync(dir, { recursive: true });
  const index = readIndex(root);
  const skip = knownPexelsIds(index);
  const results: FetchedBroll[] = [];
  for (const query of options.queries) {
    const response = await doFetch(searchUrl(query), { headers: { Authorization: options.apiKey } });
    if (!response.ok) {
      const note = response.status === 401 || response.status === 403 ? 'chave do Pexels recusada (PEXELS_API_KEY)' : `busca falhou (HTTP ${response.status})`;
      results.push({ query, file: null, note });
      if (response.status === 401 || response.status === 403) break;
      continue;
    }
    const picked = pickVideo((await response.json()) as PexelsSearch, skip);
    if (!picked) {
      results.push({ query, file: null, note: 'nenhum vídeo curto em HD na busca' });
      continue;
    }
    const name = pexelsFileName(query, picked.video);
    const target = join(dir, name);
    if (!existsSync(target)) {
      const download = await doFetch(picked.file.link);
      if (!download.ok) {
        results.push({ query, file: null, note: `download falhou (HTTP ${download.status})` });
        continue;
      }
      writeFileSync(target, Buffer.from(await download.arrayBuffer()));
    }
    const stat = statSync(target);
    const entry = pexelsEntry(query, picked.video, picked.file, name, { size: stat.size, mtimeMs: stat.mtimeMs }, new Date().toISOString());
    index.entries = [...index.entries.filter((item) => item.file !== entry.file), entry].sort((a, b) => a.file.localeCompare(b.file));
    skip.add(picked.video.id);
    log(`baixado: pexels/${name} (${picked.video.duration}s, ${entry.width}x${entry.height}, ${picked.video.user.name})`);
    results.push({ query, file: entry.file, note: `${picked.video.duration}s de ${picked.video.user.name}` });
  }
  index.updatedAt = new Date().toISOString();
  writeIndex(index, root);
  return results;
}
