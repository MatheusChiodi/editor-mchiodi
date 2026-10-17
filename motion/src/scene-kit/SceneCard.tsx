import { theme } from '../theme';
import { rise } from './timing';
import { longShadow, type Tone, toneColors } from './tokens';

export interface SceneCardProps {
  /** 0→1: entrada padrão do kit */
  progress?: number;
  padding?: number | string;
  width?: number | string;
  tone?: Tone;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** Cartão branco translúcido de raio 24 com sombra longa: o papel aquece o branco por trás. */
export const SceneCard: React.FC<SceneCardProps> = ({ progress = 1, padding = 48, width, tone = 'paper', style, children }) => {
  const colors = toneColors(tone);
  return (
    <div
      style={{
        boxSizing: 'border-box',
        width,
        padding,
        borderRadius: theme.radius.card,
        background: colors.surface,
        border: `2px solid ${colors.border}`,
        boxShadow: longShadow,
        ...rise(progress, 32),
        ...style,
      }}
    >
      {children}
    </div>
  );
};
