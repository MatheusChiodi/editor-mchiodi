import type { Span, Word } from '../analyze/types.ts';

/**
 * Escolha dos candidatos a frame de capa. Não há detector de rosto: o que dá para medir é nitidez,
 * exposição e quanto do quadro tem tom de pele. O resto (expressão, olho aberto) quem decide é o
 * agente, olhando a folha de contato numerada.
 */

export interface FrameSelectionOptions {
  /** distância mínima da borda de um clipe mantido, para não cair em corte */
  edgeMarginSec: number;
  /** distância mínima de uma troca de cena (frame de transição, ou tela gravada entrando) */
  sceneMarginSec: number;
  /** palavra mais curta que isso costuma ser boca fechada/transição */
  minWordSec: number;
}

export const FRAME_SELECTION: FrameSelectionOptions = { edgeMarginSec: 0.3, sceneMarginSec: 0.7, minWordSec: 0.2 };

/**
 * Instantes em que há fala: o meio de cada palavra (boca aberta, gesto no auge), só dentro do que a
 * EDL mantém (`keep`; sem EDL, o vídeo inteiro) e longe de troca de cena.
 */
export function speechInstants(words: Word[], keep: Span[] | null, scenes: number[], options: FrameSelectionOptions = FRAME_SELECTION): number[] {
  const instants: number[] = [];
  for (const word of words) {
    const duration = word.end - word.start;
    if (word.interpolated || duration < options.minWordSec) continue;
    const at = word.start + duration * 0.45;
    if (keep && !keep.some((span) => at >= span.start + options.edgeMarginSec && at <= span.end - options.edgeMarginSec)) continue;
    if (scenes.some((scene) => Math.abs(scene - at) < options.sceneMarginSec)) continue;
    instants.push(Math.round(at * 1000) / 1000);
  }
  return instants;
}

export interface FrameCandidate {
  at: number;
  /** faixa do vídeo a que pertence: garante candidatos espalhados */
  bucket: number;
}

/** Divide o vídeo em `count` faixas de tempo e pega até `perBucket` instantes bem espaçados em cada uma. */
export function spreadCandidates(instants: number[], count: number, perBucket: number): FrameCandidate[] {
  const sorted = [...instants].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined || count <= 0) return [];
  const span = Math.max(0.001, last - first);
  const buckets: number[][] = Array.from({ length: count }, () => []);
  for (const at of sorted) buckets[Math.min(count - 1, Math.floor(((at - first) / span) * count))]!.push(at);
  return buckets.flatMap((items, bucket) => {
    if (items.length <= perBucket) return items.map((at) => ({ at, bucket }));
    return Array.from({ length: perBucket }, (_, index) => ({ at: items[Math.floor(((index + 0.5) / perBucket) * items.length)]!, bucket }));
  });
}

export interface FrameMetrics {
  /** variância do laplaciano na região do rosto (ou no quadro todo, sem palpite de rosto): mais alto = mais nítido */
  sharpness: number;
  /** brilho médio, 0–1 */
  brightness: number;
  /** fração dos pixels com tom de pele, 0–1: tela gravada e quadro vazio ficam perto de 0 */
  skin: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Variância do laplaciano (kernel 4-vizinhos) de uma imagem em tons de cinza; `region` (em pixels) limita a medida. */
export function laplacianVariance(gray: Uint8Array, width: number, height: number, region?: Box): number {
  if (width < 3 || height < 3) return 0;
  const x0 = Math.max(1, Math.floor(region?.x ?? 1));
  const y0 = Math.max(1, Math.floor(region?.y ?? 1));
  const x1 = Math.min(width - 1, Math.ceil(region ? region.x + region.width : width - 1));
  const y1 = Math.min(height - 1, Math.ceil(region ? region.y + region.height : height - 1));
  if (x1 <= x0 || y1 <= y0) return 0;
  let sum = 0;
  let squares = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      const value = gray[i - 1]! + gray[i + 1]! + gray[i - width]! + gray[i + width]! - 4 * gray[i]!;
      sum += value;
      squares += value * value;
      count++;
    }
  }
  const mean = sum / count;
  return squares / count - mean * mean;
}

export function meanBrightness(gray: Uint8Array): number {
  if (gray.length === 0) return 0;
  let sum = 0;
  for (const value of gray) sum += value;
  return sum / gray.length / 255;
}

/** Regra clássica de tom de pele em RGB (Kovac): barata e suficiente para "tem gente no quadro?". 1 = pele. */
export function skinMask(rgb: Uint8Array): Uint8Array {
  const pixels = Math.floor(rgb.length / 3);
  const mask = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const r = rgb[i * 3]!;
    const g = rgb[i * 3 + 1]!;
    const b = rgb[i * 3 + 2]!;
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15 && Math.max(r, g, b) - Math.min(r, g, b) > 15) mask[i] = 1;
  }
  return mask;
}

export function skinRatio(rgb: Uint8Array): number {
  const mask = skinMask(rgb);
  if (mask.length === 0) return 0;
  let hits = 0;
  for (const value of mask) hits += value;
  return hits / mask.length;
}

/** Desvio-padrão de cada pixel ao longo dos frames: o que não muda nunca (parede, violão na parede) é cenário. */
export function poolDeviation(grays: Uint8Array[]): Float32Array {
  const size = grays[0]?.length ?? 0;
  const deviation = new Float32Array(size);
  if (grays.length < 2) return deviation;
  for (let i = 0; i < size; i++) {
    let sum = 0;
    let squares = 0;
    for (const gray of grays) {
      const value = gray[i] ?? 0;
      sum += value;
      squares += value * value;
    }
    const mean = sum / grays.length;
    deviation[i] = Math.sqrt(Math.max(0, squares / grays.length - mean * mean));
  }
  return deviation;
}

export const FACE_GUESS = { minDeviation: 5, minAreaRatio: 0.0015, maxCenterY: 0.68 } as const;

/**
 * Palpite de onde está o rosto, sem detector: a maior mancha de pele que SE MEXE entre os frames
 * (objeto cor de pele parado é cenário) e que está na parte de cima do quadro (mãos e braços ficam
 * embaixo). É só um palpite: a folha de contato mostra o recorte para o agente conferir.
 */
export function guessFace(mask: Uint8Array, deviation: Float32Array | null, width: number, height: number): Box | null {
  const live = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) live[i] = mask[i] && (!deviation || (deviation[i] ?? 0) >= FACE_GUESS.minDeviation) ? 1 : 0;
  let best: { area: number; box: Box } | null = null;
  const stack: number[] = [];
  for (let start = 0; start < live.length; start++) {
    if (!live[start]) continue;
    live[start] = 0;
    stack.push(start);
    let area = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    while (stack.length) {
      const index = stack.pop()!;
      const x = index % width;
      const y = (index - x) / width;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      // 8 vizinhos: a máscara de pele sai rendada (óculos, barba, sombra)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (live[next]) {
            live[next] = 0;
            stack.push(next);
          }
        }
      }
    }
    const centerY = (minY + maxY + 1) / 2 / height;
    if (area < mask.length * FACE_GUESS.minAreaRatio || centerY > FACE_GUESS.maxCenterY) continue;
    if (!best || area > best.area) best = { area, box: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
  }
  return best ? best.box : null;
}

/** Aumenta uma caixa em torno do próprio centro, sem sair do quadro. */
export function growBox(box: Box, factor: number, width: number, height: number): Box {
  const w = Math.min(width, box.width * factor);
  const h = Math.min(height, box.height * factor);
  const x = Math.min(width - w, Math.max(0, box.x + box.width / 2 - w / 2));
  const y = Math.min(height - h, Math.max(0, box.y + box.height / 2 - h / 2));
  return { x, y, width: w, height: h };
}

/** Quadrado em torno do rosto para o recorte ampliado da folha de contato. */
export function faceCrop(face: Box | null, width: number, height: number): Box {
  const side = Math.min(height, face ? Math.max(face.width, face.height) * 2.4 : height * 0.6);
  const center = face ? { x: face.x + face.width / 2, y: face.y + face.height / 2 } : { x: width / 2, y: height * 0.42 };
  return {
    x: Math.round(Math.min(width - side, Math.max(0, center.x - side / 2))),
    y: Math.round(Math.min(height - side, Math.max(0, center.y - side / 2))),
    width: Math.round(side),
    height: Math.round(side),
  };
}

/**
 * Nota 0–1 de um frame. Nitidez pesa mais (é o que separa gesto borrado de pose parada); pele
 * satura cedo (um rosto pequeno já basta); exposição só castiga os extremos.
 */
export function frameScore(metrics: FrameMetrics, maxSharpness: number): number {
  const sharp = maxSharpness > 0 ? Math.min(1, metrics.sharpness / maxSharpness) : 0;
  const skin = Math.min(1, metrics.skin / 0.04);
  const exposure = metrics.brightness < 0.08 || metrics.brightness > 0.92 ? 0 : Math.min(1, metrics.brightness / 0.18, (1 - metrics.brightness) / 0.25);
  return 0.5 * sharp + 0.3 * skin + 0.2 * exposure;
}

export interface MeasuredFrame extends FrameCandidate {
  metrics: FrameMetrics;
  /** palpite do rosto, em fração do quadro (0–1) */
  face?: Box | null;
}

export interface RankedFrame extends MeasuredFrame {
  score: number;
}

/**
 * O melhor frame de cada faixa de tempo; se faltar (faixa vazia), completa com os melhores que
 * sobraram respeitando `minGapSec`. Sai em ordem de tempo, que é como a folha de contato numera.
 */
export function pickFrames(measured: MeasuredFrame[], count: number, minGapSec: number): RankedFrame[] {
  const maxSharpness = Math.max(0, ...measured.map((frame) => frame.metrics.sharpness));
  const ranked = measured.map((frame) => ({ ...frame, score: frameScore(frame.metrics, maxSharpness) })).sort((a, b) => b.score - a.score);
  const chosen: RankedFrame[] = [];
  const buckets = new Set<number>();
  for (const frame of ranked) {
    if (chosen.length >= count) break;
    if (buckets.has(frame.bucket)) continue;
    buckets.add(frame.bucket);
    chosen.push(frame);
  }
  for (const frame of ranked) {
    if (chosen.length >= count) break;
    if (chosen.includes(frame) || chosen.some((other) => Math.abs(other.at - frame.at) < minGapSec)) continue;
    chosen.push(frame);
  }
  return chosen.sort((a, b) => a.at - b.at);
}
