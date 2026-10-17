import { interpolateColors, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, enter, IconBadge, type IconName, Pill, SceneBackground, SceneCard, Statement, window as presenceWindow } from '../../scene-kit';
import { TechMark } from '../../tech/glyph';
import { theme } from '../../theme';

export type StackKey = 'html' | 'css' | 'bootstrap' | 'javascript' | 'php' | 'mysql';

export interface StackInicialProps {
  /** segundos relativos ao início da cena: cada tecnologia entra quando a fala a cita */
  revealAt?: {
    html: number;
    css: number;
    bootstrap: number;
    javascript: number;
    /** "back-end": entra o segundo cartão, ainda vazio */
    backend: number;
    php: number;
    mysql: number;
  };
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral */
  accent?: string;
  /** rótulo que flutua sobre o cartão do back-end ("até algumas coisinhas") */
  backendNote?: string;
}

type Reveal = NonNullable<StackInicialProps['revealAt']>;

const DEFAULT_REVEAL: Reveal = { html: 0.9, css: 1.6, bootstrap: 2.3, javascript: 3.2, backend: 5.0, php: 6.0, mysql: 6.8 };

export interface StackItem {
  key: StackKey;
  name: string;
  hint: string;
}

export interface StackGroup {
  key: 'front' | 'back';
  title: string;
  icon: IconName;
  items: StackItem[];
}

/** As tecnologias na ordem da fala. O primeiro item de cada grupo fica na base da pilha. */
export const STACK_GROUPS: StackGroup[] = [
  {
    key: 'front',
    title: 'Front-end',
    icon: 'browser',
    items: [
      { key: 'html', name: 'HTML', hint: 'estrutura' },
      { key: 'css', name: 'CSS', hint: 'estilo' },
      { key: 'bootstrap', name: 'Bootstrap', hint: 'layout pronto' },
      { key: 'javascript', name: 'JavaScript', hint: 'interação' },
    ],
  },
  {
    key: 'back',
    title: 'Back-end',
    icon: 'server',
    items: [
      { key: 'php', name: 'PHP', hint: 'servidor' },
      { key: 'mysql', name: 'MySQL', hint: 'banco de dados' },
    ],
  },
];

export interface StackCardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  /** y (dentro do cartão) de cada item, na ordem da fala: o primeiro é o de baixo */
  tiles: number[];
}

export interface StackLayout {
  width: number;
  height: number;
  padding: number;
  header: number;
  tile: { height: number; gap: number };
  cards: StackCardLayout[];
}

/** Dois cartões alinhados pela base: a altura de cada um acompanha quantas tecnologias ele empilha. */
export function stackLayout(counts: number[] = STACK_GROUPS.map((group) => group.items.length), width = 1640): StackLayout {
  const gap = 44;
  const padding = 40;
  const header = 108;
  const tile = { height: 92, gap: 16 };
  const cardHeight = (count: number) => padding * 2 + header + count * tile.height + Math.max(0, count - 1) * tile.gap;
  const height = Math.max(...counts.map(cardHeight));
  // o grupo do front é o maior: fica com a maior parte da largura
  const shares = counts.length === 2 ? [0.55, 0.45] : counts.map(() => 1 / counts.length);
  const usable = width - gap * (counts.length - 1);
  let x = 0;
  const cards = counts.map((count, i) => {
    // o último fica com o resto: a soma fecha exatamente na largura pedida
    const cardWidth = i === counts.length - 1 ? width - x : Math.round(usable * shares[i]!);
    const own = cardHeight(count);
    const card: StackCardLayout = {
      x,
      y: height - own,
      width: cardWidth,
      height: own,
      tiles: Array.from({ length: count }, (_, j) => own - padding - (j + 1) * tile.height - j * tile.gap),
    };
    x += cardWidth + gap;
    return card;
  });
  return { width, height, padding, header, tile, cards };
}

/** Quando cada cartão entra: o do front um pouco antes do primeiro item; o do back na palavra "back-end". */
export function stackCardTimes(revealAt: Reveal): { front: number; back: number } {
  return { front: Math.max(0, revealAt.html - 0.55), back: revealAt.backend };
}

/**
 * Janela em que um item fica em destaque (tinta): do momento em que é citado até o próximo ser citado,
 * no máximo por `holdSec` (a fala pode demorar para chegar no próximo).
 */
export function highlightWindow(key: StackKey, revealAt: Reveal, holdSec = 1.2): { from: number; to: number } {
  const order = STACK_GROUPS.flatMap((group) => group.items.map((item) => item.key));
  const from = revealAt[key];
  const later = order.map((other) => revealAt[other]).filter((time) => time > from);
  return { from, to: Math.min(from + holdSec, ...later) };
}

const Tile: React.FC<{ item: StackItem; top: number; layout: StackLayout; revealAt: Reveal }> = ({ item, top, layout, revealAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = enter(frame, fps, revealAt[item.key], 0.45);
  const { from, to } = highlightWindow(item.key, revealAt);
  const hot = presenceWindow(frame, from, to + 0.3, fps, 0.3);
  const mix = (cold: string, warm: string) => interpolateColors(hot, [0, 1], [cold, warm]);

  return (
    <div
      style={{
        position: 'absolute',
        left: layout.padding,
        right: layout.padding,
        top,
        height: layout.tile.height,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '0 32px',
        borderRadius: theme.radius.panel,
        background: mix(alpha(theme.color.white, 0.9), theme.color.slate900),
        border: `2px solid ${mix(theme.color.slate300, theme.color.slate900)}`,
        opacity: progress,
        // cai de cima e pousa na pilha
        translate: `0px ${((progress - 1) * 48).toFixed(2)}px`,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 20, fontFamily: theme.font.body, fontWeight: 600, fontSize: 44, lineHeight: 1, color: mix(theme.color.slate900, theme.color.white), whiteSpace: 'nowrap' }}>
        {/* o logo identifica a tecnologia; na faixa acesa (fundo escuro) ele troca para a tinta que contrasta */}
        <TechMark icon={`tech:${item.key}`} size={48} surface={hot > 0.5 ? 'dark' : 'light'} progress={progress} />
        {item.name}
      </span>
      <span style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: 34, lineHeight: 1, color: mix(theme.color.slate600, theme.color.slate300), whiteSpace: 'nowrap' }}>
        {item.hint}
      </span>
    </div>
  );
};

/** A stack que ele tinha ao se formar: front-end empilha item a item; depois o back-end, menor, com PHP e MySQL. */
export const StackInicial: React.FC<StackInicialProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  eyebrow = 'Recém-formado',
  title = 'A stack que eu tinha.',
  accent = 'eu tinha',
  backendNote = 'e até umas coisinhas',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = stackLayout();
  const times = stackCardTimes(revealAt);
  const cardTimes = [times.front, times.back];
  const back = layout.cards[1]!;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
      <Statement text={title} accent={accent} eyebrow={eyebrow} fontSize={76} />
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        {STACK_GROUPS.map((group, i) => {
          const card = layout.cards[i]!;
          const progress = enter(frame, fps, cardTimes[i]!, 0.5);
          return (
            <SceneCard
              key={group.key}
              progress={progress}
              padding={0}
              style={{ position: 'absolute', left: card.x, top: card.y, width: card.width, height: card.height }}
            >
              <div style={{ position: 'absolute', left: layout.padding, top: layout.padding, height: 80, display: 'flex', alignItems: 'center', gap: 24 }}>
                <IconBadge icon={group.icon} size={80} progress={enter(frame, fps, cardTimes[i]! + 0.1, 0.5)} />
                <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: 56, lineHeight: 1, color: theme.color.slate900 }}>{group.title}</div>
              </div>
              {group.items.map((item, j) => (
                <Tile key={item.key} item={item} top={card.tiles[j]!} layout={layout} revealAt={revealAt} />
              ))}
            </SceneCard>
          );
        })}
        {/* o espaço acima do cartão menor carrega o "até algumas coisinhas" da fala */}
        <div style={{ position: 'absolute', left: back.x, width: back.width, top: 0, height: back.y, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Pill progress={enter(frame, fps, revealAt.backend + 0.25)}>{backendNote}</Pill>
        </div>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: StackInicial,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 8,
  description:
    'Cena papel: as tecnologias que ele sabia ao se formar, empilhando uma a uma em dois grupos. Front-end (HTML, CSS, Bootstrap, JavaScript) e, menor, back-end (PHP, MySQL).',
};

export const MODEL = 'PilhaEmDoisGrupos';
