/**
 * Foco dinâmico do Short 9:16 (planejamento puro). Recebe a série bruta do detector (centro horizontal do
 * apresentador, fração da largura, em segundos da FONTE) e decide, à moda do AutoFlip: sujeito quase parado →
 * foco fixo na mediana; sujeito que anda → pan suave com zona morta, velocidade e aceleração limitadas.
 * Cada trecho contínuo da fonte é planejado sozinho: no corte o foco pode pular seco, mas nenhum pan atravessa um corte.
 */

/** Largura de referência dos parâmetros em px: os valores valem para um quadro de 1920 e escalam com a fonte. */
export const FOCUS_REF_WIDTH = 1920;
/** Clipes separados por menos que isso na fonte são o mesmo plano (não há corte visível entre eles). */
export const MERGE_GAP_SEC = 0.05;
/**
 * O primeiro frame de um clipe pode cair até meio frame antes do `start` (o corte arredonda para o frame).
 * O keyframe de abertura do trecho recua isso para o pulo de foco acontecer inteiro no intervalo cortado.
 */
export const CUT_MARGIN_SEC = 0.02;

export interface FocusKeyframe {
  /** segundos da FONTE */
  t: number;
  /** posição do recorte (mesma semântica de `focusX`: 0 = encostado à esquerda, 1 = à direita) */
  x: number;
}

/** Foco já resolvido: um número fixo ou keyframes interpolados linearmente no tempo da fonte. */
export type ResolvedFocus = number | FocusKeyframe[];

export interface FocusSample {
  /** segundos da FONTE */
  t: number;
  /** centro horizontal do apresentador, fração da largura do quadro (0–1) */
  x: number;
  /** 0–1: o quanto o detector confia na amostra */
  confidence: number;
}

export interface Span {
  start: number;
  end: number;
}

export interface FocusParams {
  /** variação (p90 − p10) do centro abaixo da qual o foco fica fixo no Short inteiro (e num trecho) */
  fixedSpreadPx: number;
  /** quanto o sujeito sai do centro do recorte antes do pan começar */
  deadZonePx: number;
  /** o pan para quando o erro cai abaixo disso */
  settlePx: number;
  maxSpeedPx: number;
  maxAccelPx: number;
  /** janela da mediana móvel que tira os saltos isolados do detector */
  medianWindowSec: number;
  /** amostras abaixo disso são ignoradas (quadro sem apresentador, só fundo) */
  minConfidence: number;
  /** passo da simulação da câmera */
  stepSec: number;
  /** erro máximo da simplificação em keyframes */
  tolerancePx: number;
}

export const DEFAULT_FOCUS_PARAMS: FocusParams = {
  fixedSpreadPx: 128,
  deadZonePx: 80,
  settlePx: 16,
  maxSpeedPx: 240,
  maxAccelPx: 480,
  medianWindowSec: 2.5,
  minConfidence: 0.15,
  stepSec: 0.1,
  tolerancePx: 2,
};

export type SegmentMode = 'fixed' | 'pan' | 'empty';

export interface FocusSegmentPlan extends Span {
  mode: SegmentMode;
  /** centro mediano do apresentador no trecho (fração da largura) */
  center: number;
}

export interface FocusPlan {
  mode: 'fixed' | 'pan';
  focus: ResolvedFocus;
  /** p90 − p10 do centro no Short, em px de referência */
  spreadPx: number;
  samples: number;
  segments: FocusSegmentPlan[];
}

const px = (value: number) => value / FOCUS_REF_WIDTH;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Largura do recorte 9:16 como fração da largura do quadro (mesma conta do `crop`). */
export function cropFraction(width: number, height: number): number {
  return Math.min(1, (height * 9) / 16 / width);
}

/** Centro do apresentador → `focusX` (posição do recorte), já limitado ao quadro. */
export function centerToFocus(center: number, crop: number): number {
  if (crop >= 1) return 0.5;
  return clamp01((center - crop / 2) / (1 - crop));
}

export function focusToCenter(focus: number, crop: number): number {
  return crop / 2 + clamp01(focus) * (1 - crop);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (pos - low);
}

/** Variação robusta (p90 − p10): ignora os 10% de cada ponta, onde moram os erros do detector. */
export function spread(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return quantile(sorted, 0.9) - quantile(sorted, 0.1);
}

/** Trechos contínuos da fonte (clipes ordenados, colados quando o intervalo é menor que um corte visível). */
export function focusSegments(clips: readonly Span[]): Span[] {
  const merged: Span[] = [];
  for (const clip of [...clips].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && clip.start - last.end < MERGE_GAP_SEC) last.end = Math.max(last.end, clip.end);
    else merged.push({ start: clip.start, end: clip.end });
  }
  return merged;
}

/** Mediana móvel das amostras confiáveis; devolve pontos `{t, x}` em ordem de tempo. */
export function medianSmooth(samples: readonly FocusSample[], windowSec: number, minConfidence: number): FocusKeyframe[] {
  const kept = samples.filter((sample) => sample.confidence >= minConfidence && Number.isFinite(sample.x)).sort((a, b) => a.t - b.t);
  const half = windowSec / 2;
  let from = 0;
  let to = 0;
  return kept.map((sample) => {
    while (kept[from]!.t < sample.t - half) from += 1;
    while (to < kept.length && kept[to]!.t <= sample.t + half) to += 1;
    return { t: sample.t, x: median(kept.slice(from, to).map((item) => item.x)) };
  });
}

/** Valor interpolado linearmente; segura o primeiro/último valor fora da série. */
export function interpolate(points: readonly FocusKeyframe[], t: number): number {
  if (points.length === 0) return NaN;
  if (t <= points[0]!.t) return points[0]!.x;
  const last = points.at(-1)!;
  if (t >= last.t) return last.x;
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (points[mid]!.t <= t) low = mid;
    else high = mid;
  }
  const a = points[low]!;
  const b = points[high]!;
  return b.t === a.t ? b.x : a.x + ((b.x - a.x) * (t - a.t)) / (b.t - a.t);
}

/**
 * Câmera virtual que segue o alvo dentro de um trecho: parada até o sujeito sair da zona morta, então acelera
 * (limite de aceleração), anda no máximo a `maxSpeed` e freia a tempo de não passar do alvo (v ≤ √(2·a·erro)).
 * Para de vez quando o erro cai abaixo de `settle`: a histerese entre zona morta e `settle` evita tremedeira.
 * Posições em fração da largura (centro do apresentador).
 */
export function followTarget(points: readonly FocusKeyframe[], segment: Span, params: FocusParams): FocusKeyframe[] {
  const deadZone = px(params.deadZonePx);
  const settle = px(params.settlePx);
  const maxSpeed = px(params.maxSpeedPx);
  const maxAccel = px(params.maxAccelPx);
  const dv = maxAccel * params.stepSec;
  const opening = points.filter((point) => point.t <= Math.min(segment.end, segment.start + 1));
  let position = median((opening.length ? opening : points.slice(0, 1)).map((point) => point.x));
  let velocity = 0;
  let moving = false;
  const out: FocusKeyframe[] = [{ t: segment.start, x: position }];
  const steps = Math.ceil((segment.end - segment.start) / params.stepSec - 1e-9);
  for (let index = 1; index <= steps; index += 1) {
    const t = Math.min(segment.end, segment.start + index * params.stepSec);
    const error = interpolate(points, t) - position;
    const distance = Math.abs(error);
    if (!moving && distance > deadZone) moving = true;
    if (moving && distance <= settle) moving = false;
    const desired = moving ? Math.sign(error) * Math.min(maxSpeed, Math.sqrt(2 * maxAccel * distance)) : 0;
    velocity += Math.min(dv, Math.max(-dv, desired - velocity));
    if (!moving && Math.abs(velocity) < 1e-6) velocity = 0;
    const travel = velocity * (t - out.at(-1)!.t);
    if (travel !== 0 && Math.sign(travel) === Math.sign(error) && Math.abs(travel) >= distance) {
      // o passo discreto passaria do alvo: pousa nele e só freia o que a aceleração permite
      position += error;
      velocity = Math.sign(velocity) * Math.max(0, Math.abs(velocity) - dv);
    } else position += travel;
    out.push({ t, x: position });
  }
  return out;
}

/** Ramer–Douglas–Peucker pelo erro vertical (o que importa é a posição do recorte em cada instante). */
export function simplify(points: readonly FocusKeyframe[], tolerance: number): FocusKeyframe[] {
  if (points.length <= 2) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const a = points[first]!;
    const b = points[last]!;
    let worst = -1;
    let worstError = tolerance;
    for (let index = first + 1; index < last; index += 1) {
      const p = points[index]!;
      const expected = b.t === a.t ? a.x : a.x + ((b.x - a.x) * (p.t - a.t)) / (b.t - a.t);
      const error = Math.abs(p.x - expected);
      if (error > worstError) {
        worst = index;
        worstError = error;
      }
    }
    if (worst >= 0) {
      keep[worst] = true;
      stack.push([first, worst], [worst, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

export interface PlanOptions {
  /** largura do recorte / largura do quadro (`cropFraction`) */
  crop: number;
  /** foco quando não há amostra confiável no Short */
  fallback?: number;
  params?: Partial<FocusParams>;
}

/** Série bruta → plano de foco (fixo ou keyframes em segundos da fonte), trecho a trecho. */
export function planFocus(samples: readonly FocusSample[], clips: readonly Span[], options: PlanOptions): FocusPlan {
  const params = { ...DEFAULT_FOCUS_PARAMS, ...options.params };
  const segments = focusSegments(clips);
  const inside = (t: number) => segments.some((segment) => t >= segment.start && t <= segment.end);
  const points = medianSmooth(samples, params.medianWindowSec, params.minConfidence).filter((point) => inside(point.t));
  const toFocus = (center: number) => round(centerToFocus(center, options.crop), 4);
  const fallback = options.fallback ?? 0.5;

  if (points.length === 0) {
    return { mode: 'fixed', focus: fallback, spreadPx: 0, samples: 0, segments: segments.map((segment) => ({ ...segment, mode: 'empty', center: focusToCenter(fallback, options.crop) })) };
  }
  const globalCenter = median(points.map((point) => point.x));
  const spreadPx = round(spread(points.map((point) => point.x)) * FOCUS_REF_WIDTH, 1);
  if (spreadPx <= params.fixedSpreadPx) {
    return { mode: 'fixed', focus: toFocus(globalCenter), spreadPx, samples: points.length, segments: segments.map((segment) => ({ ...segment, mode: 'fixed', center: globalCenter })) };
  }

  const keyframes: FocusKeyframe[] = [];
  const plans: FocusSegmentPlan[] = [];
  let previousCenter = globalCenter;
  for (const segment of segments) {
    const local = points.filter((point) => point.t >= segment.start && point.t <= segment.end);
    let path: FocusKeyframe[];
    let mode: SegmentMode;
    let center: number;
    if (local.length === 0) {
      // trecho sem apresentador visível: segura onde o anterior terminou
      mode = 'empty';
      center = previousCenter;
      path = [{ t: segment.start, x: center }, { t: segment.end, x: center }];
    } else if (spread(local.map((point) => point.x)) * FOCUS_REF_WIDTH <= params.fixedSpreadPx) {
      mode = 'fixed';
      center = median(local.map((point) => point.x));
      path = [{ t: segment.start, x: center }, { t: segment.end, x: center }];
    } else {
      mode = 'pan';
      center = median(local.map((point) => point.x));
      path = followTarget(local, segment, params);
    }
    previousCenter = path.at(-1)!.x;
    plans.push({ ...segment, mode, center });
    const framed = simplify(path.map((point) => ({ t: point.t, x: centerToFocus(point.x, options.crop) })), px(params.tolerancePx));
    const lastEnd = keyframes.at(-1)?.t;
    framed.forEach((point, index) => {
      const t = index === 0 && lastEnd !== undefined ? Math.max(lastEnd, point.t - CUT_MARGIN_SEC) : point.t;
      keyframes.push({ t: round(t, 3), x: round(point.x, 4) });
    });
  }

  const xs = keyframes.map((point) => point.x);
  if (Math.max(...xs) - Math.min(...xs) <= px(params.tolerancePx)) {
    return { mode: 'fixed', focus: toFocus(globalCenter), spreadPx, samples: points.length, segments: plans };
  }
  return { mode: 'pan', focus: keyframes, spreadPx, samples: points.length, segments: plans };
}

/** Foco do recorte no instante `t` da fonte (o mesmo que a expressão do ffmpeg calcula). */
export function focusAt(focus: ResolvedFocus, t: number): number {
  return clamp01(typeof focus === 'number' ? focus : interpolate(focus, t));
}

// 6 casas: o instante de um frame (n/30) não pode arredondar para o frame vizinho
const fixed = (value: number) => Number(value.toFixed(6)).toString();
const signed = (value: number) => (value < 0 ? `(${fixed(value)})` : fixed(value));

/**
 * Foco como expressão do ffmpeg em `t`, sem aninhamento: x₀ + Σ Δxᵢ·rampaᵢ(t). Cada rampa vai de 0 a 1 entre dois
 * keyframes (degrau quando os dois têm o mesmo `t`), então antes do primeiro e depois do último o valor fica parado.
 */
export function focusExpr(focus: ResolvedFocus): string {
  if (typeof focus === 'number') return clamp01(focus).toFixed(3);
  const points = [...focus].sort((a, b) => a.t - b.t);
  if (points.length === 0) return '0.5';
  const terms = [fixed(clamp01(points[0]!.x))];
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const delta = clamp01(b.x) - clamp01(a.x);
    if (Math.abs(delta) < 1e-6) continue;
    const ramp = b.t - a.t > 1e-6 ? `clip((t-${fixed(a.t)})/${fixed(b.t - a.t)},0,1)` : `gte(t,${fixed(b.t)})`;
    terms.push(`${signed(delta)}*${ramp}`);
  }
  return terms.length === 1 ? terms[0]! : `(${terms.join('+')})`;
}
