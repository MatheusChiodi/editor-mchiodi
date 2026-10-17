import type { Edl } from '../edl/schema.ts';

/** Duração das vinhetas do canal, em segundos (componentes `Intro` e `Outro` da biblioteca). */
export const INTRO_SEC = 2.5;
export const OUTRO_SEC = 8;

export interface Bumpers {
  introSec: number;
  outroSec: number;
}

/** Quanto a vinheta de abertura desloca tudo que vem depois, e quanto o encerramento acrescenta. */
export function bumperDurations(edl: Pick<Edl, 'intro' | 'outro'>): Bumpers {
  return { introSec: edl.intro ? INTRO_SEC : 0, outroSec: edl.outro ? OUTRO_SEC : 0 };
}

export interface BumperGraphOptions {
  /** rótulos do vídeo/áudio principal já prontos */
  video: string;
  audio: string;
  introInput: number | null;
  outroInput: number | null;
  bumpers: Bumpers;
  width: number;
  height: number;
  fps: number;
  rate: number;
}

/**
 * Emenda abertura e encerramento ao vídeo principal no mesmo grafo (um único encode).
 * As vinhetas não têm áudio próprio: recebem silêncio para o concat fechar vídeo e áudio juntos.
 */
export function buildBumperGraph(options: BumperGraphOptions): string[] {
  const { introInput, outroInput } = options;
  if (introInput === null && outroInput === null) {
    return [`${options.video}null[vout]`, `${options.audio}anull[aout]`];
  }
  const lines: string[] = [];
  const parts: string[] = [];
  const add = (name: string, input: number, seconds: number) => {
    lines.push(
      `[${input}:v]fps=${options.fps},scale=${options.width}:${options.height}:flags=lanczos,setsar=1,format=yuv420p[${name}v]`,
      `anullsrc=r=${options.rate}:cl=stereo,atrim=0:${seconds.toFixed(3)}[${name}a]`,
    );
    parts.push(`[${name}v][${name}a]`);
  };
  if (introInput !== null) add('intro', introInput, options.bumpers.introSec);
  // o concat exige a mesma base de tempo e SAR em todos os trechos
  lines.push(`${options.video}fps=${options.fps},setsar=1[mainv]`);
  parts.push(`[mainv]${options.audio}`);
  if (outroInput !== null) add('outro', outroInput, options.bumpers.outroSec);
  lines.push(`${parts.join('')}concat=n=${parts.length}:v=1:a=1[vout][aout]`);
  return lines;
}
