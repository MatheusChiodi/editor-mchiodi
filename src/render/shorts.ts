import type { Phrase } from '../analyze/types.ts';
import type { Clip, Edl } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';

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
 */
export function verticalCrop(focusX: number, size: { width: number; height: number } = SHORTS_SIZE): string {
  const focus = Math.min(1, Math.max(0, focusX)).toFixed(3);
  return `crop=w='trunc(ih*9/16/2)*2':h=ih:x='(iw-ow)*${focus}':y=0,scale=${size.width}:${size.height}:flags=lanczos,setsar=1`;
}

export interface ShortCandidate {
  /** segundos da fonte */
  start: number;
  end: number;
  /** duração no vídeo final (já sem os cortes) */
  outputSec: number;
  score: number;
  opening: string;
  reasons: string[];
}

const HOOK = /\?|\b(nunca|sempre|erro|segredo|verdade|mito|problema|por que|porque|como|ningu[eé]m|todo mundo|melhor|pior)\b/i;

/**
 * Sugere trechos para o Short: janelas que começam e terminam em fronteira de frase, cabem em
 * 60s no vídeo final e pontuam por gancho na abertura, densidade de fala e final conclusivo.
 * É só um ranking de candidatos: quem escolhe (lendo o conteúdo) é o diretor.
 */
export function rankShortCandidates(phrases: Phrase[], timeline: Timeline, limit = 5, minSec = 20): ShortCandidate[] {
  const kept = phrases.filter((phrase) => sourceToOutput(timeline, phrase.start + 0.01) !== null);
  const candidates: ShortCandidate[] = [];
  for (let first = 0; first < kept.length; first += 1) {
    const startOut = sourceToOutput(timeline, kept[first]!.start + 0.01)!;
    let best: ShortCandidate | null = null;
    for (let last = first; last < kept.length; last += 1) {
      const endOut = sourceToOutput(timeline, kept[last]!.end - 0.01);
      if (endOut === null) continue;
      const outputSec = endOut - startOut;
      if (outputSec > SHORTS_MAX_SEC - 1) break;
      if (outputSec < minSec) continue;
      const opening = kept[first]!.text;
      const closing = kept[last]!.text;
      const words = kept.slice(first, last + 1).reduce((total, phrase) => total + (phrase.to - phrase.from), 0);
      const reasons: string[] = [];
      let score = outputSec / SHORTS_MAX_SEC; // prefere aproveitar o minuto
      if (HOOK.test(opening)) {
        score += 1;
        reasons.push('abre com gancho');
      }
      if (/[.!?]["')]?$/.test(closing)) {
        score += 0.5;
        reasons.push('fecha em fim de frase');
      }
      const density = words / outputSec;
      if (density >= 2.5) {
        score += 0.5;
        reasons.push(`fala densa (${density.toFixed(1)} palavras/s)`);
      }
      const candidate = { start: kept[first]!.start, end: kept[last]!.end, outputSec, score, opening, reasons };
      if (!best || candidate.score > best.score) best = candidate;
    }
    if (best) candidates.push(best);
  }
  // sem dois candidatos que sejam quase o mesmo trecho
  const picked: ShortCandidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (picked.every((other) => Math.abs(other.start - candidate.start) > 15)) picked.push(candidate);
    if (picked.length === limit) break;
  }
  return picked;
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
