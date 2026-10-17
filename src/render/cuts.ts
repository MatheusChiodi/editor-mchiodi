import { writeFileSync } from 'node:fs';

import { transitions, xfadeArgs } from '../arsenal/transitions.ts';
import type { Transition } from '../edl/schema.ts';
import type { Timeline } from '../edl/timeline.ts';
import { ffmpeg, type ProgressFn, type Quality, videoEncodeArgs } from '../lib/ffmpeg.ts';

export const AUDIO_RATE = 48000;

/** Duração efetiva da transição: a pedida na EDL ou a padrão do preset. */
export function transitionDuration(transition: Pick<Transition, 'type' | 'duration'>): number {
  return transition.duration ?? transitions[transition.type]?.defaultDuration ?? 0.4;
}

export interface CutGraphOptions {
  fps: number;
  width: number;
  height: number;
  /** fade em cada borda de corte, em ms; elimina o estalo sem bombear a fala */
  fadeMs: number;
  transitions?: Pick<Transition, 'intoClip' | 'type' | 'duration'>[];
  /** total de frames da fonte (no fps de saída), para a transição não pedir frame que não existe */
  sourceFrames?: number;
  /** cadeia que leva o quadro da fonte ao tamanho de saída; padrão: só redimensionar (o Short recorta em 9:16) */
  prep?: string;
  /**
   * Gravação de tela (entrada 1 do ffmpeg) cortada nos mesmos pontos da câmera, saindo em [scut].
   * `align` é a cadeia que a coloca na linha do tempo da câmera (ver `screenAlign`).
   */
  screen?: { align: string };
  /** entrada do ffmpeg de onde vem o áudio (padrão 0, a própria fonte); a voz limpa do deep-filter entra à parte */
  audioInput?: number;
}

export interface PlannedTransition {
  /** índice do clipe em que a transição entra */
  index: number;
  /** id do preset no catálogo */
  type: string;
  /** frames emprestados de cada lado do corte */
  half: number;
}

/**
 * Uma transição precisa de imagem dos dois lados do corte ao mesmo tempo. Cada clipe "empresta"
 * `half` frames além da sua borda (só no vídeo; o áudio continua cortando no ponto exato),
 * e o xfade consome esses 2×half frames: a duração total não muda.
 * Só vale para presets do tipo `xfade`.
 */
export function planTransitions(timeline: Timeline, options: CutGraphOptions): PlannedTransition[] {
  const planned: PlannedTransition[] = [];
  for (const transition of options.transitions ?? []) {
    // stinger cobre a tela na camada de gráficos: por baixo o corte continua seco
    if (transitions[transition.type]?.kind !== 'xfade') continue;
    const index = timeline.clips.findIndex((clip) => clip.id === transition.intoClip);
    if (index <= 0) continue;
    const before = timeline.clips[index - 1]!;
    const after = timeline.clips[index]!;
    const room = Math.min(
      Math.floor((before.endFrame - before.startFrame) / 3),
      Math.floor((after.endFrame - after.startFrame) / 3),
      after.startFrame,
      options.sourceFrames === undefined ? Infinity : options.sourceFrames - before.endFrame,
    );
    const half = Math.min(Math.round((transitionDuration(transition) * options.fps) / 2), room);
    if (half >= 1) planned.push({ index, type: transition.type, half });
  }
  return planned.sort((a, b) => a.index - b.index);
}

/**
 * Duração do fade de áudio em cada borda de um clipe de `lengthSec`. Clipe curto não perde o fade
 * (seria estalo garantido): ele encolhe até 1/3 do clipe, e os dois fades nunca se sobrepõem.
 */
export function edgeFadeSec(lengthSec: number, fadeSec: number): number {
  if (fadeSec <= 0 || lengthSec <= 0) return 0;
  return Number(Math.min(fadeSec, lengthSec / 3).toFixed(6));
}

/**
 * Filtergraph de corte em passe único: decodifica a fonte uma vez, recorta por índice de
 * frame/amostra e concatena. Recortar por tempo (ou concatenar segmentos já encodados com
 * -c copy) acumula drift entre vídeo e áudio a cada corte.
 */
export function buildCutGraph(timeline: Timeline, options: CutGraphOptions): string {
  const count = timeline.clips.length;
  if (count === 0) throw new Error('Timeline sem clipes');
  const { fps } = options;
  const labels = (prefix: string) => timeline.clips.map((_, index) => `[${prefix}${index}]`).join('');
  const fade = options.fadeMs / 1000;
  const planned = planTransitions(timeline, options);
  const into = new Map(planned.map((transition) => [transition.index, transition]));

  const lines: string[] = [
    `[0:v]fps=${fps}:start_time=0,${options.prep ?? `scale=${options.width}:${options.height}:flags=lanczos,setsar=1`},format=yuv420p,split=${count}${labels('vs')}`,
    // first_pts=0 alinha o áudio ao zero do vídeo: os recortes abaixo contam amostras
    `[${options.audioInput ?? 0}:a]aresample=${AUDIO_RATE}:async=1:first_pts=0,aformat=channel_layouts=stereo,asplit=${count}${labels('as')}`,
  ];

  const videoLength: number[] = [];
  timeline.clips.forEach((clip, index) => {
    const startFrame = clip.startFrame - (into.get(index)?.half ?? 0);
    const endFrame = clip.endFrame + (into.get(index + 1)?.half ?? 0);
    videoLength.push(endFrame - startFrame);

    const startSample = Math.round((clip.startFrame / fps) * AUDIO_RATE);
    const endSample = Math.round((clip.endFrame / fps) * AUDIO_RATE);
    const length = (endSample - startSample) / AUDIO_RATE;
    const audio = [`atrim=start_sample=${startSample}:end_sample=${endSample}`, 'asetpts=PTS-STARTPTS'];
    const edge = edgeFadeSec(length, fade);
    if (edge > 0) {
      audio.push(`afade=t=in:st=0:d=${edge}`, `afade=t=out:st=${(length - edge).toFixed(6)}:d=${edge}`);
    }
    lines.push(
      `[vs${index}]trim=start_frame=${startFrame}:end_frame=${endFrame},setpts=PTS-STARTPTS[v${index}]`,
      `[as${index}]${audio.join(',')}[a${index}]`,
    );
  });

  // vídeo: clipes sem transição entre si formam um bloco (concat); blocos se unem por xfade
  const runs: { clips: number[]; frames: number; transition: PlannedTransition | null }[] = [];
  timeline.clips.forEach((_, index) => {
    const transition = into.get(index) ?? null;
    if (index === 0 || transition) runs.push({ clips: [], frames: 0, transition });
    const run = runs.at(-1)!;
    run.clips.push(index);
    run.frames += videoLength[index]!;
  });
  const single = runs.length === 1;
  runs.forEach((run, index) => {
    const inputs = run.clips.map((clip) => `[v${clip}]`).join('');
    const out = single ? '[vcut]' : `[r${index}]`;
    // o fps no fim iguala a base de tempo dos blocos, exigência do xfade
    lines.push(`${inputs}concat=n=${run.clips.length}:v=1:a=0,fps=${fps}${out}`);
  });
  let accumulated = runs[0]!.frames;
  let current = '[r0]';
  runs.slice(1).forEach((run, offset) => {
    const { half, type } = run.transition!;
    const last = offset === runs.length - 2;
    const out = last ? '[vcut]' : `[x${offset}]`;
    lines.push(
      `${current}[r${offset + 1}]xfade=${xfadeArgs(transitions[type]!)}:duration=${((half * 2) / fps).toFixed(6)}:offset=${((accumulated - half * 2) / fps).toFixed(6)}${out}`,
    );
    accumulated += run.frames - half * 2;
    current = out;
  });

  lines.push(`${labels('a')}concat=n=${count}:v=0:a=1[acut]`);

  if (options.screen) {
    lines.push(
      `[1:v]${options.screen.align},scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2:color=0x0c0c0c,setsar=1,format=yuv420p,split=${count}${labels('ss')}`,
    );
    // a tela corta seco mesmo onde a câmera tem transição: os mesmos frames, sem empréstimo
    timeline.clips.forEach((clip, index) => {
      lines.push(`[ss${index}]trim=start_frame=${clip.startFrame}:end_frame=${clip.endFrame},setpts=PTS-STARTPTS[sv${index}]`);
    });
    lines.push(`${labels('sv')}concat=n=${count}:v=1:a=0,fps=${fps}[scut]`);
  }
  return lines.join(';\n');
}

export interface RenderCutOptions extends CutGraphOptions {
  source: string;
  output: string;
  /** arquivo da gravação de tela e onde gravar a versão cortada (exige `screen` nas opções do grafo) */
  screenSource?: string;
  screenOutput?: string;
  /** áudio alinhado amostra a amostra com a fonte (WAV do deep-filter) que substitui o dela */
  audioSource?: string;
  graphFile: string;
  quality: Quality;
  onProgress?: ProgressFn;
}

/** Gera o intermediário cortado (vídeo de alta qualidade + áudio PCM, sem perdas no áudio). */
export async function renderCut(timeline: Timeline, options: RenderCutOptions): Promise<void> {
  const withScreen = Boolean(options.screen && options.screenSource && options.screenOutput);
  const audioInput = options.audioSource ? (withScreen ? 2 : 1) : 0;
  writeFileSync(options.graphFile, buildCutGraph(timeline, { ...options, audioInput }), 'utf8');
  const encode = await videoEncodeArgs(options.quality);
  await ffmpeg(
    [
      '-i', options.source,
      ...(withScreen ? ['-i', options.screenSource!] : []),
      ...(options.audioSource ? ['-i', options.audioSource] : []),
      // 300 cortes passam do limite de linha de comando do Windows: o grafo vai por arquivo
      '-/filter_complex', options.graphFile,
      '-map', '[vcut]', '-map', '[acut]',
      ...encode,
      '-c:a', 'pcm_s16le', '-ar', String(AUDIO_RATE),
      options.output,
      ...(withScreen ? ['-map', '[scut]', ...encode, '-an', options.screenOutput!] : []),
    ],
    { label: 'cortes', durationSec: timeline.durationSec, onProgress: options.onProgress },
  );
}
