// MODELO de animação reutilizável: na EDL entra como `scene:modelos/FileiraDeItens`, em qualquer vídeo.
// Forma: uma fileira de 2 a 5 itens que entram um a um. A figura muda o desenho, não a ideia:
// `card` (cartões soltos), `tray` (cartões servidos numa bandeja, com quem serve à esquerda) e `hero` (um time de figuras de capa).

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { Arrow, enter, Icon, IconBadge, type IconName, Pill, type Point, rise, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';
import { AREA, CHAR, clampInt, CLIP, type Extent, fitFont, fitPill, iconOr, lineCount, MIN_TEXT, pillClamp, sequence, textWidth, timeOr, titleSize } from './kit-a';

export type FileiraFigure = 'card' | 'tray' | 'hero';

export interface FileiraItem {
  label: string;
  /** linha de apoio (só nas figuras `card` e `tray`) */
  hint?: string;
  /** ícone do cartão, ou o emblema no peito da figura `hero` */
  icon?: IconName;
}

export interface FileiraHost {
  icon?: IconName;
  /** rótulo embaixo do disco */
  label?: string;
  /** segundo em que entra, junto com a bandeja */
  at?: number;
}

export interface FileiraDeItensProps {
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral: o único acento da tela */
  accent?: string;
  /** segundo em que o título entra (padrão 0). Se vier depois dos itens, a fileira começa sozinha no centro e sobe para dar lugar a ele */
  titleAt?: number;
  /** o desenho de cada item */
  figure?: FileiraFigure;
  /** de 2 a 5 itens, da esquerda para a direita, na ordem da fala */
  items?: FileiraItem[];
  /** segundo (relativo ao início da cena) em que cada item entra, por índice; o que faltar segue em sequência */
  revealAt?: number[];
  /** só na figura `tray`: quem serve os itens, num disco à esquerda que "toca" a cada item servido */
  host?: FileiraHost;
  /** pílula de fecho embaixo da fileira (omitida = não aparece) */
  closing?: string;
  closingAt?: number;
  /** o fecho vem sobre uma seta que sobe da esquerda para a direita (e as figuras `card`/`hero` sobem um pouco junto) */
  rising?: boolean;
}

export const FILEIRA_MIN = 2;
export const FILEIRA_MAX = 5;
export const FILEIRA_FIGURES: FileiraFigure[] = ['card', 'tray', 'hero'];
/** quanto tempo o disco de quem serve "vibra" depois de cada item */
export const FILEIRA_DING_SEC = 0.5;
const BLOCK_GAP = 44;
/** caixa de desenho da figura de capa (unidades do viewBox) */
const FIGURE = { width: 200, height: 260, emblem: [100, 112] as Point, emblemRadius: 23 };
const CARD_PADDING = 20;

const DEFAULT_ITEMS: FileiraItem[] = [
  { label: 'Primeiro', icon: 'bolt' },
  { label: 'Segundo', icon: 'gear' },
  { label: 'Terceiro', icon: 'check' },
];

export function isFileiraFigure(value: unknown): value is FileiraFigure {
  return typeof value === 'string' && (FILEIRA_FIGURES as string[]).includes(value);
}

export interface FileiraSlot {
  /** canto esquerdo do item */
  x: number;
  width: number;
  height: number;
  /** escala da figura `hero` (1 nas outras): a do meio é a maior */
  scale: number;
}

export interface FileiraLayout {
  figure: FileiraFigure;
  width: number;
  /** altura da fileira inteira (itens + bandeja ou etiqueta) */
  height: number;
  slots: FileiraSlot[];
  /** tamanho do disco do ícone de cada cartão */
  badge: number;
  /** extremos da fileira, para a seta do fecho */
  span: { from: number; to: number };
  tray?: { x: number; y: number; width: number; lip: number };
  host?: { size: number; center: Point; labelY: number };
}

/**
 * Fileira centralizada na largura útil. `card`/`tray`: cartões iguais, de no máximo 420 px, que estreitam conforme a quantidade
 * (e conforme o disco de quem serve ocupa a esquerda). `hero`: colunas de até 300 px, a figura do meio maior que as das pontas.
 */
export function fileiraLayout(count: number, figure: FileiraFigure = 'card', options: { host?: boolean; hint?: boolean } = {}, width: number = AREA.width): FileiraLayout {
  const total = clampInt(count, FILEIRA_MIN, FILEIRA_MAX);
  if (figure === 'hero') {
    const gap = 36;
    const column = Math.min(300, Math.floor((width - gap * (total - 1)) / total));
    const span = total * column + (total - 1) * gap;
    const start = (width - span) / 2;
    const middle = (total - 1) / 2;
    const base = { width: column * 0.8, height: column * 0.8 * (FIGURE.height / FIGURE.width) };
    return {
      figure,
      width,
      height: base.height + 94,
      slots: Array.from({ length: total }, (_, index) => ({ x: start + index * (column + gap), width: column, height: base.height, scale: 1 - 0.07 * Math.abs(index - middle) })),
      badge: 0,
      span: { from: start, to: start + span },
    };
  }
  const tray = figure === 'tray';
  const hasHost = tray && Boolean(options.host);
  const hostSize = 200;
  const hostWidth = hasHost ? hostSize + 64 : 0;
  const gap = 28;
  const inset = tray ? 28 : 0;
  const lip = 18;
  const cardWidth = Math.min(420, Math.floor((width - hostWidth - inset * 2 - gap * (total - 1)) / total));
  const cardHeight = 268 + (options.hint ? 64 : 0);
  const cardsSpan = total * cardWidth + (total - 1) * gap;
  const trayWidth = cardsSpan + inset * 2;
  const start = (width - hostWidth - trayWidth) / 2;
  const trayX = start + hostWidth;
  const trayY = cardHeight + 18;
  return {
    figure,
    width,
    height: tray ? trayY + lip + 6 : cardHeight,
    slots: Array.from({ length: total }, (_, index) => ({ x: trayX + inset + index * (cardWidth + gap), width: cardWidth, height: cardHeight, scale: 1 })),
    badge: total >= FILEIRA_MAX ? 96 : 112,
    span: { from: start, to: trayX + trayWidth },
    ...(tray ? { tray: { x: trayX, y: trayY, width: trayWidth, lip } } : {}),
    ...(hasHost ? { host: { size: hostSize, center: [start + hostSize / 2, hostSize / 2] as Point, labelY: hostSize + 18 } } : {}),
  };
}

/** Path da bandeja: uma linha com as duas bordas levantadas. */
export function fileiraTrayPath(tray: NonNullable<FileiraLayout['tray']>): string {
  const { x, y, width, lip } = tray;
  return `M${x} ${y} q0 ${lip} ${lip} ${lip} H${x + width - lip} q${lip} 0 ${lip} ${-lip}`;
}

/** Segundo em que cada item entra. */
export function fileiraTimes(count: number, revealAt?: readonly number[]): number[] {
  return sequence(clampInt(count, FILEIRA_MIN, FILEIRA_MAX), revealAt, 0.6, 0.5);
}

/** Força 1→0 do toque de quem serve: bate a cada item e decai em `decaySec`. */
export function fileiraDing(sec: number, times: readonly number[], decaySec: number = FILEIRA_DING_SEC): number {
  let strength = 0;
  for (const time of times) {
    const elapsed = sec - time;
    if (elapsed >= 0 && elapsed < decaySec) strength = Math.max(strength, 1 - elapsed / decaySec);
  }
  return strength;
}

/** Balanço lateral (unidades do viewBox) da barra da capa: cada figura fora de fase com a vizinha. */
export function fileiraCapeSway(frame: number, fps: number, index: number, amplitude = 5): number {
  return Math.sin((frame / fps) * 2.2 + index * 1.3) * amplitude;
}

/** Alturas dos três blocos da cena (título, fileira, fecho), para centralizar o que já está na tela. */
export function fileiraBlocks(layout: FileiraLayout, options: { eyebrow?: boolean; closing?: boolean; rising?: boolean } = {}): { title: number; row: number; closing: number; gap: number; total: number } {
  const title = options.eyebrow ? 166 : 112;
  const closing = options.closing ? (options.rising ? 96 : 72) : 0;
  return { title, row: layout.height, closing, gap: BLOCK_GAP, total: title + BLOCK_GAP + layout.height + (closing ? BLOCK_GAP + closing : 0) };
}

/**
 * Quanto a pilha título/fileira/fecho desce (ou sobe) para o que já entrou ficar no centro da área útil:
 * só o título na tela → ele fica no meio; só a fileira → ela fica no meio; os dois → posição final (0).
 */
export function fileiraShift(titleProgress: number, rowProgress: number, blocks: { title: number; gap: number; total: number }): number {
  const top = (1 - titleProgress) * (blocks.title + blocks.gap);
  const bottom = blocks.title + rowProgress * (blocks.total - blocks.title);
  return (blocks.total - (top + bottom)) / 2;
}

/** Corpo do nome de um item num cartão: a maior palavra tem que caber na largura; o nome pode quebrar em duas linhas. */
export function fileiraLabelSize(labels: readonly string[], cardWidth: number): number {
  const room = cardWidth - CARD_PADDING * 2 - 4;
  const longestWord = labels.flatMap((label) => label.split(/\s+/)).reduce((longest, word) => (word.length > longest.length ? word : longest), '');
  for (let size: number = text.body; size > MIN_TEXT; size -= 1) {
    if (textWidth(longestWord, size, CHAR.bold) <= room && labels.every((label) => lineCount(label, room, size, CHAR.bold) <= 2)) return size;
  }
  return MIN_TEXT;
}

const Hero: React.FC<{ item: FileiraItem; slot: FileiraSlot; rowHeight: number; labelSize: number; progress: number; sway: number; lift: number }> = ({ item, slot, rowHeight, labelSize, progress, sway, lift }) => {
  const ink = theme.color.slate900;
  const figure = { width: slot.width * 0.8 * slot.scale, height: slot.height * slot.scale };
  const emblem = (figure.width / FIGURE.width) * FIGURE.emblemRadius * 2;
  const unfurl = 0.7 + 0.3 * progress;
  const icon = iconOr(item.icon);
  return (
    <div
      style={{
        position: 'absolute',
        left: slot.x,
        bottom: 0,
        width: slot.width,
        maxHeight: rowHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        opacity: Math.min(1, progress * 1.6),
        // a figura chega de cima e pousa; depois sobe junto com o time
        translate: `0px ${((1 - progress) * -44 - lift).toFixed(2)}px`,
      }}
    >
      <div style={{ position: 'relative', width: figure.width, height: figure.height }}>
        <svg viewBox={`0 0 ${FIGURE.width} ${FIGURE.height}`} width={figure.width} height={figure.height} style={{ overflow: 'visible' }} stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill={theme.color.white}>
          <g transform={`translate(100 80) scale(${unfurl.toFixed(3)}) translate(-100 -80)`}>
            <path d={`M72 80 C42 120 ${32 + sway} 190 ${24 + sway} 242 Q62 230 100 242 Q138 230 ${176 + sway} 242 C${168 + sway} 190 158 120 128 80 Z`} fill={ink} />
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
        {icon ? (
          <div
            style={{
              position: 'absolute',
              left: (FIGURE.emblem[0] / FIGURE.width) * figure.width - emblem / 2,
              top: (FIGURE.emblem[1] / FIGURE.height) * figure.height - emblem / 2,
              width: emblem,
              height: emblem,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={emblem * 0.62} draw={progress} strokeWidth={2} />
          </div>
        ) : null}
      </div>
      <Pill fontSize={labelSize} style={pillClamp(slot.width + 24)}>
        <span style={CLIP}>{item.label}</span>
      </Pill>
    </div>
  );
};

export const FileiraDeItens: React.FC<FileiraDeItensProps & BaseProps> = ({
  eyebrow,
  title = 'Um de cada vez.',
  accent,
  titleAt = 0,
  figure = 'card',
  items = DEFAULT_ITEMS,
  revealAt,
  host,
  closing,
  closingAt,
  rising = false,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const kind: FileiraFigure = isFileiraFigure(figure) ? figure : 'card';
  const shown = items.slice(0, FILEIRA_MAX);
  const count = shown.length;
  const hasHint = kind !== 'hero' && shown.some((item) => item.hint);
  const layout = fileiraLayout(count, kind, { host: Boolean(host), hint: hasHint });
  const times = fileiraTimes(count, revealAt);
  const hostAt = timeOr(host?.at, Math.max(0, times[0]! - 1.2));
  const rowAt = layout.host ? Math.min(hostAt, times[0]!) : kind === 'tray' ? Math.max(0, times[0]! - 0.6) : times[0]!;
  const closingSec = timeOr(closingAt, times.at(-1)! + 0.7);
  const blocks = fileiraBlocks(layout, { eyebrow: Boolean(eyebrow), closing: Boolean(closing), rising });
  // o que ainda não entrou não ocupa lugar: a pilha se recentra conforme título e fileira chegam
  const titleIn = titleAt <= 0.35 ? 1 : enter(frame, fps, titleAt - 0.35, 0.7);
  const rowIn = rowAt <= 0.6 ? 1 : enter(frame, fps, rowAt - 0.4, 0.7);
  const shift = fileiraShift(titleIn, rowIn, blocks);
  const hostIn = enter(frame, fps, hostAt, 0.5);
  const trayIn = enter(frame, fps, rowAt + (layout.host ? 0.25 : 0), 0.7);
  const ding = layout.host ? fileiraDing(sec, times) : 0;
  // um corpo só para a fileira inteira: o do rótulo mais apertado
  const labelSize = kind === 'hero' ? Math.min(...shown.map((item) => fitPill(item.label, layout.slots[0]!.width + 24))) : fileiraLabelSize(shown.map((item) => item.label), layout.slots[0]!.width);
  const lifts = rising && kind !== 'tray';
  const arrowInset = 40;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: blocks.gap, translate: `0px ${shift.toFixed(2)}px` }}>
        {/* o título ocupa o lugar desde o início (invisível) para a fileira não pular quando ele entra */}
        <div style={{ height: blocks.title, display: 'flex', alignItems: 'flex-end', opacity: frame >= titleAt * fps ? 1 : 0 }}>
          <Statement text={title} accent={accent} eyebrow={eyebrow} atSec={titleAt} fontSize={titleSize(title, 92)} />
        </div>

        <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
          {layout.host ? (
            <>
              {/* ondas do toque: aparecem a cada item servido e somem sozinhas */}
              <svg
                width={layout.host.size + 80}
                height={layout.host.size + 80}
                viewBox="-40 -40 280 280"
                style={{ position: 'absolute', left: layout.host.center[0] - layout.host.size / 2 - 40, top: -40, opacity: ding * hostIn, scale: String(1 + (1 - ding) * 0.08) }}
                fill="none"
                stroke={theme.color.slate600}
                strokeWidth={5}
                strokeLinecap="round"
              >
                <path d="M-12 62a118 118 0 0 1 40 -62" />
                <path d="M212 62a118 118 0 0 0 -40 -62" />
              </svg>
              <IconBadge
                icon={iconOr(host?.icon, 'user')!}
                variant="ink"
                size={layout.host.size}
                progress={hostIn}
                style={{ position: 'absolute', left: layout.host.center[0] - layout.host.size / 2, top: layout.host.center[1] - layout.host.size / 2 - ding * 6 }}
              />
              {host?.label ? (
                <div
                  style={{
                    position: 'absolute',
                    left: layout.host.center[0] - layout.host.size / 2 - 24,
                    width: layout.host.size + 48,
                    top: layout.host.labelY,
                    textAlign: 'center',
                    fontFamily: theme.font.body,
                    fontWeight: 600,
                    fontSize: fitFont(host.label, layout.host.size + 48, text.label, MIN_TEXT, CHAR.bold),
                    lineHeight: 1.2,
                    color: theme.color.slate900,
                    ...rise(enter(frame, fps, hostAt + 0.15), 16),
                  }}
                >
                  {host.label}
                </div>
              ) : null}
            </>
          ) : null}

          {layout.tray ? (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} fill="none">
              <path d={fileiraTrayPath(layout.tray)} stroke={theme.color.slate900} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - trayIn} opacity={trayIn > 0 ? 1 : 0} />
            </svg>
          ) : null}

          {shown.map((item, index) => {
            const slot = layout.slots[index]!;
            const at = times[index]!;
            const lift = lifts ? enter(frame, fps, closingSec + 0.1 + index * 0.06, 0.6) * 18 : 0;
            if (kind === 'hero') {
              return <Hero key={index} item={item} slot={slot} rowHeight={layout.height} labelSize={labelSize} progress={enter(frame, fps, at, 0.55)} sway={fileiraCapeSway(frame, fps, index)} lift={lift} />;
            }
            const progress = enter(frame, fps, at, 0.45);
            const icon = iconOr(item.icon);
            return (
              <SceneCard
                key={index}
                progress={progress}
                padding={`24px ${CARD_PADDING}px`}
                style={{
                  position: 'absolute',
                  left: slot.x,
                  top: 0,
                  width: slot.width,
                  height: slot.height,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 20,
                  textAlign: 'center',
                  // na bandeja o cartão é servido de cima e pousa; solto, sobe como o resto do kit
                  translate: `0px ${((kind === 'tray' ? -(1 - progress) * 36 : (1 - progress) * 32) - lift).toFixed(2)}px`,
                }}
              >
                {icon ? <IconBadge icon={icon} size={layout.badge} progress={enter(frame, fps, at + 0.08, 0.5)} /> : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: labelSize, lineHeight: 1.15, color: theme.color.slate900 }}>{item.label}</div>
                  {item.hint ? (
                    <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: MIN_TEXT, lineHeight: 1.25, color: theme.color.slate600, maxWidth: slot.width - CARD_PADDING * 2, ...CLIP }}>
                      {item.hint}
                    </div>
                  ) : null}
                </div>
              </SceneCard>
            );
          })}
        </div>

        {closing ? (
          <div style={{ position: 'relative', width: layout.width, height: blocks.closing, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {rising ? <Arrow from={[layout.span.from + arrowInset, blocks.closing - 14]} to={[layout.span.to - arrowInset, 14]} bend={-10} progress={enter(frame, fps, closingSec, 0.7)} /> : null}
            <Pill
              variant="emerald"
              dot
              fontSize={fitPill(closing, layout.span.to - layout.span.from - arrowInset * 4, 36, 'dot')}
              progress={enter(frame, fps, closingSec + (rising ? 0.25 : 0))}
              style={rising ? { position: 'relative', background: theme.color.paper } : undefined}
            >
              {closing}
            </Pill>
          </div>
        ) : null}
      </div>
    </SceneBackground>
  );
};

const SAMPLE_ITEMS: FileiraItem[] = [
  { label: 'Testes', hint: 'tudo verde', icon: 'check' },
  { label: 'Build', hint: 'em um minuto', icon: 'gear' },
  { label: 'Deploy', hint: 'sem cair', icon: 'cloud' },
];

/** Caixa ocupada pela cena com estas props (título + fileira + fecho), para conferir contra a área útil sem renderizar. */
export function fileiraExtent(props: FileiraDeItensProps = {}): Extent {
  const items = (props.items ?? DEFAULT_ITEMS).slice(0, FILEIRA_MAX);
  const figure = isFileiraFigure(props.figure) ? props.figure : 'card';
  const layout = fileiraLayout(items.length, figure, { host: Boolean(props.host), hint: figure !== 'hero' && items.some((item) => item.hint) });
  const blocks = fileiraBlocks(layout, { eyebrow: Boolean(props.eyebrow), closing: Boolean(props.closing), rising: props.rising });
  return { width: layout.span.to - layout.span.from, height: blocks.total };
}

export const entry: ComponentEntry = {
  component: FileiraDeItens,
  sample: {
    eyebrow: 'A cada push',
    title: 'A esteira entrega pra mim.',
    accent: 'pra mim',
    titleAt: 0.3,
    figure: 'tray',
    items: SAMPLE_ITEMS,
    revealAt: [2.6, 3.3, 4.0],
    host: { icon: 'bell', label: 'pipeline', at: 1.6 },
    closing: 'no ar em minutos',
    closingAt: 4.9,
    rising: false,
  },
  defaultDuration: 6.5,
  description:
    'Para a fala que enumera de 2 a 5 coisas da mesma família, uma por vez ("ela me deu isto, isto, isto e isto" ou "tinha o de front, o de back, o de dados…"). ' +
    'Escolha a figura pelo que os itens são: `card` para coisas soltas, `tray` quando alguém ou algo ENTREGA os itens (com o disco de quem serve à esquerda), ' +
    '`hero` quando os itens são pessoas ou papéis de um time. Com `rising`, o fecho vem sobre uma seta subindo ("crescendo juntos"). ' +
    'Serve para os benefícios de um plano, as etapas de uma esteira, as áreas de uma equipe, os ingredientes de uma receita.',
  tags: ['lista', 'fileira', 'itens', 'time', 'enumeração'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/AlfredDio' },
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do título' },
    { name: 'title', type: 'string', description: 'a frase da cena' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral' },
    { name: 'titleAt', type: 'number?', description: 'segundo em que o título entra (padrão 0); pode vir depois dos itens, e a fileira abre espaço para ele' },
    { name: 'figure', type: "'card' | 'tray' | 'hero'", description: 'o desenho: cartões soltos, cartões servidos numa bandeja, ou figuras de capa (um time)' },
    { name: 'items', type: '{ label: string; hint?: string; icon?: IconName }[] (2 a 5)', description: 'os itens da esquerda para a direita, na ordem da fala; `hint` não aparece na figura hero' },
    { name: 'revealAt', type: 'number[]', description: 'segundo em que cada item entra, por índice; o que faltar segue em sequência' },
    { name: 'host', type: '{ icon?: IconName; label?: string; at?: number }?', description: 'só na figura tray: quem serve, num disco escuro à esquerda que toca a cada item' },
    { name: 'closing', type: 'string?', description: 'pílula de fecho embaixo da fileira' },
    { name: 'closingAt', type: 'number?', description: 'segundo em que o fecho entra (padrão: depois do último item)' },
    { name: 'rising', type: 'boolean?', description: 'fecho sobre uma seta que sobe da esquerda para a direita; as figuras card/hero sobem junto' },
  ],
};
