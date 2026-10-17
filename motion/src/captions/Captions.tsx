import { useMemo } from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';

import { motion, theme } from '../theme';
import type { CaptionStyle, StyledCaption } from '../types';

interface Page {
  startMs: number;
  endMs: number;
  words: StyledCaption[];
}

/** As páginas já vêm decididas pelo pipeline (pageBreakAfter); aqui só agrupamos. */
export function toPages(captions: StyledCaption[]): Page[] {
  const pages: Page[] = [];
  let words: StyledCaption[] = [];
  for (const caption of captions) {
    words.push(caption);
    if (caption.pageBreakAfter) {
      pages.push({ startMs: words[0]!.startMs, endMs: caption.endMs, words });
      words = [];
    }
  }
  if (words.length) pages.push({ startMs: words[0]!.startMs, endMs: words.at(-1)!.endMs, words });
  return pages;
}

const HOLD_MS = 280;

const CaptionPage: React.FC<{ page: Page; style: CaptionStyle; offsetMs: number }> = ({ page, style, offsetMs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = offsetMs + (frame / fps) * 1000;
  const shorts = style === 'shorts';

  const enter = interpolate(frame, [0, motion.fast * fps], [0, 1], {
    easing: motion.enter,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: shorts ? 420 : 92,
        paddingLeft: theme.safe.x,
        paddingRight: theme.safe.x,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: shorts ? 22 : 18,
          rowGap: 6,
          maxWidth: shorts ? 900 : 1500,
          opacity: enter,
          translate: `0 ${(1 - enter) * 14}px`,
          fontFamily: theme.font.body,
          fontWeight: 800,
          fontSize: shorts ? 84 : 58,
          lineHeight: 1.18,
          letterSpacing: '-0.01em',
          textTransform: shorts ? 'uppercase' : 'none',
        }}
      >
        {page.words.map((word, index) => {
          const spoken = nowMs >= word.startMs;
          const active = spoken && nowMs < word.endMs + 60;
          const pop = interpolate(nowMs, [word.startMs, word.startMs + 110], [0, 1], {
            easing: motion.enter,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const highlighted = word.highlight && spoken;
          return (
            <span
              key={index}
              style={{
                display: 'inline-block',
                color: highlighted ? theme.color.coral : theme.color.white,
                opacity: spoken ? 1 : 0.55,
                scale: String(1 + (active ? 0.05 : 0) * pop),
                // contorno escuro atrás do preenchimento: lê em fundo claro ou escuro
                WebkitTextStroke: `${shorts ? 12 : 9}px ${theme.color.ink}`,
                paintOrder: 'stroke fill',
                textShadow: '0 6px 18px rgba(0,0,0,0.45)',
              }}
            >
              {word.text.trim()}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{
  captions: StyledCaption[];
  style: CaptionStyle;
  /** intervalos (em frames) em que um overlay ocupa a faixa das legendas */
  hidden?: [number, number][];
}> = ({ captions, style, hidden = [] }) => {
  const { fps } = useVideoConfig();
  const pages = useMemo(() => toPages(captions), [captions]);

  return (
    <AbsoluteFill>
      {pages.map((page, index) => {
        const next = pages[index + 1];
        const from = Math.round((page.startMs / 1000) * fps);
        // segura a página um instante depois da última palavra, sem invadir a próxima
        const endMs = Math.min(page.endMs + HOLD_MS, next ? next.startMs : Infinity);
        const durationInFrames = Math.max(1, Math.round((endMs / 1000) * fps) - from);
        if (hidden.some(([start, end]) => from < end && from + durationInFrames > start)) return null;
        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames} premountFor={fps}>
            <CaptionPage page={page} style={style} offsetMs={(from / fps) * 1000} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
