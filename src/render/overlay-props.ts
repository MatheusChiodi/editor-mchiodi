/**
 * EDL → props da composição `Overlay`, em módulo puro (sem Node): o render usa e o MChiodi Cut também, para que a
 * camada de gráficos do preview no navegador seja a mesma do vídeo final.
 */
import { isWindowSlot, linkStages, normalizePushes, type Point, type PresenterSpec } from '../../motion/src/arsenal/stage.ts';
import type { OverlayItem, OverlayProps } from '../../motion/src/types.ts';
import type { VerticalFrame } from '../../motion/src/vertical.ts';
import type { Word } from '../analyze/types.ts';
import { transitionDuration, transitions } from '../arsenal/transitions.ts';
import type { Edl, Overlay } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { buildCaptions } from './captions.ts';
import { effectOverlays, placeEffects } from './effects.ts';

/**
 * Palco de um overlay. `WindowStage` com `kind: "footage"` é um palco por definição: o footage inteiro (o vídeo
 * já é a tela gravada) encolhe para dentro do corpo da janela, sem precisar de `presenter` na EDL.
 * Camada fixa (`layer: "persistent"`) nunca é palco. Foco `"auto"` vem resolvido em `stageFocus` (src/render/stage-focus.ts);
 * sem ele (editor no navegador, sem detector), cai no padrão antigo.
 */
export function stagePresenter(overlay: Pick<Overlay, 'component' | 'props' | 'presenter' | 'layer'> & { id?: string }, stageFocus?: ReadonlyMap<string, Point>): PresenterSpec | null {
  if (overlay.layer === 'persistent') return null;
  if (overlay.component === 'WindowStage' && overlay.props.kind === 'footage') {
    const given = overlay.presenter;
    const slot = given && isWindowSlot(given.slot) ? given.slot : overlay.props.mirror === true ? 'window-right' : 'window';
    return { slot, focus: { x: 0.5, y: 0.5 }, backdrop: given?.backdrop ?? 'paper', ...(given?.transitionSec ? { transitionSec: given.transitionSec } : {}) };
  }
  if (!overlay.presenter) return null;
  const { focus, ...rest } = overlay.presenter;
  return { ...rest, focus: focus === 'auto' ? ((overlay.id && stageFocus?.get(overlay.id)) || AUTO_FALLBACK) : focus };
}

/** Foco de um palco `"auto"` que não foi resolvido (mesmo valor de DEFAULT_STAGE_FOCUS em stage-focus.ts). */
const AUTO_FALLBACK: Point = { x: 0.5, y: 0.4 };

/** Traduz a EDL (tempo da fonte) nas props da composição `Overlay` (frames do vídeo final). */
export function buildOverlayProps(edl: Edl, timeline: Timeline, transcript: { words: Word[] }, vertical?: VerticalFrame, stageFocus?: ReadonlyMap<string, Point>): OverlayProps {
  const { fps, width, height } = edl.output;
  const totalFrames = Math.round(timeline.durationSec * fps);
  const presenters = new Map<string, PresenterSpec>();
  const overlays: OverlayItem[] = edl.overlays.map((overlay) => {
    const presenter = stagePresenter(overlay, stageFocus);
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
