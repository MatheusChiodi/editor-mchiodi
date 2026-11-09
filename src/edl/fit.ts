/**
 * Ajuste do vídeo ao recorte do gráfico: gráfico sem `presenter` pinta por cima do footage e, quando cai sobre o
 * rosto, o vídeo precisa se mover. O planejador mede o que cada componente ocupa (`footprints.json`, gerado por
 * `scripts/measure-footprints.ts`) e, se a área bate no apresentador, gera um zoom que leva o rosto para o lado livre.
 * Núcleo puro: o render só aplica o que sai daqui.
 */
import type { FocusSample } from '../render/focus.ts';
import { stageSourceSpans } from '../render/stage-focus.ts';
import type { Edl, Overlay, Zoom } from './schema.ts';
import type { Timeline } from './timeline.ts';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}
export type Footprints = Record<string, Box | null | undefined>;

export const FIT_PREFIX = 'fit-';
/** Sujeito a manter livre: cabeça e ombros (metade da largura/altura, em fração do quadro). */
export const SUBJECT_HALF: Point = { x: 0.11, y: 0.16 };
export const DEFAULT_FACE: Point = { x: 0.5, y: 0.4 };
const MARGIN = 0.02;
const MAX_SCALE = 1.45;
const SCALES = [1.08, 1.12, 1.16, 1.2, 1.25, 1.3, 1.35, 1.4, MAX_SCALE];
/** Acima disso o gráfico é tela cheia: não há lado livre, só palco (`presenter`). */
const FULL_AREA = 0.6;
/** Rosto a proteger (meia largura/altura): nenhum gráfico passa por cima, nem de ênfase curta. */
export const FACE_BOX_HALF: Point = { x: 0.1, y: 0.13 };
/** Limites do quadro onde um gráfico deslocado pode ficar (a base é da legenda). */
export const SAFE = { top: 0.02, bottom: 0.8, left: 0.02, right: 0.98 };

export type FitStatus = 'livre' | 'deslocado' | 'ajustado' | 'precisa-palco' | 'zoom-manual' | 'sem-medida' | 'ignorado';

export interface FitItem {
  overlay: string;
  component: string;
  status: FitStatus;
  zoom?: Zoom;
  /** deslocamento do gráfico (fração do quadro) quando o vídeo não resolve sozinho */
  shift?: Point;
  note: string;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inflate = (box: Box, by: number): Box => ({ x: box.x - by, y: box.y - by, w: box.w + 2 * by, h: box.h + 2 * by });
const subjectBox = (face: Point): Box => ({ x: face.x - SUBJECT_HALF.x, y: face.y - SUBJECT_HALF.y, w: 2 * SUBJECT_HALF.x, h: 2 * SUBJECT_HALF.y });
/** Caixa deslocada pelo `offset` manual do overlay (fração do quadro). */
export const moveBox = (box: Box, by?: Point): Box => (by ? { ...box, x: box.x + by.x, y: box.y + by.y } : box);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Onde um ponto da fonte (0–1) cai na tela com zoom `scale` e foco `focus` (mesma conta do filtro `crop`). */
export const screenPos = (p: number, scale: number, focus: number): number => scale * p - (scale - 1) * focus;

/**
 * Menor zoom que leva o sujeito para fora da área ocupada, e o foco que faz isso.
 * O rosto vai para o ponto do vão livre mais próximo de onde já está; a altura se mantém (foco y = y do rosto).
 */
export function fitZoom(footprint: Box, face: Point = DEFAULT_FACE): { scale: number; focus: Point } | null {
  const blocked = inflate(footprint, MARGIN);
  const gaps = [
    { from: 0, to: blocked.x },
    { from: blocked.x + blocked.w, to: 1 },
  ];
  for (const scale of SCALES) {
    const half = SUBJECT_HALF.x * scale;
    // com foco 0..1 o centro do rosto só alcança esta faixa na tela
    const reach = { min: scale * face.x - (scale - 1), max: scale * face.x };
    let best: { target: number; shift: number } | null = null;
    for (const gap of gaps) {
      const lo = Math.max(gap.from + half, reach.min);
      const hi = Math.min(gap.to - half, reach.max);
      if (lo > hi) continue;
      const target = Math.min(hi, Math.max(lo, face.x));
      const shift = Math.abs(target - face.x);
      if (!best || shift < best.shift) best = { target, shift };
    }
    // menor zoom que resolve; dentro dele, a menor mudança de posição
    if (best) return { scale, focus: { x: round3((scale * face.x - best.target) / (scale - 1)), y: face.y } };
  }
  return null;
}

/**
 * Menor deslocamento do gráfico que o tira de cima do rosto, mantendo-o dentro do quadro (a base fica livre para a legenda).
 * null quando não cabe em lugar nenhum.
 */
export function shiftAwayFrom(box: Box, face: Point): Point | null {
  const guard = inflate({ x: face.x - FACE_BOX_HALF.x, y: face.y - FACE_BOX_HALF.y, w: 2 * FACE_BOX_HALF.x, h: 2 * FACE_BOX_HALF.y }, MARGIN);
  if (!overlaps(box, guard)) return { x: 0, y: 0 };
  const options: Point[] = [
    { x: 0, y: guard.y - (box.y + box.h) },
    { x: 0, y: guard.y + guard.h - box.y },
    { x: guard.x - (box.x + box.w), y: 0 },
    { x: guard.x + guard.w - box.x, y: 0 },
  ];
  const fits = options.filter((d) => {
    const x = box.x + d.x;
    const y = box.y + d.y;
    return x >= SAFE.left && x + box.w <= SAFE.right && y >= SAFE.top && y + box.h <= SAFE.bottom;
  });
  if (!fits.length) return null;
  const best = fits.reduce((a, b) => (Math.abs(a.x) + Math.abs(a.y) <= Math.abs(b.x) + Math.abs(b.y) ? a : b));
  return { x: round3(best.x), y: round3(best.y) };
}

/** Centro do rosto no trecho do overlay (mediana das amostras do detector com rosto achado); null sem amostra. */
export function faceForOverlay(samples: readonly FocusSample[] | null, timeline: Timeline, overlay: Pick<Overlay, 'at' | 'duration'>, minConfidence = 0.2): Point | null {
  if (!samples?.length) return null;
  const spans = stageSourceSpans(timeline, overlay);
  const faces = samples.filter((sample) => sample.face && sample.confidence >= minConfidence && spans.some((span) => sample.t >= span.start - 0.5 && sample.t <= span.end + 0.5));
  if (!faces.length) return null;
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  return { x: median(faces.map((sample) => sample.face!.x)), y: median(faces.map((sample) => sample.face!.y)) };
}

const zoomEnd = (zoom: Pick<Zoom, 'at' | 'duration'>) => zoom.at + zoom.duration;
const touches = (zoom: Pick<Zoom, 'at' | 'duration'>, at: number, end: number) => zoom.at < end && at < zoomEnd(zoom);

/** Gráficos que não reenquadram o vídeo sozinhos e pintam sobre o footage. */
function paintsOverFootage(overlay: Overlay): boolean {
  if (overlay.layer === 'persistent') return false;
  // cena ilustrativa é tela cheia: o footage some, não há o que ajustar
  if (overlay.component.startsWith('scene:')) return false;
  if (overlay.presenter) return false;
  if (overlay.component === 'WindowStage' && overlay.props.kind === 'footage') return false;
  return true;
}

export interface FitOptions {
  /** centro do rosto (0–1) quando não há detector; o zoom termina no fim do clipe onde começou, como todo zoom */
  face?: Point;
  /** rosto medido no trecho de cada gráfico (detector); vence `face` */
  faceOf?: (overlay: Overlay) => Point | null;
}

/** Planeja o ajuste de cada gráfico. Zooms `fit-*` antigos são descartados: o plano é sempre refeito do zero. */
export function planFit(edl: Pick<Edl, 'overlays' | 'zooms'>, footprints: Footprints, options: FitOptions = {}): FitItem[] {
  const manual = edl.zooms.filter((zoom) => !zoom.id.startsWith(FIT_PREFIX));
  const items: FitItem[] = [];
  const taken: Zoom[] = [];
  for (const overlay of [...edl.overlays].sort((a, b) => a.at - b.at)) {
    const base = { overlay: overlay.id, component: overlay.component };
    const face = options.faceOf?.(overlay) ?? options.face ?? DEFAULT_FACE;
    const subject = inflate(subjectBox(face), MARGIN);
    if (!paintsOverFootage(overlay)) {
      items.push({ ...base, status: 'ignorado', note: 'já tem palco (presenter), é cena de tela cheia ou camada fixa' });
      continue;
    }
    const placed = footprints[overlay.component];
    // o arraste manual (offset) desloca a área ocupada: a conta de rosto livre parte de onde o gráfico está de fato
    const box = placed ? moveBox(placed, overlay.offset) : placed;
    if (box === undefined) {
      items.push({ ...base, status: 'sem-medida', note: 'componente sem medida em footprints.json (rode scripts/measure-footprints.ts)' });
      continue;
    }
    if (box === null) {
      items.push({ ...base, status: 'livre', note: 'não pinta nada sobre o footage' });
      continue;
    }
    if (!overlaps(box, subject)) {
      items.push({ ...base, status: 'livre', note: 'a área ocupada não toca o rosto' });
      continue;
    }
    const end = overlay.at + overlay.duration;
    if (manual.some((zoom) => touches(zoom, overlay.at, end))) {
      items.push({ ...base, status: 'zoom-manual', note: 'já existe zoom da EDL neste trecho: confira se libera o rosto' });
      continue;
    }
    if (box.w * box.h >= FULL_AREA) {
      items.push({ ...base, status: 'precisa-palco', note: 'ocupa o quadro quase todo: use `presenter` (SplitExplainer/WindowStage) ou cena com rasgo' });
      continue;
    }
    const fit = fitZoom(box, face);
    if (!fit) {
      const shift = shiftAwayFrom(box, face);
      if (shift) {
        items.push({ ...base, status: 'deslocado', shift, note: `gráfico deslocado ${shift.x ? `${shift.x > 0 ? '→' : '←'}${Math.abs(shift.x)}` : `${shift.y > 0 ? '↓' : '↑'}${Math.abs(shift.y)}`} para sair de cima do rosto` });
        continue;
      }
      items.push({ ...base, status: 'precisa-palco', note: 'não há vão livre largo o bastante para o rosto: use `presenter`' });
      continue;
    }
    const zoom: Zoom = {
      id: `${FIT_PREFIX}${overlay.id}`,
      at: overlay.at,
      duration: overlay.duration,
      scale: fit.scale,
      focus: fit.focus,
      mode: 'ease',
      reason: `libera a área de ${overlay.component}: leva o rosto para o lado sem gráfico`,
    };
    if (taken.some((other) => touches(other, zoom.at, zoomEnd(zoom)))) {
      items.push({ ...base, status: 'zoom-manual', note: 'dois gráficos juntos no mesmo trecho: só um zoom de ajuste por vez' });
      continue;
    }
    taken.push(zoom);
    items.push({ ...base, status: 'ajustado', zoom, note: `zoom ${fit.scale} com foco x ${fit.focus.x}` });
  }
  return items;
}

/** EDL com os zooms de ajuste aplicados (sem gravar nada). */
export function withFit<T extends Pick<Edl, 'overlays' | 'zooms'>>(edl: T, footprints: Footprints, options: FitOptions = {}): T {
  const zooms = planFit(edl, footprints, options).flatMap((item) => (item.zoom ? [item.zoom] : []));
  return { ...edl, zooms: [...edl.zooms.filter((zoom) => !zoom.id.startsWith(FIT_PREFIX)), ...zooms] };
}

export interface Guard {
  items: FitItem[];
  /** zooms de ajuste (`fit-*`) para somar aos da EDL */
  zooms: Zoom[];
  /** deslocamento por id de overlay */
  shifts: Map<string, Point>;
}

/**
 * Garantia "nenhum gráfico na frente do rosto": usa o rosto medido no trecho de cada gráfico (detector) e decide,
 * por gráfico, entre deixar como está, zoom no vídeo, deslocar o gráfico ou pedir palco.
 */
export function planGuard(edl: Pick<Edl, 'overlays' | 'zooms'>, footprints: Footprints, timeline: Timeline, samples: readonly FocusSample[] | null, fallback?: Point): Guard {
  const items = planFit(edl, footprints, { face: fallback, faceOf: (overlay) => faceForOverlay(samples, timeline, overlay) });
  return {
    items,
    zooms: items.flatMap((item) => (item.zoom ? [item.zoom] : [])),
    shifts: new Map(items.flatMap((item) => (item.shift ? [[item.overlay, item.shift] as const] : []))),
  };
}
