import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { contentType, hostAllowed, mediaUrl, parseRange, resolveMediaPath, route } from '../src/preview/routes.ts';

const root = resolve('projects', '.preview');

describe('rotas do índice de cenas', () => {
  it('reconhece página, API, eventos e mídia', () => {
    expect(route('GET', '/', root)).toEqual({ kind: 'page' });
    expect(route('GET', '/?projeto=aula', root)).toEqual({ kind: 'page' });
    expect(route('GET', '/api/scenes', root)).toEqual({ kind: 'scenes' });
    expect(route('GET', '/api/health', root)).toEqual({ kind: 'health' });
    expect(route('GET', '/events', root)).toEqual({ kind: 'events' });
    expect(route('GET', mediaUrl('aula', 'Fila', 'abc-preview.mp4'), root)).toEqual({ kind: 'media', file: join(root, 'aula', 'Fila', 'abc-preview.mp4') });
    expect(route('HEAD', '/media/aula/Fila/abc-f0001.jpg?v=1', root).kind).toBe('media');
    expect(route('GET', '/qualquer', root)).toEqual({ kind: 'notFound' });
  });

  it('só POST encerra; o resto só aceita leitura', () => {
    expect(route('POST', '/api/shutdown', root)).toEqual({ kind: 'shutdown' });
    expect(route('GET', '/api/shutdown', root)).toEqual({ kind: 'methodNotAllowed' });
    expect(route('POST', '/api/scenes', root)).toEqual({ kind: 'methodNotAllowed' });
    expect(route('DELETE', '/media/aula/Fila/a.mp4', root)).toEqual({ kind: 'methodNotAllowed' });
  });

  it('nada fora da pasta de prévias é servido', () => {
    const attacks = [
      '../../package.json',
      '..%2f..%2fpackage.json',
      '%2e%2e/%2e%2e/secret.mp4',
      'aula/../../../secret.mp4',
      'aula/Fila/..%5c..%5c..%5csecret.mp4',
      'aula/Fila/..\\..\\secret.mp4',
      '%252e%252e/%252e%252e/secret.mp4',
      'C:/Windows/win.ini',
      'aula/Fila/C:secret.mp4',
      '/etc/passwd',
      'aula//secret.mp4',
      'aula/Fila/extra/a.mp4',
      'aula/Fila/a.mp4%00.jpg',
      '%E0%A4%A',
      '.bundle/x/a.mp4',
      'aula/Fila/.oculto.mp4',
    ];
    for (const attack of attacks) {
      expect(resolveMediaPath(root, attack), attack).toBeNull();
      expect(route('GET', `/media/${attack}`, root).kind, attack).toBe('forbidden');
    }
  });

  it('manifest, registro do servidor e outros tipos não são mídia', () => {
    expect(resolveMediaPath(root, 'aula/Fila/manifest.json')).toBeNull();
    expect(resolveMediaPath(root, 'server.json')).toBeNull();
    expect(resolveMediaPath(root, 'aula/Fila/cena.tsx')).toBeNull();
    expect(resolveMediaPath(root, 'aula/Fila/abc-f0001.jpg')).toBe(join(root, 'aula', 'Fila', 'abc-f0001.jpg'));
  });

  it('Content-Type certo por extensão', () => {
    expect(contentType('a.mp4')).toBe('video/mp4');
    expect(contentType('a.WEBM')).toBe('video/webm');
    expect(contentType('a.jpg')).toBe('image/jpeg');
    expect(contentType('a.png')).toBe('image/png');
    expect(contentType('a.json')).toBeNull();
  });

  it('Range: intervalo, até o fim, sufixo e pedidos impossíveis', () => {
    expect(parseRange(undefined, 1000)).toBeNull();
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
    expect(parseRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange('bytes=1000-', 1000)).toBe('invalid');
    expect(parseRange('bytes=50-10', 1000)).toBe('invalid');
    expect(parseRange('bytes=-', 1000)).toBe('invalid');
    expect(parseRange('bytes=0-1,5-9', 1000)).toBe('invalid');
    expect(parseRange('itens=0-1', 1000)).toBe('invalid');
  });

  it('só atende por 127.0.0.1 ou localhost na porta do servidor', () => {
    expect(hostAllowed('127.0.0.1:4174', 4174)).toBe(true);
    expect(hostAllowed('localhost:4174', 4174)).toBe(true);
    expect(hostAllowed('evil.example:4174', 4174)).toBe(false);
    expect(hostAllowed('127.0.0.1:80', 4174)).toBe(false);
    expect(hostAllowed(undefined, 4174)).toBe(false);
  });
});
