import type { CSSProperties } from 'react';
import { describe, expect, it } from 'vitest';

import { enterStyleAt } from '../motion/src/arsenal/Enter.tsx';
import { galleryPages } from '../motion/src/arsenal/EntranceGallery.tsx';
import {
  type EntranceStyle,
  entranceCss,
  entranceEndSec,
  entrances,
  exitCss,
  exitDurationSec,
  exitStyle,
  getEntrance,
  splitUnits,
  toCss,
  unitDelay,
} from '../motion/src/arsenal/entrances.ts';

const presets = Object.values(entrances);
const ids = Object.keys(entrances);
const CATEGORIES = ['fade', 'slide', 'scale', 'mask', 'blur', 'rotate', 'text', 'emphasis'];
const STEPS = [0, 0.25, 0.5, 0.75, 1];

const IDENTITY = /^(translate\(0px, 0px\)|rotate\(0deg\)|skewX\(0deg\)|scale\(1, 1\)|\s)*$/;

function blurOf(css: CSSProperties): number {
  const match = /blur\(([-\d.]+)px\)/.exec(String(css.filter ?? ''));
  return match ? Number(match[1]) : 0;
}

function isRest(css: CSSProperties): boolean {
  const opaque = css.opacity === undefined || css.opacity === 1;
  const still = css.transform === undefined || IDENTITY.test(String(css.transform));
  return opaque && still && blurOf(css) === 0 && css.clipPath === undefined && css.letterSpacing === undefined;
}

describe('entrances', () => {
  it('são exatamente 50, com id único em kebab-case igual à chave', () => {
    expect(presets).toHaveLength(50);
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(50);
    for (const [key, preset] of Object.entries(entrances)) {
      expect(preset.id).toBe(key);
      expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('todo preset tem label, descrição de uma frase e tempos válidos', () => {
    for (const preset of presets) {
      expect(preset.label.trim(), preset.id).not.toBe('');
      expect(preset.description.trim(), preset.id).toMatch(/\.$/);
      expect(preset.durationSec, preset.id).toBeGreaterThanOrEqual(0.2);
      expect(preset.durationSec, preset.id).toBeLessThanOrEqual(0.7);
      expect(preset.staggerSec, preset.id).toBeGreaterThan(0);
    }
    expect(new Set(presets.map((preset) => preset.label)).size).toBe(50);
  });

  it('cobre as 8 categorias e as 4 unidades', () => {
    expect(new Set(presets.map((preset) => preset.category))).toEqual(new Set(CATEGORIES));
    expect(new Set(presets.map((preset) => preset.unit))).toEqual(new Set(['block', 'line', 'word', 'char']));
  });

  it('pop só nos de ênfase', () => {
    for (const preset of presets) expect(preset.easing === 'pop', preset.id).toBe(preset.category === 'emphasis');
  });

  it('em p=1 devolve o repouso exato', () => {
    for (const preset of presets) {
      const css = toCss(preset.style(1));
      expect(isRest(css), `${preset.id}: ${JSON.stringify(css)}`).toBe(true);
    }
  });

  it('em p=0 é diferente do repouso e o elemento está invisível', () => {
    for (const preset of presets) {
      const style = preset.style(0);
      expect(isRest(toCss(style)), preset.id).toBe(false);
      const hidden = style.opacity === 0 || style.clipPath !== undefined || style.scaleX === 0 || style.scaleY === 0;
      expect(hidden, preset.id).toBe(true);
    }
  });

  it('só devolve valores finitos ao longo do progresso', () => {
    for (const preset of presets) {
      for (const step of STEPS) {
        for (const [key, value] of Object.entries(preset.style(step) as Record<string, unknown>)) {
          if (typeof value === 'number') expect(Number.isFinite(value), `${preset.id}.${key} em ${step}`).toBe(true);
          else if (value !== undefined) expect(String(value), `${preset.id}.${key} em ${step}`).not.toMatch(/NaN|Infinity|undefined/);
        }
      }
    }
  });

  it('respeita a linguagem do design system: deslocamento curto, blur leve, escala contida', () => {
    for (const preset of presets) {
      const style = preset.style(0);
      expect(Math.abs(style.x ?? 0), preset.id).toBeLessThanOrEqual(60);
      expect(Math.abs(style.y ?? 0), preset.id).toBeLessThanOrEqual(60);
      expect(style.blur ?? 0, preset.id).toBeLessThanOrEqual(12);
      expect(Math.abs(style.rotate ?? 0), preset.id).toBeLessThanOrEqual(5);
      expect(Math.abs(style.skewX ?? 0), preset.id).toBeLessThanOrEqual(8);
      if (style.scale !== undefined) {
        expect(style.scale, preset.id).toBeGreaterThanOrEqual(0.85);
        expect(style.scale, preset.id).toBeLessThanOrEqual(1.12);
      }
    }
  });

  it('o overshoot do pop não estoura opacidade, blur nem recorte', () => {
    for (const preset of presets) {
      const css = toCss(preset.style(1.1));
      expect(css.opacity === undefined || css.opacity === 1, preset.id).toBe(true);
      expect(blurOf(css), preset.id).toBe(0);
      expect(css.clipPath, preset.id).toBeUndefined();
    }
  });

  it('os 50 são distintos entre si', () => {
    const signatures = presets.map((preset) => `${preset.unit}|${preset.easing}|${JSON.stringify(preset.style(0))}|${JSON.stringify(preset.style(0.5))}`);
    expect(new Set(signatures).size).toBe(50);
  });
});

describe('toCss', () => {
  it('monta transform, filter e clipPath', () => {
    const style: EntranceStyle = { opacity: 0.5, x: 10, y: -4, scale: 0.9, rotate: 2, blur: 6, clipPath: 'inset(0 50% 0 0)', transformOrigin: 'left top' };
    expect(toCss(style)).toEqual({
      opacity: 0.5,
      transform: 'translate(10px, -4px) rotate(2deg) scale(0.9, 0.9)',
      transformOrigin: 'left top',
      filter: 'blur(6px)',
      clipPath: 'inset(0 50% 0 0)',
    });
  });

  it('deixa de fora o que está em repouso e limita a opacidade', () => {
    expect(toCss({ opacity: 1.4, x: 0, y: -0, scale: 1, rotate: 0, blur: 0, letterSpacing: 0, transformOrigin: 'left top' })).toEqual({ opacity: 1 });
    expect(toCss({})).toEqual({});
  });

  it('combina escala uniforme com escala por eixo e emite o tracking em em', () => {
    expect(toCss({ scale: 0.5, scaleX: 0.5 }).transform).toBe('scale(0.25, 0.5)');
    expect(toCss({ letterSpacing: 0.2 }).letterSpacing).toBe('0.2em');
  });
});

describe('entranceCss / exitCss', () => {
  it('a saída parte do repouso e termina fora dele', () => {
    for (const id of ids) {
      expect(isRest(exitCss(id, 0)), id).toBe(true);
      expect(isRest(exitCss(id, 1)), id).toBe(false);
      expect(entranceCss(id, 1), id).toEqual(exitCss(id, 0));
    }
  });

  it('a saída percorre metade do deslocamento da entrada', () => {
    expect(exitStyle('slide-up', 1).y).toBe(30);
    expect(exitStyle('tilt-left', 1)).toMatchObject({ opacity: 0, rotate: -1.5, y: 12 });
    expect(exitStyle('grow-x', 1).scaleX).toBe(0);
  });

  it('a saída é mais curta que a entrada', () => {
    for (const preset of presets) expect(exitDurationSec(preset), preset.id).toBeLessThan(preset.durationSec + 1e-9);
    expect(exitDurationSec(getEntrance('fade-up'))).toBe(0.2);
    expect(exitDurationSec(getEntrance('drift-up'))).toBe(0.35);
  });

  it('recusa id desconhecido', () => {
    expect(() => entranceCss('nao-existe', 0.5)).toThrow(/nao-existe/);
  });
});

describe('unitDelay', () => {
  it('cresce com o índice e começa em zero', () => {
    for (const preset of presets) {
      expect(unitDelay(preset, 0), preset.id).toBe(0);
      expect(unitDelay(preset, 1), preset.id).toBeGreaterThan(unitDelay(preset, 0));
      expect(unitDelay(preset, 5), preset.id).toBeGreaterThan(unitDelay(preset, 4));
    }
  });

  it('diz quando o último unit termina de entrar', () => {
    const words = getEntrance('words-rise');
    expect(entranceEndSec(words, 4)).toBeCloseTo(3 * 0.06 + 0.4);
    expect(entranceEndSec(words, 0)).toBeCloseTo(0.4);
  });
});

describe('splitUnits', () => {
  const text = 'Erros  aparecem\nantes de rodar';

  it('preserva todos os caracteres, inclusive espaços', () => {
    for (const unit of ['block', 'word', 'char'] as const) {
      expect(splitUnits(text, unit).map((token) => token.text).join('')).toBe(text);
    }
    expect(splitUnits(text, 'line').map((token) => token.text).join('\n')).toBe(text);
  });

  it('numera só o que anima, em ordem', () => {
    const words = splitUnits(text, 'word');
    expect(words.filter((token) => token.index !== null).map((token) => token.text)).toEqual(['Erros', 'aparecem', 'antes', 'de', 'rodar']);
    expect(words.filter((token) => token.index !== null).map((token) => token.index)).toEqual([0, 1, 2, 3, 4]);
    expect(words.find((token) => token.index === null)?.text).toBe('  ');
    expect(splitUnits(text, 'line').map((token) => token.index)).toEqual([0, 1]);
  });

  it('agrupa os caracteres por palavra e não parte letra acentuada', () => {
    const chars = splitUnits('São dois', 'char');
    expect(chars.map((token) => token.text)).toEqual(['S', 'ã', 'o', ' ', 'd', 'o', 'i', 's']);
    expect(chars.map((token) => token.group)).toEqual([0, 0, 0, -1, 1, 1, 1, 1]);
    expect(splitUnits('ão', 'char').map((token) => token.text)).toEqual(['ã', 'o']);
  });

  it('texto vazio não quebra', () => {
    expect(splitUnits('', 'word')).toEqual([]);
    expect(splitUnits('', 'char')).toEqual([]);
    expect(splitUnits('', 'line')).toHaveLength(1);
  });
});

describe('enterStyleAt', () => {
  const fps = 30;

  it('fica invisível até o atraso e em repouso depois da entrada', () => {
    expect(enterStyleAt('fade-up', 0, fps, { delaySec: 0.5 })).toEqual({ opacity: 0, y: 24 });
    expect(enterStyleAt('fade-up', 15, fps, { delaySec: 0.5 })).toEqual({ opacity: 0, y: 24 });
    expect(isRest(toCss(enterStyleAt('fade-up', 27, fps, { delaySec: 0.5 })))).toBe(true);
  });

  it('desacelera: passa da metade do caminho antes da metade do tempo', () => {
    const mid = enterStyleAt('fade-up', 6, fps);
    expect(mid.opacity).toBeGreaterThan(0.5);
    expect(mid.y).toBeLessThan(12);
  });

  it('o pop passa do alvo de leve e volta', () => {
    const scales = Array.from({ length: 13 }, (_, frame) => enterStyleAt('pop', frame, fps).scale ?? 1);
    expect(Math.max(...scales)).toBeGreaterThan(1);
    expect(Math.max(...scales)).toBeLessThan(1.02);
    expect(scales.at(-1)).toBe(1);
  });

  it('só sai com `exit` e duração, nos últimos frames', () => {
    expect(isRest(toCss(enterStyleAt('fade-up', 60, fps, { durationInFrames: 60 })))).toBe(true);
    expect(isRest(toCss(enterStyleAt('fade-up', 54, fps, { durationInFrames: 60, exit: true })))).toBe(true);
    expect(enterStyleAt('fade-up', 60, fps, { durationInFrames: 60, exit: true })).toEqual({ opacity: 0, y: 12 });
    const leaving = enterStyleAt('fade-up', 57, fps, { durationInFrames: 60, exit: true });
    expect(leaving.opacity).toBeGreaterThan(0.5);
  });
});

describe('galleryPages', () => {
  it('cobre os 50 sem repetir, em 5 páginas de 10', () => {
    expect(galleryPages).toHaveLength(5);
    for (const page of galleryPages) expect(page).toHaveLength(10);
    const all = galleryPages.flat();
    expect(new Set(all).size).toBe(50);
    expect([...all].sort()).toEqual([...ids].sort());
  });
});
