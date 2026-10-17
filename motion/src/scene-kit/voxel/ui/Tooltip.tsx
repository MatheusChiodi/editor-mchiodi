import { voxelFonts, voxelPalette } from '../theme';
import { snap, useLayout } from './layout';
import { PixelPanel } from './PixelPanel';

export interface TooltipProps {
  name: string;
  description?: string;
  /** 0→1 */
  enter: number;
  /** ponto da tela (px) onde o tooltip fica centrado, logo acima; sem ele, segue o fluxo normal */
  anchor?: { x: number; y: number };
}

/** Tooltip de item: nome em pixel e uma linha de descrição. Com `anchor`, fica preso a um ponto do mundo. */
export const Tooltip: React.FC<TooltipProps> = ({ name, description, enter, anchor }) => {
  const { unit, maxWidth } = useLayout();
  const panel = (
    <PixelPanel padding={`${20 * unit}px ${30 * unit}px`} style={{ maxWidth, textAlign: 'center' }}>
      <div style={{ fontFamily: voxelFonts.title, fontSize: 30 * unit, lineHeight: 1.3, color: voxelPalette.text }}>{name}</div>
      {description ? (
        <div style={{ fontFamily: voxelFonts.mono, fontSize: 50 * unit, lineHeight: 1, marginTop: 12 * unit, color: voxelPalette.muted }}>{description}</div>
      ) : null}
    </PixelPanel>
  );
  const motionStyle: React.CSSProperties = { opacity: enter, translate: `0px ${snap((1 - enter) * 24)}px` };

  if (!anchor) return <div style={motionStyle}>{panel}</div>;
  return (
    <div style={{ position: 'absolute', left: snap(anchor.x), top: snap(anchor.y), width: 0, height: 0 }}>
      <div style={{ position: 'absolute', left: 0, bottom: 0, transform: 'translateX(-50%)', width: 'max-content', ...motionStyle }}>{panel}</div>
    </div>
  );
};
