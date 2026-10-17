import { useCurrentFrame } from 'remotion';

import { progress } from '../math';
import { voxelFonts, voxelPalette } from '../theme';
import { SAFE, snap, useLayout } from './layout';
import { PixelIcon, type PixelIconName } from './PixelIcon';
import { PixelPanel } from './PixelPanel';

export interface AchievementToastProps {
  title: string;
  label: string;
  icon: PixelIconName;
  /** frames relativos à cena */
  from: number;
  to: number;
  align?: 'center' | 'left';
}

/** "Conquista desbloqueada": fecha uma ideia com humor de jogo. */
export const AchievementToast: React.FC<AchievementToastProps> = ({ title, label, icon, from, to, align = 'center' }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();

  if (frame < from || frame > to) return null;

  const enter = progress(frame, from, from + 12);
  const iconSize = 84 * unit;

  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE,
        right: SAFE,
        top: 90,
        display: 'flex',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        opacity: enter,
        translate: `0px ${snap((enter - 1) * 120)}px`,
      }}
    >
      <PixelPanel padding={`${18 * unit}px ${28 * unit}px`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 * unit }}>
          <div
            style={{
              width: iconSize,
              height: iconSize,
              padding: 8 * unit,
              boxSizing: 'border-box',
              background: '#23254A',
              border: `4px solid ${voxelPalette.panelInner}`,
            }}
          >
            <PixelIcon name={icon} size={iconSize - 16 * unit - 8} />
          </div>
          <div>
            {title ? (
              <div style={{ fontFamily: voxelFonts.mono, fontSize: 44 * unit, lineHeight: 1, color: voxelPalette.muted, marginBottom: 10 * unit }}>
                {title}
              </div>
            ) : null}
            <div style={{ fontFamily: voxelFonts.title, fontSize: 30 * unit, lineHeight: 1.2, color: voxelPalette.text }}>{label}</div>
          </div>
        </div>
      </PixelPanel>
    </div>
  );
};
