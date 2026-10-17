import { interpolate } from 'remotion';

import { easeInOut, easeOutQuad, stageMotion } from '../arsenal/stage';
import { TechMark } from '../tech/glyph';
import { motion, theme } from '../theme';

const clamp ={ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export type SpanStyle = 'plain' | 'accent' | 'mark';

export interface Span {
  text: string;
  style: SpanStyle;
}

/**
 * Marcação mínima dos textos do nível max: `*trecho*` vira itálico coral (a palavra que carrega o
 * sentido) e `==trecho==` recebe marca-texto. Marcador sem par fica como texto.
 */
export function parseMarkup(text: string): Span[] {
  const spans: Span[] = [];
  const pattern = /\*([^*]+)\*|==(.+?)==/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index), style: 'plain' });
    spans.push(match[1] !== undefined ? { text: match[1], style: 'accent' } : { text: match[2]!, style: 'mark' });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last), style: 'plain' });
  return spans;
}

export interface Word {
  text: string;
  style: SpanStyle;
  /** quebra de linha pedida no texto (`\n`) antes desta palavra */
  breakBefore: boolean;
}

/** Palavras na ordem de leitura, cada uma com o estilo do trecho de onde veio. */
export function markupWords(text: string): Word[] {
  const words: Word[] = [];
  for (const span of parseMarkup(text)) {
    span.text.split('\n').forEach((line, lineIndex) => {
      line.split(/\s+/).filter(Boolean).forEach((word, wordIndex) => {
        words.push({ text: word, style: span.style, breakBefore: lineIndex > 0 && wordIndex === 0 });
      });
    });
  }
  return words;
}

export const plainText = (text: string) => parseMarkup(text).map((span) => span.text).join('');

/**
 * Instante (s) em que cada item entra: o `at` dado, ou `step` depois do anterior. Nunca decrescente.
 */
export function cueTimes(given: readonly (number | undefined)[], start: number, step: number): number[] {
  const times: number[] = [];
  given.forEach((value, index) => {
    const previous = times[index - 1];
    const fallback = previous === undefined ? start : previous + step;
    const time = value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
    times.push(Math.max(time, previous ?? 0));
  });
  return times;
}

/** Progresso 0→1 de uma entrada que começa em `atSec`, na curva de entrada do canal. */
export function cue(frame: number, fps: number, atSec: number, durationSec: number = motion.base): number {
  return interpolate(frame, [atSec * fps, (atSec + durationSec) * fps], [0, 1], { ...clamp, easing: motion.enter });
}

/** Entrada 0→1 medida de pílulas e cartões: desacelera sem ultrapassar o alvo (`easeOutQuad`). */
export function rise(frame: number, fps: number, atSec: number, durationSec: number = stageMotion.pill.sec): number {
  return easeOutQuad((frame / fps - atSec) / durationSec);
}

/** Saída 0→1 nos últimos `durationSec` do overlay: 8 f, só opacidade, na curva da troca. */
export function leave(frame: number, fps: number, total: number, durationSec: number = stageMotion.exit.sec): number {
  return easeInOut((frame - (total - durationSec * fps)) / (durationSec * fps));
}

/**
 * Instante (s) de cada palavra de um título ou frase: o `wordAt` dado (a palavra entra quando é dita) ou, sem
 * ele, a cascata medida de 3,5 f. Duas palavras ditas a menos de 3 f uma da outra caem na cascata.
 */
export function wordTimes(wordAt: readonly (number | undefined)[] | undefined, count: number, start: number): number[] {
  const { stepSec, minGapSec } = stageMotion.word;
  const times: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const given = wordAt?.[index];
    const previous = times[index - 1];
    if (typeof given === 'number' && Number.isFinite(given) && given >= 0) {
      times.push(previous !== undefined && given - previous < minGapSec ? previous + stepSec : given);
    } else {
      times.push(previous === undefined ? start : previous + stepSec);
    }
  }
  return times;
}

export interface WordReveal {
  opacity: number;
  /** px (de um quadro de 1080) abaixo do lugar final */
  y: number;
  /** px de desfoque */
  blur: number;
}

/**
 * Estado medido de uma palavra `sinceSec` depois do instante dela: antes, invisível (o espaço fica reservado);
 * opacidade em 10 f na curva da troca (5–25% nos primeiros frames); o Y fica parado 2 f e desce; blur só nos
 * 3 primeiros frames. `travel`: +20 px no título sobre papel, +36 px na frase sobre o footage.
 */
export function wordReveal(sinceSec: number, travel: number): WordReveal {
  const { sec, holdSec, settleSec, blurSec, blurPx } = stageMotion.word;
  if (sinceSec < 0) return { opacity: 0, y: travel, blur: blurPx };
  return {
    opacity: easeInOut(sinceSec / sec),
    y: travel * (1 - easeOutQuad((sinceSec - holdSec) / (settleSec - holdSec))),
    blur: blurPx * Math.max(0, 1 - sinceSec / blurSec),
  };
}

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Contraste WCAG entre duas cores `#rrggbb` (1–21). Texto de pílula precisa de pelo menos 4,5. */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export type PillTone = 'paper' | 'coral' | 'ink' | 'emerald' | 'danger';
export const PILL_TONES: readonly PillTone[] = ['paper', 'coral', 'ink', 'emerald', 'danger'];

/**
 * Semântica fixa: paper = contexto, coral = a ideia que importa, ink = termo técnico,
 * emerald = solução, danger = problema. Texto ink sobre coral/emerald (branco não dá contraste).
 */
export function pillColors(tone: PillTone): { background: string; color: string } {
  switch (tone) {
    case 'coral':
      return { background: theme.color.coral, color: theme.color.ink };
    case 'ink':
      return { background: theme.color.ink, color: theme.color.paper };
    case 'emerald':
      return { background: theme.color.emerald, color: theme.color.ink };
    case 'danger':
      return { background: theme.color.coralDeep, color: theme.color.white };
    default:
      return { background: theme.color.paper, color: theme.color.ink };
  }
}

// a conta mora num arquivo sem React, que a autoavaliação também importa
export { minReadSec } from './read-time';

export const resolveTone = (tone: unknown, fallback: PillTone = 'paper'): PillTone =>
  PILL_TONES.includes(tone as PillTone) ? (tone as PillTone) : fallback;

export type PillRole = 'stack' | 'conclusion' | 'side' | 'tree';

/**
 * Inclinação medida: −1,5° em quase todas (a etiqueta sobe para a direita), −2,5° na de conclusão,
 * ±2,05° alternando só na coluna ao lado da janela, e reta na árvore. A inclinação é ênfase, não acaso.
 */
export function pillTilt(index: number, role: PillRole = 'stack'): number {
  if (role === 'tree') return 0;
  if (role === 'conclusion') return -2.5;
  if (role === 'side') return index % 2 === 0 ? -2.05 : 2.05;
  return -1.5;
}

/** Menor texto de pílula: ~3,6% da altura do quadro (a referência usa 3%; no celular não lê). */
export const PILL_MIN_FONT = 38;

/**
 * Anatomia da pílula a partir do tamanho do texto, nas proporções medidas (texto 32 → altura 72, respiro
 * lateral 28, raio 8): etiqueta de canto pouco arredondado, não cápsula.
 */
export function pillMetrics(fontSize: number, compact = false): { padX: number; padY: number; radius: number; height: number } {
  const padY = Math.round(fontSize * (compact ? 0.4 : 0.55));
  return { padX: Math.round(fontSize * (compact ? 0.62 : 0.875)), padY, radius: Math.round(fontSize * 0.25), height: Math.round(fontSize * 1.15) + padY * 2 };
}

export interface NotePillProps {
  text: string;
  tone?: PillTone;
  /** 0→1 (use `rise`) */
  progress: number;
  fontSize?: number;
  tilt?: number;
  /** canto em torno do qual a etiqueta inclina e cresce */
  from?: 'left' | 'right' | 'bottom';
  /** largura máxima em px: acima dela o texto quebra em vez de vazar */
  maxWidth?: number;
  /** respiro menor, para a coluna estreita ao lado da janela */
  compact?: boolean;
  /** 0→1: risco que nega a ideia; a pílula riscada recua para a mais nova ficar em destaque */
  strike?: number;
  /** false: não põe o ícone sozinho quando o texto é o nome de uma tecnologia do catálogo */
  autoTechIcons?: boolean;
}

/**
 * Etiqueta que resume a fala, com a entrada medida (sobe 26 px, cresce de 0,92, sem ultrapassar) e o relevo
 * da referência: realce de 1 px no topo, aro escuro na base e sombra em duas camadas. A opacidade corre na
 * frente do movimento: no segundo frame já se lê (nada de pílula-fantasma).
 */
export const NotePill: React.FC<NotePillProps> = ({ text, tone = 'paper', progress, fontSize = 40, tilt = -1.5, from = 'left', maxWidth, compact = false, strike = 0, autoTechIcons = true }) => {
  const colors = pillColors(tone);
  const { padX, padY, radius } = pillMetrics(fontSize, compact);
  const { rise: travel, scaleFrom } = stageMotion.pill;
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        alignSelf: 'flex-start',
        padding: `${padY}px ${padX}px`,
        borderRadius: radius,
        background: colors.background,
        color: colors.color,
        fontFamily: tone === 'ink' ? theme.font.mono : theme.font.body,
        fontWeight: 600,
        fontSize,
        lineHeight: 1.15,
        letterSpacing: '-0.005em',
        whiteSpace: maxWidth ? 'normal' : 'nowrap',
        maxWidth,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,${tone === 'ink' ? 0.14 : 0.55}), inset 0 -3px 0 rgba(15,23,42,0.16), 0 3px 4px rgba(15,23,42,0.22), 0 12px 36px rgba(15,23,42,0.14)`,
        opacity: Math.min(1, progress * 3) * (1 - 0.5 * strike),
        translate: `0 ${(1 - progress) * travel}px`,
        rotate: `${tilt}deg`,
        scale: String((scaleFrom + (1 - scaleFrom) * progress) * (1 - 0.12 * strike)),
        transformOrigin: from === 'right' ? '100% 50%' : '0% 50%',
      }}
    >
      {/* pílula que nomeia uma tecnologia ("React", "› Docker") leva o ícone dela: marca no papel/ink, tinta do texto nos tons de acento */}
      <TechMark
        label={text.replace(/^›\s*/, '')}
        auto={autoTechIcons}
        size={fontSize * 0.95}
        color={colors.color}
        surface={tone === 'paper' ? 'light' : tone === 'ink' ? 'dark' : undefined}
        style={{ verticalAlign: '-0.14em', marginRight: fontSize * 0.34 }}
      />
      {text}
      {strike > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: '6%',
            top: '50%',
            width: `${88 * strike}%`,
            height: Math.max(4, fontSize * 0.11),
            borderRadius: 4,
            background: theme.color.coralDeep,
          }}
        />
      ) : null}
    </div>
  );
};

export interface RichTextProps {
  text: string;
  /** cor do texto comum; o trecho `*...*` é sempre coral itálico */
  color: string;
  /** estado de cada palavra (revelação palavra a palavra, `wordReveal`); sem valor, tudo visível */
  reveal?: (index: number) => WordReveal;
  /** progresso 0→1 do marca-texto dos trechos `==...==` */
  mark?: number;
  style?: React.CSSProperties;
}

const MARK = 'rgba(255,85,85,0.43)';

/**
 * Texto serifado com a palavra de sentido em itálico coral. Palavra ainda não dita não aparece, mas o lugar
 * dela fica reservado: a frase não pula ao completar. O marca-texto tem a faixa translúcida e o sublinhado
 * sólido da referência.
 */
export const RichText: React.FC<RichTextProps> = ({ text, color, reveal, mark = 1, style }) => {
  const words = markupWords(text);
  const marked = words.filter((word) => word.style === 'mark').length;
  let markIndex = 0;
  return (
    <div style={{ fontFamily: theme.font.display, fontWeight: 600, lineHeight: 1.04, letterSpacing: '-0.012em', color, ...style }}>
      {words.map((word, index) => {
        const state = reveal ? reveal(index) : null;
        const accent = word.style === 'accent';
        // o marca-texto corre palavra por palavra, da primeira à última marcada
        const sweep = word.style === 'mark' ? Math.min(1, Math.max(0, mark * marked - markIndex++)) : 0;
        return (
          <span key={index}>
            {word.breakBefore ? <br /> : null}
            <span
              style={{
                display: 'inline-block',
                whiteSpace: 'pre',
                fontStyle: accent ? 'italic' : 'normal',
                color: accent ? theme.color.coral : undefined,
                opacity: state ? state.opacity : 1,
                translate: state ? `0 ${state.y}px` : undefined,
                filter: state && state.blur > 0.05 ? `blur(${state.blur}px)` : undefined,
                backgroundImage: word.style === 'mark' ? `linear-gradient(${MARK}, ${MARK}), linear-gradient(${theme.color.coral}, ${theme.color.coral})` : undefined,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${sweep * 100}% 82%, ${sweep * 100}% 3px`,
                backgroundPosition: '0 55%, 0 97%',
              }}
            >
              {`${word.text} `}
            </span>
          </span>
        );
      })}
    </div>
  );
};
