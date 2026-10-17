import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { cardSurface, CheckMark, CrossMark, Pill, rise, splitTimes, status } from './c1-kit';
import type { ComponentEntry } from './registry';
import { withAlpha } from './SectionTitle';

export interface ProsConsProps {
  pros: string[];
  cons: string[];
  title?: string;
  /** segundos relativos em que cada item aparece: primeiro todos os prós, depois os contras */
  revealAt?: number[];
}

/** Tempos de prós e contras; por padrão andam em paralelo, linha a linha. */
export function prosConsTimes(prosCount: number, consCount: number, revealAt?: readonly number[]) {
  const times = splitTimes(prosCount, consCount, revealAt);
  return { pros: times.left, cons: times.right };
}

/** Corpo dos itens conforme o tamanho da maior lista e do maior item. */
export function prosConsItemSize(pros: readonly string[], cons: readonly string[]): number {
  const longest = [...pros, ...cons].reduce((max, item) => Math.max(max, item.trim().length), 0);
  const rows = Math.max(pros.length, cons.length);
  if (rows <= 4 && longest <= 30) return 38;
  return rows <= 5 && longest <= 60 ? 36 : 34;
}

const ICON = 46;

const List: React.FC<{
  kind: 'pro' | 'con';
  items: readonly string[];
  times: readonly number[];
  fontSize: number;
  frame: number;
  fps: number;
}> = ({ kind, items, times, fontSize, frame, fps }) => {
  const pro = kind === 'pro';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <Pill dot={pro ? theme.color.emerald : status.rose} style={rise(progressAt(frame, fps, 0.2))}>
        {pro ? 'Prós' : 'Contras'}
      </Pill>
      {items.map((item, index) => {
        const at = times[index] ?? 0;
        const appear = progressAt(frame, fps, at);
        const draw = progressAt(frame, fps, at + 0.1, 0.45);
        return (
          <div key={index} style={{ ...rise(appear), display: 'flex', alignItems: 'flex-start', gap: 20, marginTop: 22 }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', height: fontSize * 1.3 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: ICON,
                  height: ICON,
                  borderRadius: theme.radius.pill,
                  background: pro ? theme.color.emerald : status.rose,
                }}
              >
                {pro ? (
                  <CheckMark progress={draw} size={30} color={theme.color.ink} strokeWidth={3.4} />
                ) : (
                  <CrossMark progress={draw} size={30} color={theme.color.white} strokeWidth={3.4} />
                )}
              </div>
            </div>
            <div
              style={{
                minWidth: 0,
                fontFamily: theme.font.body,
                fontWeight: 600,
                fontSize,
                lineHeight: 1.3,
                color: theme.color.ink,
                overflowWrap: 'anywhere',
              }}
            >
              {item}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ProsCons: React.FC<ProsConsProps & BaseProps> = ({ pros, cons, title, revealAt, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const times = prosConsTimes(pros.length, cons.length, revealAt);
  const fontSize = prosConsItemSize(pros, cons);
  const heading = title?.trim();

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          width: 1560,
          padding: '52px 64px 60px',
          opacity: value,
          translate: `0 ${(1 - enter) * 36 - exit * 20}px`,
        }}
      >
        {heading ? (
          <div
            style={{
              ...rise(progressAt(frame, fps, 0.1)),
              marginBottom: 34,
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: 54,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
              overflowWrap: 'anywhere',
            }}
          >
            {heading}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 56 }}>
          <List kind="pro" items={pros} times={times.pros} fontSize={fontSize} frame={frame} fps={fps} />
          <div style={{ flexShrink: 0, width: 2, background: withAlpha(theme.color.slate300, 0.8) }} />
          <List kind="con" items={cons} times={times.cons} fontSize={fontSize} frame={frame} fps={fps} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: ProsCons,
  sample: {
    title: 'Vale migrar para microsserviços?',
    pros: ['Times entregam sem esperar o outro', 'Escala só o que precisa', 'Falha fica isolada'],
    cons: ['Rede vira parte do problema', 'Observabilidade é obrigatória', 'Custo de infra sobe'],
  },
  defaultDuration: 9,
  vertical: { zone: 'full', scale: 0.55 },
  description: 'Balanço de vantagens e desvantagens de UMA decisão ou tecnologia; para confrontar duas opções use Comparison.',
};
