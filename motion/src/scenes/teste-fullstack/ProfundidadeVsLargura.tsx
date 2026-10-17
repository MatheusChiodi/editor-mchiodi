import { useMemo } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { at } from '../../scene-kit/timing';
import {
  Burst,
  clamp,
  easeInOut,
  mixPose,
  orbitPose,
  pop,
  progress,
  projectToScreen,
  Stage,
  Tooltip,
  type Vec3,
  voxelPalette,
  VoxelWorld,
} from '../../scene-kit/voxel';
import { BREAK_FRAMES, DEEP, digPlan, layerType, ORE, oreFrame, WIDE, worldBlocks } from './depth-logic';

export interface ProfundidadeVsLarguraProps {
  /** segundos relativos ao início da cena */
  revealAt?: {
    /** a vala larga e rasa começa a ser cavada ("saber as duas coisas") */
    wide: number;
    /** o poço fundo começa a ser cavado */
    deep: number;
    /** rótulo "Profundidade" (quando a palavra é dita) */
    deepLabel: number;
    /** rótulo "Largura" */
    wideLabel: number;
  };
  wideLabel?: string;
  wideHint?: string;
  deepLabel?: string;
  deepHint?: string;
}

const DEFAULT_REVEAL = { wide: 1.3, deep: 3.3, deepLabel: 4.4, wideLabel: 5.5 };
const WIDE_ANCHOR: Vec3 = [WIDE.fromX + (WIDE.count - 1) / 2, 1.1, 0];
const DEEP_ANCHOR: Vec3 = [DEEP.x, 1.1, 0];

/**
 * "Profundidade versus largura" como mineração: os mesmos 6 blocos cavados de lado só arranham a grama;
 * cavados para baixo chegam no minério.
 */
export const ProfundidadeVsLargura: React.FC<ProfundidadeVsLarguraProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  wideLabel = 'Largura',
  wideHint = 'um pouco de tudo',
  deepLabel = 'Profundidade',
  deepHint = 'tudo de uma coisa',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const plan = useMemo(() => digPlan({ wide: revealAt.wide, deep: revealAt.deep }, fps), [revealAt.wide, revealAt.deep, fps]);
  const blocks = worldBlocks(frame, plan, voxelPalette.gem);
  const found = oreFrame(plan);
  const gem = pop(frame, found, fps);

  // o paredão fica na metade de baixo da área útil: sobra céu em cima para os rótulos e a faixa inferior fica com as legendas
  const wide = orbitPose({ target: [0, -3, 0], distance: 28.5, azimuth: 10, elevation: 15 });
  const close = orbitPose({ target: [0.6, -3.1, 0], distance: 26.5, azimuth: 6, elevation: 13 });
  const pose = mixPose(wide, close, progress(frame, at(revealAt.deep, fps), found + fps, easeInOut));

  const fade = interpolate(frame, [0, 6, durationInFrames - 6, durationInFrames], [0, 1, 1, 0], clamp);
  const flash = interpolate(frame, [found, found + 3, found + 14], [0, 0.35, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fade, backgroundColor: voxelPalette.dayBottom }}>
      <Stage
        sky={{ stops: [voxelPalette.dayTop, voxelPalette.dayBottom] }}
        pose={pose}
        ambient={{ color: '#FFFFFF', intensity: 2.1 }}
        sun={{ color: '#FFF4DD', intensity: 2.4, position: [8, 14, 9] }}
      >
        <VoxelWorld blocks={blocks} />
        {/* a recompensa: uma gema solta no fundo do poço, girando devagar */}
        {gem > 0 ? (
          <VoxelWorld
            blocks={[{ x: ORE.x, y: ORE.y + 1 + 0.08 * Math.sin(frame / 9), z: 0.1, type: `glow:${voxelPalette.gem}`, scale: 0.5 * gem, rotY: frame * 0.05 }]}
          />
        ) : null}
        {plan.map((step) => (
          <Burst
            key={`${step.x}:${step.y}`}
            frame={frame}
            start={step.frame + BREAK_FRAMES - 2}
            seed={`dig-${step.x}-${step.y}`}
            origin={[step.x, step.y, 0.6]}
            type={step.y === 0 ? 'dirt' : layerType(step.y)}
            count={8}
            life={18}
            size={0.24}
          />
        ))}
        <Burst
          frame={frame}
          start={found}
          seed="ore"
          origin={[ORE.x, ORE.y + 0.6, 0.7]}
          type={`glow:${voxelPalette.gem}`}
          count={20}
          life={34}
          speed={0.13}
          gravity={0.004}
          size={0.26}
        />
      </Stage>
      <Tooltip
        name={wideLabel}
        description={wideHint}
        enter={progress(frame, at(revealAt.wideLabel, fps), at(revealAt.wideLabel, fps) + 10)}
        anchor={projectToScreen(pose, WIDE_ANCHOR, width, height)}
      />
      <Tooltip
        name={deepLabel}
        description={deepHint}
        enter={progress(frame, at(revealAt.deepLabel, fps), at(revealAt.deepLabel, fps) + 10)}
        anchor={projectToScreen(pose, DEEP_ANCHOR, width, height)}
      />
      <AbsoluteFill style={{ background: voxelPalette.text, opacity: flash }} />
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: ProfundidadeVsLargura,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 6.4,
  description:
    'Cena voxel: "profundidade versus largura". Seis blocos cavados de lado (largura) contra seis cavados para baixo, que chegam no minério (profundidade).',
};

export const MODEL = 'LargoVersusFundo';
