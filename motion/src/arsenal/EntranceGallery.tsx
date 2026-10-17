import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { theme } from '../theme';
import { Enter, EnterText } from './Enter';
import { type EntrancePreset, entrances, getEntrance, paginate } from './entrances';

export interface EntranceGalleryProps {
  ids: string[];
}

const PAGE_SIZE = 10;
const COLUMNS = 2;
const GAP = 20;
const LOOP_SEC = 2;
const DELAY_SEC = 0.15;

const UNIT_LABEL: Record<EntrancePreset['unit'], string> = { block: 'bloco', line: 'linha', word: 'palavra', char: 'letra' };

export const galleryPages: string[][] = paginate(Object.keys(entrances), PAGE_SIZE);

const labelStyle: React.CSSProperties = {
  fontFamily: theme.font.display,
  fontWeight: 600,
  fontSize: 48,
  lineHeight: 1.2,
  letterSpacing: '-0.01em',
  color: theme.color.ink,
};

const Card: React.FC<{ preset: EntrancePreset; frame: number; durationInFrames: number }> = ({ preset, frame, durationInFrames }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
      minWidth: 0,
      minHeight: 0,
      padding: '0 40px',
      background: theme.color.paper,
      borderRadius: theme.radius.card,
      boxShadow: theme.shadow.card,
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div
        style={{
          fontFamily: theme.font.body,
          fontWeight: 600,
          fontSize: 20,
          lineHeight: 1.3,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: theme.color.slate600,
        }}
      >
        {preset.category} · {UNIT_LABEL[preset.unit]}
      </div>
      {preset.unit === 'block' ? (
        <Enter preset={preset.id} delaySec={DELAY_SEC} durationInFrames={durationInFrames} exit frame={frame} style={{ ...labelStyle, alignSelf: 'flex-start' }}>
          {preset.label}
        </Enter>
      ) : (
        <EnterText preset={preset.id} text={preset.label} delaySec={DELAY_SEC} durationInFrames={durationInFrames} exit frame={frame} style={labelStyle} />
      )}
    </div>
    <div
      style={{
        flexShrink: 0,
        padding: '8px 20px',
        border: `2px solid ${theme.color.slate300}`,
        borderRadius: theme.radius.pill,
        fontFamily: theme.font.body,
        fontWeight: 500,
        fontSize: 24,
        lineHeight: 1.3,
        color: theme.color.slate600,
      }}
    >
      {preset.id}
    </div>
  </div>
);

/** Vitrine do Studio: cada cartão anima o próprio nome com o próprio preset, em loop de 2s. */
export const EntranceGallery: React.FC<EntranceGalleryProps> = ({ ids }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const loop = Math.round(LOOP_SEC * fps);
  const shown = ids.slice(0, PAGE_SIZE).map(getEntrance);

  return (
    <AbsoluteFill
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${PAGE_SIZE / COLUMNS}, minmax(0, 1fr))`,
        gap: GAP,
        padding: `${theme.safe.y}px ${theme.safe.x}px`,
      }}
    >
      {shown.map((preset) => (
        <Card key={preset.id} preset={preset} frame={frame % loop} durationInFrames={loop} />
      ))}
    </AbsoluteFill>
  );
};
