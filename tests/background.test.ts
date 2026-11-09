import { describe, expect, it } from 'vitest';

import { backgroundSchema, type Background } from '../src/edl/schema.ts';
import { autoDownsample, buildBackgroundGraph, chromaFilters, matteRefineFilters, needsMatte } from '../src/render/background.ts';

const make = (input: Record<string, unknown>): Background => backgroundSchema.parse({ reason: 'teste', ...input });
const frame = { width: 1280, height: 720, fps: 30 };

describe('backgroundSchema', () => {
  it('exige reason e file nos modos que usam arquivo', () => {
    expect(backgroundSchema.safeParse({ mode: 'color' }).success).toBe(false);
    expect(backgroundSchema.safeParse({ mode: 'image', reason: 'x' }).success).toBe(false);
    expect(backgroundSchema.safeParse({ mode: 'image', file: 'a.png', reason: 'x' }).success).toBe(true);
    expect(backgroundSchema.safeParse({ mode: 'color', color: 'verde', reason: 'x' }).success).toBe(false);
  });
});

describe('autoDownsample', () => {
  it('leva o maior lado para ~512 px e nunca amplia', () => {
    expect(autoDownsample(1920, 1080)).toBeCloseTo(0.267, 3);
    expect(autoDownsample(3840, 2160)).toBeCloseTo(0.133, 3);
    expect(autoDownsample(320, 180)).toBe(1);
  });
});

describe('matteRefineFilters', () => {
  it('opening (erosão + dilatação) e feather, como o post_process do rembg', () => {
    expect(matteRefineFilters({ opening: 2, feather: 1.5 })).toBe('format=gray,erosion,erosion,dilation,dilation,gblur=sigma=1.5');
  });
  it('sem refino sobra só o formato', () => {
    expect(matteRefineFilters({ opening: 0, feather: 0 })).toBe('format=gray');
  });
});

describe('chromaFilters', () => {
  it('tira a cor e faz despill do canal certo', () => {
    const green = chromaFilters(make({ mode: 'chroma', keyColor: '#00ff00' }));
    expect(green).toContain('chromakey=color=0x00ff00:similarity=0.18:blend=0.08');
    expect(green).toContain('despill=type=green');
    expect(chromaFilters(make({ mode: 'chroma', keyColor: '#0000ff' }))).toContain('despill=type=blue');
  });
  it('despill desligado não entra no grafo', () => {
    expect(chromaFilters(make({ mode: 'chroma', despill: false }))).not.toContain('despill');
  });
});

describe('buildBackgroundGraph', () => {
  it('só os modos de modelo pedem máscara', () => {
    expect(needsMatte(make({ mode: 'color' }))).toBe(true);
    expect(needsMatte(make({ mode: 'blur' }))).toBe(true);
    expect(needsMatte(make({ mode: 'chroma' }))).toBe(false);
  });

  it('color: fundo lavfi, máscara na entrada 1, saída [vbg]', () => {
    const plan = buildBackgroundGraph(make({ mode: 'color', color: '#112233' }), frame, null);
    expect(plan.inputs).toEqual(['-f', 'lavfi', '-i', 'color=c=0x112233:s=1280x720:r=30']);
    expect(plan.graph).toContain('[1:v]format=gray');
    expect(plan.graph).toContain('[bgsrc][bgm]alphamerge[bgfg]');
    expect(plan.graph).toContain('[2:v]format=yuv420p[bgbase]');
    expect(plan.graph).toMatch(/\[bgbase\]\[bgfg\]overlay=shortest=1.*\[vbg\]$/);
  });

  it('image: ajusta ao quadro (cobrir e cortar) e repete o arquivo', () => {
    const plan = buildBackgroundGraph(make({ mode: 'image', file: 'x.png' }), frame, 'C:/bg/x.png');
    expect(plan.inputs).toEqual(['-loop', '1', '-framerate', '30', '-i', 'C:/bg/x.png']);
    expect(plan.graph).toContain('scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720');
  });

  it('video: em laço, do começo', () => {
    const plan = buildBackgroundGraph(make({ mode: 'video', file: 'x.mp4' }), frame, 'C:/bg/x.mp4');
    expect(plan.inputs).toEqual(['-stream_loop', '-1', '-i', 'C:/bg/x.mp4']);
    expect(plan.graph).toContain('setpts=PTS-STARTPTS');
  });

  it('blur: desfoca o próprio vídeo, sem entrada extra', () => {
    const plan = buildBackgroundGraph(make({ mode: 'blur', blur: 30 }), frame, null);
    expect(plan.inputs).toEqual([]);
    expect(plan.graph).toContain('split=2[bgsrc][blursrc]');
    expect(plan.graph).toContain('[blursrc]gblur=sigma=30[bgbase]');
  });

  it('chroma: sem máscara; o fundo novo vira a entrada 1', () => {
    const plan = buildBackgroundGraph(make({ mode: 'chroma', keyColor: '#00ff00' }), frame, null);
    expect(plan.graph).not.toContain('alphamerge');
    expect(plan.graph).toContain('[0:v]chromakey=');
    expect(plan.graph).toContain('[1:v]format=yuv420p[bgbase]');
  });
});
