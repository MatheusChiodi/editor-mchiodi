import { AbsoluteFill } from 'remotion';

import { type BaseProps, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { type Corner, cornerPlacement } from './c3-kit';
import type { ComponentEntry } from './registry';

export interface LogoBugProps {
  text?: string;
  corner?: Corner;
  opacity?: number;
}

export const BUG_OPACITY = 0.7;

/** Opacidade de repouso: discreta, mas nunca tão baixa que a marca vire sujeira na imagem. */
export function bugOpacity(opacity: number = BUG_OPACITY): number {
  return Number.isFinite(opacity) ? Math.min(1, Math.max(0.2, opacity)) : BUG_OPACITY;
}

export const LogoBug: React.FC<LogoBugProps & BaseProps> = ({ text = 'MChiodi', corner = 'top-right', opacity, durationInFrames }) => {
  // fica o vídeo todo: entra e sai devagar para ninguém notar o momento
  const { enter, value } = usePresence(durationInFrames, motion.slow, motion.base);
  const { justifyContent, alignItems } = cornerPlacement(corner);

  return (
    <AbsoluteFill style={{ justifyContent, alignItems, padding: `${theme.safe.y}px ${theme.safe.x}px` }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          opacity: value * bugOpacity(opacity),
          translate: `0 ${(1 - enter) * (justifyContent === 'flex-end' ? 10 : -10)}px`,
          // texto solto sobre vídeo: sem cartão, a sombra `ink` é o que garante leitura em fundo claro
          filter: 'drop-shadow(0 2px 10px rgba(17, 24, 39, 0.55))',
        }}
      >
        <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: theme.radius.pill, background: theme.color.coral }} />
        <div
          style={{
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: 38,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            color: theme.color.white,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: LogoBug,
  sample: {
    text: 'MChiodi',
    corner: 'top-right',
    opacity: 0.7,
  },
  defaultDuration: 10,
  description: "Marca d'água discreta do canal num canto, para ficar o vídeo inteiro (use a duração do vídeo).",
};
