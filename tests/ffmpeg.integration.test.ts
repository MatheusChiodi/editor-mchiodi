import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { run } from '../src/lib/exec.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { generateSfx, SFX_RECIPES } from '../src/assets/library.ts';
import { gainFilter, limiterFilter, SFX, voiceChain } from '../src/render/audio.ts';
import { compose, measureChain } from '../src/render/compose.ts';
import { renderCut } from '../src/render/cuts.ts';
import { gradeFilters, placeZooms, zoomFilters } from '../src/render/video.ts';

/**
 * Integração com o ffmpeg de verdade, em mídia sintética: garante que os grafos gerados são
 * aceitos e que a duração de vídeo e de áudio bate com a timeline (o bug clássico é o drift).
 */
const dir = mkdtempSync(join(tmpdir(), 'mce-ffmpeg-'));
const source = join(dir, 'source.mp4');
const cut = join(dir, 'cut.mkv');
const output = join(dir, 'out.mp4');
const bumper = join(dir, 'bumper.mp4');
const FPS = 30;
const sfxDir = { pop: join(dir, 'sfx', SFX.pop), whoosh: join(dir, 'sfx', SFX.whoosh) };

async function streamInfo(file: string, stream: string): Promise<{ frames: number; duration: number }> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-count_frames', '-select_streams', stream,
    '-show_entries', 'stream=nb_read_frames,duration', '-of', 'json', file,
  ]);
  const info = (JSON.parse(stdout) as { streams: { nb_read_frames?: string; duration?: string }[] }).streams[0]!;
  return { frames: Number(info.nb_read_frames ?? 0), duration: Number(info.duration ?? 0) };
}

const clips = [
  { id: 'c1', start: 0.513, end: 2.349 },
  { id: 'c2', start: 3.1234, end: 5.7777 },
  { id: 'c3', start: 7.001, end: 9.42 },
  { id: 'c4', start: 10.2, end: 11.61 },
];
const timeline = buildTimeline(clips, FPS);
const expectedFrames = Math.round(timeline.durationSec * FPS);

describe('ffmpeg (integração)', () => {
  beforeAll(async () => {
    // fonte a 60 fps com áudio a 44.1 kHz, como as gravações reais do canal
    await ffmpeg([
      '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=60:d=12',
      '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=44100:d=12',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', source,
    ]);
    await ffmpeg(['-f', 'lavfi', '-i', 'color=c=white:s=640x360:r=30:d=1', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', bumper]);
    const created = await generateSfx(dir);
    expect(created).toHaveLength(Object.keys(SFX_RECIPES).length);
    // segunda chamada não sobrescreve
    expect(await generateSfx(dir)).toEqual([]);
  }, 60_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('corte em passe único: vídeo e áudio com a duração exata da timeline, com transição', async () => {
    await renderCut(timeline, {
      source,
      output: cut,
      graphFile: join(dir, 'cut.graph.txt'),
      quality: 'preview',
      fps: FPS,
      width: 640,
      height: 360,
      fadeMs: 12,
      sourceFrames: 12 * FPS,
      transitions: [
        { intoClip: 'c2', type: 'cross-dissolve', duration: 0.4 },
        { intoClip: 'c4', type: 'whip-pan', duration: 0.3 },
      ],
    });
    const video = await streamInfo(cut, 'v:0');
    expect(video.frames).toBe(expectedFrames);
    // duração do áudio medida em amostras decodificadas, não em metadado do container
    const pcm = join(dir, 'cut.pcm');
    await ffmpeg(['-i', cut, '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', pcm]);
    const audioSeconds = statSync(pcm).size / 2 / 48000;
    expect(Math.abs(audioSeconds - timeline.durationSec)).toBeLessThan(0.002);
  }, 120_000);

  it('fade nas bordas elimina o degrau de amostra na junção do corte (estalo)', async () => {
    // senoide de 347 Hz: a 30 fps a fase muda a cada frame, então os cortes caem fora do cruzamento por zero
    // (frame 41 ≈ +pico, frame 56 ≈ -pico); o PCM na fonte evita o atraso de priming do AAC
    const sine = join(dir, 'sine.mkv');
    await ffmpeg([
      '-f', 'lavfi', '-i', 'color=c=gray:s=160x90:r=30:d=4',
      '-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*347*t)':s=48000:d=4",
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-shortest', sine,
    ]);
    // o clipe do meio tem 0.1 s: com 50 ms pedidos, o fade encolhe para 1/3 dele
    const sineTimeline = buildTimeline(
      [{ id: 'a', start: 0.5, end: 41 / 30 }, { id: 'b', start: 56 / 30, end: 59 / 30 }, { id: 'c', start: 71 / 30, end: 3.5 }],
      FPS,
    );
    const maxStep = async (fadeMs: number): Promise<number> => {
      const out = join(dir, `sine-${fadeMs}.mkv`);
      await renderCut(sineTimeline, {
        source: sine, output: out, graphFile: join(dir, `sine-${fadeMs}.graph.txt`),
        quality: 'preview', fps: FPS, width: 160, height: 90, fadeMs,
      });
      const pcm = join(dir, `sine-${fadeMs}.pcm`);
      await ffmpeg(['-i', out, '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', pcm]);
      const raw = readFileSync(pcm);
      let step = 0;
      for (let index = 1; index * 2 + 1 < raw.length; index += 1) {
        step = Math.max(step, Math.abs(raw.readInt16LE(index * 2) - raw.readInt16LE(index * 2 - 2)));
      }
      return step;
    };
    // maior degrau natural da senoide entre duas amostras
    const natural = 2 * Math.PI * (347 / 48000) * 0.5 * 32767;
    expect(await maxStep(0)).toBeGreaterThan(natural * 10);
    expect(await maxStep(50)).toBeLessThan(natural * 1.5);
    expect(await maxStep(12)).toBeLessThan(natural * 1.5);
  }, 120_000);

  it('a cadeia de áudio não desloca o som: um impulso sai no mesmo instante em que entrou', async () => {
    const audio = edlSchema.shape.audio.parse({});
    const pcm = join(dir, 'impulse.pcm');
    await ffmpeg([
      '-f', 'lavfi', '-i', "aevalsrc='if(between(t,1,1.0005),0.5,0)':s=48000:d=2",
      '-af', [...voiceChain(audio), limiterFilter(audio)].join(','),
      '-t', '2', '-ac', '1', '-ar', '48000', '-f', 's16le', pcm,
    ]);
    const raw = readFileSync(pcm);
    let peak = 0;
    let at = 0;
    for (let index = 0; index * 2 + 1 < raw.length; index += 1) {
      const value = Math.abs(raw.readInt16LE(index * 2));
      if (value > peak) {
        peak = value;
        at = index;
      }
    }
    expect(Math.abs(at / 48000 - 1) * 1000).toBeLessThan(1.5);
    // o apad repõe o que a compensação descartou: a duração não encolhe
    expect(raw.length / 2 / 48000).toBeCloseTo(2, 2);
  }, 60_000);

  it('composição: cor, zoom animado e normalização de áudio são aceitos e não mudam a duração', async () => {
    const edl = edlSchema.parse({
      version: 1,
      project: 'integracao',
      createdAt: '2026-10-12T00:00:00.000Z',
      source: { path: source, durationSec: 12, fps: 60, width: 640, height: 360 },
      output: { fps: FPS, width: 640, height: 360 },
      clips,
      zooms: [
        { id: 'z1', at: 1, duration: 1.2, scale: 1.15, mode: 'ease' },
        { id: 'z2', at: 7.5, duration: 1.5, scale: 1.1, mode: 'ken-burns' },
        { id: 'z3', at: 10.4, duration: 0.8, scale: 1.2, mode: 'punch' },
      ],
      grade: { preset: 'warm', exposure: 0.1, sharpen: 0.3 },
    });
    const voice = voiceChain(edl.audio);
    const measured = await measureChain(cut, voice);
    expect(Number.isFinite(measured.integratedLufs)).toBe(true);

    await compose({
      cut,
      overlay: null,
      // o próprio corte serve de "vinheta": exercita o concat com silêncio
      intro: null,
      outro: bumper,
      bumpers: { introSec: 0, outroSec: 1 },
      output,
      graphFile: join(dir, 'compose.graph.txt'),
      quality: 'preview',
      durationSec: timeline.durationSec,
      fps: FPS,
      width: 640,
      height: 360,
      videoFilters: [...gradeFilters(edl.grade), ...zoomFilters(placeZooms(edl.zooms, timeline), 640, 360)],
      voiceFilters: [...voice, gainFilter(measured.integratedLufs, edl.audio)],
      limiter: limiterFilter(edl.audio),
      // a própria fonte faz as vezes de trilha: exercita loop, ducking e mixagem
      music: { file: source, gainDb: -24, duck: true, fadeIn: 0.5, fadeOut: 1 },
      sfx: [
        { file: sfxDir.pop, at: 1.2, gainDb: -18 },
        { file: sfxDir.whoosh, at: 5.5, gainDb: -14 },
      ],
    });
    const video = await streamInfo(output, 'v:0');
    expect(video.frames).toBe(expectedFrames + FPS);
    const pcm = join(dir, 'out.pcm');
    await ffmpeg(['-i', output, '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', pcm]);
    expect(Math.abs(statSync(pcm).size / 2 / 48000 - (timeline.durationSec + 1))).toBeLessThan(0.05);
    const final = await measureChain(output, []);
    expect(Math.abs(final.integratedLufs - edl.audio.targetLufs)).toBeLessThan(1.5);
  }, 120_000);
});
