import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { presence } from '../anim';
import { motion, theme } from '../theme';
import { alpha, CAPTION_ZONE, type Tone, toneColors } from './tokens';

export interface SceneBackgroundProps {
  tone?: Tone;
  /** duração da cena: com ela o fundo inteiro entra e sai junto (fade curto sobre o footage) */
  durationInFrames?: number;
  /** false tira a margem segura e a faixa de legenda, para conteúdo que sangra a tela */
  padded?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const GLOW_SIZE = 1100;

// Grão em ladrilho: o Chrome rasteriza o SVG uma vez e repete, em vez de gerar ruído em tela cheia a cada frame.
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0"/></filter><rect width="240" height="240" filter="url(#n)"/></svg>',
)}")`;

/** Disco de glow já "desfocado": gradiente radial de duas cores, sem `filter: blur` (caro por frame). */
function glow(inner: string, outer: string, strength: number): string {
  return `radial-gradient(closest-side, ${alpha(inner, strength)} 0%, ${alpha(outer, strength * 0.45)} 45%, ${alpha(outer, 0)} 100%)`;
}

/**
 * Fundo de toda cena ilustrativa: papel, um glow no alto à esquerda, outro embaixo à direita e grão sutil.
 * Os filhos ficam dentro da margem segura, acima da faixa das legendas.
 */
export const SceneBackground: React.FC<SceneBackgroundProps> = ({ tone = 'paper', durationInFrames, padded = true, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = toneColors(tone);
  const night = tone === 'night';
  const drift = Math.sin((frame / fps) * 0.6) * 40;
  const opacity = durationInFrames ? presence(frame, fps, durationInFrames, motion.fast, motion.fast).value : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, opacity, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: -GLOW_SIZE * 0.42 + drift,
          left: -GLOW_SIZE * 0.36,
          width: GLOW_SIZE,
          height: GLOW_SIZE,
          background: glow(theme.color.glowMint, theme.color.glowPeriwinkle, night ? 0.22 : 0.6),
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -GLOW_SIZE * 0.42 - drift,
          right: -GLOW_SIZE * 0.36,
          width: GLOW_SIZE,
          height: GLOW_SIZE,
          background: glow(theme.color.glowPeriwinkle, theme.color.glowPeach, night ? 0.2 : 0.6),
        }}
      />
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: night ? 0.1 : 0.05, mixBlendMode: night ? 'screen' : 'multiply' }} />
      <AbsoluteFill
        style={{
          padding: padded ? `${theme.safe.y}px ${theme.safe.x}px ${CAPTION_ZONE}px` : 0,
          fontFamily: theme.font.body,
          color: colors.text,
          ...style,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
