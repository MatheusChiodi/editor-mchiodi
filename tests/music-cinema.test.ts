import { describe, expect, it } from 'vitest';

import { bokehParticles, cameraTransform, letterboxBar, transitionState, TRANSITION_FRAMES } from '../motion/src/music/cinema-math.ts';
import { CAMERA_IDS, TRANSITION_IDS } from '../motion/src/music/types.ts';

describe('cameraTransform', () => {
  const at = (camera: (typeof CAMERA_IDS)[number], progress: number, frame = 0, pulse = 0) => cameraTransform(camera, progress, frame, 30, pulse);

  it('todo movimento dá valores finitos e contidos, em qualquer ponto da cena', () => {
    for (const camera of CAMERA_IDS) {
      for (const progress of [0, 0.25, 0.5, 1]) {
        for (const frame of [0, 17, 240]) {
          const c = at(camera, progress, frame, progress);
          for (const value of [c.scale, c.x, c.y, c.rotate]) expect(Number.isFinite(value)).toBe(true);
          expect(c.scale).toBeGreaterThanOrEqual(1);
          expect(c.scale).toBeLessThanOrEqual(1.3);
          expect(Math.abs(c.x)).toBeLessThanOrEqual(90);
          expect(Math.abs(c.y)).toBeLessThanOrEqual(90);
          expect(Math.abs(c.rotate)).toBeLessThanOrEqual(4);
        }
      }
    }
  });
  it('push aproxima, pull afasta', () => {
    expect(at('push', 1).scale).toBeGreaterThan(at('push', 0).scale + 0.06);
    expect(at('pull', 1).scale).toBeLessThan(at('pull', 0).scale - 0.06);
  });
  it('pans andam em sentidos opostos; tilt sobe', () => {
    expect(at('panL', 1).x).toBeLessThan(at('panL', 0).x - 40);
    expect(at('panR', 1).x).toBeGreaterThan(at('panR', 0).x + 40);
    expect(at('tilt', 1).y).toBeLessThan(at('tilt', 0).y - 20);
  });
  it('orbit balança a câmera', () => {
    const angles = [0, 0.3, 0.6, 1].map((p) => at('orbit', p).rotate);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(1);
  });
  it('a batida dá um tranco de aproximação', () => {
    expect(at('still', 0.5, 10, 1).scale).toBeGreaterThan(at('still', 0.5, 10, 0).scale);
  });
  it('é determinístico', () => {
    expect(at('push', 0.4, 33, 0.2)).toEqual(at('push', 0.4, 33, 0.2));
  });
});

describe('transitionState', () => {
  it('corte seco: já é a cena nova', () => {
    for (const t of [0, 0.5, 1]) expect(transitionState('cut', t)).toMatchObject({ inOpacity: 1, outOpacity: 0 });
  });
  it('no fim de toda transição só a cena nova aparece, limpa', () => {
    for (const kind of TRANSITION_IDS) {
      const end = transitionState(kind, 1);
      expect(end).toMatchObject({ inOpacity: 1, inScale: 1, inX: 0, blur: 0, flash: 0, glitch: 0, wipe: 1 });
      expect(end.outOpacity).toBeLessThanOrEqual(0.001);
    }
  });
  it('no começo a cena antiga ainda domina (exceto o corte)', () => {
    for (const kind of TRANSITION_IDS.filter((id) => id !== 'cut')) {
      const start = transitionState(kind, 0);
      expect(start.outOpacity).toBeGreaterThan(0.99);
      if (kind !== 'wipe' && kind !== 'whip') expect(start.inOpacity).toBeLessThan(0.1);
    }
  });
  it('todo valor fica em faixa válida ao longo da transição', () => {
    for (const kind of TRANSITION_IDS) {
      for (let i = 0; i <= 20; i++) {
        const s = transitionState(kind, i / 20);
        for (const v of [s.inOpacity, s.outOpacity, s.flash, s.glitch, s.wipe]) {
          expect(v).toBeGreaterThanOrEqual(-1e-9);
          expect(v).toBeLessThanOrEqual(1 + 1e-9);
        }
        expect(s.blur).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('flash estoura no meio; glitch também', () => {
    expect(transitionState('flash', 0.5).flash).toBeGreaterThan(0.9);
    expect(transitionState('glitch', 0.5).glitch).toBeGreaterThan(0.9);
    expect(transitionState('glitch', 0).glitch).toBe(0);
  });
  it('cortina revela da esquerda para a direita, sem voltar', () => {
    let last = -1;
    for (let i = 0; i <= 10; i++) {
      const wipe = transitionState('wipe', i / 10).wipe;
      expect(wipe).toBeGreaterThanOrEqual(last);
      last = wipe;
    }
    expect(transitionState('wipe', 0).wipe).toBe(0);
  });
  it('whip empurra uma cena para fora e a outra para dentro', () => {
    expect(transitionState('whip', 0).inX).toBe(1);
    expect(Math.abs(transitionState('whip', 0).outX)).toBe(0);
    expect(transitionState('whip', 1).outX).toBe(-1);
    expect(transitionState('whip', 0.5).blur).toBeGreaterThan(4);
  });
  it('zoom: a antiga cresce, a nova vem de longe, com desfoque no meio', () => {
    expect(transitionState('zoom', 1).outScale).toBeGreaterThan(1.2);
    expect(transitionState('zoom', 0).inScale).toBeLessThan(0.9);
    expect(transitionState('zoom', 0.5).blur).toBeGreaterThan(0);
  });
  it('a duração da transição é de meio segundo ou menos a 30 fps', () => {
    expect(TRANSITION_FRAMES).toBeGreaterThanOrEqual(8);
    expect(TRANSITION_FRAMES).toBeLessThanOrEqual(15);
  });
});

describe('bokehParticles', () => {
  it('determinístico por seed, na quantidade pedida, dentro das faixas', () => {
    const a = bokehParticles(3, 40);
    expect(a).toEqual(bokehParticles(3, 40));
    expect(a).not.toEqual(bokehParticles(4, 40));
    expect(a).toHaveLength(40);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.depth).toBeGreaterThan(0);
      expect(p.depth).toBeLessThanOrEqual(1);
      expect(p.r).toBeGreaterThan(2);
    }
  });
});

describe('letterboxBar', () => {
  it('faixa cinemascope em 16:9; sem faixa em vertical', () => {
    expect(letterboxBar(1920, 1080)).toBeCloseTo((1080 - 1920 / 2.39) / 2, 3);
    expect(letterboxBar(1080, 1920)).toBe(0);
    expect(letterboxBar(1080, 1080)).toBe(0);
  });
});
