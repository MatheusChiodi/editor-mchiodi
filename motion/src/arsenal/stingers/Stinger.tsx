import { AbsoluteFill, useCurrentFrame } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { motion, theme } from '../../theme';

export interface StingerProps {
  variant: string;
  /** troca a cor principal da variante; só cores do tema */
  color?: string;
}

/** Espaço em que a geometria é descrita; o SVG escala para o tamanho real da composição. */
export const STAGE = { width: 1920, height: 1080 } as const;
const W = STAGE.width;
const H = STAGE.height;

/**
 * A tela fica 100% coberta entre 40% e 60% da duração: o corte seco acontece no meio e,
 * com poucos frames, os dois vizinhos do corte ainda caem dentro dessa janela.
 */
export const COVER_END = 0.4;
export const REVEAL_START = 0.6;

// peças vizinhas se sobrepõem um pouco: sem isso o anti-aliasing deixa fios do footage aparecendo
const BLEED = 2;
const SKEW = 420;
const CHEVRON_DEPTH = 260;
const RADIUS = Math.hypot(W / 2, H / 2) + BLEED;

export const STINGER_COLORS = ['paper', 'ink', 'slate900', 'coral', 'night'] as const;
export type StingerColor = (typeof STINGER_COLORS)[number];
type Fill = StingerColor | 'main';
type Point = readonly [number, number];

export type StingerShape =
  | { kind: 'poly'; points: Point[]; fill: Fill }
  | { kind: 'ring'; cx: number; cy: number; inner: number; outer: number; fill: Fill };

interface Phase {
  /** 0→1 enquanto cobre, desacelerando; `delay` e `span` são frações da fase de entrada */
  cover: (delay?: number, span?: number) => number;
  /** 0→1 enquanto descobre, acelerando */
  reveal: (delay?: number, span?: number) => number;
}

function eased(curve: (t: number) => number, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return curve(t);
}

function phaseAt(progress: number): Phase {
  const coverT = progress / COVER_END;
  const revealT = (progress - REVEAL_START) / (1 - REVEAL_START);
  return {
    cover: (delay = 0, span = 1) => eased(motion.enter, (coverT - delay) / span),
    reveal: (delay = 0, span = 1) => eased(motion.exit, (revealT - delay) / span),
  };
}

function rect(x0: number, y0: number, x1: number, y1: number, fill: Fill): StingerShape[] {
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return [];
  // fora do palco não desenha: a sobreposição faria uma peça "vazia" vazar 2 px para dentro
  if (x1 <= 0 || x0 >= W || y1 <= 0 || y0 >= H) return [];
  return [
    {
      kind: 'poly',
      fill,
      points: [
        [x0 - BLEED, y0 - BLEED],
        [x1 + BLEED, y0 - BLEED],
        [x1 + BLEED, y1 + BLEED],
        [x0 - BLEED, y1 + BLEED],
      ],
    },
  ];
}

type Direction = 'right' | 'left' | 'down' | 'up';

/** Faixa de `from` a `to` (frações da tela) medida a partir do lado de onde o movimento vem. */
function band(direction: Direction, from: number, to: number, fill: Fill): StingerShape[] {
  switch (direction) {
    case 'right':
      return rect(from * W, 0, to * W, H, fill);
    case 'left':
      return rect((1 - to) * W, 0, (1 - from) * W, H, fill);
    case 'down':
      return rect(0, from * H, W, to * H, fill);
    case 'up':
      return rect(0, (1 - to) * H, W, (1 - from) * H, fill);
  }
}

/** Paralelogramo inclinado: `from`/`to` são a posição na base; o topo fica `SKEW` px à direita. */
function slant(from: number, to: number, fill: Fill): StingerShape[] {
  if (to - from <= 0 || to + SKEW <= 0 || from >= W) return [];
  const a = from - BLEED;
  const b = to + BLEED;
  return [
    {
      kind: 'poly',
      fill,
      points: [
        [a + SKEW, -BLEED],
        [b + SKEW, -BLEED],
        [b, H + BLEED],
        [a, H + BLEED],
      ],
    },
  ];
}

/** Faixa em forma de seta apontando para a direita; a ponta fica `CHEVRON_DEPTH` px à frente. */
function chevron(from: number, to: number, fill: Fill): StingerShape[] {
  if (to - from <= 0 || to + CHEVRON_DEPTH <= 0 || from >= W) return [];
  const a = from - BLEED;
  const b = to + BLEED;
  return [
    {
      kind: 'poly',
      fill,
      points: [
        [a, -BLEED],
        [b, -BLEED],
        [b + CHEVRON_DEPTH, H / 2],
        [b, H + BLEED],
        [a, H + BLEED],
        [a + CHEVRON_DEPTH, H / 2],
      ],
    },
  ];
}

function ring(inner: number, outer: number, fill: Fill): StingerShape[] {
  const hole = Math.max(0, inner);
  if (outer - hole <= 0 || hole >= RADIUS) return [];
  return [{ kind: 'ring', cx: W / 2, cy: H / 2, inner: hole, outer, fill }];
}

/** Persiana: `count` lâminas que crescem a partir da própria borda, uma depois da outra. */
function slats(phase: Phase, count: number, direction: Direction, step: number, fill: Fill): StingerShape[] {
  const span = 1 - (count - 1) * step;
  return Array.from({ length: count }, (_, index) =>
    band(direction, (index + phase.reveal(index * step, span)) / count, (index + phase.cover(index * step, span)) / count, fill),
  ).flat();
}

interface Variant {
  main: StingerColor;
  build: (phase: Phase) => StingerShape[];
}

const sweep = (direction: Direction, main: StingerColor): Variant => ({
  main,
  build: (phase) => band(direction, phase.reveal(), phase.cover(), 'main'),
});

const BAR = 0.1;
const DIAGONAL_BAND = 150;
const CHEVRON_STRIPE = 60;
const IRIS_RIM = 40;
const SEAM = 10;

const VARIANTS: Record<string, Variant> = {
  'paper-curtain': sweep('right', 'paper'),
  'ink-curtain': sweep('left', 'ink'),
  'paper-rise': sweep('up', 'paper'),
  'ink-drop': sweep('down', 'slate900'),
  'double-bar': {
    main: 'ink',
    build: (phase) => {
      const front = phase.cover() * (1 + BAR);
      const tail = phase.reveal() * (1 + BAR);
      return [
        ...band('right', tail, front - BAR, 'main'),
        ...band('right', front - BAR, front, 'coral'),
        ...band('right', tail - BAR, tail, 'coral'),
      ];
    },
  },
  'layered-sweep': {
    main: 'paper',
    // na entrada o coral puxa a fila; na saída o paper sai primeiro e o coral fecha
    build: (phase) => [
      ...band('right', phase.reveal(0.3, 0.7), phase.cover(0, 0.7), 'coral'),
      ...band('right', phase.reveal(0.15, 0.7), phase.cover(0.15, 0.7), 'ink'),
      ...band('right', phase.reveal(0, 0.7), phase.cover(0.3, 0.7), 'main'),
    ],
  },
  'diagonal-coral': {
    main: 'paper',
    build: (phase) => {
      const front = -SKEW + phase.cover() * (W + SKEW + DIAGONAL_BAND);
      const tail = -SKEW + phase.reveal() * (W + SKEW);
      return [...slant(tail, front - DIAGONAL_BAND, 'main'), ...slant(Math.max(tail, front - DIAGONAL_BAND), front, 'coral')];
    },
  },
  chevron: {
    main: 'slate900',
    build: (phase) => {
      const front = -CHEVRON_DEPTH + phase.cover() * (W + CHEVRON_DEPTH + CHEVRON_STRIPE);
      const tail = -CHEVRON_DEPTH + phase.reveal() * (W + CHEVRON_DEPTH);
      return [...chevron(tail, front - CHEVRON_STRIPE, 'main'), ...chevron(Math.max(tail, front - CHEVRON_STRIPE), front, 'coral')];
    },
  },
  'iris-coral': {
    main: 'coral',
    build: (phase) => ring(phase.reveal() * RADIUS, phase.cover() * RADIUS, 'main'),
  },
  'iris-paper': {
    main: 'paper',
    build: (phase) => {
      const outer = phase.cover() * (RADIUS + IRIS_RIM);
      const hole = phase.reveal() * (RADIUS + IRIS_RIM);
      return [
        ...ring(hole, outer - IRIS_RIM, 'main'),
        ...ring(Math.max(hole, outer - IRIS_RIM), outer, 'coral'),
        ...ring(hole - IRIS_RIM, hole, 'coral'),
      ];
    },
  },
  'iris-ink': {
    main: 'ink',
    // fecha de fora para dentro e abre do centro para fora
    build: (phase) => ring((1 - phase.cover() + phase.reveal()) * RADIUS, RADIUS + BLEED, 'main'),
  },
  'blinds-horizontal': { main: 'paper', build: (phase) => slats(phase, 8, 'down', 0.05, 'main') },
  'blinds-vertical': { main: 'ink', build: (phase) => slats(phase, 12, 'right', 0.035, 'main') },
  'blinds-diagonal': {
    main: 'slate900',
    build: (phase) => {
      const count = 9;
      const step = 0.05;
      const span = 1 - (count - 1) * step;
      const width = (W + SKEW) / count;
      return Array.from({ length: count }, (_, index) => {
        const base = -SKEW + index * width;
        return slant(base + phase.reveal(index * step, span) * width, base + phase.cover(index * step, span) * width, 'main');
      }).flat();
    },
  },
  'stagger-rows': {
    main: 'paper',
    build: (phase) => {
      const count = 6;
      return Array.from({ length: count }, (_, index) =>
        rect(
          phase.reveal(index * 0.08, 0.6) * W,
          (index * H) / count,
          phase.cover(index * 0.08, 0.6) * W,
          ((index + 1) * H) / count,
          'main',
        ),
      ).flat();
    },
  },
  'stagger-columns': {
    main: 'ink',
    build: (phase) => {
      const count = 8;
      return Array.from({ length: count }, (_, index) =>
        rect(
          (index * W) / count,
          (1 - phase.cover(index * 0.055, 0.6)) * H,
          ((index + 1) * W) / count,
          (1 - phase.reveal(index * 0.055, 0.6)) * H,
          'main',
        ),
      ).flat();
    },
  },
  'grid-blocks': {
    main: 'paper',
    build: (phase) => {
      const cols = 8;
      const rows = 5;
      const halfW = W / cols / 2;
      const halfH = H / rows / 2;
      const shapes: StingerShape[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // a onda corre na diagonal, do canto de cima à esquerda para o de baixo à direita
          const delay = ((col + row) / (cols + rows - 2)) * 0.45;
          const scale = phase.cover(delay, 0.55) * (1 - phase.reveal(delay, 0.55));
          const cx = (col * 2 + 1) * halfW;
          const cy = (row * 2 + 1) * halfH;
          shapes.push(...rect(cx - halfW * scale, cy - halfH * scale, cx + halfW * scale, cy + halfH * scale, 'main'));
        }
      }
      return shapes;
    },
  },
  'doors-horizontal': {
    main: 'paper',
    build: (phase) => {
      const edge = phase.cover() * (1 - phase.reveal()) * (W / 2);
      return [
        ...rect(0, 0, edge, H, 'main'),
        ...rect(W - edge, 0, W, H, 'main'),
        ...rect(edge - SEAM, 0, edge, H, 'coral'),
        ...rect(W - edge, 0, W - edge + SEAM, H, 'coral'),
      ];
    },
  },
  'doors-vertical': {
    main: 'night',
    build: (phase) => {
      const edge = phase.cover() * (1 - phase.reveal()) * (H / 2);
      return [...rect(0, 0, W, edge, 'main'), ...rect(0, H - edge, W, H, 'main')];
    },
  },
  'split-diagonal': {
    main: 'ink',
    build: (phase) => {
      const k = phase.cover() * (1 - phase.reveal());
      if (k <= 0) return [];
      return [
        { kind: 'poly', fill: 'main', points: [[-BLEED, -BLEED], [k * W + BLEED, -BLEED], [-BLEED, k * H + BLEED]] },
        { kind: 'poly', fill: 'main', points: [[W + BLEED, H + BLEED], [W - k * W - BLEED, H + BLEED], [W + BLEED, H - k * H - BLEED]] },
      ];
    },
  },
};

export const stingerVariants: string[] = Object.keys(VARIANTS);

function variantOf(name: string): Variant {
  const variant = VARIANTS[name];
  if (!variant) throw new Error(`Stinger: variante "${name}" não existe (${stingerVariants.join(', ')})`);
  return variant;
}

/** Progresso 0–1 do frame; amostrado no meio do frame para a animação ficar simétrica em torno do corte. */
export function stingerProgress(frame: number, durationInFrames: number): number {
  if (durationInFrames <= 0) return 0.5;
  return Math.min(1, Math.max(0, (frame + 0.5) / durationInFrames));
}

/** Formas (em ordem de pintura) que a variante desenha em `progress`. */
export function stingerShapes(variant: string, progress: number): StingerShape[] {
  return variantOf(variant).build(phaseAt(Math.min(1, Math.max(0, progress))));
}

function contains(shape: StingerShape, x: number, y: number): boolean {
  if (shape.kind === 'ring') {
    const distance = Math.hypot(x - shape.cx, y - shape.cy);
    return distance >= shape.inner && distance <= shape.outer;
  }
  let inside = false;
  const { points } = shape;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!;
    const [xj, yj] = points[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const SAMPLES = { cols: 64, rows: 36 } as const;

/** Fração 0–1 da tela coberta pela variante em `progress`, amostrada numa grade sobre a mesma geometria do render. */
export function coverage(variant: string, progress: number): number {
  const shapes = stingerShapes(variant, progress);
  if (shapes.length === 0) return 0;
  let covered = 0;
  for (let row = 0; row < SAMPLES.rows; row++) {
    for (let col = 0; col < SAMPLES.cols; col++) {
      const x = ((col + 0.5) * W) / SAMPLES.cols;
      const y = ((row + 0.5) * H) / SAMPLES.rows;
      if (shapes.some((shape) => contains(shape, x, y))) covered++;
    }
  }
  return covered / (SAMPLES.cols * SAMPLES.rows);
}

/** Cor principal efetiva: a da variante, ou a pedida em `color` se for uma cor do tema liberada para stinger. */
export function stingerColor(variant: string, color?: string): StingerColor {
  if (color === undefined) return variantOf(variant).main;
  if (!(STINGER_COLORS as readonly string[]).includes(color)) {
    throw new Error(`Stinger: cor "${color}" não é do tema (${STINGER_COLORS.join(', ')})`);
  }
  return color as StingerColor;
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

export function shapePath(shape: StingerShape): string {
  if (shape.kind === 'poly') return `M${shape.points.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
  const outer = circlePath(shape.cx, shape.cy, shape.outer);
  return shape.inner > 0 ? `${outer}${circlePath(shape.cx, shape.cy, shape.inner)}` : outer;
}

export const Stinger: React.FC<StingerProps & BaseProps> = ({ variant, durationInFrames, color }) => {
  const frame = useCurrentFrame();
  const main = stingerColor(variant, color);
  const shapes = stingerShapes(variant, stingerProgress(frame, durationInFrames));

  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
        {shapes.map((shape, index) => (
          <path
            key={index}
            d={shapePath(shape)}
            fillRule="evenodd"
            fill={theme.color[shape.fill === 'main' ? main : shape.fill]}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Stinger,
  sample: { variant: 'diagonal-coral' },
  defaultDuration: 0.5,
  description:
    'Transição de tela cheia nas cores da marca: cobre o quadro no meio da duração para esconder um corte seco; centralizar no corte.',
};
