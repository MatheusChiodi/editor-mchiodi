import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { enter, Pill, type Point, rise, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';
import { GlyphBadge, type GlyphName } from './kit-b';

export interface AlfredDioReveal {
  /** "DIO": entra o título */
  name: number;
  /** "o meu Alfred": entra o sino de serviço e a bandeja */
  alfred: number;
  /** cada item servido, na ordem da fala */
  item1: number;
  item2: number;
  item3: number;
  item4: number;
}

export interface AlfredDioProps {
  /** segundos relativos ao início da cena */
  revealAt?: AlfredDioReveal;
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral */
  accent?: string;
  /** os quatro itens servidos */
  items?: [string, string, string, string];
  /** pílula de fecho, depois do último item */
  closing?: string;
}

const DEFAULT_REVEAL: AlfredDioReveal = { name: 0.3, alfred: 2.0, item1: 3.4, item2: 4.0, item3: 4.6, item4: 5.2 };
const ITEM_GLYPHS: GlyphName[] = ['book', 'flag', 'users', 'chat'];
/** quanto tempo o sino "vibra" depois de cada item servido */
export const DING_SEC = 0.5;
const ROW_GAP = 56;
const CLOSING_GAP = 44;

/** Os tempos dos quatro itens, na ordem em que são servidos. */
export function serveTimes(revealAt: AlfredDioReveal): number[] {
  return [revealAt.item1, revealAt.item2, revealAt.item3, revealAt.item4];
}

/** Quantos itens já estão na bandeja no instante `sec`. */
export function servedCount(sec: number, times: number[]): number {
  return times.filter((time) => sec >= time).length;
}

/** Força 1→0 do toque do sino: bate a cada item servido e decai em `decaySec`. */
export function dingStrength(sec: number, times: number[], decaySec = DING_SEC): number {
  let strength = 0;
  for (const time of times) {
    const elapsed = sec - time;
    if (elapsed >= 0 && elapsed < decaySec) strength = Math.max(strength, 1 - elapsed / decaySec);
  }
  return strength;
}

export interface ServeLayout {
  width: number;
  height: number;
  bell: { size: number; center: Point; labelY: number };
  card: { width: number; height: number };
  /** x do canto esquerdo de cada cartão */
  cardX: number[];
  tray: { x: number; y: number; width: number; lip: number };
}

/** Sino à esquerda e a bandeja à direita, com os cartões lado a lado em cima dela. */
export function serveLayout(width = 1728, count = 4): ServeLayout {
  const bellSize = 200;
  const cardHeight = 268;
  const gap = 28;
  const inset = 28;
  const lip = 18;
  const trayX = bellSize + 64;
  const trayWidth = width - trayX;
  const cardWidth = (trayWidth - inset * 2 - gap * (count - 1)) / count;
  const trayY = cardHeight + 18;
  return {
    width,
    height: trayY + lip + 6,
    bell: { size: bellSize, center: [bellSize / 2, bellSize / 2], labelY: bellSize + 18 },
    card: { width: cardWidth, height: cardHeight },
    cardX: Array.from({ length: count }, (_, index) => trayX + inset + index * (cardWidth + gap)),
    tray: { x: trayX, y: trayY, width: trayWidth, lip },
  };
}

/** Path da bandeja: uma linha com as duas bordas levantadas. */
export function trayPath(tray: ServeLayout['tray']): string {
  const { x, y, width, lip } = tray;
  return `M${x} ${y} q0 ${lip} ${lip} ${lip} H${x + width - lip} q${lip} 0 ${lip} ${-lip}`;
}

/** A DIO como o "Alfred": um sino de serviço e uma bandeja que recebe, um a um, o que ele precisava. */
export const AlfredDio: React.FC<AlfredDioProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  eyebrow = 'Digital Innovation One',
  title = 'DIO — o meu Alfred',
  accent = 'Alfred',
  items = ['Cursos', 'Bootcamps', 'Comunidade', 'Mentoria'],
  closing = 'tudo que eu precisava',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const layout = serveLayout();
  const times = serveTimes(revealAt);
  const bell = enter(frame, fps, revealAt.alfred, 0.5);
  const tray = enter(frame, fps, revealAt.alfred + 0.25, 0.7);
  const ding = dingStrength(sec, times);
  const closingAt = revealAt.item4 + 0.6;
  // até o sino entrar, o título fica no centro da área útil; depois sobe e abre espaço para a bandeja
  const lift = (1 - enter(frame, fps, revealAt.alfred - 0.4, 0.7)) * ((layout.height + ROW_GAP + CLOSING_GAP + 70) / 2);
  const half = layout.bell.size / 2;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ translate: `0px ${lift.toFixed(2)}px` }}>
        <Statement text={title} accent={accent} eyebrow={eyebrow} atSec={revealAt.name} fontSize={96} />
      </div>

      <div style={{ position: 'relative', width: layout.width, height: layout.height, marginTop: ROW_GAP }}>
        {/* ondas do toque: aparecem a cada item servido e somem sozinhas */}
        <svg
          width={layout.bell.size + 80}
          height={layout.bell.size + 80}
          viewBox="-40 -40 280 280"
          style={{ position: 'absolute', left: -40, top: -40, opacity: ding * bell, scale: String(1 + (1 - ding) * 0.08) }}
          fill="none"
          stroke={theme.color.slate600}
          strokeWidth={5}
          strokeLinecap="round"
        >
          <path d="M-12 62a118 118 0 0 1 40 -62" />
          <path d="M212 62a118 118 0 0 0 -40 -62" />
        </svg>
        <GlyphBadge
          glyph="bell"
          variant="ink"
          size={layout.bell.size}
          progress={bell}
          style={{ position: 'absolute', left: layout.bell.center[0] - half, top: layout.bell.center[1] - half - ding * 6 }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: layout.bell.size,
            top: layout.bell.labelY,
            textAlign: 'center',
            fontFamily: theme.font.body,
            fontWeight: 600,
            fontSize: text.label,
            lineHeight: 1.2,
            color: theme.color.slate900,
            ...rise(enter(frame, fps, revealAt.alfred + 0.15), 16),
          }}
        >
          ao meu dispor
        </div>

        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none">
          <path
            d={trayPath(layout.tray)}
            stroke={theme.color.slate900}
            strokeWidth={6}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - tray}
            opacity={tray > 0 ? 1 : 0}
          />
        </svg>

        {items.map((item, index) => {
          const progress = enter(frame, fps, times[index] ?? 0, 0.45);
          return (
            <SceneCard
              key={item}
              progress={progress}
              padding="28px 20px"
              style={{
                position: 'absolute',
                left: layout.cardX[index],
                top: 0,
                width: layout.card.width,
                height: layout.card.height,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 26,
                // servido de cima: o cartão pousa na bandeja em vez de subir
                translate: `0px ${(-(1 - progress) * 36).toFixed(2)}px`,
              }}
            >
              <GlyphBadge glyph={ITEM_GLYPHS[index] ?? 'check'} size={112} progress={enter(frame, fps, (times[index] ?? 0) + 0.08, 0.5)} />
              <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: text.body, lineHeight: 1.15, color: theme.color.slate900 }}>{item}</div>
            </SceneCard>
          );
        })}
      </div>

      <div style={{ marginTop: CLOSING_GAP }}>
        <Pill variant="emerald" dot progress={enter(frame, fps, closingAt)}>
          {closing}
        </Pill>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: AlfredDio,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 7,
  description:
    'Cena papel: a DIO como "o meu Alfred". Título, depois um sino de serviço e uma bandeja que recebe, um a um, cursos, bootcamps, comunidade e mentoria.',
};

export const MODEL = 'FileiraDeItens';
