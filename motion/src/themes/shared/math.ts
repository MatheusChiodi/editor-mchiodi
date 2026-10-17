// Contas puras dos temas (sem React): aleatoriedade determinística, cores e geometria. Testadas em tests/themes.test.ts.

/** Valor em [0, 1) fixo para um par (semente, índice): o mesmo cenário em todo frame e em toda máquina. */
export function rand(seed: number, index: number): number {
  let h = (Math.imul(seed | 0, 374761393) + Math.imul(index | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function channels(color: string): [number, number, number, number] {
  const rgba = /^rgba?\(([^)]+)\)$/.exec(color.trim());
  if (rgba) {
    const parts = rgba[1]!.split(',').map((part) => Number(part.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
  }
  const hex = color.trim().replace('#', '');
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex;
  const value = Number.parseInt(full.slice(0, 6), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
}

/** Cor (hex ou rgba) com a opacidade trocada. */
export function fade(color: string, opacity: number): string {
  const [r, g, b] = channels(color);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(clamp01(opacity) * 1000) / 1000})`;
}

/** Mistura linear de duas cores (0 = a, 1 = b); a opacidade também mistura. */
export function mixColor(a: string, b: string, t: number): string {
  const x = channels(a);
  const y = channels(b);
  const k = clamp01(t);
  const alpha = Math.round(lerp(x[3], y[3], k) * 1000) / 1000;
  return `rgba(${Math.round(lerp(x[0], y[0], k))}, ${Math.round(lerp(x[1], y[1], k))}, ${Math.round(lerp(x[2], y[2], k))}, ${alpha})`;
}

export interface Building {
  x: number;
  w: number;
  h: number;
  /** remate do topo: reto, agulha, degraus, empena, torre com pináculos */
  top: 'flat' | 'spire' | 'steps' | 'gable' | 'twin';
  /** janelas acesas: coluna, linha */
  lit: [number, number][];
  cols: number;
  rows: number;
}

export interface SkylineOptions {
  from?: number;
  to?: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  /** fração de janelas acesas */
  lit?: number;
  /** fração de prédios com remate gótico (agulha, empena, pináculos); 0 = cidade de topo reto */
  gothic?: number;
}

/** Fileira de prédios que cobre [from, to] sem buraco. Determinística pela semente. */
export function skyline(seed: number, { from = -400, to = 2320, minW = 70, maxW = 160, minH = 120, maxH = 420, lit = 0.1, gothic = 0.6 }: SkylineOptions = {}): Building[] {
  const buildings: Building[] = [];
  let x = from;
  for (let index = 0; x < to; index += 1) {
    const w = Math.round(lerp(minW, maxW, rand(seed, index * 7 + 1)));
    // dois sorteios multiplicados: muitos prédios médios, poucos arranha-céus
    const h = Math.round(lerp(minH, maxH, rand(seed, index * 7 + 2) * (0.55 + 0.45 * rand(seed, index * 7 + 3))));
    const roll = rand(seed, index * 7 + 4);
    const style = rand(seed, index * 7 + 5);
    const top: Building['top'] = roll >= gothic ? (style < 0.5 ? 'flat' : 'steps') : style < 0.34 ? 'spire' : style < 0.67 ? 'gable' : 'twin';
    const cols = Math.max(1, Math.floor((w - 16) / 22));
    const rows = Math.max(1, Math.floor((h - 24) / 30));
    const windows: [number, number][] = [];
    for (let col = 0; col < cols; col += 1) {
      for (let row = 0; row < rows; row += 1) if (rand(seed + 97, index * 131 + col * 17 + row) < lit) windows.push([col, row]);
    }
    buildings.push({ x, w, h, top, lit: windows, cols, rows });
    x += w - 2;
  }
  return buildings;
}

/** Contorno de um prédio (path SVG) com a base em `baseY`. */
export function buildingPath(building: Building, baseY: number): string {
  const { x, w, h, top } = building;
  const y = baseY - h;
  const right = x + w;
  const mid = x + w / 2;
  switch (top) {
    case 'spire':
      return `M${x} ${baseY}V${y}H${mid - w * 0.16}L${mid - 3} ${y - h * 0.34}V${y - h * 0.5}H${mid + 3}V${y - h * 0.34}L${mid + w * 0.16} ${y}H${right}V${baseY}Z`;
    case 'gable':
      return `M${x} ${baseY}V${y}L${mid} ${y - w * 0.62}L${right} ${y}V${baseY}Z`;
    case 'twin':
      return `M${x} ${baseY}V${y - 26}L${x + w * 0.14} ${y - 70}L${x + w * 0.28} ${y - 26}V${y}H${right - w * 0.28}V${y - 26}L${right - w * 0.14} ${y - 70}L${right} ${y - 26}V${baseY}Z`;
    case 'steps':
      return `M${x} ${baseY}V${y + 34}H${x + w * 0.2}V${y}H${right - w * 0.2}V${y + 34}H${right}V${baseY}Z`;
    default:
      return `M${x} ${baseY}V${y}H${right}V${baseY}Z`;
  }
}

/** Texto cabe em `maxWidth`? Devolve o corpo (px) reduzido até `min`, estimando a largura por caractere. */
export function fitFont(text: string, maxWidth: number, base: number, min = 30, charRatio = 0.56): number {
  const longest = Math.max(1, ...text.split(/\s+/).map((word) => word.length));
  const lineWidth = Math.max(longest, Math.min(text.length, Math.ceil(text.length / 2))) * charRatio;
  const fit = Math.floor(maxWidth / lineWidth);
  return Math.max(min, Math.min(base, fit));
}

/** Tempos de entrada por índice: o que veio em `revealAt`, e os que faltam em sequência depois do último. */
export function revealTimes(count: number, revealAt: readonly number[] = [], firstSec = 1.2, stepSec = 0.6): number[] {
  const times: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const given = revealAt[index];
    times.push(typeof given === 'number' && Number.isFinite(given) && given >= 0 ? given : index === 0 ? firstSec : times[index - 1]! + stepSec);
  }
  return times;
}
