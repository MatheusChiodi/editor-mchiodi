import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { cardSurface, sequenceTimes } from './c1-kit';
import { clip } from './c2-kit';
import type { ComponentEntry } from './registry';

export interface GitCommit {
  /** hash curto */
  id: string;
  message: string;
  branch: string;
  /** nome da branch que este commit incorpora (commit de merge) */
  merge?: string;
}

export interface GitGraphProps {
  /** do mais antigo para o mais novo (máx. 8) */
  commits: GitCommit[];
  /** segundo (relativo ao início do overlay) em que cada commit aparece */
  revealAt?: number[];
}

export interface GraphNode {
  id: string;
  message: string;
  branch: string;
  lane: number;
  row: number;
  /** primeiro commit da branch: é onde o nome dela aparece */
  opensBranch: boolean;
  isMerge: boolean;
}

export interface GraphEdge {
  from: number;
  to: number;
  fromLane: number;
  toLane: number;
  /** raia que dá a cor do traço */
  colorLane: number;
  kind: 'straight' | 'branch' | 'merge';
}

export interface GraphLayout {
  lanes: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const MAX_COMMITS = 8;
export const MAX_LANES = 3;

/**
 * Raias e ligações do grafo. A raia de cada branch é a ordem em que ela aparece (a primeira é a principal).
 * O primeiro commit de uma branch nasce do último commit da principal; `merge` liga a ponta da
 * branch incorporada a este commit. Branches além da terceira dividem a última raia.
 */
export function layoutGitGraph(commits: readonly GitCommit[], max = MAX_COMMITS): GraphLayout {
  const lanes: string[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const tip = new Map<string, number>();
  let mainTip = -1;

  commits.slice(0, max).forEach((commit, row) => {
    let lane = lanes.indexOf(commit.branch);
    if (lane < 0) {
      if (lanes.length < MAX_LANES) lanes.push(commit.branch);
      lane = Math.min(lanes.length, MAX_LANES) - 1;
    }
    const parent = tip.get(commit.branch);
    const opensBranch = parent === undefined;
    if (parent !== undefined) edges.push({ from: parent, to: row, fromLane: lane, toLane: lane, colorLane: lane, kind: 'straight' });
    else if (row > 0) {
      const from = mainTip >= 0 ? mainTip : row - 1;
      const fromLane = nodes[from]!.lane;
      edges.push({ from, to: row, fromLane, toLane: lane, colorLane: lane, kind: fromLane === lane ? 'straight' : 'branch' });
    }
    const merged = commit.merge && commit.merge !== commit.branch ? tip.get(commit.merge) : undefined;
    if (merged !== undefined) {
      const fromLane = nodes[merged]!.lane;
      edges.push({ from: merged, to: row, fromLane, toLane: lane, colorLane: fromLane, kind: fromLane === lane ? 'straight' : 'merge' });
    }
    nodes.push({ id: commit.id, message: commit.message, branch: commit.branch, lane, row, opensBranch, isMerge: merged !== undefined });
    tip.set(commit.branch, row);
    if (lane === 0) mainTip = row;
  });
  return { lanes, nodes, edges };
}

export const GRAPH = { row: 78, lane: 54, left: 34, top: 39 } as const;

export function nodePoint(row: number, lane: number): { x: number; y: number } {
  return { x: GRAPH.left + lane * GRAPH.lane, y: GRAPH.top + row * GRAPH.row };
}

/** Caminho SVG da ligação: a troca de raia acontece numa curva de uma linha de altura, colada no commit novo (branch) ou no de destino (merge). */
export function graphEdgePath(edge: GraphEdge): string {
  const a = nodePoint(edge.from, edge.fromLane);
  const b = nodePoint(edge.to, edge.toLane);
  if (edge.kind === 'straight') return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const bend = GRAPH.row * 0.55;
  if (edge.kind === 'branch') {
    const y = a.y + GRAPH.row;
    const tail = y < b.y ? ` L ${b.x} ${b.y}` : '';
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + bend}, ${b.x} ${y - bend}, ${b.x} ${y}${tail}`;
  }
  const y = b.y - GRAPH.row;
  const lead = y > a.y ? ` L ${a.x} ${y}` : '';
  return `M ${a.x} ${a.y}${lead} C ${a.x} ${y + bend}, ${b.x} ${b.y - bend}, ${b.x} ${b.y}`;
}

export const EDGE_DRAW_SEC = 0.4;

/** Segundo em que a ligação começa a ser desenhada: chega junto com o commit de destino, sem sair antes da origem. */
export function edgeDrawStart(fromTime: number, toTime: number): number {
  return Math.max(fromTime, toTime - EDGE_DRAW_SEC);
}

const laneColors = [theme.color.ink, theme.color.coral, theme.color.emerald] as const;
const WIDTH = 1240;
const PAD = 40;

export const GitGraph: React.FC<GitGraphProps & BaseProps> = ({ commits, revealAt, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const { lanes, nodes, edges } = layoutGitGraph(commits);
  const times = sequenceTimes(nodes.length, revealAt, 0.5, 0.6);
  const graphWidth = GRAPH.left * 2 + Math.max(0, lanes.length - 1) * GRAPH.lane;
  const height = nodes.length * GRAPH.row;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          ...cardSurface,
          position: 'relative',
          width: WIDTH,
          boxSizing: 'border-box',
          padding: `${PAD - 10}px ${PAD}px ${PAD - 10}px ${PAD - 16}px`,
          opacity: value,
          translate: `0 ${(1 - enter) * 32 + exit * 16}px`,
        }}
      >
        <div style={{ position: 'relative', height }}>
          <svg width={graphWidth} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
            {edges.map((edge, index) => {
              const start = edgeDrawStart(times[edge.from]!, times[edge.to]!);
              const draw = interpolate(frame, [start * fps, (start + EDGE_DRAW_SEC) * fps], [0, 1], {
                easing: motion.move,
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              if (draw <= 0) return null;
              return (
                <path
                  key={index}
                  d={graphEdgePath(edge)}
                  pathLength={1}
                  fill="none"
                  stroke={laneColors[edge.colorLane] ?? theme.color.ink}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeDasharray="1 2"
                  strokeDashoffset={1 - draw}
                />
              );
            })}
            {nodes.map((node) => {
              const point = nodePoint(node.row, node.lane);
              const appear = progressAt(frame, fps, times[node.row]!, 0.35);
              const color = laneColors[node.lane] ?? theme.color.ink;
              return (
                <circle
                  key={node.row}
                  cx={point.x}
                  cy={point.y}
                  r={(node.isMerge ? 15 : 13) * appear}
                  fill={node.isMerge ? theme.color.paper : color}
                  stroke={node.isMerge ? color : theme.color.paper}
                  strokeWidth={node.isMerge ? 6 : 4}
                  opacity={appear}
                />
              );
            })}
          </svg>
          {nodes.map((node) => {
            const appear = progressAt(frame, fps, times[node.row]! + 0.05);
            return (
              <div
                key={node.row}
                style={{
                  position: 'absolute',
                  left: graphWidth + 6,
                  right: 0,
                  top: node.row * GRAPH.row,
                  height: GRAPH.row,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  opacity: appear,
                  translate: `${(1 - appear) * 18}px 0`,
                }}
              >
                <div style={{ flexShrink: 0, fontFamily: theme.font.mono, fontWeight: 500, fontSize: 26, color: theme.color.slate600 }}>{clip(node.id, 7)}</div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: theme.font.body,
                    fontWeight: 600,
                    fontSize: 34,
                    color: theme.color.ink,
                  }}
                >
                  {node.message}
                </div>
                {node.opensBranch ? (
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '6px 20px',
                      borderRadius: theme.radius.pill,
                      background: theme.color.white,
                      border: `1px solid ${theme.color.slate300}`,
                      fontFamily: theme.font.mono,
                      fontWeight: 500,
                      fontSize: 24,
                      color: theme.color.slate600,
                    }}
                  >
                    <div style={{ width: 12, height: 12, borderRadius: theme.radius.pill, background: laneColors[node.lane] ?? theme.color.ink }} />
                    {clip(node.branch, 18)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const sample: GitGraphProps = {
  commits: [
    { id: 'a1f3c9e', message: 'feat: cria tela de login', branch: 'main' },
    { id: 'b72d0aa', message: 'feat: valida e-mail no formulário', branch: 'feature/login' },
    { id: 'c9e4412', message: 'fix: corrige foco do campo de senha', branch: 'feature/login' },
    { id: 'd03b7f1', message: 'chore: atualiza dependências', branch: 'main' },
    { id: 'e58a6c2', message: 'merge: login validado na main', branch: 'main', merge: 'feature/login' },
  ],
};

export const entry: ComponentEntry = {
  component: GitGraph,
  sample: { ...sample },
  defaultDuration: 9,
  vertical: { zone: 'full' },
  description: 'Grafo de commits com até 3 branches que se abrem e se juntam; use para explicar branch, merge e fluxo de trabalho com Git.',
};
