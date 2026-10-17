import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { cardSurface, status } from './c1-kit';
import type { ComponentEntry } from './registry';

export interface ChapterProgressProps {
  chapters: string[];
  /** índice (a partir de 0) do capítulo atual */
  current: number;
}

export type ChapterState = 'past' | 'current' | 'future';

export interface ChapterSegment {
  label: string;
  state: ChapterState;
  /** peso de largura (flex-grow) do segmento */
  weight: number;
}

/** A partir de quantos capítulos os que não são o atual mostram só o número. */
export const COMPACT_FROM = 6;

/** Índice válido do capítulo atual: inteiro dentro da lista. */
export function currentChapter(count: number, current: number): number {
  if (count <= 0 || !Number.isFinite(current)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(current)));
}

/**
 * Segmentos da barra. O atual é mais largo e sempre mostra "02 · Título"; com muitos capítulos,
 * os outros encolhem e mostram só o número, senão nenhum rótulo caberia legível.
 */
export function chapterSegments(chapters: readonly string[], current: number): ChapterSegment[] {
  const active = currentChapter(chapters.length, current);
  const compact = chapters.length >= COMPACT_FROM;
  return chapters.map((title, index) => {
    const number = String(index + 1).padStart(2, '0');
    const name = title.trim();
    if (index === active) {
      return { label: name ? `${number} · ${name}` : number, state: 'current', weight: compact ? 5 : 2 };
    }
    return {
      label: compact || !name ? number : name,
      state: index < active ? 'past' : 'future',
      weight: 1,
    };
  });
}

const BAR = 6;

export const ChapterProgress: React.FC<ChapterProgressProps & BaseProps> = ({ chapters, current, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const segments = chapterSegments(chapters, current);
  const fill = progressAt(frame, fps, 0.35, motion.slow);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: theme.safe.y }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          gap: 14,
          width: 1920 - theme.safe.x * 2,
          boxSizing: 'border-box',
          padding: '24px 32px 20px',
          opacity: value,
          translate: `0 ${(1 - enter) * -40 - exit * 24}px`,
        }}
      >
        {segments.map((segment, index) => {
          const isCurrent = segment.state === 'current';
          return (
            // base 0: a largura vem só do peso, não do tamanho do rótulo
            <div key={index} style={{ flex: `${segment.weight} 1 0`, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  position: 'relative',
                  height: BAR,
                  borderRadius: theme.radius.pill,
                  background: segment.state === 'past' ? theme.color.ink : 'rgba(203, 213, 225, 0.7)',
                  overflow: 'hidden',
                }}
              >
                {isCurrent ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: theme.radius.pill,
                      background: theme.color.coral,
                      scale: `${fill} 1`,
                      transformOrigin: 'left center',
                    }}
                  />
                ) : null}
              </div>
              <div
                style={{
                  fontFamily: theme.font.body,
                  fontWeight: isCurrent ? 800 : 600,
                  fontSize: isCurrent ? 28 : 24,
                  lineHeight: '34px',
                  fontVariantNumeric: 'tabular-nums',
                  color: isCurrent ? theme.color.ink : segment.state === 'past' ? theme.color.slate600 : status.slate500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {segment.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: ChapterProgress,
  sample: {
    chapters: ['O problema', 'Como o cache funciona', 'Implementando', 'Medindo o ganho', 'Quando não usar'],
    current: 1,
  },
  defaultDuration: 4,
  description: 'Barra fina no topo com os capítulos do vídeo e o atual em destaque; fica poucos segundos na troca de capítulo.',
};
