import { theme } from '../theme';

export type Point = readonly [number, number];

export interface ArrowGeometry {
  /** path SVG (curva quadrática; reta quando `bend` é 0) */
  d: string;
  length: number;
  /** os três pontos da ponta, em volta de `to` */
  head: [Point, Point, Point];
}

const SAMPLES = 24;

/**
 * Geometria de uma seta de `from` a `to`. `bend` desloca o meio da curva perpendicularmente
 * (px; positivo curva para a direita de quem vai de `from` a `to`).
 */
export function arrowGeometry(from: Point, to: Point, bend = 0, headSize = 18): ArrowGeometry {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const span = Math.hypot(dx, dy) || 1;
  // o ponto de controle fica a 2x o desvio para o meio da curva passar exatamente em `bend`
  const control: Point = [from[0] + dx / 2 + (-dy / span) * bend * 2, from[1] + dy / 2 + (dx / span) * bend * 2];

  let length = 0;
  let previous: Point = from;
  for (let step = 1; step <= SAMPLES; step++) {
    const t = step / SAMPLES;
    const point: Point = [
      (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * control[0] + t ** 2 * to[0],
      (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * control[1] + t ** 2 * to[1],
    ];
    length += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    previous = point;
  }

  // a ponta segue a tangente no fim da curva, não a reta entre os extremos
  const angle = Math.atan2(to[1] - control[1], to[0] - control[0]);
  const wing = (offset: number): Point => [to[0] - Math.cos(angle + offset) * headSize, to[1] - Math.sin(angle + offset) * headSize];

  return {
    d: `M${from[0]} ${from[1]} Q${control[0]} ${control[1]} ${to[0]} ${to[1]}`,
    length,
    head: [wing(0.5), to, wing(-0.5)],
  };
}

export interface ArrowProps {
  from: Point;
  to: Point;
  /** 0→1: a seta se desenha de `from` até `to` */
  progress?: number;
  bend?: number;
  color?: string;
  strokeWidth?: number;
  headSize?: number;
}

/** Seta desenhada pelo traço. Coordenadas em px do contêiner posicionado mais próximo. */
export const Arrow: React.FC<ArrowProps> = ({ from, to, progress = 1, bend = 0, color = theme.color.slate900, strokeWidth = 4, headSize = 18 }) => {
  const { d, length, head } = arrowGeometry(from, to, bend, headSize);
  const headIn = Math.max(0, Math.min(1, (progress - 0.75) / 0.25));
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} strokeDasharray={length} strokeDashoffset={length * (1 - progress)} opacity={progress > 0 ? 1 : 0} />
      <polyline points={head.map((point) => point.join(',')).join(' ')} opacity={headIn} />
    </svg>
  );
};
