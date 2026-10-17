import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  index?: number;
}

/** `#rrggbb` do tema com transparência, para não espalhar rgba() solto pelos componentes. */
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Quebra gulosa por palavras; uma palavra maior que o limite ocupa a linha sozinha. */
export function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (current && current.length + 1 + word.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const TIERS = [
  { fontSize: 100, maxChars: 20 },
  { fontSize: 78, maxChars: 26 },
  { fontSize: 60, maxChars: 34 },
] as const;
const MAX_LINES = 3;

/** Maior corpo em que o título cabe em até 3 linhas; a quebra é fixa para a máscara revelar linha a linha. */
export function layoutTitle(title: string): { fontSize: number; lines: string[] } {
  for (const tier of TIERS) {
    const lines = wrapLines(title, tier.maxChars);
    if (lines.length <= MAX_LINES) return { fontSize: tier.fontSize, lines };
  }
  const last = TIERS[TIERS.length - 1]!;
  return { fontSize: last.fontSize, lines: wrapLines(title, last.maxChars) };
}

/** "02 · Fundamentos": número do capítulo com dois dígitos, seguido do eyebrow. */
export function eyebrowLabel(eyebrow?: string, index?: number): string | undefined {
  const parts = [index === undefined ? undefined : String(index).padStart(2, '0'), eyebrow?.trim() || undefined];
  const label = parts.filter((part) => part !== undefined).join(' · ');
  return label || undefined;
}

export const SectionTitle: React.FC<SectionTitleProps & BaseProps> = ({ eyebrow, title, index, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames, motion.slow);
  const { fontSize, lines } = layoutTitle(title);
  const label = eyebrowLabel(eyebrow, index);
  const accent = progressAt(frame, fps, 0.15, motion.slow);
  const eyebrowIn = progressAt(frame, fps, 0.2);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 36,
          maxWidth: 1500,
          paddingLeft: theme.safe.x,
          paddingRight: 96,
          paddingTop: 56,
          paddingBottom: 60,
          background: `linear-gradient(90deg, ${withAlpha(theme.color.ink, 0.94)} 0%, ${withAlpha(theme.color.ink, 0.8)} 100%)`,
          borderTopRightRadius: theme.radius.card,
          borderBottomRightRadius: theme.radius.card,
          boxShadow: theme.shadow.raised,
          opacity: 1 - exit,
          translate: `${exit * -48}px 0`,
          clipPath: `inset(0 ${(1 - enter) * 100}% 0 0)`,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 8,
            borderRadius: theme.radius.pill,
            background: theme.color.coral,
            scale: `1 ${accent}`,
            transformOrigin: 'center top',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {label ? (
            <div
              style={{
                marginBottom: 18,
                fontFamily: theme.font.body,
                fontWeight: 600,
                fontSize: 28,
                lineHeight: 1.2,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: theme.color.coral,
                opacity: eyebrowIn * value,
                translate: `${(1 - eyebrowIn) * -18}px 0`,
              }}
            >
              {label}
            </div>
          ) : null}
          {lines.map((line, lineIndex) => {
            const reveal = progressAt(frame, fps, stagger(lineIndex, 0.12, 0.3), motion.slow);
            return (
              // a folga embaixo evita que a máscara corte as descendentes (g, p, ç)
              <div key={lineIndex} style={{ overflow: 'hidden', paddingBottom: '0.16em', marginBottom: '-0.16em' }}>
                <div
                  style={{
                    fontFamily: theme.font.display,
                    fontWeight: 600,
                    fontSize,
                    lineHeight: 1.14,
                    letterSpacing: '-0.015em',
                    whiteSpace: 'nowrap',
                    color: theme.color.paper,
                    translate: `0 ${(1 - reveal) * 118}%`,
                  }}
                >
                  {line}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: SectionTitle,
  sample: {
    eyebrow: 'Capítulo',
    index: 2,
    title: 'Como o React decide o que renderizar',
  },
  defaultDuration: 4,
  vertical: { zone: 'top' },
  description: 'Abre um novo capítulo do vídeo com o número e o título da seção; usar na troca de assunto.',
};
