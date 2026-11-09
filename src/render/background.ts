import { writeFileSync } from 'node:fs';

import { resolveAsset } from '../assets/library.ts';
import type { Background } from '../edl/schema.ts';
import { ffmpeg, type ProgressFn, videoEncodeArgs } from '../lib/ffmpeg.ts';
import type { Quality } from '../lib/ffmpeg.ts';

export interface FrameSpec {
  width: number;
  height: number;
  fps: number;
}

/** Só `chroma` dispensa o modelo: o ffmpeg gera o alfa a partir da cor. */
export function needsMatte(background: Background): boolean {
  return background.mode !== 'chroma';
}

/** Fração da resolução em que o RVM roda: ~512 px no maior lado (HD 0,27 · 4K 0,13), nunca amplia. */
export function autoDownsample(width: number, height: number): number {
  return Math.round(Math.min(1, 512 / Math.max(width, height)) * 1000) / 1000;
}

const hex = (color: string) => `0x${color.slice(1).toLowerCase()}`;

/**
 * Refino da máscara em escala de cinza. Opening (erosão e depois dilatação) tira respingos, como o
 * `post_process` do rembg; sem limiar duro: a borda macia do matting de vídeo fica melhor que um recorte binário.
 */
export function matteRefineFilters(matte: Pick<Background['matte'], 'opening' | 'feather'>): string {
  const parts = ['format=gray'];
  for (let i = 0; i < matte.opening; i++) parts.push('erosion');
  for (let i = 0; i < matte.opening; i++) parts.push('dilation');
  if (matte.feather > 0) parts.push(`gblur=sigma=${matte.feather}`);
  return parts.join(',');
}

const VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v|avi)$/i;

/** O que preenche o fundo novo: `chroma` escolhe pelo arquivo (imagem/vídeo) ou cai na cor lisa. */
export function fillKind(background: Background): 'color' | 'image' | 'video' | 'blur' {
  if (background.mode !== 'chroma') return background.mode;
  if (!background.file) return 'color';
  return VIDEO_EXT.test(background.file) ? 'video' : 'image';
}

/** chromakey + despill do canal dominante da cor chave (verde ou azul). */
export function chromaFilters(background: Background): string {
  const parts = [`chromakey=color=${hex(background.keyColor)}:similarity=${background.similarity}:blend=${background.edgeBlend}`];
  if (background.despill) {
    const r = parseInt(background.keyColor.slice(1, 3), 16);
    const g = parseInt(background.keyColor.slice(3, 5), 16);
    const b = parseInt(background.keyColor.slice(5, 7), 16);
    parts.push(`despill=type=${b > g && b > r ? 'blue' : 'green'}`);
  }
  return parts.join(',');
}

export interface BackgroundPlan {
  /** args de entrada extras, depois do corte (0) e da máscara (1, quando existe) */
  inputs: string[];
  graph: string;
  videoLabel: 'vbg';
}

/**
 * Grafo de troca de fundo. Entradas: 0 = corte; 1 = máscara (modos com modelo); a seguinte = fundo novo.
 * `assetPath` é o arquivo já resolvido de `image`/`video`.
 */
export function buildBackgroundGraph(background: Background, frame: FrameSpec, assetPath: string | null): BackgroundPlan {
  const { width, height, fps } = frame;
  const matte = needsMatte(background);
  const next = matte ? 2 : 1;
  const fit = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},setpts=PTS-STARTPTS,format=yuv420p`;
  const chain: string[] = [];
  let inputs: string[] = [];

  // frente: a pessoa com alfa
  if (matte) {
    const source = background.mode === 'blur' ? '[0:v]format=yuv420p,split=2[bgsrc][blursrc]' : '[0:v]format=yuv420p[bgsrc]';
    chain.push(source, `[1:v]${matteRefineFilters(background.matte)}[bgm]`, '[bgsrc][bgm]alphamerge[bgfg]');
  } else {
    chain.push(`[0:v]${chromaFilters(background)}[bgfg]`);
  }

  // fundo novo
  switch (fillKind(background)) {
    case 'blur':
      chain.push(`[blursrc]gblur=sigma=${background.blur}[bgbase]`);
      break;
    case 'image':
      inputs = ['-loop', '1', '-framerate', String(fps), '-i', assetPath!];
      chain.push(`[${next}:v]${fit}[bgbase]`);
      break;
    case 'video':
      inputs = ['-stream_loop', '-1', '-i', assetPath!];
      chain.push(`[${next}:v]${fit}[bgbase]`);
      break;
    default:
      inputs = ['-f', 'lavfi', '-i', `color=c=${hex(background.color)}:s=${width}x${height}:r=${fps}`];
      chain.push(`[${next}:v]format=yuv420p[bgbase]`);
  }

  chain.push('[bgbase][bgfg]overlay=shortest=1:format=auto,format=yuv420p[vbg]');
  return { inputs, graph: chain.join(';'), videoLabel: 'vbg' };
}

export interface ApplyBackgroundOptions {
  /** corte já no tempo de saída (cut.mkv) */
  input: string;
  /** máscara em escala de cinza do mesmo tamanho e fps; obrigatória nos modos com modelo */
  matte: string | null;
  output: string;
  graphFile: string;
  frame: FrameSpec;
  quality: Quality;
  durationSec: number;
  onProgress?: ProgressFn;
}

/** Troca o fundo do corte; o áudio passa intacto. */
export async function applyBackground(background: Background, options: ApplyBackgroundOptions): Promise<void> {
  let assetPath: string | null = null;
  if (fillKind(background) === 'image' || fillKind(background) === 'video') {
    assetPath = resolveAsset('backgrounds', background.file!);
    if (!assetPath) throw new Error(`Fundo não encontrado: assets/backgrounds/${background.file}`);
  }
  if (needsMatte(background) && !options.matte) throw new Error(`O modo "${background.mode}" precisa da máscara (matte)`);

  const plan = buildBackgroundGraph(background, options.frame, assetPath);
  writeFileSync(options.graphFile, plan.graph, 'utf8');
  await ffmpeg(
    [
      '-i', options.input,
      ...(needsMatte(background) ? ['-i', options.matte!] : []),
      ...plan.inputs,
      '-/filter_complex', options.graphFile,
      '-map', `[${plan.videoLabel}]`, '-map', '0:a?',
      ...(await videoEncodeArgs(options.quality)),
      '-c:a', 'copy',
      '-r', String(options.frame.fps),
      options.output,
    ],
    { label: 'fundo', durationSec: options.durationSec, onProgress: options.onProgress },
  );
}
