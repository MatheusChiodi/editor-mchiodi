/**
 * Arrastar um gráfico no preview: contas puras (sem DOM). O `offset` da EDL é fração do quadro (0 = posição original)
 * e SOMA com o deslocamento automático que afasta do rosto (`shift`). A caixa na tela é a área ocupada pelo componente
 * (motion/src/arsenal/footprints.json) + shift + offset; o snap puxa as bordas e o centro dessa caixa para as guias.
 */
import type { CutOp } from '../../../src/cut/ops.ts';
import { FACE_BOX_HALF, type Box, type Footprints, moveBox, type Point, SAFE } from '../../../src/edl/fit.ts';
import type { Edl, Overlay } from '../../../src/edl/schema.ts';
import { sourceToOutput, type Timeline } from '../../../src/edl/timeline.ts';

/** Caixa de um componente sem medida em footprints.json: um quadro no meio, só para dar o que arrastar. */
export const FALLBACK_BOX: Box = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
/** Passo do nudge por teclado (fração do quadro): fino e grosso (Shift). */
export const NUDGE_STEP = 0.005;
export const NUDGE_BIG = 0.05;
/** A partir de quantos px de arraste o gesto começa (um clique não move nada). */
export const DRAG_SLOP_PX = 3;
/** Distância (px da tela) em que a borda "gruda" na guia. */
export const SNAP_PX = 8;
/** Deslocamento do duplicado, para ele não nascer escondido atrás do original. */
export const DUPLICATE_STEP: Point = { x: 0.06, y: 0.06 };

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const EPS = 5e-4;

export const isZero = (offset: Point | undefined | null): boolean => !offset || (Math.abs(offset.x) < EPS && Math.abs(offset.y) < EPS);

export interface Guides {
  x: number[];
  y: number[];
}

/** Caixa do rosto que nenhum gráfico deve cobrir (a mesma do render: FACE_BOX_HALF). */
export const faceBox = (face: Point): Box => ({ x: face.x - FACE_BOX_HALF.x, y: face.y - FACE_BOX_HALF.y, w: 2 * FACE_BOX_HALF.x, h: 2 * FACE_BOX_HALF.y });

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A caixa cobre o rosto? (aviso visual no preview) */
export const coversFace = (rect: Box, face: Point): boolean => overlaps(rect, faceBox(face));

/** Guias do quadro: margens seguras, terços, centro e as bordas da caixa do rosto (para encostar sem cobrir). */
export function frameGuides(face?: Point | null): Guides {
  const guides: Guides = { x: [SAFE.left, 1 / 3, 0.5, 2 / 3, SAFE.right], y: [SAFE.top, 1 / 3, 0.5, 2 / 3, SAFE.bottom] };
  if (face) {
    const box = faceBox(face);
    guides.x.push(box.x, box.x + box.w);
    guides.y.push(box.y, box.y + box.h);
  }
  return { x: [...new Set(guides.x.map(round3))].sort((a, b) => a - b), y: [...new Set(guides.y.map(round3))].sort((a, b) => a - b) };
}

/** Menor ajuste que leva alguma das bordas/centro (start, start+size/2, start+size) a uma guia dentro de `threshold`. */
export function snapAxis(start: number, size: number, lines: readonly number[], threshold: number): { delta: number; line: number | null } {
  let best: { delta: number; line: number } | null = null;
  for (const anchor of [start, start + size / 2, start + size]) {
    for (const line of lines) {
      const delta = line - anchor;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line };
    }
  }
  return best ?? { delta: 0, line: null };
}

/** Mantém a caixa dentro do quadro (caixa maior que o quadro fica colada na borda esquerda/superior). */
export function clampBox(rect: Box): Box {
  const x = rect.w >= 1 ? 0 : Math.min(1 - rect.w, Math.max(0, rect.x));
  const y = rect.h >= 1 ? 0 : Math.min(1 - rect.h, Math.max(0, rect.y));
  return { ...rect, x, y };
}

export interface DragInput {
  /** caixa do componente já com o deslocamento automático, SEM o offset (de onde o offset parte) */
  base: Box;
  /** offset no começo do gesto */
  startOffset: Point;
  /** quanto o ponteiro andou (fração do quadro) */
  delta: Point;
  guides: Guides;
  /** distância de colagem em fração do quadro, por eixo (SNAP_PX / tamanho do quadro em px) */
  threshold: Point;
  /** `false` (Alt apertado) desliga o snap */
  snap: boolean;
}

export interface DragResult {
  offset: Point;
  rect: Box;
  /** guias que grudaram (para desenhar a linha) */
  hit: { x: number | null; y: number | null };
}

/** Offset resultante de um arraste: soma o gesto ao offset inicial, gruda nas guias e segura no quadro. */
export function dragOffset(input: DragInput): DragResult {
  const { base } = input;
  let rect = moveBox(base, { x: input.startOffset.x + input.delta.x, y: input.startOffset.y + input.delta.y });
  const hit: DragResult['hit'] = { x: null, y: null };
  if (input.snap) {
    const sx = snapAxis(rect.x, rect.w, input.guides.x, input.threshold.x);
    const sy = snapAxis(rect.y, rect.h, input.guides.y, input.threshold.y);
    rect = { ...rect, x: rect.x + sx.delta, y: rect.y + sy.delta };
    hit.x = sx.line;
    hit.y = sy.line;
  }
  const clamped = clampBox(rect);
  // a guia só vale se a caixa ficou nela (o limite do quadro pode ter vencido)
  if (Math.abs(clamped.x - rect.x) > EPS) hit.x = null;
  if (Math.abs(clamped.y - rect.y) > EPS) hit.y = null;
  return { offset: { x: round3(clamped.x - base.x), y: round3(clamped.y - base.y) }, rect: clamped, hit };
}

/** Offset depois de um passo do teclado (Alt+setas); Shift usa o passo grosso. */
export function nudgeOffset(offset: Point | undefined, direction: 'left' | 'right' | 'up' | 'down', big = false): Point {
  const step = big ? NUDGE_BIG : NUDGE_STEP;
  const from = offset ?? { x: 0, y: 0 };
  return {
    x: round3(from.x + (direction === 'left' ? -step : direction === 'right' ? step : 0)),
    y: round3(from.y + (direction === 'up' ? -step : direction === 'down' ? step : 0)),
  };
}

/** Op que grava o offset do overlay; offset nulo apaga o campo (posição original). Nova versão: nunca sobrescreve. */
export function offsetOp(id: string, offset: Point | null): CutOp {
  if (isZero(offset)) return { type: 'updateItem', kind: 'overlays', id, patch: {}, unset: ['offset'] };
  return { type: 'updateItem', kind: 'overlays', id, patch: { offset: { x: round3(offset!.x), y: round3(offset!.y) } } };
}

/** Op que duplica o overlay no mesmo instante, deslocado um pouco (o id novo vem do servidor). */
export function duplicateOp(overlay: Overlay): CutOp {
  const { id: _id, ...rest } = overlay;
  const offset = { x: round3((overlay.offset?.x ?? 0) + DUPLICATE_STEP.x), y: round3((overlay.offset?.y ?? 0) + DUPLICATE_STEP.y) };
  return { type: 'insertItem', kind: 'overlays', item: { ...rest, offset } };
}

/** Gráfico que o editor deixa arrastar: pinta sobre o footage (não é palco, cena de tela cheia nem camada fixa). */
export function isDraggable(overlay: Pick<Overlay, 'component' | 'presenter' | 'layer' | 'props'>, footprints: Footprints): boolean {
  if (overlay.layer === 'persistent' || overlay.presenter || overlay.component.startsWith('scene:')) return false;
  if (overlay.component === 'WindowStage' && overlay.props.kind === 'footage') return false;
  return footprints[overlay.component] !== null;
}

export interface GraphicHandle {
  overlay: Overlay;
  /** caixa na tela agora: componente + shift automático + offset */
  rect: Box;
  /** de onde o offset parte: componente + shift automático */
  base: Box;
}

/** Gráficos arrastáveis visíveis no instante `source` (segundos da fonte), com a caixa atual de cada um. */
export function handlesAt(edl: Pick<Edl, 'overlays'>, timeline: Timeline, source: number, footprints: Footprints, shifts: Readonly<Record<string, Point>> = {}): GraphicHandle[] {
  const handles: GraphicHandle[] = [];
  for (const overlay of edl.overlays) {
    if (source < overlay.at || source >= overlay.at + overlay.duration) continue;
    if (sourceToOutput(timeline, overlay.at) === null || !isDraggable(overlay, footprints)) continue;
    const footprint = footprints[overlay.component] ?? FALLBACK_BOX;
    const base = moveBox(footprint, shifts[overlay.id]);
    handles.push({ overlay, base, rect: moveBox(base, overlay.offset) });
  }
  return handles;
}
