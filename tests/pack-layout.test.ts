import { describe, expect, it } from 'vitest';

import {
  accentOn,
  accentSegments,
  balanceLines,
  blend,
  blockContrast,
  breakText,
  checkThumb,
  COLORS,
  contrastRatio,
  countWords,
  DURATION_ZONE,
  emWidth,
  fitFontSize,
  hexToRgb,
  intersects,
  LAYOUT_IDS,
  placeImage,
  planThumb,
  scrimAlphaAt,
  sourceRegion,
  TEXT_LIMITS,
  THUMB,
  type ThumbDesign,
} from '../motion/src/thumbnail/layout.ts';

const codes = (design: ThumbDesign, photo?: [number, number, number][]) => checkThumb(design, photo).map((problem) => `${problem.level}:${problem.code}`);

describe('cor e contraste', () => {
  it('calcula o contraste WCAG', () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 0);
    expect(contrastRatio(hexToRgb('#fff'), hexToRgb(COLORS.ink))).toBeGreaterThan(15);
    expect(blend([0, 0, 0], [255, 255, 255], 0.5)).toEqual([128, 128, 128]);
  });

  it('troca o coral pelo coral escuro onde o claro não lê', () => {
    expect(accentOn(COLORS.ink)).toBe(COLORS.coral);
    expect(accentOn(COLORS.paper)).toBe(COLORS.coralDeep);
    expect(contrastRatio(hexToRgb(accentOn(COLORS.paper)), hexToRgb(COLORS.paper))).toBeGreaterThanOrEqual(TEXT_LIMITS.minAccentContrast);
  });

  it('interpola o véu entre os pontos', () => {
    const stops = [{ at: 0, alpha: 0.9 }, { at: 0.5, alpha: 0.5 }, { at: 1, alpha: 0 }];
    expect(scrimAlphaAt(stops, -1)).toBe(0.9);
    expect(scrimAlphaAt(stops, 0.25)).toBeCloseTo(0.7);
    expect(scrimAlphaAt(stops, 0.75)).toBeCloseTo(0.25);
    expect(scrimAlphaAt(stops, 2)).toBe(0);
  });
});

describe('placeImage', () => {
  const image = { width: 1920, height: 1080 };
  const box = { width: 1280, height: 720 };

  it('sem zoom cobre a caixa exatamente', () => {
    expect(placeImage(image, box, { x: 0.5, y: 0.5 }, 1, { x: 0.5, y: 0.5 })).toEqual({ left: 0, top: 0, width: 1280, height: 720 });
  });

  it('leva o rosto para a âncora quando há zoom', () => {
    const placed = placeImage(image, box, { x: 0.45, y: 0.45 }, 2.5, { x: 0.75, y: 0.43 });
    expect(placed.left + 0.45 * placed.width).toBeCloseTo(0.75 * 1280, 3);
    expect(placed.top + 0.45 * placed.height).toBeCloseTo(0.43 * 720, 3);
  });

  it('nunca deixa buraco na borda', () => {
    const placed = placeImage(image, box, { x: 0.02, y: 0.98 }, 1.2, { x: 0.9, y: 0.1 });
    expect(placed.left).toBeLessThanOrEqual(0);
    expect(placed.top).toBeLessThanOrEqual(0);
    expect(placed.left + placed.width).toBeGreaterThanOrEqual(1280 - 1e-6);
    expect(placed.top + placed.height).toBeGreaterThanOrEqual(720 - 1e-6);
  });

  it('cobre caixa mais alta que a foto e devolve a região da foto sob um retângulo', () => {
    const tall = placeImage(image, { width: 690, height: 720 }, { x: 0.5, y: 0.5 }, 1, { x: 0.5, y: 0.5 });
    expect(tall.height).toBeCloseTo(720);
    expect(tall.width).toBeCloseTo(1280);
    const placed = placeImage(image, box, { x: 0.5, y: 0.5 }, 2, { x: 0.5, y: 0.5 });
    expect(sourceRegion(placed, image, { x: 0, y: 0, width: 640, height: 360 })).toEqual({ x: 480, y: 270, width: 480, height: 270 });
  });
});

describe('texto', () => {
  it('estima largura maior para texto mais longo e para a fonte sem serifa pesada', () => {
    expect(emWidth('back-end', 'display')).toBeGreaterThan(emWidth('back', 'display'));
    expect(emWidth('MITO', 'body')).toBeGreaterThan(emWidth('mito', 'body'));
    expect(emWidth('tudo', 'body')).toBeGreaterThan(emWidth('tudo', 'display'));
    expect(countWords('  Larguei o\nback-end ')).toBe(3);
  });

  it('equilibra as linhas', () => {
    expect(balanceLines(['Eu', 'não', 'sabia', 'tudo'], 2, 'body')).toEqual(['Eu não', 'sabia tudo']);
    expect(balanceLines(['mito'], 3, 'body')).toEqual(['mito']);
  });

  it('respeita a quebra pedida e escolhe a que deixa a letra maior', () => {
    const box = { width: 640, height: 560 };
    expect(breakText('Larguei o\nback-end', box, 'display').lines).toEqual(['Larguei o', 'back-end']);
    const auto = breakText('Eu não sabia tudo', box, 'body');
    expect(auto.lines.length).toBeGreaterThan(1);
    expect(auto.fontSize).toBeGreaterThan(fitFontSize(['Eu não sabia tudo'], box, 'body'));
  });

  it('encolhe a letra quando o texto cresce e nunca passa do teto', () => {
    const box = { width: 640, height: 560 };
    expect(fitFontSize(['oi'], box, 'body')).toBe(TEXT_LIMITS.maxFontSize.body);
    expect(fitFontSize(['uma linha bem comprida demais'], box, 'body')).toBeLessThan(fitFontSize(['uma linha'], box, 'body'));
  });

  it('marca só a primeira ocorrência do acento, ignorando caixa, acento e pontuação', () => {
    expect(accentSegments(['Full stack é', 'mito? mito'], 'MITO')).toEqual([
      [{ text: 'Full stack é', accent: false }],
      [{ text: 'mito?', accent: true }, { text: ' mito', accent: false }],
    ]);
    expect(accentSegments(['Não é'], 'nao')[0]![0]).toEqual({ text: 'Não', accent: true });
    expect(accentSegments(['sem acento'], undefined).flat().some((segment) => segment.accent)).toBe(false);
  });
});

describe('planThumb', () => {
  const texts = ['Mito', 'Larguei o\nback-end', 'Eu não sabia tudo', 'Full stack\nFront-end', 'Profundidade ou largura demais'];

  it('nenhum layout põe texto, pílula ou selo na zona da duração nem fora do quadro', () => {
    for (const layout of LAYOUT_IDS) {
      for (const text of texts) {
        for (const support of [undefined, { kind: 'pill', text: '4 anos de full stack' }, { kind: 'badge', text: '4 anos' }] as const) {
          const plan = planThumb({ layout, text: layout === 'split' && !text.includes('\n') ? `${text}\ndepois` : text, number: '4', unit: 'anos', support });
          const rects = [...plan.blocks.map((block) => block.rect), ...(plan.number ? [plan.number.rect] : []), ...(plan.pill ? [plan.pill.rect] : [])];
          for (const rect of rects) {
            expect(intersects(rect, DURATION_ZONE), `${layout} "${text}"`).toBe(false);
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.y).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(THUMB.width);
            expect(rect.y + rect.height).toBeLessThanOrEqual(THUMB.height + 0.5);
          }
        }
      }
    }
  });

  it('texto curto de capa ocupa pelo menos 1/3 da largura em todos os layouts', () => {
    for (const layout of LAYOUT_IDS) {
      const plan = planThumb({ layout, text: layout === 'split' ? 'Full stack\nFront-end' : 'Larguei o\nback-end', number: '4', unit: 'anos' });
      const width = layout === 'split' ? plan.blocks.reduce((sum, block) => sum + block.rect.width, 0) : Math.max(...plan.blocks.map((block) => block.rect.width));
      expect(width, layout).toBeGreaterThanOrEqual(THUMB.width / 3);
    }
  });

  it('espelha o rosto e o véu entre face-right e face-left', () => {
    const right = planThumb({ layout: 'face-right', text: 'Oi' });
    const left = planThumb({ layout: 'face-left', text: 'Oi' });
    expect(right.images[0]!.anchor.x).toBeGreaterThan(0.6);
    expect(left.images[0]!.anchor.x).toBeCloseTo(1 - right.images[0]!.anchor.x);
    expect(scrimAlphaAt(right.scrim!.stops, 0)).toBeGreaterThan(0.9);
    expect(scrimAlphaAt(left.scrim!.stops, 1)).toBeGreaterThan(0.9);
    expect(scrimAlphaAt(left.scrim!.stops, 0)).toBe(0);
  });

  it('a faixa tem a altura do texto e usa tinta sobre papel', () => {
    const one = planThumb({ layout: 'band', text: 'Full stack é mito?', accent: 'mito' });
    const two = planThumb({ layout: 'band', text: 'Full stack\né mito?', accent: 'mito' });
    expect(two.band!.height).toBeGreaterThan(one.band!.height);
    expect(one.band!.y + one.band!.height).toBe(THUMB.height);
    expect(one.blocks[0]!.color).toBe(COLORS.ink);
    expect(one.blocks[0]!.accentColor).toBe(COLORS.coralDeep);
    expect(planThumb({ layout: 'band', text: 'Oi', tone: 'ink' }).blocks[0]!.color).toBe(COLORS.white);
  });

  it('split: uma linha para cada metade, com o mesmo tamanho de letra', () => {
    const plan = planThumb({ layout: 'split', text: 'Full stack\nFront-end', accent: 'Front-end' });
    expect(plan.blocks).toHaveLength(2);
    expect(plan.images).toHaveLength(2);
    expect(plan.images[0]!.muted).toBe(true);
    expect(plan.blocks[0]!.fontSize).toBe(plan.blocks[1]!.fontSize);
    expect(plan.blocks[0]!.rect.x).toBeLessThan(640);
    expect(plan.blocks[1]!.rect.x).toBeGreaterThan(640);
    expect(plan.blocks[1]!.lines[0]![0]!.accent).toBe(true);
  });

  it('number: o número é o maior elemento e a seta só existe nos layouts de rosto', () => {
    const plan = planThumb({ layout: 'number', text: 'de full stack', number: '4', unit: 'anos' });
    expect(plan.number!.fontSize).toBeGreaterThan(plan.blocks[0]!.fontSize * 1.5);
    expect(plan.blocks[0]!.rect.y).toBeGreaterThanOrEqual(plan.number!.rect.y + plan.number!.rect.height);
    expect(planThumb({ layout: 'face-right', text: 'Oi', support: { kind: 'arrow' } }).arrow).not.toBeNull();
    expect(planThumb({ layout: 'band', text: 'Oi', support: { kind: 'arrow' } }).arrow).toBeNull();
  });

  it('a pílula fica acima do texto, sem encostar', () => {
    const plan = planThumb({ layout: 'face-right', text: 'Larguei o\nback-end', support: { kind: 'pill', text: '4 anos' } });
    expect(plan.pill!.rect.y + plan.pill!.rect.height).toBeLessThan(plan.blocks[0]!.rect.y);
    expect(plan.pill!.text).toBe('4 ANOS');
  });
});

describe('checkThumb', () => {
  const good: ThumbDesign = { layout: 'face-right', text: 'Larguei o\nback-end', accent: 'back-end' };

  it('aprova uma capa curta com acento', () => {
    expect(codes(good)).toEqual([]);
  });

  it('avisa texto longo e reprova texto longo demais ou letra pequena', () => {
    expect(codes({ ...good, text: 'Eu não sabia de tudo', accent: 'tudo' })).toContain('warning:texto-longo');
    const long = codes({ ...good, text: 'Eu achava que sabia tudo sobre desenvolvimento', accent: 'tudo' });
    expect(long).toContain('error:texto-longo');
    expect(codes({ ...good, text: 'Especialização\nprofissionalizante', accent: undefined })).toContain('error:letra-pequena');
  });

  it('exige uma palavra de acento que esteja no texto', () => {
    expect(codes({ ...good, accent: undefined })).toContain('warning:acento');
    expect(codes({ ...good, accent: 'front-end' })).toContain('error:acento');
    expect(codes({ ...good, accent: 'o back-end' })).toContain('error:acento');
    expect(codes({ layout: 'number', text: 'de full stack', number: '4' })).not.toContain('warning:acento');
  });

  it('cobra o que cada layout precisa', () => {
    expect(codes({ layout: 'split', text: 'Full stack', accent: 'stack' })).toContain('error:split-linhas');
    expect(codes({ layout: 'number', text: 'de full stack', accent: 'stack' })).toContain('error:sem-numero');
    expect(codes({ ...good, text: '  ' })).toContain('error:sem-texto');
  });

  it('mede o contraste com a foto real: fundo claro sob véu fraco reprova', () => {
    const plan = planThumb(good);
    expect(blockContrast(plan, plan.blocks[0]!, [20, 40, 30])).toBeGreaterThan(TEXT_LIMITS.minContrast);
    expect(codes(good, [[20, 40, 30]])).toEqual([]);
    expect(codes({ layout: 'split', text: 'Antes\nDepois', accent: 'Depois' }, [[250, 250, 250], [250, 250, 250]])).toContain('error:contraste');
    const band = planThumb({ layout: 'band', text: 'Oi' });
    expect(blockContrast(band, band.blocks[0]!)).toBeGreaterThan(15);
  });
});
