import type { Block } from '../../scene-kit/voxel/types';

// Lógica pura da cena ProfundidadeVsLargura: um paredão em corte, cavado de dois jeitos com o MESMO
// número de blocos. À esquerda, uma vala larga e rasa; à direita, um poço estreito que chega no minério.

export const WALL = { minX: -10, maxX: 10, rows: 7, layers: 5 } as const;
export const WIDE = { fromX: -9, count: 6 } as const;
export const DEEP = { x: 5, count: 6 } as const;
export const ORE = { x: DEEP.x, y: -DEEP.count } as const;

/** frames que um bloco leva encolhendo antes de sumir */
export const BREAK_FRAMES = 4;

export interface DigStep {
  x: number;
  y: number;
  /** frame em que o bloco começa a quebrar */
  frame: number;
  kind: 'wide' | 'deep';
}

export interface DigTimes {
  /** segundo em que a vala larga começa a ser cavada */
  wide: number;
  /** segundo em que o poço fundo começa a ser cavado */
  deep: number;
}

/** Ordem e instante de cada bloco cavado: a vala anda para a direita, o poço desce. */
export function digPlan(times: DigTimes, fps: number, stepSec = 0.16): DigStep[] {
  const step = (startSec: number, index: number) => Math.round((startSec + index * stepSec) * fps);
  const wide: DigStep[] = Array.from({ length: WIDE.count }, (_, i) => ({ x: WIDE.fromX + i, y: 0, frame: step(times.wide, i), kind: 'wide' }));
  const deep: DigStep[] = Array.from({ length: DEEP.count }, (_, i) => ({ x: DEEP.x, y: 0 - i, frame: step(times.deep, i), kind: 'deep' }));
  return [...wide, ...deep];
}

/** Frame em que o poço encosta no minério (o último bloco do poço termina de quebrar). */
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
  const lit = frame >= oreFrame(plan);
  const blocks: Block[] = [];

  for (let x: number = WALL.minX; x <= WALL.maxX; x++) {
    for (let row = 0; row < WALL.rows; row++) {
      const y = 0 - row;
      const step = steps.get(`${x}:${y}`);
      const age = step ? frame - step.frame : -1;
      const isOre = x === ORE.x && y === ORE.y;
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
