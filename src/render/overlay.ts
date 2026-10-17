import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill as renderStillFrame, selectComposition } from '@remotion/renderer';

import type { OverlayProps } from '../../motion/src/types.ts';
import type { ProgressFn } from '../lib/ffmpeg.ts';
import { ASSETS_DIR, MOTION_ENTRY } from '../project/paths.ts';

// a tradução EDL → props é pura e mora em overlay-props.ts (o editor no navegador também usa)
export { buildOverlayProps, stagePresenter, stingerItems } from './overlay-props.ts';

/**
 * Cenas 3D (kit voxel) precisam de WebGL no Chrome headless; `angle` usa a GPU pelo ANGLE no Windows.
 * Vale para todo render, porque uma cena 3D pode estar em qualquer overlay.
 */
export const CHROMIUM_OPTIONS = { gl: 'angle' } as const;

let bundled: Promise<string> | null = null;

function bundleMotion(): Promise<string> {
  bundled ??= bundle({ entryPoint: MOTION_ENTRY, publicDir: ASSETS_DIR });
  return bundled;
}

export interface RenderOverlayOptions {
  output: string;
  /** 0.5 = metade da resolução (preview) */
  scale: number;
  concurrency: number;
  onProgress?: ProgressFn;
}

/** Renderiza a camada de gráficos com canal alfa (ProRes 4444) para o ffmpeg compor; com `vertical`, a do Short. */
export async function renderOverlay(props: OverlayProps, options: RenderOverlayOptions): Promise<void> {
  const serveUrl = await bundleMotion();
  const inputProps = props as unknown as Record<string, unknown>;
  const id = props.vertical ? 'OverlayShorts' : 'Overlay';
  const composition = await selectComposition({ serveUrl, id, inputProps, chromiumOptions: CHROMIUM_OPTIONS });
  const startedAt = Date.now();
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: 'prores',
    proResProfile: '4444',
    pixelFormat: 'yuva444p10le',
    imageFormat: 'png',
    scale: options.scale,
    concurrency: options.concurrency,
    muted: true,
    chromiumOptions: CHROMIUM_OPTIONS,
    outputLocation: options.output,
    onProgress: ({ progress }) => {
      const elapsed = (Date.now() - startedAt) / 1000;
      options.onProgress?.({
        label: 'gráficos (Remotion)',
        percent: progress * 100,
        etaSec: progress > 0.02 ? (elapsed / progress) * (1 - progress) : null,
      });
    },
  });
}

export interface BumperOptions {
  output: string;
  fps: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Vinheta (Intro/Outro) como vídeo opaco próprio, emendado depois pelo ffmpeg. Usa a composição
 * de preview do componente, com fps, tamanho e duração trocados pelos do vídeo.
 */
export async function renderBumper(compositionId: string, seconds: number, options: BumperOptions): Promise<void> {
  const serveUrl = await bundleMotion();
  const composition = await selectComposition({ serveUrl, id: compositionId, chromiumOptions: CHROMIUM_OPTIONS });
  await renderMedia({
    serveUrl,
    composition: {
      ...composition,
      fps: options.fps,
      width: options.width,
      height: options.height,
      durationInFrames: Math.round(seconds * options.fps),
    },
    codec: 'h264',
    crf: 16,
    scale: options.scale,
    muted: true,
    chromiumOptions: CHROMIUM_OPTIONS,
    outputLocation: options.output,
  });
}

/** Um frame de qualquer composição registrada no Root (componentes, cenas, legendas). */
export async function renderStill(compositionId: string, frame: number, output: string): Promise<void> {
  const serveUrl = await bundleMotion();
  const composition = await selectComposition({ serveUrl, id: compositionId, chromiumOptions: CHROMIUM_OPTIONS });
  await renderStillFrame({
    serveUrl,
    composition,
    frame: Math.min(frame, composition.durationInFrames - 1),
    output,
    imageFormat: 'png',
    chromiumOptions: CHROMIUM_OPTIONS,
  });
}

export function overlayFile(dir: string): string {
  return join(dir, 'overlay.mov');
}
