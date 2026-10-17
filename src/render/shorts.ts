import type { Clip, Edl } from '../edl/schema.ts';
import { focusExpr, type ResolvedFocus } from './focus.ts';

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

/** EDL derivada para o Short: só os clipes do trecho, 9:16, legenda no estilo shorts, sem gráficos 16:9. */
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
    // os componentes da biblioteca são desenhados para 16:9
    overlays: [],
    zooms: inRange(edl.zooms),
    effects: inRange(edl.effects),
    sfx: inRange(edl.sfx),
    transitions: edl.transitions.filter((transition) => clipIds.has(transition.intoClip) && clips[0]!.id !== transition.intoClip),
    chapters: [],
  };
}
