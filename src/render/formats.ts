import { join } from 'node:path';

import type { Edl } from '../edl/schema.ts';
import { SHORTS_SIZE } from './shorts.ts';

export const EXPORT_FORMATS = ['16x9', '9x16', '1x1'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const EXPORT_FITS = ['blur-pad', 'center-crop'] as const;
export type ExportFit = (typeof EXPORT_FITS)[number];
/** `full`: o vídeo inteiro reenquadrado; `shorts`: o trecho de `edl.shorts` pelo render de Short (gráficos re-diagramados) */
export type ExportScope = 'full' | 'shorts';

export interface ExportRequest {
  format: ExportFormat;
  fit?: ExportFit;
  /** 0 = esquerda, 1 = direita (recorte `center-crop` do vídeo inteiro) */
  focusX?: number;
  scope?: ExportScope;
}

export interface ExportPlan {
  format: ExportFormat;
  fit: ExportFit | null;
  scope: ExportScope;
  variant: 'main' | 'shorts';
  size: { width: number; height: number };
  /** linhas do filtergraph que levam `[vout]` (quadro 16:9 composto) a `[vfmt]`; null = sem reenquadrar */
  reformat: string[] | null;
  maxrateK: number;
  bufsizeK: number;
  /** pasta de trabalho dentro de renders/ */
  dirName: string;
  /** entrega: renders/<slug>-<formato>.mp4 e o .srt ao lado */
  file: string;
  srt: string;
}

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

/**
 * Teto de bitrate para celular: ~0,1 bit por pixel por frame, entre 2,5 e 10 Mb/s. Com CRF/CQ o encoder
 * continua decidindo a qualidade; o teto só impede picos que travam o player do celular e incham o upload.
 */
export function mobileBitrateK(width: number, height: number, fps: number): number {
  return Math.min(10_000, Math.max(2_500, Math.round((width * height * fps * 0.1) / 1000)));
}

export function exportSize(format: ExportFormat, output: Edl['output']): { width: number; height: number } {
  if (format === '16x9') return { width: output.width, height: output.height };
  if (format === '9x16') return { ...SHORTS_SIZE };
  const side = even(Math.min(output.height, 1080));
  return { width: side, height: side };
}

/** Recorte da proporção pedida em volta de `focusX`, mantendo a altura inteira (o quadro de origem é mais largo). */
export function centerCropChain(size: { width: number; height: number }, focusX: number): string {
  const focus = Math.min(1, Math.max(0, focusX)).toFixed(3);
  return `crop=w='trunc(ih*${size.width}/${size.height}/2)*2':h=ih:x='(iw-ow)*${focus}':y=0,scale=${size.width}:${size.height}:flags=lanczos,setsar=1`;
}

/**
 * Quadro inteiro encaixado no centro sobre uma cópia dele mesmo ampliada e desfocada: nada se perde
 * (legenda e gráficos 16:9 continuam inteiros). Rótulos com prefixo `fmt` (rótulos de filtergraph são globais).
 */
export function blurPadLines(size: { width: number; height: number }, input = '[vout]', output = '[vfmt]'): string[] {
  const { width, height } = size;
  const radius = Math.max(2, Math.round(Math.min(width, height) / 30));
  return [
    `${input}split=2[fmtbg0][fmtfg0]`,
    `[fmtbg0]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=luma_radius=${radius}:luma_power=2,eq=brightness=-0.06[fmtbg]`,
    `[fmtfg0]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos[fmtfg]`,
    `[fmtbg][fmtfg]overlay=x=(W-w)/2:y=(H-h)/2,setsar=1,format=yuv420p${output}`,
  ];
}

/**
 * Plano de exportação. Tudo passa pelo `mce render` (EDL → cortes → gráficos → composição): o reenquadramento
 * é o último filtro da composição, no mesmo encode, nunca um ffmpeg solto sobre o arquivo pronto.
 */
export function planExport(edl: Pick<Edl, 'output' | 'shorts'>, request: ExportRequest, rendersDir: string, slug: string): ExportPlan {
  const { format } = request;
  const scope: ExportScope = request.scope ?? 'full';
  if (scope === 'shorts' && format !== '9x16') throw new Error('o recorte do Short (scope shorts) só existe em 9x16');
  if (scope === 'shorts' && !edl.shorts) throw new Error('a EDL não define `shorts`; escolha o trecho antes (pnpm mce shorts suggest)');
  if (request.focusX !== undefined && (request.focusX < 0 || request.focusX > 1)) throw new Error('focusX vai de 0 a 1');
  const fit: ExportFit | null = format === '16x9' || scope === 'shorts' ? (scope === 'shorts' ? 'center-crop' : null) : (request.fit ?? 'blur-pad');
  const size = exportSize(format, edl.output);
  const reformat =
    format === '16x9' || scope === 'shorts'
      ? null
      : fit === 'center-crop'
        ? [`[vout]${centerCropChain(size, request.focusX ?? 0.5)},format=yuv420p[vfmt]`]
        : blurPadLines(size);
  const maxrateK = mobileBitrateK(size.width, size.height, edl.output.fps);
  const tag = `${format}${fit && format !== '16x9' ? `-${fit}` : ''}${scope === 'shorts' ? '-short' : ''}`;
  return {
    format,
    fit,
    scope,
    variant: scope === 'shorts' ? 'shorts' : 'main',
    size,
    reformat,
    maxrateK,
    bufsizeK: maxrateK * 2,
    dirName: `export-${tag}`,
    file: join(rendersDir, `${slug}-${format}.mp4`),
    srt: join(rendersDir, `${slug}-${format}.srt`),
  };
}
