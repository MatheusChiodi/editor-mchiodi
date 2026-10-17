import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import { easeOutQuad, stageMotion } from '../arsenal/stage';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';
import { cue, cueTimes, leave, NotePill, type PillRole, type PillTone, pillTilt, resolveTone, rise } from './stage-kit';

export type PillCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PillItem {
  text: string;
  tone?: PillTone;
  /** segundos, relativos ao início do overlay, em que a pílula entra (o instante em que é falada) */
  at?: number;
  /** segundos em que a ideia é negada: a pílula é riscada e recua */
  strikeAt?: number;
  /** recuo em níveis (0–2), para hierarquia: "Claude Code › aba Code › app desktop" */
  indent?: number;
}

export interface PillStackProps {
  /** palavra-título em serifada itálica coral acima das pílulas (o assunto do bloco) */
  title?: string;
  items: PillItem[];
  corner?: PillCorner;
  size?: 'medium' | 'large';
  /** false: pílula com nome de tecnologia ("React") não ganha o ícone sozinha */
  autoTechIcons?: boolean;
}

export const PILL_START = 0.5;
export const PILL_STEP = 1.6;
export const MAX_PILLS = 5;
export const PILL_FONT = { medium: 40, large: 48 } as const;
/** recuo por nível da árvore (medido: 69 px) */
export const INDENT_PX = 69;
/** frames de defasagem entre as pílulas na saída (a mais nova sai primeiro) */
export const EXIT_STAGGER = 2;
/** vão entre pílulas e o vão maior que separa a conclusão (medidos: 28 e 68 px para uma pílula de 72) */
export const STACK_GAP = { regular: 26, conclusion: 58 } as const;
/** palavra-título: ≈ 19% da altura do quadro */
export const TITLE_FONT = 208;

export interface StackedPill {
  text: string;
  tone: PillTone;
  at: number | undefined;
  strikeAt: number | undefined;
  indent: number;
}

/**
 * Só as primeiras cabem sem cobrir o rosto. Sem `tone`, todas são neutras e a última é a coral:
 * uma pilha tem uma conclusão só.
 */
export function stackItems(items: readonly PillItem[]): StackedPill[] {
  const kept = items.filter((item) => item.text.trim()).slice(0, MAX_PILLS);
  return kept.map((item, index) => ({
    text: item.text.trim(),
    tone: resolveTone(item.tone, kept.length > 1 && index === kept.length - 1 ? 'coral' : 'paper'),
    at: item.at,
    strikeAt: item.strikeAt,
    indent: Math.min(2, Math.max(0, Math.round(item.indent ?? 0))),
  }));
}

/** Papel de cada pílula na pilha: com recuo vira árvore (reta); a última em coral é a conclusão (mais torta, mais afastada). */
export function pillRole(pills: readonly StackedPill[], index: number): PillRole {
  if (pills.some((pill) => pill.indent > 0)) return 'tree';
  return pills.length > 1 && index === pills.length - 1 && pills[index]!.tone === 'coral' ? 'conclusion' : 'stack';
}

/** Vão acima de cada pílula: regular, e maior antes da conclusão. */
export function stackGap(pills: readonly StackedPill[], index: number): number {
  if (index === 0) return 0;
  return pillRole(pills, index) === 'conclusion' ? STACK_GAP.conclusion : STACK_GAP.regular;
}

/** Saída 0→1 de cada pílula: fade curto em ordem inversa à de entrada (`order` 0 = a mais nova, que sai primeiro). */
export function exitProgress(frame: number, total: number, order: number, count: number, fps: number): number {
  const length = Math.max(1, Math.round(0.2 * fps));
  const start = total - length - (count - 1 - order) * EXIT_STAGGER;
  return Math.min(1, Math.max(0, (frame - start) / length));
}

export function titleFontSize(title: string): number {
  return title.length <= 8 ? TITLE_FONT : Math.max(96, Math.round(TITLE_FONT * Math.sqrt(8 / title.length)));
}

/**
 * Pílulas que empilham num canto resumindo a fala, uma por ideia, no lugar de um gráfico grande:
 * é o apoio visual mais frequente do nível max sobre o talking head.
 */
export const PillStack: React.FC<PillStackProps & BaseProps> = ({ title, items, corner = 'top-left', size = 'medium', autoTechIcons = true, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pills = stackItems(items);
  const times = cueTimes(pills.map((pill) => pill.at), title ? PILL_START + 0.4 : PILL_START - 0.3, PILL_STEP);
  const out = leave(frame, fps, durationInFrames);
  const scrim = cue(frame, fps, 0, 0.5) * (1 - out);
  const right = corner.endsWith('right');
  const bottom = corner.startsWith('bottom');
  // palavra-título: 7 f, sobe 36 px
  const titleIn = easeOutQuad((frame / fps - 0.1) / (7 / 30));

  return (
    <AbsoluteFill>
      {/* escurece de leve só o canto das pílulas: a etiqueta lê sobre qualquer cenário */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(55% 75% at ${right ? 100 : 0}% ${bottom ? 100 : 0}%, rgba(12,12,12,0.42), rgba(12,12,12,0))`,
          opacity: scrim,
        }}
      />
      <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: bottom ? 'flex-end' : 'flex-start',
        alignItems: right ? 'flex-end' : 'flex-start',
        // embaixo, a pilha fica acima da faixa das legendas
        padding: `${theme.safe.y}px ${theme.safe.x}px ${bottom ? 250 : theme.safe.y}px`,
      }}
    >
      {title ? (
        <div
          style={{
            fontFamily: theme.font.display,
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: titleFontSize(title),
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            color: theme.color.coral,
            textShadow: '0 6px 30px rgba(12,12,12,0.55)',
            marginBottom: 26,
            opacity: titleIn * (1 - out),
            translate: `0 ${(1 - titleIn) * stageMotion.word.risePhrase}px`,
          }}
        >
          {title}
        </div>
      ) : null}
      {pills.map((pill, index) => {
        const gone = exitProgress(frame, durationInFrames, pills.length - 1 - index, pills.length, fps);
        return (
          <div key={index} style={{ marginTop: stackGap(pills, index), [right ? 'marginRight' : 'marginLeft']: pill.indent * INDENT_PX, opacity: 1 - gone }}>
            <NotePill
              text={pill.indent > 0 ? `› ${pill.text}` : pill.text}
              tone={pill.tone}
              fontSize={PILL_FONT[size]}
              tilt={pillTilt(index, pillRole(pills, index))}
              from={right ? 'right' : 'left'}
              progress={rise(frame, fps, times[index]!)}
              strike={pill.strikeAt === undefined ? 0 : cue(frame, fps, pill.strikeAt, 0.25)}
              autoTechIcons={autoTechIcons}
            />
          </div>
        );
      })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: PillStack,
  sample: {
    title: 'mods.',
    items: [
      { text: 'precisa programar', at: 0.9, strikeAt: 2.2 },
      { text: 'você pede em linguagem natural', at: 2.6 },
      { text: 'sem abrir o terminal', at: 4.2 },
    ],
    corner: 'top-left',
  },
  defaultDuration: 7,
  vertical: { zone: 'top', scale: 0.7 },
  description:
    'Pílulas que empilham num canto resumindo a fala em 2–5 palavras (até 5; a última é a conclusão em coral), com palavra-título opcional em serifada itálica coral; cada pílula entra quando a ideia é dita e pode ser riscada (`strikeAt`). Padrão obrigatório do nível max.',
};
