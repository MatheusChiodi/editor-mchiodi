// Aleatoriedade determinística: o mesmo seed dá o mesmo mundo em todo frame e em toda máquina.

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Valor em [0, 1) fixo para uma célula da grade. */
export function hash3(seed: string, x: number, y: number, z: number): number {
  return mulberry32(hashString(`${seed}:${x}:${y}:${z}`))();
}
