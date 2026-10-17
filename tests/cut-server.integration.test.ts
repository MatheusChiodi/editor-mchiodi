import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startCutServer, type CutServer } from '../src/cut/server.ts';
import { validateEdl } from '../src/edl/store.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { writeJson } from '../src/project/paths.ts';
import { baseEdl, DURATION, edgesInsideWords, SILENCES, WORDS } from './cut-fixture.ts';

const root = mkdtempSync(join(tmpdir(), 'mce-cut-'));
const projectsDir = join(root, 'projects');
const dir = join(projectsDir, 'demo');
const proxy = join(dir, 'analysis', 'proxy.mp4');
const fakeClaude = join(root, 'fake-claude.mjs');
let server: CutServer;

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

/** Assina os eventos do projeto e guarda tudo que chega. */
async function subscribe(slug: string) {
  const controller = new AbortController();
  const events: SseEvent[] = [];
  const response = await fetch(`${server.url}/api/projects/${slug}/events`, { signal: controller.signal });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        let index: number;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const event = /^event: (.+)$/m.exec(block)?.[1];
          const data = /^data: (.+)$/m.exec(block)?.[1];
          if (event && data) events.push({ event, data: JSON.parse(data) as Record<string, unknown> });
        }
      }
    } catch {
      // assinatura encerrada
    }
  })();
  const waitFor = async (predicate: (event: SseEvent) => boolean, timeoutMs = 10_000): Promise<SseEvent> => {
    const started = Date.now();
    for (;;) {
      const found = events.find(predicate);
      if (found) return found;
      if (Date.now() - started > timeoutMs) throw new Error(`evento não chegou; recebidos: ${events.map((item) => item.event).join(', ')}`);
      await new Promise((done) => setTimeout(done, 50));
    }
  };
  await waitFor((event) => event.event === 'hello');
  return { events, waitFor, close: () => controller.abort() };
}

const api = (path: string, init?: RequestInit) => fetch(`${server.url}/api${path}`, init);
const post = (path: string, body: unknown) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeAll(async () => {
  mkdirSync(join(dir, 'analysis'), { recursive: true });
  await ffmpeg([
    '-f', 'lavfi', '-i', `testsrc=size=320x180:rate=30:duration=${DURATION}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${DURATION}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '15', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', proxy,
  ]);
  writeJson(join(dir, 'analysis', 'analysis.json'), {
    source: { path: proxy, durationSec: DURATION, fps: 30, width: 320, height: 180, videoCodec: 'h264', isVfr: false, audioRate: 48000, audioChannels: 1, hasAudio: true },
    renderSource: proxy,
    proxy,
    loudness: { integratedLufs: -20, truePeakDb: -3, lra: 5, threshold: -30 },
    silences: SILENCES,
    scenes: [],
    phrases: [],
    flags: [],
    createdAt: '2026-10-17T00:00:00.000Z',
  });
  writeJson(join(dir, 'analysis', 'words.json'), { meta: {}, segments: [], words: WORDS });
  writeFileSync(join(dir, 'analysis', 'takes.md'), '# takes\n', 'utf8');
  writeJson(join(dir, 'edl', 'edl.v1.json'), baseEdl({ source: { path: proxy, durationSec: DURATION, fps: 30, width: 320, height: 180 } }));
  // "claude" falso: grava uma nova versão a partir da atual e fala em stream-json, como a sessão real
  writeFileSync(
    fakeClaude,
    `import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const edlDir = join(process.argv[2], 'demo', 'edl');
const latest = Math.max(...readdirSync(edlDir).map((f) => Number(/^edl\\.v(\\d+)\\.json$/.exec(f)?.[1] ?? 0)));
const edl = JSON.parse(readFileSync(join(edlDir, 'edl.v' + latest + '.json'), 'utf8'));
edl.version = latest + 1;
edl.notes = 'Claude (painel): destaque no vite';
edl.captions.highlights = ['vite'];
console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Destacando vite' }] } }));
writeFileSync(join(edlDir, 'edl.v' + edl.version + '.json'), JSON.stringify(edl, null, 2));
console.log(JSON.stringify({ type: 'result', result: 'RESULTADO: ok — v' + edl.version, is_error: false, num_turns: 2 }));
`,
    'utf8',
  );
  server = await startCutServer({
    port: 0,
    projectsDir,
    distDir: join(root, 'sem-ui'),
    claudeCommand: (args) => ({ command: process.execPath, args: [fakeClaude, projectsDir, ...args] }),
  });
}, 60_000);

afterAll(async () => {
  await server?.close();
  rmSync(root, { recursive: true, force: true });
});

describe('MChiodi Cut: servidor', () => {
  it('lista e carrega o projeto', async () => {
    const list = (await (await api('/projects')).json()) as { projects: { slug: string; latest: number }[] };
    expect(list.projects).toEqual([{ slug: 'demo', analyzed: true, latest: 1, versions: 1 }]);
    const project = (await (await api('/projects/demo')).json()) as Record<string, unknown>;
    expect(project).toMatchObject({ slug: 'demo', latest: 1, takes: '# takes\n' });
    expect((project.words as unknown[]).length).toBe(WORDS.length);
    expect((project.level as { current: string }).current).toBe('normal');
  });

  it('aparar um corte gera v2 válida, com a borda em silêncio e nunca dentro de palavra; conflito na base velha', async () => {
    const stream = await subscribe('demo');
    const response = await post('/projects/demo/save', { baseVersion: 1, ops: [{ type: 'trimClip', clipId: 'c002', edge: 'start', time: 2.2 }] });
    expect(response.status).toBe(200);
    const saved = (await response.json()) as { version: number; notes: string; warnings: string[] };
    expect(saved.version).toBe(2);
    expect(saved.notes).toMatch(/^Matheus: moveu início de c002/);
    expect(saved.warnings[0]).toContain('vamos');

    const v2 = validateEdl(await (await api('/projects/demo/edl/2')).json());
    const start = v2.clips.find((clip) => clip.id === 'c002')!.start;
    expect(SILENCES.some((silence) => start >= silence.start && start <= silence.end)).toBe(true);
    expect(edgesInsideWords(v2)).toEqual([]);
    expect((await stream.waitFor((event) => event.event === 'version' && event.data.version === 2)).data.byMatheus).toBe(true);
    stream.close();

    const conflict = await post('/projects/demo/save', { baseVersion: 1, ops: [{ type: 'captionHighlight', word: 'vite', on: true }] });
    expect(conflict.status).toBe(409);
    const body = (await conflict.json()) as { error: string; currentVersion: number; diff: string[]; since: { version: number }[] };
    expect(body).toMatchObject({ error: 'conflict', currentVersion: 2 });
    expect(body.diff[0]).toContain('clipes');
    expect(body.since.map((item) => item.version)).toEqual([2]);
  });

  it('operação inválida é recusada com o índice', async () => {
    const response = await post('/projects/demo/save', { baseVersion: 2, ops: [{ type: 'insertItem', kind: 'zooms', item: { at: 2.2, duration: 1 } }] });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ opIndex: 0 });
  });

  it('snap e preview não gravam nada', async () => {
    const snap = (await (await api('/projects/demo/snap?t=3.2')).json()) as { time: number; insideWord: { text: string } };
    expect(snap.insideWord.text).toBe('reakt');
    expect(snap.time).toBeCloseTo(3.46, 2);
    const preview = await post('/projects/demo/preview', { baseVersion: 2, ops: [{ type: 'removeRange', start: 3.5, end: 4.6 }] });
    expect(preview.status).toBe(200);
    expect(((await (await api('/projects')).json()) as { projects: { latest: number }[] }).projects[0]!.latest).toBe(2);
  });

  it('reverter gera nova versão com o conteúdo antigo', async () => {
    const response = await post('/projects/demo/revert', { version: 1, baseVersion: 2 });
    const body = (await response.json()) as { version: number; notes: string };
    expect(body.version).toBe(3);
    expect(body.notes).toContain('voltou para a v1');
    const [v1, v3] = await Promise.all([api('/projects/demo/edl/1').then((r) => r.json()), api('/projects/demo/edl/3').then((r) => r.json())]);
    expect((v3 as { clips: unknown }).clips).toEqual((v1 as { clips: unknown }).clips);
    const diff = (await (await api('/projects/demo/diff?a=2&b=3')).json()) as { lines: string[] };
    expect(diff.lines[0]).toContain('clipes');
  });

  it('SRT: exportar, corrigir, reimportar e salvar como replacement', async () => {
    const srt = await (await api('/projects/demo/srt')).text();
    expect(srt).toContain('reakt');
    const imported = (await (await post('/projects/demo/srt/import', { baseVersion: 3, srt: srt.replace('reakt', 'React') })).json()) as { ops: unknown[] };
    expect(imported.ops).toEqual([{ type: 'captionReplace', from: 'reakt', to: 'React' }]);
    const saved = (await (await post('/projects/demo/save', { baseVersion: 3, ops: imported.ops })).json()) as { version: number; notes: string };
    expect(saved.notes).toBe("Matheus: corrigiu legenda 'reakt'→'React'");
    const edl = (await (await api(`/projects/demo/edl/${saved.version}`)).json()) as { captions: { replacements: Record<string, string> } };
    expect(edl.captions.replacements).toEqual({ reakt: 'React' });
    expect(await (await api('/projects/demo/srt')).text()).toContain('React');
  });

  it('proxy com Range, forma de onda e still', async () => {
    const full = await api('/projects/demo/proxy');
    expect(full.status).toBe(200);
    const size = Number(full.headers.get('content-length'));
    await full.arrayBuffer();
    const partial = await api('/projects/demo/proxy', { headers: { Range: 'bytes=0-99' } });
    expect(partial.status).toBe(206);
    expect(partial.headers.get('content-range')).toBe(`bytes 0-99/${size}`);
    expect((await partial.arrayBuffer()).byteLength).toBe(100);

    const waveform = (await (await api('/projects/demo/waveform')).json()) as { peaksPerSec: number; peaks: number[] };
    expect(waveform.peaks.length).toBeGreaterThanOrEqual(DURATION * 100 - 2);
    expect(Math.max(...waveform.peaks)).toBeGreaterThan(20);

    const still = await api('/projects/demo/still?at=1.5');
    expect(still.headers.get('content-type')).toBe('image/png');
    expect((await still.arrayBuffer()).byteLength).toBeGreaterThan(100);
  }, 60_000);

  it('painel Claude: streaming, proposta como nova versão e rejeição sem apagar nada', async () => {
    const stream = await subscribe('demo');
    const latest = ((await (await api('/projects')).json()) as { projects: { latest: number }[] }).projects[0]!.latest;
    const started = await post('/projects/demo/claude', { instruction: 'destaca o vite', baseVersion: latest, selection: { start: 4.5, end: 5.8 } });
    expect(started.status).toBe(202);
    expect((await stream.waitFor((event) => event.event === 'claude' && event.data.kind === 'text')).data.text).toBe('Destacando vite');
    const done = await stream.waitFor((event) => event.event === 'claude-done');
    expect(done.data).toMatchObject({ ok: true, baseVersion: latest, proposedVersion: latest + 1 });
    expect((done.data.diff as string[]).join(' ')).toContain('captions');

    const rejected = (await (await post('/projects/demo/claude/reject', { proposedVersion: latest + 1 })).json()) as { version: number; notes: string };
    expect(rejected.version).toBe(latest + 2);
    expect(rejected.notes).toBe(`Matheus: rejeitou proposta v${latest + 1} (volta ao conteúdo da v${latest})`);
    const edl = (await (await api(`/projects/demo/edl/${latest + 2}`)).json()) as { captions: { highlights: string[] } };
    expect(edl.captions.highlights).toEqual([]);
    stream.close();
  }, 30_000);

  it('segurança: host de fora, POST sem JSON, slug com traversal e arquivo fora de renders/', async () => {
    const status = await new Promise<number>((done, fail) => {
      const req = request({ host: '127.0.0.1', port: server.port, path: '/api/projects', headers: { Host: 'evil.example:80' } }, (res) => {
        res.resume();
        done(res.statusCode ?? 0);
      });
      req.on('error', fail);
      req.end();
    });
    expect(status).toBe(403);
    expect((await api('/projects', { headers: { Origin: 'https://evil.example' } })).status).toBe(403);
    expect((await api('/projects/demo/save', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415);
    expect((await api('/projects/..%2F..%2Fx')).status).toBe(400);
    expect((await api('/projects/demo/file?path=analysis/words.json')).status).toBe(403);
    expect((await api('/projects/demo/file?path=renders/../../x.mp4')).status).toBe(403);
    expect((await fetch(`${server.url}/`)).status).toBe(404);
  });
});
