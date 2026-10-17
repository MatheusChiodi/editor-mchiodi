import { useMemo } from 'react';
import { useVideoConfig } from 'remotion';

import { theme } from '../theme';
import { dropShadowCss, castShadow } from './light-math';
import { baselineReveal, type MaskSpec, maskStyle } from './mask-math';
import { tornWipe, type TornWipeOptions } from './texture-math';

export interface MaskRevealProps {
  /** qual máscara e seus parâmetros (inclui `progress`) */
  mask: MaskSpec;
  /** preenche o pai (padrão) ou envolve o conteúdo em linha */
  fill?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Revela o conteúdo por uma máscara do kit: `iris`, `band`, `ink`, `blinds` ou `shape`.
 *
 * @example
 * <MaskReveal mask={{ type: 'ink', progress, seed: 4, mode: 'bloom', origin: { x: 0.3, y: 0.6 } }}><CenaNova /></MaskReveal>
 */
export const MaskReveal: React.FC<MaskRevealProps> = ({ mask, fill = true, style, children }) => (
  <div style={{ ...(fill ? { position: 'absolute', inset: 0 } : { display: 'inline-block' }), ...maskStyle(mask), ...style }}>{children}</div>
);

export interface WordMaskProps {
  /** 0→1 (use `springProgress` com a mola `suave` ou `firme`) */
  progress: number;
  /** distância da subida em em */
  distance?: number;
  /** inclinação inicial em graus: a palavra endireita ao chegar */
  tilt?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Uma palavra (ou caractere) que sobe por trás da própria linha de base. A unidade da tipografia do canal:
 * componha frases com um `<WordMask>` por palavra e `staggerDelays` para os atrasos.
 */
export const WordMask: React.FC<WordMaskProps> = ({ progress, distance = 1.05, tilt = 4, style, children }) => {
  const { clipPath, translateEm } = baselineReveal(progress, { distance });
  return (
    <span style={{ display: 'inline-block', clipPath: progress >= 1 ? undefined : clipPath, verticalAlign: 'bottom', ...style }}>
      <span style={{ display: 'inline-block', translate: `0 ${translateEm}em`, rotate: `${((1 - progress) * tilt).toFixed(2)}deg`, transformOrigin: '0% 100%' }}>{children}</span>
    </span>
  );
};

export interface TornRevealProps extends Omit<TornWipeOptions, 'width' | 'height'> {
  /** cor do miolo do papel que aparece na borda do rasgo */
  coreColor?: string;
  children: React.ReactNode;
}

/**
 * Rasgo de papel com espessura: a região coberta é recortada por uma borda orgânica, com o miolo branco do papel
 * e sombra projetada ao longo do rasgo. Substitui o rasgo em dente de serra.
 */
export const TornReveal: React.FC<TornRevealProps> = ({ coreColor = theme.color.white, children, ...options }) => {
  const { width, height } = useVideoConfig();
  const face = useMemo(() => tornWipe({ ...options, width, height }), [options, width, height]);
  const core = useMemo(() => tornWipe({ ...options, width, height, seed: (options.seed ?? 1) + 50, amplitude: (options.amplitude ?? 16) * 1.25 }), [options, width, height]);
  if (options.progress <= 0) return null;
  if (options.progress >= 1) return <div style={{ position: 'absolute', inset: 0 }}>{children}</div>;
  const direction = options.from === 'right' ? -1 : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, filter: dropShadowCss(castShadow({ elevation: 26, lightAngle: direction === 1 ? 180 : 0 })) }}>
      <div style={{ position: 'absolute', inset: 0, background: coreColor, clipPath: `path('${core.path}')`, translate: `${direction * 7}px 0` }} />
      <div style={{ position: 'absolute', inset: 0, clipPath: `path('${face.path}')` }}>{children}</div>
    </div>
  );
};
