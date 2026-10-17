import { useMemo } from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';

import { motion, theme } from '../theme';
import type { CaptionStyle, StyledCaption } from '../types';
import { ACTIVE_TAIL_MS, type CaptionLook, type CaptionPreset, captionPresets, enforceMaxWords, resolveLook, wordPhase } from './presets';

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

interface WordProps {
  word: StyledCaption;
  nowMs: number;
  look: CaptionLook;
}

/** Uma palavra da página. Cada estilo muda só como a palavra ativa se destaca; o `padrao` é o visual de sempre. */
const CaptionWord: React.FC<WordProps> = ({ word, nowMs, look }) => {
  const { spoken, active, progress } = wordPhase(word, nowMs);
  const text = word.text.trim();
  const highlighted = Boolean(word.highlight) && spoken;
  const pop = interpolate(nowMs, [word.startMs, word.startMs + 110], [0, 1], {
    easing: motion.enter,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const base: React.CSSProperties = {
    display: 'inline-block',
    color: highlighted ? theme.color[look.highlightColor] : theme.color.white,
    opacity: spoken ? 1 : look.upcomingOpacity,
    // contorno escuro atrás do preenchimento: lê em fundo claro ou escuro
    ...(look.stroke > 0 ? { WebkitTextStroke: `${look.stroke}px ${theme.color.ink}`, paintOrder: 'stroke fill' } : {}),
    textShadow: look.shadow,
  };

  switch (look.active) {
    case 'scale':
      return (
        <span
          style={{
            ...base,
            color: active && !highlighted && look.activeColor !== 'white' ? theme.color[look.activeColor] : base.color,
            scale: String(1 + (active ? look.activeScale : 0) * pop),
          }}
        >
          {text}
        </span>
      );
    case 'pop': {
      // entra com overshoot (curva pop) quando é dita; depois de falada assenta no tamanho normal
      const enter = interpolate(nowMs, [word.startMs, word.startMs + motion.fast * 1000], [0.6, 1], {
        easing: motion.pop,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const settle = interpolate(nowMs, [word.endMs + ACTIVE_TAIL_MS, word.endMs + ACTIVE_TAIL_MS + 120], [1, 0], {
        easing: motion.exit,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return (
        <span style={{ ...base, opacity: spoken ? pop : look.upcomingOpacity, scale: String(enter * (1 + look.activeScale * settle)) }}>
          {text}
        </span>
      );
    }
    case 'fill': {
      // duas camadas iguais: a de cima (cor da marca) é recortada pelo progresso da fala
      const reveal = spoken ? progress : 0;
      return (
        <span style={{ ...base, color: theme.color.white, position: 'relative' }}>
          {text}
          <span
            aria-hidden
            style={{
              ...base,
              position: 'absolute',
              left: 0,
              top: 0,
              color: theme.color[word.highlight ? look.highlightColor : look.activeColor],
              clipPath: `inset(-20% ${(1 - reveal) * 100}% -20% -10%)`,
            }}
          >
            {text}
          </span>
        </span>
      );
    }
    case 'pill': {
      const show = active ? pop : 0;
      return (
        // sobre a pill o contorno escuro some: o fundo já dá o contraste
        <span style={{ ...base, position: 'relative', ...(active ? { color: theme.color.white, WebkitTextStroke: undefined, textShadow: 'none' } : {}) }}>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: '-0.04em -0.22em',
              borderRadius: theme.radius.panel,
              background: theme.color[look.activeColor],
              boxShadow: theme.shadow.card,
              opacity: show,
              scale: String(0.85 + 0.15 * show),
              zIndex: -1,
            }}
          />
          {text}
        </span>
      );
    }
    case 'none':
      return <span style={base}>{text}</span>;
  }
};

const CaptionPage: React.FC<{ page: Page; style: CaptionStyle; look: CaptionLook; offsetMs: number }> = ({ page, style, look, offsetMs }) => {
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
          flexWrap: look.singleLine ? 'nowrap' : 'wrap',
          whiteSpace: look.singleLine ? 'nowrap' : undefined,
          justifyContent: 'center',
          columnGap: look.wordGap,
          rowGap: 6,
          maxWidth: shorts ? 900 : 1500,
          opacity: enter,
          translate: `0 ${(1 - enter) * 14}px`,
          fontFamily: theme.font.body,
          fontWeight: look.fontWeight,
          fontSize: look.fontSize,
          lineHeight: 1.18,
          letterSpacing: '-0.01em',
          textTransform: look.uppercase ? 'uppercase' : 'none',
          // a pill fica atrás do texto, mas dentro da página
          isolation: look.active === 'pill' ? 'isolate' : undefined,
        }}
      >
        {page.words.map((word, index) => (
          <CaptionWord key={index} word={word} nowMs={nowMs} look={look} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{
  captions: StyledCaption[];
  style: CaptionStyle;
  /** estilo visual (`captions.preset`); sem valor, o `padrao` */
  preset?: CaptionPreset;
  /** intervalos (em frames) em que um overlay ocupa a faixa das legendas */
  hidden?: [number, number][];
}> = ({ captions, style, preset = 'padrao', hidden = [] }) => {
  const { fps } = useVideoConfig();
  const look = resolveLook(preset, style);
  // o pipeline já pagina pelo estilo; aqui só garante o teto (prévias e props antigas)
  const pages = useMemo(() => toPages(enforceMaxWords(captions, captionPresets[preset].maxWords)), [captions, preset]);

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
            <CaptionPage page={page} style={style} look={look} offsetMs={(from / fps) * 1000} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
