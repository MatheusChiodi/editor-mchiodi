import { describe, expect, it } from 'vitest';

import {
  faceCrop,
  frameScore,
  growBox,
  guessFace,
  laplacianVariance,
  meanBrightness,
  type MeasuredFrame,
  pickFrames,
  poolDeviation,
  skinMask,
  skinRatio,
  speechInstants,
  spreadCandidates,
} from '../src/pack/frames.ts';
import { compareSheet, compareSvg, COMPARE_TIERS, contactGrid, contactSvg, durationBadge } from '../src/pack/sheet.ts';
import { script } from './helpers.ts';

describe('speechInstants', () => {
  const words = script('um dois tres |2 quatro cinco seis');

  it('pega o meio de cada palavra falada', () => {
    const instants = speechInstants(words, null, []);
    expect(instants).toHaveLength(6);
    expect(instants[0]).toBeCloseTo(0.135, 3);
  });

  it('fica dentro do que a EDL mantém, longe da borda do corte', () => {
    const instants = speechInstants(words, [{ start: 0, end: 0.95 }], []);
    expect(instants).toEqual([0.485]);
  });

  it('evita troca de cena, palavra curta e palavra interpolada', () => {
    expect(speechInstants(words, null, [0.2])).toEqual([3.185, 3.535, 3.885]);
    const odd = [{ ...words[0]!, end: words[0]!.start + 0.05 }, { ...words[1]!, interpolated: true }, words[2]!];
    expect(speechInstants(odd, null, [])).toHaveLength(1);
  });
});

describe('spreadCandidates', () => {
  it('espalha pelas faixas do vídeo e limita por faixa', () => {
    const instants = Array.from({ length: 100 }, (_, index) => index);
    const candidates = spreadCandidates(instants, 4, 3);
    expect(candidates).toHaveLength(12);
    expect(new Set(candidates.map((candidate) => candidate.bucket))).toEqual(new Set([0, 1, 2, 3]));
    expect(candidates.filter((candidate) => candidate.bucket === 0).every((candidate) => candidate.at < 25)).toBe(true);
    expect(new Set(candidates.map((candidate) => candidate.at)).size).toBe(12);
  });

  it('aguenta lista vazia e faixa com poucos instantes', () => {
    expect(spreadCandidates([], 4, 3)).toEqual([]);
    expect(spreadCandidates([1, 2, 99], 2, 4)).toHaveLength(3);
  });
});

describe('métricas', () => {
  const flat = new Uint8Array(16 * 16).fill(120);
  const checker = Uint8Array.from({ length: 16 * 16 }, (_, index) => ((index % 16) + Math.floor(index / 16)) % 2 ? 255 : 0);

  it('nitidez: plano é 0, xadrez é alto, e a região limita a medida', () => {
    expect(laplacianVariance(flat, 16, 16)).toBe(0);
    expect(laplacianVariance(checker, 16, 16)).toBeGreaterThan(1000);
    const half = Uint8Array.from(checker, (value, index) => (index % 16 < 8 ? 120 : value));
    expect(laplacianVariance(half, 16, 16, { x: 0, y: 0, width: 6, height: 16 })).toBe(0);
    expect(laplacianVariance(half, 16, 16, { x: 10, y: 0, width: 6, height: 16 })).toBeGreaterThan(1000);
    expect(laplacianVariance(flat, 2, 2)).toBe(0);
  });

  it('brilho e tom de pele', () => {
    expect(meanBrightness(flat)).toBeCloseTo(120 / 255);
    expect(meanBrightness(new Uint8Array())).toBe(0);
    const rgb = Uint8Array.from([220, 170, 140, 20, 60, 30, 240, 240, 240, 200, 150, 120]);
    expect([...skinMask(rgb)]).toEqual([1, 0, 0, 1]);
    expect(skinRatio(rgb)).toBe(0.5);
  });

  it('a nota premia nitidez e gente no quadro, e castiga quadro estourado ou preto', () => {
    const base = { sharpness: 800, brightness: 0.3, skin: 0.08 };
    expect(frameScore(base, 800)).toBeCloseTo(1);
    expect(frameScore({ ...base, sharpness: 200 }, 800)).toBeLessThan(frameScore(base, 800));
    expect(frameScore({ ...base, skin: 0 }, 800)).toBeCloseTo(0.7);
    expect(frameScore({ ...base, brightness: 0.02 }, 800)).toBeCloseTo(0.8);
    expect(frameScore(base, 0)).toBeCloseTo(0.5);
  });
});

describe('guessFace', () => {
  const width = 40;
  const height = 30;
  const paint = (boxes: { x: number; y: number; w: number; h: number }[]) => {
    const mask = new Uint8Array(width * height);
    for (const box of boxes) for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) mask[y * width + x] = 1;
    return mask;
  };
  const face = { x: 16, y: 6, w: 8, h: 9 };
  const guitar = { x: 2, y: 2, w: 10, h: 10 };
  const arm = { x: 10, y: 24, w: 20, h: 5 };

  it('escolhe a maior mancha de pele da parte de cima; braço embaixo não conta', () => {
    expect(guessFace(paint([face, arm]), null, width, height)).toEqual({ x: 16, y: 6, width: 8, height: 9 });
  });

  it('objeto cor de pele que nunca se mexe é cenário', () => {
    const mask = paint([face, guitar]);
    expect(guessFace(mask, null, width, height)).toEqual({ x: 2, y: 2, width: 10, height: 10 });
    const moving = poolDeviation([paint([face]).map((v) => v * 200), paint([{ ...face, x: 17 }]).map((v) => v * 90), new Uint8Array(width * height)]);
    const guess = guessFace(mask, moving, width, height)!;
    expect(guess.x).toBeGreaterThanOrEqual(16);
    expect(guess.y).toBe(6);
  });

  it('sem pele não há palpite', () => {
    expect(guessFace(new Uint8Array(width * height), null, width, height)).toBeNull();
    expect(poolDeviation([new Uint8Array(4)])).toEqual(new Float32Array(4));
  });

  it('recorte quadrado em volta do rosto, dentro do quadro', () => {
    const crop = faceCrop({ x: 800, y: 400, width: 200, height: 250 }, 1920, 1080);
    expect(crop.width).toBe(crop.height);
    expect(crop.width).toBe(600);
    expect(crop.x + crop.width / 2).toBeCloseTo(900);
    const edge = faceCrop({ x: 1800, y: 0, width: 120, height: 120 }, 1920, 1080);
    expect(edge.x + edge.width).toBeLessThanOrEqual(1920);
    expect(edge.y).toBe(0);
    expect(faceCrop(null, 1920, 1080).width).toBe(648);
    expect(growBox({ x: 0, y: 0, width: 10, height: 10 }, 2, 40, 30)).toEqual({ x: 0, y: 0, width: 20, height: 20 });
  });
});

describe('pickFrames', () => {
  const frame = (at: number, bucket: number, sharpness: number): MeasuredFrame => ({ at, bucket, metrics: { sharpness, brightness: 0.3, skin: 0.1 } });

  it('fica com o melhor de cada faixa, em ordem de tempo', () => {
    const picked = pickFrames([frame(1, 0, 100), frame(2, 0, 900), frame(11, 1, 500), frame(12, 1, 300), frame(21, 2, 50)], 3, 1);
    expect(picked.map((item) => item.at)).toEqual([2, 11, 21]);
    expect(picked[0]!.score).toBeGreaterThan(picked[2]!.score);
  });

  it('completa faixas vazias respeitando a distância mínima', () => {
    const picked = pickFrames([frame(1, 0, 900), frame(1.2, 0, 850), frame(6, 0, 400), frame(11, 1, 500)], 3, 2);
    expect(picked.map((item) => item.at)).toEqual([1, 6, 11]);
    expect(pickFrames([], 3, 1)).toEqual([]);
  });
});

describe('folhas', () => {
  it('folha de contato: 3 por linha, com o recorte do rosto ao lado de cada quadro', () => {
    const grid = contactGrid(12);
    expect(grid.cells).toHaveLength(12);
    expect(grid.cells[3]!.y).toBeGreaterThan(grid.cells[0]!.y);
    expect(grid.cells[3]!.x).toBe(grid.cells[0]!.x);
    expect(grid.faces[0]!.x).toBe(grid.cells[0]!.x + grid.cells[0]!.width);
    expect(grid.faces[0]!.x + grid.faces[0]!.width).toBeLessThanOrEqual(grid.cells[1]!.x);
    expect(grid.faces[11]!.x + grid.faces[11]!.width).toBeLessThanOrEqual(grid.width);
    const svg = contactSvg(grid, [{ index: 1, at: 83.5, score: 0.91, focus: { x: 0.45, y: 0.47 } }, { index: 2, at: 90, score: 0.5, focus: null }]);
    expect(svg).toContain('#1 · 01:23.5 (83.50s) · nota 0.91 · rosto 0.45, 0.47');
    expect(svg).toContain('rosto ?');
  });

  it('folha de comparação: cada variante nos três tamanhos, o menor em 168×94', () => {
    const sheet = compareSheet(3);
    expect(sheet.tiles).toHaveLength(9);
    const small = sheet.tiles.filter((tile) => tile.tier === 2);
    expect(small.every((tile) => tile.width === 168 && tile.height === 94)).toBe(true);
    expect(sheet.tiles.filter((tile) => tile.tier === 1).every((tile) => tile.width === 320 && tile.height === 180)).toBe(true);
    expect(Math.max(...sheet.tiles.map((tile) => tile.x + tile.width))).toBeLessThanOrEqual(sheet.width);
    expect(Math.max(...sheet.tiles.map((tile) => tile.y + tile.height))).toBeLessThanOrEqual(sheet.height);
    expect(COMPARE_TIERS[2].background).toBe('#ffffff');
  });

  it('desenha o selo de duração no canto inferior direito de cada miniatura', () => {
    const tile = { x: 100, y: 50, width: 320, height: 180 };
    const badge = durationBadge(tile, '7:37');
    expect(badge.rect.x + badge.rect.width).toBeLessThan(tile.x + tile.width);
    expect(badge.rect.y + badge.rect.height).toBeLessThan(tile.y + tile.height);
    expect(badge.rect.x).toBeGreaterThan(tile.x + tile.width * 0.75);
    const svg = compareSvg(compareSheet(2), ['capa 1 · emoção', 'capa 2 · <número>'], 457);
    expect(svg.match(/>7:37</g)).toHaveLength(6);
    expect(svg).toContain('capa 2 · &lt;número&gt;');
  });
});
