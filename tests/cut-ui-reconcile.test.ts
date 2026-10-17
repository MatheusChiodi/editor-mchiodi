import { describe, expect, it } from 'vitest';

import { conflictFromResponse, decideVersion, rebaseOutcome, settleDeferred, versionOrigin } from '../cut/src/lib/reconcile.ts';

describe('decideVersion', () => {
  it('versão conhecida é ignorada (inclusive a que o próprio editor salvou)', () => {
    expect(decideVersion({ base: 5, pendingOps: 0, saving: false }, 5)).toBe('ignore');
    expect(decideVersion({ base: 5, pendingOps: 3, saving: false }, 4)).toBe('ignore');
    expect(decideVersion({ base: 5, pendingOps: 0, saving: false }, null)).toBe('ignore');
  });

  it('sem edição local recarrega; com edição local vira conflito explícito', () => {
    expect(decideVersion({ base: 5, pendingOps: 0, saving: false }, 6)).toBe('reload');
    expect(decideVersion({ base: 5, pendingOps: 2, saving: false }, 6)).toBe('conflict');
    expect(decideVersion({ base: null, pendingOps: 0, saving: false }, 1)).toBe('reload');
  });

  it('durante o /save adia: a versão que ele grava chega pelo SSE antes da resposta', () => {
    expect(decideVersion({ base: 5, pendingOps: 2, saving: true }, 6)).toBe('defer');
    expect(settleDeferred([6], 6)).toBeNull();
    expect(settleDeferred([6, 7], 6)).toBe(7);
  });
});

describe('conflito do /save', () => {
  it('lê o corpo do 409', () => {
    const conflict = conflictFromResponse({ error: 'conflict', baseVersion: 4, currentVersion: 6, diff: ['clipes: 3 → 2'], since: [{ version: 5, notes: 'x' }] }, 4, 2);
    expect(conflict).toMatchObject({ origin: 'save', base: 4, current: 6, diff: ['clipes: 3 → 2'], pendingOps: 2 });
    expect(conflict!.since).toHaveLength(1);
    expect(conflictFromResponse({ error: 'outra coisa' }, 4, 1)).toBeNull();
  });

  it('reaplicar: tudo entra, ou aponta a operação que não cabe mais', () => {
    const ops = ['a', 'b', 'c'];
    expect(rebaseOutcome(ops, { ok: true })).toEqual({ ok: true, ops, dropped: null });
    const failed = rebaseOutcome(ops, { ok: false, opIndex: 1, error: 'clipe não existe' });
    expect(failed.ops).toEqual(['a', 'c']);
    expect(failed.dropped).toEqual({ index: 1, op: 'b', error: 'clipe não existe' });
    expect(rebaseOutcome(ops, { ok: false }).dropped).toBeNull();
  });

  it('origem pela nota', () => {
    expect(versionOrigin('Matheus: moveu corte')).toBe('Matheus');
    expect(versionOrigin('Direção completa')).toBe('Claude/terminal');
  });
});
