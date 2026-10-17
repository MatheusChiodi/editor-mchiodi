import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, relative } from 'node:path';
import { type FSWatcher, watch } from 'chokidar';

import { type Live, readLive } from '../project/live.ts';
import { PROJECTS_DIR, ROOT } from '../project/paths.ts';
import { isValidSceneName, reelCompositionId, scanScenes, type SceneFile, sceneCompositionId, sceneKey, SCENES_DIR, syncScenes } from '../scenes/sync.ts';
import { buildManifest, cleanStale, filePrefix, needsRender, type PreviewManifest, readManifest, sceneHash, type SourceFile, writeManifest } from './manifest.ts';
import { edlSnippet, parseSceneSource, type SceneMeta } from './meta.ts';
import { renderPage } from './page.ts';
import { blameScenes, cleanError, countStatuses, drop, emptyQueue, enqueue, finish, pauseReason, pickNext, type Queue, type QueueItem, start } from './queue.ts';
import { contentType, hostAllowed, mediaUrl, parseRange, route } from './routes.ts';
import { PreviewBundleError, type PreviewMode, type PreviewRenderer, type RenderStage, type SceneStatus } from './types.ts';

export interface PreviewServerOptions {
  /** 0 = qualquer porta livre */
  port: number;
  /** null = sem fila de render (só o índice) */
  renderer: PreviewRenderer | null;
  previews?: PreviewMode;
  /** endereço do Remotion Studio: cada cartão abre a cena nele */
  studioUrl?: string | null;
  /** projeto em foco: renderiza primeiro */
  focus?: string;
  /** ignora o que já está em disco e renderiza tudo de novo */
  force?: boolean;
  scenesDir?: string;
  previewDir?: string;
  projectsDir?: string;
  /** false = sem chokidar (teste chama `rescan`) */
  watch?: boolean;
  pollMs?: number;
  clock?: () => number;
  /** alguém pediu para encerrar (`mce scenes stop`) */
  onShutdown?: () => void;
}

export interface SceneView {
  key: string;
  project: string;
  name: string;
  file: string;
  compositionId: string;
  /** link direto para a cena no Studio, quando ele está no ar */
  studio: string | null;
  status: SceneStatus;
  stage: RenderStage | null;
  percent: number;
  error: string | null;
  changedAt: number;
  /** quando a cena apareceu com o visor já aberto (destaque de "nova") */
  addedAt: number | null;
  durationSec: number | null;
  description: string | null;
  revealAt: string[];
  strip: { frame: number; url: string }[];
  video: string | null;
  /** a mídia mostrada é de uma versão anterior do arquivo */
  stale: boolean;
  edl: string;
  timings: PreviewManifest['timings'] | null;
}

export interface PreviewState {
  now: number;
  previews: PreviewMode;
  studioUrl: string | null;
  focus: string | null;
  projects: { slug: string; scenes: number; reel: string | null }[];
  queue: { paused: string | null; current: { key: string; stage: RenderStage | null; percent: number } | null; counts: Record<SceneStatus, number> };
  scenes: SceneView[];
}

export interface PreviewServer {
  url: string;
  port: number;
  state: () => PreviewState;
  /** relê a pasta de cenas agora (o que o chokidar dispara) */
  rescan: () => void;
  close: () => Promise<void>;
}

interface SceneState {
  scene: SceneFile;
  key: string;
  file: string;
  hash: string;
  changedAt: number;
  addedAt: number | null;
  status: SceneStatus;
  stage: RenderStage | null;
  percent: number;
  error: string | null;
  errorKind: 'bundle' | 'render' | null;
  meta: SceneMeta;
  manifest: PreviewManifest | null;
}

function readLives(projectsDir: string): (Live | null)[] {
  if (!existsSync(projectsDir)) return [];
  return readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => readLive(join(projectsDir, entry.name, 'live.json')));
}

/** Arquivos da pasta do projeto que não são cena (kits, glifos, lógica): entram no hash de todas as cenas dela. */
function helperSources(dir: string): SourceFile[] {
  return readdirSync(dir)
    .filter((file) => /\.tsx?$/.test(file) && !isValidSceneName(file.replace(/\.tsx$/, '')))
    .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }));
}

function listen(server: Server, port: number, attempts: number): Promise<number> {
  return new Promise((done, fail) => {
    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && port !== 0 && attempts > 1) done(listen(server, port + 1, attempts - 1));
      else fail(error);
    };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      done((server.address() as AddressInfo).port);
    });
  });
}

/**
 * Índice das cenas no navegador: observa `motion/src/scenes`, mantém o índice do Remotion em dia
 * (`syncScenes`, é o que faz a cena nova aparecer no Studio) e, se pedido, renderiza prévias uma por vez.
 */
export async function startPreviewServer(options: PreviewServerOptions): Promise<PreviewServer> {
  const scenesDir = options.scenesDir ?? SCENES_DIR;
  const previewDir = options.previewDir ?? join(PROJECTS_DIR, '.preview');
  const projectsDir = options.projectsDir ?? PROJECTS_DIR;
  const clock = options.clock ?? Date.now;
  const renderer = options.renderer;
  const previews: PreviewMode = renderer ? (options.previews ?? 'video') : 'off';
  const studioUrl = options.studioUrl ? options.studioUrl.replace(/\/+$/, '') : null;

  const scenes = new Map<string, SceneState>();
  const clients = new Set<ServerResponse>();
  let queue: Queue = emptyQueue();
  let abort: AbortController | null = null;
  let bundleVersion = 0;
  let blocked: string | null = null;
  let paused: string | null = null;
  let pumping: Promise<void> | null = null;
  let closing = false;
  let publishTimer: NodeJS.Timeout | null = null;
  let rescanTimer: NodeJS.Timeout | null = null;

  const sceneDir = (scene: SceneFile) => join(previewDir, scene.project, scene.name);

  function view(state: SceneState): SceneView {
    const { scene, manifest, meta } = state;
    const durationSec = manifest ? manifest.durationInFrames / manifest.fps : meta.defaultDuration;
    const shown = relative(ROOT, state.file);
    return {
      key: state.key,
      project: scene.project,
      name: scene.name,
      file: (shown.startsWith('..') ? state.file : shown).replaceAll('\\', '/'),
      compositionId: sceneCompositionId(scene),
      studio: studioUrl ? `${studioUrl}/${sceneCompositionId(scene)}` : null,
      status: state.status,
      stage: state.stage,
      percent: state.percent,
      error: state.error,
      changedAt: state.changedAt,
      addedAt: state.addedAt,
      durationSec,
      description: meta.description,
      revealAt: Object.keys(meta.revealAt),
      strip: (manifest?.strip ?? []).map((frame) => ({ frame: frame.frame, url: mediaUrl(scene.project, scene.name, frame.file) })),
      video: manifest?.video ? mediaUrl(scene.project, scene.name, manifest.video) : null,
      stale: manifest !== null && manifest.hash !== state.hash,
      edl: edlSnippet(scene.project, scene.name, meta.defaultDuration ?? durationSec ?? 5, meta.revealAt),
      timings: manifest?.timings ?? null,
    };
  }

  function snapshot(): PreviewState {
    const list = [...scenes.values()].sort((a, b) => b.changedAt - a.changedAt || a.key.localeCompare(b.key));
    const perProject = new Map<string, number>();
    for (const state of list) perProject.set(state.scene.project, (perProject.get(state.scene.project) ?? 0) + 1);
    const active = queue.active ? scenes.get(queue.active.key) : undefined;
    return {
      now: clock(),
      previews,
      studioUrl,
      focus: options.focus ?? null,
      projects: [...perProject].sort(([a], [b]) => a.localeCompare(b)).map(([slug, count]) => ({ slug, scenes: count, reel: studioUrl ? `${studioUrl}/${reelCompositionId(slug)}` : null })),
      queue: {
        paused: blocked ?? paused,
        current: active ? { key: active.key, stage: active.stage, percent: active.percent } : null,
        counts: countStatuses(list.map((state) => state.status)),
      },
      scenes: list.map(view),
    };
  }

  function publish(): void {
    if (publishTimer || closing) return;
    // o progresso do render chega várias vezes por segundo: junta num envio só
    publishTimer = setTimeout(() => {
      publishTimer = null;
      const payload = `event: state\ndata: ${JSON.stringify(snapshot())}\n\n`;
      for (const client of clients) client.write(payload);
    }, 120);
  }

  function rescan(initial = false): void {
    let found: SceneFile[];
    try {
      // é isto que põe a cena nova na barra lateral do Studio (o hot reload dele pega o índice)
      found = syncScenes(scenesDir);
    } catch {
      found = scanScenes(scenesDir);
    }
    bundleVersion += 1;
    blocked = null;
    const seen = new Set<string>();
    const helpers = new Map<string, SourceFile[]>();
    for (const scene of found) {
      const key = sceneKey(scene);
      const file = join(scenesDir, scene.project, `${scene.name}.tsx`);
      let source: string;
      let changedAt: number;
      try {
        source = readFileSync(file, 'utf8');
        changedAt = statSync(file).mtimeMs;
        if (!helpers.has(scene.project)) helpers.set(scene.project, helperSources(join(scenesDir, scene.project)));
      } catch {
        continue; // apagado entre o scan e a leitura
      }
      seen.add(key);
      const hash = sceneHash(source, helpers.get(scene.project));
      const previous = scenes.get(key);
      if (previous && previous.hash === hash && previous.errorKind !== 'bundle') continue;
      const manifest = previous?.manifest ?? readManifest(sceneDir(scene));
      const wanted =
        previews !== 'off' && (options.force === true && !previous ? true : needsRender(manifest, hash, (name) => existsSync(join(sceneDir(scene), name)), previews === 'video'));
      scenes.set(key, {
        scene,
        key,
        file,
        hash,
        changedAt,
        addedAt: previous ? previous.addedAt : initial ? null : clock(),
        status: wanted ? 'queued' : 'ready',
        stage: null,
        percent: 0,
        error: null,
        errorKind: null,
        meta: parseSceneSource(source),
        manifest,
      });
      if (wanted) {
        queue = enqueue(queue, { key, project: scene.project, changedAt });
        // o render em andamento é de uma versão que já não existe
        if (queue.active?.key === key) abort?.abort();
      }
    }
    for (const key of [...scenes.keys()]) {
      if (seen.has(key)) continue;
      scenes.delete(key);
      queue = drop(queue, key);
      if (queue.active?.key === key) abort?.abort();
    }
    publish();
    void pump();
  }

  async function runJob(item: QueueItem): Promise<void> {
    const state = scenes.get(item.key);
    if (!state || !renderer) {
      queue = drop(queue, item.key);
      return;
    }
    queue = start(queue, item.key);
    const controller = new AbortController();
    abort = controller;
    const hash = state.hash;
    const outDir = sceneDir(state.scene);
    Object.assign(state, { status: 'rendering', stage: 'bundle', percent: 0, error: null, errorKind: null });
    publish();
    try {
      mkdirSync(outDir, { recursive: true });
      const result = await renderer.render(
        { key: state.key, compositionId: sceneCompositionId(state.scene), outDir, prefix: filePrefix(hash), bundleVersion, video: previews === 'video' },
        {
          signal: controller.signal,
          onProgress: (stage, percent) => {
            state.stage = stage;
            state.percent = percent;
            publish();
          },
          onStrip: (strip) => {
            state.manifest = writeManifest(outDir, buildManifest(state.key, hash, strip, clock()));
            publish();
          },
        },
      );
      if (controller.signal.aborted) throw new Error('cancelado');
      state.manifest = writeManifest(outDir, buildManifest(state.key, hash, result, clock()));
      cleanStale(outDir, state.manifest);
      state.status = 'ready';
    } catch (error) {
      if (controller.signal.aborted) {
        // pausa ou arquivo regravado no meio: volta para a espera (se a cena ainda existe)
        const current = scenes.get(item.key);
        if (current) {
          current.status = 'queued';
          queue = enqueue(queue, { ...item, changedAt: current.changedAt });
        }
      } else if (error instanceof PreviewBundleError) {
        const message = cleanError(error);
        const blamed = blameScenes(message, [...scenes.values()].map((other) => ({ ...other.scene, state: other })));
        const targets = blamed.length ? blamed.map((entry) => entry.state) : [state];
        for (const target of targets) {
          Object.assign(target, { status: 'error', error: message, errorKind: 'bundle' });
          queue = drop(queue, target.key);
        }
        // com o bundle quebrado nenhuma outra cena renderiza: espera a próxima gravação de arquivo
        blocked = `erro de compilação em ${targets.map((target) => target.key).join(', ')}`;
      } else {
        Object.assign(state, { status: 'error', error: cleanError(error), errorKind: 'render' });
      }
    } finally {
      queue = finish(queue, item.key);
      abort = null;
      state.stage = null;
      publish();
    }
  }

  function pump(): Promise<void> {
    if (pumping || closing || !renderer) return pumping ?? Promise.resolve();
    pumping = (async () => {
      try {
        for (;;) {
          if (closing) break;
          const reason = pauseReason(readLives(projectsDir), clock());
          if (reason !== paused) {
            paused = reason;
            publish();
          }
          const item = reason || blocked ? null : pickNext(queue, options.focus);
          if (!item) break;
          await runJob(item);
        }
        // fila vazia ou em pausa: devolve a RAM do Chrome
        await renderer.release();
      } finally {
        pumping = null;
      }
    })();
    return pumping;
  }

  function sendJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  }

  function sendMedia(request: IncomingMessage, response: ServerResponse, file: string): void {
    let size: number;
    try {
      const stat = statSync(file);
      if (!stat.isFile()) throw new Error('não é arquivo');
      size = stat.size;
    } catch {
      sendJson(response, 404, { error: 'não encontrado' });
      return;
    }
    const headers = {
      'Content-Type': contentType(file) ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      // o nome do arquivo carrega o hash do fonte: nunca muda de conteúdo
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    };
    const range = parseRange(request.headers.range, size);
    if (range === 'invalid') {
      response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
      response.end();
      return;
    }
    const { start: from, end: to } = range ?? { start: 0, end: size - 1 };
    response.writeHead(range ? 206 : 200, { ...headers, 'Content-Length': to - from + 1, ...(range ? { 'Content-Range': `bytes ${from}-${to}/${size}` } : {}) });
    if (request.method === 'HEAD' || size === 0) {
      response.end();
      return;
    }
    createReadStream(file, { start: from, end: to })
      .on('error', () => response.destroy())
      .pipe(response);
  }

  const server = createServer((request, response) => {
    const port = (server.address() as AddressInfo | null)?.port ?? 0;
    if (!hostAllowed(request.headers.host, port)) {
      sendJson(response, 403, { error: 'host não permitido' });
      return;
    }
    const target = route(request.method ?? 'GET', request.url ?? '/', previewDir);
    switch (target.kind) {
      case 'page':
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(renderPage());
        return;
      case 'scenes':
        sendJson(response, 200, snapshot());
        return;
      case 'health':
        sendJson(response, 200, { ok: true, pid: process.pid });
        return;
      case 'events':
        response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        response.write(`retry: 1500\nevent: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
        clients.add(response);
        request.on('close', () => clients.delete(response));
        return;
      case 'shutdown':
        // o cabeçalho próprio obriga preflight: uma página externa não consegue disparar isto
        if (request.headers['x-mce-preview'] !== '1') sendJson(response, 403, { error: 'proibido' });
        else {
          sendJson(response, 200, { ok: true });
          setImmediate(() => options.onShutdown?.());
        }
        return;
      case 'media':
        sendMedia(request, response, target.file);
        return;
      case 'forbidden':
        sendJson(response, 403, { error: 'proibido' });
        return;
      case 'methodNotAllowed':
        sendJson(response, 405, { error: 'método não permitido' });
        return;
      default:
        sendJson(response, 404, { error: 'não encontrado' });
    }
  });

  const port = await listen(server, options.port, 20);
  mkdirSync(scenesDir, { recursive: true });
  rescan(true);

  let watcher: FSWatcher | null = null;
  if (options.watch !== false) {
    watcher = watch(scenesDir, {
      ignoreInitial: true,
      // o índice é gravado por nós mesmos; `_template` não é cena
      ignored: (path) => {
        const inside = relative(scenesDir, path).replaceAll('\\', '/');
        return inside === 'index.ts' || inside.split('/').some((segment) => segment.startsWith('_'));
      },
      awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
    });
    watcher.on('all', () => {
      if (rescanTimer) clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => rescan(), 200);
    });
  }

  // o render principal começa e termina em outro processo: confere de tempos em tempos
  const poll = setInterval(() => {
    if (!renderer) return;
    const reason = pauseReason(readLives(projectsDir), clock());
    if (reason && abort) abort.abort();
    if (reason !== paused) {
      paused = reason;
      publish();
    }
    if (!reason) void pump();
  }, options.pollMs ?? 2000);
  const heartbeat = setInterval(() => {
    for (const client of clients) client.write(': ping\n\n');
  }, 20_000);

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    state: snapshot,
    rescan: () => rescan(),
    async close() {
      closing = true;
      clearInterval(poll);
      clearInterval(heartbeat);
      if (rescanTimer) clearTimeout(rescanTimer);
      if (publishTimer) clearTimeout(publishTimer);
      await watcher?.close();
      abort?.abort();
      for (const client of clients) client.end();
      await new Promise<void>((done) => {
        server.close(() => done());
        server.closeAllConnections();
      });
      await pumping?.catch(() => undefined);
      await renderer?.release().catch(() => undefined);
    },
  };
}
