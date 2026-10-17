import { describe, expect, it } from 'vitest';

import { configSchema } from '../src/config.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { deepFilterCheck, doctorLines } from '../src/project/health.ts';
import { voiceChain } from '../src/render/audio.ts';
import { buildCutGraph } from '../src/render/cuts.ts';
import {
  alignFilters,
  correlateLag,
  decimate,
  deepFilterArgs,
  denoiseCacheKey,
  estimateDelay,
  findOnPath,
  loudestWindow,
  resolveDeepFilterBinary,
  resolveDenoise,
  rmsPerBlock,
} from '../src/render/denoise.ts';

const audioDefaults = edlSchema.shape.audio.parse({});
const settings = { attenLimDb: 100, postFilter: false };

/** ruído branco determinístico (LCG), para a correlação ter um pico único */
function noise(length: number, seed = 1): Float32Array {
  const out = new Float32Array(length);
  let state = seed;
  for (let index = 0; index < length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out[index] = state / 2 ** 32 - 0.5;
  }
  return out;
}

/** `signal[n + lag] = reference[n]` */
function shifted(reference: Float32Array, lag: number): Float32Array {
  const out = new Float32Array(reference.length);
  for (let index = 0; index < reference.length; index += 1) {
    const from = index - lag;
    if (from >= 0 && from < reference.length) out[index] = reference[from]!;
  }
  return out;
}

describe('denoise: modo', () => {
  it('a EDL antiga continua válida e o padrão segue sendo afftdn light', () => {
    expect(audioDefaults.denoise).toBe('light');
    expect(edlSchema.shape.audio.parse({ denoise: 'deepfilter' }).denoise).toBe('deepfilter');
    expect(() => edlSchema.shape.audio.parse({ denoise: 'rnnoise' })).toThrow();
  });

  it('deepfilter com binário: sem afftdn na cadeia; sem binário: cai para light com aviso', () => {
    expect(resolveDenoise('medium', null)).toEqual({ denoise: 'medium', deepfilter: false, warning: null });
    expect(resolveDenoise('off', '/bin/deep-filter')).toEqual({ denoise: 'off', deepfilter: false, warning: null });
    expect(resolveDenoise('deepfilter', '/bin/deep-filter')).toEqual({ denoise: 'deepfilter', deepfilter: true, warning: null });
    const fallback = resolveDenoise('deepfilter', null);
    expect(fallback.denoise).toBe('light');
    expect(fallback.deepfilter).toBe(false);
    expect(fallback.warning).toMatch(/deep-filter não encontrado.*afftdn light/);
  });

  it('a cadeia de voz com deepfilter não aplica afftdn nem a compensação dele', () => {
    expect(voiceChain({ ...audioDefaults, denoise: 'deepfilter' }).map((filter) => filter.split('=')[0])).toEqual([
      'highpass', 'deesser', 'acompressor',
    ]);
  });

  it('config: defaults do deep-filter', () => {
    expect(configSchema.parse({}).denoise).toEqual({ deepFilterPath: '', attenLimDb: 100, postFilter: false });
    expect(() => configSchema.parse({ denoise: { attenLimDb: 0 } })).toThrow();
  });
});

describe('denoise: binário', () => {
  const files = new Set(['C:\\tools\\df\\deep-filter.exe', '/usr/bin/deep-filter', 'D:\\bin\\df.exe']);
  const exists = (file: string) => files.has(file);

  it('procura no PATH com a extensão do Windows e aceita a variável "Path"', () => {
    const env = { Path: 'C:\\Windows;"C:\\tools\\df"' };
    expect(findOnPath(['deep-filter'], env, 'win32', exists)).toBe('C:\\tools\\df\\deep-filter.exe');
    expect(findOnPath(['deep-filter'], { PATH: '/bin:/usr/bin' }, 'linux', exists)).toBe('/usr/bin/deep-filter');
    expect(findOnPath(['deep-filter'], {}, 'win32', exists)).toBeNull();
  });

  it('MCE_DEEPFILTER > config > PATH; caminho explícito inexistente não cai no PATH', () => {
    const base = { platform: 'win32' as const, exists };
    const path = { Path: 'C:\\tools\\df' };
    expect(resolveDeepFilterBinary({ ...base, env: { ...path, MCE_DEEPFILTER: 'D:\\bin\\df.exe' }, configPath: 'x.exe' }).via).toBe('MCE_DEEPFILTER');
    expect(resolveDeepFilterBinary({ ...base, env: path, configPath: 'D:\\bin\\df.exe' }).via).toBe('mce.config.json');
    expect(resolveDeepFilterBinary({ ...base, env: path, configPath: '' })).toEqual({ path: 'C:\\tools\\df\\deep-filter.exe', via: 'PATH', missing: null });
    expect(resolveDeepFilterBinary({ ...base, env: path, configPath: 'E:\\nada.exe' })).toEqual({ path: null, via: 'mce.config.json', missing: 'E:\\nada.exe' });
    expect(resolveDeepFilterBinary({ ...base, env: {}, configPath: '' })).toEqual({ path: null, via: null, missing: null });
  });

  it('argumentos: compensação de atraso sempre; teto e pós-filtro só quando pedidos', () => {
    expect(deepFilterArgs('in.wav', 'out', settings)).toEqual(['-D', '-o', 'out', 'in.wav']);
    expect(deepFilterArgs('in.wav', 'out', { attenLimDb: 24, postFilter: true })).toEqual(['-D', '--pf', '-a', '24', '-o', 'out', 'in.wav']);
  });

  it('chave do cache: estável para a mesma fonte, muda com tamanho, mtime e parâmetros', () => {
    const source = { path: 'D:\\videos\\a.mp4', size: 1000, mtimeMs: 1700000000000.4 };
    const key = denoiseCacheKey(source, settings);
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(denoiseCacheKey({ ...source }, { ...settings })).toBe(key);
    expect(denoiseCacheKey({ ...source, size: 1001 }, settings)).not.toBe(key);
    expect(denoiseCacheKey({ ...source, mtimeMs: 1700000005000 }, settings)).not.toBe(key);
    expect(denoiseCacheKey(source, { ...settings, postFilter: true })).not.toBe(key);
    expect(denoiseCacheKey(source, { ...settings, attenLimDb: 30 })).not.toBe(key);
  });

  it('doctor: informa se o deep-filter está disponível, sem tratar a falta como erro', () => {
    const found = deepFilterCheck({ path: 'C:\\df\\deep-filter.exe', via: 'PATH', missing: null });
    expect(found.ok).toBe(true);
    expect(found.detail).toContain('C:\\df\\deep-filter.exe');
    const absent = deepFilterCheck({ path: null, via: null, missing: null });
    expect(absent).toMatchObject({ ok: false, required: false });
    expect(deepFilterCheck({ path: null, via: 'MCE_DEEPFILTER', missing: 'x.exe' }).detail).toContain('MCE_DEEPFILTER aponta para "x.exe"');
    const lines = doctorLines([{ name: 'ffmpeg', ok: true, detail: 'v7', required: true }, absent, { name: 'ffprobe', ok: false, detail: '-', required: true }]);
    expect(lines[0]).toMatch(/^ok\s+ffmpeg\s+v7$/);
    expect(lines[1]).toMatch(/^opcional\s+deep-filter/);
    expect(lines[2]).toMatch(/^FALTA\s+ffprobe/);
  });
});

describe('denoise: alinhamento', () => {
  it('correlação acha o atraso exato, para os dois lados', () => {
    const reference = noise(4000);
    expect(correlateLag(reference, shifted(reference, 37), -60, 60)).toMatchObject({ lag: 37 });
    expect(correlateLag(reference, shifted(reference, -12), -60, 60)).toMatchObject({ lag: -12 });
    expect(correlateLag(reference, reference, -5, 5).score).toBeCloseTo(1, 5);
  });

  it('estimativa em duas etapas: atraso típico do modelo (30 ms a 48 kHz) com ruído por cima', () => {
    const reference = noise(48000, 7);
    const extra = noise(48000, 99);
    const signal = shifted(reference, 1440).map((value, index) => value * 0.6 + extra[index]! * 0.2);
    const estimate = estimateDelay(reference, signal, 4800);
    expect(estimate.lag).toBe(1440);
    expect(estimate.score).toBeGreaterThan(0.5);
    expect(estimateDelay(reference, shifted(reference, -7), 4800).lag).toBe(-7);
  });

  it('sinais sem relação dão correlação baixa (o render cai para afftdn)', () => {
    expect(estimateDelay(noise(48000, 3), noise(48000, 4), 4800).score).toBeLessThan(0.05);
  });

  it('filtros de alinhamento fecham o arquivo no tamanho da fonte', () => {
    expect(alignFilters(1440, 96000)).toEqual(['atrim=start_sample=1440', 'asetpts=PTS-STARTPTS', 'apad', 'atrim=end_sample=96000']);
    expect(alignFilters(-20, 96000)).toEqual(['adelay=delays=20S:all=1', 'apad', 'atrim=end_sample=96000']);
    expect(alignFilters(0, 10)).toEqual(['apad', 'atrim=end_sample=10']);
  });

  it('energia por bloco, janela mais alta e decimação', () => {
    expect(rmsPerBlock(new Float32Array([1, -1, 0, 0, 0.5]), 2)).toEqual([1, 0, 0.5]);
    expect(loudestWindow([0, 0, 1, 2, 0, 0], 2)).toBe(2);
    expect(loudestWindow([1, 2], 5)).toBe(0);
    expect(Array.from(decimate(new Float32Array([1, 3, 2, 4, 9]), 2))).toEqual([2, 3]);
  });

  it('o corte pode tirar o áudio de outra entrada sem mexer no vídeo', () => {
    const timeline = buildTimeline([{ id: 'c1', start: 0.5, end: 2 }], 30);
    const options = { fps: 30, width: 640, height: 360, fadeMs: 12 };
    expect(buildCutGraph(timeline, options)).toContain('[0:a]aresample=48000');
    const graph = buildCutGraph(timeline, { ...options, audioInput: 2 });
    expect(graph).toContain('[2:a]aresample=48000');
    expect(graph).toContain('[0:v]fps=30');
    expect(graph).not.toContain('[0:a]');
  });
});
