import { getBoundingBox } from '@remotion/paths';
import { describe, expect, it } from 'vitest';

import { burstParticles, particleState } from '../motion/src/components/Burst.tsx';
import { groupC4 } from '../motion/src/components/index-c4.ts';
import { blobPath, blobPoints } from '../motion/src/components/OrganicBlob.tsx';
import { pathDrawState, pathViewBox } from '../motion/src/components/PathDraw.tsx';
import { morphPath, SHAPE_IDS, shapePath } from '../motion/src/components/ShapeMorph.tsx';
import { registry } from '../motion/src/components/registry.ts';

describe('groupC4 (motion graphics)', () => {
  const names = ['PathDraw', 'ShapeMorph', 'Burst', 'OrganicBlob'];
  it('registra os quatro componentes, cada um com sample, duração e descrição', () => {
    expect(Object.keys(groupC4)).toEqual(names);
    for (const name of names) {
      expect(registry[name]).toBe(groupC4[name]);
      const entry = groupC4[name]!;
      expect(entry.defaultDuration).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(20);
      expect(entry.sample).toBeTypeOf('object');
    }
  });
});

describe('PathDraw', () => {
  const line = 'M 0 0 L 100 0';
  it('traço cresce de 0 a 100% e a ponta acompanha o path', () => {
    const start = pathDrawState(line, 0);
    const half = pathDrawState(line, 0.5);
    const end = pathDrawState(line, 1);
    // em 0 o Remotion passa do comprimento (150) para esconder a ponta arredondada
    expect(start.strokeDashoffset).toBeGreaterThanOrEqual(100);
    expect(half.strokeDashoffset).toBe(50);
    expect(end.strokeDashoffset).toBe(0);
    expect(half.head.x).toBeCloseTo(50, 6);
    expect(half.head.y).toBeCloseTo(0, 6);
    expect(half.head.angle).toBeCloseTo(0, 6);
  });
  it('ângulo da ponta segue a direção do trecho', () => {
    expect(pathDrawState('M 0 0 L 0 100', 0.5).head.angle).toBeCloseTo(90, 4);
  });
  it('viewBox cobre o path com margem', () => {
    const box = pathViewBox('M 10 20 L 110 70', 10);
    expect(box).toEqual({ x: 0, y: 10, width: 120, height: 70 });
  });
});

describe('ShapeMorph', () => {
  it('todas as formas ficam centradas na mesma caixa', () => {
    for (const id of SHAPE_IDS) {
      const box = getBoundingBox(shapePath(id));
      expect((box.x1 + box.x2) / 2).toBeCloseTo(200, 0);
      expect((box.y1 + box.y2) / 2).toBeCloseTo(200, 0);
      expect(box.x2 - box.x1).toBeLessThanOrEqual(400);
    }
  });
  it('extremos do morph são as próprias formas; o meio é diferente das duas', () => {
    const size = (d: string) => {
      const box = getBoundingBox(d);
      return [box.x2 - box.x1, box.y2 - box.y1];
    };
    expect(size(morphPath('circle', 'star', 0))[0]).toBeCloseTo(size(shapePath('circle'))[0]!, 0);
    expect(size(morphPath('circle', 'star', 1))[0]).toBeCloseTo(size(shapePath('star'))[0]!, 0);
    expect(morphPath('circle', 'star', 0.5)).not.toBe(morphPath('circle', 'star', 0));
    expect(morphPath('circle', 'star', 0.5)).not.toBe(morphPath('circle', 'star', 1));
  });
  it('id desconhecido cai no círculo', () => {
    expect(shapePath('nao-existe' as never)).toBe(shapePath('circle'));
  });
});

describe('Burst', () => {
  it('é determinístico por seed e respeita o número de partículas', () => {
    expect(burstParticles(7, 24)).toEqual(burstParticles(7, 24));
    expect(burstParticles(7, 24)).not.toEqual(burstParticles(8, 24));
    expect(burstParticles(1, 24)).toHaveLength(24);
    expect(burstParticles(1, 2)).toHaveLength(6);
    expect(burstParticles(1, 500)).toHaveLength(48);
  });
  it('partículas saem em todas as direções (sem agrupar)', () => {
    const angles = burstParticles(3, 12).map((p) => p.angle);
    expect(new Set(angles.map((a) => Math.floor(a / 90))).size).toBe(4);
  });
  it('nasce no centro, se afasta e some', () => {
    const [p] = burstParticles(5, 12);
    const start = particleState(p!, 0, 300);
    const mid = particleState(p!, 0.5, 300);
    const end = particleState(p!, 1, 300);
    expect(start).toMatchObject({ x: 0, y: 0, opacity: 1 });
    expect(Math.hypot(mid.x, mid.y)).toBeGreaterThan(0);
    expect(Math.hypot(end.x, end.y)).toBeGreaterThan(Math.hypot(mid.x, mid.y));
    expect(end.opacity).toBe(0);
  });
});

describe('OrganicBlob', () => {
  const options = { points: 8, radius: 200, amp: 0.2, speed: 0.4 };
  it('raios ficam dentro de radius ± amp e mudam com o tempo', () => {
    const a = blobPoints(0, 30, 'x', options);
    const b = blobPoints(60, 30, 'x', options);
    expect(a).toHaveLength(8);
    for (const point of a) {
      const r = Math.hypot(point.x, point.y);
      expect(r).toBeGreaterThanOrEqual(200 * 0.8 - 1e-6);
      expect(r).toBeLessThanOrEqual(200 * 1.2 + 1e-6);
    }
    expect(a).not.toEqual(b);
    expect(blobPoints(0, 30, 'x', options)).toEqual(a);
  });
  it('path fechado e suave (curvas cúbicas)', () => {
    const d = blobPath(blobPoints(0, 30, 'x', options));
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(8);
  });
});
