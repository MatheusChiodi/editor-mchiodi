import { describe, expect, it } from 'vitest';

import { buildTimeline } from '../src/edl/timeline.ts';
import {
  bottomBandOwner,
  classifyJump,
  clipEdges,
  edgeGaps,
  findCaptionOverGraphic,
  findTightEdges,
  frameDiff,
  judgeJoins,
  judgeJumps,
  jumpScore,
  type JumpContext,
  type JumpCut,
  measureJoins,
  overlapSec,
  type PlacedOverlay,
  rankDecisionPoints,
} from '../src/eval/edges.ts';
import { contactSheetSvg, cutFrames, rowTop, scaledSize, sheetLayout, tileLeft } from '../src/eval/visual.ts';
import type { Finding } from '../src/eval/checks.ts';

const words = [
  { text: 'um', start: 1.0, end: 1.3 },
  { text: 'dois', start: 1.5, end: 1.8 },
  { text: 'tres', start: 2.0, end: 2.3 },
  { text: 'quatro', start: 2.4, end: 2.8 },
];

describe('clipEdges', () => {
  it('ignora a junção em que a fonte continua, e mantém as bordas do começo e do fim', () => {
    const timeline = buildTimeline([{ id: 'a', start: 0, end: 1 }, { id: 'b', start: 1, end: 2 }, { id: 'c', start: 3, end: 4 }], 30);
    expect(clipEdges(timeline).map((edge) => `${edge.clip.id}:${edge.side}`)).toEqual(['a:início', 'b:fim', 'c:início', 'c:fim']);
  });
});

describe('respiro na borda', () => {
  it('borda colada no ataque da palavra vira aviso com o tempo de saída e a correção', () => {
    const timeline = buildTimeline([{ id: 'c1', start: 0.9, end: 1.9 }, { id: 'c2', start: 2.4, end: 3.2 }], 30);
    const findings = findTightEdges(timeline, words);
    const tight = findings.find((finding) => finding.message.includes('c2'))!;
    expect(tight.check).toBe('sem-respiro');
    expect(tight.at).toBeCloseTo(timeline.clips[1]!.outputStart, 3);
    expect(tight.message).toContain('"quatro"');
    expect(tight.fix).toContain('clips[c2].start');
  });

  it('respiro folgado passa; borda dentro de palavra fica para o corte-em-palavra', () => {
    const roomy = buildTimeline([{ id: 'c1', start: 0.9, end: 1.4 }], 30);
    expect(findTightEdges(roomy, words.slice(0, 1))).toEqual([]);
    const inside = buildTimeline([{ id: 'c1', start: 0.9, end: 1.633 }], 30);
    expect(findTightEdges(inside, words).filter((finding) => finding.message.includes('dois'))).toEqual([]);
  });

  it('palavra cortada logo antes do início vaza; palavra do clipe vizinho não conta', () => {
    // "tres" (2.0–2.3) sai; o clipe começa 20 ms depois do fim dela
    const leak = buildTimeline([{ id: 'c1', start: 0.9, end: 1.9 }, { id: 'c2', start: 2.32, end: 3.2 }], 50);
    const outer = edgeGaps(leak, words).find((gap) => gap.role === 'fora' && gap.edge.clip.id === 'c2')!;
    expect(outer.word.text).toBe('tres');
    expect(findTightEdges(leak, words).some((finding) => finding.message.includes('"tres" (cortada)'))).toBe(true);
    // colada dos dois lados: um aviso só, dizendo que não há pausa para a borda
    const both = findTightEdges(leak, [...words.slice(0, 3), { text: 'x', start: 2.34, end: 2.6 }]).filter((finding) => finding.message.includes('c2'));
    expect(both).toHaveLength(1);
    expect(both[0]!.message).toMatch(/"x" e .*"tres" \(cortada\)/);
    expect(both[0]!.fix).toContain('coladas');
    const kept = buildTimeline([{ id: 'c1', start: 0.9, end: 2.31 }, { id: 'c2', start: 2.34, end: 3.2 }], 50);
    expect(edgeGaps(kept, words).filter((gap) => gap.role === 'fora')).toEqual([]);
  });
});

describe('áudio na junção', () => {
  const RATE = 1000;
  const signal = (parts: [number, number | ((index: number) => number)][]) => {
    const total = parts.reduce((sum, [length]) => sum + length, 0);
    const samples = new Float32Array(total);
    let cursor = 0;
    for (const [length, value] of parts) {
      for (let index = 0; index < length; index += 1) samples[cursor + index] = typeof value === 'number' ? value : value(index);
      cursor += length;
    }
    return samples;
  };
  // ruído determinístico em ±amp
  const noise = (amp: number) => (index: number) => amp * Math.sin(index * 12.9898) * ((index * 7) % 3 === 0 ? 1 : -0.8);

  it('fundo de sala que pula entre duas pausas vira salto-de-nivel', () => {
    const samples = signal([[1000, noise(0.01)], [1000, noise(0.08)]]);
    const [join] = measureJoins(samples, RATE, [1], 1);
    expect(join!.after / join!.before).toBeGreaterThan(5);
    const findings = judgeJoins([join!]);
    expect(findings.map((finding) => finding.check)).toEqual(['salto-de-nivel']);
    expect(findings[0]!.message).toContain('fundo de sala sobe');
  });

  it('fala de um lado e pausa do outro é natural; volume de fala que muda é aviso', () => {
    const natural = measureJoins(signal([[1000, noise(0.8)], [1000, noise(0.01)]]), RATE, [1], 1);
    expect(judgeJoins(natural)).toEqual([]);
    const retake = measureJoins(signal([[1000, noise(2)], [1000, noise(0.7)]]), RATE, [1], 1);
    expect(judgeJoins(retake)[0]!.message).toContain('volume da fala cai');
  });

  it('degrau de amostra no corte é clique, a não ser que já tenha virado estalo', () => {
    const samples = signal([[1000, 0.01], [1000, 0.3]]);
    const joins = measureJoins(samples, RATE, [1], 1);
    expect(judgeJoins(joins).some((finding) => finding.check === 'clique')).toBe(true);
    expect(judgeJoins(joins, [1]).some((finding) => finding.check === 'clique')).toBe(false);
    const smooth = measureJoins(signal([[2000, (index) => 0.3 * Math.sin(index / 20)]]), RATE, [1], 1);
    expect(judgeJoins(smooth).some((finding) => finding.check === 'clique')).toBe(false);
  });
});

describe('jump cut', () => {
  const W = 40;
  const H = 30;
  const pattern = (dx: number, dy: number) => {
    const frame = new Uint8Array(W * H);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) frame[y * W + x] = ((x + dx) * 37 + (y + dy) * 91) % 255;
    return frame;
  };

  it('frameDiff mede o salto bruto e o deslocamento que o explica', () => {
    expect(frameDiff(pattern(0, 0), pattern(0, 0), W, H).raw).toBe(0);
    const moved = frameDiff(pattern(0, 0), pattern(2, -1), W, H);
    expect(moved.raw).toBeGreaterThan(10);
    expect(moved.aligned).toBe(0);
    expect(moved.shift).toEqual({ dx: -2, dy: 1 });
    expect(() => frameDiff(new Uint8Array(3), pattern(0, 0), W, H)).toThrow();
  });

  it('classifica invisível, jump e troca de plano; nota zero fora do jump', () => {
    expect(classifyJump({ raw: 1 })).toBe('invisivel');
    expect(classifyJump({ raw: 10 })).toBe('jump');
    expect(classifyJump({ raw: 60 })).toBe('troca');
    const displaced = jumpScore({ raw: 10, aligned: 0, shift: { dx: 1, dy: 0 } });
    expect(displaced).toBeGreaterThan(jumpScore({ raw: 10, aligned: 10, shift: { dx: 0, dy: 0 } }));
    expect(jumpScore({ raw: 60, aligned: 0, shift: { dx: 0, dy: 0 } })).toBe(0);
  });

  const timeline = buildTimeline([{ id: 'a', start: 0, end: 10 }, { id: 'b', start: 12, end: 20 }, { id: 'c', start: 22, end: 30 }, { id: 'd', start: 32, end: 40 }], 30);
  const cut = (index: number, raw: number): JumpCut => ({
    at: timeline.clips[index]!.outputStart,
    clip: timeline.clips[index]!,
    diff: { raw, aligned: raw / 4, shift: { dx: 1, dy: 0 } },
  });
  const context = (patch: Partial<JumpContext> = {}): JumpContext => ({ level: 'pro', zoomMinGapSec: 10, zoomsAt: [], transitionInto: new Set(), ...patch });

  it('avisa jump cut descoberto e sugere zoom punch ou transição dentro do nível', () => {
    const findings = judgeJumps([cut(1, 8), cut(2, 60), cut(3, 1)], context());
    expect(findings).toHaveLength(1);
    expect(findings[0]!.check).toBe('jump-cut');
    expect(findings[0]!.fix).toContain('"mode": "punch"');
    expect(findings[0]!.fix).toContain('cross-dissolve');
  });

  it('não cobra o que já tem transição ou zoom, respeita o espaçamento de zoom e o nível limpa', () => {
    expect(judgeJumps([cut(1, 8)], context({ transitionInto: new Set(['b']) }))).toEqual([]);
    expect(judgeJumps([cut(1, 8)], context({ zoomsAt: [10.1] }))).toEqual([]);
    const crowded = judgeJumps([cut(2, 8)], context({ zoomsAt: [15] }));
    expect(crowded[0]!.fix).toMatch(/^transição calm/);
    expect(crowded[0]!.fix).not.toContain('punch');
    expect(judgeJumps([cut(1, 8)], context({ level: 'limpa' }))[0]!.fix).toContain('aceito');
    expect(judgeJumps([cut(1, 8)], context({ level: 'normal' }))[0]!.fix).not.toContain('cross-dissolve');
  });

  it('só os piores viram aviso; o resto entra num resumo', () => {
    const findings = judgeJumps([cut(1, 8), cut(2, 9), cut(3, 10)], context(), 2);
    expect(findings).toHaveLength(3);
    expect(findings[2]!.at).toBeNull();
    expect(findings[2]!.message).toContain('mais 1');
  });
});

describe('legenda sobre gráfico', () => {
  const overlay = (patch: Partial<PlacedOverlay>): PlacedOverlay => ({
    id: 'g', component: 'LowerThird', props: {}, hidesCaptions: false, presenter: null, layer: 'base', out: 10, duration: 4, ...patch,
  });

  it('sabe quem ocupa a faixa inferior pela tabela e pela posição declarada', () => {
    expect(bottomBandOwner({ component: 'LowerThird', props: {} })).toContain('lower third');
    expect(bottomBandOwner({ component: 'TextReveal', props: { position: 'bottom' } })).not.toBeNull();
    expect(bottomBandOwner({ component: 'TextReveal', props: { position: 'top' } })).toBeNull();
    expect(bottomBandOwner({ component: 'TechBadge', props: { corner: 'bottom-left' } })).toBeNull();
  });

  it('soma interseções sem contar duas vezes o que se sobrepõe', () => {
    expect(overlapSec(0, 10, [{ start: 1, end: 3 }, { start: 2, end: 4 }, { start: 9, end: 12 }])).toBeCloseTo(4);
  });

  it('acusa gráfico na base com legenda visível e respeita hidesCaptions de qualquer overlay', () => {
    const captions = [{ start: 10.5, end: 12 }, { start: 12, end: 13.5 }];
    const findings = findCaptionOverGraphic([overlay({})], captions);
    expect(findings.map((finding) => finding.check)).toEqual(['legenda-sobre-grafico']);
    expect(findings[0]!.at).toBe(10);
    expect(findCaptionOverGraphic([overlay({ hidesCaptions: true })], captions)).toEqual([]);
    const hider = overlay({ id: 'palco', component: 'SplitExplainer', hidesCaptions: true, out: 9, duration: 6 });
    expect(findCaptionOverGraphic([overlay({}), hider], captions)).toEqual([]);
    expect(findCaptionOverGraphic([overlay({})], [{ start: 13.9, end: 14.5 }])).toEqual([]);
  });
});

describe('pontos de decisão e prancha', () => {
  const finding = (check: string, at: number): Finding => ({ severity: 'warning', check, at, message: '', fix: '' });

  it('ranqueia por peso dos achados no corte e pelo salto visual, sem cortes limpos', () => {
    const points = rankDecisionPoints(
      [5, 10, 15, 20],
      [finding('sem-respiro', 10.02), finding('estalo', 15), finding('jump-cut', 15), finding('grafico-curto', 20)],
      new Map([[5, 0.5]]),
      3,
    );
    expect(points.map((point) => point.at)).toEqual([15, 10, 5]);
    expect(points[0]!.checks).toEqual(['estalo', 'jump-cut']);
    expect(rankDecisionPoints([5], [], new Map(), 3)).toEqual([]);
  });

  it('geometria e camada de texto da prancha', () => {
    expect(scaledSize(1920, 1080, 160)).toEqual({ width: 160, height: 90 });
    expect(cutFrames(2, 30)).toEqual({ before: 59, after: 60 });
    const layout = sheetLayout(2, { width: 1920, height: 1080 });
    expect(layout.tile).toEqual({ width: 480, height: 270 });
    expect(tileLeft(layout, 'after') - tileLeft(layout, 'before')).toBe(480 + layout.gap);
    expect(rowTop(layout, 1) - rowTop(layout, 0)).toBe(270 + layout.gap);
    expect(layout.height).toBe(rowTop(layout, 2));
    expect(sheetLayout(1, { width: 1080, height: 1920 }).tile.height).toBe(360);
    const svg = contactSheetSvg('a < b', [{ at: 65, score: 1.2, checks: ['estalo'] }], sheetLayout(1, { width: 1920, height: 1080 }));
    expect(svg).toContain('a &lt; b');
    expect(svg).toContain('#1  01:05.00');
    expect(svg).toContain('• estalo');
    expect(svg).toContain('depois');
  });
});
