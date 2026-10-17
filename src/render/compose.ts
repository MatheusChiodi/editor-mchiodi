import { writeFileSync } from 'node:fs';

import { parseLoudnorm } from '../analyze/media.ts';
import type { Loudness } from '../analyze/types.ts';
import { ffmpeg, type ProgressFn, type Quality, videoEncodeArgs } from '../lib/ffmpeg.ts';
import { buildMixGraph, type MusicBed, type SfxCue } from './audio.ts';
import { buildBumperGraph, type Bumpers } from './bumpers.ts';
import { AUDIO_RATE } from './cuts.ts';
import { buildBrollGraph, buildLayoutGraph, type PlacedBroll, type PlacedLayout } from './layout.ts';

export interface ComposeGraphOptions {
  width: number;
  height: number;
  fps: number;
  /** duração do vídeo principal (sem vinhetas) */
  durationSec: number;
  /** filtros aplicados ao footage antes dos gráficos (cor, zoom, efeitos) */
  videoFilters: string[];
  hasOverlay: boolean;
  /** tratamento da voz + ganho de normalização */
  voiceFilters: string[];
  /** limitador aplicado à mixagem final */
  limiter: string;
  music: MusicBed | null;
  sfx: SfxCue[];
  hasIntro: boolean;
  hasOutro: boolean;
  bumpers: Bumpers;
  /** segmentos em que a gravação de tela entra (vazio = só câmera) */
  layout?: PlacedLayout[];
  /** b-roll por cima do footage, abaixo dos gráficos (`file` já resolvido) */
  broll?: PlacedBroll[];
  /** exportação em outro formato: linhas que levam o quadro pronto `[vout]` a `[vfmt]` (ver render/formats.ts) */
  reformat?: string[] | null;
}

type InputFlags = Pick<ComposeGraphOptions, 'hasOverlay' | 'music' | 'sfx' | 'hasIntro' | 'hasOutro' | 'layout' | 'broll'>;

/** Ordem das entradas do ffmpeg: 0 = corte, depois overlay, música, um por SFX, abertura, encerramento, tela gravada e um por b-roll. */
export function composeInputs(options: InputFlags) {
  let next = 1;
  const overlay = options.hasOverlay ? next++ : null;
  const music = options.music ? next++ : null;
  const sfx = options.sfx.map(() => next++);
  const intro = options.hasIntro ? next++ : null;
  const outro = options.hasOutro ? next++ : null;
  const screen = options.layout?.length ? next++ : null;
  const broll = (options.broll ?? []).map(() => next++);
  return { overlay, music, sfx, intro, outro, screen, broll };
}

/** Duração do arquivo final: vídeo principal + vinhetas. */
export function totalDuration(options: Pick<ComposeGraphOptions, 'durationSec' | 'hasIntro' | 'hasOutro' | 'bumpers'>): number {
  return options.durationSec + (options.hasIntro ? options.bumpers.introSec : 0) + (options.hasOutro ? options.bumpers.outroSec : 0);
}

/** Grafo final: footage tratado + camada de gráficos com alfa + mixagem de áudio (+ vinhetas). */
export function buildComposeGraph(options: ComposeGraphOptions): string {
  const size = `${options.width}:${options.height}`;
  const inputs = composeInputs(options);
  const base = [`scale=${size}:flags=lanczos`, ...options.videoFilters].join(',');
  const lines: string[] = [];
  // com tela gravada, a câmera tratada passa primeiro pela composição de layout
  let footage = '[0:v]';
  let prepared = base;
  if (inputs.screen !== null) {
    lines.push(
      `[0:v]${base}[camera]`,
      ...buildLayoutGraph({
        camera: '[camera]',
        screenInput: inputs.screen,
        layout: options.layout!,
        width: options.width,
        height: options.height,
        output: '[laid]',
      }),
    );
    footage = '[laid]';
    prepared = 'null';
  }
  // b-roll cobre o footage (câmera ou tela) e fica abaixo da camada de gráficos: a legenda continua por cima
  if (inputs.broll.length) {
    lines.push(
      `${footage}${prepared}[brbase]`,
      ...buildBrollGraph({ base: '[brbase]', inputs: inputs.broll, items: options.broll!, width: options.width, height: options.height, fps: options.fps, output: '[brolled]' }),
    );
    footage = '[brolled]';
    prepared = 'null';
  }
  if (inputs.overlay !== null) {
    lines.push(
      `${footage}${prepared}[base]`,
      // o overlay pode ter sido renderizado em escala menor (preview)
      `[${inputs.overlay}:v]scale=${size}:flags=bicubic[gfx]`,
      '[base][gfx]overlay=0:0:format=auto:eof_action=pass,format=yuv420p[vmain]',
    );
  } else {
    lines.push(`${footage}${prepared},format=yuv420p[vmain]`);
  }
  lines.push(
    `[0:a]${options.voiceFilters.length ? options.voiceFilters.join(',') : 'anull'}[voice]`,
    ...buildMixGraph({
      voice: '[voice]',
      musicInput: inputs.music,
      music: options.music,
      sfxInputs: inputs.sfx,
      sfx: options.sfx,
      durationSec: options.durationSec,
      limiter: options.limiter,
      rate: AUDIO_RATE,
      output: '[amain]',
    }),
    ...buildBumperGraph({
      video: '[vmain]',
      audio: '[amain]',
      introInput: inputs.intro,
      outroInput: inputs.outro,
      bumpers: options.bumpers,
      width: options.width,
      height: options.height,
      fps: options.fps,
      rate: AUDIO_RATE,
    }),
    ...(options.reformat ?? []),
  );
  return lines.join(';\n');
}

/** Mede o loudness do áudio depois de uma cadeia de filtros (1º passe da normalização). */
export async function measureChain(input: string, filters: string[]): Promise<Loudness> {
  const chain = [...filters, 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json'].join(',');
  return parseLoudnorm(await ffmpeg(['-i', input, '-vn', '-af', chain, '-f', 'null', '-']));
}

export interface ComposeOptions extends Omit<ComposeGraphOptions, 'hasOverlay' | 'hasIntro' | 'hasOutro'> {
  cut: string;
  overlay: string | null;
  intro: string | null;
  outro: string | null;
  /** gravação de tela já cortada (saída [scut] do grafo de cortes) */
  screen?: string | null;
  output: string;
  graphFile: string;
  quality: Quality;
  /** teto de bitrate (kb/s) da exportação para celular; bufsize = 2× */
  maxrateK?: number;
  onProgress?: ProgressFn;
}

export function composeArgs(options: Pick<ComposeOptions, 'cut' | 'overlay' | 'music' | 'sfx' | 'intro' | 'outro' | 'screen' | 'broll'>): string[] {
  return [
    '-i', options.cut,
    ...(options.overlay ? ['-i', options.overlay] : []),
    // a trilha repete até cobrir o vídeo; o atrim do grafo corta no fim
    ...(options.music ? ['-stream_loop', '-1', '-i', options.music.file] : []),
    ...options.sfx.flatMap((cue) => ['-i', cue.file]),
    ...(options.intro ? ['-i', options.intro] : []),
    ...(options.outro ? ['-i', options.outro] : []),
    ...(options.screen ? ['-i', options.screen] : []),
    // cada b-roll entra já posicionado no segundo `from` do arquivo; o grafo apara e desloca
    ...(options.broll ?? []).flatMap((item) => [...(item.from > 0 ? ['-ss', item.from.toFixed(3)] : []), '-i', item.file]),
  ];
}

export async function compose(options: ComposeOptions): Promise<void> {
  const graph: ComposeGraphOptions = {
    ...options,
    hasOverlay: options.overlay !== null,
    hasIntro: options.intro !== null,
    hasOutro: options.outro !== null,
    layout: options.screen ? options.layout : [],
  };
  const duration = totalDuration(graph);
  writeFileSync(options.graphFile, buildComposeGraph(graph), 'utf8');
  await ffmpeg(
    [
      ...composeArgs(options),
      '-/filter_complex', options.graphFile,
      '-map', options.reformat?.length ? '[vfmt]' : '[vout]', '-map', '[aout]',
      ...(await videoEncodeArgs(options.quality)),
      ...(options.maxrateK ? ['-maxrate', `${options.maxrateK}k`, '-bufsize', `${options.maxrateK * 2}k`] : []),
      '-c:a', 'aac', '-b:a', options.quality === 'final' ? '320k' : '160k', '-ar', String(AUDIO_RATE),
      '-t', duration.toFixed(3),
      '-movflags', '+faststart',
      options.output,
    ],
    { label: 'composição final', durationSec: duration, onProgress: options.onProgress },
  );
}
