import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { techFor, TechGlyph } from '../tech/glyph';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface BulletListProps {
  title?: string;
  items: string[];
  /** segundos, relativos ao início do overlay, em que cada item aparece */
  revealAt?: number[];
  /** false: item que nomeia uma tecnologia ("Docker", "React: componentes") não troca o marcador pelo logo */
  autoTechIcons?: boolean;
}

export const REVEAL_STEP = 0.6;
export const REVEAL_START = 0.4;
const PAST_OPACITY = 0.7;
const ITEM_GAP = 22;

/**
 * Instante de entrada de cada item. Sem `revealAt` (ou com valores faltando/inválidos) o item
 * entra 0.6s depois do anterior. A lista sai sempre não decrescente: é isso que permite
 * tratar "o próximo entrou" como "este deixou de ser o destaque".
 */
export function revealTimes(count: number, revealAt: readonly number[] = []): number[] {
  const times: number[] = [];
  for (let index = 0; index < count; index++) {
    const previous = times[index - 1];
    const fallback = previous === undefined ? REVEAL_START : previous + REVEAL_STEP;
    const given = revealAt[index];
    const time = given !== undefined && Number.isFinite(given) && given >= 0 ? given : fallback;
    times.push(Math.max(time, previous ?? 0));
  }
  return times;
}

/** Índice do item em destaque (o último já revelado) ou -1 antes do primeiro. */
export function activeIndex(times: readonly number[], sec: number): number {
  let active = -1;
  times.forEach((time, index) => {
    if (sec >= time) active = index;
  });
  return active;
}

export const BulletList: React.FC<BulletListProps & BaseProps> = ({ title, items, revealAt, autoTechIcons = true, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const times = revealTimes(items.length, revealAt);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 780,
          padding: '44px 48px',
          background: theme.color.paper,
          borderRadius: theme.radius.card,
          boxShadow: theme.shadow.raised,
          opacity: value,
          translate: `${(1 - enter) * 64 + exit * 28}px 0`,
        }}
      >
        {title ? (
          <div
            style={{
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: 46,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: theme.color.ink,
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </div>
        ) : null}
        {items.map((item, index) => {
          const appear = progressAt(frame, fps, times[index]!);
          const next = times[index + 1];
          const passed = next === undefined ? 0 : progressAt(frame, fps, next);
          const focus = appear * (1 - passed);
          const tech = techFor(item, undefined, autoTechIcons);
          return (
            // 0fr→1fr: o item ainda não revelado não ocupa altura, então o cartão cresce junto com a lista
            <div key={index} style={{ display: 'grid', gridTemplateRows: `${appear}fr` }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  minHeight: 0,
                  overflow: 'hidden',
                  paddingTop: ITEM_GAP,
                  opacity: appear * (1 - (1 - PAST_OPACITY) * passed),
                  translate: `${(1 - appear) * 28}px 0`,
                }}
              >
                <div style={{ flexShrink: 0, width: 54, height: 46, display: 'flex', alignItems: 'center' }}>
                  {tech ? (
                    // item que nomeia uma tecnologia: o logo dela ocupa o lugar do marcador
                    <TechGlyph tech={tech} size={36} surface="light" progress={appear} />
                  ) : (
                    <div
                      style={{
                        width: 14 + 20 * focus,
                        height: 14,
                        borderRadius: theme.radius.pill,
                        background: theme.color.coral,
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    minWidth: 0,
                    fontFamily: theme.font.body,
                    fontWeight: 600,
                    fontSize: 36,
                    lineHeight: '46px',
                    color: theme.color.ink,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {item}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: BulletList,
  sample: {
    title: 'Por que usar TypeScript',
    items: ['Erros aparecem antes de rodar', 'Autocomplete que entende o projeto', 'Refatoração sem medo de quebrar tudo'],
    revealAt: [0.5, 1.8, 3.2],
  },
  defaultDuration: 7,
  description: 'Enumeração de 3 ou mais itens, cada um entrando no momento em que é falado.',
};
