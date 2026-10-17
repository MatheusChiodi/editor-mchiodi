import { describe, expect, it } from 'vitest';

import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { RETENTION_SECTION, replaceSection } from '../src/project/memory.ts';
import { buildReport } from '../src/report/index.ts';
import {
  aggregateLessons,
  analyzeRetention,
  averageRetention,
  buildEdlContext,
  describeMoment,
  detectDrops,
  detectSeparator,
  detectSpikes,
  dropHints,
  exposureBucket,
  graphicGapAt,
  memorySummary,
  normalizeCurve,
  parseLocaleNumber,
  parseRetentionCsv,
  pickDeliveredRender,
  type RetentionAnalysis,
  retentionAt,
  type RetentionPoint,
} from '../src/retention/index.ts';
import { script } from './helpers.ts';

/**
 * Fonte de 300 s → final de 265 s: c1 (fonte 5–100) vira 0–95 e c2 (fonte 120–290) vira 95–265.
 * Gráficos no final em 3–8 s e 175–185 s; capítulos em 0, 35 e 100 s.
 */
const edl = edlSchema.parse({
  version: 3,
  project: 'aula-react',
  createdAt: '2026-10-12T03:00:00.000Z',
  source: { path: 'C:/v.mp4', durationSec: 300, fps: 30, width: 1920, height: 1080 },
  output: { fps: 30, width: 1920, height: 1080 },
  clips: [
    { id: 'c1', start: 5, end: 100 },
    { id: 'c2', start: 120, end: 290 },
  ],
  overlays: [
    { id: 'nome', component: 'LowerThird', at: 8, duration: 5, reason: 'apresentação' },
    { id: 'codigo', component: 'CodeBlock', at: 200, duration: 10, reason: 'mostra o hook' },
  ],
  chapters: [
    { title: 'Gancho', at: 6 },
    { title: 'O que é reconciliação', at: 40 },
    { title: 'Na prática', at: 125 },
  ],
});
const timeline = buildTimeline(edl.clips, 30);
const words = [...script('então isso aqui é a parte chata', 123), ...script('olha o código', 200)];
const context = buildEdlContext(edl, timeline, { introSec: 0, outroSec: 0 }, words);
const DURATION = 265;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** abertura cai 20 p.p. em 30 s, miolo 5 p.p./min, queda de 12 p.p. em 101–106 s e rewatch de 3 p.p. em 175–180 s */
function curve(t: number): number {
  const base = t < 30 ? 1 - (0.2 * t) / 30 : 0.8 - ((t - 30) * 0.05) / 60;
  return base - 0.12 * clamp01((t - 101) / 5) + 0.03 * clamp01((t - 175) / 5);
}
/** CSV no formato do Studio em inglês: 101 linhas, posição em % do vídeo */
const enCsv = [
  'Video position (%),Absolute audience retention (%),Relative audience retention (%)',
  ...Array.from({ length: 101 }, (_, i) => `${i},${(curve((i / 100) * DURATION) * 100).toFixed(2)},50`),
].join('\n');
const points = normalizeCurve(parseRetentionCsv(enCsv), DURATION);

function analysis(slug: string): RetentionAnalysis {
  return analyzeRetention({ slug, sourceFile: 'r.csv', edlVersion: 3, axis: 'percent', points, context, importedAt: '2026-10-17T12:00:00.000Z' });
}

describe('parseLocaleNumber', () => {
  it('lê decimal com ponto ou vírgula, milhar, % e m:ss', () => {
    expect(parseLocaleNumber('12.5')).toBe(12.5);
    expect(parseLocaleNumber('12,5')).toBe(12.5);
    expect(parseLocaleNumber('1.234,5')).toBe(1234.5);
    expect(parseLocaleNumber('1,234.5')).toBe(1234.5);
    expect(parseLocaleNumber(' 85,3 %')).toBe(85.3);
    expect(parseLocaleNumber('1:23')).toBe(83);
    expect(parseLocaleNumber('1:02:03')).toBe(3723);
    expect(parseLocaleNumber('Total')).toBeNull();
    expect(parseLocaleNumber('')).toBeNull();
  });

  it('detecta o separador pelo cabeçalho, ignorando o que está entre aspas', () => {
    expect(detectSeparator('a;b;"c,d"')).toBe(';');
    expect(detectSeparator('a,b')).toBe(',');
    expect(detectSeparator('a\tb')).toBe('\t');
  });
});

describe('parseRetentionCsv', () => {
  it('EN: posição em % e retenção absoluta em %, ignorando a relativa', () => {
    const parsed = parseRetentionCsv('Video position (%),Relative audience retention (%),Absolute audience retention (%)\n0,50,100\n50,49,62.5\n100,48,30\n');
    expect(parsed.axis).toBe('percent');
    expect(parsed.columns.retention).toBe('Absolute audience retention (%)');
    expect(parsed.points).toEqual([
      { position: 0, retention: 1 },
      { position: 0.5, retention: 0.625 },
      { position: 1, retention: 0.3 },
    ]);
  });

  it('PT: separador ;, decimal vírgula, BOM, aspas e linha de total', () => {
    const csv = '﻿"Posição no vídeo (%)";"Retenção absoluta do público (%)"\r\n0;"100,0"\r\n25;"71,5"\r\n100;"28,25"\r\nTotal;\r\n';
    const parsed = parseRetentionCsv(csv);
    expect(parsed.axis).toBe('percent');
    expect(parsed.points.map((point) => point.retention)).toEqual([1, 0.715, 0.2825]);
    expect(parsed.points.map((point) => point.position)).toEqual([0, 0.25, 1]);
  });

  it('tempo em segundos ou m:ss vira eixo de segundos; retenção em fração fica como está', () => {
    const seconds = parseRetentionCsv('Tempo (segundos),Retenção do público\n0,1\n30,0.8\n90,0.55');
    expect(seconds.axis).toBe('seconds');
    expect(seconds.points).toEqual([
      { position: 0, retention: 1 },
      { position: 30, retention: 0.8 },
      { position: 90, retention: 0.55 },
    ]);
    const clock = parseRetentionCsv('Video position,Audience retention (%)\n0:00,100\n1:30,55');
    expect(clock.axis).toBe('seconds');
    expect(clock.points[1]).toEqual({ position: 90, retention: 0.55 });
  });

  it('posição em fração 0–1 com cabeçalho em % também funciona', () => {
    const parsed = parseRetentionCsv('Video position (%),Absolute audience retention (%)\n0,100\n0.5,60\n1,30');
    expect(parsed.points.map((point) => point.position)).toEqual([0, 0.5, 1]);
  });

  it('erra claro quando não reconhece as colunas ou faltam pontos', () => {
    expect(() => parseRetentionCsv('foo,bar\n1,2')).toThrow(/colunas de retenção/);
    expect(() => parseRetentionCsv('Video position (%),Absolute audience retention (%)\n0,100')).toThrow(/2 pontos/);
  });
});

describe('normalizeCurve e métricas', () => {
  it('converte % em segundos de saída e ordena; segundos passam do fim ficam no fim', () => {
    expect(normalizeCurve({ axis: 'percent', columns: { position: '', retention: '' }, points: [{ position: 1, retention: 0.3 }, { position: 0, retention: 1 }] }, 200)).toEqual([
      { at: 0, retention: 1 },
      { at: 200, retention: 0.3 },
    ]);
    expect(normalizeCurve({ axis: 'seconds', columns: { position: '', retention: '' }, points: [{ position: 250, retention: 0.2 }] }, 200)).toEqual([{ at: 200, retention: 0.2 }]);
  });

  it('média ponderada pelo tempo e interpolação', () => {
    const line: RetentionPoint[] = [
      { at: 0, retention: 1 },
      { at: 10, retention: 0.5 },
      { at: 30, retention: 0.5 },
    ];
    expect(averageRetention(line)).toBeCloseTo((7.5 + 10) / 30, 6);
    expect(retentionAt(line, 5)).toBeCloseTo(0.75, 6);
    expect(retentionAt(line, 99)).toBe(0.5);
  });
});

describe('detecção de quedas e picos', () => {
  it('acha a queda brusca do miolo e a da abertura, não o declínio natural', () => {
    const drops = detectDrops(points);
    expect(drops).toHaveLength(2);
    const [intro, middle] = drops;
    expect(intro!.start).toBe(0);
    expect(middle!.start).toBeGreaterThan(98);
    expect(middle!.start).toBeLessThanOrEqual(101);
    expect(middle!.end).toBeGreaterThanOrEqual(106);
    expect(middle!.amount).toBeGreaterThan(0.11);
    expect(middle!.amount).toBeLessThan(0.14);
  });

  it('acha o rewatch', () => {
    const spikes = detectSpikes(points);
    expect(spikes).toHaveLength(1);
    expect(spikes[0]!.start).toBeGreaterThan(172);
    expect(spikes[0]!.end).toBeLessThan(183);
  });

  it('curva só com declínio suave não tem queda', () => {
    const smooth = Array.from({ length: 50 }, (_, i) => ({ at: i * 6, retention: 0.8 - i * 0.004 }));
    expect(detectDrops(smooth)).toEqual([]);
  });
});

describe('mapeamento para a EDL', () => {
  it('liga o tempo de saída ao segundo da fonte, clipe, capítulo, gráfico e fala', () => {
    const moment = describeMoment(context, 100.7, 106);
    expect(moment.region).toBe('main');
    expect(moment.sourceAt).toBeCloseTo(125.7, 3);
    expect(moment.clip?.id).toBe('c2');
    expect(moment.chapter).toBe('Na prática');
    expect(moment.chapterOffsetSec).toBeCloseTo(0.7, 3);
    expect(moment.sinceCutSec).toBeCloseTo(5.7, 3);
    expect(moment.overlays).toEqual([]);
    expect(moment.graphicGapSec).toBeCloseTo(92.7, 1);
    expect(moment.text).toContain('parte chata');
    expect(moment.text).not.toContain('código');
  });

  it('gráfico na tela zera a distância e aparece no contexto', () => {
    expect(graphicGapAt(context, 180)).toBe(0);
    expect(describeMoment(context, 176, 180).overlays).toEqual(['CodeBlock#codigo']);
    expect(exposureBucket(0)).toBe('grafico');
    expect(exposureBucket(10)).toBe('curto');
    expect(exposureBucket(45)).toBe('medio');
    expect(exposureBucket(90)).toBe('longo');
  });

  it('muito tempo desde o último corte vira dica', () => {
    const moment = describeMoment(context, 80, 84);
    expect(moment.sinceCutSec).toBe(80);
    expect(dropHints(moment, { start: 80, end: 84 }, DURATION)).toContain('clipe-longo');
  });

  it('vinheta de abertura desloca tudo e não tem fonte', () => {
    const bumped = buildEdlContext(edl, timeline, { introSec: 4, outroSec: 3 }, words);
    expect(bumped.durationSec).toBe(272);
    expect(describeMoment(bumped, 2, 3).region).toBe('intro');
    expect(describeMoment(bumped, 2, 3).sourceAt).toBeNull();
    expect(describeMoment(bumped, 104.7, 110).sourceAt).toBeCloseTo(125.7, 3);
    expect(describeMoment(bumped, 270, 272).region).toBe('outro');
  });
});

describe('analyzeRetention', () => {
  const result = analysis('aula-react');

  it('resume a curva e explica cada queda com uma lição', () => {
    expect(result.summary.at30).toBeCloseTo(0.8, 2);
    expect(result.summary.typicalPerMin).toBeCloseTo(-5, 0);
    expect(result.firstGraphicAt).toBe(3);
    const middle = result.drops[1]!;
    expect(middle.hints).toEqual(['sem-grafico', 'troca-de-capitulo']);
    expect(middle.lesson).toMatch(/^queda de 12 p\.p\. em 01:4\d \(capítulo "Na prática"\): .*explicação longa sem gráfico \(9\d s\)/);
    expect(middle.lesson).toContain('parte chata');
    expect(result.drops[0]!.hints).toContain('abertura');
    // lições da maior para a menor queda
    expect(result.lessons[0]).toMatch(/^queda de 20 p\.p\./);
  });

  it('separa a perda por faixa de "segundos sem gráfico", fora da abertura e do fim', () => {
    const total = Object.values(result.exposure).reduce((sum, bucket) => sum + bucket.sec, 0);
    expect(total).toBeGreaterThan(200);
    expect(total).toBeLessThan(DURATION * 0.9 - 25);
    expect(result.exposure.longo.loss).toBeGreaterThan(0.12);
    expect(result.exposure.grafico.loss).toBeLessThan(0);
  });

  it('resumo para o project.md traz as lições e o rewatch', () => {
    const summary = memorySummary(result);
    expect(summary[0]).toMatch(/^- 2026-10-17: retenção média \d+%, aos 30 s 80%/);
    expect(summary.some((line) => line.startsWith('- lição: queda de 12 p.p.'))).toBe(true);
    expect(summary.some((line) => line.includes('rewatch') && line.includes('CodeBlock#codigo'))).toBe(true);
  });

  it('entra no relatório como seção "Retenção"', () => {
    const report = buildReport({ edl, timeline, history: [edl], evaluations: [], renderedFile: null, retention: result });
    expect(report).toContain('## Retenção');
    expect(report).toMatch(/\| 01:4\d–01:4\d \| 02:05\.\d \| 12\.\d p\.p\. \| `c2` \| Na prática \|/);
    expect(report.indexOf('## Retenção')).toBeLessThan(report.indexOf('## Autoavaliação'));
    expect(buildReport({ edl, timeline, history: [edl], evaluations: [], renderedFile: null })).not.toContain('## Retenção');
  });
});

describe('aggregateLessons', () => {
  it('sem dados, diz como importar', () => {
    expect(aggregateLessons([])).toMatch(/retention import/);
  });

  it('agrega padrões dos projetos', () => {
    const text = aggregateLessons([analysis('a'), analysis('b')]);
    expect(text).toContain('2 vídeo(s): a, b');
    expect(text).toMatch(/aos 30 s 80%/);
    expect(text).toMatch(/sem gráfico há > 60 s: [\d.]+ p\.p\.\/min/);
    expect(text).toMatch(/trechos sem gráfico há mais de 30 s perdem [\d.]+× mais público por minuto/);
    expect(text).toMatch(/explicação longa sem gráfico: 2×/);
    expect(text).toMatch(/\[a\] queda de 20 p\.p\./);
    expect(text).toMatch(/Picos de rewatch: 2; gráficos na tela: CodeBlock \(2×\)/);
  });
});

describe('replaceSection', () => {
  const base = '# Memória\n\n## Decisões de edição\n\n- 2026-10-01: x\n\n## Pendências\n';

  it('cria a seção no fim e depois a substitui sem acumular', () => {
    const once = replaceSection(base, RETENTION_SECTION, ['- a']);
    expect(once).toBe(`${base}\n${RETENTION_SECTION}\n\n- a\n`);
    const twice = replaceSection(once, RETENTION_SECTION, ['- b']);
    expect(twice).toBe(`${base}\n${RETENTION_SECTION}\n\n- b\n`);
  });

  it('substitui uma seção do meio preservando as vizinhas', () => {
    const next = replaceSection(base, '## Decisões de edição', ['- nova']);
    expect(next).toBe('# Memória\n\n## Decisões de edição\n\n- nova\n\n## Pendências\n');
  });
});

describe('pickDeliveredRender', () => {
  it('escolhe o final mais recente, não o maior número', () => {
    expect(pickDeliveredRender([{ dir: 'v4-final', mtimeMs: 10 }, { dir: 'v5-preview', mtimeMs: 30 }, { dir: 'v3-final', mtimeMs: 20 }])).toBe(3);
    expect(pickDeliveredRender([{ dir: 'v2-preview', mtimeMs: 1 }])).toBeNull();
  });
});
