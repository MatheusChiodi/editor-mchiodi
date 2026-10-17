import { interpolate, useCurrentFrame } from 'remotion';

import { CAPTION_ZONE } from '../../tokens';
import { clamp, progress } from '../math';
import { voxelFonts, voxelPalette } from '../theme';
import { SAFE, snap, splitAccent, type TimedText, useLayout } from './layout';
import { PixelPanel } from './PixelPanel';

export interface CaptionProps {
  line: TimedText;
  /** frame final da cena: legenda que vai até ele sai junto com a cena, sem fade próprio */
  sceneEnd: number;
  position?: 'top' | 'bottom';
  footer?: string;
}

/** Fala do "jogo" num painel de pixel. Não é a legenda do vídeo: é texto de cena. */
export const Caption: React.FC<CaptionProps> = ({ line, sceneEnd, position = 'top', footer }) => {
  const frame = useCurrentFrame();
  const { unit, maxWidth } = useLayout();

  if (frame < line.from || frame > line.to) return null;

  const enter = progress(frame, line.from, line.from + 10);
  const leave = line.to >= sceneEnd ? 1 : interpolate(frame, [line.to - 8, line.to], [1, 0], clamp);
  const direction = position === 'bottom' ? 1 : -1;
  // embaixo, o painel fica acima da faixa das legendas do vídeo
  const edge = position === 'bottom' ? CAPTION_ZONE + 20 : 90;

  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE,
        right: SAFE,
        [position]: edge,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: enter * leave,
        translate: `0px ${snap((1 - enter) * 36 * direction)}px`,
      }}
    >
      <PixelPanel padding={`${18 * unit}px ${34 * unit}px`} style={{ maxWidth }}>
        <div style={{ fontFamily: voxelFonts.mono, fontSize: 64 * unit, lineHeight: 1.05, color: voxelPalette.text, textAlign: 'center' }}>
          {splitAccent(line).map((segment, i) => (
            <span key={i} style={{ color: segment.accent ? voxelPalette.accent : undefined }}>
              {segment.text}
            </span>
          ))}
        </div>
      </PixelPanel>
      {footer ? (
        <div
          style={{
            marginTop: 18 * unit,
            padding: `${8 * unit}px ${20 * unit}px`,
            background: voxelPalette.text,
            color: voxelPalette.panel,
            fontFamily: voxelFonts.title,
            fontSize: 30 * unit,
            boxShadow: `8px 8px 0 ${voxelPalette.shadow}`,
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
};
