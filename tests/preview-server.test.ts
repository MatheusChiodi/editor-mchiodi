import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { type PreviewServer, type PreviewState, startPreviewServer } from '../src/preview/server.ts';
import { PreviewBundleError, type PreviewRenderer, type RenderJob } from '../src/preview/types.ts';

const dir = mkdtempSync(join(tmpdir(), 'mce-preview-server-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let server: PreviewServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

let sandbox = 0;
function setup() {
  sandbox += 1;
  const base = join(dir, String(sandbox));
  const paths = { scenesDir: join(base, 'scenes'), previewDir: join(base, 'projects', '.preview'), projectsDir: join(base, 'projects') };
  mkdirSync(paths.previewDir, { recursive: true });
  return paths;
}

function writeScene(scenesDir: string, project: string, name: string, body = '') {
  mkdirSync(join(scenesDir, project), { recursive: true });
  writeFileSync(
    join(scenesDir, project, `${name}.tsx`),
    `const DEFAULT_REVEAL = { entra: 0.5, sai: 2 };\n${body}\nexport const entry = { component: null, sample: { revealAt: DEFAULT_REVEAL }, defaultDuration: 4, description: 'Cena ${name}.' };\n`,
  );
}

/** Renderizador falso: grava arquivos pequenos e registra a ordem e a concorrência dos trabalhos. */
function fakeRenderer(behavior: { fail?: (job: RenderJob) => Error | null; delayMs?: number } = {}) {
  const jobs: RenderJob[] = [];
  let running = 0;
  let maxRunning = 0;
  let released = 0;
  const renderer: PreviewRenderer = {
    async render(job, hooks) {
      jobs.push(job);
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      try {
        const failure = behavior.fail?.(job);
        if (failure) throw failure;
        hooks.onProgress('strip', 10);
        const strip = [{ frame: 10, file: `${job.prefix}-f0010.jpg` }];
        writeFileSync(join(job.outDir, strip[0]!.file), 'jpeg');
        const info = { fps: 30, durationInFrames: 120, width: 1920, height: 1080, strip, stripMs: 5 };
        hooks.onStrip(info);
        await new Promise<void>((done, fail) => {
          const timer = setTimeout(done, behavior.delayMs ?? 5);
          hooks.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            fail(new Error('cancelado'));
          });
        });
        if (!job.video) return { ...info, video: null, videoMs: null };
        const video = `${job.prefix}-preview.mp4`;
        writeFileSync(join(job.outDir, video), '0123456789');
        return { ...info, video, videoMs: 7 };
      } finally {
        running -= 1;
      }
    },
    async release() {
      released += 1;
    },
  };
  return { renderer, jobs, stats: () => ({ maxRunning, released }) };
}

async function until(check: () => boolean, label: string, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`tempo esgotado: ${label}`);
    await new Promise((wake) => setTimeout(wake, 15));
  }
}

/** Requisição crua: o caminho vai como está (fetch normalizaria os `..`). */
function raw(url: string, path: string, headers: Record<string, string> = {}, method = 'GET'): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  const { hostname, port } = new URL(url);
  return new Promise((done, fail) => {
    const req = request({ hostname, port, path, method, headers }, (response) => {
      let body = '';
      response.setEncoding('utf8').on('data', (chunk: string) => (body += chunk));
      response.on('end', () => done({ status: response.statusCode ?? 0, headers: response.headers, body }));
    });
    req.on('error', fail);
    req.end();
  });
}

/** Lê o primeiro evento `state` do SSE que satisfaz `match`. */
function nextEvent(url: string, match: (state: PreviewState) => boolean, timeoutMs = 4000): Promise<PreviewState> {
  const { hostname, port } = new URL(url);
  return new Promise((done, fail) => {
    const timer = setTimeout(() => {
      req.destroy();
      fail(new Error('nenhum evento SSE a tempo'));
    }, timeoutMs);
    const req = request({ hostname, port, path: '/events' }, (response) => {
      expect(response.headers['content-type']).toContain('text/event-stream');
      let buffer = '';
      response.setEncoding('utf8').on('data', (chunk: string) => {
        buffer += chunk;
        for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (!block.includes('event: state') || !data) continue;
          const state = JSON.parse(data) as PreviewState;
          if (match(state)) {
            clearTimeout(timer);
            req.destroy();
            done(state);
            return;
          }
        }
      });
    });
    req.on('error', () => undefined);
    req.end();
  });
}

describe('servidor do índice de cenas', () => {
  it('renderiza uma cena por vez, publica em /api/scenes e por SSE, e serve a mídia com Range', async () => {
    const paths = setup();
    writeScene(paths.scenesDir, 'aula', 'Fila');
    writeScene(paths.scenesDir, 'aula', 'Pilha');
    writeFileSync(join(paths.scenesDir, 'aula', 'kit.tsx'), 'export const kit = 1;\n');
    const fake = fakeRenderer();
    server = await startPreviewServer({ port: 0, renderer: fake.renderer, watch: false, pollMs: 20, studioUrl: 'http://localhost:4173/', ...paths });
    await until(() => server!.state().queue.counts.ready === 2, 'duas cenas prontas');

    expect(fake.stats().maxRunning).toBe(1);
    expect(fake.stats().released).toBeGreaterThan(0);
    // o índice do Remotion foi regenerado: é o que faz a cena aparecer no Studio
    expect(readFileSync(join(paths.scenesDir, 'index.ts'), 'utf8')).toContain("'aula/Fila': scene0");

    const api = await raw(server.url, '/api/scenes');
    expect(api.status).toBe(200);
    expect(api.headers['content-type']).toContain('application/json');
    const state = JSON.parse(api.body) as PreviewState;
    expect(state.projects).toEqual([{ slug: 'aula', scenes: 2, reel: 'http://localhost:4173/Roteiro-aula' }]);
    const fila = state.scenes.find((scene) => scene.key === 'aula/Fila')!;
    expect(fila).toMatchObject({
      status: 'ready',
      project: 'aula',
      name: 'Fila',
      compositionId: 'Cena-aula-Fila',
      studio: 'http://localhost:4173/Cena-aula-Fila',
      durationSec: 4,
      description: 'Cena Fila.',
      revealAt: ['entra', 'sai'],
      addedAt: null,
      stale: false,
      error: null,
    });
    expect(JSON.parse(fila.edl)).toMatchObject({ component: 'scene:aula/Fila', duration: 4, props: { revealAt: { entra: 0.5, sai: 2 } } });
    expect(fila.video).toMatch(/^\/media\/aula\/Fila\/[0-9a-f]{10}-preview\.mp4$/);
    expect(existsSync(join(paths.previewDir, 'aula', 'Fila', 'manifest.json'))).toBe(true);

    const page = await raw(server.url, '/');
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain("new EventSource('/events')");
    expect(page.body).toContain("params.get('projeto')");

    const whole = await raw(server.url, fila.video!);
    expect(whole.status).toBe(200);
    expect(whole.headers['content-type']).toBe('video/mp4');
    expect(whole.headers['accept-ranges']).toBe('bytes');
    const part = await raw(server.url, fila.video!, { Range: 'bytes=2-5' });
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe('bytes 2-5/10');
    expect(part.body).toBe('2345');
    expect((await raw(server.url, fila.video!, { Range: 'bytes=50-' })).status).toBe(416);
    expect((await raw(server.url, fila.strip[0]!.url)).headers['content-type']).toBe('image/jpeg');
  });

  it('bloqueia path traversal, host estranho e encerramento sem o cabeçalho', async () => {
    const paths = setup();
    writeFileSync(join(paths.projectsDir, 'segredo.mp4'), 'segredo');
    writeFileSync(join(paths.previewDir, 'server.json'), '{}');
    server = await startPreviewServer({ port: 0, renderer: null, watch: false, ...paths });
    for (const path of [
      '/media/../segredo.mp4',
      '/media/../../projects/segredo.mp4',
      '/media/aula/Fila/../../../segredo.mp4',
      '/media/%2e%2e/segredo.mp4',
      '/media/..%2fsegredo.mp4',
      '/media/aula/Fila/..%5c..%5c..%5csegredo.mp4',
      '/media/server.json',
    ]) {
      const response = await raw(server.url, path);
      expect(response.status, path).toBe(403);
      expect(response.body, path).not.toContain('segredo');
    }
    expect((await raw(server.url, '/../segredo.mp4')).status).toBe(404);
    expect((await raw(server.url, '/media/aula/Fila/nao-existe.mp4')).status).toBe(404);
    expect((await raw(server.url, '/api/scenes', { Host: 'evil.example' })).status).toBe(403);
    expect((await raw(server.url, '/api/shutdown', {}, 'POST')).status).toBe(403);
    expect((await raw(server.url, '/api/shutdown')).status).toBe(405);
  });

  it('cena nova chega por SSE sem recarregar; cena regravada renderiza de novo; apagada some', async () => {
    const paths = setup();
    writeScene(paths.scenesDir, 'aula', 'Fila');
    const fake = fakeRenderer();
    server = await startPreviewServer({ port: 0, renderer: fake.renderer, watch: false, pollMs: 20, ...paths });
    const first = await nextEvent(server.url, (state) => state.scenes.length === 1 && state.scenes[0]!.status === 'ready');
    expect(first.scenes[0]!.key).toBe('aula/Fila');

    const arrival = nextEvent(server.url, (state) => state.scenes.some((scene) => scene.key === 'aula/Nova' && scene.status === 'ready'));
    writeScene(paths.scenesDir, 'aula', 'Nova');
    server.rescan();
    const withNew = await arrival;
    const nova = withNew.scenes.find((scene) => scene.key === 'aula/Nova')!;
    expect(nova.addedAt).not.toBeNull();
    expect(fake.jobs.map((job) => job.key)).toEqual(['aula/Fila', 'aula/Nova']);

    // nada mudou: nada re-renderiza
    server.rescan();
    await new Promise((wake) => setTimeout(wake, 60));
    expect(fake.jobs).toHaveLength(2);

    const before = server.state().scenes.find((scene) => scene.key === 'aula/Fila')!.video;
    writeScene(paths.scenesDir, 'aula', 'Fila', '// mudou');
    server.rescan();
    await until(() => fake.jobs.length === 3 && server!.state().queue.counts.ready === 2, 'Fila re-renderizada');
    const after = server.state().scenes.find((scene) => scene.key === 'aula/Fila')!.video;
    expect(after).not.toBe(before);

    rmSync(join(paths.scenesDir, 'aula', 'Nova.tsx'));
    server.rescan();
    expect(server.state().scenes.map((scene) => scene.key)).toEqual(['aula/Fila']);
  });

  it('o que já está em disco sobrevive a reinício', async () => {
    const paths = setup();
    writeScene(paths.scenesDir, 'aula', 'Fila');
    const first = fakeRenderer();
    server = await startPreviewServer({ port: 0, renderer: first.renderer, watch: false, pollMs: 20, ...paths });
    await until(() => server!.state().queue.counts.ready === 1, 'primeiro render');
    await server.close();

    const second = fakeRenderer();
    server = await startPreviewServer({ port: 0, renderer: second.renderer, watch: false, pollMs: 20, ...paths });
    expect(server.state().scenes[0]).toMatchObject({ status: 'ready', stale: false });
    await new Promise((wake) => setTimeout(wake, 60));
    expect(second.jobs).toHaveLength(0);
  });

  it('pausa enquanto há render principal e retoma depois', async () => {
    const paths = setup();
    writeScene(paths.scenesDir, 'aula', 'Fila');
    const live = join(paths.projectsDir, 'aula', 'live.json');
    mkdirSync(join(paths.projectsDir, 'aula'), { recursive: true });
    const now = Date.now();
    writeFileSync(live, JSON.stringify({ task: 'final', label: 'render', percent: 40, etaSec: 60, startedAt: now, updatedAt: now }));
    const fake = fakeRenderer();
    server = await startPreviewServer({ port: 0, renderer: fake.renderer, watch: false, pollMs: 20, ...paths });
    await new Promise((wake) => setTimeout(wake, 100));
    expect(fake.jobs).toHaveLength(0);
    expect(server.state().queue).toMatchObject({ paused: 'render principal em andamento', counts: { queued: 1, ready: 0 } });

    // a direção (o Claude pensando) não segura a fila
    writeFileSync(live, JSON.stringify({ task: 'direction', label: 'dirigindo', percent: null, etaSec: null, startedAt: now, updatedAt: now }));
    await until(() => server!.state().queue.counts.ready === 1, 'retomada');
    expect(server.state().queue.paused).toBeNull();
  });

  it('render principal que começa no meio cancela a prévia em andamento e ela volta para a fila', async () => {
    const paths = setup();
    writeScene(paths.scenesDir, 'aula', 'Fila');
    const fake = fakeRenderer({ delayMs: 3000 });
    server = await startPreviewServer({ port: 0, renderer: fake.renderer, watch: false, pollMs: 20, ...paths });
    await until(() => server!.state().queue.current !== null, 'render começou');
    const live = join(paths.projectsDir, 'aula', 'live.json');
    mkdirSync(join(paths.projectsDir, 'aula'), { recursive: true });
    writeFileSync(live, JSON.stringify({ task: 'preview', label: 'render', percent: 1, etaSec: null, startedAt: Date.now(), updatedAt: Date.now() }));
    await until(() => server!.state().queue.paused !== null && server!.state().queue.current === null, 'cancelado');
    expect(server.state().scenes[0]!.status).toBe('queued');
  });

  it('erro de render fica na cena; erro de compilação trava a fila até o arquivo mudar', async () => {
    const paths = setup();
    writeScene(paths.scenesDir, 'aula', 'Boa');
    writeScene(paths.scenesDir, 'aula', 'Quebrada');
    // a mais recente renderiza primeiro: Boa falha no render antes de o bundle quebrar
    utimesSync(join(paths.scenesDir, 'aula', 'Boa.tsx'), new Date(), new Date(Date.now() + 60_000));
    let broken = true;
    const fake = fakeRenderer({
      fail: (job) => {
        if (job.key === 'aula/Boa' && job.bundleVersion === 1) return new Error('falhou ao desenhar o frame 12');
        return broken ? new PreviewBundleError('ERROR in ./motion/src/scenes/aula/Quebrada.tsx 3:7\nUnexpected token') : null;
      },
    });
    server = await startPreviewServer({ port: 0, renderer: fake.renderer, watch: false, pollMs: 20, focus: 'aula', ...paths });
    await until(() => server!.state().queue.counts.error === 2, 'dois erros');
    const state = server.state();
    expect(state.scenes.find((scene) => scene.key === 'aula/Boa')).toMatchObject({ status: 'error', error: 'falhou ao desenhar o frame 12' });
    expect(state.scenes.find((scene) => scene.key === 'aula/Quebrada')!.error).toContain('Unexpected token');
    expect(state.queue.paused).toBe('erro de compilação em aula/Quebrada');

    broken = false;
    writeScene(paths.scenesDir, 'aula', 'Quebrada', '// consertada');
    server.rescan();
    await until(() => server!.state().scenes.find((scene) => scene.key === 'aula/Quebrada')!.status === 'ready', 'consertada');
    expect(server.state().queue.paused).toBeNull();
  });

  it('sem renderizador é só o índice: lista as cenas e não enfileira nada', async () => {
    const paths = setup();
    writeScene(paths.scenesDir, 'aula', 'Fila');
    server = await startPreviewServer({ port: 0, renderer: null, watch: false, ...paths });
    expect(server.state()).toMatchObject({ previews: 'off', queue: { paused: null, current: null, counts: { ready: 1, queued: 0 } } });
    expect(server.state().scenes[0]).toMatchObject({ key: 'aula/Fila', status: 'ready', video: null, strip: [] });
  });

  it('com o chokidar ligado, gravar um arquivo de cena basta', async () => {
    const paths = setup();
    mkdirSync(paths.scenesDir, { recursive: true });
    server = await startPreviewServer({ port: 0, renderer: null, ...paths });
    await new Promise((wake) => setTimeout(wake, 300));
    writeScene(paths.scenesDir, 'aula', 'Chegou');
    await until(() => server!.state().scenes.length === 1, 'cena detectada', 8000);
    expect(readFileSync(join(paths.scenesDir, 'index.ts'), 'utf8')).toContain("id: 'Roteiro-aula'");
  });
});
