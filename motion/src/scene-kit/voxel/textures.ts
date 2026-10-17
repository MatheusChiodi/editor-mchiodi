import * as THREE from 'three';

import { hashString, mulberry32 } from './random';
import { voxelPalette } from './theme';

const SIZE = 16;
const { accent, ok } = voxelPalette;
// Terreno em musgo azulado sobre ardósia, para o mundo ter cara própria.
const MOSS = '#4FA69B';
const SOIL = '#4B4770';
const FALLBACK = '#7C7F8E';

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;
type Painter = (ctx: Ctx, rand: Rand) => void;

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amount)));
  return `rgb(${channel((n >> 16) & 255)}, ${channel((n >> 8) & 255)}, ${channel(n & 255)})`;
}

function px(ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function noiseFill(ctx: Ctx, rand: Rand, base: string, variance: number): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      px(ctx, x, y, shade(base, (rand() - 0.5) * variance));
    }
  }
}

function frame(ctx: Ctx, color: string): void {
  px(ctx, 0, 0, color, SIZE, 1);
  px(ctx, 0, SIZE - 1, color, SIZE, 1);
  px(ctx, 0, 0, color, 1, SIZE);
  px(ctx, SIZE - 1, 0, color, 1, SIZE);
}

function cracks(ctx: Ctx, rand: Rand, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * 11);
    const y = 1 + Math.floor(rand() * 14);
    px(ctx, x, y, color, 2 + Math.floor(rand() * 4), 1);
  }
}

const GEM_SPOTS: [number, number][] = [
  [1, 1],
  [9, 2],
  [5, 6],
  [11, 8],
  [1, 10],
  [7, 12],
];

function gems(ctx: Ctx, rand: Rand, color: string): void {
  for (const [sx, sy] of GEM_SPOTS) {
    const x = sx + Math.floor(rand() * 2);
    const y = sy + Math.floor(rand() * 2);
    px(ctx, x, y, color, 3, 3);
    px(ctx, x + 3, y + 1, shade(color, -0.14), 1, 2);
    px(ctx, x, y, shade(color, 0.28), 2, 1);
  }
}

const serverPanel =
  (led: string, band: string | null): Painter =>
  (ctx, rand) => {
    noiseFill(ctx, rand, '#2E3156', 0.04);
    frame(ctx, '#474B7E');
    px(ctx, 2, 3, '#1A1B36', 8, 1);
    px(ctx, 2, 5, '#1A1B36', 8, 1);
    px(ctx, 12, 3, led, 2, 1);
    px(ctx, 12, 5, led, 2, 1);
    px(ctx, 2, 8, band ?? '#1A1B36', 12, 5);
    if (band) px(ctx, 2, 8, shade(band, 0.16), 12, 1);
  };

const CHECK: [number, number][] = [
  [3, 8],
  [4, 9],
  [5, 10],
  [6, 11],
  [7, 10],
  [8, 9],
  [9, 8],
  [10, 7],
  [11, 6],
  [12, 5],
];

const painters: Record<string, Painter> = {
  grassTop: (ctx, rand) => {
    noiseFill(ctx, rand, MOSS, 0.1);
    for (let i = 0; i < 9; i++) {
      px(ctx, Math.floor(rand() * 16), Math.floor(rand() * 16), '#7FD6C4');
    }
  },
  dirt: (ctx, rand) => {
    noiseFill(ctx, rand, SOIL, 0.08);
    cracks(ctx, rand, '#39365A', 4);
  },
  grassSide: (ctx, rand) => {
    noiseFill(ctx, rand, SOIL, 0.08);
    cracks(ctx, rand, '#39365A', 3);
    px(ctx, 0, 0, MOSS, SIZE, 2);
    px(ctx, 0, 2, shade(MOSS, -0.14), SIZE, 1);
  },
  stone: (ctx, rand) => {
    noiseFill(ctx, rand, '#7C7F8E', 0.1);
    cracks(ctx, rand, '#62657A', 5);
  },
  deepstone: (ctx, rand) => {
    noiseFill(ctx, rand, '#3F4159', 0.1);
    cracks(ctx, rand, '#2C2D42', 6);
  },
  cavity: (ctx, rand) => noiseFill(ctx, rand, '#181828', 0.06),
  planks: (ctx, rand) => {
    noiseFill(ctx, rand, '#A9774A', 0.08);
    for (const y of [3, 7, 11, 15]) {
      px(ctx, 0, y, '#7C5433', SIZE, 1);
    }
    px(ctx, 5, 0, '#7C5433', 1, 3);
    px(ctx, 11, 4, '#7C5433', 1, 3);
    px(ctx, 3, 8, '#7C5433', 1, 3);
    px(ctx, 9, 12, '#7C5433', 1, 3);
  },
  server: serverPanel('#5C6B9C', null),
  serverAlertOff: serverPanel('#7A2A34', '#6A2630'),
  serverAlertOn: serverPanel(accent, accent),
  serverGreen: serverPanel(ok, null),
  serverOk: serverPanel(ok, ok),
  alert: (ctx, rand) => {
    noiseFill(ctx, rand, accent, 0.08);
    frame(ctx, shade(accent, -0.25));
    px(ctx, 7, 3, '#FFFFFF', 2, 6);
    px(ctx, 7, 11, '#FFFFFF', 2, 2);
  },
  ok: (ctx, rand) => {
    noiseFill(ctx, rand, '#34B862', 0.08);
    frame(ctx, shade('#34B862', -0.2));
    for (const [x, y] of CHECK) {
      px(ctx, x, y, '#FFFFFF', 1, 2);
    }
  },
};

/** Tipos fixos de bloco. Além deles valem os dinâmicos `solid:#hex`, `ore:#hex`, `glow:#hex` e `face:#hex`. */
export const BLOCK_TYPES = ['grass', ...Object.keys(painters).filter((key) => !key.startsWith('grass'))];

function dynamicPainter(key: string): Painter {
  const [kind, color = FALLBACK] = key.split(':');
  if (kind === 'ore') {
    return (ctx, rand) => {
      noiseFill(ctx, rand, '#3F4159', 0.1);
      gems(ctx, rand, color);
    };
  }
  return (ctx, rand) => {
    noiseFill(ctx, rand, color, 0.07);
    frame(ctx, shade(color, -0.12));
  };
}

const textureCache = new Map<string, THREE.CanvasTexture>();

export function getTexture(key: string): THREE.CanvasTexture {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponível para gerar a textura do bloco');
  (painters[key] ?? dynamicPainter(key))(ctx, mulberry32(hashString(key)));
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  // mipmap trilinear + anisotropia: sem isso a textura "formiga" quando a câmera anda.
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

const materialCache = new Map<string, THREE.Material>();

export function getMaterial(textureKey: string, unlit = false): THREE.Material {
  const id = `${textureKey}|${unlit}`;
  const cached = materialCache.get(id);
  if (cached) return cached;

  const map = getTexture(textureKey);
  const material = unlit ? new THREE.MeshBasicMaterial({ map }) : new THREE.MeshLambertMaterial({ map });
  materialCache.set(id, material);
  return material;
}

const UNLIT = new Set(['serverAlertOn', 'serverOk', 'alert', 'ok']);

/** Ordem das faces do BoxGeometry: +x, -x, +y, -y, +z, -z. */
export function getBlockMaterial(type: string): THREE.Material | THREE.Material[] {
  if (type === 'grass') {
    const side = getMaterial('grassSide');
    return [side, side, getMaterial('grassTop'), getMaterial('dirt'), side, side];
  }
  if (type.startsWith('face:')) {
    const front = getMaterial(`solid:${type.slice(5)}`, true);
    const side = getMaterial(`solid:${voxelPalette.nightBottom}`);
    return [side, side, side, side, front, front];
  }
  // `glow:` e minério aceso ignoram a luz da cena: parecem emitir
  if (type.startsWith('glow:') || type.startsWith('ore-lit:')) {
    return getMaterial(type.replace('ore-lit:', 'ore:'), true);
  }
  return getMaterial(type, UNLIT.has(type));
}
