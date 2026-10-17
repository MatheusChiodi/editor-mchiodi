import { describe, expect, it } from 'vitest';

import { jobOutputRel, srtSidecarRel } from '../src/cut/jobs.ts';
import type { ProjectPaths } from '../src/project/paths.ts';
import { outputNames, renderDir } from '../src/render/index.ts';
import { baseEdl } from './cut-fixture.ts';

describe('jobOutputRel', () => {
  it('aponta para o vídeo que o mce render deixa em renders/v<N>-<modo>/', () => {
    expect(jobOutputRel('render', 4)).toBe('renders/v4-preview/preview.mp4');
    expect(jobOutputRel('final', 4)).toBe('renders/v4-final/final.mp4');
    expect(jobOutputRel('shorts', 7)).toBe('renders/v7-shorts-final/shorts-final.mp4');
  });

  it('mesma convenção do render (renderDir + outputNames)', () => {
    const paths = { rendersDir: 'renders' } as ProjectPaths;
    const edl = { ...baseEdl(), version: 4 };
    const expected = (mode: 'preview' | 'final', variant: 'main' | 'shorts') =>
      `${renderDir(paths, edl, mode, variant).replace(/\\/g, '/')}/${outputNames(mode, variant).file}`;
    expect(jobOutputRel('render', 4)).toBe(expected('preview', 'main'));
    expect(jobOutputRel('final', 4)).toBe(expected('final', 'main'));
    expect(jobOutputRel('shorts', 4)).toBe(expected('final', 'shorts'));
  });

  it('avaliação e export não têm vídeo próprio aqui (o export sai de planExport)', () => {
    expect(jobOutputRel('eval', 4)).toBeNull();
    expect(jobOutputRel('evalFinal', 4)).toBeNull();
    expect(jobOutputRel('export', 4)).toBeNull();
  });
});

describe('srtSidecarRel', () => {
  it('ao lado do vídeo mais acabado da versão, com o mesmo nome-base', () => {
    const has = (...files: string[]) => (relative: string) => files.includes(relative);
    expect(srtSidecarRel('aula', 4, has('renders/v4-preview/preview.mp4', 'renders/v4-final/final.mp4'))).toBe('renders/v4-final/final.srt');
    expect(srtSidecarRel('aula', 4, has('renders/v4-preview/preview.mp4', 'renders/v3-final/final.mp4'))).toBe('renders/v4-preview/preview.srt');
  });

  it('sem render da versão, em renders/ como o mce export', () => {
    expect(srtSidecarRel('aula', 5, () => false)).toBe('renders/aula-v5.srt');
  });
});
