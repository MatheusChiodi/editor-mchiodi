export type EnergyLevel = 'low' | 'mid' | 'high';

export interface Section {
  start: number;
  end: number;
  energy: EnergyLevel;
  /** energia média da seção, 0–1 */
  mean: number;
}

export interface SectionOptions {
  /** nenhuma seção fica mais curta que isso */
  minSec?: number;
  /** janela de cada lado da fronteira candidata */
  windowSec?: number;
  /** salto mínimo de energia média para contar como fronteira */
  minJump?: number;
}

const mean = (values: number[], from: number, to: number) => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += values[i]!;
  return to > from ? sum / (to - from) : 0;
};

/**
 * Seções da música (intro, verso, refrão, drop...) por novidade de energia: a fronteira cai onde a energia média
 * da janela seguinte difere mais da anterior. Cada seção ganha nível baixo/médio/alto relativo à própria música.
 */
export function segmentSections(energy: number[], fps: number, options: SectionOptions = {}): Section[] {
  const { minSec = 8, windowSec = 4, minJump = 0.15 } = options;
  const n = energy.length;
  const duration = n / fps;
  const w = Math.round(windowSec * fps);
  const min = Math.round(minSec * fps);

  const novelty = new Array<number>(n).fill(0);
  for (let i = w; i <= n - w; i++) novelty[i] = Math.abs(mean(energy, i, i + w) - mean(energy, i - w, i));

  // candidatos: máximos locais acima do salto mínimo, do mais forte ao mais fraco, respeitando a distância mínima
  const candidates: number[] = [];
  for (let i = w; i <= n - w; i++) {
    if (novelty[i]! < minJump) continue;
    let isPeak = true;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w) && isPeak; j++) if (novelty[j]! > novelty[i]!) isPeak = false;
    if (isPeak) candidates.push(i);
  }
  candidates.sort((a, b) => novelty[b]! - novelty[a]!);
  const bounds: number[] = [];
  for (const candidate of candidates) {
    if (candidate < min || n - candidate < min) continue;
    if (bounds.every((bound) => Math.abs(bound - candidate) >= min)) bounds.push(candidate);
  }
  bounds.sort((a, b) => a - b);

  const edges = [0, ...bounds, n];
  const raw = edges.slice(0, -1).map((from, index) => ({ from, to: edges[index + 1]!, mean: mean(energy, from, edges[index + 1]!) }));
  const means = raw.map((section) => section.mean);
  const lo = Math.min(...means);
  const hi = Math.max(...means);
  return raw.map((section) => {
    const relative = hi - lo < 0.15 ? 0.5 : (section.mean - lo) / (hi - lo);
    return {
      start: section.from / fps,
      end: section.to === n ? duration : section.to / fps,
      energy: relative < 0.34 ? 'low' : relative < 0.67 ? 'mid' : 'high',
      mean: Math.round(section.mean * 1000) / 1000,
    };
  });
}
