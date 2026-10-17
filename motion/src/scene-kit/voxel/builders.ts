import { hash3 } from './random';
import type { Block } from './types';

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function valueNoise(seed: string, x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const corner = (cx: number, cz: number) => hash3(seed, cx, 0, cz);
  const top = corner(x0, z0) * (1 - tx) + corner(x0 + 1, z0) * tx;
  const bottom = corner(x0, z0 + 1) * (1 - tx) + corner(x0 + 1, z0 + 1) * tx;
  return top * (1 - tz) + bottom * tz;
}

export interface TerrainConfig {
  radius: number;
  seed: string;
  maxHeight: number;
  /** 0 = chão plano, 1 = morro na altura cheia */
  relief: (x: number, z: number) => number;
}

const terrainCache = new Map<string, Block[]>();

/** Morros em volta do palco. Só os morros viram blocos; o nível do chão é o plano de `<Ground />`. */
export function buildTerrain({ radius, seed, maxHeight, relief }: TerrainConfig): Block[] {
  // cada cena remonta ao entrar; o cache evita recalcular milhares de colunas e travar o preview.
  // `relief` é função e não entra na chave: use um seed por relevo.
  const key = `${seed}|${radius}|${maxHeight}`;
  const cached = terrainCache.get(key);
  if (cached) return cached;

  const blocks: Block[] = [];
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      const rim = clamp01((radius - Math.hypot(x, z)) / 6);
      const height = Math.round(valueNoise(seed, x * 0.16, z * 0.16) * maxHeight * relief(x, z) * rim);
      if (height < 1) continue;
      blocks.push({ x, y: height, z, type: 'grass' });
      for (let y = height - 1; y >= Math.max(1, height - 3); y--) {
        blocks.push({ x, y, z, type: 'dirt' });
      }
    }
  }
  terrainCache.set(key, blocks);
  return blocks;
}

/** Relevo plano até `flatRadius` e crescendo depois: deixa o centro do palco livre. */
export function ringRelief(flatRadius: number): (x: number, z: number) => number {
  return (x, z) => clamp01((Math.hypot(x, z) - flatRadius) / 6);
}

/** Ilha flutuante redonda: topo em `top`, terra e pedra afinando para baixo. */
export function buildIsland(cx: number, cz: number, radius: number, top: string): Block[] {
  const layers = [
    { dy: 0, r: radius, type: top },
    { dy: -1, r: radius - 0.7, type: 'dirt' },
    { dy: -2, r: radius - 1.5, type: 'stone' },
    { dy: -3, r: radius - 2.4, type: 'stone' },
  ];
  const blocks: Block[] = [];
  for (const layer of layers) {
    if (layer.r < 0) continue;
    const reach = Math.ceil(layer.r);
    for (let x = -reach; x <= reach; x++) {
      for (let z = -reach; z <= reach; z++) {
        if (Math.hypot(x, z) <= layer.r + 0.3) {
          blocks.push({ x: cx + x, y: layer.dy, z: cz + z, type: layer.type });
        }
      }
    }
  }
  return blocks;
}

/** Caminho 4-conectado entre dois pontos da grade (cada passo anda em x ou em z). */
export function linePath(from: [number, number], to: [number, number]): [number, number][] {
  const path: [number, number][] = [];
  let [x, z] = from;
  const dx = Math.abs(to[0] - x);
  const dz = Math.abs(to[1] - z);
  const sx = to[0] > x ? 1 : -1;
  const sz = to[1] > z ? 1 : -1;
  let walkedX = 0;
  let walkedZ = 0;
  path.push([x, z]);
  while (walkedX < dx || walkedZ < dz) {
    if (walkedZ >= dz || (walkedX < dx && (walkedX + 0.5) * dz < (walkedZ + 0.5) * dx)) {
      x += sx;
      walkedX++;
    } else {
      z += sz;
      walkedZ++;
    }
    path.push([x, z]);
  }
  return path;
}

/** Caixa cheia de blocos (limites inclusivos). `typeOf` devolve null para deixar a célula vazia. */
export function buildBox(
  min: [number, number, number],
  max: [number, number, number],
  typeOf: (x: number, y: number, z: number) => string | null,
): Block[] {
  const blocks: Block[] = [];
  for (let x = min[0]; x <= max[0]; x++) {
    for (let y = min[1]; y <= max[1]; y++) {
      for (let z = min[2]; z <= max[2]; z++) {
        const type = typeOf(x, y, z);
        if (type) blocks.push({ x, y, z, type });
      }
    }
  }
  return blocks;
}

/** Desenho em linhas de texto → parede de blocos coloridos no plano xy, centrada na origem. */
export function bitmapToBlocks(rows: string[], colorOf: (char: string) => string | null, cell: number): Block[] {
  const blocks: Block[] = [];
  const height = rows.length;
  rows.forEach((row, r) => {
    const chars = [...row];
    chars.forEach((char, c) => {
      const color = colorOf(char);
      if (!color) return;
      blocks.push({
        x: (c - (chars.length - 1) / 2) * cell,
        y: (height - 1 - r - (height - 1) / 2) * cell,
        z: 0,
        type: `solid:${color}`,
        scale: cell,
      });
    });
  });
  return blocks;
}
