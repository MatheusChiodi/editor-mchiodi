import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import { resolveVariant, TechIcon, techOrPlaceholder, type TechTone, type TechVariant } from '../tech/TechIcon';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export type TechRowItem = string | { tech: string; label?: string; at?: number };

export interface TechRowProps {
  /** tecnologias na ordem da fala: id, apelido ou `{ tech, label?, at? }` */
  items: TechRowItem[];
  /** segundos, relativos ao início do overlay, em que cada uma entra (quando é citada) */
  revealAt?: number[];
  variant?: TechVariant;
  /** lado do ladrilho (ou altura do chip); sem valor, encolhe conforme a quantidade */
  size?: number;
  /** `mono`: tinta do desenho · `chip`: cor da pílula */
  tone?: TechTone;
  /** rótulo curto em caixa alta acima da fileira ("A STACK") */
  title?: string;
  /** faixa da tela; `bottom` fica acima das legendas */
  position?: 'top' | 'middle' | 'bottom';
  /** nome embaixo de cada ícone (o chip já traz o nome) */
  labels?: boolean;
  /** `row`: lado a lado · `stack`: empilhadas num lado, com o nome à direita do ícone */
  layout?: 'row' | 'stack';
  /** lado da pilha no layout `stack` */
  side?: 'left' | 'right';
}

export const MAX_TECH_ITEMS = 8;
export const TECH_START = 0.3;
export const TECH_STEP = 0.35;
export const TECH_LABEL_SIZE = 34;

export interface PlacedTech {
  tech: string;
  label: string | undefined;
  at: number;
}

/** Itens normalizados com o instante de entrada: `at` do item, senão `revealAt[i]`, senão um passo depois do anterior. Nunca decrescente. */
export function techItems(items: readonly TechRowItem[], revealAt: readonly number[] = []): PlacedTech[] {
  const placed: PlacedTech[] = [];
  for (const [index, item] of items.slice(0, MAX_TECH_ITEMS).entries()) {
    const tech = typeof item === 'string' ? item : item?.tech;
    if (typeof tech !== 'string' || !tech.trim()) continue;
    const given = typeof item === 'object' && typeof item.at === 'number' ? item.at : revealAt[index];
    const previous = placed.at(-1)?.at;
    const fallback = previous === undefined ? TECH_START : previous + TECH_STEP;
    const at = typeof given === 'number' && Number.isFinite(given) && given >= 0 ? given : fallback;
    placed.push({ tech, label: typeof item === 'object' ? item.label : undefined, at: Math.max(at, previous ?? 0) });
  }
  return placed;
}

/** Lado do ícone conforme a quantidade: até 4 cabem grandes; 8 ainda ficam dentro da margem segura. */
export function techSize(count: number, variant: TechVariant, layout: 'row' | 'stack' = 'row'): number {
  if (layout === 'stack') return count <= 4 ? 92 : 76;
  if (variant === 'chip') return count <= 3 ? 96 : count <= 5 ? 84 : 76;
  return count <= 4 ? 148 : count <= 6 ? 128 : 108;
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * Fileira de tecnologias que entram uma a uma, cada uma no instante em que é citada: é como o vídeo mostra
 * "do que ele está falando" quando a fala enumera React, Node, Docker…
 */
export const TechRow: React.FC<TechRowProps & BaseProps> = ({
  items,
  revealAt,
  variant: variantProp,
  size,
  tone,
  title,
  position = 'top',
  labels = true,
  layout = 'row',
  side = 'left',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const variant = resolveVariant(variantProp);
  const placed = techItems(items, revealAt);
  const stack = layout === 'stack';
  const iconSize = size ?? techSize(placed.length, variant, layout);
  const out = interpolate(frame, [durationInFrames - motion.fast * fps, durationInFrames], [0, 1], { ...clamp, easing: motion.exit });
  const titleIn = interpolate(frame, [0.05 * fps, 0.45 * fps], [0, 1], { ...clamp, easing: motion.enter });
  const outline = { WebkitTextStroke: `6px ${theme.color.ink}`, paintOrder: 'stroke fill', textShadow: '0 4px 18px rgba(0,0,0,0.45)' } as const;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: position === 'top' ? 'flex-start' : position === 'bottom' ? 'flex-end' : 'center',
        alignItems: stack ? (side === 'right' ? 'flex-end' : 'flex-start') : 'center',
        gap: 26,
        // embaixo, a fileira fica acima da faixa das legendas
        padding: `${theme.safe.y + 20}px ${theme.safe.x}px ${position === 'bottom' ? 250 : theme.safe.y + 20}px`,
        opacity: 1 - out,
      }}
    >
      {title ? (
        <div
          style={{
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: TECH_LABEL_SIZE,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: theme.color.white,
            ...outline,
            opacity: titleIn,
            translate: `0 ${(1 - titleIn) * 14}px`,
          }}
        >
          {title}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: stack ? 'column' : 'row', alignItems: stack ? (side === 'right' ? 'flex-end' : 'flex-start') : 'flex-start', gap: stack ? 18 : variant === 'chip' ? 22 : 40, flexWrap: 'nowrap' }}>
        {placed.map((item, index) => {
          const progress = interpolate(frame, [item.at * fps, (item.at + motion.base) * fps], [0, 1], { ...clamp, easing: motion.enter });
          const name = item.label ?? techOrPlaceholder(item.tech).name;
          if (stack || variant === 'chip') {
            // na pilha o nome fica ao lado: é o próprio chip (claro por padrão, legível sobre qualquer cenário)
            return <TechIcon key={index} name={item.tech} variant="chip" size={iconSize} tone={tone} label={item.label} progress={progress} />;
          }
          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: Math.max(iconSize, 150) }}>
              <TechIcon name={item.tech} variant={variant} size={iconSize} tone={tone} progress={progress} />
              {labels ? (
                <div
                  style={{
                    fontFamily: theme.font.body,
                    fontWeight: 600,
                    fontSize: TECH_LABEL_SIZE,
                    lineHeight: 1.1,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    color: theme.color.white,
                    ...outline,
                    opacity: progress,
                  }}
                >
                  {name}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: TechRow,
  sample: {
    title: 'A stack',
    items: ['react', 'nodejs', 'typescript', 'postgresql', 'docker', 'aws'],
    revealAt: [0.4, 1.1, 1.8, 2.6, 3.3, 4],
    variant: 'brand',
    position: 'top',
  },
  defaultDuration: 6,
  description:
    'Fileira de ícones de tecnologia (até 8) que entram um a um quando cada uma é citada, com o nome embaixo. Variantes `brand` (cor oficial em ladrilho), `mono` (tinta única) e `chip` (ícone + nome em pílula). Use quando a fala enumera tecnologias sobre o talking head.',
};
