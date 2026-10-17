import { createContext, useContext, useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { addCamera, CAMERA_REST, cameraAt, type CameraKeyframe, cameraShake, type CameraState, type LayerProjection, layerTransform, type LensOptions, projectLayer, type ShakeOptions } from './camera-math';

interface CameraContextValue {
  state: CameraState;
  lens: LensOptions;
}

const CameraContext = createContext<CameraContextValue>({ state: CAMERA_REST, lens: {} });

/** Estado atual da câmera (para um filho reagir: sombra, luz, vinheta). */
export function useCamera(): CameraState {
  return useContext(CameraContext).state;
}

/** Projeção de um plano na câmera atual, para quem precisa posicionar algo à mão. */
export function useLayer(depth: number): LayerProjection {
  const { state, lens } = useContext(CameraContext);
  return projectLayer(state, depth, lens);
}

export interface CameraProps {
  /** percurso da câmera; cada canal é interpolado entre os keyframes que o definem */
  keyframes?: readonly CameraKeyframe[];
  /** estado direto (ignora `keyframes`): para câmera calculada fora, ou subframes de motion blur */
  state?: CameraState;
  /** tremor orgânico somado ao percurso; `true` usa a respiração padrão de câmera na mão */
  shake?: ShakeOptions | boolean;
  lens?: LensOptions;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** Escala mínima para um quadro girado em `degrees` continuar cobrindo a tela (sem cantos vazios). */
export function rollCover(degrees: number, aspect: number): number {
  const radians = Math.abs((degrees * Math.PI) / 180);
  return Math.cos(radians) + Math.max(aspect, 1 / aspect) * Math.sin(radians);
}

/**
 * Câmera virtual 2.5D. Desenhe a cena plana, distribua em `<Layer depth>` e mova a câmera: parallax, dolly,
 * rack focus e profundidade de campo saem da projeção.
 *
 * @example
 * <Camera shake keyframes={[
 *   { frame: 0, z: -260, x: -80, focus: -500, aperture: 14 },
 *   { frame: 36, z: 0, x: 0, focus: 0, ease: 'pesada' },   // dolly-in + rack focus para o assunto
 *   { frame: 240, z: 90, x: 40 },                           // deriva lenta: a câmera nunca para
 * ]}>
 *   <Layer depth={1800} bleed={160}><Fundo /></Layer>
 *   <Layer depth={0}><Assunto /></Layer>
 *   <Layer depth={-500}><PrimeiroPlano /></Layer>
 * </Camera>
 */
export const Camera: React.FC<CameraProps> = ({ keyframes, state, shake, lens, style, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const value = useMemo<CameraContextValue>(() => {
    const base = state ?? (keyframes ? cameraAt(frame, keyframes, fps) : CAMERA_REST);
    const shaken = shake ? addCamera(base, cameraShake(frame, fps, shake === true ? {} : shake)) : base;
    return { state: shaken, lens: lens ?? {} };
  }, [state, keyframes, frame, fps, shake, lens]);
  const roll = value.state.roll;
  return (
    <CameraContext.Provider value={value}>
      <AbsoluteFill style={{ overflow: 'hidden', ...style }}>
        <AbsoluteFill style={roll ? { transform: `rotate(${-roll}deg) scale(${rollCover(roll, width / height)})` } : undefined}>{children}</AbsoluteFill>
      </AbsoluteFill>
    </CameraContext.Provider>
  );
};

export interface LayerProps {
  /** 0 = plano do assunto; positivo = fundo; negativo = primeiro plano (px de profundidade) */
  depth: number;
  /** falso desliga a profundidade de campo neste plano (conteúdo já desfocado, ou plano caro demais para borrar) */
  dof?: boolean;
  /** sangria em px além do quadro: fundos precisam de sobra para o pan/truck não mostrar a borda */
  bleed?: number;
  /** 0–1: opacidade extra do plano */
  opacity?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** Um plano da cena. Tem de estar dentro de `<Camera>`. */
export const Layer: React.FC<LayerProps> = ({ depth, dof = true, bleed = 0, opacity = 1, style, children }) => {
  const projection = useLayer(depth);
  if (!projection.visible) return null;
  // quem chega muito perto da lente dissolve antes de atravessar, em vez de estourar na tela
  const proximity = Math.min(1, Math.max(0, (projection.distance - 60) / 180));
  return (
    <AbsoluteFill
      style={{
        inset: -bleed,
        width: 'auto',
        height: 'auto',
        transform: layerTransform(projection),
        transformOrigin: '50% 50%',
        filter: dof && projection.blur > 0 ? `blur(${projection.blur}px)` : undefined,
        opacity: opacity * proximity,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
