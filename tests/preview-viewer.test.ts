import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { reelDuration, reelParts } from '../motion/src/preview/SceneReel.tsx';
import { configSchema } from '../src/config.ts';
import { openCommands, readServerInfo, removeServerInfo, type ServerInfo, viewerUrl, writeServerInfo } from '../src/preview/session.ts';
import { reelTarget, studioArgs, studioTarget, studioUrl } from '../src/preview/studio.ts';
import { ensureViewer, stopViewer } from '../src/preview/viewer.ts';
import { reelCompositionId, renderSceneIndex, sceneReels } from '../src/scenes/sync.ts';
import { runWatcher } from '../src/watcher/index.ts';
import { enqueue, loadQueue, saveQueue } from '../src/watcher/queue.ts';

const dir = mkdtempSync(join(tmpdir(), 'mce-preview-viewer-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const scenes = [
  { project: 'aula', name: 'Fila', changedAt: 100 },
  { project: 'aula', name: 'Pilha', changedAt: 300 },
  { project: 'outro', name: 'Grafo', changedAt: 900 },
];

describe('Remotion Studio como visor', () => {
  it('sobe sem abrir navegador, na porta pedida', () => {
    expect(studioArgs(4173, 'remotion-cli.js')).toEqual(['remotion-cli.js', 'studio', 'motion/src/index.ts', '--port', '4173', '--no-open']);
    expect(studioUrl(4173)).toBe('http://localhost:4173');
  });

  it('abre na cena gravada por último do projeto; sem cena, na raiz', () => {
    expect(studioTarget('http://localhost:4173', scenes, 'aula')).toBe('http://localhost:4173/Cena-aula-Pilha');
    expect(studioTarget('http://localhost:4173/', scenes)).toBe('http://localhost:4173/Cena-outro-Grafo');
    expect(studioTarget('http://localhost:4173', scenes, 'vazio')).toBe('http://localhost:4173');
    expect(reelTarget('http://localhost:4173/', 'aula')).toBe('http://localhost:4173/Roteiro-aula');
  });

  it('o índice abre filtrado por ?projeto=', () => {
    expect(viewerUrl('http://127.0.0.1:4174', 'aula')).toBe('http://127.0.0.1:4174/?projeto=aula');
    expect(viewerUrl('http://127.0.0.1:4174')).toBe('http://127.0.0.1:4174/');
  });

  it('abre o Chrome com args em array e cai para o navegador padrão', () => {
    const url = 'http://localhost:4173/Cena-aula-Fila';
    expect(openCommands(url, 'win32')).toEqual([
      { command: 'cmd', args: ['/c', 'start', '', 'chrome', url] },
      { command: 'cmd', args: ['/c', 'start', '', url] },
    ]);
    expect(openCommands(url, 'linux').at(-1)).toEqual({ command: 'xdg-open', args: [url] });
    expect(openCommands(url, 'darwin')[0]!.args).toEqual(['-a', 'Google Chrome', url]);
  });

  it('server.json guarda { url, pid, startedAt } e só o dono apaga', () => {
    const file = join(dir, 'server.json');
    const info: ServerInfo = { url: 'http://localhost:4173', pid: 4242, startedAt: 1_791_800_000_000 };
    writeServerInfo(info, file);
    expect(readServerInfo(file)).toEqual(info);
    removeServerInfo(1, file);
    expect(readServerInfo(file)).toEqual(info);
    removeServerInfo(4242, file);
    expect(readServerInfo(file)).toBeNull();
    expect(readServerInfo(join(dir, 'nao-existe.json'))).toBeNull();
  });
});

describe('ensureViewer', () => {
  const live: ServerInfo = { url: 'http://localhost:4173', pid: 1, startedAt: 0 };

  it('com o visor no ar só abre a cena do projeto', async () => {
    const opened: string[] = [];
    let launched = 0;
    const ok = await ensureViewer('aula', { findLive: async () => live, launch: () => (launched += 1), open: async (url) => (opened.push(url), true), scenes: () => scenes });
    expect(ok).toBe(true);
    expect(launched).toBe(0);
    expect(opened).toEqual(['http://localhost:4173/Cena-aula-Pilha']);
  });

  it('sem visor, sobe um destacado, espera o registro aparecer e abre', async () => {
    const launches: [string, number][] = [];
    let checks = 0;
    const opened: string[] = [];
    const ok = await ensureViewer('aula', {
      port: 5000,
      timeoutMs: 2000,
      findLive: async () => ((checks += 1) >= 3 ? live : null),
      launch: (slug, port) => launches.push([slug, port]),
      open: async (url) => (opened.push(url), true),
      scenes: () => [],
    });
    expect(ok).toBe(true);
    expect(launches).toEqual([['aula', 5000]]);
    expect(opened).toEqual(['http://localhost:4173']);
  });

  it('nunca lança: visor que não sobe ou navegador que falha viram false + mensagem', async () => {
    const logs: string[] = [];
    const log = (message: string) => logs.push(message);
    expect(await ensureViewer('aula', { timeoutMs: 30, findLive: async () => null, launch: () => undefined, log })).toBe(false);
    expect(await ensureViewer('aula', { findLive: async () => live, open: async () => false, scenes: () => scenes, log })).toBe(false);
    expect(
      await ensureViewer('aula', {
        findLive: async () => {
          throw new Error('disco sumiu');
        },
        log,
      }),
    ).toBe(false);
    expect(
      await ensureViewer('aula', {
        timeoutMs: 30,
        findLive: async () => null,
        launch: () => {
          throw new Error('spawn EPERM');
        },
        log,
      }),
    ).toBe(false);
    expect(logs).toHaveLength(4);
    expect(logs[0]).toContain('não subiu a tempo');
    expect(logs[2]).toContain('disco sumiu');
    expect(logs[3]).toContain('spawn EPERM');
  });

  it('stopViewer sem registro só avisa', async () => {
    const logs: string[] = [];
    expect(await stopViewer((message) => logs.push(message), join(dir, 'sem-servidor.json'))).toBe(false);
    expect(logs).toEqual(['o visor não está no ar']);
  });
});

describe('watcher abre o visor na edição autônoma', () => {
  const queued = (name: string) => {
    const queueFile = join(dir, `${name}.json`);
    saveQueue(enqueue([], 'D:/inbox/aula-um.mp4', new Date('2026-10-12T03:00:00Z')).queue, queueFile);
    return { queueFile, notifyLog: join(dir, `${name}.log`), inbox: join(dir, `${name}-inbox`), once: true as const };
  };
  const done = { ok: true, summary: 'feito', costUsd: null, turns: 1 };

  it('cada job chama openViewer com o slug, antes de a edição terminar', async () => {
    const order: string[] = [];
    await runWatcher({
      ...queued('abre'),
      log: () => undefined,
      openViewer: async (slug) => (order.push(`visor:${slug}`), true),
      edit: async (job) => {
        await new Promise((wake) => setTimeout(wake, 10));
        order.push(`edit:${job.slug}`);
        return done;
      },
    });
    expect(order).toEqual(['visor:aula-um', 'edit:aula-um']);
  });

  it('falha do visor não derruba a edição', async () => {
    const options = queued('falha');
    const logs: string[] = [];
    let edited = 0;
    await runWatcher({
      ...options,
      log: (message) => logs.push(message),
      openViewer: async () => {
        throw new Error('chrome não abriu');
      },
      edit: async () => ((edited += 1), done),
    });
    expect(edited).toBe(1);
    expect(loadQueue(options.queueFile)[0]!.status).toBe('done');
    expect(logs.some((line) => line.includes('visor de cenas: chrome não abriu'))).toBe(true);
  });

  it('liga por padrão na config, com porta configurável', () => {
    expect(configSchema.parse({}).preview).toEqual({ autoOpen: true, port: 4173 });
    expect(configSchema.parse({ preview: { autoOpen: false } }).preview).toEqual({ autoOpen: false, port: 4173 });
  });
});

describe('roteiro: todas as cenas do projeto em sequência', () => {
  const files = [
    { project: 'aula', name: 'Fila' },
    { project: 'aula', name: 'Pilha' },
    { project: 'outro_video', name: 'Grafo' },
  ];

  it('o índice gerado traz um roteiro por projeto, com as cenas na ordem', () => {
    expect(reelCompositionId('outro_video')).toBe('Roteiro-outro-video');
    expect(sceneReels(files)).toEqual([
      { id: 'Roteiro-aula', project: 'aula', keys: ['aula/Fila', 'aula/Pilha'] },
      { id: 'Roteiro-outro-video', project: 'outro_video', keys: ['outro_video/Grafo'] },
    ]);
    const index = renderSceneIndex(files);
    expect(index).toContain("{ id: 'Roteiro-aula', project: 'aula', keys: ['aula/Fila', 'aula/Pilha'] },");
    expect(renderSceneIndex([])).toContain('export const sceneReels');
  });

  it('cada cena entra com a própria duração; chave sem registro fica de fora', () => {
    const parts = reelParts(['aula/Fila', 'aula/Sumiu', 'aula/Pilha'], { 'aula/Fila': { defaultDuration: 6.5 }, 'aula/Pilha': { defaultDuration: 4 } }, 30);
    expect(parts).toEqual([
      { key: 'aula/Fila', name: 'Fila', durationInFrames: 195 },
      { key: 'aula/Pilha', name: 'Pilha', durationInFrames: 120 },
    ]);
    expect(reelDuration(parts)).toBe(315);
    expect(reelDuration([])).toBe(1);
  });
});
