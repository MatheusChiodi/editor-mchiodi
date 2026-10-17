import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { run } from '../lib/exec.ts';
import { ffmpeg, type ProgressFn, videoEncodeArgs } from '../lib/ffmpeg.ts';
import { parseRational, round3 } from '../lib/time.ts';
import type { ProjectPaths } from '../project/paths.ts';
import type { Loudness, MediaInfo, Span } from './types.ts';

interface ProbeStream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
}

export async function probe(path: string): Promise<MediaInfo> {
  if (!existsSync(path)) throw new Error(`Arquivo não encontrado: ${path}`);
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path,
  ]);
  const data = JSON.parse(stdout) as { streams: ProbeStream[]; format: { duration: string } };
  const video = data.streams.find((stream) => stream.codec_type === 'video');
  const audio = data.streams.find((stream) => stream.codec_type === 'audio');
  if (!video?.width || !video.height) throw new Error(`Sem trilha de vídeo em ${path}`);
  const nominal = parseRational(video.r_frame_rate ?? '0');
  const average = parseRational(video.avg_frame_rate ?? '0') || nominal;
  // gravações de celular/OBS em VFR: a taxa média foge da nominal
  const isVfr = nominal > 0 && Math.abs(nominal - average) / nominal > 0.005;
  return {
    path,
    durationSec: round3(Number(data.format.duration)),
    fps: roundFps(isVfr ? average : nominal),
    width: video.width,
    height: video.height,
    videoCodec: video.codec_name,
    isVfr,
    audioRate: Number(audio?.sample_rate ?? 0),
    audioChannels: audio?.channels ?? 0,
    hasAudio: Boolean(audio),
  };
}

/** 59.94 e 29.97 ficam como estão; 59.99 vira 60. */
function roundFps(fps: number): number {
  const common = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  const nearest = common.reduce((best, value) => (Math.abs(value - fps) < Math.abs(best - fps) ? value : best));
  return Math.abs(nearest - fps) < 0.2 ? nearest : Math.round(fps);
}

/**
 * Gera proxy 720p (análise e preview), wav 16 kHz mono (transcrição) e, se a fonte for VFR,
 * um intermediário CFR que passa a ser a fonte do render (cortes em VFR saem do sincronismo).
 */
export async function ingest(
  info: MediaInfo,
  paths: ProjectPaths,
  onProgress?: ProgressFn,
): Promise<{ renderSource: string }> {
  const proxyFps = info.fps > 30.5 ? info.fps / 2 : info.fps;
  const outputs = [
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', `fps=${proxyFps},scale=-2:720`,
    ...(await videoEncodeArgs('proxy')), '-g', String(Math.round(proxyFps)),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', paths.proxy,
    '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', paths.audio16k,
  ];
  let renderSource = info.path;
  if (info.isVfr) {
    renderSource = join(paths.analysisDir, 'source.cfr.mkv');
    outputs.push(
      '-map', '0:v:0', '-map', '0:a:0', '-vf', `fps=${info.fps}`,
      ...(await videoEncodeArgs('mezzanine')), '-c:a', 'pcm_s16le', '-ar', '48000', renderSource,
    );
  }
  await ffmpeg(['-i', info.path, ...outputs], {
    label: 'ingestão (proxy + áudio)',
    durationSec: info.durationSec,
    onProgress,
  });
  return { renderSource };
}

export async function measureLoudness(audioPath: string): Promise<Loudness> {
  const stderr = await ffmpeg([
    '-i', audioPath, '-vn', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-',
  ]);
  return parseLoudnorm(stderr);
}

export function parseLoudnorm(stderr: string): Loudness {
  const start = stderr.lastIndexOf('{');
  const end = stderr.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('loudnorm não devolveu medição');
  const json = JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
  return {
    integratedLufs: Number(json.input_i),
    truePeakDb: Number(json.input_tp),
    lra: Number(json.input_lra),
    threshold: Number(json.input_thresh),
  };
}

export async function detectSilences(audioPath: string, noiseDb: number, minDuration = 0.2): Promise<Span[]> {
  const stderr = await ffmpeg([
    '-i', audioPath, '-af', `silencedetect=noise=${noiseDb}dB:d=${minDuration}`, '-f', 'null', '-',
  ]);
  return parseSilences(stderr);
}

export function parseSilences(stderr: string): Span[] {
  const spans: Span[] = [];
  let open: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const start = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (start) open = Math.max(0, Number(start[1]));
    const end = /silence_end:\s*([\d.]+)/.exec(line);
    if (end && open !== null) {
      spans.push({ start: round3(open), end: round3(Number(end[1])) });
      open = null;
    }
  }
  return spans;
}

/** Trocas de cena no proxy (útil para vídeos com gravação de tela ou b-roll já embutido). */
export async function detectScenes(proxyPath: string, threshold = 0.35): Promise<number[]> {
  const stderr = await ffmpeg([
    '-i', proxyPath, '-an', '-vf', `select='gt(scene,${threshold})',showinfo`, '-f', 'null', '-',
  ]);
  const times: number[] = [];
  for (const match of stderr.matchAll(/pts_time:([\d.]+)/g)) times.push(round3(Number(match[1])));
  return times;
}
