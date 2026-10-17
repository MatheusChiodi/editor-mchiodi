import { wiggle } from './noise';
import { type SpringInput, springValue } from './spring';

// Câmera 2.5D: o quadro é desenhado plano (como ficaria com a câmera em repouso) e cada plano recebe uma
// profundidade. Quando a câmera se move, a matemática de uma câmera pinhole separa os planos sozinha:
// o que está perto anda e cresce mais, o que está longe quase não se mexe. É daí que vem a sensação de espaço.

export interface CameraState {
  /** truck: desloca a câmera para a direita, em px do plano 0 (gera parallax) */
  x: number;
  /** pedestal: desloca a câmera para baixo, em px do plano 0 (gera parallax) */
  y: number;
  /** dolly: avança a câmera, em px de profundidade (positivo = entra na cena) */
  z: number;
  /** pan em graus (gira para a direita): desloca tudo junto, SEM parallax, como uma câmera real girando no tripé */
  pan: number;
  /** tilt em graus (gira para baixo): idem, na vertical */
  tilt: number;
  /** roll em graus (horizonte inclinado). Passe de 2° só em impacto */
  roll: number;
  /** profundidade que está em foco */
  focus: number;
  /** abertura: desfoque em px de um plano infinitamente distante do foco (0 desliga a profundidade de campo) */
  aperture: number;
}

export const CAMERA_REST: CameraState = { x: 0, y: 0, z: 0, pan: 0, tilt: 0, roll: 0, focus: 0, aperture: 0 };

export type CameraEase = 'smooth' | 'linear' | 'hold' | 'in' | 'out' | SpringInput;

export interface CameraKeyframe extends Partial<CameraState> {
  frame: number;
  /** como CHEGAR neste keyframe a partir do anterior (padrão `smooth`). Mola: o tempo entre os keyframes é ignorado, vale a física */
  ease?: CameraEase;
}

const SPRING_NAMES = new Set(['suave', 'firme', 'elastica', 'pesada']);

function eased(t: number, ease: CameraEase, seconds: number): number {
  if (typeof ease === 'object' || SPRING_NAMES.has(ease)) return springValue(t * seconds, ease as SpringInput);
  switch (ease) {
    case 'linear':
      return t;
    case 'hold':
      return t >= 1 ? 1 : 0;
    case 'in':
      return t * t * t;
    case 'out':
      return 1 - (1 - t) ** 3;
    default:
      // smootherstep: parte e chega com velocidade E aceleração zero (câmera com massa)
      return t * t * t * (t * (t * 6 - 15) + 10);
  }
}

const CHANNELS = ['x', 'y', 'z', 'pan', 'tilt', 'roll', 'focus', 'aperture'] as const;

/**
 * Estado da câmera num frame. Cada canal é interpolado entre os keyframes QUE O DEFINEM: um keyframe só de
 * `focus` no meio de um dolly faz o rack focus sem interromper o dolly.
 */
export function cameraAt(frame: number, keyframes: readonly CameraKeyframe[], fps = 30): CameraState {
  const state: CameraState = { ...CAMERA_REST };
  const ordered = [...keyframes].sort((a, b) => a.frame - b.frame);
  for (const channel of CHANNELS) {
    const keys = ordered.filter((key) => key[channel] !== undefined);
    if (keys.length === 0) continue;
    const first = keys[0]!;
    if (frame <= first.frame) {
      state[channel] = first[channel]!;
      continue;
    }
    let value = keys[keys.length - 1]![channel]!;
    for (let index = 1; index < keys.length; index += 1) {
      const from = keys[index - 1]!;
      const to = keys[index]!;
      const ease = to.ease ?? 'smooth';
      const isSpring = typeof ease === 'object' || SPRING_NAMES.has(ease);
      const isLast = index === keys.length - 1;
      // a mola continua acomodando depois do keyframe; por isso o último trecho não é cortado no tempo
      if (frame < to.frame || (isLast && isSpring)) {
        const span = Math.max(1, to.frame - from.frame);
        const t = isSpring ? (frame - from.frame) / span : Math.min(1, (frame - from.frame) / span);
        value = from[channel]! + (to[channel]! - from[channel]!) * eased(t, ease, span / fps);
        break;
      }
    }
    state[channel] = value;
  }
  return state;
}

export interface ShakeOptions {
  /** deslocamento máximo em px (2–4 = câmera na mão respirando; 10–18 = impacto) */
  amplitude?: number;
  /** oscilações por segundo */
  frequency?: number;
  /** rotação máxima em graus */
  rotation?: number;
  seed?: number;
  /** 0–1: envelope externo (ex.: decaimento depois de um impacto) */
  envelope?: number;
}

/** Tremor orgânico de câmera, com semente. Some com o resultado ao `x`/`y`/`roll` da câmera. */
export function cameraShake(frame: number, fps: number, { amplitude = 3, frequency = 0.6, rotation = 0.15, seed = 1, envelope = 1 }: ShakeOptions = {}): Pick<CameraState, 'x' | 'y' | 'roll'> {
  return {
    x: wiggle(frame, fps, { frequency, amplitude: amplitude * envelope, seed, octaves: 3 }),
    y: wiggle(frame, fps, { frequency: frequency * 1.17, amplitude: amplitude * 0.8 * envelope, seed: seed + 53, octaves: 3 }),
    roll: wiggle(frame, fps, { frequency: frequency * 0.7, amplitude: rotation * envelope, seed: seed + 97, octaves: 2 }),
  };
}

/** Envelope de impacto: 1 no frame do impacto, decaindo exponencialmente (meia-vida em segundos). */
export function impactEnvelope(frame: number, impactFrame: number, fps: number, halfLife = 0.12): number {
  if (frame < impactFrame) return 0;
  return 0.5 ** ((frame - impactFrame) / fps / halfLife);
}

export interface LensOptions {
  /** distância focal em px: menor = grande-angular (parallax e dolly exagerados); maior = teleobjetiva (planos achatados) */
  focalLength?: number;
  /** desfoque máximo em px (protege o custo de render) */
  maxBlur?: number;
  /** distância mínima da câmera: o plano que passa disso some (atravessou a lente) */
  near?: number;
}

export interface LayerProjection {
  /** escala relativa ao repouso (1 = como foi desenhado) */
  scale: number;
  /** deslocamento em px de tela */
  x: number;
  y: number;
  /** desfoque de profundidade de campo, em px */
  blur: number;
  /** falso quando o plano passou para trás da câmera */
  visible: boolean;
  /** distância do plano à câmera, em px */
  distance: number;
}

export const DEFAULT_FOCAL_LENGTH = 1200;

/**
 * Onde um plano de profundidade `depth` cai na tela. `depth` 0 é o plano do assunto; positivo vai para o fundo,
 * negativo vem para o primeiro plano. Com a câmera em repouso todo plano tem escala 1 e deslocamento 0.
 */
export function projectLayer(camera: CameraState, depth: number, { focalLength = DEFAULT_FOCAL_LENGTH, maxBlur = 28, near = 60 }: LensOptions = {}): LayerProjection {
  const rest = focalLength + depth;
  const distance = rest - camera.z;
  if (distance <= near || rest <= 0) return { scale: 0, x: 0, y: 0, blur: 0, visible: false, distance };
  const scale = rest / distance;
  // truck/pedestal movem a câmera: o deslocamento na tela cai com a distância (parallax)
  const parallax = focalLength / distance;
  // pan/tilt giram a câmera: deslocamento igual para todos os planos
  const rotateX = Math.tan((camera.pan * Math.PI) / 180) * focalLength;
  const rotateY = Math.tan((camera.tilt * Math.PI) / 180) * focalLength;
  const focusDistance = Math.max(near, focalLength + camera.focus - camera.z);
  const blur = Math.min(maxBlur, camera.aperture * Math.abs(1 - focusDistance / distance));
  return {
    scale,
    x: -camera.x * parallax - rotateX,
    y: -camera.y * parallax - rotateY,
    blur: blur < 0.35 ? 0 : Math.round(blur * 10) / 10,
    visible: true,
    distance,
  };
}

/** `transform` CSS de um plano projetado (origem no centro do quadro). */
export function layerTransform(projection: LayerProjection): string {
  const round = (value: number): number => Math.round(value * 100) / 100;
  return `translate(${round(projection.x)}px, ${round(projection.y)}px) scale(${Math.round(projection.scale * 10000) / 10000})`;
}

/** Soma dois estados parciais (ex.: keyframes + tremor). */
export function addCamera(base: CameraState, extra: Partial<CameraState>): CameraState {
  const result = { ...base };
  for (const channel of CHANNELS) result[channel] += extra[channel] ?? 0;
  return result;
}
