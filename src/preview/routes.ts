import { extname, resolve, sep } from 'node:path';

export type Route =
  | { kind: 'page' }
  | { kind: 'scenes' }
  | { kind: 'events' }
  | { kind: 'health' }
  | { kind: 'shutdown' }
  | { kind: 'media'; file: string }
  | { kind: 'forbidden' }
  | { kind: 'methodNotAllowed' }
  | { kind: 'notFound' };

const MEDIA_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

export const MEDIA_PREFIX = '/media/';

/** Só mídia das prévias tem tipo; qualquer outra extensão (json, ts…) não é servida. */
export function contentType(file: string): string | null {
  return MEDIA_TYPES[extname(file).toLowerCase()] ?? null;
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Caminho em disco de `<projeto>/<Cena>/<arquivo>` dentro da pasta de prévias, ou null se o pedido
 * tenta sair dela. Rejeita em vez de normalizar: `..`, barra invertida, drive, segmento oculto e
 * qualquer coisa que ainda esteja codificada depois de uma decodificação.
 */
export function resolveMediaPath(previewDir: string, relative: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(relative);
  } catch {
    return null;
  }
  const segments = decoded.split('/');
  if (segments.length !== 3 || !segments.every((segment) => SEGMENT.test(segment) && !segment.includes('..'))) return null;
  if (!contentType(decoded)) return null;
  const root = resolve(previewDir);
  const file = resolve(root, ...segments);
  return file.startsWith(root + sep) ? file : null;
}

export function route(method: string, rawUrl: string, previewDir: string): Route {
  const path = rawUrl.split(/[?#]/)[0] ?? '/';
  if (path === '/api/shutdown') return method === 'POST' ? { kind: 'shutdown' } : { kind: 'methodNotAllowed' };
  if (method !== 'GET' && method !== 'HEAD') return { kind: 'methodNotAllowed' };
  if (path === '/' || path === '/index.html') return { kind: 'page' };
  if (path === '/api/scenes') return { kind: 'scenes' };
  if (path === '/api/health') return { kind: 'health' };
  if (path === '/events') return { kind: 'events' };
  if (path.startsWith(MEDIA_PREFIX)) {
    const file = resolveMediaPath(previewDir, path.slice(MEDIA_PREFIX.length));
    return file ? { kind: 'media', file } : { kind: 'forbidden' };
  }
  return { kind: 'notFound' };
}

export interface ByteRange {
  start: number;
  end: number;
}

/**
 * `Range: bytes=a-b` de um único intervalo. null = sem Range (manda o arquivo inteiro);
 * 'invalid' = fora do arquivo (416).
 */
export function parseRange(header: string | undefined, size: number): ByteRange | 'invalid' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid';
  if (match[1] === '') {
    const suffix = Number(match[2]);
    return suffix > 0 && size > 0 ? { start: Math.max(0, size - suffix), end: size - 1 } : 'invalid';
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start >= size || end < start ? 'invalid' : { start, end };
}

/** Só atende quem chegou por 127.0.0.1/localhost: barra DNS rebinding de uma página externa. */
export function hostAllowed(host: string | undefined, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

export function mediaUrl(project: string, name: string, file: string): string {
  return `${MEDIA_PREFIX}${project}/${name}/${file}`;
}
