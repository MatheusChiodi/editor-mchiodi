// Lógica pura do modelo LargoVersusFundo (kit voxel): um paredão em corte, cavado de dois jeitos com o MESMO
// número de blocos. À esquerda, uma vala larga e rasa; à direita, um poço estreito que chega na gema.
// Nome em minúsculas: o `scenes sync` só registra arquivos PascalCase.
import type { Block, Vec3 } from '../../scene-kit/voxel/types';
import { clampCount, estimateWidth, pickSec } from './fit-b';

export const WALL = { minX: -10, maxX: 10, rows: 7, layers: 5 } as const;
/** Blocos cavados de cada lado: com menos de 3 a diferença não lê; com mais de 6 o poço passa do paredão. */
export const DIG_RANGE = { min: 3, max: 6, default: 6 } as const;
export const WIDE_FROM_X = -9;
export const DEEP_X = 5;

/** frames que um bloco leva encolhendo antes de sumir */
export const BREAK_FRAMES = 4;
/** segundos entre um bloco e o seguinte */
export const DIG_STEP_SEC = 0.16;

export function digCount(count: number | undefined): number {
  return typeof count === 'number' && Number.isFinite(count) ? clampCount(count, DIG_RANGE.min, DIG_RANGE.max) : DIG_RANGE.default;
}

/** Onde fica a recompensa: logo abaixo do último bloco do poço. */
export function orePosition(count: number): { x: number; y: number } {
  return { x: DEEP_X, y: -digCount(count) };
}

/** Pontos do mundo onde os dois rótulos ficam presos: acima do meio da vala e acima da boca do poço. */
export function labelAnchors(count: number): { wide: Vec3; deep: Vec3 } {
  return { wide: [WIDE_FROM_X + (digCount(count) - 1) / 2, 1.1, 0], deep: [DEEP_X, 1.1, 0] };
}

export interface DigStep {
  x: number;
  y: number;
  /** frame em que o bloco começa a quebrar */
  frame: number;
  kind: 'wide' | 'deep';
}

export interface DigReveal {
  /** a vala larga e rasa começa a ser cavada */
  wide?: number;
  /** o poço fundo começa a ser cavado */
  deep?: number;
  /** rótulo do lado fundo (quando a palavra é dita) */
  deepLabel?: number;
  /** rótulo do lado largo */
  wideLabel?: number;
}

/** Tempos da cena: o que faltar segue a escavação (o rótulo do fundo entra quando o poço chega na gema). */
export function digTimes(count: number, revealAt: DigReveal = {}): Required<DigReveal> {
  const pick = pickSec;
  const blocks = digCount(count);
  const wide = pick(revealAt.wide, 1.3);
  const deep = pick(revealAt.deep, wide + 2);
  const deepLabel = pick(revealAt.deepLabel, deep + blocks * DIG_STEP_SEC + 0.14);
  const wideLabel = pick(revealAt.wideLabel, deepLabel + 1.1);
  return { wide, deep, deepLabel, wideLabel };
}

/** Ordem e instante de cada bloco cavado: a vala anda para a direita, o poço desce. */
export function digPlan(count: number, times: { wide: number; deep: number }, fps: number, stepSec = DIG_STEP_SEC): DigStep[] {
  const blocks = digCount(count);
  const step = (startSec: number, index: number) => Math.round((startSec + index * stepSec) * fps);
  const wide: DigStep[] = Array.from({ length: blocks }, (_, i) => ({ x: WIDE_FROM_X + i, y: 0, frame: step(times.wide, i), kind: 'wide' }));
  const deep: DigStep[] = Array.from({ length: blocks }, (_, i) => ({ x: DEEP_X, y: 0 - i, frame: step(times.deep, i), kind: 'deep' }));
  return [...wide, ...deep];
}

/** Frame em que o poço encosta na gema (o último bloco do poço termina de quebrar). */
export function oreFrame(plan: DigStep[]): number {
  const last = Math.max(...plan.filter((step) => step.kind === 'deep').map((step) => step.frame));
  return last + BREAK_FRAMES;
}

/** Camadas do solo, de cima para baixo. */
export function layerType(y: number): string {
  if (y >= 0) return 'grass';
  if (y >= -2) return 'dirt';
  if (y >= -4) return 'stone';
  return 'deepstone';
}

/** Quantos blocos de cada escavação já sumiram no frame. */
export function dugCount(frame: number, plan: DigStep[], kind: DigStep['kind']): number {
  return plan.filter((step) => step.kind === kind && frame >= step.frame + BREAK_FRAMES).length;
}

/** O paredão inteiro no frame: face da frente (com os buracos), miolo escuro atrás dos buracos e base afinando. */
export function worldBlocks(frame: number, plan: DigStep[], oreColor: string): Block[] {
  const steps = new Map(plan.map((step) => [`${step.x}:${step.y}`, step]));
  const ore = orePosition(plan.filter((step) => step.kind === 'deep').length);
  const lit = frame >= oreFrame(plan);
  const blocks: Block[] = [];

  for (let x: number = WALL.minX; x <= WALL.maxX; x++) {
    for (let row = 0; row < WALL.rows; row++) {
      const y = 0 - row;
      const step = steps.get(`${x}:${y}`);
      const age = step ? frame - step.frame : -1;
      const isOre = x === ore.x && y === ore.y;
      const type = isOre ? `${lit ? 'ore-lit' : 'ore'}:${oreColor}` : layerType(y);

      if (!step || age < 0) {
        blocks.push({ x, y, z: 0, type });
      } else if (age < BREAK_FRAMES) {
        blocks.push({ x, y, z: 0, type, scale: 1 - age / BREAK_FRAMES });
      }
      // atrás de um buraco fica o miolo escuro: é ele que faz o buraco ler como buraco
      blocks.push({ x, y, z: -1, type: step && age >= 0 ? 'cavity' : layerType(y) });
      for (let layer = 2; layer < WALL.layers; layer++) {
        blocks.push({ x, y, z: -layer, type: layerType(y) });
      }
    }
  }

  // base afinando: o paredão vira uma ilha flutuante em vez de um muro cortado reto
  const taper = [
    { y: -WALL.rows, inset: 3 },
    { y: -WALL.rows - 1, inset: 7 },
  ];
  for (const { y, inset } of taper) {
    for (let x: number = WALL.minX + inset; x <= WALL.maxX - inset; x++) {
      for (let layer = 0; layer < WALL.layers; layer++) {
        blocks.push({ x, y, z: -layer, type: 'deepstone' });
      }
    }
  }
  return blocks;
}

/** Largura estimada (px) do tooltip de pixel do kit voxel, para conferir que os dois rótulos não se encostam. */
export function tooltipWidth(name: string, hint: string | undefined, unit = 1.15): number {
  const title = estimateWidth(name, 30 * unit, 'pixelTitle');
  const description = hint ? estimateWidth(hint, 50 * unit, 'pixelMono') : 0;
  return Math.ceil(Math.max(title, description) + 30 * unit * 2 + 10);
}
