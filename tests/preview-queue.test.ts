import { describe, expect, it } from 'vitest';

import type { Live } from '../src/project/live.ts';
import { blameScenes, cleanError, countStatuses, drop, emptyQueue, enqueue, finish, overallPercent, PAUSED_BY_MAIN, pauseReason, pickNext, start } from '../src/preview/queue.ts';

const item = (key: string, changedAt: number) => ({ key, project: key.split('/')[0]!, changedAt });

describe('fila de prévias', () => {
  it('não repete cena: entrar de novo só atualiza o item', () => {
    let queue = enqueue(emptyQueue(), item('a/Um', 10));
    queue = enqueue(queue, item('a/Dois', 20));
    queue = enqueue(queue, item('a/Um', 30));
    expect(queue.pending.map((entry) => entry.key)).toEqual(['a/Dois', 'a/Um']);
    expect(queue.pending.find((entry) => entry.key === 'a/Um')?.changedAt).toBe(30);
  });

  it('a cena que mudou por último vai primeiro; o projeto em foco passa na frente', () => {
    let queue = emptyQueue();
    for (const entry of [item('a/Velha', 10), item('b/Nova', 50), item('a/Media', 30)]) queue = enqueue(queue, entry);
    expect(pickNext(queue)?.key).toBe('b/Nova');
    expect(pickNext(queue, 'a')?.key).toBe('a/Media');
    expect(pickNext(emptyQueue())).toBeNull();
  });

  it('um trabalho ativo por vez', () => {
    let queue = enqueue(enqueue(emptyQueue(), item('a/Um', 1)), item('a/Dois', 2));
    queue = start(queue, 'a/Dois');
    expect(queue.active?.key).toBe('a/Dois');
    expect(queue.pending.map((entry) => entry.key)).toEqual(['a/Um']);
    expect(() => start(queue, 'a/Um')).toThrow(/ainda está renderizando/);
    queue = finish(queue, 'a/Dois');
    expect(queue.active).toBeNull();
    expect(finish(queue, 'outra')).toBe(queue);
  });

  it('cena regravada durante o próprio render volta para a espera e roda de novo', () => {
    let queue = start(enqueue(emptyQueue(), item('a/Um', 1)), 'a/Um');
    queue = enqueue(queue, item('a/Um', 5));
    expect(queue.active?.key).toBe('a/Um');
    expect(pickNext(queue)?.changedAt).toBe(5);
    expect(drop(queue, 'a/Um').pending).toEqual([]);
  });

  it('conta os estados e distribui o progresso pelas fases', () => {
    expect(countStatuses(['ready', 'ready', 'queued', 'error'])).toEqual({ queued: 1, rendering: 0, ready: 2, error: 1 });
    expect(overallPercent('bundle', 0)).toBe(0);
    expect(overallPercent('strip', 0.5)).toBe(20);
    expect(overallPercent('video', 0.5)).toBe(65);
    expect(overallPercent('video', 7)).toBe(100);
  });
});

describe('pausa durante o render principal', () => {
  const now = 1_000_000_000;
  const live = (task: Live['task'], ageMs: number): Live => ({ task, label: '', percent: 10, etaSec: null, startedAt: now - ageMs, updatedAt: now - ageMs });

  it('render, análise ou avaliação frescos pausam; direção e registro velho não', () => {
    expect(pauseReason([live('final', 1000)], now)).toBe(PAUSED_BY_MAIN);
    expect(pauseReason([null, live('analysis', 60_000)], now)).toBe(PAUSED_BY_MAIN);
    expect(pauseReason([live('eval', 2000), live('direction', 0)], now)).toBe(PAUSED_BY_MAIN);
    expect(pauseReason([live('direction', 1000)], now)).toBeNull();
    expect(pauseReason([live('final', 10 * 60_000)], now)).toBeNull();
    expect(pauseReason([], now)).toBeNull();
  });
});

describe('erros', () => {
  it('acha a cena citada no erro do bundler, com barra de qualquer lado', () => {
    const scenes = [
      { project: 'aula', name: 'Fila' },
      { project: 'aula', name: 'FilaDupla' },
    ];
    expect(blameScenes('ERROR in D:\\x\\motion\\src\\scenes\\aula\\Fila.tsx:12:3 Unexpected token', scenes)).toEqual([scenes[0]]);
    expect(blameScenes('Module not found in ./motion/src/scenes/aula/FilaDupla.tsx', scenes)).toEqual([scenes[1]]);
    expect(blameScenes('erro em scene-kit/index.ts', scenes)).toEqual([]);
  });

  it('limpa cores de terminal e corta mensagem enorme', () => {
    expect(cleanError(new Error('\u001b[31mfalhou\u001b[39m aqui'))).toBe('falhou aqui');
    expect(cleanError('x'.repeat(50), 10)).toBe(`${'x'.repeat(10)}…`);
  });
});
