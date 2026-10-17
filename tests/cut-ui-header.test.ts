import { describe, expect, it } from 'vitest';

import { activityChips, formatClock } from '../cut/src/lib/ui.ts';

describe('header do MChiodi Cut', () => {
  it('formata a duração de saída', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(59.6)).toBe('1:00');
    expect(formatClock(446.2)).toBe('7:26');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-3)).toBe('0:00');
  });

  it('mostra o job rodando com progresso e o Claude', () => {
    expect(activityChips({ job: null, progress: null, claudeRunning: false })).toEqual([]);
    expect(activityChips({ job: { kind: 'render', status: 'done' }, progress: { percent: 100 }, claudeRunning: false })).toEqual([]);
    expect(activityChips({ job: { kind: 'render', status: 'running' }, progress: null, claudeRunning: false })).toEqual([
      { id: 'job', label: 'render…', tone: 'peri', percent: null },
    ]);
    expect(activityChips({ job: { kind: 'export', status: 'running' }, progress: { percent: 41.6 }, claudeRunning: true })).toEqual([
      { id: 'job', label: 'export 42%', tone: 'peri', percent: 42 },
      { id: 'claude', label: 'Claude editando…', tone: 'coral', percent: null },
    ]);
  });

  it('limita o progresso a 0–100', () => {
    expect(activityChips({ job: { kind: 'eval', status: 'running' }, progress: { percent: 130 }, claudeRunning: false })[0]!.percent).toBe(100);
  });
});
