import { AbsoluteFill, interpolateColors } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { theme } from '../theme';
import { cardSurface, CheckMark, rise, sequenceTimes } from './c1-kit';
import type { ComponentEntry } from './registry';

export interface ChecklistProps {
  title?: string;
  items: string[];
  /** segundos relativos em que cada item é marcado */
  checkAt?: number[];
}

export const CHECK_START = 1;
export const CHECK_STEP = 0.8;

/** Instante em que cada item é marcado; os itens em si já entram todos no começo. */
export function checkTimes(count: number, checkAt?: readonly number[]): number[] {
  return sequenceTimes(count, checkAt, CHECK_START, CHECK_STEP);
}

/** Quantos itens já estão marcados em `sec`. */
export function checkedCount(times: readonly number[], sec: number): number {
  return times.filter((time) => sec >= time).length;
}

const BOX = 50;
const LINE = 48;

export const Checklist: React.FC<ChecklistProps & BaseProps> = ({ title, items, checkAt, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const times = checkTimes(items.length, checkAt);
  const heading = title?.trim();

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          width: 800,
          padding: '46px 52px 50px',
          opacity: value,
          translate: `${(1 - enter) * 64 + exit * 28}px 0`,
        }}
      >
        {heading ? (
          <div
            style={{
              marginBottom: 8,
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: 48,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
              overflowWrap: 'anywhere',
            }}
          >
            {heading}
          </div>
        ) : null}
        {items.map((item, index) => {
          const at = times[index]!;
          const fill = progressAt(frame, fps, at, 0.25);
          const draw = progressAt(frame, fps, at + 0.08, 0.4);
          return (
            <div
              key={index}
              style={{ ...rise(progressAt(frame, fps, stagger(index, 0.1, 0.2))), display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: 22 }}
            >
              <div
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  width: BOX,
                  height: BOX,
                  marginTop: (LINE - BOX) / 2,
                  borderRadius: 14,
                  background: theme.color.white,
                  boxShadow: `inset 0 0 0 3px ${theme.color.slate300}`,
                  scale: 1 + 0.1 * fill * (1 - draw),
                }}
              >
                <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: theme.color.emerald, opacity: fill }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckMark progress={draw} size={36} color={theme.color.ink} strokeWidth={3.4} />
                </div>
              </div>
              <div
                style={{
                  minWidth: 0,
                  fontFamily: theme.font.body,
                  fontWeight: 600,
                  fontSize: 36,
                  lineHeight: `${LINE}px`,
                  // item marcado recua para o próximo ganhar a atenção, mas continua legível
                  color: interpolateColors(fill, [0, 1], [theme.color.ink, theme.color.slate600]),
                  overflowWrap: 'anywhere',
                }}
              >
                {item}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Checklist,
  sample: {
    title: 'Antes do deploy',
    items: ['Testes passando', 'Variáveis de ambiente conferidas', 'Migration revisada', 'Plano de rollback pronto'],
    checkAt: [1, 2.2, 3.4, 4.6],
  },
  defaultDuration: 7,
  vertical: { zone: 'full' },
  description: 'Lista de requisitos ou tarefas que vão sendo marcadas como feitas à medida que a fala confirma cada uma.',
};
