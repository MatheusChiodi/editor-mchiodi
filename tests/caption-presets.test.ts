import { describe, expect, it } from 'vitest';

import { toPages } from '../motion/src/captions/Captions.tsx';
import {
  activeWordIndex,
  CAPTION_PRESETS,
  captionPresets,
  DEFAULT_MAX_CHARS,
  enforceMaxWords,
  pageLimits,
  resolveLook,
  wordPhase,
} from '../motion/src/captions/presets.ts';
import type { Transcript } from '../src/analyze/types.ts';
import { catalog } from '../src/arsenal/catalog.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { buildCaptions } from '../src/render/captions.ts';
import { buildOverlayProps } from '../src/render/overlay.ts';
import { script } from './helpers.ts';

const defaults = edlSchema.shape.captions.parse({});
const pageTexts = (captions: Parameters<typeof toPages>[0]) => toPages(captions).map((page) => page.words.map((word) => word.text.trim()).join(' '));

describe('captions.preset no schema', () => {
  it('EDL sem preset continua no padrao', () => {
    expect(defaults.preset).toBe('padrao');
    expect(edlSchema.shape.captions.parse({ style: 'shorts' }).preset).toBe('padrao');
  });

  it('aceita os seis estilos e recusa o resto', () => {
    expect(CAPTION_PRESETS).toEqual(['padrao', 'karaoke', 'pop', 'destaque-caixa', 'minimal', 'bold-shorts']);
    for (const preset of CAPTION_PRESETS) expect(edlSchema.shape.captions.parse({ preset }).preset).toBe(preset);
    expect(() => edlSchema.shape.captions.parse({ preset: 'neon' })).toThrow();
  });
});

describe('resolveLook', () => {
  it('padrao reproduz o visual de antes dos estilos', () => {
    expect(resolveLook('padrao', 'long')).toMatchObject({
      fontSize: 58,
      fontWeight: 800,
      uppercase: false,
      stroke: 9,
      active: 'scale',
      activeColor: 'white',
      activeScale: 0.05,
      upcomingOpacity: 0.55,
      highlightColor: 'coral',
      singleLine: false,
      wordGap: 18,
      shadow: '0 6px 18px rgba(0,0,0,0.45)',
    });
    expect(resolveLook('padrao', 'shorts')).toMatchObject({ fontSize: 84, stroke: 12, uppercase: true, wordGap: 22 });
  });

  it('cada estilo tem a assinatura prometida', () => {
    expect(resolveLook('karaoke', 'long')).toMatchObject({ active: 'fill', activeColor: 'coral', upcomingOpacity: 1 });
    expect(resolveLook('pop', 'long')).toMatchObject({ active: 'pop', upcomingOpacity: 0 });
    expect(resolveLook('pop', 'long').activeScale).toBeGreaterThan(0.05);
    expect(resolveLook('destaque-caixa', 'long')).toMatchObject({ active: 'pill', activeColor: 'coral' });
    // a palavra que cresce ou ganha caixa não pode encostar na vizinha
    expect(resolveLook('pop', 'long').wordGap).toBeGreaterThan(resolveLook('padrao', 'long').wordGap);
    expect(resolveLook('destaque-caixa', 'long').wordGap).toBeGreaterThan(resolveLook('padrao', 'long').wordGap);
    expect(resolveLook('minimal', 'long')).toMatchObject({ active: 'none', stroke: 0, singleLine: true, fontWeight: 600 });
    expect(resolveLook('minimal', 'long').shadow).not.toBe(resolveLook('padrao', 'long').shadow);
    // caixa alta mesmo no 16:9 e maior que o padrão do formato vertical
    expect(resolveLook('bold-shorts', 'long').uppercase).toBe(true);
    expect(resolveLook('bold-shorts', 'shorts').fontSize).toBeGreaterThan(resolveLook('padrao', 'shorts').fontSize);
  });

  it('só usa cores do tema', () => {
    const tokens = ['white', 'coral', 'coralDeep', 'emerald', 'glowPeach', 'ink'];
    for (const preset of CAPTION_PRESETS) {
      expect(tokens).toContain(captionPresets[preset].activeColor);
      expect(tokens).toContain(captionPresets[preset].highlightColor);
    }
  });
});

describe('pageLimits', () => {
  it('padrao mantém largura e palavras de antes', () => {
    expect(pageLimits('padrao', 'long', 5)).toEqual({ maxWords: 5, maxChars: DEFAULT_MAX_CHARS.long });
    expect(pageLimits('padrao', 'shorts', 3)).toEqual({ maxWords: 3, maxChars: DEFAULT_MAX_CHARS.shorts });
    expect(DEFAULT_MAX_CHARS).toEqual({ long: 34, shorts: 16 });
  });

  it('o estilo aperta mas nunca afrouxa a EDL', () => {
    expect(pageLimits('bold-shorts', 'shorts', 5).maxWords).toBe(3);
    expect(pageLimits('bold-shorts', 'shorts', 2).maxWords).toBe(2);
    expect(pageLimits('minimal', 'long', 8)).toEqual({ maxWords: 8, maxChars: 42 });
  });
});

describe('buildCaptions com estilo', () => {
  const words = script('Hoje a gente vai falar de React, hooks e estado. |2 Bora começar agora mesmo com tudo?');
  const whole = buildTimeline([{ id: 'c1', start: 0, end: 30 }], 30);

  it('padrao explícito pagina igual à EDL sem preset', () => {
    expect(buildCaptions(words, whole, { ...defaults, preset: 'padrao' })).toEqual(buildCaptions(words, whole, defaults));
  });

  it('bold-shorts nunca passa de 3 palavras por página', () => {
    const pages = toPages(buildCaptions(words, whole, { ...defaults, style: 'shorts', preset: 'bold-shorts', maxWordsPerPage: 8 }));
    expect(pages.length).toBeGreaterThan(3);
    for (const page of pages) expect(page.words.length).toBeLessThanOrEqual(3);
  });

  it('minimal cabe numa linha (largura do estilo)', () => {
    for (const page of toPages(buildCaptions(words, whole, { ...defaults, preset: 'minimal', maxWordsPerPage: 12 }))) {
      expect(page.words.map((word) => word.text).join('').length).toBeLessThanOrEqual(42);
    }
  });

  it('o preset chega às props da camada de gráficos', () => {
    const edl = edlSchema.parse({
      version: 1,
      project: 'teste',
      createdAt: '2026-10-17T00:00:00.000Z',
      source: { path: 'C:/v.mp4', durationSec: 30, fps: 30, width: 1920, height: 1080 },
      output: { fps: 30, width: 1920, height: 1080 },
      clips: [{ id: 'c1', start: 0, end: 10 }],
      captions: { preset: 'karaoke' },
    });
    const props = buildOverlayProps(edl, buildTimeline(edl.clips, 30), { words } as Transcript);
    expect(props.captionPreset).toBe('karaoke');
    expect(props.captionStyle).toBe('long');
  });
});

describe('palavra ativa por tempo', () => {
  const word = { startMs: 1000, endMs: 1400 };

  it('wordPhase: falada, ativa (com cauda) e progresso', () => {
    expect(wordPhase(word, 999)).toEqual({ spoken: false, active: false, progress: 0 });
    expect(wordPhase(word, 1200)).toEqual({ spoken: true, active: true, progress: 0.5 });
    expect(wordPhase(word, 1450)).toMatchObject({ active: true, progress: 1 });
    expect(wordPhase(word, 1460)).toMatchObject({ spoken: true, active: false });
    expect(wordPhase({ startMs: 500, endMs: 500 }, 500).progress).toBe(0);
  });

  it('activeWordIndex acompanha a fala e some depois da cauda', () => {
    const words = [
      { startMs: 0, endMs: 300 },
      { startMs: 320, endMs: 600 },
      { startMs: 900, endMs: 1200 },
    ];
    expect(activeWordIndex(words, -1)).toBe(-1);
    expect(activeWordIndex(words, 100)).toBe(0);
    expect(activeWordIndex(words, 340)).toBe(1);
    expect(activeWordIndex(words, 700)).toBe(-1);
    expect(activeWordIndex(words, 1000)).toBe(2);
    expect(activeWordIndex(words, 1300)).toBe(-1);
  });
});

describe('enforceMaxWords', () => {
  const caps = (breaks: boolean[]) => breaks.map((pageBreakAfter, index) => ({ text: ` w${index}`, startMs: index * 100, endMs: index * 100 + 90, timestampMs: 0, confidence: null, pageBreakAfter }));

  it('sem teto devolve a mesma lista', () => {
    const list = caps([false, false, true]);
    expect(enforceMaxWords(list, undefined)).toBe(list);
  });

  it('só acrescenta quebras, mantendo as que vieram do pipeline', () => {
    const list = caps([false, true, false, false, false, false, false]);
    expect(pageTexts(enforceMaxWords(list, 3))).toEqual(['w0 w1', 'w2 w3 w4', 'w5 w6']);
    // não muta a entrada
    expect(list.filter((caption) => caption.pageBreakAfter)).toHaveLength(1);
  });
});

describe('arsenal: estilos de legenda', () => {
  it('lista os seis estilos com o snippet da EDL', () => {
    const items = catalog('captions');
    expect(items.map((item) => item.id)).toEqual([...CAPTION_PRESETS]);
    for (const item of items) expect(item.usage).toBe(`captions: { "preset": "${item.id}" }`);
    expect(items.find((item) => item.id === 'bold-shorts')!.description).toContain('Short');
  });
});
