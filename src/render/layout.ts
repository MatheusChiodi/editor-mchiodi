import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

import type { PlacedPush } from '../../motion/src/arsenal/stage.ts';
import type { Edl } from '../edl/schema.ts';
import type { Timeline } from '../edl/timeline.ts';
import { pushSumExpr } from './reframe.ts';

/** `window` não vem da EDL: nasce de um overlay `WindowStage` com `kind: "screen"` (src/render/reframe.ts) */
export type LayoutMode = 'camera' | 'screen' | 'pip' | 'split' | 'window';
export type PipCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PlacedLayout {
  /** segundos do vídeo final */
  start: number;
  end: number;
  mode: LayoutMode;
  pipCorner: PipCorner;
  /** só `window`: onde a tela entra, normalizado (0–1) */
  rect?: { x: number; y: number; w: number; h: number };
  /** só `window`: zooms da tela dentro da janela, com tempos relativos a `origin` (início do overlay no vídeo final) */
  pushes?: PlacedPush[];
  origin?: number;
}

/**
 * Segmentos de layout no tempo de saída. Um segmento da fonte pode atravessar vários cortes:
 * vira um intervalo por clipe que ele toca.
 */
export function placeLayout(segments: Edl['layout']['segments'], timeline: Timeline): PlacedLayout[] {
  const placed: PlacedLayout[] = [];
  for (const segment of segments) {
    if (segment.mode === 'camera') continue;
    for (const clip of timeline.clips) {
      const start = Math.max(segment.start, clip.sourceStart);
      const end = Math.min(segment.end, clip.sourceEnd);
      if (end - start < 1 / timeline.fps) continue;
      placed.push({
        start: clip.outputStart + (start - clip.sourceStart),
        end: clip.outputStart + (end - clip.sourceStart),
        mode: segment.mode,
        pipCorner: segment.pipCorner,
      });
    }
  }
  return placed.sort((a, b) => a.start - b.start);
}

/** Expressão do ffmpeg que vale 1 enquanto algum dos intervalos está ativo. */
export function enableExpr(spans: { start: number; end: number }[]): string {
  if (spans.length === 0) return '0';
  return spans.map((span) => `between(t,${span.start.toFixed(3)},${span.end.toFixed(3)})`).join('+');
}

const even = (value: number) => Math.round(value / 2) * 2;

export const PIP_SCALE = 0.26;
export const PIP_MARGIN = 0.03;
export const SPLIT_SCREEN = 0.64;

/** Posição do quadro pequeno da câmera, em pixels. */
export function pipPosition(corner: PipCorner, width: number, height: number): { x: number; y: number; w: number; h: number } {
  const w = even(width * PIP_SCALE);
  const h = even((w * height) / width);
  const margin = Math.round(width * PIP_MARGIN);
  return {
    w,
    h,
    x: corner.endsWith('left') ? margin : width - w - margin,
    y: corner.startsWith('top') ? margin : height - h - margin,
  };
}

export interface LayoutGraphOptions {
  /** rótulo da câmera já tratada (cor, zoom) */
  camera: string;
  /** índice da entrada do ffmpeg com a gravação de tela já cortada */
  screenInput: number;
  layout: PlacedLayout[];
  width: number;
  height: number;
  /** rótulo de saída */
  output: string;
}

/** Segmentos `window` agrupados pela posição da janela (a normal e a espelhada). */
export function windowGroups(layout: PlacedLayout[]): PlacedLayout[][] {
  const groups = new Map<string, PlacedLayout[]>();
  for (const item of layout) {
    if (!item.rect) continue;
    const key = [item.rect.x, item.rect.y, item.rect.w, item.rect.h].map((value) => value.toFixed(4)).join(':');
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
}

/**
 * Compõe câmera e gravação de tela conforme o segmento ativo:
 * `screen` = tela cheia; `pip` = tela cheia + câmera pequena num canto; `split` = tela à esquerda, câmera à direita.
 * Fora dos segmentos, só a câmera.
 */
export function buildLayoutGraph(options: LayoutGraphOptions): string[] {
  const { width, height, layout } = options;
  const of = (mode: LayoutMode) => layout.filter((item) => item.mode === mode);
  const corners = [...new Set(of('pip').map((item) => item.pipCorner))];
  const split = of('split');
  const fullScreen = [...of('screen'), ...of('pip')];
  const windows = windowGroups(of('window'));
  const cameraCopies = 1 + corners.length + (split.length ? 1 : 0);
  const screenCopies = 1 + (split.length ? 1 : 0) + windows.length;
  const lines: string[] = [
    `${options.camera}split=${cameraCopies}[lcam0]${corners.map((_, index) => `[lpipsrc${index}]`).join('')}${split.length ? '[lsplitcam]' : ''}`,
    // a tela pode ter outra proporção: encaixa inteira e completa com fundo escuro
    `[${options.screenInput}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0c0c0c,setsar=1,split=${screenCopies}[lscr0]${split.length ? '[lsplitscr]' : ''}${windows.map((_, index) => `[lwinscr${index || ''}]`).join('')}`,
    `[lcam0][lscr0]overlay=0:0:enable='${enableExpr(fullScreen)}'[lstep0]`,
  ];
  let current = '[lstep0]';
  corners.forEach((corner, index) => {
    const box = pipPosition(corner, width, height);
    const spans = of('pip').filter((item) => item.pipCorner === corner);
    lines.push(
      // moldura clara fina em volta da câmera, para ela não se fundir à tela gravada
      `[lpipsrc${index}]scale=${box.w - 8}:${box.h - 8}:flags=lanczos,pad=${box.w}:${box.h}:4:4:color=0xf8f8f2[lpip${index}]`,
      `${current}[lpip${index}]overlay=${box.x}:${box.y}:enable='${enableExpr(spans)}'[lstep${index + 1}]`,
    );
    current = `[lstep${index + 1}]`;
  });
  if (split.length) {
    const screenWidth = even(width * SPLIT_SCREEN);
    const cameraWidth = width - screenWidth;
    lines.push(
      `[lsplitscr]scale=${screenWidth}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${screenWidth}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0c0c0c[lsplitleft]`,
      // a câmera perde as laterais: o rosto fica no centro do quadro
      `[lsplitcam]crop=${cameraWidth}:${height}:(iw-${cameraWidth})/2:0[lsplitright]`,
      '[lsplitleft][lsplitright]hstack=inputs=2[lsplit]',
      `${current}[lsplit]overlay=0:0:enable='${enableExpr(split)}'[lsplitout]`,
    );
    current = '[lsplitout]';
  }
  // a janela é desenhada pela camada de gráficos; aqui a tela só ocupa o corpo dela (o papel cobre o resto).
  // Um ramo por posição de janela (normal e espelhada); os zooms de todos os overlays daquela posição somam numa expressão só.
  windows.forEach((group, index) => {
    const tag = index || '';
    const rect = group[0]!.rect!;
    const w = even(width * rect.w);
    const h = even(height * rect.h);
    const fit = `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0c0c0c`;
    const pushed = group.filter((item) => item.pushes?.length);
    if (pushed.length === 0) {
      lines.push(`[lwinscr${tag}]${fit}[lwin${tag}]`);
    } else {
      // cada overlay só soma enquanto a tela dele está visível: um zoom sem volta não vaza para a janela seguinte
      const sum = (weight: (push: PlacedPush) => number) =>
        pushed.map((item) => `gte(t,${item.start.toFixed(3)})*lt(t,${item.end.toFixed(3)})*(${pushSumExpr(item.pushes!, item.origin ?? item.start, weight)})`).join('+');
      const zoom = `(1+${sum((push) => push.scale - 1)})`;
      lines.push(
        `[lwinscr${tag}]split=2[lwfit${tag}][lwsrc${tag}]`,
        `[lwfit${tag}]${fit}[lwbase${tag}]`,
        // escala por frame a partir da tela em tamanho cheio (não do corpo já reduzido), com 2 px de sobra para nunca abrir fresta
        `[lwsrc${tag}]scale=w='trunc(${w}*${zoom}/2)*2+2':h='trunc(${h}*${zoom}/2)*2+2':eval=frame:flags=bicubic[lwzoom${tag}]`,
        // o ponto-alvo fica parado: a tela ampliada recua na proporção da âncora (mesma conta de `pushAt`)
        `[lwbase${tag}][lwzoom${tag}]overlay=x='-${w}*(${sum((push) => push.x * (push.scale - 1))})':y='-${h}*(${sum((push) => push.y * (push.scale - 1))})':eval=frame[lwin${tag}]`,
      );
    }
    lines.push(`${current}[lwin${tag}]overlay=${Math.round(width * rect.x)}:${Math.round(height * rect.y)}:enable='${enableExpr(group)}'[lwinout${tag}]`);
    current = `[lwinout${tag}]`;
  });
  lines.push(`${current}null${options.output}`);
  return lines;
}

/**
 * Cadeia que alinha a gravação de tela à linha do tempo da câmera antes dos cortes:
 * `offsetSec > 0` = a tela começou depois (ganha preto no início); `< 0` = começou antes (perde o começo).
 * O último frame é repetido no fim para a tela nunca acabar antes da câmera.
 */
export function screenAlign(offsetSec: number, fps: number): string {
  const hold = 'stop_mode=clone:stop_duration=3600';
  // um tpad só: dois em sequência perdem o preenchimento do fim (medido no ffmpeg 9)
  if (offsetSec > 0) return `fps=${fps}:start_time=0,tpad=start_duration=${offsetSec.toFixed(3)}:color=0x0c0c0c:${hold}`;
  if (offsetSec < 0) return `fps=${fps}:start_time=0,trim=start=${(-offsetSec).toFixed(3)},setpts=PTS-STARTPTS,tpad=${hold}`;
  return `fps=${fps}:start_time=0,tpad=${hold}`;
}

/** Caminho da gravação de tela: absoluto, ou relativo à pasta do vídeo principal. */
export function resolveScreen(path: string, sourcePath: string): string | null {
  const candidate = isAbsolute(path) ? path : join(dirname(sourcePath), path);
  return existsSync(candidate) ? candidate : null;
}

export interface PlacedBroll {
  /** segundos do vídeo final */
  start: number;
  end: number;
  /** segundo do arquivo de b-roll que aparece em `start` */
  from: number;
  fit: 'cover' | 'contain';
  file: string;
}

/**
 * B-roll no tempo de saída. Um trecho da fonte que atravessa cortes continua num intervalo só: os pedaços mantidos
 * são vizinhos no vídeo final, e o b-roll corre contínuo por cima do corte (esconde o salto).
 */
export function placeBroll(items: Pick<Edl['broll'][number], 'file' | 'start' | 'end' | 'from' | 'fit'>[], timeline: Timeline): PlacedBroll[] {
  const placed: PlacedBroll[] = [];
  for (const item of items) {
    let start: number | null = null;
    let end = 0;
    for (const clip of timeline.clips) {
      const from = Math.max(item.start, clip.sourceStart);
      const to = Math.min(item.end, clip.sourceEnd);
      if (to - from < 1 / timeline.fps) continue;
      start ??= clip.outputStart + (from - clip.sourceStart);
      end = clip.outputStart + (to - clip.sourceStart);
    }
    if (start === null || end - start < 1 / timeline.fps) continue;
    placed.push({ start, end, from: item.from, fit: item.fit, file: item.file });
  }
  return placed.sort((a, b) => a.start - b.start);
}

export interface BrollGraphOptions {
  /** rótulo do footage já tratado (e já com a tela gravada, se houver) */
  base: string;
  /** índice da entrada do ffmpeg de cada b-roll, na ordem de `items` */
  inputs: number[];
  items: PlacedBroll[];
  width: number;
  height: number;
  fps: number;
  output: string;
}

/**
 * Mesmo caminho da tela gravada: cada b-roll é uma entrada do ffmpeg posta por cima com `overlay` ligado só no seu
 * intervalo. O arquivo já vem posicionado em `from` (`-ss` na entrada, src/render/compose.ts); aqui ele é aparado na
 * duração do inserto, levado ao fps de saída e deslocado para começar em `start`. Fora do intervalo (e depois do
 * fim do arquivo) o footage passa intacto. O áudio do b-roll nunca é mapeado: a voz segue sozinha.
 */
export function buildBrollGraph(options: BrollGraphOptions): string[] {
  const { width, height, fps } = options;
  const lines: string[] = [];
  let current = options.base;
  options.items.forEach((item, index) => {
    const fit =
      item.fit === 'contain'
        ? `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0c0c0c`
        : `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`;
    lines.push(
      `[${options.inputs[index]}:v]trim=duration=${(item.end - item.start).toFixed(3)},setpts=PTS-STARTPTS,fps=${fps},${fit},setsar=1,format=yuv420p,setpts=PTS+${item.start.toFixed(3)}/TB[brsrc${index}]`,
      `${current}[brsrc${index}]overlay=0:0:eof_action=pass:enable='${enableExpr([item])}'[brout${index}]`,
    );
    current = `[brout${index}]`;
  });
  lines.push(`${current}null${options.output}`);
  return lines;
}
