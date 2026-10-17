import { interpolate, useCurrentFrame } from 'remotion';

import { CAPTION_ZONE } from '../../tokens';
import { clamp, progress } from '../math';
import { voxelFonts, voxelPalette } from '../theme';
import { SAFE, snap, splitAccent, type TimedText, typeSegments, useLayout } from './layout';
import { PixelPanel } from './PixelPanel';

const CHARS_PER_FRAME = 1.1;

export interface TerminalLineProps {
  line: TimedText;
  accentColor?: string;
  exit?: boolean;
}

/** Linha de terminal digitada caractere a caractere, com cursor. */
export const TerminalLine: React.FC<TerminalLineProps> = ({ line, accentColor = voxelPalette.accent, exit = false }) => {
  const frame = useCurrentFrame();
  const { unit, maxWidth } = useLayout();

  if (frame < line.from || frame > line.to) return null;

  const enter = progress(frame, line.from, line.from + 8);
  const leave = exit ? interpolate(frame, [line.to - 8, line.to], [1, 0], clamp) : 1;
  const typed = Math.floor((frame - line.from - 4) * CHARS_PER_FRAME);
  const done = typed >= line.text.length;
  const cursorOn = !done || Math.floor(frame / 8) % 2 === 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: CAPTION_ZONE + 20,
        display: 'flex',
        justifyContent: 'center',
        opacity: enter * leave,
        translate: `0px ${snap((1 - enter) * 40)}px`,
      }}
    >
      <PixelPanel padding={`${16 * unit}px ${30 * unit}px`} style={{ maxWidth, marginLeft: SAFE, marginRight: SAFE }}>
        <div style={{ fontFamily: voxelFonts.mono, fontSize: 68 * unit, lineHeight: 1, color: voxelPalette.text, whiteSpace: 'pre' }}>
          {typeSegments(splitAccent(line), typed).map((segment, i) => (
            <span key={i} style={{ color: segment.accent ? accentColor : undefined }}>
              {segment.text}
            </span>
          ))}
          <span
            style={{
              display: 'inline-block',
              width: 26 * unit,
              height: 48 * unit,
              marginLeft: 6,
              verticalAlign: '-10%',
              background: voxelPalette.text,
              opacity: cursorOn ? 1 : 0,
            }}
          />
        </div>
      </PixelPanel>
    </div>
  );
};
