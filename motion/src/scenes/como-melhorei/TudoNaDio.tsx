import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { Arrow, Counter, enter, Pill, type Point, popIn, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';
import { GlyphBadge, type GlyphName } from './kit-b';

export type HubKey = 'courses' | 'bootcamps' | 'articles' | 'ranking';

export type TudoNaDioReveal = { hub: number } & Record<HubKey, number>;

export interface TudoNaDioProps {
  /** segundos relativos ao início da cena */
  revealAt?: TudoNaDioReveal;
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral */
  accent?: string;
  /** nome no centro do hub */
  hubLabel?: string;
  /** quantidade de bootcamps (o número conta até ela) */
  bootcamps?: number;
}

const DEFAULT_REVEAL: TudoNaDioReveal = { hub: 0.3, courses: 1.0, bootcamps: 1.5, articles: 2.0, ranking: 2.5 };
export const HUB_KEYS: HubKey[] = ['courses', 'bootcamps', 'articles', 'ranking'];

const CARDS: Record<HubKey, { glyph: GlyphName; title: string; hint: string }> = {
  courses: { glyph: 'book', title: 'Cursos', hint: 'back-end, front-end, mobile' },
  bootcamps: { glyph: 'flag', title: '', hint: 'bootcamps' },
  articles: { glyph: 'file', title: 'Artigos', hint: 'da comunidade' },
  ranking: { glyph: 'trophy', title: 'Ranking', hint: 'com prêmios' },
};

export interface HubNode {
  /** canto superior esquerdo do cartão */
  x: number;
  y: number;
  link: { from: Point; to: Point; bend: number };
}

export interface HubLayout {
  width: number;
  height: number;
  hub: { size: number; center: Point; ring: number };
  card: { width: number; height: number };
  nodes: Record<HubKey, HubNode>;
  /** topo da pílula de contagem, embaixo do hub */
  countY: number;
}

/** Hub no centro e um cartão em cada canto; cada ligação sai da borda do hub e chega na borda interna do cartão. */
export function hubLayout(width = 1728): HubLayout {
  const cardWidth = 610;
  const cardHeight = 236;
  const rowGap = 52;
  const height = cardHeight * 2 + rowGap;
  const hubSize = 200;
  const ring = hubSize / 2 + 22;
  const center: Point = [width / 2, height / 2];
  const reach = 22;

  const node = (left: boolean, top: boolean): HubNode => {
    const x = left ? 0 : width - cardWidth;
    const y = top ? 0 : cardHeight + rowGap;
    const to: Point = [left ? cardWidth + reach : width - cardWidth - reach, y + cardHeight / 2];
    const dx = to[0] - center[0];
    const dy = to[1] - center[1];
    const span = Math.hypot(dx, dy);
    const start = ring + 12;
    const from: Point = [center[0] + (dx / span) * start, center[1] + (dy / span) * start];
    // as quatro ligações curvam para fora do hub, como pétalas
    const bend = (left ? 1 : -1) * (top ? 1 : -1) * 14;
    return { x, y, link: { from, to, bend } };
  };

  return {
    width,
    height,
    hub: { size: hubSize, center, ring },
    card: { width: cardWidth, height: cardHeight },
    nodes: { courses: node(true, true), bootcamps: node(false, true), articles: node(true, false), ranking: node(false, false) },
    countY: center[1] + ring + 22,
  };
}

/** Quantas das quatro coisas já estão ligadas ao hub no instante `sec`. */
export function connectedCount(sec: number, revealAt: TudoNaDioReveal): number {
  return HUB_KEYS.filter((key) => sec >= revealAt[key]).length;
}

/** Texto da pílula de contagem: "2 de 4". */
export function countLabel(connected: number, total = HUB_KEYS.length): string {
  return `${Math.max(0, Math.min(total, connected))} de ${total}`;
}

/** Recapitulação: tudo o que apareceu antes, ligado a um único hub (a DIO). */
export const TudoNaDio: React.FC<TudoNaDioProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  eyebrow = 'Digital Innovation One',
  title = 'Tudo isso, num lugar só.',
  accent = 'num lugar só',
  hubLabel = 'DIO',
  bootcamps = 174,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = hubLayout();
  const hub = enter(frame, fps, revealAt.hub, 0.5);
  const hubPop = popIn(frame, fps, revealAt.hub, 0.5);
  const ring = enter(frame, fps, revealAt.hub + 0.2, 0.8);
  const connected = connectedCount(frame / fps, revealAt);
  const first = Math.min(...HUB_KEYS.map((key) => revealAt[key]));
  const half = layout.hub.size / 2;
  const [cx, cy] = layout.hub.center;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 48 }}>
      <Statement text={title} accent={accent} eyebrow={eyebrow} fontSize={80} />

      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        {HUB_KEYS.map((key) => (
          <Arrow key={key} {...layout.nodes[key].link} progress={enter(frame, fps, revealAt[key], 0.5)} />
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
            fontSize: 60,
            letterSpacing: '0.02em',
            color: theme.color.white,
            opacity: hub,
            scale: String(0.8 + 0.2 * hubPop),
          }}
        >
          {hubLabel}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: layout.countY, display: 'flex', justifyContent: 'center' }}>
          <Pill variant="emerald" dot progress={enter(frame, fps, first + 0.2)} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {countLabel(Math.max(1, connected))}
          </Pill>
        </div>

        {HUB_KEYS.map((key) => {
          const card = CARDS[key];
          const node = layout.nodes[key];
          const at = revealAt[key] + 0.25;
          const progress = enter(frame, fps, at, 0.5);
          return (
            <SceneCard
              key={key}
              progress={progress}
              padding="0 40px"
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: layout.card.width,
                height: layout.card.height,
                display: 'flex',
                alignItems: 'center',
                gap: 32,
              }}
            >
              <GlyphBadge glyph={card.glyph} size={120} progress={enter(frame, fps, at + 0.08, 0.5)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {key === 'bootcamps' ? (
                  <Counter to={bootcamps} atSec={at} durationSec={0.9} fontSize={72} />
                ) : (
                  <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: text.cardTitle, lineHeight: 1.1, color: theme.color.slate900 }}>
                    {card.title}
                  </div>
                )}
                <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: text.label, lineHeight: 1.25, color: theme.color.slate600 }}>{card.hint}</div>
              </div>
            </SceneCard>
          );
        })}
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: TudoNaDio,
  sample: { revealAt: DEFAULT_REVEAL, bootcamps: 174 },
  defaultDuration: 5,
  description:
    'Cena papel de recapitulação: um hub "DIO" no centro ligando cursos, 174 bootcamps, artigos da comunidade e ranking com prêmios, na ordem da fala.',
};

export const MODEL = 'HubComSatelites';
