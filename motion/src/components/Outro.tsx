import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { fitTitle } from './Intro';
import type { ComponentEntry } from './registry';

export interface OutroProps {
  title?: string;
  /** rótulo do espaço do vídeo sugerido */
  nextLabel?: string;
  handle?: string;
}

export interface Slot {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CANVAS = { width: 1920, height: 1080 };

/**
 * Posição dos dois espaços 16:9 onde o YouTube sobrepõe os cards de tela final.
 * Proporcional à tela, para valer também em outras resoluções.
 */
export function outroLayout(canvas: { width: number; height: number } = CANVAS) {
  const unit = canvas.width / 1920;
  const width = Math.round(704 * unit);
  const height = Math.round((width * 9) / 16);
  const gap = Math.round(96 * unit);
  const left = Math.round((canvas.width - (width * 2 + gap)) / 2);
  const top = Math.round(canvas.height * 0.285);
  const slots: [Slot, Slot] = [
    { x: left, y: top, width, height },
    { x: left + width + gap, y: top, width, height },
  ];
  return { slots, titleTop: Math.round(canvas.height * 0.085), labelTop: top + height + Math.round(24 * unit), handleTop: Math.round(canvas.height * 0.84) };
}

export const Outro: React.FC<OutroProps & BaseProps> = ({
  title = 'Valeu por assistir',
  nextLabel = 'próximo vídeo',
  handle = '@mchiodi',
  durationInFrames,
}) => {
  // sem saída: é o último plano do vídeo e os cards do YouTube ficam por cima até o fim
  const { frame, fps } = usePresence(durationInFrames);
  const { width, height } = useVideoConfig();
  const layout = outroLayout({ width, height });
  const labels = [nextLabel, 'inscreva-se'];

  const titleSize = fitTitle(title, width - theme.safe.x * 2, 104, 56);
  const titleHeight = Math.round(titleSize * 1.3);
  const titleIn = progressAt(frame, fps, 0.15, motion.slow);
  const handleIn = progressAt(frame, fps, 1, motion.slow);

  return (
    <AbsoluteFill style={{ background: theme.color.paper }}>
      <div
        style={{
          position: 'absolute',
          top: layout.titleTop,
          left: theme.safe.x,
          right: theme.safe.x,
          height: titleHeight,
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: titleSize,
            lineHeight: `${titleHeight}px`,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            color: theme.color.ink,
            translate: `0 ${(1 - titleIn) * 104}%`,
          }}
        >
          {title}
        </div>
      </div>
      {layout.slots.map((slot, index) => {
        const appear = progressAt(frame, fps, stagger(index, 0.14, 0.5), motion.slow);
        return (
          <div key={index} style={{ opacity: appear, translate: `0 ${(1 - appear) * 26}px` }}>
            <svg
              width={slot.width}
              height={slot.height}
              style={{ position: 'absolute', left: slot.x, top: slot.y, overflow: 'visible' }}
            >
              <rect
                x={2}
                y={2}
                width={slot.width - 4}
                height={slot.height - 4}
                rx={theme.radius.card}
                fill={theme.color.slate300}
                fillOpacity={0.28}
                stroke={theme.color.slate600}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="22 18"
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: slot.x,
                top: layout.labelTop,
                width: slot.width,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                fontFamily: theme.font.body,
                fontWeight: 600,
                fontSize: 28,
                lineHeight: 1.3,
                letterSpacing: '0.2em',
                textIndent: '0.2em',
                textTransform: 'uppercase',
                color: theme.color.slate600,
              }}
            >
              {labels[index]}
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          top: layout.handleTop,
          left: theme.safe.x,
          right: theme.safe.x,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
          opacity: handleIn,
          translate: `0 ${(1 - handleIn) * 18}px`,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: theme.radius.pill,
            background: theme.color.coral,
            scale: String(handleIn),
          }}
        />
        <div
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: 48,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            color: theme.color.ink,
          }}
        >
          {handle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const sample: OutroProps = { title: 'Valeu por assistir', nextLabel: 'próximo vídeo', handle: '@mchiodi' };

export const entry: ComponentEntry = {
  component: Outro,
  sample: { ...sample },
  defaultDuration: 8,
  vertical: { zone: 'skip' },
  description: 'Tela final opaca (~8s) com espaços reservados para os cards do YouTube e o handle do canal; use como último plano do vídeo.',
};
