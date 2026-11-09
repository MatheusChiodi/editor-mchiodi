import type { OnsetEnvelope } from './features.ts';

export interface Tempo {
  bpm: number;
  /** instante da primeira batida, em segundos */
  offsetSec: number;
  beats: number[];
  /** tempo forte de cada compasso (a cada 4 batidas, na fase com mais grave) */
  downbeats: number[];
  /** 0–1: o quanto as batidas caem em onsets e as contratempos ficam vazios */
  confidence: number;
}

export interface TempoOptions {
  minBpm?: number;
  maxBpm?: number;
  /** energia de grave na mesma taxa do envelope, para escolher o tempo forte */
  bass?: OnsetEnvelope;
}

/**
 * Batidas pelos golpes reais do grave, sem grade de BPM: pico de subida do grave com distância mínima de 0,28 s.
 * Serve quando o tempo é pouco confiável (violão, rubato) ou a música não tem pulso regular; os tempos fortes são os
 * golpes entre os 25% mais fortes, com 1,2 s de distância.
 */
export function bassOnsets(bass: number[], fps: number): { beats: number[]; downbeats: number[] } {
  const lag = 2;
  const rise = bass.map((value, i) => Math.max(0, value - (bass[i - lag] ?? value)));
  const peak = Math.max(0, ...rise);
  if (peak < 0.1) return { beats: [], downbeats: [] };
  const threshold = Math.max(0.1, peak * 0.3);
  const minGap = Math.round(0.28 * fps);
  const hits: { frame: number; strength: number }[] = [];
  for (let i = 1; i < rise.length - 1; i++) {
    if (rise[i]! < threshold || rise[i]! < rise[i - 1]! || rise[i]! < rise[i + 1]!) continue;
    const last = hits.at(-1);
    if (last && i - last.frame < minGap) {
      if (rise[i]! > last.strength) hits[hits.length - 1] = { frame: i, strength: rise[i]! };
    } else hits.push({ frame: i, strength: rise[i]! });
  }
  const sorted = hits.map((hit) => hit.strength).sort((a, b) => a - b);
  const strong = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.75))] ?? Infinity;
  const downbeats: number[] = [];
  let lastDown = -Infinity;
  for (const hit of hits) {
    if (hit.strength >= strong && hit.frame - lastDown >= 1.2 * fps) {
      downbeats.push(Math.round((hit.frame / fps) * 1000) / 1000);
      lastDown = hit.frame;
    }
  }
  return { beats: hits.map((hit) => Math.round((hit.frame / fps) * 1000) / 1000), downbeats };
}

const EMPTY: Tempo = { bpm: 0, offsetSec: 0, beats: [], downbeats: [], confidence: 0 };

function movingAverage(values: number[], radius: number): number[] {
  const prefix = [0];
  for (const value of values) prefix.push(prefix.at(-1)! + value);
  return values.map((_, i) => {
    const from = Math.max(0, i - radius);
    const to = Math.min(values.length, i + radius + 1);
    return (prefix[to]! - prefix[from]!) / (to - from);
  });
}

/**
 * Tempo e grade de batidas por pente: para cada BPM e fase, soma o onset nas batidas e desconta o meio-tempo
 * (contratempo). O desconto é o que desempata oitavas: 60 BPM sobre uma música de 120 deixa o meio-tempo cheio, 120 não.
 * Ideia dos picos e da dobra de oitava do web-audio-beat-detector, com grade de fase fina em vez de histograma de intervalos.
 */
export function estimateTempo(onset: OnsetEnvelope, options: TempoOptions = {}): Tempo {
  const { minBpm = 80, maxBpm = 160, bass } = options;
  const { rate, values } = onset;
  const n = values.length;
  if (n < rate * 2 || Math.max(...values) <= 0) return EMPTY;

  const trend = movingAverage(values, Math.round(rate * 0.5));
  let peak = 0;
  const flux = values.map((value, i) => {
    const detrended = Math.max(0, value - trend[i]!);
    peak = Math.max(peak, detrended);
    return detrended;
  });
  if (peak <= 0) return EMPTY;
  for (let i = 0; i < n; i++) flux[i] = flux[i]! / peak;

  // grave: o bumbo marca as batidas, o chimbal nos contratempos não. Soma o fluxo do grave ao onset total para a
  // grade cair no bumbo (e não no meio-tempo do chimbal), que é o que dá a fase e a oitava certas em música real.
  if (bass && bass.values.length > 1) {
    const sample = (i: number) => {
      const position = Math.max(0, Math.min(bass.values.length - 1, (i / rate) * bass.rate));
      const lo = Math.floor(position);
      const frac = position - lo;
      return bass.values[lo]! * (1 - frac) + (bass.values[Math.min(bass.values.length - 1, lo + 1)] ?? 0) * frac;
    };
    const delta = Math.max(1, Math.round(rate * 0.06));
    const bassFlux = flux.map((_, i) => Math.max(0, sample(i) - sample(i - delta)));
    const bassPeak = Math.max(...bassFlux);
    if (bassPeak > 0) {
      for (let i = 0; i < n; i++) flux[i] = 0.5 * flux[i]! + 0.5 * (bassFlux[i]! / bassPeak);
      const mixedPeak = Math.max(...flux);
      for (let i = 0; i < n; i++) flux[i] = flux[i]! / mixedPeak;
    }
  }

  const at = (position: number) => {
    const i = Math.floor(position);
    if (i < 0 || i >= n - 1) return 0;
    const frac = position - i;
    return flux[i]! * (1 - frac) + flux[i + 1]! * frac;
  };

  let best = { score: -Infinity, bpm: 0, offset: 0, beat: 0 };
  for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.25) {
    const period = (60 * rate) / bpm;
    const prior = 1 - 0.1 * Math.abs(Math.log2(bpm / 120));
    for (let offset = 0; offset < period; offset += 0.5) {
      let beat = 0;
      let half = 0;
      let count = 0;
      for (let pos = offset; pos < n - 1; pos += period) {
        beat += at(pos);
        half += at(pos + period / 2);
        count++;
      }
      if (count === 0) continue;
      const meanBeat = beat / count;
      const score = (meanBeat - 0.3 * (half / count)) * prior;
      if (score > best.score) best = { score, bpm, offset, beat: meanBeat };
    }
  }
  if (best.bpm === 0 || best.score <= 0) return EMPTY;

  const bpm = Math.abs(best.bpm - Math.round(best.bpm)) < 0.3 ? Math.round(best.bpm) : Math.round(best.bpm * 4) / 4;
  const period = (60 * rate) / bpm;
  const beats: number[] = [];
  const beatPositions: number[] = [];
  for (let pos = best.offset; pos < n - 1; pos += period) {
    beats.push(Math.round((pos / rate) * 1000) / 1000);
    beatPositions.push(pos);
  }

  // tempo forte: a fase (0–3) em que o grave é mais forte nas batidas
  let phase = 0;
  if (bass && bass.values.length > 0) {
    const sums = [0, 0, 0, 0];
    const counts = [0, 0, 0, 0];
    beatPositions.forEach((pos, index) => {
      const i = Math.min(bass.values.length - 1, Math.round((pos / rate) * bass.rate));
      sums[index % 4]! += bass.values[i]!;
      counts[index % 4]!++;
    });
    const means = sums.map((sum, p) => (counts[p] ? sum / counts[p]! : 0));
    phase = means.indexOf(Math.max(...means));
  }

  return {
    bpm,
    offsetSec: beats[0] ?? 0,
    beats,
    downbeats: beats.filter((_, index) => index % 4 === phase),
    confidence: Math.max(0, Math.min(1, best.score)),
  };
}
