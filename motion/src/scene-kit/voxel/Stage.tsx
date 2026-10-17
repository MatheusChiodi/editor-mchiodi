import { useThree } from '@react-three/fiber';
import { ThreeCanvas } from '@remotion/three';
import { useLayoutEffect } from 'react';
import { AbsoluteFill, random, useVideoConfig } from 'remotion';
import type * as THREE from 'three';

import { applyPose, horizonY } from './camera';
import { voxelPalette } from './theme';
import type { CameraPose, Vec3 } from './types';

export interface SkyProps {
  stops: string[];
  /** posição de cada cor entre o topo (0) e o horizonte (1); o padrão é espaçamento igual */
  positions?: number[];
  /** comprime o degradê acima do horizonte, para o chão sumir na última cor */
  toHorizon?: boolean;
  stars?: number;
  sun?: { x: number; y: number; size: number };
}

const STARS = new Array(90).fill(0).map((_, i) => ({
  left: random(`star-x-${i}`) * 100,
  top: random(`star-y-${i}`) * 72,
  size: 4 + Math.floor(random(`star-s-${i}`) * 3) * 2,
  alpha: 0.35 + random(`star-a-${i}`) * 0.65,
}));

/** CSS do degradê do céu. `horizon` é a fração da altura onde fica o horizonte. */
export function skyGradient({ stops, positions, toHorizon = false }: Pick<SkyProps, 'stops' | 'positions' | 'toHorizon'>, horizon: number): string {
  const reach = toHorizon ? Math.max(8, Math.min(100, horizon * 100)) : 100;
  const gradient = stops
    .map((color, i) => {
      const at = positions?.[i] ?? (stops.length > 1 ? i / (stops.length - 1) : 0);
      return `${color} ${(at * reach).toFixed(2)}%`;
    })
    .join(', ');
  return `linear-gradient(180deg, ${gradient})`;
}

const Sky: React.FC<SkyProps & { horizon: number }> = ({ stars = 0, sun, horizon, ...sky }) => (
  <AbsoluteFill style={{ background: skyGradient(sky, horizon) }}>
    {stars > 0
      ? STARS.map((star, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              background: voxelPalette.text,
              opacity: star.alpha * stars,
            }}
          />
        ))
      : null}
    {sun ? (
      <div
        style={{
          position: 'absolute',
          left: sun.x - sun.size / 2,
          top: sun.y - sun.size / 2,
          width: sun.size,
          height: sun.size,
          background: '#FFF1C2',
          boxShadow: `0 0 0 ${sun.size * 0.14}px rgba(255, 226, 150, 0.45), 0 0 0 ${sun.size * 0.3}px rgba(255, 200, 130, 0.22)`,
        }}
      />
    ) : null}
  </AbsoluteFill>
);

const CameraRig: React.FC<{ pose: CameraPose; aspect: number }> = ({ pose, aspect }) => {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    applyPose(camera as THREE.PerspectiveCamera, pose, aspect);
  }, [camera, pose, aspect]);
  return null;
};

export interface Light {
  color: string;
  intensity: number;
}

export interface StageProps {
  sky: SkyProps;
  pose: CameraPose;
  ambient: Light;
  sun: Light & { position: Vec3 };
  fog?: { color: string; near: number; far: number };
  children: React.ReactNode;
}

/** Palco 3D: céu em CSS por trás, canvas Three por cima, câmera e luzes vindas de props (função do frame). */
export const Stage: React.FC<StageProps> = ({ sky, pose, ambient, sun, fog, children }) => {
  const { width, height } = useVideoConfig();
  const horizon = horizonY(pose, width, height) / height;

  return (
    <AbsoluteFill>
      <Sky {...sky} horizon={horizon} />
      <ThreeCanvas
        flat
        dpr={1}
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0 }}
        camera={{ fov: pose.fov, position: pose.position, near: 0.1, far: 400 }}
      >
        <CameraRig pose={pose} aspect={width / height} />
        {fog ? <fog attach="fog" args={[fog.color, fog.near, fog.far]} /> : null}
        <ambientLight color={ambient.color} intensity={ambient.intensity} />
        <directionalLight color={sun.color} intensity={sun.intensity} position={sun.position} />
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
