/**
 * O quadro do footage em `t`, calculado em NÚMERO com as mesmas contas do render (ffmpeg), para o preview do
 * MChiodi Cut mostrar o que o render produz. Um só caminho, sem reimplementar:
 *  - zoom da EDL e de ajuste `fit-*`: `zoomStateAt` (video.ts), o espelho numérico de `zoomFilters`;
 *  - efeitos de câmera: as MESMAS expressões que `buildEffectFilters` entrega ao ffmpeg, avaliadas aqui;
 *  - palco do apresentador: `transformAt` (motion/src/arsenal/stage.ts), igual às expressões de reframe.ts.
 * Cada etapa do render é `scale` (largura par) + `crop`/`overlay`; aqui vira uma transformação afim por eixo
 * (`saída = s·entrada + t`, em px do quadro), com a mesma quantização de largura par.
 * O que depende de Node (detector de rosto, footprints) chega pelo plano do servidor (src/cut/guard.ts).
 */
import { type FootageTransform, transformAt } from '../../motion/src/arsenal/stage.ts';
import { buildEffectFilters, effects as presets } from '../arsenal/effects.ts';
import type { PlacedEffect } from './effects.ts';
import type { PlacedStage } from './reframe.ts';
import { type PlacedZoom, zoomStateAt } from './video.ts';

/** `saída = s·entrada + t`, por eixo, em px do quadro de saída. */
export interface Affine {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

export const IDENTITY_AFFINE: Affine = { sx: 1, sy: 1, tx: 0, ty: 0 };

/** Retângulo (px do quadro) em que o footage escalado pousa sobre o papel: `scale` + `overlay` do reframe. */
export interface StageBox {
  w: number;
  h: number;
  x: number;
  y: number;
}

/** Função de expressão do ffmpeg (subconjunto que os filtros do projeto usam). */
const scopeFor = (t: number) => ({
  t,
  PI: Math.PI,
  gte: (a: number, b: number) => (a >= b ? 1 : 0),
  lte: (a: number, b: number) => (a <= b ? 1 : 0),
  gt: (a: number, b: number) => (a > b ? 1 : 0),
  lt: (a: number, b: number) => (a < b ? 1 : 0),
  eq: (a: number, b: number) => (a === b ? 1 : 0),
  between: (v: number, a: number, b: number) => (v >= a && v <= b ? 1 : 0),
  clip: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)),
  trunc: Math.trunc,
  floor: Math.floor,
  round: Math.round,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  exp: Math.exp,
  pow: Math.pow,
  sin: Math.sin,
  cos: Math.cos,
  mod: (a: number, b: number) => a - b * Math.floor(a / b),
});

const compiled = new Map<string, (...args: unknown[]) => number>();

/** Avalia uma expressão do ffmpeg em `t`. Só aceita o que os geradores do projeto emitem (identificadores conhecidos). */
export function evalFfmpeg(expression: string, t: number): number {
  const scope = scopeFor(t);
  const names = Object.keys(scope);
  const unknown = expression.match(/[A-Za-z_]\w*/g)?.filter((name) => !names.includes(name));
  if (unknown?.length) throw new Error(`expressão com identificador desconhecido: ${[...new Set(unknown)].join(', ')}`);
  let fn = compiled.get(expression);
  if (!fn) {
    fn = new Function(...names, `return ${expression};`) as (...args: unknown[]) => number;
    compiled.set(expression, fn);
  }
  return fn(...Object.values(scope));
}

/** Largura/altura par do `scale=w='trunc(W*z/2)*2'`. */
const evenSize = (full: number, z: number) => Math.trunc((full * z) / 2) * 2;

/** `scale` por `z` e `crop` de volta ao quadro com origem `fx,fy` (0–1): um passo `zoomFilters`/`reframe` do render. */
export function applyReframe(a: Affine, width: number, height: number, z: number, fx: number, fy: number): Affine {
  const kx = evenSize(width, z) / width;
  const ky = evenSize(height, z) / height;
  return { sx: kx * a.sx, sy: ky * a.sy, tx: kx * a.tx - width * (z - 1) * fx, ty: ky * a.ty - height * (z - 1) * fy };
}

/** Zoom da EDL + `fit-*` no instante de saída `t`. */
export function zoomAffine(zooms: PlacedZoom[], width: number, height: number, t: number): Affine {
  const { scale, focus } = zoomStateAt(zooms, t);
  return applyReframe(IDENTITY_AFFINE, width, height, scale, focus.x, focus.y);
}

export interface CameraStep {
  z: string;
  fx: string;
  fy: string;
}

/**
 * Lê o passo `scale`+`crop` que os efeitos de câmera geram (src/arsenal/effects.ts `reframe`). Devolve null para
 * efeito sem esse formato (cor, luz, glitch…), que o preview não consegue refazer no `<video>`.
 */
export function cameraStep(filters: readonly string[], width: number, height: number): CameraStep | null {
  const scale = filters.find((line) => line.startsWith('scale=w=\''));
  const crop = filters.find((line) => line.startsWith('crop='));
  if (!scale || !crop || filters.some((line) => !/^(scale|crop)=/.test(line))) return null;
  const head = `scale=w='trunc(${width}*`;
  const tail = `/2)*2':h='trunc(${height}*`;
  const end = scale.indexOf(tail);
  if (!scale.startsWith(head) || end < 0) return null;
  const z = scale.slice(head.length, end);
  const xHead = `crop=${width}:${height}:x='${width}*(${z}-1)*`;
  const yHead = `':y='${height}*(${z}-1)*`;
  if (!crop.startsWith(xHead) || !crop.endsWith("'")) return null;
  const body = crop.slice(xHead.length, -1);
  const split = body.indexOf(yHead);
  if (split < 0) return null;
  return { z, fx: body.slice(0, split), fy: body.slice(split + yHead.length) };
}

/** Efeitos de câmera de `placed` ativos em `t`, na ordem do render, e os `filter` que o preview não cobre. */
export function effectAffine(placed: readonly PlacedEffect[], size: { width: number; height: number }, fps: number, t: number): { affine: Affine; uncovered: string[] } {
  let affine = IDENTITY_AFFINE;
  const uncovered: string[] = [];
  for (const effect of placed) {
    const preset = presets[effect.preset];
    if (!preset || preset.kind !== 'filter' || t < effect.start || t > effect.end) continue;
    const filters = buildEffectFilters(effect.preset, { start: effect.start, end: effect.end, intensity: effect.intensity, focus: effect.focus, fps, ...size });
    const step = cameraStep(filters, size.width, size.height);
    if (!step) {
      uncovered.push(effect.preset);
      continue;
    }
    affine = applyReframe(affine, size.width, size.height, evalFfmpeg(step.z, t), evalFfmpeg(step.fx, t), evalFfmpeg(step.fy, t));
  }
  return { affine, uncovered };
}

/** Caixa do footage no palco em `t` (null fora de palco). Mesma conta de `stageExpressions` do reframe.ts. */
export function stageBoxAt(stages: readonly PlacedStage[], width: number, height: number, t: number): StageBox | null {
  const stage = stages.find((item) => t >= item.start && t < item.end);
  if (!stage) return null;
  const move: FootageTransform = transformAt(stage.plan, t - stage.start, stage.end - stage.start, width, height);
  return { w: evenSize(width, move.scale), h: evenSize(height, move.scale), x: move.x, y: move.y };
}

export interface FootageInput {
  zooms: PlacedZoom[];
  effects: PlacedEffect[];
  stages: PlacedStage[];
  width: number;
  height: number;
  fps: number;
}

export interface FootageFrame {
  /** zoom da EDL + efeitos de câmera: dentro do quadro (o render recorta de volta ao tamanho do quadro) */
  inner: Affine;
  /** palco: o quadro inteiro encolhido para esta caixa; null fora de palco */
  stage: StageBox | null;
  /** efeitos `filter` ativos que o preview não reproduz */
  uncovered: string[];
}

/** O que o render faz com o footage em `t` (segundos do vídeo final), nesta ordem: zoom, efeitos, palco. */
export function footageFrameAt(input: FootageInput, t: number): FootageFrame {
  const { width, height } = input;
  const zoom = zoomAffine(input.zooms, width, height, t);
  const fx = effectAffine(input.effects, { width, height }, input.fps, t);
  const inner = composeAffine(zoom, fx.affine);
  return { inner, stage: stageBoxAt(input.stages, width, height, t), uncovered: fx.uncovered };
}

/** `b` depois de `a` (b ∘ a). */
export function composeAffine(a: Affine, b: Affine): Affine {
  return { sx: b.sx * a.sx, sy: b.sy * a.sy, tx: b.sx * a.tx + b.tx, ty: b.sy * a.ty + b.ty };
}

/** Onde cai um ponto (px do quadro de entrada) depois de todas as etapas: é o que o teste compara com o render. */
export function mapPoint(frame: FootageFrame, width: number, height: number, point: { x: number; y: number }): { x: number; y: number } {
  const inner = { x: frame.inner.sx * point.x + frame.inner.tx, y: frame.inner.sy * point.y + frame.inner.ty };
  if (!frame.stage) return inner;
  // o quadro recortado (W×H) é escalado para w×h e posto em (x,y)
  return { x: frame.stage.x + (inner.x * frame.stage.w) / width, y: frame.stage.y + (inner.y * frame.stage.h) / height };
}
