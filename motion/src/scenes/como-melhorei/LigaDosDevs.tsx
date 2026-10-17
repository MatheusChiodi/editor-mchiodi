import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { Arrow, enter, Icon, type IconName, Pill, type Point, SceneBackground, Statement } from '../../scene-kit';
import { theme } from '../../theme';

export interface LeagueHero {
  /** o "poder" do herói, na etiqueta embaixo dele */
  label: string;
  /** emblema no peito */
  icon: IconName;
}

export interface LigaDosDevsReveal {
  hero1: number;
  hero2: number;
  hero3: number;
  hero4: number;
  hero5: number;
  /** "liga da justiça formada por devs": entra o título */
  title: number;
  /** "crescer e cada vez ficar melhor": a seta sobe e o time sobe junto */
  grow: number;
}

export interface LigaDosDevsProps {
  /** segundos relativos ao início da cena */
  revealAt?: LigaDosDevsReveal;
  /** até 5 heróis, da esquerda para a direita */
  heroes?: LeagueHero[];
  title?: string;
  /** trecho do título em coral */
  accent?: string;
  eyebrow?: string;
  growLabel?: string;
}

export const LIGA_REVEAL: LigaDosDevsReveal = { hero1: 0.5, hero2: 0.9, hero3: 1.3, hero4: 1.7, hero5: 2.1, title: 3.0, grow: 4.6 };

export const LIGA_HEROES: LeagueHero[] = [
  { label: 'Front-end', icon: 'browser' },
  { label: 'Back-end', icon: 'server' },
  { label: 'Mobile', icon: 'phone' },
  { label: 'Dados', icon: 'database' },
  { label: 'DevOps', icon: 'cloud' },
];

export const MAX_HEROES = 5;
/** caixa de desenho da figura (unidades do viewBox) */
const FIGURE = { width: 200, height: 260, emblem: [100, 112] as Point, emblemRadius: 23 };
/** altura (px) do bloco do título e da faixa "crescendo juntos", com os espaçamentos */
const TITLE_HEIGHT = 166;
const GROW_HEIGHT = 96;
const GAP = 36;

/** Momento de entrada de cada herói, na ordem da fila. */
export function heroTimes(revealAt: LigaDosDevsReveal, count = MAX_HEROES): number[] {
  return [revealAt.hero1, revealAt.hero2, revealAt.hero3, revealAt.hero4, revealAt.hero5].slice(0, Math.max(0, Math.min(MAX_HEROES, count)));
}

export interface LeagueSlot {
  /** canto esquerdo da coluna */
  x: number;
  /** largura e altura da figura já na escala do herói */
  figure: { width: number; height: number };
  scale: number;
}

export interface LeagueLayout {
  width: number;
  column: number;
  /** altura da linha dos heróis: figura do centro + etiqueta */
  rowHeight: number;
  slots: LeagueSlot[];
  grow: { from: Point; to: Point; bend: number; label: Point; height: number };
}

/** Fila de heróis centralizada: o do meio é o maior e os das pontas diminuem, como numa formação de time. */
export function leagueLayout(count: number, width = 1728, column = 300, gap = 36): LeagueLayout {
  const total = Math.max(0, Math.min(MAX_HEROES, count));
  const span = total * column + Math.max(0, total - 1) * gap;
  const start = (width - span) / 2;
  const middle = (total - 1) / 2;
  const base = { width: column * 0.8, height: column * 0.8 * (FIGURE.height / FIGURE.width) };
  const slots = Array.from({ length: total }, (_, index) => {
    const scale = 1 - 0.07 * Math.abs(index - middle);
    return { x: start + index * (column + gap), figure: { width: base.width * scale, height: base.height * scale }, scale };
  });
  return {
    width,
    column,
    rowHeight: base.height + 94,
    slots,
    grow: {
      from: [start + 40, GROW_HEIGHT - 14],
      to: [start + span - 40, 14],
      bend: -10,
      label: [width / 2, GROW_HEIGHT / 2],
      height: GROW_HEIGHT,
    },
  };
}

/** Balanço lateral (unidades do viewBox) da barra da capa: cada herói fora de fase com o vizinho. */
export function capeSway(frame: number, fps: number, index: number, amplitude = 5): number {
  return Math.sin((frame / fps) * 2.2 + index * 1.3) * amplitude;
}

/** Quanto a fila desce para ficar no centro enquanto o título e a seta ainda não entraram (px). */
export function leagueLift(titleProgress: number): number {
  return ((1 - titleProgress) * (GROW_HEIGHT - TITLE_HEIGHT)) / 2;
}

const Hero: React.FC<{ hero: LeagueHero; slot: LeagueSlot; column: number; progress: number; sway: number; lift: number }> = ({
  hero,
  slot,
  column,
  progress,
  sway,
  lift,
}) => {
  const ink = theme.color.slate900;
  const emblem = (slot.figure.width / FIGURE.width) * FIGURE.emblemRadius * 2;
  const unfurl = 0.7 + 0.3 * progress;
  return (
    <div
      style={{
        position: 'absolute',
        left: slot.x,
        bottom: 0,
        width: column,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        opacity: Math.min(1, progress * 1.6),
        // herói chega de cima e pousa; depois sobe junto com o time
        translate: `0px ${((1 - progress) * -44 - lift).toFixed(2)}px`,
      }}
    >
      <div style={{ position: 'relative', width: slot.figure.width, height: slot.figure.height }}>
        <svg
          viewBox={`0 0 ${FIGURE.width} ${FIGURE.height}`}
          width={slot.figure.width}
          height={slot.figure.height}
          style={{ overflow: 'visible' }}
          stroke={ink}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={theme.color.white}
        >
          <g transform={`translate(100 80) scale(${unfurl.toFixed(3)}) translate(-100 -80)`}>
            <path
              d={`M72 80 C42 120 ${32 + sway} 190 ${24 + sway} 242 Q62 230 100 242 Q138 230 ${176 + sway} 242 C${168 + sway} 190 158 120 128 80 Z`}
              fill={ink}
            />
          </g>
          <rect x={77} y={164} width={20} height={72} rx={8} />
          <rect x={103} y={164} width={20} height={72} rx={8} />
          <path d="M70 238h30M100 238h30" strokeWidth={5} />
          {/* braço em tubo (contorno + miolo branco) para aparecer por cima da capa escura */}
          <path d="M70 90L45 122L70 150M130 90L155 122L130 150" fill="none" strokeWidth={15} />
          <path d="M70 90L45 122L70 150M130 90L155 122L130 150" fill="none" stroke={theme.color.white} strokeWidth={9} />
          <rect x={66} y={76} width={68} height={98} rx={16} />
          <path d="M66 152h68" />
          <circle cx={100} cy={46} r={26} />
          <rect x={77} y={38} width={46} height={13} rx={6.5} fill={ink} />
          <circle cx={90} cy={44.5} r={2.6} stroke="none" />
          <circle cx={110} cy={44.5} r={2.6} stroke="none" />
          <circle cx={FIGURE.emblem[0]} cy={FIGURE.emblem[1]} r={FIGURE.emblemRadius} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: (FIGURE.emblem[0] / FIGURE.width) * slot.figure.width - emblem / 2,
            top: (FIGURE.emblem[1] / FIGURE.height) * slot.figure.height - emblem / 2,
            width: emblem,
            height: emblem,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={hero.icon} size={emblem * 0.62} draw={progress} strokeWidth={2} />
        </div>
      </div>
      <Pill>{hero.label}</Pill>
    </div>
  );
};

/** "Uma liga da justiça formada por devs": cinco heróis de capa, um por área, entram um a um e crescem juntos. */
export const LigaDosDevs: React.FC<LigaDosDevsProps & BaseProps> = ({
  revealAt = LIGA_REVEAL,
  heroes = LIGA_HEROES,
  title = 'Liga dos Devs',
  accent = 'Devs',
  eyebrow = 'Cada um com o seu poder',
  growLabel = 'crescendo juntos',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const team = heroes.slice(0, MAX_HEROES);
  const layout = leagueLayout(team.length, width - theme.safe.x * 2);
  const times = heroTimes(revealAt, team.length);
  const offset = leagueLift(enter(frame, fps, revealAt.title - 0.35, 0.7));
  const grow = enter(frame, fps, revealAt.grow, 0.7);

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: GAP }}>
      <div style={{ height: TITLE_HEIGHT, display: 'flex', alignItems: 'flex-end', opacity: frame >= revealAt.title * fps ? 1 : 0 }}>
        <Statement text={title} accent={accent} eyebrow={eyebrow} atSec={revealAt.title} fontSize={92} />
      </div>
      <div style={{ position: 'relative', width: layout.width, height: layout.rowHeight, translate: `0px ${offset.toFixed(2)}px` }}>
        {team.map((hero, index) => (
          <Hero
            key={hero.label}
            hero={hero}
            slot={layout.slots[index]!}
            column={layout.column}
            progress={enter(frame, fps, times[index]!, 0.55)}
            sway={capeSway(frame, fps, index)}
            lift={enter(frame, fps, revealAt.grow + 0.1 + index * 0.06, 0.6) * 18}
          />
        ))}
      </div>
      <div style={{ position: 'relative', width: layout.width, height: layout.grow.height }}>
        <Arrow from={layout.grow.from} to={layout.grow.to} bend={layout.grow.bend} progress={grow} />
        <div
          style={{
            position: 'absolute',
            left: layout.grow.label[0],
            top: layout.grow.label[1],
            width: 0,
            height: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Pill variant="emerald" dot progress={enter(frame, fps, revealAt.grow + 0.25)} style={{ background: theme.color.paper }}>
            {growLabel}
          </Pill>
        </div>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: LigaDosDevs,
  sample: { revealAt: LIGA_REVEAL },
  defaultDuration: 6.8,
  description:
    'Cena papel: um time de heróis-devs de capa (Front-end, Back-end, Mobile, Dados, DevOps) entra um a um, ganha o título "Liga dos Devs" e sobe junto. Para falar de uma comunidade de devs que cresce em grupo.',
};

export const MODEL = 'FileiraDeItens';
