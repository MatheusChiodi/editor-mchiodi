import { describe, expect, it } from 'vitest';

import { formatLevels, LEVELS } from '../src/edl/levels.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { editedCoverage, formatCoverage, levelCoverage, lintStyle } from '../src/eval/checks.ts';

/** Vídeo de 200s sem cortes, com uma pílula de 4s a cada `every` segundos entre `from` e `to`. */
function edlWith(spans: [number, number][], every = 5, level = 'max') {
  const overlays = spans.flatMap(([from, to], span) =>
    Array.from({ length: Math.floor((to - from) / every) }, (_, index) => ({
      id: `p${span}-${index}`,
      component: 'PillStack',
      at: from + index * every,
      duration: 4,
      reason: 'resume a ideia',
      props: { items: [{ text: 'ideia', at: 0.2 }] },
    })),
  );
  return edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-12T00:00:00.000Z',
    level,
    source: { path: 'C:/v.mp4', durationSec: 200, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [{ id: 'c1', start: 0, end: 200 }],
    overlays,
  });
}

const lint = (edl: ReturnType<typeof edlWith>) => lintStyle(edl, buildTimeline(edl.clips, 30));
const only = (edl: ReturnType<typeof edlWith>, check: string) => lint(edl).filter((finding) => finding.check === check);

describe('editedCoverage', () => {
  it('trecho sem edição é todo intervalo acima do teto sem evento', () => {
    const coverage = editedCoverage([2, 6, 10, 40, 44, 90], 100, 8);
    expect(coverage.plain).toEqual([{ from: 10, to: 40 }, { from: 44, to: 90 }, { from: 90, to: 100 }]);
    expect(coverage.plainSec).toBe(86);
    expect(coverage.share).toBeCloseTo(0.14, 5);
  });

  it('vídeo com evento a cada poucos segundos está 100% editado; vídeo sem nada, 0%', () => {
    const dense = editedCoverage(Array.from({ length: 50 }, (_, index) => index * 4), 200, 8);
    expect(dense).toMatchObject({ share: 1, plain: [], plainSec: 0 });
    expect(editedCoverage([], 200, 8).share).toBe(0);
    expect(editedCoverage([], 0, 8).share).toBe(1);
  });
});

describe('cobertura no nível max', () => {
  it('só o max cobra: 80% editado e respiro de até 40s', () => {
    expect(LEVELS.max.limits).toMatchObject({ maxIdleSec: 8, minEditedShare: 0.8, maxPlainSec: 40 });
    for (const level of ['limpa', 'normal', 'pro'] as const) {
      expect(LEVELS[level].limits.minEditedShare).toBeNull();
      expect(LEVELS[level].limits.maxPlainSec).toBeNull();
      expect(levelCoverage(edlWith([[0, 200]], 5, level), buildTimeline([{ id: 'c1', start: 0, end: 200 }], 30), LEVELS[level])).toBeNull();
    }
    expect(formatLevels('max')).toContain('cobertura: pelo menos 80% do vídeo editado; cada trecho sem edição com até 40s');
    expect(formatLevels('pro')).not.toContain('cobertura:');
    expect(LEVELS.max.guidance.join(' ')).toContain('80% do vídeo');
  });

  it('editado de ponta a ponta: nem pouco-editado nem tela-parada', () => {
    const edl = edlWith([[0, 200]]);
    expect(only(edl, 'pouco-editado')).toEqual([]);
    expect(only(edl, 'tela-parada')).toEqual([]);
  });

  it('dois respiros curtos (15% do vídeo) passam: é o apresentador falando sozinho', () => {
    // sem edição em 60–75 e 150–165: 30s de 200s
    const edl = edlWith([[0, 60], [75, 150], [165, 200]]);
    const coverage = levelCoverage(edl, buildTimeline(edl.clips, 30), LEVELS.max)!;
    expect(coverage.plain).toHaveLength(2);
    expect(coverage.share).toBeGreaterThanOrEqual(0.8);
    expect(only(edl, 'pouco-editado')).toEqual([]);
    expect(only(edl, 'tela-parada')).toEqual([]);
  });

  it('só o começo editado, como na referência: pouco-editado e tela-parada', () => {
    const edl = edlWith([[0, 55]]);
    const [share] = only(edl, 'pouco-editado');
    expect(share).toBeDefined();
    expect(share!.message).toMatch(/^2\d% do vídeo editado \(mínimo 80%\) · 1 trecho sem edição/);
    expect(share!.message).toContain('maiores: 00:54–03:20');
    expect(share!.fix).toMatch(/^edite mais 1\d\ds/);
    const idle = only(edl, 'tela-parada');
    expect(idle).toHaveLength(1);
    expect(idle[0]!.message).toContain('um trecho sem edição pode ter até 40s');
  });

  it('muitos respiros curtos somando mais de 20%: pouco-editado sem tela-parada', () => {
    // 5 respiros de 15s = 75s de 200s
    const edl = edlWith([[0, 20], [35, 60], [75, 100], [115, 140], [155, 180], [195, 200]]);
    expect(only(edl, 'pouco-editado')).toHaveLength(1);
    expect(only(edl, 'tela-parada')).toEqual([]);
  });

  it('um respiro longo demais avisa mesmo com 80% editado', () => {
    // 45s sem edição = 22,5%... usa 200s com respiro de 41s e o resto denso: 79,5% → os dois avisos; com vídeo maior só o teto
    const edl = edlWith([[0, 100], [141, 200]]);
    const idle = only(edl, 'tela-parada');
    expect(idle).toHaveLength(1);
    expect(idle[0]!.at).toBeGreaterThan(95);
  });

  it('formatCoverage resume a conta para o mce level', () => {
    const full = edlWith([[0, 200]]);
    expect(formatCoverage(levelCoverage(full, buildTimeline(full.clips, 30), LEVELS.max)!, LEVELS.max)).toBe('100% do vídeo editado (mínimo 80%) · nenhum trecho sem edição');
    const partial = edlWith([[0, 60], [75, 150], [165, 200]]);
    expect(formatCoverage(levelCoverage(partial, buildTimeline(partial.clips, 30), LEVELS.max)!, LEVELS.max)).toMatch(/^8\d% do vídeo editado \(mínimo 80%\) · 2 trechos sem edição somando 00:\d\d, o maior com 1\ds$/);
  });
});
