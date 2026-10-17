import { AbsoluteFill, interpolateColors } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { cardSurface, sequenceTimes } from './c1-kit';
import type { ComponentEntry } from './registry';

export interface Step {
  title: string;
  detail?: string;
}

export interface StepByStepProps {
  steps: Step[];
  /** índice (base 0) do passo em destaque; sem ele, o destaque acompanha o último passo revelado */
  active?: number;
  /** segundos relativos em que cada passo aparece */
  revealAt?: number[];
}

export const STEP_START = 0.4;
export const STEP_PACE = 0.9;
/** com `active` fixo a lista é um mapa do processo: entra inteira, num escalonamento rápido */
export const STEP_PACE_FIXED = 0.12;

/** Tempos de entrada dos passos. */
export function stepTimes(count: number, revealAt?: readonly number[], active?: number): number[] {
  const fixed = active !== undefined && (revealAt === undefined || revealAt.length === 0);
  return sequenceTimes(count, revealAt, fixed ? 0.3 : STEP_START, fixed ? STEP_PACE_FIXED : STEP_PACE);
}

/** `active` válido (inteiro dentro da lista) ou undefined. */
export function fixedActive(count: number, active?: number): number | undefined {
  if (active === undefined || !Number.isFinite(active)) return undefined;
  const index = Math.round(active);
  return index >= 0 && index < count ? index : undefined;
}

export type StepState = 'done' | 'active' | 'todo';

/** Estado de cada passo dado o que está em destaque (-1 = nenhum ainda). */
export function stepStates(count: number, current: number): StepState[] {
  return Array.from({ length: count }, (_, index) => (index < current ? 'done' : index === current ? 'active' : 'todo'));
}

const CIRCLE = 60;

export const StepByStep: React.FC<StepByStepProps & BaseProps> = ({ steps, active, revealAt, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const times = stepTimes(steps.length, revealAt, active);
  const pinned = fixedActive(steps.length, active);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: theme.safe.x }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          width: 820,
          padding: '48px 52px 22px 48px',
          opacity: value,
          translate: `${(1 - enter) * 64 + exit * 28}px 0`,
        }}
      >
        {steps.map((step, index) => {
          const appear = progressAt(frame, fps, times[index]!);
          const next = times[index + 1];
          // destaque e "feito" são contínuos (0–1) para a troca de passo não dar salto
          const passed = pinned === undefined ? (next === undefined ? 0 : progressAt(frame, fps, next)) : index < pinned ? appear : 0;
          const focus = pinned === undefined ? appear * (1 - passed) : index === pinned ? appear : 0;
          const last = index === steps.length - 1;
          const detail = step.detail?.trim();
          return (
            // 0fr→1fr: passo ainda não revelado não ocupa altura, então o cartão cresce junto com a lista
            <div key={index} style={{ display: 'grid', gridTemplateRows: `${appear}fr` }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 28, minHeight: 0, overflow: 'hidden', opacity: appear, translate: `${(1 - appear) * 24}px 0` }}>
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', width: CIRCLE }}>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: CIRCLE,
                    height: CIRCLE,
                    borderRadius: theme.radius.pill,
                    background: theme.color.white,
                    boxShadow: `inset 0 0 0 3px ${theme.color.slate300}`,
                  }}
                >
                  <div style={{ position: 'absolute', inset: 0, borderRadius: theme.radius.pill, background: theme.color.ink, opacity: passed }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: theme.radius.pill, background: theme.color.coral, opacity: focus }} />
                  <span
                    style={{
                      position: 'relative',
                      fontFamily: theme.font.body,
                      fontWeight: 800,
                      fontSize: 30,
                      lineHeight: 1,
                      color: interpolateColors(Math.min(1, focus + passed), [0, 1], [theme.color.slate600, theme.color.white]),
                    }}
                  >
                    {index + 1}
                  </span>
                </div>
                {last ? null : (
                  <div style={{ position: 'relative', flex: 1, width: 4, minHeight: 22, marginTop: 8, marginBottom: 8, borderRadius: theme.radius.pill, background: theme.color.slate300, opacity: next === undefined ? 0 : progressAt(frame, fps, next) }}>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: theme.radius.pill,
                        background: theme.color.ink,
                        scale: `1 ${passed}`,
                        transformOrigin: 'center top',
                      }}
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, paddingBottom: 26 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: CIRCLE,
                    fontFamily: theme.font.body,
                    fontWeight: 600,
                    fontSize: 38,
                    lineHeight: 1.22,
                    color: interpolateColors(Math.max(focus, passed * 0.55), [0, 1], [theme.color.slate600, theme.color.ink]),
                    overflowWrap: 'anywhere',
                  }}
                >
                  {step.title}
                </div>
                {detail ? (
                  // 0fr→1fr: só o passo em destaque abre o detalhe, e o cartão acompanha a altura
                  <div style={{ display: 'grid', gridTemplateRows: `${focus}fr` }}>
                    <div
                      style={{
                        minHeight: 0,
                        overflow: 'hidden',
                        opacity: focus,
                        fontFamily: theme.font.body,
                        fontWeight: 500,
                        fontSize: 34,
                        lineHeight: 1.32,
                        color: theme.color.slate600,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      <div style={{ paddingTop: 4, paddingBottom: 6 }}>{detail}</div>
                    </div>
                  </div>
                ) : null}
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
  component: StepByStep,
  sample: {
    steps: [
      { title: 'Crie o repositório', detail: 'git init na pasta do projeto' },
      { title: 'Faça o primeiro commit', detail: 'git add . e git commit -m "inicial"' },
      { title: 'Conecte ao GitHub', detail: 'git remote add origin com a URL do repositório' },
      { title: 'Envie o código', detail: 'git push -u origin main' },
    ],
    revealAt: [0.5, 2.2, 4, 5.8],
  },
  defaultDuration: 9,
  description: 'Tutorial ou processo em passos numerados e ordenados; cada passo entra quando é falado e o atual fica em destaque.',
};
