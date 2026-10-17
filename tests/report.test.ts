import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { collectEvaluations, type EvalReport } from '../src/eval/index.ts';
import { writeJson } from '../src/project/paths.ts';
import { buildChapters, buildReport, renderChapters } from '../src/report/index.ts';

const edl = edlSchema.parse({
  version: 2,
  project: 'aula-react',
  createdAt: '2026-10-12T03:00:00.000Z',
  notes: 'adicionados capítulos e lower third',
  source: { path: 'C:/v.mp4', durationSec: 300, fps: 60, width: 1920, height: 1080 },
  output: { fps: 30, width: 1920, height: 1080 },
  clips: [
    { id: 'c1', start: 5, end: 100 },
    { id: 'c2', start: 120, end: 290 },
  ],
  removed: [
    { start: 0, end: 5, kind: 'silence', reason: 'pausa de 5.00s encurtada' },
    { start: 100, end: 120, kind: 'retake', reason: 'P010 recomeça em P011: mantida a última versão' },
    { start: 290, end: 290.4, kind: 'silence', reason: 'pausa de 0.40s encurtada' },
  ],
  overlays: [{ id: 'nome', component: 'LowerThird', at: 8, duration: 5, reason: 'apresentação na primeira fala' }],
  zooms: [{ id: 'z1', at: 150, duration: 3, scale: 1.12, reason: 'conclusão do argumento' }],
  transitions: [{ id: 't1', intoClip: 'c2', type: 'wipe', reason: 'troca de capítulo' }],
  captions: { highlights: ['React'] },
  chapters: [
    { title: 'Gancho', at: 6 },
    { title: 'O que é reconciliação', at: 40 },
    { title: 'Na prática', at: 125 },
  ],
});
const timeline = buildTimeline(edl.clips, 30);

const evaluation: EvalReport = {
  edlVersion: 2,
  file: 'preview.mp4',
  createdAt: '2026-10-12T03:10:00.000Z',
  passed: false,
  metrics: { durationSec: 265, expectedSec: 265, loudnessLufs: -14.3, truePeakDb: -2, cuts: 1, captionOffsetMs: 20, wordsMatched: 500 },
  findings: [{ severity: 'warning', check: 'corte-em-som', at: 95, message: 'fala forte colada no corte', fix: 'afaste' }],
  views: [],
};

describe('buildChapters', () => {
  it('converte para o tempo final e força o primeiro em 0:00', () => {
    const { chapters, problems } = buildChapters(edl, timeline);
    expect(renderChapters(chapters)).toBe('0:00 Gancho\n0:35 O que é reconciliação\n1:40 Na prática\n');
    expect(problems).toEqual([]);
  });

  it('avisa capítulos colados e quantidade insuficiente', () => {
    const close = { chapters: [{ title: 'A', at: 6 }, { title: 'B', at: 12 }] };
    expect(buildChapters(close, timeline).problems).toHaveLength(2);
    expect(buildChapters({ chapters: [] }, timeline)).toEqual({ chapters: [], problems: [] });
    expect(renderChapters([])).toBe('');
  });
});

describe('buildReport', () => {
  const report = buildReport({ edl, timeline, history: [{ version: 1, notes: '', createdAt: '2026-10-12T02:00:00.000Z' }, edl], evaluations: [evaluation], renderedFile: 'output/aula-react/final.mp4' });

  it('resume duração e contagens', () => {
    expect(report).toContain('# Relatório de edição — aula-react');
    expect(report).toContain('05:00 → **04:25** (35s removidos, 12%)');
    expect(report).toContain('2 clipes · 1 gráficos · 1 zooms · 1 transições');
  });

  it('agrupa os cortes por tipo e lista só pausas longas e cortes de conteúdo', () => {
    expect(report).toContain('- pausas: 2 trechos, 5.4s');
    expect(report).toContain('- retakes e recomeços: 1 trechos, 20.0s');
    expect(report).toContain('| 01:40.00–02:00.00 | 20.0s | retakes e recomeços | P010 recomeça');
    expect(report).not.toContain('pausa de 0.40s');
  });

  it('lista cada adição com o instante no vídeo final e o motivo', () => {
    expect(report).toContain('**LowerThird** `nome` em 00:03.0 por 5.0s — apresentação na primeira fala');
    expect(report).toContain('**Zoom** 1.12× (ease) em 02:05.0 por 3.0s — conclusão do argumento');
    expect(report).toContain('**Transição** wipe em 01:35.0 — troca de capítulo');
  });

  it('inclui acabamento, capítulos, avaliação e histórico', () => {
    expect(report).toContain('destaques: React');
    expect(report).toContain('Áudio: alvo -14 LUFS');
    expect(report).toContain('0:35 O que é reconciliação');
    expect(report).toContain('### Volta 1 — EDL v2: reprovada');
    expect(report).toContain('aviso `corte-em-som`');
    expect(report).toContain('- v1 (2026-10-12 02:00): sem notas');
    expect(report).toContain('- v2 (2026-10-12 03:00): adicionados capítulos e lower third');
  });
});

describe('collectEvaluations', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mce-eval-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('lê as avaliações de todas as pastas de render em ordem cronológica', () => {
    expect(collectEvaluations(join(dir, 'nao-existe'))).toEqual([]);
    mkdirSync(join(dir, 'v1-preview'));
    mkdirSync(join(dir, 'v3-preview'));
    mkdirSync(join(dir, 'v2-preview'));
    writeJson(join(dir, 'v3-preview', 'eval.json'), { ...evaluation, edlVersion: 3, createdAt: '2026-10-12T05:00:00.000Z' });
    writeJson(join(dir, 'v1-preview', 'eval.json'), { ...evaluation, edlVersion: 1, createdAt: '2026-10-12T04:00:00.000Z' });
    expect(collectEvaluations(dir).map((item) => item.edlVersion)).toEqual([1, 3]);
  });
});
