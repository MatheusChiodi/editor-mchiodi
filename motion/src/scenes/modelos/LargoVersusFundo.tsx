// MODELO de animação reutilizável (kit VOXEL): na EDL entra como `scene:modelos/LargoVersusFundo`, em qualquer vídeo.
// Forma: um paredão em corte é cavado de dois jeitos com o MESMO número de blocos. De lado, só arranha a grama;
// para baixo, chega na gema. Dois rótulos de pixel nomeiam os lados. 100% por props; a lógica está em `largo-fundo-logic.ts`.
// O render do Remotion precisa de `gl: 'angle'` (Three.js), como toda cena do kit voxel.

import { useMemo } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { at } from '../../scene-kit/timing';
import { Burst, clamp, easeInOut, mixPose, orbitPose, pop, progress, projectToScreen, Stage, Tooltip, voxelPalette, VoxelWorld } from '../../scene-kit/voxel';
import { BREAK_FRAMES, digCount, digPlan, type DigReveal, digTimes, labelAnchors, layerType, oreFrame, orePosition, worldBlocks } from './largo-fundo-logic';

export interface LargoVersusFundoSide {
  label: string;
  /** linha de apoio embaixo do nome */
  hint?: string;
}

export interface LargoVersusFundoProps {
  /** o lado raso: muitos blocos na superfície */
  wide?: LargoVersusFundoSide;
  /** o lado fundo: os mesmos blocos, para baixo, até a gema */
  deep?: LargoVersusFundoSide;
  /** blocos cavados de cada lado (3 a 6) */
  count?: number;
  /** segundos relativos ao início da cena; o que faltar segue a escavação */
  revealAt?: DigReveal;
}

const DEFAULT_WIDE: LargoVersusFundoSide = { label: 'Largo', hint: 'um pouco de tudo' };
const DEFAULT_DEEP: LargoVersusFundoSide = { label: 'Fundo', hint: 'tudo de uma coisa' };

export const LargoVersusFundo: React.FC<LargoVersusFundoProps & BaseProps> = ({ wide = DEFAULT_WIDE, deep = DEFAULT_DEEP, count, revealAt, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const blocksPerSide = digCount(count);
  const times = digTimes(blocksPerSide, revealAt);
  const ore = orePosition(blocksPerSide);
  const anchors = labelAnchors(blocksPerSide);

  const plan = useMemo(() => digPlan(blocksPerSide, { wide: times.wide, deep: times.deep }, fps), [blocksPerSide, times.wide, times.deep, fps]);
  const blocks = worldBlocks(frame, plan, voxelPalette.gem);
  const found = oreFrame(plan);
  const gem = pop(frame, found, fps);

  // o paredão fica na metade de baixo da área útil: sobra céu em cima para os rótulos e a faixa inferior fica com as legendas
  const far = orbitPose({ target: [0, -3, 0], distance: 28.5, azimuth: 10, elevation: 15 });
  const close = orbitPose({ target: [0.6, -3.1, 0], distance: 26.5, azimuth: 6, elevation: 13 });
  const pose = mixPose(far, close, progress(frame, at(times.deep, fps), found + fps, easeInOut));

  const fade = interpolate(frame, [0, 6, durationInFrames - 6, durationInFrames], [0, 1, 1, 0], clamp);
  const flash = interpolate(frame, [found, found + 3, found + 14], [0, 0.35, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: fade, backgroundColor: voxelPalette.dayBottom }}>
      <Stage sky={{ stops: [voxelPalette.dayTop, voxelPalette.dayBottom] }} pose={pose} ambient={{ color: '#FFFFFF', intensity: 2.1 }} sun={{ color: '#FFF4DD', intensity: 2.4, position: [8, 14, 9] }}>
        <VoxelWorld blocks={blocks} />
        {/* a recompensa: uma gema solta no fundo do poço, girando devagar */}
        {gem > 0 ? <VoxelWorld blocks={[{ x: ore.x, y: ore.y + 1 + 0.08 * Math.sin(frame / 9), z: 0.1, type: `glow:${voxelPalette.gem}`, scale: 0.5 * gem, rotY: frame * 0.05 }]} /> : null}
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
        <Burst frame={frame} start={found} seed="ore" origin={[ore.x, ore.y + 0.6, 0.7]} type={`glow:${voxelPalette.gem}`} count={20} life={34} speed={0.13} gravity={0.004} size={0.26} />
      </Stage>
      <Tooltip name={wide.label} description={wide.hint} enter={progress(frame, at(times.wideLabel, fps), at(times.wideLabel, fps) + 10)} anchor={projectToScreen(pose, anchors.wide, width, height)} />
      <Tooltip name={deep.label} description={deep.hint} enter={progress(frame, at(times.deepLabel, fps), at(times.deepLabel, fps) + 10)} anchor={projectToScreen(pose, anchors.deep, width, height)} />
      <AbsoluteFill style={{ background: voxelPalette.text, opacity: flash }} />
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: LargoVersusFundo,
  sample: {
    wide: { label: 'Dez canais', hint: 'um post em cada' },
    deep: { label: 'Um canal', hint: 'todo dia, um ano' },
    count: 5,
    revealAt: { wide: 1.3, deep: 3.3, deepLabel: 4.4, wideLabel: 5.5 },
  },
  defaultDuration: 6.4,
  description:
    'Cena voxel para a fala "com o mesmo esforço, espalhar ou aprofundar": o mesmo número de blocos é cavado de lado (só arranha a superfície) e para baixo ' +
    '(chega na gema), com um rótulo de pixel em cada lado. Serve para generalista e especialista, muitos projetos e um projeto, vários canais e um canal, amplitude e foco.',
  tags: ['comparação', 'voxel', 'profundidade', 'largura', 'dois-lados'],
  origin: { project: 'teste-fullstack', date: '2026-10-12', scene: 'teste-fullstack/ProfundidadeVsLargura' },
  slots: [
    { name: 'wide', type: '{ label: string; hint?: string }', description: 'rótulo do lado raso, à esquerda; nome até ~14 caracteres e apoio até ~24' },
    { name: 'deep', type: '{ label: string; hint?: string }', description: 'rótulo do lado fundo, à direita, o que chega na gema; mesmos limites' },
    { name: 'count', type: 'number? (3 a 6)', description: 'blocos cavados de cada lado; padrão 6. A gema fica logo abaixo do último do poço' },
    { name: 'revealAt', type: '{ wide?: number; deep?: number; deepLabel?: number; wideLabel?: number }', description: 'segundo em que cada escavação começa e em que cada rótulo entra (quando a palavra é dita)' },
  ],
};
