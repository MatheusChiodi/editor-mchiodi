import { watch } from 'chokidar';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';

import { isLoopbackHost, parseRange, safeJoin } from '../cut/server.ts';
import { projectPaths, ROOT } from '../project/paths.ts';

export interface MusicPreview {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export interface MusicPreviewOptions {
  slug: string;
  port?: number;
  distDir?: string;
  projectsDir?: string;
  log?: (message: string) => void;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

/** Arquivo com suporte a Range: o `<audio>` do player precisa para pular para qualquer ponto da música. */
function sendFile(req: IncomingMessage, res: ServerResponse, file: string): void {
  const { size } = statSync(file);
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = parseRange(req.headers.range, size);
  if (range === 'invalid') {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
    res.end();
    return;
  }
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  if (range) {
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': range.end - range.start + 1 });
    if (req.method === 'HEAD') return void res.end();
    createReadStream(file, range).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  if (req.method === 'HEAD') return void res.end();
  createReadStream(file).pipe(res);
}

/**
 * Prévia ao vivo do vídeo da música: serve a página (music-preview/dist), o plano em disco, a música e um fluxo de
 * eventos que avisa quando o plano muda. Só loopback. Nada é renderizado: o navegador desenha o plano em tempo real.
 */
export async function startMusicPreview(options: MusicPreviewOptions): Promise<MusicPreview> {
  const distDir = options.distDir ?? join(ROOT, 'music-preview', 'dist');
  const paths = projectPaths(options.slug, options.projectsDir);
  const planFile = join(paths.analysisDir, 'music.plan.json');
  const metaFile = join(paths.analysisDir, 'music.json');
  if (!existsSync(planFile)) throw new Error(`Projeto "${options.slug}" não tem plano de música. Rode: pnpm mce music <arquivo.mp3> --plan-only`);

  const streams = new Set<ServerResponse>();
  const emit = (event: string) => {
    for (const res of streams) res.write(`event: ${event}\ndata: {}\n\n`);
  };
  const watcher = watch(planFile, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 } });
  watcher.on('change', () => {
    options.log?.('plano alterado: atualizando a prévia');
    emit('plan');
  });
  await new Promise<void>((done) => watcher.once('ready', () => done()));
  const heartbeat = setInterval(() => {
    for (const res of streams) res.write(': ping\n\n');
  }, 20_000);

  const audioPath = (): string | null => {
    try {
      const { audio } = JSON.parse(readFileSync(metaFile, 'utf8')) as { audio?: string };
      return audio && existsSync(audio) ? audio : null;
    } catch {
      return null;
    }
  };

  const server = createServer((req, res) => {
    if (!isLoopbackHost(req.headers.host)) return void sendJson(res, 403, { error: 'só loopback' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return void sendJson(res, 405, { error: 'método não permitido' });
    const path = (req.url ?? '/').split('?')[0]!;
    try {
      if (path === '/api/plan') return void sendFile(req, res, planFile);
      if (path === '/api/audio') {
        const audio = audioPath();
        return audio ? sendFile(req, res, audio) : void sendJson(res, 404, { error: 'áudio original não encontrado (analysis/music.json)' });
      }
      if (path === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write('retry: 1000\n\n');
        streams.add(res);
        req.on('close', () => streams.delete(res));
        return;
      }
      const file = safeJoin(distDir, path === '/' ? 'index.html' : path.slice(1));
      if (!file || !existsSync(file) || !statSync(file).isFile()) {
        if (!existsSync(join(distDir, 'index.html'))) return void sendJson(res, 503, { error: 'a página não foi gerada. Rode: pnpm music:build' });
        return void sendJson(res, 404, { error: 'não encontrado' });
      }
      sendFile(req, res, file);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(options.port ?? 0, '127.0.0.1', () => done());
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: async () => {
      clearInterval(heartbeat);
      await watcher.close();
      for (const res of streams) res.end();
      const closed = new Promise<void>((done) => server.close(() => done()));
      server.closeAllConnections();
      await closed;
    },
  };
}
