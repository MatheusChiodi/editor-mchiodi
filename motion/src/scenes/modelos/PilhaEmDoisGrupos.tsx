// MODELO de animação reutilizável: na EDL entra como `scene:modelos/PilhaEmDoisGrupos`, em qualquer vídeo.
// Forma: dois cartões lado a lado, alinhados pela base; os itens de cada um empilham de baixo para cima, na ordem da fala.

import { interpolateColors, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, enter, IconBadge, type IconName, Pill, SceneBackground, SceneCard, Statement, window as presenceWindow } from '../../scene-kit';
import { theme } from '../../theme';
import { CHAR, clampInt, CLIP, type Extent, fitFont, fitPill, iconOr, MIN_TEXT, pillClamp, sequence, statementHeight, textWidth, timeOr, titleSize } from './kit-a';

export interface PilhaItem {
  label: string;
  /** palavra de apoio, à direita do nome */
  hint?: string;
}

export interface PilhaGroup {
  title: string;
  icon?: IconName;
  /** de 1 a 5 itens, na ordem da fala: o primeiro fica na base da pilha */
  items: PilhaItem[];
}

export interface PilhaEmDoisGruposProps {
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral: o único acento da tela */
  accent?: string;
  /** os dois grupos, na ordem da fala (o que tem mais itens fica com o cartão mais largo) */
  groups?: PilhaGroup[];
  /** segundo (relativo ao início da cena) em que cada item entra, por grupo e por índice; o que faltar segue em sequência */
  revealAt?: number[][];
  /** segundo em que o cartão de cada grupo entra (padrão: um pouco antes do primeiro item dele) */
  groupAt?: number[];
  /** rótulo solto sobre o cartão mais baixo: o comentário da fala sobre aquele grupo */
  note?: string;
  noteAt?: number;
}

export const PILHA_MAX_GROUPS = 2;
export const PILHA_MAX_ITEMS = 5;
const TILE_PADDING = 32;
const TILE_GAP = 24;
const BADGE = 80;

const DEFAULT_GROUPS: PilhaGroup[] = [
  { title: 'Primeiro grupo', icon: 'bolt', items: [{ label: 'Item um' }, { label: 'Item dois' }, { label: 'Item três' }] },
  { title: 'Segundo grupo', icon: 'gear', items: [{ label: 'Item um' }, { label: 'Item dois' }] },
];

export interface PilhaCardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  /** y (dentro do cartão) de cada item, na ordem da fala: o primeiro é o de baixo */
  tiles: number[];
}

export interface PilhaLayout {
  width: number;
  height: number;
  padding: number;
  header: number;
  tile: { height: number; gap: number };
  cards: PilhaCardLayout[];
  /** índice do cartão mais baixo (no empate, o último): é sobre ele que a nota flutua */
  short: number;
  /** espaço livre acima do cartão mais baixo, onde a nota entra */
  note: { x: number; y: number; width: number; height: number };
}

/** Quantos itens de cada grupo entram: no máximo dois grupos, de 1 a 5 itens cada. */
export function pilhaCounts(groups: readonly { items: readonly unknown[] }[]): number[] {
  return groups.slice(0, PILHA_MAX_GROUPS).map((group) => clampInt(group.items.length, 1, PILHA_MAX_ITEMS));
}

/**
 * Dois cartões alinhados pela base: a altura de cada um acompanha quantos itens ele empilha, e as peças encolhem
 * para a pilha mais alta (e a nota, se houver) caber em `maxHeight`.
 */
export function pilhaLayout(counts: readonly number[], hasNote = false, width = 1640, maxHeight = 604): PilhaLayout {
  const list = counts.slice(0, PILHA_MAX_GROUPS).map((count) => clampInt(count, 1, PILHA_MAX_ITEMS));
  if (list.length === 0) list.push(1);
  const gap = 44;
  const padding = 40;
  const header = 108;
  const tileGap = 16;
  const noteSpace = hasNote ? 96 : 0;
  const short = list.length - 1 - [...list].reverse().indexOf(Math.min(...list));
  const room = (index: number) => maxHeight - (index === short ? noteSpace : 0);
  const tileHeight = Math.min(92, ...list.map((count, index) => Math.floor((room(index) - padding * 2 - header - (count - 1) * tileGap) / count)));
  const cardHeight = (count: number) => padding * 2 + header + count * tileHeight + (count - 1) * tileGap;
  const height = Math.max(...list.map((count, index) => cardHeight(count) + (index === short ? noteSpace : 0)));
  const [first = 1, second = first] = list;
  // quem empilha mais fica com a maior parte da largura
  const shares = list.length === 2 ? (first > second ? [0.55, 0.45] : first < second ? [0.45, 0.55] : [0.5, 0.5]) : [0.55];
  const usable = width - gap * (list.length - 1);
  let x = list.length === 1 ? Math.round((width * (1 - shares[0]!)) / 2) : 0;
  const cards = list.map((count, index) => {
    // o último fica com o resto: a soma fecha exatamente na largura pedida
    const cardWidth = list.length === 2 && index === 1 ? width - x : Math.round(usable * shares[index]!);
    const own = cardHeight(count);
    const card: PilhaCardLayout = {
      x,
      y: height - own,
      width: cardWidth,
      height: own,
      tiles: Array.from({ length: count }, (_, item) => own - padding - (item + 1) * tileHeight - item * tileGap),
    };
    x += cardWidth + gap;
    return card;
  });
  const low = cards[short]!;
  return { width, height, padding, header, tile: { height: tileHeight, gap: tileGap }, cards, short, note: { x: low.x, y: 0, width: low.width, height: low.y } };
}

/** Tempo de cada item, por grupo: o segundo grupo começa com folga depois do último item do primeiro. */
export function pilhaTimes(counts: readonly number[], revealAt: readonly (readonly number[])[] = []): number[][] {
  const times: number[][] = [];
  counts.slice(0, PILHA_MAX_GROUPS).forEach((count, index) => {
    const previous = times[index - 1]?.at(-1);
    times.push(sequence(count, revealAt[index], previous === undefined ? 0.9 : previous + 1.8, 0.7));
  });
  return times;
}

/** Quando o cartão de cada grupo entra: o primeiro pouco antes do seu primeiro item; os demais um segundo antes (a fala anuncia o grupo). */
export function pilhaGroupTimes(times: readonly (readonly number[])[], groupAt: readonly number[] = []): number[] {
  return times.map((group, index) => timeOr(groupAt[index], Math.max(0, (group[0] ?? 0) - (index === 0 ? 0.55 : 1))));
}

/**
 * Janela em que um item fica em destaque (tinta): do momento em que é citado até o próximo ser citado,
 * no máximo por `holdSec` (a fala pode demorar para chegar no próximo).
 */
export function pilhaHighlight(at: number, all: readonly number[], holdSec = 1.2): { from: number; to: number } {
  return { from: at, to: Math.min(at + holdSec, ...all.filter((time) => time > at)) };
}

/** Tamanhos do nome e do apoio de uma peça: encolhem até o mínimo e, se nem assim couberem lado a lado, o apoio sai. */
export function pilhaTileText(label: string, hint: string | undefined, innerWidth: number, tileHeight: number): { labelSize: number; hintSize: number; showHint: boolean } {
  const base = Math.max(MIN_TEXT, Math.min(44, Math.floor(tileHeight * 0.48)));
  const hintWidth = hint ? TILE_GAP + textWidth(hint, MIN_TEXT) : 0;
  for (let size = base; size >= MIN_TEXT; size -= 1) {
    if (textWidth(label, size, CHAR.bold) + hintWidth <= innerWidth) return { labelSize: size, hintSize: MIN_TEXT, showHint: Boolean(hint) };
  }
  return { labelSize: fitFont(label, innerWidth, base, MIN_TEXT, CHAR.bold), hintSize: MIN_TEXT, showHint: false };
}

const Tile: React.FC<{ item: PilhaItem; top: number; layout: PilhaLayout; width: number; at: number; all: number[] }> = ({ item, top, layout, width, at, all }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = enter(frame, fps, at, 0.45);
  const { from, to } = pilhaHighlight(at, all);
  const hot = presenceWindow(frame, from, to + 0.3, fps, 0.3);
  const mix = (cold: string, warm: string) => interpolateColors(hot, [0, 1], [cold, warm]);
  const sizes = pilhaTileText(item.label, item.hint, width - layout.padding * 2 - TILE_PADDING * 2, layout.tile.height);

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
        gap: TILE_GAP,
        padding: `0 ${TILE_PADDING}px`,
        borderRadius: theme.radius.panel,
        background: mix(alpha(theme.color.white, 0.9), theme.color.slate900),
        border: `2px solid ${mix(theme.color.slate300, theme.color.slate900)}`,
        opacity: progress,
        // cai de cima e pousa na pilha
        translate: `0px ${((progress - 1) * 48).toFixed(2)}px`,
      }}
    >
      <span
        style={{
          fontFamily: theme.font.body,
          fontWeight: 600,
          fontSize: sizes.labelSize,
          lineHeight: 1.1,
          color: mix(theme.color.slate900, theme.color.white),
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.label}
      </span>
      {sizes.showHint ? (
        <span style={{ flexShrink: 0, fontFamily: theme.font.body, fontWeight: 500, fontSize: sizes.hintSize, lineHeight: 1, color: mix(theme.color.slate600, theme.color.slate300), whiteSpace: 'nowrap' }}>
          {item.hint}
        </span>
      ) : null}
    </div>
  );
};

export const PilhaEmDoisGrupos: React.FC<PilhaEmDoisGruposProps & BaseProps> = ({
  eyebrow,
  title = 'Dois grupos, item por item.',
  accent,
  groups = DEFAULT_GROUPS,
  revealAt,
  groupAt,
  note,
  noteAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = groups.slice(0, PILHA_MAX_GROUPS);
  const counts = pilhaCounts(shown);
  const layout = pilhaLayout(counts, Boolean(note));
  const times = pilhaTimes(counts, revealAt);
  const cardTimes = pilhaGroupTimes(times, groupAt);
  const all = times.flat();

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
      <Statement text={title} accent={accent} eyebrow={eyebrow} fontSize={titleSize(title, 76)} />
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        {shown.map((group, index) => {
          const card = layout.cards[index]!;
          const cardAt = cardTimes[index]!;
          const icon = iconOr(group.icon);
          const titleWidth = card.width - layout.padding * 2 - (icon ? BADGE + 24 : 0);
          return (
            <SceneCard key={index} progress={enter(frame, fps, cardAt, 0.5)} padding={0} style={{ position: 'absolute', left: card.x, top: card.y, width: card.width, height: card.height }}>
              <div style={{ position: 'absolute', left: layout.padding, top: layout.padding, height: BADGE, display: 'flex', alignItems: 'center', gap: 24 }}>
                {icon ? <IconBadge icon={icon} size={BADGE} progress={enter(frame, fps, cardAt + 0.1, 0.5)} /> : null}
                <div
                  style={{
                    fontFamily: theme.font.display,
                    fontWeight: 600,
                    fontSize: fitFont(group.title, titleWidth, 56, 40, CHAR.display),
                    lineHeight: 1.15,
                    color: theme.color.slate900,
                    maxWidth: titleWidth,
                    ...CLIP,
                  }}
                >
                  {group.title}
                </div>
              </div>
              {group.items.slice(0, PILHA_MAX_ITEMS).map((item, itemIndex) => (
                <Tile key={itemIndex} item={item} top={card.tiles[itemIndex]!} layout={layout} width={card.width} at={times[index]![itemIndex]!} all={all} />
              ))}
            </SceneCard>
          );
        })}
        {/* o espaço acima do cartão mais baixo carrega o comentário da fala sobre aquele grupo */}
        {note && layout.note.height >= 80 ? (
          <div style={{ position: 'absolute', left: layout.note.x, width: layout.note.width, top: layout.note.y, height: layout.note.height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Pill fontSize={fitPill(note, layout.note.width)} progress={enter(frame, fps, timeOr(noteAt, (cardTimes[layout.short] ?? 0) + 0.25))} style={pillClamp(layout.note.width)}>
              <span style={CLIP}>{note}</span>
            </Pill>
          </div>
        ) : null}
      </div>
    </SceneBackground>
  );
};

const SAMPLE_GROUPS: PilhaGroup[] = [
  {
    title: 'Na mesa',
    icon: 'gear',
    items: [
      { label: 'Monitor', hint: 'ultrawide' },
      { label: 'Teclado', hint: 'mecânico' },
      { label: 'Microfone', hint: 'condensador' },
    ],
  },
  {
    title: 'No computador',
    icon: 'code',
    items: [
      { label: 'VS Code', hint: 'editor' },
      { label: 'Terminal', hint: 'o resto todo' },
    ],
  },
];

/** Caixa ocupada pela cena com estas props (título + palco), para conferir contra a área útil sem renderizar. */
export function pilhaExtent(props: PilhaEmDoisGruposProps = {}): Extent {
  const title = props.title ?? 'Dois grupos, item por item.';
  const layout = pilhaLayout(pilhaCounts(props.groups ?? DEFAULT_GROUPS), Boolean(props.note));
  return { width: layout.width, height: statementHeight(title, titleSize(title, 76), { eyebrow: Boolean(props.eyebrow) }) + 40 + layout.height };
}

export const entry: ComponentEntry = {
  component: PilhaEmDoisGrupos,
  sample: {
    eyebrow: 'Meu setup',
    title: 'O que eu uso todo dia.',
    accent: 'todo dia',
    groups: SAMPLE_GROUPS,
    revealAt: [
      [0.9, 1.6, 2.3],
      [4.4, 5.2],
    ],
    groupAt: [0.35, 3.4],
    note: 'e quase nada instalado',
    noteAt: 3.7,
  },
  defaultDuration: 7,
  description:
    'Para a fala que enumera coisas em dois blocos que se comparam ("de um lado eu tinha isto, isto e isto; do outro, só aquilo"): ' +
    'dois cartões lado a lado e os itens de cada um empilhando um a um, na ordem em que são citados; o item da vez fica em destaque. ' +
    'Serve para stack de tecnologias, o que vai e o que fica, prós e contras, hardware e software.',
  tags: ['pilha', 'comparação', 'lista', 'grupos'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/StackInicial' },
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do título' },
    { name: 'title', type: 'string', description: 'a frase da cena' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral' },
    { name: 'groups', type: '{ title: string; icon?: IconName; items: { label: string; hint?: string }[] }[] (2 grupos, 1 a 5 itens cada)', description: 'os dois grupos e seus itens, na ordem da fala; o primeiro item fica na base da pilha' },
    { name: 'revealAt', type: 'number[][]', description: 'segundo em que cada item entra, por grupo e por índice; o que faltar segue em sequência' },
    { name: 'groupAt', type: 'number[]?', description: 'segundo em que o cartão de cada grupo entra (padrão: pouco antes do primeiro item dele)' },
    { name: 'note', type: 'string?', description: 'rótulo solto sobre o cartão mais baixo: o comentário da fala sobre aquele grupo' },
    { name: 'noteAt', type: 'number?', description: 'segundo em que a nota entra' },
  ],
};
