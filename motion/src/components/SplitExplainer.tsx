import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import { BACKDROP, useStage } from '../arsenal/StageLayer';
import { anchorOpacity, contentRect, contentTiming, easeOutQuad, exitCue, stageMotion } from '../arsenal/stage';
import { Icon, isIconName } from '../scene-kit/icons';
import { techFor, TechGlyph } from '../tech/glyph';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';
import { cueTimes, markupWords, NotePill, pillTilt, type PillTone, resolveTone, RichText, rise, wordReveal, wordTimes } from './stage-kit';

export interface ExplainerCard {
  /** ícone do kit (`server`, `database`, `browser`, `phone`, `code`, `gear`, `bolt`, `lock`, `user`, `cloud`, `check`, `x`) ou `tech:<id>` (logo da tecnologia); sem ele, o número do cartão */
  icon?: string;
  label: string;
  caption?: string;
}

export interface SplitExplainerProps {
  /** rótulo em caixa alta acima do título ("ATÉ AQUI", "COM MODS") */
  eyebrow?: string;
  /** título serifado; `*trecho*` em itálico coral */
  title: string;
  /** segundos, relativos ao início do overlay, em que cada palavra do título é dita; sem ele, cascata fixa */
  wordAt?: number[];
  cards?: ExplainerCard[];
  /** segundos, relativos ao início do overlay, em que cada cartão entra (quando é falado) */
  revealAt?: number[];
  note?: { text: string; tone?: PillTone; at?: number };
  /** lado do cartão do apresentador quando o componente roda fora de um palco (no palco vale o `presenter.slot` do overlay) */
  presenter?: 'right' | 'left';
  /** false: cartão com nome de tecnologia ("React") não ganha o logo sozinho */
  autoTechIcons?: boolean;
}

export const MAX_CARDS = 6;
/** a primeira palavra do título entra com a troca de layout em andamento, 3 f depois do rótulo */
export const TITLE_START = stageMotion.contentDelaySec + stageMotion.eyebrow.leadSec;
export const TITLE_STEP = stageMotion.word.stepSec;
export const CARD_STEP = 1.2;
/** margem esquerda única do conteúdo (5,8% do quadro) */
export const CONTENT_MARGIN = 112;
/** ≈ 9,1% da altura do quadro, como o título de painel da referência */
export const TITLE_MAX = 98;

/** No máximo 3 por linha: 4 cartões pequenos numa fileira deixam o rótulo ilegível no celular. */
export function cardColumns(count: number): number {
  return Math.min(3, Math.max(1, count));
}

/** O título encolhe quando é longo, para caber em duas linhas na coluna de conteúdo. */
export function explainerTitleSize(title: string): number {
  const length = markupWords(title).map((word) => word.text).join(' ').length;
  return length <= 34 ? TITLE_MAX : Math.max(64, Math.round(TITLE_MAX * Math.sqrt(34 / length)));
}

/** Instante de cada palavra do título: quando é dita (`wordAt`) ou em cascata a partir de `start`. */
export function titleTimes(wordCount: number, wordAt?: readonly (number | undefined)[], start: number = TITLE_START): number[] {
  return wordTimes(wordAt, wordCount, start);
}

/** Os cartões começam depois do título inteiro, a menos que `revealAt` diga quando. */
export function cardTimes(count: number, wordCount: number, revealAt: readonly number[] = [], lastWordAt?: number): number[] {
  const last = lastWordAt ?? TITLE_START + Math.max(0, wordCount - 1) * TITLE_STEP;
  return cueTimes(Array.from({ length: count }, (_, index) => revealAt[index]), last + stageMotion.word.sec + 0.4, CARD_STEP);
}

/**
 * Explicação em tela dividida: papel com rótulo, título serifado revelado palavra a palavra na fala e cartões
 * que entram um a um, enquanto o apresentador fica num cartão vertical ao lado. Use com
 * `presenter: { slot: "right" }` (ou `left`, que espelha o conteúdo) no overlay: é o palco que encolhe o footage.
 */
export const SplitExplainer: React.FC<SplitExplainerProps & BaseProps> = ({ eyebrow, title, wordAt, cards = [], revealAt, note, presenter = 'right', autoTechIcons = true, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const stage = useStage();
  const slot = stage?.plan.slot;
  const side = slot === 'left' || slot === 'right' ? slot : presenter;
  const area = contentRect(side);
  const sec = frame / fps;
  const shown = cards.slice(0, MAX_CARDS);
  const columns = cardColumns(shown.length);
  const words = markupWords(title);
  const hasNote = Boolean(note?.text);
  // ordem de entrada: rótulo, título, cartões, pílula; a saída percorre a mesma lista de trás para a frente
  const total = 2 + shown.length + (hasNote ? 1 : 0);
  const timing = contentTiming(stage?.plan, durationInFrames / fps, total);
  const wordStart = timing.startSec + stageMotion.eyebrow.leadSec;
  const wordCues = titleTimes(words.length, wordAt, wordStart);
  const times = cardTimes(shown.length, words.length, revealAt, wordCues.at(-1) ?? wordStart);
  const dense = shown.length > 3;
  const out = (enterIndex: number) => exitCue(sec, timing.exitSec, total - 1 - enterIndex);
  // o rótulo é só fade, 3 f antes da primeira palavra, e nunca espera um título que demora a ser dito
  const eyebrowAt = Math.max(0, Math.min(timing.startSec, (wordCues[0] ?? wordStart) - stageMotion.eyebrow.leadSec));
  const eyebrowIn = easeOutQuad((sec - eyebrowAt) / stageMotion.eyebrow.sec);
  const noteAt = note?.at ?? (times.at(-1) ?? wordCues.at(-1) ?? wordStart) + CARD_STEP;

  return (
    <AbsoluteFill style={{ background: BACKDROP.paper }}>
      <div
        style={{
          position: 'absolute',
          left: area.x * width + (side === 'right' ? CONTENT_MARGIN : 48),
          width: area.w * width - CONTENT_MARGIN - 48,
          top: theme.safe.y + 30,
          bottom: theme.safe.y + 30,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 22,
        }}
      >
        {eyebrow ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: anchorOpacity(eyebrowIn, out(0), timing) }}>
            {/* o coral fica na barra: em texto pequeno sobre papel ele dá 2,3:1 (a referência usa rótulo coral de 23 px) */}
            <div style={{ width: 6, height: 30, borderRadius: 3, background: theme.color.coral }} />
            <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: 30, letterSpacing: '0.26em', textTransform: 'uppercase', color: theme.color.slate600 }}>
              {eyebrow}
            </div>
          </div>
        ) : null}
        <RichText
          text={title}
          color={theme.color.ink}
          reveal={(index) => wordReveal(sec - wordCues[index]!, stageMotion.word.riseTitle)}
          style={{ fontSize: explainerTitleSize(title), lineHeight: 1.02, maxWidth: 1100, opacity: anchorOpacity(1, out(1), { linkedIn: false, linkedOut: timing.linkedOut }) }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: dense ? 23 : 40, marginTop: dense ? 20 : 34 }}>
          {shown.map((card, index) => {
            const appear = rise(frame, fps, times[index]!, stageMotion.tile.sec);
            const gone = out(2 + index);
            // `icon: "tech:react"` ou um rótulo que é o nome de uma tecnologia: o logo entra no lugar do número
            const tech = techFor(card.label, card.icon, autoTechIcons);
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  padding: dense ? '22px 26px' : '30px 30px',
                  background: theme.color.white,
                  borderRadius: theme.radius.panel,
                  // sombra medida do cartão de ícone, tingida de slate
                  boxShadow: '0 21px 45px rgba(15,23,42,0.145), 0 0 0 1px rgba(17,24,39,0.05)',
                  opacity: Math.min(1, appear * 2) * (1 - gone),
                  // entrada medida: sobe 51 px, sem escala; na saída sobe mais um pouco
                  translate: `0 ${(1 - appear) * stageMotion.tile.rise - gone * 14}px`,
                }}
              >
                <div
                  style={{
                    width: dense ? 76 : 104,
                    height: dense ? 76 : 104,
                    borderRadius: 14,
                    // logo de tecnologia fica em ladrilho neutro: a cor da marca não disputa com o coral
                    background: tech ? 'rgba(15,23,42,0.05)' : 'rgba(255,85,85,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.font.display,
                    fontWeight: 600,
                    fontSize: dense ? 44 : 54,
                    color: theme.color.coralDeep,
                  }}
                >
                  {tech ? (
                    <TechGlyph tech={tech} size={dense ? 48 : 64} surface="light" progress={appear} />
                  ) : card.icon && isIconName(card.icon) ? (
                    <Icon name={card.icon} size={dense ? 46 : 56} color={theme.color.coralDeep} draw={appear} />
                  ) : (
                    index + 1
                  )}
                </div>
                <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: dense ? 34 : 38, lineHeight: 1.15, color: theme.color.ink, overflowWrap: 'anywhere' }}>
                  {card.label}
                </div>
                {card.caption ? (
                  <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: dense ? 28 : 30, lineHeight: 1.25, color: theme.color.slate600 }}>{card.caption}</div>
                ) : null}
              </div>
            );
          })}
        </div>
        {hasNote ? (
          <div style={{ marginTop: 26, opacity: 1 - out(total - 1), translate: `0 ${-out(total - 1) * 14}px` }}>
            <NotePill text={note!.text} tone={resolveTone(note!.tone, 'coral')} tilt={pillTilt(0, 'conclusion')} from="bottom" progress={rise(frame, fps, noteAt)} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: SplitExplainer,
  opaque: true,
  sample: {
    eyebrow: 'Até aqui',
    title: 'Você personalizava *como* ele trabalha',
    wordAt: [0.45, 0.8, 1.5, 1.75, 2.0],
    cards: [
      { icon: 'bolt', label: 'Skills' },
      { icon: 'cloud', label: 'Conectores' },
      { icon: 'gear', label: 'Ferramentas' },
    ],
    revealAt: [3.0, 4.0, 5.0],
    note: { text: 'tudo definido nos seus documentos', at: 6.2 },
    presenter: 'right',
  },
  defaultDuration: 10,
  description:
    'Explicação em tela dividida sobre papel: rótulo, título serifado com palavra em itálico coral revelado palavra a palavra na fala (`wordAt`) e até 6 cartões com ícone entrando um a um; o apresentador fica num cartão ao lado (use `presenter: { "slot": "right" }` no overlay; `left` espelha o conteúdo). Padrão obrigatório do nível max.',
};
