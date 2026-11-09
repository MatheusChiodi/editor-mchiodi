import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { musicSamplePlan } from '../motion/src/music/sample.ts';
import { analyzeSpectrum, decodeMono, onsetEnvelope } from '../src/music/features.ts';
import { renderMusicVideo } from '../src/music/render.ts';
import { segmentSections } from '../src/music/sections.ts';
import { estimateTempo } from '../src/music/tempo.ts';

/** Música sintética de 24 s a 120 BPM: 12 s calmos (kick baixo) e 12 s fortes (kick alto + chimbal nos contratempos). */
const dir = mkdtempSync(join(tmpdir(), 'mce-music-'));
const wav = join(dir, 'song.wav');
const SR = 44100;
const SECONDS = 24;
const BPM = 120;
const FIRST_BEAT = 0.3;

function writeWav(path: string, samples: Float32Array, rate: number): void {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

beforeAll(() => {
  const samples = new Float32Array(SR * SECONDS);
  const period = 60 / BPM;
  for (let t = FIRST_BEAT; t < SECONDS; t += period) {
    const loud = t >= 12;
    const amp = loud ? 0.9 : 0.18;
    const start = Math.round(t * SR);
    for (let i = 0; i < SR * 0.25 && start + i < samples.length; i++) {
      const time = i / SR;
      // kick: seno que cai de 120 Hz para 50 Hz, com decaimento rápido
      const freq = 50 + 70 * Math.exp(-time * 30);
      samples[start + i]! += amp * Math.sin(2 * Math.PI * freq * time) * Math.exp(-time * 14);
    }
    if (loud) {
      const hat = Math.round((t + period / 2) * SR);
      for (let i = 0; i < SR * 0.04 && hat + i < samples.length; i++) samples[hat + i]! += 0.35 * (Math.random() * 2 - 1) * Math.exp(-(i / SR) * 90);
    }
  }
  writeWav(wav, samples, SR);
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('análise de música (áudio sintético)', () => {
  it('acha o tempo e a fase das batidas', async () => {
    const samples = await decodeMono(wav, 22050);
    expect(samples.length).toBeGreaterThan(22050 * 23);
    // como no pipeline: onset total mais o grave por quadro de vídeo
    const features = analyzeSpectrum(samples, 22050, { fps: 30 });
    const tempo = estimateTempo(onsetEnvelope(samples, 22050, 100), { bass: { rate: 30, values: features.bass } });
    expect(Math.abs(tempo.bpm - BPM)).toBeLessThanOrEqual(1);
    const phase = (((tempo.offsetSec - FIRST_BEAT) % 0.5) + 0.5) % 0.5;
    expect(Math.min(phase, 0.5 - phase)).toBeLessThan(0.06);
    expect(tempo.beats.length).toBeGreaterThan(40);
  }, 60_000);

  it('separa o trecho calmo do forte', async () => {
    const samples = await decodeMono(wav, 22050);
    const features = analyzeSpectrum(samples, 22050, { fps: 30 });
    const energy = features.rms.map((value, i) => 0.6 * value + 0.4 * features.bass[i]!);
    const sections = segmentSections(energy, 30, { minSec: 6 });
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections[0]!.energy).toBe('low');
    expect(sections.at(-1)!.energy).toBe('high');
    const boundary = sections.find((section) => section.energy === 'high')!.start;
    expect(Math.abs(boundary - 12)).toBeLessThan(3);
    // grave pulsa com o kick: depois da batida o valor é bem maior que no meio do intervalo
    const frame = (t: number) => Math.round(t * 30);
    expect(features.bass[frame(18.3 + 0.05)]!).toBeGreaterThan(features.bass[frame(18.3 + 0.35)]! + 0.1);
  }, 60_000);
});

describe('renderMusicVideo (Remotion + ffmpeg de verdade)', () => {
  it('gera mp4 com vídeo e a música original como áudio, na duração do plano', async () => {
    const output = join(dir, 'out.mp4');
    await renderMusicVideo(musicSamplePlan, wav, output, { workDir: dir, scale: 0.5, concurrency: 2 });
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-show_entries', 'format=duration', '-of', 'json', output], { encoding: 'utf8' });
    const info = JSON.parse(probe.stdout) as { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } };
    expect(info.streams.map((stream) => stream.codec_type).sort()).toEqual(['audio', 'video']);
    expect(info.streams.find((stream) => stream.codec_type === 'video')).toMatchObject({ width: 960, height: 540 });
    expect(Math.abs(Number(info.format.duration) - 8)).toBeLessThan(0.4);
  }, 240_000);
});
