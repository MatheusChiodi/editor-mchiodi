// MODELO de animação reutilizável: na EDL entra como `scene:modelos/DegrauEVao`, em qualquer vídeo.
// Forma: uma base baixa à esquerda, um paredão alto à direita (fiada por fiada) e, no corredor entre eles, a régua que mede o vão.

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { enter, IconBadge, type IconName, Pill, type Point, popIn, rise, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';
import { CHAR, clampInt, CLIP, type Extent, fitFont, fitPill, iconOr, MIN_TEXT, pillClamp, sequence, statementHeight, timeOr, titleSize } from './kit-a';

export interface DegrauBase {
  label: string;
  /** linha de apoio: o que essa base contém */
  hint?: string;
  /** quem está em cima da base (padrão: uma pessoa) */
  icon?: IconName;
}

export interface DegrauWall {
  /** rótulo da fiada do topo: o nome do paredão */
  label: string;
  /** de 0 a 6 exigências, uma por fiada, de baixo para cima (sem itens = 4 fiadas lisas) */
  items?: string[];
}

export interface DegrauReveal {
  /** a base pequena entra */
  base?: number;
  /** o paredão começa a subir */
  wall?: number;
  /** o vão entre os dois fica medido */
  gap?: number;
  /** a pílula de fecho, no chão entre os dois */
  closing?: number;
}

export interface DegrauEVaoProps {
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral (a régua do vão já é coral: use só se a régua não for o foco) */
  accent?: string;
  base?: DegrauBase;
  wall?: DegrauWall;
  /** rótulo da régua: o nome do vão */
  gapLabel?: string;
  /** pílula de fecho (omitida = não aparece) */
  closing?: string;
  /** segundos relativos ao início da cena, por parte */
  revealAt?: DegrauReveal;
  /** segundo em que cada fiada do paredão sobe, de baixo para cima, por índice (padrão: em cascata a partir de `revealAt.wall`) */
  rowsAt?: number[];
}

export const DEGRAU_MIN_ROWS = 3;
export const DEGRAU_MAX_ROWS = 7;
/** atraso entre as fiadas do paredão (s) */
export const DEGRAU_ROW_STAGGER = 0.09;
const DEFAULT_REVEAL = { base: 0.4, wall: 2.0, gap: 3.4, closing: 5.2 };
const ROW_PADDING = 24;

const DEFAULT_BASE: DegrauBase = { label: 'Onde estou', icon: 'user' };
const DEFAULT_WALL: DegrauWall = { label: 'Onde preciso chegar' };

export interface DegrauBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DegrauLayout {
  width: number;
  height: number;
  base: DegrauBox;
  wall: DegrauBox;
  /** fiadas do paredão, de baixo para cima */
  rows: DegrauBox[];
  person: { size: number; center: Point };
  /** corredor livre entre a base e o paredão */
  corridor: { x: number; width: number };
  /** régua vertical do vão: do topo da base ao topo do paredão */
  gap: { x: number; from: number; to: number; size: number; label: Point };
  /** onde entra o fecho, no chão entre os dois */
  closing: Point;
}

/** Rótulo de cada fiada, de baixo para cima: os itens e, no topo, o nome do paredão. De 3 a 7 fiadas. */
export function degrauRowLabels(wall: DegrauWall): string[] {
  const items = (wall.items ?? []).slice(0, DEGRAU_MAX_ROWS - 1);
  const blanks = items.length === 0 ? 4 : Math.max(0, DEGRAU_MIN_ROWS - 1 - items.length);
  return [...items, ...Array.from({ length: blanks }, () => ''), wall.label];
}

/** Base baixa à esquerda, paredão alto à direita e, no corredor entre eles, a régua que mede o vão. */
export function degrauLayout(rowCount = 5, width = 1640, height = 540): DegrauLayout {
  const count = clampInt(rowCount, DEGRAU_MIN_ROWS, DEGRAU_MAX_ROWS);
  const baseWidth = 580;
  const baseHeight = 160;
  const wallWidth = 600;
  const rowGap = 10;
  const rowHeight = (height - rowGap * (count - 1)) / count;
  const base: DegrauBox = { x: 0, y: height - baseHeight, width: baseWidth, height: baseHeight };
  const wall: DegrauBox = { x: width - wallWidth, y: 0, width: wallWidth, height };
  const rows: DegrauBox[] = Array.from({ length: count }, (_, i) => ({ x: wall.x, y: height - (i + 1) * rowHeight - i * rowGap, width: wallWidth, height: rowHeight }));
  const corridor = (base.x + base.width + wall.x) / 2;
  const personSize = 108;
  return {
    width,
    height,
    base,
    wall,
    rows,
    person: { size: personSize, center: [base.x + base.width / 2, base.y - 16 - personSize / 2] },
    corridor: { x: base.x + base.width, width: wall.x - base.width - base.x },
    gap: { x: corridor, from: base.y, to: wall.y, size: base.y - wall.y, label: [corridor, (base.y + wall.y) / 2] },
    closing: [corridor, base.y + base.height / 2],
  };
}

/** Quantas vezes o paredão é mais alto que a base. */
export function degrauRatio(layout: DegrauLayout): number {
  return layout.wall.height / layout.base.height;
}

/** Segundo em que cada fiada sobe, de baixo para cima: o que veio em `rowsAt` e, onde falta, em cascata. */
export function degrauRowTimes(wallAt: number, rowCount: number, rowsAt?: readonly number[], stagger: number = DEGRAU_ROW_STAGGER): number[] {
  return sequence(rowCount, rowsAt, wallAt, stagger);
}

/** Tempos das partes fixas, com o padrão no que faltar. */
export function degrauReveal(revealAt: DegrauReveal = {}): Required<DegrauReveal> {
  return {
    base: timeOr(revealAt.base, DEFAULT_REVEAL.base),
    wall: timeOr(revealAt.wall, DEFAULT_REVEAL.wall),
    gap: timeOr(revealAt.gap, DEFAULT_REVEAL.gap),
    closing: timeOr(revealAt.closing, DEFAULT_REVEAL.closing),
  };
}

const At: React.FC<{ point: Point; children: React.ReactNode }> = ({ point, children }) => (
  <div style={{ position: 'absolute', left: point[0], top: point[1], width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
);

export const DegrauEVao: React.FC<DegrauEVaoProps & BaseProps> = ({
  eyebrow,
  title = 'O que eu tenho e o que falta.',
  accent,
  base = DEFAULT_BASE,
  wall = DEFAULT_WALL,
  gapLabel = 'o vão',
  closing,
  revealAt,
  rowsAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const labels = degrauRowLabels(wall);
  const layout = degrauLayout(labels.length);
  const reveal = degrauReveal(revealAt);
  const times = degrauRowTimes(reveal.wall, labels.length, rowsAt);
  const baseIn = enter(frame, fps, reveal.base, 0.5);
  const gap = enter(frame, fps, reveal.gap, 0.7);
  const closingIn = enter(frame, fps, reveal.closing, 0.4);
  const { person } = layout;
  const cap = 22;
  // a régua cresce de baixo (o topo da base) para cima (o topo do paredão)
  const tip = layout.gap.from - layout.gap.size * gap;
  const baseRoom = layout.base.width - 72;
  const rowRoom = layout.wall.width - ROW_PADDING * 2;
  const rowBase = Math.min(text.body, Math.max(MIN_TEXT, Math.floor(layout.rows[0]!.height * 0.5)));
  const pillRoom = layout.corridor.width - 40;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 52 }}>
      <Statement text={title} accent={accent} eyebrow={eyebrow} fontSize={titleSize(title, 80)} />
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        {/* chão comum: as duas alturas partem da mesma linha */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: layout.height + 6, height: 3, borderRadius: 2, background: theme.color.slate300, opacity: baseIn }} />

        <SceneCard
          progress={baseIn}
          padding="0 36px"
          style={{ position: 'absolute', left: layout.base.x, top: layout.base.y, width: layout.base.width, height: layout.base.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}
        >
          <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: fitFont(base.label, baseRoom, text.body, MIN_TEXT, CHAR.bold), lineHeight: 1.1, color: theme.color.slate900, ...CLIP }}>
            {base.label}
          </div>
          {base.hint ? (
            <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: MIN_TEXT, lineHeight: 1.1, color: theme.color.slate600, ...CLIP }}>{base.hint}</div>
          ) : null}
        </SceneCard>
        <IconBadge
          icon={iconOr(base.icon, 'user')!}
          variant="ink"
          size={person.size}
          progress={enter(frame, fps, reveal.base + 0.25, 0.5)}
          style={{ position: 'absolute', left: person.center[0] - person.size / 2, top: person.center[1] - person.size / 2 }}
        />

        {layout.rows.map((row, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: row.x,
              top: row.y,
              width: row.width,
              height: row.height,
              boxSizing: 'border-box',
              padding: `0 ${ROW_PADDING}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.panel,
              background: theme.color.slate900,
              boxShadow: theme.shadow.card,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: fitFont(labels[i]!, rowRoom, rowBase, MIN_TEXT, CHAR.bold),
              lineHeight: 1,
              color: theme.color.white,
              ...rise(enter(frame, fps, times[i]!, 0.45), 36),
            }}
          >
            <span style={CLIP}>{labels[i]}</span>
          </div>
        ))}

        {/* o vão: guias tracejadas na altura de cada topo e a régua em coral entre elas */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none" strokeLinecap="round">
          <line
            x1={layout.base.x + layout.base.width + 20}
            x2={layout.wall.x - 20}
            y1={layout.gap.from}
            y2={layout.gap.from}
            stroke={theme.color.slate300}
            strokeWidth={3}
            strokeDasharray="4 14"
            opacity={Math.min(1, gap * 3)}
          />
          <line x1={layout.gap.x - cap * 3} x2={layout.wall.x - 20} y1={layout.gap.to} y2={layout.gap.to} stroke={theme.color.slate300} strokeWidth={3} strokeDasharray="4 14" opacity={gap >= 0.98 ? 1 : 0} />
          <g stroke={theme.color.coral} strokeWidth={6} opacity={gap > 0 ? 1 : 0}>
            <line x1={layout.gap.x} x2={layout.gap.x} y1={layout.gap.from} y2={tip} />
            <line x1={layout.gap.x - cap} x2={layout.gap.x + cap} y1={layout.gap.from} y2={layout.gap.from} />
            <line x1={layout.gap.x - cap} x2={layout.gap.x + cap} y1={tip} y2={tip} />
          </g>
        </svg>
        <At point={layout.gap.label}>
          {/* fundo opaco: a pílula interrompe a régua em vez de deixar o traço passar por trás do texto */}
          <Pill fontSize={fitPill(gapLabel, pillRoom)} progress={enter(frame, fps, reveal.gap + 0.45)} style={{ background: theme.color.paper, ...pillClamp(pillRoom) }}>
            <span style={CLIP}>{gapLabel}</span>
          </Pill>
        </At>

        {closing ? (
          <At point={layout.closing}>
            <Pill variant="ink" icon="check" fontSize={fitPill(closing, pillRoom, 36, 'icon')} style={{ opacity: closingIn, scale: String(0.8 + 0.2 * popIn(frame, fps, reveal.closing, 0.4)), translate: '0px 0px', ...pillClamp(pillRoom) }}>
              <span style={CLIP}>{closing}</span>
            </Pill>
          </At>
        ) : null}
      </div>
    </SceneBackground>
  );
};

/** Caixa ocupada pela cena com estas props (título + palco + chão), para conferir contra a área útil sem renderizar. */
export function degrauExtent(props: DegrauEVaoProps = {}): Extent {
  const title = props.title ?? 'O que eu tenho e o que falta.';
  const layout = degrauLayout(degrauRowLabels(props.wall ?? DEFAULT_WALL).length);
  return { width: layout.width, height: statementHeight(title, titleSize(title, 80), { eyebrow: Boolean(props.eyebrow) }) + 52 + layout.height + 9 };
}

export const entry: ComponentEntry = {
  component: DegrauEVao,
  sample: {
    eyebrow: 'Primeira maratona',
    title: 'Correr 5 km não é correr 42.',
    base: { label: 'O que eu treinei', hint: '5 km, três vezes por semana', icon: 'user' },
    wall: { label: 'O que a prova pede', items: ['ritmo', 'fôlego', 'alimentação', 'cabeça'] },
    gapLabel: 'muito chão',
    closing: 'senti no km 12',
    revealAt: { base: 0.4, wall: 2.0, gap: 3.6, closing: 5.2 },
  },
  defaultDuration: 6.5,
  description:
    'Para a fala que mede a distância entre onde se está e onde é preciso chegar ("eu sabia o básico, e o mercado pedia muito mais"): ' +
    'uma base baixa com alguém em cima, um paredão que sobe fiada por fiada (cada exigência numa fiada) e a régua coral medindo o vão. ' +
    'Serve para júnior × vaga, orçamento × preço, protótipo × produção, treino × prova.',
  tags: ['comparação', 'degrau', 'vão', 'distância', 'antes-depois'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/DegrauMercado' },
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do título' },
    { name: 'title', type: 'string', description: 'a frase da cena' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral (a régua já é coral: use com parcimônia)' },
    { name: 'base', type: '{ label: string; hint?: string; icon?: IconName }', description: 'o lado baixo: o que se tem hoje (até ~24 letras), com a linha de apoio (até ~28) e quem está em cima' },
    { name: 'wall', type: '{ label: string; items?: string[] (0 a 6) }', description: 'o lado alto: o nome do paredão (fiada do topo) e uma exigência por fiada, de baixo para cima (até ~26 letras cada)' },
    { name: 'gapLabel', type: 'string', description: 'nome do vão, na régua coral (até ~18 letras; o excesso é cortado)' },
    { name: 'closing', type: 'string?', description: 'pílula de fecho no chão entre os dois lados (até ~16 letras; o excesso é cortado)' },
    { name: 'revealAt', type: '{ base?: number; wall?: number; gap?: number; closing?: number }', description: 'segundo em que entra cada parte: a base, o paredão, a régua do vão e o fecho' },
    { name: 'rowsAt', type: 'number[]?', description: 'segundo de cada fiada do paredão, de baixo para cima, para sincronizar com a fala; padrão: cascata a partir de revealAt.wall' },
  ],
};
