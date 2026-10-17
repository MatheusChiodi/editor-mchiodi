import { round3, toFrames } from '../lib/time.ts';
import type { Clip } from './schema.ts';

export interface PlacedClip {
  id: string;
  /** em segundos da fonte, já na grade de frames */
  sourceStart: number;
  sourceEnd: number;
  /** em segundos do vídeo final */
  outputStart: number;
  outputEnd: number;
  /** índices de frame na fonte já convertida para o fps de saída; fim exclusivo */
  startFrame: number;
  endFrame: number;
}

export interface Timeline {
  fps: number;
  clips: PlacedClip[];
  durationSec: number;
}

/**
 * Coloca os clipes na timeline de saída. Início e fim são quantizados para a grade
 * de frames: é o que mantém vídeo e áudio com a mesma duração depois do concat.
 */
export function buildTimeline(clips: Pick<Clip, 'id' | 'start' | 'end'>[], fps: number): Timeline {
  const placed: PlacedClip[] = [];
  // tudo em frames inteiros; segundos são derivados, nunca somados
  let cursor = 0;
  let previousEnd = 0;
  for (const clip of clips) {
    const startFrame = Math.max(toFrames(clip.start, fps), previousEnd);
    const endFrame = toFrames(clip.end, fps);
    // clipe menor que 1 frame some depois da quantização
    if (endFrame - startFrame < 1) continue;
    const length = endFrame - startFrame;
    placed.push({
      id: clip.id,
      sourceStart: startFrame / fps,
      sourceEnd: endFrame / fps,
      outputStart: cursor / fps,
      outputEnd: (cursor + length) / fps,
      startFrame,
      endFrame,
    });
    cursor += length;
    previousEnd = endFrame;
  }
  return { fps, clips: placed, durationSec: cursor / fps };
}

/** Tempo da fonte -> tempo de saída. `null` se o instante foi cortado. */
export function sourceToOutput(timeline: Timeline, sourceTime: number): number | null {
  for (const clip of timeline.clips) {
    if (sourceTime >= clip.sourceStart - 1e-6 && sourceTime <= clip.sourceEnd + 1e-6) {
      const clamped = Math.min(Math.max(sourceTime, clip.sourceStart), clip.sourceEnd);
      return round3(clip.outputStart + (clamped - clip.sourceStart));
    }
  }
  return null;
}

/** Tempo de saída -> tempo da fonte. */
export function outputToSource(timeline: Timeline, outputTime: number): number | null {
  for (const clip of timeline.clips) {
    if (outputTime >= clip.outputStart - 1e-6 && outputTime < clip.outputEnd + 1e-6) {
      return round3(clip.sourceStart + (outputTime - clip.outputStart));
    }
  }
  return null;
}

export interface TimedSpan {
  start: number;
  end: number;
}

/**
 * Converte um intervalo da fonte (ex.: uma palavra) para a saída. Uma palavra parcialmente
 * cortada é recortada ao clipe que contém a maior parte dela; totalmente cortada vira `null`.
 */
export function mapSpan(timeline: Timeline, span: TimedSpan): TimedSpan | null {
  let best: TimedSpan | null = null;
  let bestOverlap = 0;
  for (const clip of timeline.clips) {
    const start = Math.max(span.start, clip.sourceStart);
    const end = Math.min(span.end, clip.sourceEnd);
    const overlap = end - start;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = {
        start: round3(clip.outputStart + (start - clip.sourceStart)),
        end: round3(clip.outputStart + (end - clip.sourceStart)),
      };
    }
  }
  return best;
}

/** Instantes de corte no vídeo final (fronteiras internas entre clipes). */
export function cutPoints(timeline: Timeline): number[] {
  return timeline.clips.slice(1).map((clip) => clip.outputStart);
}
