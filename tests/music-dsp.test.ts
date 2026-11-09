import { describe, expect, it } from 'vitest';

import { Spectrum } from '../src/music/fft.ts';
import { analyzeSpectrum, bandRanges, expSmooth, onsetEnvelope, percentileNormalize } from '../src/music/features.ts';
import { segmentSections } from '../src/music/sections.ts';
import { estimateTempo } from '../src/music/tempo.ts';

const SR = 22050;

function tone(freq: number, seconds: number, amp = 0.8): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}

describe('Spectrum (FFT)', () => {
  it('seno de 1 kHz cai no bin certo', () => {
    const spectrum = new Spectrum(2048);
    const mags = spectrum.compute(tone(1000, 1), 0);
    const peak = mags.indexOf(Math.max(...mags));
    expect(peak).toBe(Math.round((1000 * 2048) / SR));
    expect(mags.length).toBe(1024);
  });
  it('além do fim do sinal preenche com zero (sem quebrar)', () => {
    const spectrum = new Spectrum(1024);
    const mags = spectrum.compute(new Float32Array(100).fill(0.5), 80);
    expect(mags.every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe('bandRanges', () => {
  it('graves 20–250 Hz, médios até 2 kHz, agudos até 8 kHz', () => {
    const { bass, mid, treble } = bandRanges(SR, 2048);
    expect(bass[0]).toBe(Math.round((20 * 2048) / SR));
    expect(bass[1]).toBe(mid[0]);
    expect(mid[1]).toBe(treble[0]);
    expect(treble[1]).toBe(Math.round((8000 * 2048) / SR));
  });
});

describe('analyzeSpectrum', () => {
  it('grave puro acende o grave; agudo puro acende o agudo', () => {
    const low = analyzeSpectrum(tone(80, 2), SR, { fps: 30 });
    const high = analyzeSpectrum(tone(5000, 2), SR, { fps: 30 });
    const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    expect(avg(low.bass)).toBeGreaterThan(avg(low.treble) * 3);
    expect(avg(high.treble)).toBeGreaterThan(avg(high.bass) * 3);
    expect(low.frames).toBe(60);
    expect(low.bars[0]).toHaveLength(16);
    for (const value of [...low.bass, ...low.mid, ...low.treble, ...low.rms]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('expSmooth (ExpFilter do audio-reactive-led-strip)', () => {
  it('sobe rápido e desce devagar', () => {
    const out = expSmooth([0, 1, 1, 0, 0, 0], 0.8, 0.2);
    expect(out[1]).toBeCloseTo(0.8, 6);
    expect(out[3]).toBeGreaterThan(0.5);
    expect(out[5]!).toBeLessThan(out[3]!);
  });
});

describe('percentileNormalize', () => {
  it('leva o percentil 95 a 1 e limita em [0,1]', () => {
    const values = Array.from({ length: 100 }, (_, index) => index);
    const out = percentileNormalize(values, 0.95);
    expect(Math.max(...out)).toBe(1);
    expect(out[0]).toBe(0);
    expect(out[50]).toBeCloseTo(50 / 94, 1);
  });
  it('sinal silencioso não vira NaN', () => {
    expect(percentileNormalize([0, 0, 0], 0.95)).toEqual([0, 0, 0]);
  });
});

/** Envelope sintético com impulsos em `bpm`, a partir de `offset` s, a 100 quadros/s. */
function pulses(bpm: number, offset: number, seconds: number, rate = 100) {
  const values = new Array<number>(Math.round(seconds * rate)).fill(0);
  const period = 60 / bpm;
  for (let t = offset; t < seconds; t += period) values[Math.round(t * rate)] = 1;
  return { rate, values };
}

describe('estimateTempo', () => {
  it('acha 120 BPM e a fase', () => {
    const tempo = estimateTempo(pulses(120, 0.2, 30));
    expect(tempo.bpm).toBeCloseTo(120, 0);
    expect(tempo.offsetSec).toBeCloseTo(0.2, 1);
    expect(tempo.beats[0]).toBeCloseTo(0.2, 1);
    expect(tempo.beats[1]! - tempo.beats[0]!).toBeCloseTo(0.5, 1);
  });
  it('acha 128 BPM', () => {
    expect(estimateTempo(pulses(128, 0.1, 30)).bpm).toBeCloseTo(128, 0);
  });
  it('60 BPM é dobrado para a faixa (oitava)', () => {
    expect(estimateTempo(pulses(60, 0.3, 40)).bpm).toBeCloseTo(120, 0);
  });
  it('compassos: o tempo forte é o que cai no grave', () => {
    const envelope = pulses(120, 0, 30);
    const bass = new Array<number>(envelope.values.length).fill(0.1);
    // tempo forte a cada 4 batidas, começando na batida 2 (t = 1 s)
    for (let t = 1; t < 30; t += 2) bass[Math.round(t * 100)] = 1;
    const tempo = estimateTempo(envelope, { bass: { rate: 100, values: bass } });
    expect(tempo.downbeats[0]).toBeCloseTo(1, 1);
    expect(tempo.downbeats[1]! - tempo.downbeats[0]!).toBeCloseTo(2, 1);
  });
  it('envelope vazio não quebra', () => {
    const tempo = estimateTempo({ rate: 100, values: new Array(500).fill(0) });
    expect(tempo.beats).toEqual([]);
    expect(tempo.confidence).toBe(0);
  });
});

describe('onsetEnvelope', () => {
  it('um clique no meio do silêncio gera um pico de onset ali', () => {
    const samples = new Float32Array(SR * 2);
    for (let i = 0; i < 400; i++) samples[SR + i] = Math.sin(i * 0.9) * 0.9;
    const env = onsetEnvelope(samples, SR, 100);
    const peak = env.values.indexOf(Math.max(...env.values));
    expect(Math.abs(peak / env.rate - 1)).toBeLessThan(0.05);
  });
});

describe('segmentSections', () => {
  const fps = 30;
  const curve = (...parts: [number, number][]) => parts.flatMap(([seconds, level]) => new Array<number>(Math.round(seconds * fps)).fill(level));

  it('um degrau de energia vira fronteira entre seções', () => {
    const sections = segmentSections(curve([20, 0.15], [20, 0.9], [20, 0.15]), fps);
    expect(sections.length).toBeGreaterThanOrEqual(3);
    const high = sections.find((section) => section.energy === 'high')!;
    expect(high.start).toBeGreaterThan(17);
    expect(high.start).toBeLessThan(23);
    expect(sections[0]!.energy).toBe('low');
    expect(sections.at(-1)!.energy).toBe('low');
  });
  it('cobre a música inteira, sem buracos nem seção curta demais', () => {
    const sections = segmentSections(curve([15, 0.2], [18, 0.8], [12, 0.3], [25, 0.7]), fps);
    expect(sections[0]!.start).toBe(0);
    expect(sections.at(-1)!.end).toBeCloseTo(70, 1);
    sections.forEach((section, index) => {
      expect(section.end - section.start).toBeGreaterThanOrEqual(7.9);
      if (index > 0) expect(section.start).toBeCloseTo(sections[index - 1]!.end, 6);
    });
  });
  it('energia constante é uma seção só', () => {
    expect(segmentSections(curve([60, 0.5]), fps)).toHaveLength(1);
  });
});

describe('bassOnsets (batidas pelos golpes reais do grave)', () => {
  it('um pico por golpe, sem pegar o decaimento, e tempos fortes entre os mais fortes', async () => {
    const { bassOnsets } = await import('../src/music/tempo.ts');
    const fps = 30;
    const series = new Array<number>(fps * 20).fill(0.05);
    // golpes a cada 0.5 s; o primeiro de cada 2 s é mais forte
    for (let t = 0.5; t < 19.5; t += 0.5) {
      const strong = Math.abs(t % 2) < 1e-9;
      const peak = Math.round(t * fps);
      for (let k = 0; k < 8; k++) series[peak + k] = Math.max(series[peak + k]!, (strong ? 1 : 0.55) * Math.exp(-k / 3));
    }
    const { beats, downbeats } = bassOnsets(series, fps);
    expect(beats.length).toBeGreaterThanOrEqual(36);
    expect(beats.length).toBeLessThanOrEqual(40);
    expect(Math.abs(beats[0]! - 0.5)).toBeLessThan(0.1);
    expect(downbeats.length).toBeGreaterThanOrEqual(8);
    for (const down of downbeats) expect(Math.abs(((down + 0.001) % 2))).toBeLessThan(0.15);
  });
  it('sinal chapado não gera batidas', async () => {
    const { bassOnsets } = await import('../src/music/tempo.ts');
    expect(bassOnsets(new Array(300).fill(0.5), 30).beats).toEqual([]);
  });
});
