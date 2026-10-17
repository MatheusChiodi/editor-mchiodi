import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTimeline } from '../src/edl/timeline.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { renderCut } from '../src/render/cuts.ts';
import { deepFilterVoice, type DeepFilterRunner, DEEPFILTER_RATE, MAX_DELAY_SEC, prepareDenoise, resolveDeepFilterBinary } from '../src/render/denoise.ts';

/**
 * Pré-passo do deep-filter em mídia sintética. Um "deep-filter" falso (ffmpeg atrasando o áudio
 * 30 ms, como o modelo sem compensação) prova que o atraso é medido e desfeito; o binário de verdade
 * só roda se estiver instalado.
 */
const dir = mkdtempSync(join(tmpdir(), 'mce-denoise-'));
const source = join(dir, 'source.mkv');
const settings = { attenLimDb: 100, postFilter: false };
const IMPULSE_SAMPLE = DEEPFILTER_RATE;

/** pico absoluto (posição em amostras) de um arquivo de áudio, decodificado em mono 48 kHz */
async function peakOf(file: string): Promise<{ at: number; samples: number; rms: number }> {
  const pcm = join(dir, `peak-${Date.now()}-${Math.random().toString(36).slice(2)}.pcm`);
  await ffmpeg(['-i', file, '-vn', '-ac', '1', '-ar', String(DEEPFILTER_RATE), '-f', 's16le', pcm]);
  const raw = readFileSync(pcm);
  let peak = 0;
  let at = 0;
  let sum = 0;
  for (let index = 0; index * 2 + 1 < raw.length; index += 1) {
    const value = raw.readInt16LE(index * 2);
    sum += value * value;
    if (Math.abs(value) > peak) {
      peak = Math.abs(value);
      at = index;
    }
  }
  const samples = raw.length / 2;
  return { at, samples, rms: Math.sqrt(sum / Math.max(1, samples)) / 32768 };
}

/** "deep-filter" que só desloca o áudio (negativo = adianta) e baixa o volume; o modelo de verdade atrasa ~30 ms */
function delayingRunner(delaySamples: number, calls: string[][]): DeepFilterRunner {
  return async (_binary, args) => {
    calls.push(args);
    const input = args.at(-1)!;
    const outDir = args[args.indexOf('-o') + 1]!;
    const shift = delaySamples >= 0 ? `adelay=delays=${delaySamples}S:all=1` : `atrim=start_sample=${-delaySamples},asetpts=PTS-STARTPTS`;
    await ffmpeg(['-i', input, '-af', `${shift},volume=0.7`, '-c:a', 'pcm_f32le', join(outDir, 'voice.wav')]);
  };
}

describe('denoise deep-filter (integração)', () => {
  beforeAll(async () => {
    // ruído (sinal largo, bom para correlacionar) + um impulso em 1 s; áudio a 44.1 kHz como as gravações
    await ffmpeg([
      '-f', 'lavfi', '-i', 'color=c=gray:s=160x90:r=30:d=3',
      '-f', 'lavfi', '-i', "aevalsrc='0.08*(random(0)-0.5)+if(between(t,1,1.00003),0.9,0)':s=48000:d=3",
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-ar', '44100', '-shortest', source,
    ]);
  }, 60_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('mede e desfaz o atraso do modelo: o impulso sai na mesma amostra, com o tamanho da fonte', async () => {
    const calls: string[][] = [];
    const cacheDir = join(dir, 'cache-a');
    const result = await deepFilterVoice(source, cacheDir, { ...settings, binary: 'fake', runner: delayingRunner(1440, calls) });
    expect(result.cached).toBe(false);
    expect(result.lag).toBe(1440);
    expect(result.score).toBeGreaterThan(0.9);
    expect(calls[0]!.slice(0, 1)).toEqual(['-D']);

    const original = await peakOf(source);
    const clean = await peakOf(result.file);
    expect(Math.abs(clean.at - original.at)).toBeLessThanOrEqual(1);
    expect(Math.abs(original.at - IMPULSE_SAMPLE)).toBeLessThanOrEqual(2);
    expect(clean.samples).toBe(original.samples);
    // só o WAV final e o registro do alinhamento ficam no cache
    expect(readdirSync(cacheDir).sort()).toEqual([expect.stringMatching(/\.json$/), expect.stringMatching(/\.wav$/)]);

    // segunda vez: cache, sem rodar o binário
    const again = await deepFilterVoice(source, cacheDir, { ...settings, binary: 'fake', runner: delayingRunner(1440, calls) });
    expect(again).toMatchObject({ cached: true, file: result.file });
    expect(calls).toHaveLength(1);
  }, 120_000);

  it('o corte usa a voz limpa no lugar do áudio da fonte, com a mesma duração', async () => {
    const result = await deepFilterVoice(source, join(dir, 'cache-b'), { ...settings, binary: 'fake', runner: delayingRunner(-300, []) });
    expect(result.lag).toBe(-300);
    const timeline = buildTimeline([{ id: 'c1', start: 0.5, end: 1.5 }, { id: 'c2', start: 2, end: 2.8 }], 30);
    const cut = join(dir, 'cut.mkv');
    await renderCut(timeline, {
      source, audioSource: result.file, output: cut, graphFile: join(dir, 'cut.graph.txt'),
      quality: 'preview', fps: 30, width: 160, height: 90, fadeMs: 0,
    });
    const info = await peakOf(cut);
    expect(Math.abs(info.samples / DEEPFILTER_RATE - timeline.durationSec)).toBeLessThan(0.002);
    // o impulso da fonte (1 s) cai em 0.5 s da saída: alinhado mesmo vindo de outra entrada
    expect(Math.abs(info.at - 0.5 * DEEPFILTER_RATE)).toBeLessThanOrEqual(2);
  }, 120_000);

  it('fallback: sem binário, binário quebrado ou saída sem relação com a voz caem para afftdn sem quebrar', async () => {
    const logs: string[] = [];
    const log = (message: string) => logs.push(message);
    const base = { ...settings, configPath: '', log };

    const missing = await prepareDenoise('deepfilter', source, join(dir, 'fb-1'), { ...base, lookup: { path: null, via: null, missing: null } });
    expect(missing).toMatchObject({ denoise: 'light', deepfilter: false, audioSource: null });
    expect(logs.at(-1)).toMatch(/não encontrado.*afftdn light/);

    const broken = await prepareDenoise('deepfilter', source, join(dir, 'fb-2'), {
      ...base,
      lookup: { path: 'fake', via: 'PATH', missing: null },
      runner: async () => {
        throw new Error('deep-filter saiu com código 1');
      },
    });
    expect(broken).toMatchObject({ denoise: 'light', audioSource: null });
    expect(logs.at(-1)).toMatch(/código 1.*afftdn light/);
    // a pasta de trabalho não fica para trás
    expect(readdirSync(join(dir, 'fb-2', 'denoise'))).toEqual([]);

    const unrelated = await prepareDenoise('deepfilter', source, join(dir, 'fb-3'), {
      ...base,
      lookup: { path: 'fake', via: 'PATH', missing: null },
      runner: async (_binary, args) => {
        const outDir = args[args.indexOf('-o') + 1]!;
        await ffmpeg(['-f', 'lavfi', '-i', 'anoisesrc=d=3:c=white:r=48000:a=0.1:seed=5', join(outDir, 'voice.wav')]);
      },
    });
    expect(unrelated).toMatchObject({ denoise: 'light', audioSource: null });
    expect(logs.at(-1)).toMatch(/correlação/);

    const plain = await prepareDenoise('medium', source, join(dir, 'fb-4'), base);
    expect(plain).toEqual({ denoise: 'medium', deepfilter: false, warning: null, audioSource: null });
    expect(existsSync(join(dir, 'fb-4'))).toBe(false);
  }, 120_000);
});

const real = resolveDeepFilterBinary({ env: process.env, configPath: '', platform: process.platform, exists: existsSync }).path;

describe.skipIf(!real)('denoise com o deep-filter instalado', () => {
  it('gera a voz limpa alinhada e com o tamanho da fonte', async () => {
    const voice = join(dir, 'voice.mkv');
    // vogal sintética (harmônicos de 140 Hz com envelope de sílaba) sobre ruído: o modelo preserva a voz
    await ffmpeg([
      '-f', 'lavfi', '-i', 'color=c=gray:s=160x90:r=30:d=6',
      '-f', 'lavfi', '-i',
      "aevalsrc='(0.25*sin(2*PI*140*t)+0.15*sin(2*PI*280*t)+0.1*sin(2*PI*420*t)+0.06*sin(2*PI*700*t))*gt(sin(2*PI*2.5*t),0)+0.03*(random(0)-0.5)':s=48000:d=6",
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-shortest', voice,
    ]);
    const result = await deepFilterVoice(voice, join(dir, 'cache-real'), { ...settings, binary: real! });
    expect(Math.abs(result.lag)).toBeLessThanOrEqual(MAX_DELAY_SEC * DEEPFILTER_RATE);
    expect(statSync(result.file).size).toBeGreaterThan(0);
    expect((await peakOf(result.file)).samples).toBe((await peakOf(voice)).samples);
  }, 300_000);
});
