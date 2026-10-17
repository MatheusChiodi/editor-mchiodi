import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import { easeInOut, easeOutQuad, stageMotion } from '../arsenal/stage';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface ProgressStep {
  /** segundos, relativos ao início do overlay, em que este passo vira o atual */
  at: number;
  /** nome curto do passo, mostrado ao lado dos números enquanto ele é o atual */
  name?: string;
}

export interface StageProgressProps {
  /** rótulo em caixa alta ("Exemplo", "Capítulo", "Passo") */
  label?: string;
  steps: ProgressStep[];
  /** quantos passos existem no total; sem valor, o tamanho de `steps` */
  total?: number;
  corner?: 'top-left' | 'top-right';
}

export const MAX_STEPS = 8;
/** altura do indicador: 4,4% do quadro (o da referência tem 3% e some no celular) */
export const CHIP = 48;
/** frames da troca de passo (o ativo cresce e o anterior volta) */
export const SWAP_SEC = 6 / 30;
/** no fim, todos os passos acendem por este tempo antes de o indicador sair */
export const WRAP_SEC = 0.5;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Passos válidos, em ordem de tempo. */
export function progressSteps(steps: unknown): ProgressStep[] {
  if (!Array.isArray(steps)) return [];
  return (steps as ProgressStep[])
    .filter((step) => step && finite(step.at) && step.at >= 0)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_STEPS);
}

export function stepCount(total: unknown, steps: readonly ProgressStep[]): number {
  return Math.min(MAX_STEPS, Math.max(steps.length, finite(total) ? Math.round(total) : 0));
}

/** Índice do passo atual em `sec` (−1 antes do primeiro). */
export function activeStep(steps: readonly ProgressStep[], sec: number): number {
  let active = -1;
  steps.forEach((step, index) => {
    if (sec >= step.at) active = index;
  });
  return active;
}

/** Quanto o passo `index` está "aceso" (0–1): sobe em 6 f quando vira o atual e desce em 6 f quando o próximo assume. */
export function stepGlow(steps: readonly ProgressStep[], index: number, sec: number): number {
  const step = steps[index];
  if (!step) return 0;
  const next = steps[index + 1];
  return easeOutQuad((sec - step.at) / SWAP_SEC) * (next ? 1 - easeOutQuad((sec - next.at) / SWAP_SEC) : 1);
}

/**
 * Indicador de progresso que atravessa vários layouts ("EXEMPLO 2/6", capítulos, passos): fica numa camada
 * fixa por cima do gráfico da vez. Na EDL, marque o overlay com `"layer": "persistent"` para ele conviver com
 * os outros. Melhor que o da referência: maior, dentro da margem, com o nome do passo e troca animada.
 */
export const StageProgress: React.FC<StageProgressProps & BaseProps> = ({ label = 'Passo', steps: rawSteps, total, corner = 'top-left', durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const end = durationInFrames / fps;
  const steps = progressSteps(rawSteps);
  const count = stepCount(total, steps);
  const active = activeStep(steps, sec);
  const appear = easeOutQuad(sec / stageMotion.pill.sec);
  const leaving = easeInOut((sec - (end - stageMotion.exit.sec)) / stageMotion.exit.sec);
  // fecho da série: todos acendem um pouco antes de o indicador sair
  const wrap = easeOutQuad((sec - (end - stageMotion.exit.sec - WRAP_SEC)) / SWAP_SEC);
  const right = corner === 'top-right';
  const name = active >= 0 ? steps[active]!.name : undefined;
  const nameIn = active >= 0 ? easeOutQuad((sec - steps[active]!.at) / stageMotion.pill.sec) : 0;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 22,
          [right ? 'right' : 'left']: theme.safe.x,
          display: 'flex',
          flexDirection: right ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 10,
          opacity: Math.min(1, appear * 2) * (1 - leaving),
          translate: `0 ${(1 - appear) * -18}px`,
        }}
      >
        <div
          style={{
            height: CHIP,
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 12,
            background: 'rgba(17,24,39,0.86)',
            color: theme.color.paper,
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            boxShadow: '0 3px 4px rgba(15,23,42,0.22), 0 12px 36px rgba(15,23,42,0.14)',
          }}
        >
          {label}
        </div>
        {Array.from({ length: count }, (_, index) => {
          const glow = Math.max(stepGlow(steps, index, sec), wrap);
          const done = index < active;
          return (
            <div
              key={index}
              style={{
                position: 'relative',
                width: CHIP,
                height: CHIP,
                borderRadius: 12,
                overflow: 'hidden',
                background: theme.color.paper,
                boxShadow: 'inset 0 -3px 0 rgba(15,23,42,0.14), 0 3px 4px rgba(15,23,42,0.22), 0 12px 36px rgba(15,23,42,0.14)',
                // o passo atual é maior, além de coral
                scale: String(1 + 0.17 * glow),
                zIndex: glow > 0.01 ? 1 : 0,
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: theme.color.coral, opacity: glow }} />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.font.body,
                  fontWeight: 800,
                  fontSize: 28,
                  // tinta sobre coral e sobre papel: contraste acima de 4,5 nos dois estados
                  color: theme.color.ink,
                  opacity: done || glow > 0.5 ? 1 : 0.55,
                }}
              >
                {index + 1}
              </div>
            </div>
          );
        })}
        {name ? (
          <div
            style={{
              marginLeft: right ? 0 : 8,
              marginRight: right ? 8 : 0,
              height: CHIP,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 12,
              background: theme.color.paper,
              color: theme.color.ink,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: 28,
              whiteSpace: 'nowrap',
              boxShadow: 'inset 0 -3px 0 rgba(15,23,42,0.14), 0 3px 4px rgba(15,23,42,0.22), 0 12px 36px rgba(15,23,42,0.14)',
              opacity: Math.min(1, nameIn * 3),
              translate: `${(1 - nameIn) * (right ? 14 : -14)}px 0`,
            }}
          >
            {name}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: StageProgress,
  sample: {
    label: 'Exemplo',
    total: 6,
    steps: [
      { at: 0, name: 'apagar arquivos' },
      { at: 2.2, name: 'lixeira' },
      { at: 4.4, name: 'histórico' },
    ],
  },
  defaultDuration: 7,
  vertical: { zone: 'skip' },
  description:
    'Indicador de progresso persistente ("EXEMPLO 2/6", capítulos, passos) que atravessa vários layouts: rótulo, chips numerados com o atual em coral e maior, e o nome do passo. Use com `"layer": "persistent"` no overlay, cobrindo a série inteira; `steps[].at` marca quando cada passo vira o atual.',
};
