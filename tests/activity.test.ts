import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type ActivityEntry,
  activityFile,
  appendActivity,
  formatActivity,
  parseActivity,
  readActivity,
  stepDurations,
  stepText,
  totalSpent,
  withActivity,
} from '../src/project/activity.ts';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mce-activity-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('activity.log', () => {
  it('stepText concorda o gênero e põe a duração e o motivo', () => {
    expect(stepText('step-start', 'preview')).toBe('render preview iniciado');
    expect(stepText('step-start', 'analysis')).toBe('análise iniciada');
    expect(stepText('step-done', 'preview', 629)).toBe('render preview concluído em 10:29');
    expect(stepText('step-done', 'evalFinal', 65)).toBe('avaliação do final concluída em 01:05');
    expect(stepText('step-failed', 'final', 130, 'ffmpeg saiu com código 1\nlinha 2')).toBe('render final falhou após 02:10: ffmpeg saiu com código 1');
    expect(stepText('step-done', 'outra')).toBe('outra concluído');
  });

  it('grava uma linha JSON por evento, criando a pasta, e lê de volta', () => {
    const file = activityFile({ dir: join(dir, 'novo', 'projeto') });
    expect(file.endsWith('activity.log')).toBe(true);
    expect(readActivity(file)).toEqual([]);
    const entries: ActivityEntry[] = [
      { at: 1000, kind: 'step-start', step: 'preview', text: 'render preview iniciado' },
      { at: 2000, kind: 'note', text: 'criando as cenas do bloco 2' },
    ];
    for (const entry of entries) appendActivity(file, entry);
    expect(readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(2);
    expect(readActivity(file)).toEqual(entries);
  });

  it('appendActivity nunca lança: o histórico não derruba a etapa', () => {
    const blocker = join(dir, 'arquivo');
    writeFileSync(blocker, 'x');
    expect(() => appendActivity(join(blocker, 'activity.log'), { at: 1, kind: 'note', text: 'x' })).not.toThrow();
  });

  it('parseActivity ignora linha pela metade, vazia ou fora do formato', () => {
    const text = [
      '{"at":1,"kind":"step-done","step":"preview","text":"ok","durationSec":10}',
      '',
      '{"at":2,"kind":"step-do',
      '{"at":"ontem","kind":"note","text":"sem hora"}',
      '{"at":3,"kind":"inventado","text":"x"}',
      'null',
      '{"at":4,"kind":"note","text":"nota","durationSec":"dez","step":7}',
    ].join('\r\n');
    expect(parseActivity(text)).toEqual([
      { at: 1, kind: 'step-done', step: 'preview', text: 'ok', durationSec: 10 },
      { at: 4, kind: 'note', text: 'nota' },
    ]);
  });

  it('formatActivity põe a hora local na frente', () => {
    const at = new Date(2026, 9, 12, 7, 41, 30).getTime();
    expect(formatActivity({ at, kind: 'step-done', text: 'render preview concluído em 10:29' })).toBe('07:41 render preview concluído em 10:29');
  });

  it('stepDurations fica com a última execução concluída; totalSpent soma tudo o que rodou', () => {
    const entries: ActivityEntry[] = [
      { at: 1, kind: 'step-start', step: 'preview', text: '' },
      { at: 2, kind: 'step-failed', step: 'preview', text: '', durationSec: 130 },
      { at: 3, kind: 'step-done', step: 'preview', text: '', durationSec: 700 },
      { at: 4, kind: 'step-done', step: 'preview', text: '', durationSec: 629 },
      { at: 5, kind: 'step-done', step: 'eval', text: '', durationSec: 90 },
      { at: 6, kind: 'note', text: 'nota' },
    ];
    expect(stepDurations(entries)).toEqual({ preview: 629, eval: 90 });
    expect(totalSpent(entries)).toEqual({ seconds: 1549, runs: 4 });
    expect(totalSpent([])).toEqual({ seconds: 0, runs: 0 });
  });

  it('withActivity registra início e fim com a duração, e devolve o resultado', async () => {
    const file = join(dir, 'activity.log');
    let now = 10_000;
    const result = await withActivity(
      file,
      'preview',
      async () => {
        now += 629_400;
        return 'pronto';
      },
      () => now,
    );
    expect(result).toBe('pronto');
    expect(readActivity(file)).toEqual([
      { at: 10_000, kind: 'step-start', step: 'preview', text: 'render preview iniciado' },
      { at: 639_400, kind: 'step-done', step: 'preview', text: 'render preview concluído em 10:29', durationSec: 629 },
    ]);
  });

  it('withActivity registra a falha com a mensagem e repassa o erro', async () => {
    const file = join(dir, 'activity.log');
    let now = 0;
    const failing = withActivity(
      file,
      'final',
      async () => {
        now += 5000;
        throw new Error('sem memória\nstack');
      },
      () => now,
    );
    await expect(failing).rejects.toThrow('sem memória');
    expect(readActivity(file).at(-1)).toEqual({ at: 5000, kind: 'step-failed', step: 'final', text: 'render final falhou após 00:05: sem memória', durationSec: 5 });
  });
});
