// MODELO de animação reutilizável: na EDL entra como `scene:modelos/HubComSatelites`, em qualquer vídeo.
// Forma: um disco no centro e de 2 a 6 cartões em volta (metade de cada lado), cada um ligado ao centro por uma seta, na ordem da fala.

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { Arrow, Counter, enter, Icon, IconBadge, type IconName, Pill, type Point, popIn, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';
import { CHAR, clampInt, CLIP, type Extent, fitFont, fitPill, iconOr, MIN_TEXT, pillClamp, sequence, statementHeight, timeOr, titleSize } from './kit-a';

export interface HubCenter {
  /** sigla ou nome curto no disco (até ~8 letras); sem ele, vale o ícone */
  label?: string;
  icon?: IconName;
}

export interface HubSatellite {
  title: string;
  /** linha de apoio */
  hint?: string;
  icon?: IconName;
  /** número que conta até este valor no lugar do título (o `title` vira a unidade, embaixo) */
  value?: number;
}

export interface HubComSatelitesProps {
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral: o único acento da tela */
  accent?: string;
  hub?: HubCenter;
  /** segundo em que o centro entra */
  hubAt?: number;
  /** de 2 a 6 partes, na ordem da fala: ímpares à esquerda, pares à direita, de cima para baixo */
  satellites?: HubSatellite[];
  /** segundo (relativo ao início da cena) em que cada parte se liga ao centro, por índice; o que faltar segue em sequência */
  revealAt?: number[];
  /** pílula embaixo do centro contando as partes já ligadas ("2 de 4") */
  showCount?: boolean;
  /** pílula de fecho embaixo do centro: toma o lugar da contagem quando entra */
  closing?: string;
  closingAt?: number;
}

export const HUB_MIN = 2;
export const HUB_MAX = 6;
const STAGE_HEIGHT = 524;
const CARD_WIDTH = 610;

const DEFAULT_HUB: HubCenter = { icon: 'bolt' };
const DEFAULT_SATELLITES: HubSatellite[] = [
  { title: 'Primeira parte', icon: 'gear' },
  { title: 'Segunda parte', icon: 'code' },
  { title: 'Terceira parte', icon: 'check' },
  { title: 'Quarta parte', icon: 'cloud' },
];

export interface HubNode {
  /** canto superior esquerdo do cartão */
  x: number;
  y: number;
  side: 'left' | 'right';
  row: number;
  link: { from: Point; to: Point; bend: number };
}

export interface HubLayout {
  width: number;
  height: number;
  hub: { size: number; center: Point; ring: number };
  card: { width: number; height: number; badge: number; vertical: boolean; hintLines: number };
  /** corredor livre entre as duas colunas de cartões */
  corridor: number;
  nodes: HubNode[];
  /** topo da pílula embaixo do centro */
  pillY: number;
  /** largura máxima dessa pílula: com mais de uma linha de cartões, as setas de baixo passam ao lado dela */
  pillRoom: number;
}

/**
 * Centro no meio e as partes em duas colunas: a parte i vai para a esquerda (i par) ou direita (i ímpar), na linha i/2.
 * Com 2 partes os cartões são altos (ícone em cima); com 3 a 6 são baixos e largos, e encolhem para caber 3 linhas por lado.
 */
export function hubLayout(count: number, width = 1728): HubLayout {
  const total = clampInt(count, HUB_MIN, HUB_MAX);
  const height = STAGE_HEIGHT;
  const hubSize = 200;
  const ring = hubSize / 2 + 22;
  const center: Point = [width / 2, height / 2];
  const reach = 22;
  const rows = { left: Math.ceil(total / 2), right: Math.floor(total / 2) };
  const maxRows = Math.max(rows.left, rows.right);
  const vertical = maxRows === 1;
  const rowGap = maxRows >= 3 ? 28 : 52;
  const cardHeight = vertical ? 400 : (height - rowGap * (maxRows - 1)) / maxRows;
  const nodes: HubNode[] = Array.from({ length: total }, (_, index) => {
    const side = index % 2 === 0 ? 'left' : 'right';
    const row = Math.floor(index / 2);
    const columnHeight = rows[side] * cardHeight + (rows[side] - 1) * rowGap;
    const x = side === 'left' ? 0 : width - CARD_WIDTH;
    const y = (height - columnHeight) / 2 + row * (cardHeight + rowGap);
    const to: Point = [side === 'left' ? CARD_WIDTH + reach : width - CARD_WIDTH - reach, y + cardHeight / 2];
    const dx = to[0] - center[0];
    const dy = to[1] - center[1];
    const span = Math.hypot(dx, dy);
    const start = ring + 12;
    const from: Point = [center[0] + (dx / span) * start, center[1] + (dy / span) * start];
    // as ligações curvam para fora do centro, como pétalas; a que sai na horizontal fica reta
    const bend = (side === 'left' ? 1 : -1) * Math.sign(Math.round(center[1] - to[1])) * 14 || 0;
    return { x, y, side, row, link: { from, to, bend } };
  });
  return {
    width,
    height,
    hub: { size: hubSize, center, ring },
    card: { width: CARD_WIDTH, height: cardHeight, badge: vertical ? 112 : maxRows >= 3 ? 96 : 120, vertical, hintLines: maxRows >= 3 ? 1 : 2 },
    corridor: width - CARD_WIDTH * 2,
    nodes,
    pillY: center[1] + ring + 22,
    pillRoom: vertical ? width - CARD_WIDTH * 2 - 48 : 340,
  };
}

/** Segundo em que cada parte se liga ao centro. */
export function hubTimes(count: number, revealAt?: readonly number[]): number[] {
  return sequence(clampInt(count, HUB_MIN, HUB_MAX), revealAt, 1.0, 0.5);
}

/** Quantas partes já estão ligadas no instante `sec`. */
export function hubConnected(sec: number, times: readonly number[]): number {
  return times.filter((time) => sec >= time).length;
}

/** Texto da pílula de contagem: "2 de 4". */
export function hubCountLabel(connected: number, total: number): string {
  return `${Math.max(0, Math.min(total, connected))} de ${total}`;
}

/** Largura do texto dentro de um cartão: ao lado do ícone (cartão baixo) ou na largura toda (cartão alto). */
export function hubTextRoom(layout: HubLayout, hasIcon: boolean): number {
  const padding = layout.card.vertical ? 44 : 40;
  return layout.card.width - padding * 2 - (hasIcon && !layout.card.vertical ? layout.card.badge + 32 : 0);
}

export const HubComSatelites: React.FC<HubComSatelitesProps & BaseProps> = ({
  eyebrow,
  title = 'Tudo ligado a um centro.',
  accent,
  hub = DEFAULT_HUB,
  hubAt = 0.3,
  satellites = DEFAULT_SATELLITES,
  revealAt,
  showCount = true,
  closing,
  closingAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = satellites.slice(0, HUB_MAX);
  const layout = hubLayout(shown.length);
  const times = hubTimes(shown.length, revealAt);
  const hubIn = enter(frame, fps, hubAt, 0.5);
  const hubPop = popIn(frame, fps, hubAt, 0.5);
  const ring = enter(frame, fps, hubAt + 0.2, 0.8);
  const connected = hubConnected(frame / fps, times);
  const first = Math.min(...times);
  const closingSec = timeOr(closingAt, Math.max(...times) + 0.9);
  const closingIn = closing ? enter(frame, fps, closingSec) : 0;
  const half = layout.hub.size / 2;
  const [cx, cy] = layout.hub.center;
  const hubIcon = iconOr(hub.icon, 'bolt')!;
  const { card } = layout;
  const titleBase = card.vertical ? text.cardTitle : card.hintLines === 1 ? 48 : text.cardTitle;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 48 }}>
      <Statement text={title} accent={accent} eyebrow={eyebrow} fontSize={titleSize(title, 80)} />

      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        {layout.nodes.map((node, index) => (
          <Arrow key={index} {...node.link} progress={enter(frame, fps, times[index]!, 0.5)} />
        ))}

        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none">
          <circle
            cx={cx}
            cy={cy}
            r={layout.hub.ring}
            stroke={theme.color.slate300}
            strokeWidth={4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - ring}
            opacity={ring > 0 ? 1 : 0}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: cx - half,
            top: cy - half,
            width: layout.hub.size,
            height: layout.hub.size,
            borderRadius: theme.radius.pill,
            background: theme.color.slate900,
            boxShadow: theme.shadow.raised,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: hub.label ? fitFont(hub.label, layout.hub.size - 44, 60, MIN_TEXT, 0.66) : 60,
            letterSpacing: '0.02em',
            color: theme.color.white,
            whiteSpace: 'nowrap',
            opacity: hubIn,
            scale: String(0.8 + 0.2 * hubPop),
          }}
        >
          {hub.label ? hub.label : <Icon name={hubIcon} size={layout.hub.size * 0.48} color={theme.color.white} draw={hubIn} />}
        </div>

        {/* embaixo do centro: a contagem das partes já ligadas e, quando chega, o fecho no lugar dela */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: layout.pillY, display: 'grid', justifyItems: 'center' }}>
          {showCount ? (
            <div style={{ gridArea: '1 / 1', opacity: 1 - closingIn }}>
              <Pill variant="emerald" dot progress={enter(frame, fps, first + 0.2)} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {hubCountLabel(Math.max(1, connected), shown.length)}
              </Pill>
            </div>
          ) : null}
          {closing ? (
            <div style={{ gridArea: '1 / 1' }}>
              <Pill variant="emerald" dot fontSize={fitPill(closing, layout.pillRoom, 36, 'dot')} progress={closingIn} style={pillClamp(layout.pillRoom)}>
                <span style={CLIP}>{closing}</span>
              </Pill>
            </div>
          ) : null}
        </div>

        {shown.map((satellite, index) => {
          const node = layout.nodes[index]!;
          const at = times[index]! + 0.25;
          const icon = iconOr(satellite.icon);
          const room = hubTextRoom(layout, Boolean(icon));
          const counted = typeof satellite.value === 'number' && Number.isFinite(satellite.value);
          return (
            <SceneCard
              key={index}
              progress={enter(frame, fps, at, 0.5)}
              padding={card.vertical ? '40px 44px' : '0 40px'}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: card.width,
                height: card.height,
                display: 'flex',
                flexDirection: card.vertical ? 'column' : 'row',
                alignItems: card.vertical ? 'flex-start' : 'center',
                justifyContent: card.vertical ? 'center' : 'flex-start',
                gap: card.vertical ? 22 : 32,
              }}
            >
              {icon ? <IconBadge icon={icon} size={card.badge} progress={enter(frame, fps, at + 0.08, 0.5)} /> : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: card.hintLines === 1 ? 6 : 10, width: room }}>
                {counted ? (
                  <>
                    <Counter to={satellite.value!} atSec={at} durationSec={0.9} fontSize={card.hintLines === 1 ? 60 : 72} />
                    <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: fitFont(satellite.title, room, text.label), lineHeight: 1.25, color: theme.color.slate600, ...CLIP }}>{satellite.title}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: fitFont(satellite.title, room, titleBase, 40, CHAR.display), lineHeight: 1.15, color: theme.color.slate900, ...CLIP }}>
                      {satellite.title}
                    </div>
                    {satellite.hint ? (
                      <div
                        style={{
                          fontFamily: theme.font.body,
                          fontWeight: 500,
                          fontSize: card.hintLines === 1 ? MIN_TEXT : text.label,
                          lineHeight: 1.25,
                          color: theme.color.slate600,
                          // o apoio quebra até o que o cartão comporta; o que passar disso é cortado com reticências
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: card.hintLines,
                          overflow: 'hidden',
                        }}
                      >
                        {satellite.hint}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </SceneCard>
          );
        })}
      </div>
    </SceneBackground>
  );
};

const SAMPLE_SATELLITES: HubSatellite[] = [
  { title: 'Site', hint: 'React', icon: 'browser' },
  { title: 'Aplicativo', hint: 'React Native', icon: 'phone' },
  { title: 'Painel', hint: 'só para o time', icon: 'gear' },
  { title: 'clientes', value: 38, icon: 'users' },
  { title: 'Relatórios', hint: 'PDF toda segunda', icon: 'file' },
];

/** Caixa ocupada pela cena com estas props (título + palco), para conferir contra a área útil sem renderizar. */
export function hubExtent(props: HubComSatelitesProps = {}): Extent {
  const title = props.title ?? 'Tudo ligado a um centro.';
  const layout = hubLayout((props.satellites ?? DEFAULT_SATELLITES).length);
  return { width: layout.width, height: statementHeight(title, titleSize(title, 80), { eyebrow: Boolean(props.eyebrow) }) + 48 + layout.height };
}

export const entry: ComponentEntry = {
  component: HubComSatelites,
  sample: {
    eyebrow: 'Um back-end só',
    title: 'Cinco pontas, uma API.',
    accent: 'uma API',
    hub: { label: 'API' },
    hubAt: 0.3,
    satellites: SAMPLE_SATELLITES,
    revealAt: [1.0, 1.5, 2.0, 2.5, 3.0],
    showCount: true,
    closing: 'tudo conversa',
    closingAt: 4.2,
  },
  defaultDuration: 6,
  description:
    'Para a fala que junta várias coisas em volta de uma só ("tudo isso num lugar só", "a mesma pessoa faz os dois", "um serviço atende todo mundo"): ' +
    'um disco no centro e de 2 a 6 cartões que se ligam a ele um a um, com a contagem embaixo. Com 2 partes vira "um no meio, duas pontas". ' +
    'Serve para recapitular o que já apareceu no vídeo, um produto e seus módulos, uma API e seus clientes, um time e suas áreas.',
  tags: ['hub', 'centro', 'partes', 'recapitulação', 'diagrama'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/TudoNaDio' },
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do título' },
    { name: 'title', type: 'string', description: 'a frase da cena' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral' },
    { name: 'hub', type: '{ label?: string; icon?: IconName }', description: 'o centro: uma sigla ou nome curto (até ~8 letras) ou um ícone' },
    { name: 'hubAt', type: 'number?', description: 'segundo em que o centro entra' },
    { name: 'satellites', type: '{ title: string; hint?: string; icon?: IconName; value?: number }[] (2 a 6)', description: 'as partes, na ordem da fala (esquerda, direita, esquerda…); com `value` o cartão conta até o número e `title` vira a unidade' },
    { name: 'revealAt', type: 'number[]', description: 'segundo em que cada parte se liga ao centro, por índice; o que faltar segue em sequência' },
    { name: 'showCount', type: 'boolean?', description: 'pílula "2 de 4" embaixo do centro, contando as partes ligadas (padrão: sim)' },
    { name: 'closing', type: 'string?', description: 'pílula de fecho embaixo do centro; toma o lugar da contagem (até ~18 letras)' },
    { name: 'closingAt', type: 'number?', description: 'segundo em que o fecho entra' },
  ],
};
