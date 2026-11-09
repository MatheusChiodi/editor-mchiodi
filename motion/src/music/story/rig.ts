import type { MoodId, PoseId } from '../types';

/**
 * Esqueleto do personagem (unidades do desenho: ~210 de altura, de frente para a direita). Ângulos em graus, medidos a
 * partir de "apontando para baixo", positivos para a frente: braço 0 = caído, 90 = horizontal à frente, 180 = para cima.
 * Cotovelo e joelho são flexões em relação ao segmento de cima.
 */
export interface Joints {
  /** deslocamento vertical do corpo (respiração, sentado) */
  bodyY: number;
  /** inclinação do tronco: + para a frente */
  torsoTilt: number;
  headTilt: number;
  lArm: [number, number];
  rArm: [number, number];
  lLeg: [number, number];
  rLeg: [number, number];
  /** 0 aberto … 1 fechado */
  eyesClosed: number;
  /** -1 triste … +1 sorriso */
  mouth: number;
  /** -1 franzida (preocupado/bravo) … +1 levantada */
  brow: number;
  /** olhar: x (trás −1 … +1 frente), y (cima −1 … +1 baixo) */
  gaze: [number, number];
  /** intensidade da lágrima, 0 ou 1 */
  tear: number;
}

export interface RigOptions {
  seated: boolean;
  /** muda o ritmo do respirar e do piscar entre personagens/cenas */
  seed?: number;
}

const MOODS: Record<MoodId, { mouth: number; brow: number; tear: number; eyes: number }> = {
  neutral: { mouth: 0, brow: 0, tear: 0, eyes: 0 },
  sad: { mouth: -0.6, brow: -0.7, tear: 0, eyes: 0.12 },
  cry: { mouth: -0.9, brow: -0.9, tear: 1, eyes: 0.35 },
  hopeful: { mouth: 0.3, brow: 0.5, tear: 0, eyes: 0 },
  angry: { mouth: -0.3, brow: -1, tear: 0, eyes: 0.1 },
  smile: { mouth: 0.9, brow: 0.3, tear: 0, eyes: 0.15 },
};

const rad = (deg: number) => (deg * Math.PI) / 180;
export const SHOULDER = { x: 0, y: -70 };
export const UPPER_ARM = 46;
export const FOREARM = 44;
export const THIGH = 56;
export const SHIN = 56;

/** Pose do personagem no instante `t` (s): base da pose, respiração, piscada e o humor por cima. */
export function rig(pose: PoseId, mood: MoodId, t: number, { seated, seed = 0 }: RigOptions): Joints {
  const m = MOODS[mood];
  const breath = Math.sin(t * 1.6 + seed) * 1.6;
  const phase = (t + seed * 0.7) % 3.4;
  const blink = phase < 0.14 ? Math.sin((Math.PI * phase) / 0.14) : 0;
  const sway = Math.sin(t * 0.9 + seed) * 2;
  const walk = Math.sin(t * 5.2 + seed);

  const j: Joints = {
    bodyY: breath,
    torsoTilt: 0,
    headTilt: 0,
    lArm: [4 + sway * 0.5, 6],
    rArm: [4 - sway * 0.5, 6],
    lLeg: [2, 0],
    rLeg: [-2, 0],
    eyesClosed: Math.max(blink, m.eyes),
    mouth: m.mouth,
    brow: m.brow,
    gaze: [0.2, 0],
    tear: m.tear,
  };

  switch (pose) {
    case 'walk':
      j.bodyY += Math.abs(Math.cos(t * 5.2 + seed)) * -3;
      j.torsoTilt = 4;
      j.lLeg = [walk * 28, Math.max(0, -walk) * 38];
      j.rLeg = [-walk * 28, Math.max(0, walk) * 38];
      j.lArm = [-walk * 24, 12];
      j.rArm = [walk * 24, 12];
      j.gaze = [0.7, 0.1];
      break;
    case 'phone':
      j.rArm = [72, 98];
      j.lArm = [12, 12];
      j.headTilt = 14;
      j.torsoTilt = 5;
      j.gaze = [0.1, 0.75];
      break;
    case 'typing': {
      const finger = Math.sin(t * 14 + seed) * 3;
      j.lArm = [42 + finger, 68];
      j.rArm = [47 - finger, 74];
      j.headTilt = 12;
      j.torsoTilt = 6;
      j.gaze = [0.1, 0.8];
      break;
    }
    case 'faceHands':
      j.lArm = [96, 128];
      j.rArm = [102, 132];
      j.headTilt = 18;
      j.torsoTilt = 9;
      j.gaze = [0, 0.9];
      if (mood === 'cry') j.bodyY += Math.sin(t * 18) * 1.6;
      break;
    case 'lookUp':
      j.headTilt = -14;
      j.torsoTilt = -3;
      j.gaze = [0.25, -0.85];
      break;
    case 'lookDown':
      j.headTilt = 18;
      j.torsoTilt = 6;
      j.gaze = [0.05, 0.9];
      break;
    case 'reach':
      j.rArm = [100 + Math.sin(t * 1.4) * 6, 10];
      j.torsoTilt = 5;
      j.gaze = [0.9, -0.1];
      break;
    case 'sit':
      j.lArm = [34, 62];
      j.rArm = [30, 66];
      j.gaze = [0.4, 0.3];
      break;
    case 'back':
    case 'stand':
      break;
  }

  if (seated) {
    j.bodyY += 52;
    j.lLeg = [86, 84];
    j.rLeg = [78, 80];
  }
  return j;
}

const point = (origin: { x: number; y: number }, angle: number, length: number) => ({ x: origin.x + Math.sin(rad(angle)) * length, y: origin.y + Math.cos(rad(angle)) * length });

/** Ombro: o ponto do tronco gira em torno do quadril com a inclinação. */
export function shoulderPosition(j: Pick<Joints, 'bodyY' | 'torsoTilt'>): { x: number; y: number } {
  const length = -SHOULDER.y;
  return { x: Math.sin(rad(j.torsoTilt)) * length, y: j.bodyY - Math.cos(rad(j.torsoTilt)) * length };
}

/** Posição das mãos (origem no quadril; ombro em y = −70 mais o deslocamento do corpo): onde colocar o celular, a foto. */
export function handPositions(j: Joints): { l: { x: number; y: number }; r: { x: number; y: number } } {
  const hand = (arm: [number, number]) => {
    const shoulder = shoulderPosition(j);
    const elbow = point(shoulder, arm[0] + j.torsoTilt, UPPER_ARM);
    return point(elbow, arm[0] + arm[1] + j.torsoTilt, FOREARM);
  };
  return { l: hand(j.lArm), r: hand(j.rArm) };
}
