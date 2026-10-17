import * as THREE from 'three';

import type { CameraPose, Vec3 } from './types';

const rad = (deg: number) => (deg * Math.PI) / 180;

export interface OrbitOptions {
  target: Vec3;
  distance: number;
  /** graus em torno do alvo; 0 olha de frente (do +z para o alvo) */
  azimuth: number;
  /** graus acima do horizonte */
  elevation: number;
  fov?: number;
}

/** Pose de câmera que orbita um alvo: o jeito mais simples de enquadrar um pedaço do mundo. */
export function orbitPose({ target, distance, azimuth, elevation, fov = 40 }: OrbitOptions): CameraPose {
  const horizontal = Math.cos(rad(elevation)) * distance;
  return {
    target,
    fov,
    position: [
      target[0] + Math.sin(rad(azimuth)) * horizontal,
      target[1] + Math.sin(rad(elevation)) * distance,
      target[2] + Math.cos(rad(azimuth)) * horizontal,
    ],
  };
}

// forma exata nos extremos: t = 0 devolve `a` e t = 1 devolve `b` sem resíduo de ponto flutuante
const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const mixVec = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Interpola duas poses: movimento de câmera é função pura do frame. */
export function mixPose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  return {
    position: mixVec(a.position, b.position, t),
    target: mixVec(a.target, b.target, t),
    fov: mix(a.fov, b.fov, t),
  };
}

export function applyPose(camera: THREE.PerspectiveCamera, pose: CameraPose, aspect: number): void {
  camera.position.set(...pose.position);
  camera.fov = pose.fov;
  camera.aspect = aspect;
  camera.near = 0.1;
  camera.far = 400;
  camera.lookAt(...pose.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

const projector = new THREE.PerspectiveCamera();
const point = new THREE.Vector3();

/** Ponto do mundo → pixel da tela, para ancorar UI 2D (rótulos, tooltips) em cima de um bloco. */
export function projectToScreen(pose: CameraPose, world: Vec3, width: number, height: number): { x: number; y: number } {
  applyPose(projector, pose, width / height);
  point.set(...world).project(projector);
  return {
    x: (point.x * 0.5 + 0.5) * width,
    y: (-point.y * 0.5 + 0.5) * height,
  };
}

/** Altura (px) da linha do horizonte: onde o degradê do céu precisa terminar. */
export function horizonY(pose: CameraPose, width: number, height: number): number {
  const dx = pose.target[0] - pose.position[0];
  const dz = pose.target[2] - pose.position[2];
  const length = Math.hypot(dx, dz) || 1;
  const far: Vec3 = [pose.position[0] + (dx / length) * 5000, 0.5, pose.position[2] + (dz / length) * 5000];
  return projectToScreen(pose, far, width, height).y;
}
