import { voxelPalette } from '../theme';

export interface PixelPanelProps {
  children: React.ReactNode;
  border?: number;
  padding?: string;
  background?: string;
  style?: React.CSSProperties;
}

/** Painel de jogo: borda dupla em pixel e sombra dura deslocada. */
export const PixelPanel: React.FC<PixelPanelProps> = ({ children, border = 5, padding = '20px 30px', background = voxelPalette.panel, style }) => (
  <div
    style={{
      background,
      border: `${border}px solid ${voxelPalette.panelBorder}`,
      boxShadow: [
        `inset 0 0 0 ${border}px ${background}`,
        `inset 0 0 0 ${border * 2}px ${voxelPalette.panelInner}`,
        `${border * 2}px ${border * 2}px 0 ${voxelPalette.shadow}`,
      ].join(', '),
      padding,
      boxSizing: 'border-box',
      ...style,
    }}
  >
    {children}
  </div>
);
