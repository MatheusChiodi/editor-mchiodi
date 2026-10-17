import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { withAlpha } from './SectionTitle';

/** Tons de status do design system que o `theme.ts` ainda não expõe (rose-600, amber-700, emerald-600, slate-500). */
export const status = {
  rose: '#e11d48',
  amber: '#b45309',
  emeraldDeep: '#059669',
  slate500: '#64748b',
} as const;

export interface FontTier {
  fontSize: number;
  /** tamanho máximo do texto (em caracteres) que ainda cabe neste corpo */
  maxChars: number;
}

/** Maior corpo cujo limite de caracteres comporta o texto; texto maior que todos fica no último. */
export function fitFontSize(text: string, tiers: readonly FontTier[]): number {
  const length = text.trim().length;
  const tier = tiers.find((candidate) => length <= candidate.maxChars) ?? tiers[tiers.length - 1];
  return tier?.fontSize ?? 34;
}

const validTime = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value >= 0;

/**
 * Instantes (s) de uma sequência: usa `given` onde for válido e completa o resto escalonando
 * a partir do anterior. Nunca volta no tempo, para "o próximo entrou" significar "este já passou".
 */
export function sequenceTimes(count: number, given: readonly number[] = [], start = 0.4, step = 0.6): number[] {
  const times: number[] = [];
  for (let index = 0; index < count; index++) {
    const previous = times[index - 1];
    const fallback = previous === undefined ? start : previous + step;
    const candidate = given[index];
    times.push(Math.max(validTime(candidate) ? candidate : fallback, previous ?? 0));
  }
  return times;
}

export const PAIR_OFFSET = 0.2;

/**
 * Tempos de duas colunas a partir de uma lista única (`given` = esquerda inteira, depois direita).
 * Sem `given`, as colunas andam em paralelo, linha a linha, com a direita um instante depois.
 * Aqui os tempos informados não são reordenados: o diretor pode revelar em qualquer ordem.
 */
export function splitTimes(
  leftCount: number,
  rightCount: number,
  given: readonly number[] = [],
  start = 0.5,
  step = 0.6,
): { left: number[]; right: number[] } {
  const at = (flatIndex: number, fallback: number) => {
    const candidate = given[flatIndex];
    return validTime(candidate) ? candidate : fallback;
  };
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    left: Array.from({ length: leftCount }, (_, row) => at(row, round(start + row * step))),
    right: Array.from({ length: rightCount }, (_, row) => at(leftCount + row, round(start + row * step + PAIR_OFFSET))),
  };
}

/** Último instante de um conjunto de tempos (0 se vazio). */
export function lastTime(...groups: readonly (readonly number[])[]): number {
  return groups.flat().reduce((max, time) => Math.max(max, time), 0);
}

/** Entrada padrão de uma linha de conteúdo: fade com subida curta. */
export function rise(progress: number, distance = 14): { opacity: number; translate: string } {
  return { opacity: progress, translate: `0 ${(1 - progress) * distance}px` };
}

/** Cartão `paper` quase opaco: sobre footage não existe vidro para desfocar. */
export const cardSurface: React.CSSProperties = {
  background: withAlpha(theme.color.paper, 0.97),
  borderRadius: theme.radius.card,
  boxShadow: theme.shadow.raised,
  border: `1px solid ${withAlpha(theme.color.white, 0.7)}`,
};

export const Pill: React.FC<{ children: React.ReactNode; dot?: string; color?: string; style?: React.CSSProperties }> = ({
  children,
  dot,
  color = theme.color.slate600,
  style,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 14,
      padding: '9px 22px',
      borderRadius: theme.radius.pill,
      background: theme.color.white,
      border: `1px solid ${theme.color.slate300}`,
      fontFamily: theme.font.body,
      fontWeight: 600,
      fontSize: 24,
      lineHeight: 1.3,
      letterSpacing: '0.3em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      color,
      ...style,
    }}
  >
    {dot ? <div style={{ flexShrink: 0, width: 12, height: 12, borderRadius: theme.radius.pill, background: dot }} /> : null}
    {/* o tracking sobra à direita da última letra; a margem negativa recentra o texto na pílula */}
    <span style={{ marginRight: '-0.3em' }}>{children}</span>
  </div>
);

interface MarkProps {
  /** 0–1: quanto do traço já foi desenhado */
  progress: number;
  size: number;
  color: string;
  strokeWidth?: number;
}

const drawn = (progress: number) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - progress });

export const CheckMark: React.FC<MarkProps> = ({ progress, size, color, strokeWidth = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {progress > 0 ? <path d="M5 12.5l4.5 4.5L19 7.5" {...drawn(progress)} /> : null}
  </svg>
);

export const CrossMark: React.FC<MarkProps> = ({ progress, size, color, strokeWidth = 3 }) => {
  const first = Math.min(1, progress * 2);
  const second = Math.max(0, progress * 2 - 1);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {first > 0 ? <path d="M7 7l10 10" {...drawn(first)} /> : null}
      {second > 0 ? <path d="M17 7L7 17" {...drawn(second)} /> : null}
    </svg>
  );
};

export const NOTICE_TIERS: readonly FontTier[] = [
  { fontSize: 42, maxChars: 70 },
  { fontSize: 38, maxChars: 130 },
  { fontSize: 34, maxChars: Number.POSITIVE_INFINITY },
];

interface NoticeCardProps extends BaseProps {
  label: string;
  text: string;
  /** cor do rótulo e do ícone */
  accent: string;
  dot?: string;
  /** recebe o progresso de desenho (0–1) e devolve o SVG */
  icon: (progress: number) => React.ReactNode;
}

/** Base comum de TipCard e WarningCard: ícone em disco, pílula de rótulo e o texto. */
export const NoticeCard: React.FC<NoticeCardProps> = ({ label, text, accent, dot, icon, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const draw = progressAt(frame, fps, 0.2, 0.7);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', paddingLeft: theme.safe.x, paddingTop: theme.safe.y + 40 }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 32,
          width: 920,
          padding: '40px 48px 44px 40px',
          opacity: value,
          translate: `${(1 - enter) * -56 - exit * 28}px 0`,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 104,
            height: 104,
            borderRadius: theme.radius.pill,
            background: theme.color.white,
            border: `1px solid ${theme.color.slate300}`,
            boxShadow: theme.shadow.card,
          }}
        >
          {icon(draw)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <Pill dot={dot} color={accent} style={rise(progressAt(frame, fps, 0.12))}>
            {label}
          </Pill>
          <div
            style={{
              ...rise(progressAt(frame, fps, 0.22)),
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: fitFontSize(text, NOTICE_TIERS),
              lineHeight: 1.3,
              color: theme.color.ink,
              overflowWrap: 'anywhere',
            }}
          >
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
