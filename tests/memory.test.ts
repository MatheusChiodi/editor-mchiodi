import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { addNote, appendNote, describeStatus, memoryTemplate, type ProjectStatus } from '../src/project/memory.ts';

const dir = mkdtempSync(join(tmpdir(), 'mce-memory-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('project.md', () => {
  it('o modelo tem as três seções', () => {
    const template = memoryTemplate('aula');
    expect(template).toContain('# Memória do projeto — aula');
    for (const heading of ['## Decisões de edição', '## Correções do Matheus', '## Pendências']) expect(template).toContain(heading);
  });

  it('a nota entra no fim da seção certa, datada e numa linha só', () => {
    let content = memoryTemplate('aula');
    content = addNote(content, 'correcao', 'zoom demais no gancho;\n reduzir', '2026-10-12');
    content = addNote(content, 'correcao', 'legenda sem destaque em coral', '2026-10-13');
    content = addNote(content, 'decisao', 'mantido o take 2 do gancho', '2026-10-12');
    const lines = content.split('\n');
    const corrections = lines.indexOf('## Correções do Matheus');
    expect(lines.slice(corrections, corrections + 4)).toEqual([
      '## Correções do Matheus',
      '',
      '- 2026-10-12: zoom demais no gancho; reduzir',
      '- 2026-10-13: legenda sem destaque em coral',
    ]);
    expect(lines.indexOf('- 2026-10-12: mantido o take 2 do gancho')).toBeLessThan(corrections);
    expect(lines.indexOf('## Pendências')).toBeGreaterThan(corrections + 3);
    expect(content.endsWith('\n')).toBe(true);
  });

  it('recria a seção se o arquivo foi editado à mão sem ela', () => {
    const content = addNote('# Notas soltas\n\ntexto livre\n', 'pendencia', 'trocar a trilha', '2026-10-12');
    expect(content).toBe('# Notas soltas\n\ntexto livre\n\n## Pendências\n\n- 2026-10-12: trocar a trilha\n');
  });

  it('appendNote cria o arquivo na primeira nota e acumula nas seguintes', () => {
    const file = join(dir, 'project.md');
    appendNote(file, 'aula', 'decisao', 'primeira', new Date('2026-10-12T10:00:00Z'));
    appendNote(file, 'aula', 'decisao', 'segunda', new Date('2026-10-13T10:00:00Z'));
    const content = readFileSync(file, 'utf8');
    expect(content).toContain('- 2026-10-12: primeira\n- 2026-10-13: segunda');
  });
});

describe('describeStatus', () => {
  const base: ProjectStatus = {
    slug: 'aula', analyzed: true, edlVersions: [], renders: [], lastEval: null, delivered: [], hasMemory: false,
  };
  const next = (status: Partial<ProjectStatus>) => describeStatus({ ...base, ...status }).split('\n').at(-1);

  it('aponta o próximo passo em cada estágio', () => {
    expect(next({ analyzed: false })).toBe('próximo passo: pnpm mce analyze <arquivo>');
    expect(next({})).toBe('próximo passo: pnpm mce draft aula');
    expect(next({ edlVersions: [1] })).toBe('próximo passo: pnpm mce render aula');
    expect(next({ edlVersions: [1], renders: ['v1-preview'] })).toBe('próximo passo: pnpm mce eval aula');
    const failed = { edlVersion: 2, passed: false, errors: 1, warnings: 3 };
    expect(next({ edlVersions: [1, 2], renders: ['v2-preview'], lastEval: failed })).toContain('corrigir a EDL');
    const passed = { ...failed, passed: true, errors: 0 };
    expect(next({ edlVersions: [1, 2], renders: ['v2-preview'], lastEval: passed })).toBe('próximo passo: pnpm mce render aula --final');
    expect(next({ edlVersions: [2], renders: ['v2-preview'], lastEval: passed, delivered: ['final.mp4'] })).toBe('próximo passo: pnpm mce report aula');
    expect(next({ edlVersions: [2], renders: ['v2-preview'], lastEval: passed, delivered: ['final.mp4', 'relatorio.md'] })).toContain('concluído');
  });

  it('avaliação de versão antiga não vale para a EDL nova', () => {
    const old = { edlVersion: 1, passed: true, errors: 0, warnings: 0 };
    expect(next({ edlVersions: [1, 2], renders: ['v1-preview', 'v2-preview'], lastEval: old })).toBe('próximo passo: pnpm mce eval aula');
  });

  it('sugere revisar no editor só quando há EDL', () => {
    const optional = 'opcional: revisar no editor: pnpm mce cut aula';
    expect(describeStatus(base)).not.toContain('mce cut');
    expect(describeStatus({ ...base, analyzed: false, edlVersions: [1] })).not.toContain('mce cut');
    expect(describeStatus({ ...base, edlVersions: [1] }).split('\n')).toContain(optional);
  });

  it('resume avaliação e memória', () => {
    const text = describeStatus({ ...base, edlVersions: [1], lastEval: { edlVersion: 1, passed: false, errors: 2, warnings: 5 }, hasMemory: true });
    expect(text).toContain('EDL v1 reprovada (2 erros, 5 avisos)');
    expect(text).toContain('leia antes de editar');
  });
});
