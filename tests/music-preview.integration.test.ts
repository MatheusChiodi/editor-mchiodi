import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startMusicPreview, type MusicPreview } from '../src/music/preview.ts';

const dir = mkdtempSync(join(tmpdir(), 'mce-mvprev-'));
const projects = join(dir, 'projects');
const dist = join(dir, 'dist');
const analysis = join(projects, 'demo', 'analysis');
const planFile = join(analysis, 'music.plan.json');
const audio = join(dir, 'song.mp3');
let preview: MusicPreview;

/** GET com cabeçalhos livres (o fetch não deixa trocar o Host). */
function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: preview.port, path, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8').on('data', (chunk: string) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  mkdirSync(analysis, { recursive: true });
  mkdirSync(dist, { recursive: true });
  writeFileSync(planFile, JSON.stringify({ title: 'Demo', scenes: [] }));
  writeFileSync(audio, Buffer.alloc(1000, 7));
  writeFileSync(join(analysis, 'music.json'), JSON.stringify({ audio }));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>prévia</title>');
  preview = await startMusicPreview({ slug: 'demo', projectsDir: projects, distDir: dist });
});

afterAll(async () => {
  await preview.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('prévia ao vivo do vídeo da música', () => {
  it('serve a página e o plano em disco', async () => {
    expect((await get('/')).body).toContain('prévia');
    const plan = await get('/api/plan');
    expect(plan.status).toBe(200);
    expect(JSON.parse(plan.body)).toEqual({ title: 'Demo', scenes: [] });
  });

  it('serve a música com Range (o player precisa pular na música)', async () => {
    const part = await get('/api/audio', { Range: 'bytes=100-199' });
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe('bytes 100-199/1000');
    expect(part.body.length).toBe(100);
    expect((await get('/api/audio', { Range: 'bytes=5000-' })).status).toBe(416);
  });

  it('avisa o navegador quando o plano muda', async () => {
    const received = new Promise<string>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port: preview.port, path: '/api/events' }, (res) => {
        res.setEncoding('utf8').on('data', (chunk: string) => {
          if (chunk.includes('event: plan')) {
            resolve(chunk);
            req.destroy();
          }
        });
      });
      req.on('error', () => {});
      req.end();
      setTimeout(() => reject(new Error('sem evento')), 8000);
    });
    await new Promise((done) => setTimeout(done, 300));
    writeFileSync(planFile, JSON.stringify({ title: 'Demo', scenes: [{ motif: 'rain' }] }));
    expect(await received).toContain('event: plan');
    expect(JSON.parse((await get('/api/plan')).body).scenes).toHaveLength(1);
  });

  it('recusa Host fora de loopback, caminho fora do dist e método que não é GET', async () => {
    expect((await get('/api/plan', { Host: 'evil.example.com' })).status).toBe(403);
    expect((await get('/..%2f..%2fpackage.json')).status).toBe(404);
    expect((await get('/nao-existe.js')).status).toBe(404);
  });

  it('sem plano, o servidor nem sobe', async () => {
    await expect(startMusicPreview({ slug: 'nao-existe', projectsDir: projects, distDir: dist })).rejects.toThrow(/plano de música/);
  });
});
