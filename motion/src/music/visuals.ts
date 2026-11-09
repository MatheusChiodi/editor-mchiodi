import type { MusicLyricLine, MusicPlan, MusicScene } from './types';

const hex2 = (value: number) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');

/** Aceita `#rgb` e `#rrggbb`. */
const fullHex = (color: string) => (/^#[0-9a-fA-F]{3}$/.test(color) ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` : color);

/** Mistura duas cores (`#rgb` ou `#rrggbb`); `t` em 0–1. */
export function mixHex(a: string, b: string, t: number): string {
  const [from, to] = [fullHex(a), fullHex(b)];
  const channel = (color: string, i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => hex2(channel(from, i) + (channel(to, i) - channel(from, i)) * t)).join('')}`;
}

/** Índice da seção que contém o quadro; fora da música, a primeira ou a última. */
export function sectionIndexAt(plan: Pick<MusicPlan, 'sections'>, frame: number): number {
  const index = plan.sections.findIndex((section) => frame >= section.startFrame && frame < section.endFrame);
  return index >= 0 ? index : frame < 0 ? 0 : plan.sections.length - 1;
}

/** Paleta do quadro: a da seção, misturando com a vizinha nos `fadeFrames` antes de cada fronteira. */
export function paletteAt(plan: Pick<MusicPlan, 'sections'>, frame: number, fadeFrames = 30): [string, string, string] {
  const index = sectionIndexAt(plan, frame);
  const current = plan.sections[index]!;
  const next = plan.sections[index + 1];
  const left = current.endFrame - frame;
  if (!next || left > fadeFrames) return current.palette;
  const t = 1 - left / fadeFrames;
  return [mixHex(current.palette[0], next.palette[0], t), mixHex(current.palette[1], next.palette[1], t), mixHex(current.palette[2], next.palette[2], t)];
}

/** Pulso da batida: 1 no quadro dela, decaindo exponencialmente; 0 antes da primeira. `beats` em ordem crescente. */
export function beatPulse(frame: number, beats: number[], decayFrames = 8): number {
  let lo = 0;
  let hi = beats.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid]! <= frame) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found < 0 ? 0 : Math.exp(-(frame - beats[found]!) / decayFrames);
}

const LYRIC_LEAD_FRAMES = 8;
const LYRIC_TAIL_FRAMES = 12;

/** Verso visível no quadro (entra um pouco antes de ser cantado e sai logo depois) e o quanto dele já passou. */
export function lyricAt(plan: Pick<MusicPlan, 'lyrics'>, frame: number): { line: MusicLyricLine; index: number; progress: number } | null {
  const index = plan.lyrics.findIndex((line) => frame >= line.startFrame - LYRIC_LEAD_FRAMES && frame <= line.endFrame + LYRIC_TAIL_FRAMES);
  if (index < 0) return null;
  const line = plan.lyrics[index]!;
  const progress = (frame - line.startFrame) / Math.max(1, line.endFrame - line.startFrame);
  return { line, index, progress: Math.max(0, Math.min(1, progress)) };
}

export type WordState = 'done' | 'active' | 'next';

/** Cada palavra do verso como já cantada, em curso ou por vir (karaokê). */
export function wordStates(line: MusicLyricLine, frame: number): { text: string; state: WordState }[] {
  return line.words.map((word) => ({ text: word.text, state: frame >= word.endFrame ? 'done' : frame >= word.startFrame ? 'active' : 'next' }));
}

/** Cena do quadro, com os quadros já passados nela e o progresso 0–1; fora da música vale a primeira ou a última. */
export function sceneAt(plan: Pick<MusicPlan, 'scenes'>, frame: number): { scene: MusicScene; index: number; local: number; duration: number; progress: number } {
  const found = plan.scenes.findIndex((scene) => frame >= scene.startFrame && frame < scene.endFrame);
  const index = found >= 0 ? found : frame < 0 ? 0 : plan.scenes.length - 1;
  const scene = plan.scenes[index]!;
  const duration = Math.max(1, scene.endFrame - scene.startFrame);
  const local = Math.max(0, frame - scene.startFrame);
  return { scene, index, local, duration, progress: Math.max(0, Math.min(1, local / duration)) };
}
