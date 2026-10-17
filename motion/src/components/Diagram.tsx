import { AbsoluteFill, interpolate, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { techFor, TechGlyph } from '../tech/glyph';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  /** `tech:<id>`: logo da tecnologia quando o rótulo não é o nome dela ("API" que é Node.js) */
  icon?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export type DiagramDirection = 'horizontal' | 'vertical';

export interface DiagramProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  direction?: DiagramDirection;
  /** segundo (relativo ao início do overlay) em que cada nó aparece, na ordem de `nodes` */
  revealAt?: number[];
  /** false: nó com nome de tecnologia não ganha o logo sozinho */
  autoTechIcons?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeGeometry {
  start: Point;
  /** fim do traço: um pouco antes da ponta, para a linha não vazar pela cabeça da seta */
  end: Point;
  control?: Point;
  tip: Point;
  /** direção da seta na ponta, em graus */
  angle: number;
  label: Point;
}

export const MAX_NODES = 5;
const CANVAS = { width: 1920, height: 1080 };
const NODE_GAP = 14;
const HEAD = 24;
const PAIR_OFFSET = 24;

/** Caixas dos nós em linha, centralizadas na tela e dentro da margem segura. */
export function layoutNodes(
  count: number,
  direction: DiagramDirection = 'horizontal',
  options: { hasSublabel?: boolean; hasEdgeLabel?: boolean } = {},
  canvas: { width: number; height: number } = CANVAS,
): Box[] {
  const total = Math.max(0, Math.min(MAX_NODES, count));
  if (total === 0) return [];
  if (direction === 'horizontal') {
    const gap = options.hasEdgeLabel ? 190 : 120;
    const available = canvas.width - theme.safe.x * 2;
    const width = Math.min(380, (available - gap * (total - 1)) / total);
    const height = options.hasSublabel ? 190 : 150;
    const left = (canvas.width - (width * total + gap * (total - 1))) / 2;
    return Array.from({ length: total }, (_, index) => ({
      x: left + index * (width + gap),
      y: (canvas.height - height) / 2,
      width,
      height,
    }));
  }
  const gap = options.hasEdgeLabel ? 92 : 72;
  const available = canvas.height - theme.safe.y * 2;
  const height = Math.min(options.hasSublabel ? 170 : 130, (available - gap * (total - 1)) / total);
  const width = 560;
  const top = (canvas.height - (height * total + gap * (total - 1))) / 2;
  return Array.from({ length: total }, (_, index) => ({
    x: (canvas.width - width) / 2,
    y: top + index * (height + gap),
    width,
    height,
  }));
}

const angleOf = (from: Point, to: Point) => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

function shorten(from: Point, to: Point, by: number): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: to.x - ((to.x - from.x) / length) * by, y: to.y - ((to.y - from.y) / length) * by };
}

/**
 * Geometria da seta entre dois nós. Vizinhos são ligados por reta; nós distantes, por um arco
 * que passa por fora da fila (ida por cima/direita, volta por baixo/esquerda). `paired` desloca
 * a reta quando existe a seta no sentido oposto, para as duas não se sobreporem.
 */
export function edgeGeometry(
  boxes: Box[],
  fromIndex: number,
  toIndex: number,
  direction: DiagramDirection = 'horizontal',
  paired = false,
): EdgeGeometry | null {
  const from = boxes[fromIndex];
  const to = boxes[toIndex];
  if (!from || !to || fromIndex === toIndex) return null;
  const forward = toIndex > fromIndex;
  const sign = forward ? 1 : -1;
  const distance = Math.abs(toIndex - fromIndex);
  const horizontal = direction === 'horizontal';
  const center = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

  if (distance === 1) {
    const offset = paired ? -sign * PAIR_OFFSET : 0;
    const start: Point = horizontal
      ? { x: center(from).x + sign * (from.width / 2 + NODE_GAP), y: center(from).y + offset }
      : { x: center(from).x - offset, y: center(from).y + sign * (from.height / 2 + NODE_GAP) };
    const tip: Point = horizontal
      ? { x: center(to).x - sign * (to.width / 2 + NODE_GAP), y: center(to).y + offset }
      : { x: center(to).x - offset, y: center(to).y - sign * (to.height / 2 + NODE_GAP) };
    const middle = { x: (start.x + tip.x) / 2, y: (start.y + tip.y) / 2 };
    const label: Point = horizontal ? { x: middle.x, y: middle.y - sign * 36 } : { x: middle.x + sign * 30, y: middle.y };
    return { start, end: shorten(start, tip, HEAD * 0.6), tip, angle: angleOf(start, tip), label };
  }

  // o pico de uma quadrática fica a meio caminho do ponto de controle
  const peak = 80 + 34 * (distance - 2);
  const start: Point = horizontal
    ? { x: center(from).x, y: center(from).y - sign * (from.height / 2 + NODE_GAP) }
    : { x: center(from).x + sign * (from.width / 2 + NODE_GAP), y: center(from).y };
  const tip: Point = horizontal
    ? { x: center(to).x, y: center(to).y - sign * (to.height / 2 + NODE_GAP) }
    : { x: center(to).x + sign * (to.width / 2 + NODE_GAP), y: center(to).y };
  const control: Point = horizontal
    ? { x: (start.x + tip.x) / 2, y: start.y - sign * peak * 2 }
    : { x: start.x + sign * peak * 2, y: (start.y + tip.y) / 2 };
  const label: Point = horizontal
    ? { x: control.x, y: start.y - sign * (peak + 34) }
    : { x: start.x + sign * (peak + 30), y: control.y };
  return { start, end: shorten(control, tip, HEAD * 0.6), control, tip, angle: angleOf(control, tip), label };
}

export function edgePath(edge: EdgeGeometry): string {
  const { start, end, control } = edge;
  return control
    ? `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
    : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

/** Segundo em que cada nó aparece: `revealAt` quando informado, senão um ritmo que cabe na duração. */
export function revealTimes(count: number, durationSec: number, revealAt?: number[]): number[] {
  const step = Math.max(0.35, Math.min(0.9, (durationSec - 1.5) / Math.max(1, count)));
  const latest = Math.max(0, durationSec - 0.6);
  return Array.from({ length: count }, (_, index) => {
    const given = revealAt?.[index];
    const time = typeof given === 'number' && Number.isFinite(given) && given >= 0 ? given : index * step;
    return Math.round(Math.min(time, latest) * 1000) / 1000;
  });
}

export const EDGE_SEC = 0.45;

/** A seta é desenhada entre os dois nós: sai depois do primeiro e chega junto com o segundo. */
export function edgeStart(fromTime: number, toTime: number): number {
  const earlier = Math.min(fromTime, toTime);
  const later = Math.max(fromTime, toTime);
  return Math.max(earlier + 0.15, later - EDGE_SEC);
}

/** Fonte que faz `text` caber em `maxWidth` numa linha (largura média de caractere estimada). */
export function fitLabel(text: string, maxWidth: number, max: number, min: number, ratio = 0.6): number {
  if (!text.length) return max;
  return Math.max(min, Math.min(max, Math.floor(maxWidth / (text.length * ratio))));
}

/** Quebra o texto em duas linhas o mais equilibradas possível (ou devolve uma só se não houver espaço). */
export function balanceLines(text: string): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return [text.trim()];
  let best: string[] = [text.trim()];
  let bestLength = Infinity;
  for (let index = 1; index < words.length; index++) {
    const pair = [words.slice(0, index).join(' '), words.slice(index).join(' ')];
    const longest = Math.max(pair[0]!.length, pair[1]!.length);
    if (longest < bestLength) [best, bestLength] = [pair, longest];
  }
  return best;
}

/** Rótulo do nó: uma linha se couber num tamanho confortável; senão, duas linhas equilibradas. */
export function fitNodeLabel(text: string, maxWidth: number, max: number, min: number): { lines: string[]; fontSize: number } {
  const single = fitLabel(text, maxWidth, max, min);
  if (single >= max * 0.75) return { lines: [text], fontSize: single };
  const lines = balanceLines(text);
  if (lines.length < 2) return { lines, fontSize: single };
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a));
  return { lines, fontSize: Math.min(fitLabel(longest, maxWidth, max, min), Math.round(max * 0.8)) };
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
/** lado do logo de tecnologia dentro de um nó */
const TECH_MARK = 40;

export const Diagram: React.FC<DiagramProps & BaseProps> = ({
  nodes,
  edges,
  direction = 'horizontal',
  revealAt,
  autoTechIcons = true,
  durationInFrames,
}) => {
  const { frame, fps, exit } = usePresence(durationInFrames);
  const { width, height } = useVideoConfig();
  const horizontal = direction === 'horizontal';

  const shown = nodes.slice(0, MAX_NODES);
  const indexById = new Map(shown.map((node, index) => [node.id, index]));
  const links = edges.filter((edge) => indexById.has(edge.from) && indexById.has(edge.to) && edge.from !== edge.to);
  const boxes = layoutNodes(
    shown.length,
    direction,
    { hasSublabel: shown.some((node) => node.sublabel), hasEdgeLabel: links.some((edge) => edge.label) },
    { width, height },
  );
  const times = revealTimes(shown.length, durationInFrames / fps, revealAt);

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, scale: String(1 - 0.02 * exit) }}>
      <svg width={width} height={height} style={{ position: 'absolute', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))' }}>
        {links.map((edge, index) => {
          const fromIndex = indexById.get(edge.from)!;
          const toIndex = indexById.get(edge.to)!;
          const paired = links.some((other) => other.from === edge.to && other.to === edge.from);
          const geometry = edgeGeometry(boxes, fromIndex, toIndex, direction, paired);
          if (!geometry) return null;
          const start = edgeStart(times[fromIndex]!, times[toIndex]!);
          const draw = interpolate(frame, [start * fps, (start + EDGE_SEC) * fps], [0, 1], {
            easing: motion.move,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          if (draw <= 0) return null;
          const head = interpolate(draw, [0.7, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <g key={index}>
              <path
                d={edgePath(geometry)}
                pathLength={1}
                fill="none"
                stroke={theme.color.white}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray="1 2"
                strokeDashoffset={1 - draw}
              />
              <polygon
                points={`0,0 ${-HEAD},${-HEAD / 2} ${-HEAD},${HEAD / 2}`}
                fill={theme.color.white}
                opacity={head}
                transform={`translate(${geometry.tip.x} ${geometry.tip.y}) rotate(${geometry.angle}) scale(${0.4 + 0.6 * head})`}
              />
            </g>
          );
        })}
      </svg>
      {shown.map((node, index) => {
        const box = boxes[index]!;
        const appear = progressAt(frame, fps, times[index]!);
        const padding = box.width < 260 ? 16 : 24;
        const inner = box.width - padding * 2;
        // nó que é uma tecnologia (pelo rótulo ou por `icon: "tech:<id>"`) leva o logo antes do nome, descontado da largura
        const tech = techFor(node.label, node.icon, autoTechIcons);
        const label = fitNodeLabel(node.label, inner - (tech ? TECH_MARK + 12 : 0), box.height < 125 ? 34 : 40, 20);
        return (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              boxSizing: 'border-box',
              padding: `0 ${padding}px`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              textAlign: 'center',
              borderRadius: theme.radius.card,
              background: theme.color.paper,
              boxShadow: theme.shadow.raised,
              opacity: appear,
              translate: horizontal ? `0 ${(1 - appear) * 22}px` : `${(1 - appear) * -22}px 0`,
              scale: String(0.94 + 0.06 * appear),
            }}
          >
            <div
              style={{
                maxWidth: '100%',
                fontFamily: theme.font.body,
                fontWeight: 800,
                fontSize: label.fontSize,
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
                color: theme.color.ink,
              }}
            >
              {label.lines.map((line, lineIndex) => (
                <div key={lineIndex} style={ellipsis}>
                  {tech && lineIndex === 0 ? (
                    <TechGlyph tech={tech} size={TECH_MARK} surface="light" progress={appear} style={{ verticalAlign: '-0.2em', marginRight: 12 }} />
                  ) : null}
                  {line}
                </div>
              ))}
            </div>
            {node.sublabel ? (
              <div
                style={{
                  ...ellipsis,
                  maxWidth: '100%',
                  fontFamily: theme.font.body,
                  fontWeight: 500,
                  fontSize: fitLabel(node.sublabel, inner, 26, 18, 0.54),
                  lineHeight: 1.2,
                  color: theme.color.slate600,
                }}
              >
                {node.sublabel}
              </div>
            ) : null}
          </div>
        );
      })}
      {links.map((edge, index) => {
        if (!edge.label) return null;
        const fromIndex = indexById.get(edge.from)!;
        const toIndex = indexById.get(edge.to)!;
        const paired = links.some((other) => other.from === edge.to && other.to === edge.from);
        const geometry = edgeGeometry(boxes, fromIndex, toIndex, direction, paired);
        if (!geometry) return null;
        const appear = progressAt(frame, fps, edgeStart(times[fromIndex]!, times[toIndex]!) + EDGE_SEC * 0.5, motion.fast * 1.5);
        const adjacent = Math.abs(toIndex - fromIndex) === 1;
        const backward = toIndex < fromIndex;
        // na horizontal o rótulo fica centrado sobre a seta; na vertical, ao lado dela
        const anchor = horizontal ? '-50% -50%' : backward ? '-100% -50%' : '0 -50%';
        const maxWidth = horizontal && adjacent ? Math.abs(geometry.tip.x - geometry.start.x) + NODE_GAP : 420;
        return (
          <div
            key={index}
            style={{
              ...ellipsis,
              position: 'absolute',
              left: geometry.label.x,
              top: geometry.label.y,
              translate: anchor,
              boxSizing: 'border-box',
              maxWidth,
              padding: '6px 16px',
              borderRadius: theme.radius.pill,
              background: theme.color.ink,
              color: theme.color.white,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: horizontal && adjacent ? fitLabel(edge.label, maxWidth - 32, 24, 17, 0.56) : 24,
              lineHeight: 1.3,
              opacity: appear,
              scale: String(0.9 + 0.1 * appear),
            }}
          >
            {edge.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const sample: DiagramProps = {
  direction: 'horizontal',
  nodes: [
    { id: 'client', label: 'Navegador', sublabel: 'React + Vite' },
    { id: 'edge', label: 'Worker', sublabel: 'Cloudflare' },
    { id: 'kv', label: 'KV', sublabel: 'cache na borda' },
    { id: 'api', label: 'API', sublabel: 'Node.js' },
  ],
  edges: [
    { from: 'client', to: 'edge', label: 'fetch' },
    { from: 'edge', to: 'kv', label: 'lê cache' },
    { from: 'kv', to: 'api', label: 'se faltar' },
  ],
};

export const entry: ComponentEntry = {
  component: Diagram,
  sample: { ...sample },
  defaultDuration: 8,
  description: 'Caixas ligadas por setas que aparecem na ordem da explicação; use para mostrar a relação entre partes (cliente → servidor → banco).',
};
