import { describe, expect, it } from 'vitest';

import {
  cornerLength,
  dimRect,
  entry,
  frameThickness,
  fxAlpha,
  fxVariants,
  leakAt,
  letterboxBar,
  sideBar,
  spotlight,
} from '../motion/src/arsenal/fx/Fx.tsx';
import { theme } from '../motion/src/theme.ts';
import {
  BRAND,
  buildEffectFilters,
  type EffectCategory,
  type EffectContext,
  effects,
  envelope,
  focusRegion,
  hexToRgb,
} from '../src/arsenal/effects.ts';

const context = (overrides: Partial<EffectContext> = {}): EffectContext => ({
  start: 0.5,
  end: 1.5,
  intensity: 0.5,
  width: 1920,
  height: 1080,
  fps: 30,
  focus: { x: 0.5, y: 0.4 },
  ...overrides,
});

const all = Object.values(effects);
const filters = all.filter((preset) => preset.kind === 'filter');
const overlays = all.filter((preset) => preset.kind === 'overlay');
const CATEGORIES: EffectCategory[] = ['look', 'camera', 'focus', 'light', 'glitch', 'texture', 'frame'];

describe('catálogo de efeitos', () => {
  it('tem exatamente 50 presets, com id único em kebab-case igual à chave', () => {
    expect(Object.keys(effects)).toHaveLength(50);
    expect(new Set(all.map((preset) => preset.id)).size).toBe(50);
    for (const [key, preset] of Object.entries(effects)) {
      expect(preset.id).toBe(key);
      expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('cobre todas as categorias, com o id prefixado pela categoria', () => {
    for (const category of CATEGORIES) {
      expect(all.filter((preset) => preset.category === category).length).toBeGreaterThanOrEqual(5);
    }
    for (const preset of all) expect(preset.id.startsWith(`${preset.category}-`)).toBe(true);
  });

  it.each(all)('$id tem os campos obrigatórios', (preset) => {
    expect(preset.label.trim().length).toBeGreaterThan(2);
    expect(preset.description.trim().length).toBeGreaterThan(20);
    expect(CATEGORIES).toContain(preset.category);
    expect(['any', 'sober', 'playful']).toContain(preset.tone);
    expect(preset.defaultIntensity).toBeGreaterThanOrEqual(0);
    expect(preset.defaultIntensity).toBeLessThanOrEqual(1);
    if (preset.defaultDuration !== null) expect(preset.defaultDuration).toBeGreaterThan(0);
    // exatamente um dos dois meios
    expect(Boolean(preset.build)).toBe(preset.kind === 'filter');
    expect(Boolean(preset.overlay)).toBe(preset.kind === 'overlay');
  });

  it('nada pisca: nenhum efeito de luz ou glitch dura menos que 0.4s por padrão', () => {
    for (const preset of all.filter((item) => item.category === 'light' || item.category === 'glitch')) {
      expect(preset.defaultDuration).not.toBeNull();
      expect(preset.defaultDuration!).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('as cores dos looks são as do tema', () => {
    for (const [name, hex] of Object.entries(BRAND)) {
      expect(theme.color[name as keyof typeof theme.color]).toBe(hex);
    }
  });
});

describe('presets filter', () => {
  it.each(filters)('$id gera filtros limitados ao intervalo, sem NaN/undefined', (preset) => {
    const built = buildEffectFilters(preset.id, context({ intensity: preset.defaultIntensity }));
    expect(built.length).toBeGreaterThanOrEqual(1);
    const chain = built.join(',');
    expect(chain).not.toMatch(/NaN|undefined|Infinity|\[object/);
    expect(chain).toContain('between(t,0.5,');
    // aspas simples sempre fecham: uma ímpar quebraria o grafo inteiro
    expect((chain.match(/'/g) ?? []).length % 2).toBe(0);
    for (const item of built) expect(item).not.toMatch(/^,|,$|,,/);
  });

  it.each(filters)('$id responde à intensidade', (preset) => {
    const low = buildEffectFilters(preset.id, context({ intensity: 0 })).join(',');
    const high = buildEffectFilters(preset.id, context({ intensity: 1 })).join(',');
    expect(low).not.toBe(high);
  });

  it('intensidade fora de 0–1 é limitada', () => {
    for (const preset of filters) {
      expect(buildEffectFilters(preset.id, context({ intensity: 7 }))).toEqual(buildEffectFilters(preset.id, context({ intensity: 1 })));
      expect(buildEffectFilters(preset.id, context({ intensity: -3 }))).toEqual(buildEffectFilters(preset.id, context({ intensity: 0 })));
      expect(buildEffectFilters(preset.id, context({ intensity: Number.NaN })).join(',')).not.toContain('NaN');
    }
  });

  it('efeitos de câmera devolvem o quadro ao tamanho original e não usam iw/ih no recorte', () => {
    for (const preset of filters.filter((item) => item.category === 'camera')) {
      const built = buildEffectFilters(preset.id, context());
      const crop = built.find((item) => item.startsWith('crop='));
      expect(crop).toBeDefined();
      expect(crop).toMatch(/^crop=1920:1080:/);
      expect(crop).not.toMatch(/\b(iw|ih)\b/);
      expect(built.some((item) => item.startsWith('scale=') && item.includes('eval=frame'))).toBe(true);
    }
  });

  it('nenhum filtro muda fps, duração ou tamanho final do quadro', () => {
    for (const preset of filters) {
      const chain = buildEffectFilters(preset.id, context()).join(',');
      expect(chain).not.toMatch(/(^|[,;\]])(fps|setpts|trim|tpad|select|framerate|minterpolate|pad)=/);
    }
  });

  it('sub-grafos usam rótulos únicos por instante, então duas instâncias convivem na mesma cadeia', () => {
    const labels = (chain: string) => new Set(chain.match(/\[fx[a-z0-9]+\]/g) ?? []);
    for (const preset of filters) {
      const first = labels(buildEffectFilters(preset.id, context()).join(','));
      const second = labels(buildEffectFilters(preset.id, context({ start: 4, end: 5 })).join(','));
      for (const label of first) expect(second.has(label)).toBe(false);
    }
  });

  it('buildEffectFilters devolve [] para overlay e falha em id desconhecido', () => {
    for (const preset of overlays) expect(buildEffectFilters(preset.id, context())).toEqual([]);
    expect(() => buildEffectFilters('nao-existe', context())).toThrow(/desconhecido/);
  });
});

describe('funções puras do catálogo', () => {
  it('envelope é zero fora do intervalo e encurta as rampas em trechos curtos', () => {
    expect(envelope(context())).toContain('between(t,0.5,1.5)');
    // rampa pedida de 0.4s num trecho de 0.6s vira 0.2s (um terço)
    expect(envelope(context({ start: 1, end: 1.6 }))).toContain('(t-1)/0.2');
    expect(envelope(context({ start: 1, end: 1 }))).not.toMatch(/NaN|Infinity|\/0[,)]/);
  });

  it('focusRegion fica dentro do quadro e com dimensões pares', () => {
    const corner = focusRegion(context({ focus: { x: 1, y: 0 } }), 0.3, 0.3);
    expect(corner.x + corner.w).toBeLessThanOrEqual(1920);
    expect(corner.y).toBe(0);
    expect(corner.w % 2).toBe(0);
    expect(corner.h % 2).toBe(0);
    const center = focusRegion(context({ focus: { x: 0.5, y: 0.5 } }), 0.3, 0.3);
    expect(center).toEqual({ x: 672, y: 378, w: 576, h: 324 });
  });

  it('hexToRgb normaliza para 0–1', () => {
    expect(hexToRgb('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#ff5555')[0]).toBe(1);
    expect(hexToRgb('#ff5555')[1]).toBeCloseTo(1 / 3, 5);
  });
});

describe('presets overlay e Fx', () => {
  it.each(overlays)('$id aponta para uma variante que o Fx conhece', (preset) => {
    expect(fxVariants).toContain(preset.overlay!.variant);
    expect(preset.overlay!.props!(0.3)).toEqual({ intensity: 0.3 });
    expect(preset.overlay!.props!(4)).toEqual({ intensity: 1 });
  });

  it('toda variante do Fx é usada por algum preset', () => {
    const used = new Set(overlays.map((preset) => preset.overlay!.variant));
    for (const variant of fxVariants) expect(used.has(variant)).toBe(true);
    expect(new Set(fxVariants).size).toBe(fxVariants.length);
  });

  it('entry tem amostra real', () => {
    expect(fxVariants).toContain(entry.sample.variant);
    expect(entry.defaultDuration).toBeGreaterThan(0);
  });

  it('letterbox vai de 2:1 a 2.39:1', () => {
    expect(letterboxBar(1920, 1080, 0)).toBe(60);
    expect(letterboxBar(1920, 1080, 1)).toBe(138);
    // quadro já mais largo que o alvo não ganha barra negativa
    expect(letterboxBar(2560, 1000, 1)).toBe(0);
  });

  it('barras laterais vão de 16:10 a 4:3', () => {
    expect(sideBar(1920, 1080, 0)).toBe(96);
    expect(sideBar(1920, 1080, 1)).toBe(240);
    expect(sideBar(1080, 1920, 1)).toBe(0);
  });

  it('holofote fecha e escurece com a intensidade', () => {
    const soft = spotlight(1080, 0);
    const hard = spotlight(1080, 1);
    expect(hard.radius).toBeLessThan(soft.radius);
    expect(hard.dim).toBeGreaterThan(soft.dim);
    expect(hard.dim).toBeLessThan(1);
    expect(soft.feather).toBeLessThan(soft.radius);
  });

  it('área destacada nunca sai do quadro', () => {
    expect(dimRect(1920, 1080, { x: 0.5, y: 0.5 }, { w: 0.5, h: 0.5 })).toEqual({ x: 480, y: 270, w: 960, h: 540 });
    const corner = dimRect(1920, 1080, { x: 1, y: 1 }, { w: 0.5, h: 0.5 });
    expect(corner.x + corner.w).toBe(1920 - 24);
    expect(corner.y + corner.h).toBe(1080 - 24);
    const huge = dimRect(1920, 1080, { x: 0, y: 0 }, { w: 3, h: 3 });
    expect(huge).toEqual({ x: 24, y: 24, w: 1872, h: 1032 });
  });

  it('opacidades crescem com a intensidade e ficam abaixo de 1', () => {
    for (const variant of ['vignette', 'grain', 'scanlines', 'light-leak', 'brand-glow', 'dim-rect']) {
      expect(fxAlpha(variant, 1)).toBeGreaterThan(fxAlpha(variant, 0));
      expect(fxAlpha(variant, 1)).toBeLessThan(1);
      expect(fxAlpha(variant, 9)).toBe(fxAlpha(variant, 1));
    }
    // grão é textura, não efeito: mesmo no máximo fica quase invisível
    expect(fxAlpha('grain', 1)).toBeLessThanOrEqual(0.12);
    expect(fxAlpha('letterbox', 0.3)).toBe(1);
  });

  it('moldura e cantoneiras escalam com a altura do quadro', () => {
    expect(frameThickness(1080, 0)).toBe(20);
    expect(frameThickness(1080, 1)).toBe(56);
    expect(frameThickness(540, 1)).toBe(28);
    expect(cornerLength(1080, 0)).toBe(48);
    expect(cornerLength(1080, 1)).toBe(110);
  });

  it('light leak nasce e some invisível e atravessa o quadro', () => {
    expect(leakAt(0, 1).opacity).toBe(0);
    expect(leakAt(1, 1).opacity).toBeCloseTo(0, 10);
    expect(leakAt(0.5, 1).opacity).toBeCloseTo(fxAlpha('light-leak', 1), 10);
    expect(leakAt(0, 0.5).x).toBeLessThan(0);
    expect(leakAt(1, 0.5).x).toBeGreaterThan(1);
    expect(leakAt(-2, 0.5)).toEqual(leakAt(0, 0.5));
  });
});
