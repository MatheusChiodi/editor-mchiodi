import { verticalFrame, type VerticalFrame } from '../../motion/src/vertical.ts';
import type { Clip, Edl, Overlay } from '../edl/schema.ts';
import { buildTimeline, sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { focusExpr, type ResolvedFocus } from './focus.ts';
import { stagePresenter } from './overlay.ts';

export const SHORTS_SIZE = { width: 1080, height: 1920 } as const;
export const SHORTS_MAX_SEC = 60;

/** Parte dos clipes da edição que cai dentro do trecho escolhido para o Short. */
export function clipsWithin(clips: Pick<Clip, 'id' | 'start' | 'end'>[], start: number, end: number): Pick<Clip, 'id' | 'start' | 'end'>[] {
  return clips
    .map((clip) => ({ id: clip.id, start: Math.max(clip.start, start), end: Math.min(clip.end, end) }))
    .filter((clip) => clip.end - clip.start > 0.05);
}

/**
 * Recorte 9:16 a partir do quadro 16:9: mantém a altura inteira e escolhe a faixa horizontal
 * em volta de `focusX` (0 = esquerda, 1 = direita). Cadeia linear para o grafo de cortes.
 * Com keyframes, `x` vira expressão em `t`: o `crop` reavalia por frame e roda antes do `trim`,
 * então `t` é o tempo da FONTE e a contagem de frames não muda.
 */
export function verticalCrop(focus: ResolvedFocus, size: { width: number; height: number } = SHORTS_SIZE): string {
  return `crop=w='trunc(ih*9/16/2)*2':h=ih:x='(iw-ow)*${focusExpr(focus)}':y=0,scale=${size.width}:${size.height}:flags=lanczos,setsar=1`;
}

/** Trechos da fonte que aparecem no Short (clipes dentro do trecho), base do planejamento do foco. */
export function shortsSpans(edl: Pick<Edl, 'clips' | 'shorts'>): { start: number; end: number }[] {
  if (!edl.shorts) return [];
  return clipsWithin(edl.clips, edl.shorts.start, edl.shorts.end).map(({ start, end }) => ({ start, end }));
}

export type ShortsSkipReason = 'desligado' | 'fora-do-trecho' | 'palco' | 'camada-fixa';

export interface ShortsOverlayPick {
  /** overlays que entram, com `at` já dentro de um clipe do Short */
  kept: Overlay[];
  skipped: { id: string; reason: ShortsSkipReason }[];
}

/**
 * Overlays da EDL que entram no Short. Só entra o que está ANCORADO num clipe do trecho: um gráfico que começou
 * antes perderia a entrada. Palco (`presenter`) e camada fixa ficam de fora: reenquadram o footage 16:9 e
 * atravessam layouts que o vertical não tem. `at` exatamente na borda de um clipe pode cair meio frame antes
 * do início quantizado; ele encosta no início para a conversão de tempo não descartá-lo.
 * `timeline` é a do Short (clipes já recortados ao trecho).
 */
export function pickShortsOverlays(edl: Pick<Edl, 'overlays' | 'shorts'>, timeline: Timeline): ShortsOverlayPick {
  const kept: Overlay[] = [];
  const skipped: ShortsOverlayPick['skipped'] = [];
  const graphicsOn = edl.shorts?.graphics !== 'none';
  const halfFrame = 0.5 / timeline.fps;
  for (const overlay of edl.overlays) {
    const skip = (reason: ShortsSkipReason) => skipped.push({ id: overlay.id, reason });
    const clip = timeline.clips.find((item) => overlay.at >= item.sourceStart - halfFrame - 1e-6 && overlay.at < item.sourceEnd);
    if (!clip) skip('fora-do-trecho');
    else if (!graphicsOn || overlay.shorts === false) skip('desligado');
    else if (overlay.layer === 'persistent') skip('camada-fixa');
    else if (stagePresenter(overlay)) skip('palco');
    else {
      const at = Math.max(overlay.at, clip.sourceStart);
      if (sourceToOutput(timeline, at) === null) skip('fora-do-trecho');
      // no vertical a legenda nunca é coberta: esconder ela não tem mais motivo
      else kept.push({ ...overlay, at, hidesCaptions: false });
    }
  }
  return { kept, skipped };
}

const SKIP_LABEL: Record<ShortsSkipReason, string> = {
  desligado: 'desligado na EDL',
  'fora-do-trecho': 'fora do trecho',
  palco: 'palco 16:9',
  'camada-fixa': 'camada fixa',
};

/** Linha do log do render: o que entrou e o que ficou de fora (o que nem está no trecho não aparece). */
export function formatShortsPick(pick: ShortsOverlayPick): string {
  const left = pick.skipped.filter((item) => item.reason !== 'fora-do-trecho').map((item) => `${item.id} (${SKIP_LABEL[item.reason]})`);
  const kept = pick.kept.map((item) => item.id);
  return `gráficos no Short: ${kept.length ? kept.join(', ') : 'nenhum'}${left.length ? ` · fora: ${left.join(', ')}` : ''}`;
}

/** Quadro do Short para a diagramação: legenda no estilo da EDL e faixa do rosto. */
export function shortsFrame(edl: Pick<Edl, 'captions' | 'shorts'>): VerticalFrame {
  return verticalFrame({
    ...SHORTS_SIZE,
    captions: edl.captions.enabled ? (edl.captions.preset ?? 'padrao') : null,
    faceBand: edl.shorts?.faceBand,
  });
}

/** EDL derivada para o Short: só os clipes do trecho, 9:16, legenda no estilo shorts, overlays ancorados no trecho. */
export function shortsEdl(edl: Edl): Edl {
  if (!edl.shorts) throw new Error('A EDL não define `shorts` (trecho do vídeo para o formato vertical)');
  const { start, end } = edl.shorts;
  const clips = clipsWithin(edl.clips, start, end).map((clip) => ({ ...clip, quote: '', reason: '' }));
  if (clips.length === 0) throw new Error('O trecho de `shorts` não contém nenhum clipe mantido');
  const inRange = <T extends { at: number }>(items: T[]) =>
    items.filter((item) => clips.some((clip) => item.at >= clip.start && item.at < clip.end));
  const clipIds = new Set(clips.map((clip) => clip.id));
  return {
    ...edl,
    clips,
    output: { fps: edl.output.fps, ...SHORTS_SIZE },
    captions: { ...edl.captions, enabled: true, style: 'shorts', maxWordsPerPage: Math.min(edl.captions.maxWordsPerPage, 3) },
    // a diagramação vertical de cada um acontece na camada de gráficos (props.vertical)
    overlays: pickShortsOverlays(edl, buildTimeline(clips, edl.output.fps)).kept,
    zooms: inRange(edl.zooms),
    effects: inRange(edl.effects),
    sfx: inRange(edl.sfx),
    transitions: edl.transitions.filter((transition) => clipIds.has(transition.intoClip) && clips[0]!.id !== transition.intoClip),
    chapters: [],
  };
}
