import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { mceArgs, jobSucceeded } from '../src/cut/jobs.ts';
import { createPeakAccumulator } from '../src/cut/media.ts';
import { isLoopbackHost, isLoopbackOrigin, parseRange, safeJoin } from '../src/cut/server.ts';

describe('segurança', () => {
  it('só aceita host e origem de loopback', () => {
    expect(isLoopbackHost('127.0.0.1:4870')).toBe(true);
    expect(isLoopbackHost('localhost:5173')).toBe(true);
    expect(isLoopbackHost('evil.com')).toBe(false);
    expect(isLoopbackHost('127.0.0.1.evil.com:80')).toBe(false);
    expect(isLoopbackHost(undefined)).toBe(false);
    expect(isLoopbackOrigin(undefined)).toBe(true);
    expect(isLoopbackOrigin('http://localhost:5173')).toBe(true);
    expect(isLoopbackOrigin('https://evil.com')).toBe(false);
    expect(isLoopbackOrigin('null')).toBe(false);
  });

  it('safeJoin barra traversal, absoluto, drive, barra invertida e oculto', () => {
    const root = resolve('raiz');
    expect(safeJoin(root, 'renders/a.mp4')).toBe(join(root, 'renders', 'a.mp4'));
    for (const bad of ['../x', 'a/../../x', '/etc/passwd', 'C:/x', 'a\\b', '.env', 'a/.git/x', '']) expect(safeJoin(root, bad)).toBeNull();
  });

  it('parseRange', () => {
    expect(parseRange(undefined, 100)).toBeNull();
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=0-500', 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=200-', 100)).toBe('invalid');
    expect(parseRange('items=0-1', 100)).toBe('invalid');
  });
});

describe('jobs', () => {
  it('cada ação da UI vira um comando mce', () => {
    expect(mceArgs('demo', { kind: 'render' })).toEqual(['render', 'demo']);
    expect(mceArgs('demo', { kind: 'final', edl: 3 })).toEqual(['render', 'demo', '--final', '--edl', '3']);
    expect(mceArgs('demo', { kind: 'evalFinal' })).toEqual(['eval', 'demo', '--final']);
    expect(mceArgs('demo', { kind: 'export', export: { format: '9x16', fit: 'center-crop', focusX: 0.3 } })).toEqual([
      'export', 'demo', '--format', '9x16', '--fit', 'center-crop', '--focus', '0.3',
    ]);
    expect(mceArgs('demo', { kind: 'export', export: { format: '9x16', scope: 'shorts' } })).toEqual(['export', 'demo', '--format', '9x16', '--shorts']);
    expect(() => mceArgs('demo', { kind: 'export' })).toThrow(/format/);
  });

  it('eval reprovado (código 2) é job que funcionou', () => {
    expect(jobSucceeded('eval', 2)).toBe(true);
    expect(jobSucceeded('render', 2)).toBe(false);
    expect(jobSucceeded('render', 0)).toBe(true);
  });
});

describe('createPeakAccumulator', () => {
  it('picos por janela, mesmo com amostra partida entre pedaços', () => {
    const samples = new Int16Array([100, -32768, 0, 16384, -8192, 0]);
    const bytes = new Uint8Array(samples.buffer);
    const accumulator = createPeakAccumulator(2);
    accumulator.push(bytes.subarray(0, 3));
    accumulator.push(bytes.subarray(3, 7));
    accumulator.push(bytes.subarray(7));
    expect(accumulator.finish()).toEqual([255, 128, 64]);
  });
});
