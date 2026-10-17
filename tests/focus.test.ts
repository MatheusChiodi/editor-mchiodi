import { describe, expect, it } from 'vitest';

import { estimateCenter, FocusAccumulator, frameProfile, isSkin, parseFocusTrackFile, rowWeight, sameKey } from '../src/analyze/focus.ts';
import { shortsSchema } from '../src/edl/schema.ts';
import {
  centerToFocus,
  CUT_MARGIN_SEC,
  cropFraction,
  DEFAULT_FOCUS_PARAMS,
  FOCUS_REF_WIDTH,
  type FocusKeyframe,
  type FocusSample,
  focusAt,
  focusExpr,
  focusSegments,
  focusToCenter,
  followTarget,
  medianSmooth,
  planFocus,
  simplify,
  spread,
} from '../src/render/focus.ts';
import { shortsSpans, verticalCrop } from '../src/render/shorts.ts';
import { inheritedFocus } from '../src/render/shorts-suggest.ts';

const CROP = cropFraction(1920, 1080);
const FPS = 2;

/** Série a 2 fps de `start` a `end` com centro `x(t)` e ruído determinístico de amplitude `noise`. */
function series(start: number, end: number, x: (t: number) => number, noise = 0, confidence = 0.8): FocusSample[] {
  const out: FocusSample[] = [];
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let t = start; t <= end + 1e-9; t += 1 / FPS) out.push({ t: Number(t.toFixed(3)), x: x(t) + (random() * 2 - 1) * noise, confidence });
  return out;
}

/** Centro (fração) que o recorte mostra no instante t. */
const centerAt = (focus: number | FocusKeyframe[], t: number) => focusToCenter(focusAt(focus, t), CROP);
const toPx = (fraction: number) => fraction * FOCUS_REF_WIDTH;

/** Velocidade e aceleração máximas do centro do recorte (px de referência/s), amostrando a cada 10 ms. */
function kinematics(focus: number | FocusKeyframe[], start: number, end: number): { speed: number; accel: number } {
  const dt = 0.1;
  let speed = 0;
  let accel = 0;
  let previous: number | null = null;
  for (let t = start + dt; t <= end; t += dt) {
    const v = toPx(centerAt(focus, t) - centerAt(focus, t - dt)) / dt;
    speed = Math.max(speed, Math.abs(v));
    if (previous !== null) accel = Math.max(accel, Math.abs(v - previous) / dt);
    previous = v;
  }
  return { speed, accel };
}

/** Avalia a expressão do ffmpeg em JS (só usa clip/gte/aritmética). */
function evalExpr(expr: string, t: number): number {
  const clip = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
  const gte = (a: number, b: number) => (a >= b ? 1 : 0);
  return new Function('t', 'clip', 'gte', `return ${expr};`)(t, clip, gte) as number;
}

describe('geometria do recorte', () => {
  it('fração do recorte 9:16 e conversão centro ↔ focusX', () => {
    expect(CROP).toBeCloseTo(0.3164, 3);
    expect(centerToFocus(0.5, CROP)).toBeCloseTo(0.5);
    expect(centerToFocus(0.05, CROP)).toBe(0);
    expect(centerToFocus(0.99, CROP)).toBe(1);
    expect(focusToCenter(centerToFocus(0.37, CROP), CROP)).toBeCloseTo(0.37);
    expect(cropFraction(1080, 1920)).toBe(1);
    expect(centerToFocus(0.2, 1)).toBe(0.5);
  });

  it('trechos: ordena e cola clipes sem corte visível, separa os que têm', () => {
    expect(focusSegments([{ start: 10, end: 12 }, { start: 0, end: 5 }, { start: 5.02, end: 8 }])).toEqual([
      { start: 0, end: 8 },
      { start: 10, end: 12 },
    ]);
  });

  it('mediana móvel tira salto isolado e ignora amostra sem confiança', () => {
    const samples = series(0, 6, () => 0.4);
    samples[6] = { ...samples[6]!, x: 0.9 };
    samples[8] = { ...samples[8]!, x: 0.1, confidence: 0 };
    const smooth = medianSmooth(samples, DEFAULT_FOCUS_PARAMS.medianWindowSec, 0.15);
    expect(smooth).toHaveLength(samples.length - 1);
    expect(Math.max(...smooth.map((point) => point.x))).toBeCloseTo(0.4);
  });

  it('variação robusta ignora as pontas', () => {
    expect(spread([0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.95])).toBeCloseTo(0);
    expect(spread([0.1])).toBe(0);
  });

  it('simplificação mantém pontas e respeita a tolerância', () => {
    const line = Array.from({ length: 50 }, (_, index) => ({ t: index / 10, x: 0.2 + index * 0.01 }));
    expect(simplify(line, 0.001)).toEqual([line[0], line[49]]);
    const bent = [...line, { t: 5, x: 0.2 }];
    const kept = simplify(bent, 0.001);
    expect(kept.at(-1)).toEqual({ t: 5, x: 0.2 });
    expect(kept.length).toBe(3);
  });
});

describe('planejamento do foco (AutoFlip-like)', () => {
  it('parado com ruído → foco fixo na mediana', () => {
    const plan = planFocus(series(100, 130, () => 0.42, 0.015), [{ start: 100, end: 130 }], { crop: CROP });
    expect(plan.mode).toBe('fixed');
    expect(typeof plan.focus).toBe('number');
    expect(focusToCenter(plan.focus as number, CROP)).toBeCloseTo(0.42, 2);
  });

  it('ruído forte em volta de um ponto (gestos) continua fixo: a mediana come os picos', () => {
    const samples = series(0, 40, (t) => (Math.floor(t) % 7 === 0 ? 0.3 : 0.45), 0.02);
    expect(planFocus(samples, [{ start: 0, end: 40 }], { crop: CROP }).mode).toBe('fixed');
  });

  it('andando → pan suave que acompanha, sem passar dos limites de velocidade e aceleração', () => {
    // 0,25 → 0,75 em 20 s: 48 px/s de referência, abaixo da velocidade máxima
    const walk = (t: number) => 0.25 + 0.5 * Math.min(1, Math.max(0, (t - 5) / 20));
    const plan = planFocus(series(0, 30, walk, 0.005), [{ start: 0, end: 30 }], { crop: CROP });
    expect(plan.mode).toBe('pan');
    const keys = plan.focus as FocusKeyframe[];
    expect(keys[0]!.t).toBe(0);
    expect(keys.at(-1)!.t).toBe(30);
    // durante a caminhada o sujeito nunca sai da zona morta + folga
    for (let t = 8; t <= 30; t += 0.5) expect(toPx(Math.abs(centerAt(keys, t) - walk(t)))).toBeLessThan(DEFAULT_FOCUS_PARAMS.deadZonePx + 40);
    expect(toPx(Math.abs(centerAt(keys, 30) - 0.75))).toBeLessThan(DEFAULT_FOCUS_PARAMS.deadZonePx);
    expect(kinematics(keys, 0, 30).speed).toBeLessThanOrEqual(DEFAULT_FOCUS_PARAMS.maxSpeedPx + 1);
    // aceleração medida na câmera simulada (os keyframes simplificados são retas: a quina não é aceleração real)
    const points = medianSmooth(series(0, 30, walk, 0.005), DEFAULT_FOCUS_PARAMS.medianWindowSec, 0);
    const path = followTarget(points, { start: 0, end: 30 }, DEFAULT_FOCUS_PARAMS);
    const { speed, accel } = kinematics(path, 0, 30);
    expect(speed).toBeLessThanOrEqual(DEFAULT_FOCUS_PARAMS.maxSpeedPx + 1);
    // folga de 5%: o passo que pousa no alvo anda menos que a velocidade daquele passo
    expect(accel).toBeLessThanOrEqual(DEFAULT_FOCUS_PARAMS.maxAccelPx * 1.05);
  });

  it('salto dentro do mesmo plano → pan com velocidade limitada, freia sem passar do alvo', () => {
    const jump = (t: number) => (t < 10 ? 0.25 : 0.75);
    const plan = planFocus(series(0, 25, jump), [{ start: 0, end: 25 }], { crop: CROP });
    expect(plan.mode).toBe('pan');
    const keys = plan.focus as FocusKeyframe[];
    expect(centerAt(keys, 9)).toBeCloseTo(0.25, 3);
    // 960 px a 240 px/s levam ≥ 4 s: o recorte não pula
    expect(centerAt(keys, 11.5)).toBeLessThan(0.5);
    expect(toPx(Math.abs(centerAt(keys, 25) - 0.75))).toBeLessThan(DEFAULT_FOCUS_PARAMS.settlePx + 1);
    expect(Math.max(...keys.map((key) => focusToCenter(key.x, CROP)))).toBeLessThan(0.75 + 10 / FOCUS_REF_WIDTH);
    expect(kinematics(keys, 0, 25).speed).toBeLessThanOrEqual(DEFAULT_FOCUS_PARAMS.maxSpeedPx + 1);
  });

  it('sem tremedeira: pan com ruído não inverte de direção à toa e para quando o sujeito para', () => {
    const walk = (t: number) => 0.3 + 0.4 * Math.min(1, Math.max(0, (t - 4) / 10));
    const keys = planFocus(series(0, 30, walk, 0.02), [{ start: 0, end: 30 }], { crop: CROP }).focus as FocusKeyframe[];
    let reversals = 0;
    let direction = 0;
    for (let index = 1; index < keys.length; index += 1) {
      const delta = keys[index]!.x - keys[index - 1]!.x;
      if (Math.abs(delta) < 1e-4) continue;
      if (direction !== 0 && Math.sign(delta) !== direction) reversals += 1;
      direction = Math.sign(delta);
    }
    expect(reversals).toBeLessThanOrEqual(1);
    // depois que o sujeito para, o recorte fica parado
    expect(toPx(Math.abs(centerAt(keys, 24) - centerAt(keys, 30)))).toBeLessThan(0.5);
  });

  it('corte: reposiciona seco no corte, e cada trecho decide sozinho', () => {
    const samples = [...series(0, 10, () => 0.25), ...series(12, 22, () => 0.75)];
    const plan = planFocus(samples, [{ start: 0, end: 10 }, { start: 12, end: 22 }], { crop: CROP });
    expect(plan.mode).toBe('pan');
    expect(plan.segments.map((segment) => segment.mode)).toEqual(['fixed', 'fixed']);
    const keys = plan.focus as FocusKeyframe[];
    expect(centerAt(keys, 9.99)).toBeCloseTo(0.25, 3);
    // o primeiro frame do trecho seguinte pode cair até meio frame antes do start
    expect(centerAt(keys, 12 - CUT_MARGIN_SEC)).toBeCloseTo(0.75, 3);
    expect(centerAt(keys, 12)).toBeCloseTo(0.75, 3);
  });

  it('pan não atravessa o corte: o trecho seguinte abre onde o sujeito está, não onde o pan parou', () => {
    const walk = (t: number) => 0.2 + 0.03 * t;
    const samples = [...series(0, 15, walk), ...series(20, 30, () => 0.3)];
    const plan = planFocus(samples, [{ start: 0, end: 15 }, { start: 20, end: 30 }], { crop: CROP });
    expect(plan.segments.map((segment) => segment.mode)).toEqual(['pan', 'fixed']);
    const keys = plan.focus as FocusKeyframe[];
    expect(centerAt(keys, 20)).toBeCloseTo(0.3, 3);
    expect(centerAt(keys, 15)).toBeGreaterThan(0.45);
  });

  it('trecho sem amostra confiável segura o anterior; sem nada, usa o fallback', () => {
    const samples = [...series(0, 10, () => 0.25), ...series(12, 22, () => 0.75), ...series(25, 30, () => 0.1, 0, 0)];
    const plan = planFocus(samples, [{ start: 0, end: 10 }, { start: 12, end: 22 }, { start: 25, end: 30 }], { crop: CROP });
    expect(plan.segments.at(-1)!.mode).toBe('empty');
    expect(centerAt(plan.focus as FocusKeyframe[], 28)).toBeCloseTo(0.75, 3);
    const empty = planFocus(series(0, 10, () => 0.2, 0, 0.01), [{ start: 0, end: 10 }], { crop: CROP, fallback: 0.47 });
    expect(empty).toMatchObject({ mode: 'fixed', focus: 0.47, samples: 0 });
  });

  it('a câmera virtual parte da mediana do primeiro segundo', () => {
    const points = series(0, 5, (t) => (t < 1 ? 0.6 : 0.6)).map(({ t, x }) => ({ t, x }));
    const path = followTarget(points, { start: 0, end: 5 }, DEFAULT_FOCUS_PARAMS);
    expect(path[0]).toEqual({ t: 0, x: 0.6 });
    expect(path.at(-1)!.t).toBe(5);
    expect(new Set(path.map((point) => point.x)).size).toBe(1);
  });
});

describe('expressão do recorte', () => {
  it('número fixo mantém o formato antigo', () => {
    expect(focusExpr(0.47)).toBe('0.470');
    expect(verticalCrop(0.5)).toContain("x='(iw-ow)*0.500'");
  });

  it('keyframes viram soma de rampas em t, igual a focusAt (inclusive degrau e pontas)', () => {
    const keys = [
      { t: 2, x: 0.2 },
      { t: 4, x: 0.6 },
      { t: 6, x: 0.6 },
      { t: 6, x: 0.3 },
      { t: 9.5, x: 0.9 },
    ];
    const expr = focusExpr(keys);
    expect(expr).toContain('clip((t-2)/2,0,1)');
    expect(expr).toContain('gte(t,6)');
    for (const t of [0, 2, 3, 4, 5.99, 6, 7.25, 9.5, 12]) expect(evalExpr(expr, t)).toBeCloseTo(focusAt(keys, t), 6);
    expect(verticalCrop(keys)).toContain(`x='(iw-ow)*${expr}'`);
  });

  it('plano de pan avaliado pela expressão bate com focusAt', () => {
    const plan = planFocus(series(0, 20, (t) => (t < 6 ? 0.3 : 0.7)), [{ start: 0, end: 20 }], { crop: CROP });
    const expr = focusExpr(plan.focus);
    for (let t = 0; t <= 20; t += 0.37) expect(evalExpr(expr, t)).toBeCloseTo(focusAt(plan.focus, t), 5);
  });
});

describe('EDL: shorts.focusX', () => {
  const base = { start: 10, end: 40 };

  it('aceita número, "auto" e keyframes; padrão continua 0.5', () => {
    expect(shortsSchema.parse(base).focusX).toBe(0.5);
    expect(shortsSchema.parse({ ...base, focusX: 0.3 }).focusX).toBe(0.3);
    expect(shortsSchema.parse({ ...base, focusX: 'auto' }).focusX).toBe('auto');
    expect(shortsSchema.parse({ ...base, focusX: [{ t: 10, x: 0.4 }, { t: 12, x: 0.5 }] }).focusX).toHaveLength(2);
  });

  it('rejeita keyframes fora de ordem, fora de 0–1 e texto desconhecido', () => {
    expect(() => shortsSchema.parse({ ...base, focusX: [{ t: 12, x: 0.4 }, { t: 10, x: 0.5 }] })).toThrow(/ordem/);
    expect(() => shortsSchema.parse({ ...base, focusX: [{ t: 12, x: 1.4 }] })).toThrow();
    expect(() => shortsSchema.parse({ ...base, focusX: 'centro' })).toThrow();
    expect(() => shortsSchema.parse({ ...base, focusX: [] })).toThrow();
  });

  it('candidato do suggest herda número e auto, mas não keyframes de outro trecho', () => {
    expect(inheritedFocus(undefined)).toBe(0.5);
    expect(inheritedFocus(0.3)).toBe(0.3);
    expect(inheritedFocus('auto')).toBe('auto');
    expect(inheritedFocus([{ t: 1, x: 0.2 }])).toBe('auto');
  });

  it('trechos do Short = clipes dentro do intervalo', () => {
    const clips = [{ id: 'a', start: 0, end: 12, quote: '', reason: '' }, { id: 'b', start: 13, end: 30, quote: '', reason: '' }];
    expect(shortsSpans({ clips, shorts: { start: 5, end: 20, focusX: 'auto', reason: '' } } as never)).toEqual([
      { start: 5, end: 12 },
      { start: 13, end: 20 },
    ]);
    expect(shortsSpans({ clips, shorts: null } as never)).toEqual([]);
  });
});

describe('detector (perfis de coluna)', () => {
  const W = 96;
  const H = 54;
  const SKIN: [number, number, number] = [224, 172, 105];
  const WALL: [number, number, number] = [40, 60, 45];

  function frame(blockLeft: number, blockWidth = 12, rows: [number, number] = [8, 34]): Uint8Array {
    const rgb = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const color = x >= blockLeft && x < blockLeft + blockWidth && y >= rows[0] && y < rows[1] ? SKIN : WALL;
        rgb.set(color, (y * W + x) * 3);
      }
    }
    return rgb;
  }

  it('regra de pele: tom de pele sim, parede verde e sombra não', () => {
    expect(isSkin(...SKIN)).toBe(true);
    expect(isSkin(...WALL)).toBe(false);
    expect(isSkin(30, 22, 15)).toBe(false);
  });

  it('peso das linhas: pleno no alto, menor no pé', () => {
    expect(rowWeight(0.2)).toBe(1);
    expect(rowWeight(1)).toBeCloseTo(0.2);
    expect(rowWeight(0.8)).toBeLessThan(1);
  });

  it('centro = bloco de pele; parede lisa = confiança zero', () => {
    const profile = frameProfile(frame(60), null, W, H);
    const { x, confidence } = estimateCenter(profile.motion, profile.skin, H);
    expect(x * W).toBeCloseTo(66, 0);
    expect(confidence).toBeGreaterThan(0.5);
    const flat = frameProfile(frame(200), null, W, H);
    expect(estimateCenter(flat.motion, flat.skin, H).confidence).toBe(0);
  });

  it('mãos embaixo pesam menos que o rosto em cima', () => {
    const rgb = frame(60, 12, [6, 26]);
    const hands = frame(10, 12, [40, 54]);
    for (let y = 40; y < 54; y += 1) for (let x = 10; x < 22; x += 1) rgb.set(hands.subarray((y * W + x) * 3, (y * W + x) * 3 + 3), (y * W + x) * 3);
    const profile = frameProfile(rgb, null, W, H);
    expect(estimateCenter(profile.motion, profile.skin, H).x * W).toBeGreaterThan(55);
  });

  it('acumulador segue o bloco que anda, com t em segundos da fonte', () => {
    const accumulator = new FocusAccumulator(W, H, 2);
    const samples = [10, 20, 30, 40, 50, 60].map((left) => accumulator.push(frame(left)));
    expect(samples.map((sample) => sample.t)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    samples.forEach((sample, index) => expect(Math.abs(sample.x * W - (16 + index * 10))).toBeLessThan(6));
  });

  it('track à mão: objeto ou lista, confiança padrão 1, ordenado', () => {
    expect(parseFocusTrackFile({ samples: [{ t: 3, x: 0.4 }, { t: 1, x: 0.5 }] })).toEqual([
      { t: 1, x: 0.5, confidence: 1 },
      { t: 3, x: 0.4, confidence: 1 },
    ]);
    expect(parseFocusTrackFile([{ t: 1, x: 0.2, confidence: 0.5 }])).toEqual([{ t: 1, x: 0.2, confidence: 0.5 }]);
    expect(() => parseFocusTrackFile({ samples: [{ t: 1, x: 2 }] })).toThrow();
  });

  it('chave de cache compara todos os campos', () => {
    const key = { path: 'a', size: 1, mtimeMs: 2, fps: 2, width: 192, algo: 2 };
    expect(sameKey(key, { ...key })).toBe(true);
    expect(sameKey({ ...key, width: 160 }, key)).toBe(false);
    expect(sameKey(undefined, key)).toBe(false);
  });
});
