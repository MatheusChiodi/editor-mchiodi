import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill as renderStillFrame, selectComposition } from '@remotion/renderer';

import { isWindowSlot, linkStages, normalizePushes, type PresenterSpec } from '../../motion/src/arsenal/stage.ts';
import type { OverlayItem, OverlayProps } from '../../motion/src/types.ts';
import type { VerticalFrame } from '../../motion/src/vertical.ts';
import type { Transcript } from '../analyze/types.ts';
import { transitions } from '../arsenal/transitions.ts';
import type { Edl, Overlay } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';
import type { ProgressFn } from '../lib/ffmpeg.ts';
import { ASSETS_DIR, MOTION_ENTRY } from '../project/paths.ts';
import { buildCaptions } from './captions.ts';
import { transitionDuration } from './cuts.ts';
import { effectOverlays, placeEffects } from './effects.ts';

/**
 * Palco de um overlay. `WindowStage` com `kind: "footage"` é um palco por definição: o footage inteiro (o vídeo
 * já é a tela gravada) encolhe para dentro do corpo da janela, sem precisar de `presenter` na EDL.
 * Camada fixa (`layer: "persistent"`) nunca é palco.
 */
export function stagePresenter(overlay: Pick<Overlay, 'component' | 'props' | 'presenter' | 'layer'>): PresenterSpec | null {
  if (overlay.layer === 'persistent') return null;
  if (overlay.component === 'WindowStage' && overlay.props.kind === 'footage') {
    const given = overlay.presenter;
    const slot = given && isWindowSlot(given.slot) ? given.slot : overlay.props.mirror === true ? 'window-right' : 'window';
    return { slot, focus: { x: 0.5, y: 0.5 }, backdrop: given?.backdrop ?? 'paper', ...(given?.transitionSec ? { transitionSec: given.transitionSec } : {}) };
  }
  return overlay.presenter;
}

/** Traduz a EDL (tempo da fonte) nas props da composição `Overlay` (frames do vídeo final). */
export function buildOverlayProps(edl: Edl, timeline: Timeline, transcript: Transcript, vertical?: VerticalFrame): OverlayProps {
  const { fps, width, height } = edl.output;
  const totalFrames = Math.round(timeline.durationSec * fps);
  const presenters = new Map<string, PresenterSpec>();
  const overlays: OverlayItem[] = edl.overlays.map((overlay) => {
    const presenter = stagePresenter(overlay);
    if (presenter) presenters.set(overlay.id, presenter);
    const at = sourceToOutput(timeline, overlay.at);
    if (at === null) throw new Error(`Overlay "${overlay.id}" está ancorado num trecho cortado (${overlay.at}s)`);
    const from = Math.round(at * fps);
    return {
      id: overlay.id,
      component: overlay.component,
      from,
      durationInFrames: Math.max(1, Math.min(Math.round(overlay.duration * fps), totalFrames - from)),
      props: overlay.props,
      hidesCaptions: overlay.hidesCaptions,
      ...(overlay.wipe !== 'none' ? { wipe: overlay.wipe } : {}),
      ...(overlay.layer === 'persistent' ? { layer: 'persistent' as const } : {}),
      ...(vertical && overlay.shorts ? { vertical: overlay.shorts } : {}),
    };
  });
  // palcos colados viram um movimento só: o cartão desliza de um slot para o outro
  const plans = linkStages(
    overlays.map((item) => ({
      item,
      from: item.from,
      durationInFrames: item.durationInFrames,
      presenter: presenters.get(item.id) ?? null,
      component: item.component,
      kind: typeof item.props.kind === 'string' ? item.props.kind : undefined,
    })),
  );
  for (const [entry, plan] of plans) {
    // footage dentro da janela: os zooms entram no plano, de onde o ffmpeg e a camada de gráficos leem a mesma lista
    const pushes = isWindowSlot(plan.slot) ? normalizePushes(entry.item.props.push, entry.item.durationInFrames / fps) : [];
    entry.item.stage = pushes.length ? { ...plan, pushes } : plan;
  }
  // efeitos de overlay ficam por baixo dos gráficos; stingers por cima de tudo
  overlays.unshift(...effectOverlays(placeEffects(edl.effects, timeline), fps, totalFrames));
  overlays.push(...stingerItems(edl, timeline));
  return {
    fps,
    width,
    height,
    durationInFrames: totalFrames,
    captions: buildCaptions(transcript.words, timeline, edl.captions),
    captionStyle: edl.captions.style,
    captionPreset: edl.captions.preset,
    overlays,
    ...(vertical ? { vertical } : {}),
  };
}

/**
 * Transições do tipo stinger viram um overlay de tela cheia centrado no corte: a animação cobre
 * o quadro inteiro no meio da duração, que é exatamente quando o corte seco acontece por baixo.
 */
export function stingerItems(edl: Pick<Edl, 'transitions' | 'output'>, timeline: Timeline): OverlayItem[] {
  const { fps } = edl.output;
  const totalFrames = Math.round(timeline.durationSec * fps);
  const items: OverlayItem[] = [];
  for (const transition of edl.transitions) {
    const preset = transitions[transition.type];
    const clip = timeline.clips.find((item) => item.id === transition.intoClip);
    if (!preset || preset.kind !== 'stinger' || !preset.stinger || !clip) continue;
    const length = Math.max(2, Math.round(transitionDuration(transition) * fps));
    const from = Math.max(0, Math.round(clip.outputStart * fps) - Math.floor(length / 2));
    items.push({
      id: transition.id,
      component: 'Stinger',
      from,
      durationInFrames: Math.min(length, totalFrames - from),
      props: { variant: preset.stinger.variant, ...preset.stinger.props },
      // a legenda sumiria atrás da cortina de qualquer jeito; escondê-la evita texto solto sobre a cor
      hidesCaptions: true,
    });
  }
  return items;
}

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
