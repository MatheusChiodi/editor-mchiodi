// MODELO de animação reutilizável: na EDL entra como `scene:modelos/CartaoComContadoresESelo`, em qualquer vídeo.
// Forma: à esquerda um cartão cujo botão é apertado e muda de estado; à direita contadores que sobem por causa disso;
// no fim, um selo com a frase de fecho. Três tempos: a ação, a repercussão, o reconhecimento.

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { formatPtBr } from '../../components/Counter';
import { alpha, Counter, enter, Eyebrow, Icon, IconBadge, type IconName, pillShadow, popIn, rise, SceneBackground, SceneCard, text } from '../../scene-kit';
import { theme } from '../../theme';
import { CHAR, clampInt, type Extent, fitFont, iconOr, lineCount, MIN_TEXT, pillWidth, textWidth, timeOr } from './kit-a';

export interface CartaoCard {
  /** quem assina o cartão (linha do topo) */
  author?: string;
  icon?: IconName;
  /** o título do que está sendo feito */
  title: string;
  /** estado antes e depois da ação, na etiqueta do topo */
  statusBefore?: string;
  statusAfter?: string;
  /** texto do botão antes e depois de apertado */
  action?: string;
  actionDone?: string;
}

export interface CartaoCounter {
  label: string;
  value: number;
  icon?: IconName;
  prefix?: string;
  suffix?: string;
}

export interface CartaoSeal {
  text: string;
  icon?: IconName;
}

export interface CartaoReveal {
  /** entra o cartão */
  card?: number;
  /** o botão é apertado e o estado muda */
  action?: number;
  /** os contadores começam a subir */
  counters?: number;
  /** entra o selo */
  seal?: number;
}

export interface CartaoComContadoresESeloProps {
  eyebrow?: string;
  card?: CartaoCard;
  /** de 1 a 4 contadores, de cima para baixo */
  counters?: CartaoCounter[];
  /** selo de fecho: disco coral + frase (omitido = não aparece) */
  seal?: CartaoSeal;
  /** segundos relativos ao início da cena, por parte */
  revealAt?: CartaoReveal;
}

export const CARTAO_MAX_COUNTERS = 4;
/** largura (0–1) de cada linha de texto simulada no corpo do cartão */
export const CARTAO_BODY_LINES = [1, 0.94, 0.62];
const DEFAULT_REVEAL = { card: 0.4, action: 2.2, counters: 3.8, seal: 6.0 };
const PRESS_SEC = 0.3;
const SEAL = 124;
const SEAL_GAP = 44;
const CARD_PADDING = 44;
const STAT_PADDING = 36;

const DEFAULT_CARD: CartaoCard = { title: 'O que foi feito', icon: 'user', statusBefore: 'pendente', statusAfter: 'feito', action: 'Enviar', actionDone: 'Enviado' };
const DEFAULT_COUNTERS: CartaoCounter[] = [
  { label: 'primeiro número', value: 120, icon: 'eye' },
  { label: 'segundo número', value: 45, icon: 'heart' },
  { label: 'terceiro número', value: 9, icon: 'chat' },
];

/** Tempos das partes fixas, com o padrão no que faltar. */
export function cartaoReveal(revealAt: CartaoReveal = {}): Required<CartaoReveal> {
  return {
    card: timeOr(revealAt.card, DEFAULT_REVEAL.card),
    action: timeOr(revealAt.action, DEFAULT_REVEAL.action),
    counters: timeOr(revealAt.counters, DEFAULT_REVEAL.counters),
    seal: timeOr(revealAt.seal, DEFAULT_REVEAL.seal),
  };
}

export interface CartaoPhase {
  /** 0→1→0: o botão afunda e volta */
  press: number;
  /** 0→1: o estado de antes dá lugar ao de depois */
  swap: number;
  done: boolean;
}

/** Estado do botão no instante `sec`: aperta em `actionAt`, e no meio do aperto troca para o estado final. */
export function cartaoPhase(sec: number, actionAt: number): CartaoPhase {
  const elapsed = sec - actionAt;
  const half = PRESS_SEC / 2;
  const press = elapsed <= 0 || elapsed >= PRESS_SEC ? 0 : 1 - Math.abs(elapsed - half) / half;
  const swap = Math.max(0, Math.min(1, (elapsed - half) / PRESS_SEC));
  return { press, swap, done: elapsed >= half };
}

/** Quando cada linha do corpo do cartão se escreve: distribuídas entre a entrada do cartão e o aperto do botão. */
export function cartaoBodyTimes(cardAt: number, actionAt: number, count = CARTAO_BODY_LINES.length): number[] {
  const from = cardAt + 0.5;
  const to = Math.max(from, actionAt - 0.5);
  const step = count > 1 ? (to - from) / (count - 1) : 0;
  return Array.from({ length: count }, (_, index) => from + Math.min(step, 0.45) * index);
}

/** Janela de contagem de cada contador: entram escalonados e todos terminam um pouco antes do selo. */
export function cartaoSchedule(countersAt: number, sealAt: number, count: number, staggerSec = 0.25): { atSec: number; durationSec: number }[] {
  const end = Math.max(countersAt + 1, sealAt - 0.2);
  return Array.from({ length: clampInt(count, 1, CARTAO_MAX_COUNTERS) }, (_, index) => {
    const atSec = countersAt + index * staggerSec;
    return { atSec, durationSec: Math.max(0.6, end - atSec) };
  });
}

export interface CartaoLayout {
  width: number;
  height: number;
  card: { width: number; height: number };
  stat: { width: number; height: number; gap: number; badge: number; fontSize: number };
  gap: number;
}

/** Cartão à esquerda e os contadores empilhados à direita, centralizados na mesma altura; com 4 contadores eles encolhem. */
export function cartaoLayout(count = 3): CartaoLayout {
  const total = clampInt(count, 1, CARTAO_MAX_COUNTERS);
  const cardWidth = 880;
  const statWidth = 520;
  const gap = 64;
  const statGap = 28;
  const height = 548;
  const statHeight = Math.min(200, Math.floor((height - statGap * (total - 1)) / total));
  return {
    width: cardWidth + gap + statWidth,
    height,
    card: { width: cardWidth, height },
    stat: { width: statWidth, height: statHeight, gap: statGap, badge: Math.min(96, statHeight - 36), fontSize: statHeight >= 150 ? 64 : 48 },
    gap,
  };
}

/** Texto final de um contador, para dimensionar o número antes de ele contar. */
export function cartaoCounterText(counter: Pick<CartaoCounter, 'value' | 'prefix' | 'suffix'>): string {
  return `${counter.prefix ?? ''}${formatPtBr(counter.value)}${counter.suffix ?? ''}`;
}

/** Corpo do título do cartão: 54 px em até duas linhas; título mais longo desce para caber em três. */
export function cartaoTitleSize(title: string, width = 880 - CARD_PADDING * 2): number {
  return lineCount(title, width, 54, CHAR.display) <= 2 ? 54 : 46;
}

/** Largura do botão: a do maior dos dois textos (o de depois leva o ícone de confirmação). */
export function cartaoButtonWidth(action: string, done: string): number {
  return Math.max(320, pillWidth(action, text.label), pillWidth(done, text.label, 'icon'));
}

const buttonBase: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  borderRadius: theme.radius.pill,
  fontFamily: theme.font.body,
  fontWeight: 600,
  fontSize: text.label,
  whiteSpace: 'nowrap',
  boxShadow: pillShadow,
};

const statusBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 24px',
  borderRadius: theme.radius.pill,
  fontFamily: theme.font.body,
  fontWeight: 500,
  fontSize: MIN_TEXT,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
  color: theme.color.slate900,
};

export const CartaoComContadoresESelo: React.FC<CartaoComContadoresESeloProps & BaseProps> = ({
  eyebrow,
  card = DEFAULT_CARD,
  counters = DEFAULT_COUNTERS,
  seal,
  revealAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = counters.slice(0, CARTAO_MAX_COUNTERS);
  const layout = cartaoLayout(shown.length);
  const reveal = cartaoReveal(revealAt);
  const cardIn = enter(frame, fps, reveal.card, 0.5);
  const phase = cartaoPhase(frame / fps, reveal.action);
  const lines = cartaoBodyTimes(reveal.card, reveal.action);
  const schedule = cartaoSchedule(reveal.counters, seal ? reveal.seal : reveal.counters + 2.2, shown.length);
  const sealIn = enter(frame, fps, reveal.seal, 0.45);
  const sealPop = popIn(frame, fps, reveal.seal, 0.5);
  // até o selo entrar, cartão e contadores ficam no centro da área útil; depois sobem e abrem espaço para ele
  const lift = seal ? (1 - enter(frame, fps, reveal.seal - 0.4, 0.7)) * ((SEAL + SEAL_GAP) / 2) : 0;
  const statusBefore = card.statusBefore ?? DEFAULT_CARD.statusBefore!;
  const statusAfter = card.statusAfter ?? DEFAULT_CARD.statusAfter!;
  const action = card.action ?? DEFAULT_CARD.action!;
  const actionDone = card.actionDone ?? DEFAULT_CARD.actionDone!;
  const statRoom = layout.stat.width - STAT_PADDING * 2;
  const cardTitleSize = cartaoTitleSize(card.title, layout.card.width - CARD_PADDING * 2);
  // título em três linhas ocupa o lugar de uma das linhas de texto simulado
  const bodyLines = cardTitleSize === 54 ? CARTAO_BODY_LINES : CARTAO_BODY_LINES.slice(0, 2);

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {eyebrow ? (
        <Eyebrow progress={enter(frame, fps, 0)} style={{ translate: `0px ${lift.toFixed(2)}px`, marginBottom: 40 }}>
          {eyebrow}
        </Eyebrow>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: layout.gap, width: layout.width, height: layout.height, translate: `0px ${lift.toFixed(2)}px` }}>
        <SceneCard progress={cardIn} padding={CARD_PADDING} style={{ width: layout.card.width, height: layout.card.height, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <IconBadge icon={iconOr(card.icon, 'user')!} variant="ink" size={80} progress={enter(frame, fps, reveal.card + 0.1, 0.5)} />
            <div style={{ flex: 1, minWidth: 0, fontFamily: theme.font.body, fontWeight: 600, fontSize: text.label, color: theme.color.slate900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {card.author}
            </div>
            <div style={{ position: 'relative', display: 'grid', justifyItems: 'end' }}>
              <div style={{ ...statusBase, gridArea: '1 / 1', background: alpha(theme.color.emerald, 0.14), border: `2px solid ${alpha(theme.color.emerald, 0.6)}`, opacity: phase.swap }}>
                <span style={{ width: 13, height: 13, borderRadius: theme.radius.pill, background: theme.color.emerald }} />
                {statusAfter}
              </div>
              <div style={{ ...statusBase, gridArea: '1 / 1', background: alpha(theme.color.white, 0.75), border: `2px solid ${alpha(theme.color.slate300, 0.8)}`, color: theme.color.slate600, opacity: 1 - phase.swap }}>
                {statusBefore}
              </div>
            </div>
          </div>

          <div
            style={{
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: cardTitleSize,
              lineHeight: 1.14,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
              ...rise(enter(frame, fps, reveal.card + 0.25), 20),
            }}
          >
            {card.title}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {bodyLines.map((width, index) => {
              const written = enter(frame, fps, lines[index] ?? 0, 0.5);
              return <div key={index} style={{ width: `${width * written * 100}%`, height: 16, borderRadius: theme.radius.pill, background: theme.color.slate300, opacity: written > 0 ? 1 : 0 }} />;
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', ...rise(enter(frame, fps, reveal.card + 0.5), 16) }}>
            <div style={{ position: 'relative', width: cartaoButtonWidth(action, actionDone), height: 82, scale: String(1 - 0.06 * phase.press) }}>
              <div style={{ ...buttonBase, background: theme.color.slate900, color: theme.color.white, opacity: 1 - phase.swap }}>{action}</div>
              <div style={{ ...buttonBase, background: theme.color.emerald, color: theme.color.slate900, opacity: phase.swap }}>
                <Icon name="check" size={40} strokeWidth={2.4} draw={phase.swap} />
                {actionDone}
              </div>
            </div>
          </div>
        </SceneCard>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: layout.stat.gap, width: layout.stat.width, height: layout.height }}>
          {shown.map((counter, index) => {
            const slot = schedule[index]!;
            const icon = iconOr(counter.icon);
            const room = statRoom - (icon ? layout.stat.badge + 28 : 0);
            return (
              <SceneCard key={index} progress={enter(frame, fps, slot.atSec, 0.45)} padding={`0 ${STAT_PADDING}px`} style={{ width: layout.stat.width, height: layout.stat.height, display: 'flex', alignItems: 'center', gap: 28 }}>
                {icon ? <IconBadge icon={icon} size={layout.stat.badge} progress={enter(frame, fps, slot.atSec + 0.08, 0.5)} /> : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Counter
                    to={counter.value}
                    atSec={slot.atSec}
                    durationSec={slot.durationSec}
                    prefix={counter.prefix}
                    suffix={counter.suffix}
                    fontSize={fitFont(cartaoCounterText(counter), room, layout.stat.fontSize, 40, CHAR.digits)}
                  />
                  <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: MIN_TEXT, lineHeight: 1.2, color: theme.color.slate600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: room }}>
                    {counter.label}
                  </div>
                </div>
              </SceneCard>
            );
          })}
        </div>
      </div>

      {seal ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, height: SEAL, marginTop: SEAL_GAP, opacity: sealIn }}>
          <IconBadge icon={iconOr(seal.icon, 'award')!} variant="coral" size={SEAL} progress={sealIn} style={{ scale: String(0.7 + 0.3 * sealPop) }} />
          <div
            style={{
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: fitFont(seal.text, 1728 - SEAL - 32, 68, 44, CHAR.display),
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
              whiteSpace: textWidth(seal.text, 44, CHAR.display) <= 1728 - SEAL - 32 ? 'nowrap' : 'normal',
              ...rise(enter(frame, fps, reveal.seal + 0.15), 20),
            }}
          >
            {seal.text}
          </div>
        </div>
      ) : null}
    </SceneBackground>
  );
};

const SAMPLE_CARD: CartaoCard = {
  author: 'Loja do canal',
  icon: 'user',
  title: 'Camiseta "funciona na minha máquina", edição limitada',
  statusBefore: 'fechada',
  statusAfter: 'no ar',
  action: 'Abrir a loja',
  actionDone: 'Loja aberta',
};

const SAMPLE_COUNTERS: CartaoCounter[] = [
  { label: 'visitas', value: 3200, icon: 'eye' },
  { label: 'pedidos', value: 184, icon: 'file' },
  { label: 'faturado', value: 12880, prefix: 'R$ ', icon: 'bolt' },
  { label: 'avaliações', value: 96, icon: 'heart' },
];

/** Caixa ocupada pela cena com estas props (eyebrow + cartão e contadores + selo), para conferir contra a área útil sem renderizar. */
export function cartaoExtent(props: CartaoComContadoresESeloProps = {}): Extent {
  const layout = cartaoLayout((props.counters ?? DEFAULT_COUNTERS).length);
  return { width: layout.width, height: Math.round((props.eyebrow ? MIN_TEXT * 1.2 + 40 : 0) + layout.height + (props.seal ? SEAL_GAP + SEAL : 0)) };
}

export const entry: ComponentEntry = {
  component: CartaoComContadoresESelo,
  sample: {
    eyebrow: 'Primeiro lançamento',
    card: SAMPLE_CARD,
    counters: SAMPLE_COUNTERS,
    seal: { text: 'Esgotou em dois dias.', icon: 'trophy' },
    revealAt: { card: 0.4, action: 2.2, counters: 3.6, seal: 6.0 },
  },
  defaultDuration: 8,
  description:
    'Para a fala em três tempos "eu fiz, as pessoas viram, e isso foi reconhecido": um cartão cujo botão é apertado e muda de estado ' +
    '(rascunho vira publicado, fechado vira aberto), de 1 a 4 contadores que sobem por causa disso e, no fim, um selo coral com a frase de fecho. ' +
    'Serve para publicar um artigo, lançar um produto, abrir inscrições, subir um vídeo.',
  tags: ['cartão', 'contadores', 'estado', 'selo', 'resultado', 'antes-depois'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/ArtigoReconhecido' },
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno no alto' },
    {
      name: 'card',
      type: '{ title: string; author?: string; icon?: IconName; statusBefore?: string; statusAfter?: string; action?: string; actionDone?: string }',
      description: 'o cartão: quem assina, o título do que é feito, a etiqueta de estado antes/depois e o texto do botão antes/depois de apertado',
    },
    { name: 'counters', type: '{ label: string; value: number; icon?: IconName; prefix?: string; suffix?: string }[] (1 a 4)', description: 'os números que sobem depois da ação, de cima para baixo' },
    { name: 'seal', type: '{ text: string; icon?: IconName }?', description: 'selo de fecho: disco coral (o único acento da tela) + frase; omitido = cena termina nos contadores' },
    { name: 'revealAt', type: '{ card?: number; action?: number; counters?: number; seal?: number }', description: 'segundo em que entra o cartão, em que o botão é apertado, em que os contadores começam e em que o selo entra' },
  ],
};
