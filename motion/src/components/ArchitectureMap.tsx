import { AbsoluteFill, interpolate, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { techFor, TechGlyph, TechMark } from '../tech/glyph';
import { motion, theme } from '../theme';
import { cardSurface } from './c1-kit';
import { clip, eyebrow, Icon, type IconName } from './c2-kit';
import { fitLabel } from './Diagram';
import type { ComponentEntry } from './registry';

export type FlowStep = 'request' | 'response' | 'query';

export interface ArchitectureMapProps {
  /** nome do cliente (ex.: `React`); sem nome, o nó mostra só o papel */
  client?: string;
  server?: string;
  database?: string;
  /** serviços auxiliares pendurados no servidor (máx. 3), ex.: `['Cache', 'Fila']` */
  extras?: string[];
  /** ordem em que o pacote percorre o mapa; `query` vai ao banco e volta */
  flow?: FlowStep[];
  /** false: nó ou serviço com nome de tecnologia não ganha o logo sozinho */
  autoTechIcons?: boolean;
}

export interface FlowSegment {
  /** índices dos nós: 0 cliente, 1 servidor, 2 banco */
  from: number;
  to: number;
  step: FlowStep;
  label: string;
}

export const DEFAULT_FLOW: FlowStep[] = ['request', 'query', 'response'];
export const MAX_FLOW_STEPS = 6;

/** Trechos que o pacote percorre, na ordem: a consulta ao banco é uma ida e uma volta. */
export function flowSegments(flow: readonly FlowStep[] = DEFAULT_FLOW): FlowSegment[] {
  return flow.slice(0, MAX_FLOW_STEPS).flatMap((step): FlowSegment[] => {
    if (step === 'request') return [{ from: 0, to: 1, step, label: 'requisição' }];
    if (step === 'response') return [{ from: 1, to: 0, step, label: 'resposta' }];
    if (step === 'query')
      return [
        { from: 1, to: 2, step, label: 'consulta' },
        { from: 2, to: 1, step, label: 'dados' },
      ];
    return [];
  });
}

export interface FlowSchedule {
  start: number;
  /** tempo de viagem de um trecho */
  travel: number;
  /** pausa no nó antes do próximo trecho */
  pause: number;
}

export const FLOW_START = 1.3;

/** Ritmo do pacote: ~0.75s por trecho, comprimido se o percurso não couber no overlay. */
export function flowSchedule(segmentCount: number, durationSec: number): FlowSchedule {
  const natural = { travel: 0.75, pause: 0.3 };
  const needed = segmentCount * (natural.travel + natural.pause);
  const available = Math.max(0.6, durationSec - FLOW_START - 0.5);
  const factor = needed > available && needed > 0 ? available / needed : 1;
  return { start: FLOW_START, travel: natural.travel * factor, pause: natural.pause * factor };
}

/** Onde o pacote está no instante `sec`: trecho e avanço linear nele; `null` antes de sair e depois de chegar ao fim. */
export function packetAt(segmentCount: number, schedule: FlowSchedule, sec: number): { segment: number; progress: number } | null {
  const slot = schedule.travel + schedule.pause;
  if (segmentCount <= 0 || slot <= 0 || sec < schedule.start) return null;
  const elapsed = sec - schedule.start;
  const segment = Math.floor(elapsed / slot);
  if (segment >= segmentCount) return null;
  return { segment, progress: Math.min(1, (elapsed - segment * slot) / schedule.travel) };
}

export interface MapBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE = { width: 360, height: 250, gap: 250 } as const;

/** Os três nós em linha, centrados; com `extras`, sobem um pouco para dar lugar às pílulas embaixo do servidor. */
export function mapLayout(canvas: { width: number; height: number }, hasExtras = false): MapBox[] {
  const total = NODE.width * 3 + NODE.gap * 2;
  const left = (canvas.width - total) / 2;
  const y = (canvas.height - NODE.height) / 2 - (hasExtras ? 60 : 0);
  return [0, 1, 2].map((index) => ({ x: left + index * (NODE.width + NODE.gap), y, width: NODE.width, height: NODE.height }));
}

const LINK_INSET = 22;

/** Ponto do pacote entre dois nós vizinhos (de borda a borda, com um respiro). */
export function linkPoint(boxes: readonly MapBox[], from: number, to: number, progress: number): { x: number; y: number } {
  const a = boxes[from]!;
  const b = boxes[to]!;
  const forward = b.x > a.x;
  const startX = forward ? a.x + a.width + LINK_INSET : a.x - LINK_INSET;
  const endX = forward ? b.x - LINK_INSET : b.x + b.width + LINK_INSET;
  return { x: startX + (endX - startX) * progress, y: a.y + a.height / 2 };
}

const roles: { role: string; icon: IconName }[] = [
  { role: 'Cliente', icon: 'monitor' },
  { role: 'Servidor', icon: 'server' },
  { role: 'Banco de dados', icon: 'database' },
];

export const ArchitectureMap: React.FC<ArchitectureMapProps & BaseProps> = ({ client, server, database, extras = [], flow, autoTechIcons = true, durationInFrames }) => {
  const { frame, fps, exit } = usePresence(durationInFrames);
  const { width, height } = useVideoConfig();
  const sec = frame / fps;

  const pills = extras.slice(0, 3);
  const boxes = mapLayout({ width, height }, pills.length > 0);
  const names = [client, server, database];
  const segments = flowSegments(flow?.length ? flow : DEFAULT_FLOW);
  const schedule = flowSchedule(segments.length, durationInFrames / fps);
  const packet = packetAt(segments.length, schedule, sec);
  const current = packet ? segments[packet.segment]! : null;
  const eased = packet ? interpolate(packet.progress, [0, 1], [0, 1], { easing: motion.move }) : 0;
  const point = current ? linkPoint(boxes, current.from, current.to, eased) : null;
  const slot = schedule.travel + schedule.pause;
  const segmentStart = packet ? schedule.start + packet.segment * slot : 0;
  const labelIn = packet ? Math.min(progressAt(frame, fps, segmentStart, 0.2), 1 - progressAt(frame, fps, segmentStart + schedule.travel, Math.max(0.05, schedule.pause))) : 0;

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, scale: String(1 - 0.02 * exit) }}>
      <svg width={width} height={height} style={{ position: 'absolute', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))' }}>
        {[0, 1].map((index) => {
          const a = linkPoint(boxes, index, index + 1, 0);
          const b = linkPoint(boxes, index, index + 1, 1);
          const draw = interpolate(frame, [(0.5 + index * 0.25) * fps, (0.95 + index * 0.25) * fps], [0, 1], {
            easing: motion.move,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return draw > 0 ? (
            <line key={index} x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * draw} y2={b.y} stroke={theme.color.white} strokeWidth={6} strokeLinecap="round" />
          ) : null;
        })}
        {pills.length ? (
          <line
            x1={boxes[1]!.x + boxes[1]!.width / 2}
            y1={boxes[1]!.y + boxes[1]!.height + 14}
            x2={boxes[1]!.x + boxes[1]!.width / 2}
            y2={boxes[1]!.y + boxes[1]!.height + 14 + 56 * progressAt(frame, fps, 1)}
            stroke={theme.color.white}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray="2 14"
            opacity={progressAt(frame, fps, 1)}
          />
        ) : null}
      </svg>
      {boxes.map((box, index) => {
        const appear = progressAt(frame, fps, stagger(index, 0.25, 0.1));
        const { role, icon } = roles[index]!;
        const name = names[index]?.trim();
        // o nó "acende" enquanto o pacote está parado nele
        const arrived = packet && current && current.to === index && packet.progress >= 1 ? 1 : 0;
        const arriveStart = segmentStart + schedule.travel;
        const pulse = arrived ? Math.sin(Math.min(1, (sec - arriveStart) / Math.max(0.05, schedule.pause)) * Math.PI) : 0;
        const label = name || role;
        const tech = techFor(name, undefined, autoTechIcons);
        return (
          <div
            key={index}
            style={{
              ...cardSurface,
              position: 'absolute',
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              boxSizing: 'border-box',
              padding: '0 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              opacity: appear,
              translate: `0 ${(1 - appear) * 24}px`,
              scale: String(0.94 + 0.06 * appear + 0.035 * pulse),
            }}
          >
            <div
              style={{
                width: 92,
                height: 92,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.pill,
                background: theme.color.white,
                border: `1px solid ${theme.color.slate300}`,
                boxShadow: theme.shadow.card,
              }}
            >
              {/* nó com nome de tecnologia (`React`, `Node.js`): o logo dela no lugar do ícone do papel, que continua escrito embaixo */}
              {tech ? <TechGlyph tech={tech} size={52} surface="light" progress={appear} /> : <Icon name={icon} size={50} color={theme.color.ink} />}
            </div>
            <div
              style={{
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: theme.font.body,
                fontWeight: 800,
                fontSize: fitLabel(label, box.width - 48, 40, 26),
                letterSpacing: '-0.01em',
                color: theme.color.ink,
              }}
            >
              {label}
            </div>
            {name ? <div style={eyebrow(20)}>{role}</div> : null}
          </div>
        );
      })}
      {pills.length ? (
        <div
          style={{
            position: 'absolute',
            left: boxes[1]!.x + boxes[1]!.width / 2,
            top: boxes[1]!.y + boxes[1]!.height + 84,
            translate: '-50% 0',
            display: 'flex',
            gap: 16,
          }}
        >
          {pills.map((extra, index) => {
            const appear = progressAt(frame, fps, stagger(index, 0.12, 1.1));
            return (
              <div
                key={index}
                style={{
                  padding: '10px 28px',
                  borderRadius: theme.radius.pill,
                  background: theme.color.paper,
                  boxShadow: theme.shadow.card,
                  fontFamily: theme.font.body,
                  fontWeight: 600,
                  fontSize: 30,
                  whiteSpace: 'nowrap',
                  color: theme.color.ink,
                  opacity: appear,
                  translate: `0 ${(1 - appear) * 14}px`,
                }}
              >
                <TechMark label={extra} auto={autoTechIcons} size={30} surface="light" style={{ verticalAlign: '-0.16em', marginRight: 12 }} />
                {clip(extra, 16)}
              </div>
            );
          })}
        </div>
      ) : null}
      {current && point ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: (linkPoint(boxes, current.from, current.to, 0).x + linkPoint(boxes, current.from, current.to, 1).x) / 2,
              top: point.y - 44,
              translate: '-50% -100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 22px',
              borderRadius: theme.radius.pill,
              background: theme.color.ink,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: 28,
              whiteSpace: 'nowrap',
              color: theme.color.white,
              opacity: labelIn,
            }}
          >
            {current.to < current.from ? (
              <div style={{ display: 'flex', rotate: '180deg' }}>
                <Icon name="chevron" size={26} color={theme.color.white} strokeWidth={2.6} />
              </div>
            ) : null}
            {current.label}
            {current.to > current.from ? <Icon name="chevron" size={26} color={theme.color.white} strokeWidth={2.6} /> : null}
          </div>
          <div
            style={{
              position: 'absolute',
              left: point.x,
              top: point.y,
              width: 30,
              height: 30,
              translate: '-50% -50%',
              borderRadius: theme.radius.pill,
              background: theme.color.coral,
              border: `4px solid ${theme.color.white}`,
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
              opacity: Math.min(1, labelIn * 2),
            }}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

const sample: ArchitectureMapProps = {
  client: 'React',
  server: 'Node.js',
  database: 'Oracle',
  extras: ['Cache', 'Fila'],
  flow: ['request', 'query', 'response'],
};

export const entry: ComponentEntry = {
  component: ArchitectureMap,
  sample: { ...sample },
  defaultDuration: 8,
  description: 'Mapa cliente → servidor → banco com um pacote percorrendo o caminho da requisição; use para explicar o que acontece entre o clique e a resposta.',
};
