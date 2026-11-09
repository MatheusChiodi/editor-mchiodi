import { MUSIC_BARS, type MusicEnergy, type MusicLyricLine, type MusicPlan, type MusicScene, type MusicSection } from '../../motion/src/music/types.ts';
import type { AudioFeatures } from './features.ts';
import type { LyricLine } from './lyrics.ts';
import type { PlannedScene } from './scenes.ts';
import type { Section } from './sections.ts';
import type { Tempo } from './tempo.ts';

type Palette = [string, string, string];

/** Fundo, destaque e brilho: frios nos trechos calmos, quentes nos fortes (tokens glow* do tema). */
export const PALETTES: Record<MusicEnergy, Palette[]> = {
  low: [
    ['#0b1020', '#7c93ff', '#9dffce'],
    ['#0a1420', '#6ee7f9', '#c4b5fd'],
  ],
  mid: [
    ['#0c1a18', '#34d399', '#9dffce'],
    ['#14121f', '#c084fc', '#7c93ff'],
  ],
  high: [
    ['#1a0d12', '#ff5555', '#ffb86c'],
    ['#1c1208', '#ffb86c', '#ff5555'],
    ['#1a0a1a', '#ff79c6', '#ffb86c'],
  ],
};

export interface MusicPlanInput {
  title: string;
  size: { width: number; height: number };
  features: AudioFeatures;
  tempo: Tempo;
  sections: Section[];
  lyrics: LyricLine[];
  /** cenas ilustrativas (planScenes); sem elas, uma cena de reserva cobre a música */
  scenes?: PlannedScene[];
}

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/** Junta o que foi ouvido no plano que o Remotion desenha: tudo em quadros, séries arredondadas, paletas por seção. */
export function buildMusicPlan(input: MusicPlanInput): MusicPlan {
  const { features, tempo, size } = input;
  const { fps, frames } = features;
  const toFrame = (seconds: number) => Math.round(seconds * fps);

  const source: Section[] = input.sections.length ? input.sections : [{ start: 0, end: frames / fps, energy: 'mid', mean: 0.5 }];
  const used: Record<MusicEnergy, number> = { low: 0, mid: 0, high: 0 };
  const sections: MusicSection[] = source.map((section, index) => {
    const options = PALETTES[section.energy];
    const palette = options[used[section.energy]++ % options.length]!;
    return {
      startFrame: index === 0 ? 0 : toFrame(section.start),
      endFrame: index === source.length - 1 ? frames : toFrame(section.end),
      energy: section.energy,
      palette,
    };
  });

  const lyrics: MusicLyricLine[] = input.lyrics.map((line) => ({
    text: line.text,
    startFrame: toFrame(line.start),
    endFrame: toFrame(line.end),
    words: line.words.map((word) => ({ text: word.text, startFrame: toFrame(word.start), endFrame: toFrame(word.end) })),
  }));

  const sceneSource: PlannedScene[] = input.scenes?.length ? input.scenes : [{ start: 0, end: frames / fps, motif: 'blob', keyword: null, variant: 0 }];
  const scenes: MusicScene[] = sceneSource.map((scene, index) => ({
    startFrame: index === 0 ? 0 : toFrame(scene.start),
    endFrame: index === sceneSource.length - 1 ? frames : toFrame(scene.end),
    motif: scene.motif,
    keyword: scene.keyword,
    variant: scene.variant,
    ...(scene.shot ? { shot: scene.shot } : {}),
    ...(scene.camera ? { camera: scene.camera } : {}),
    ...(scene.transition ? { transition: scene.transition } : {}),
  }));

  const onGrid = (times: number[]) => times.map(toFrame).filter((frame) => frame >= 0 && frame < frames);
  return {
    title: input.title,
    fps,
    width: size.width,
    height: size.height,
    durationInFrames: frames,
    bpm: tempo.bpm,
    beats: onGrid(tempo.beats),
    downbeats: onGrid(tempo.downbeats),
    sections,
    scenes,
    bass: features.bass.map((value) => round(value, 3)),
    mid: features.mid.map((value) => round(value, 3)),
    treble: features.treble.map((value) => round(value, 3)),
    rms: features.rms.map((value) => round(value, 3)),
    bars: features.bars.map((row) => row.slice(0, MUSIC_BARS).map((value) => round(value, 2))),
    lyrics,
  };
}
