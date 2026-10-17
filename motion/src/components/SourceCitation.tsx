import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';
import { withAlpha } from './SectionTitle';

export interface SourceCitationProps {
  source: string;
  detail?: string;
  year?: string;
}

export const SOURCE_MAX = 44;
export const META_MAX = 48;

/** Corta no limite de caracteres sem partir palavra, fechando com reticências. */
export function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:–—-]+$/, '')}…`;
}

/** Partes do crédito: a fonte e, separado, "detalhe · ano". Sem "Fonte:" duplicado. */
export function citationParts(source: string, detail?: string, year?: string): { source: string; meta?: string } {
  const name = truncate(source.replace(/^\s*fonte\s*:\s*/i, ''), SOURCE_MAX);
  const extras = [detail?.trim() ? truncate(detail, META_MAX) : undefined, year?.trim() || undefined].filter((part) => part !== undefined);
  return { source: name, meta: extras.length > 0 ? extras.join(' · ') : undefined };
}

export const SourceCitation: React.FC<SourceCitationProps & BaseProps> = ({ source, detail, year, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const parts = citationParts(source, detail, year);
  const textIn = progressAt(frame, fps, 0.12);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-start', paddingLeft: theme.safe.x, paddingBottom: theme.safe.y }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          maxWidth: 1920 - 2 * theme.safe.x,
          padding: '14px 34px 16px 30px',
          borderRadius: theme.radius.pill,
          background: withAlpha(theme.color.paper, 0.96),
          border: `1px solid ${withAlpha(theme.color.white, 0.7)}`,
          boxShadow: theme.shadow.card,
          whiteSpace: 'nowrap',
          opacity: value,
          translate: `${(1 - enter) * -32 - exit * 16}px 0`,
        }}
      >
        <span
          style={{
            fontFamily: theme.font.body,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: theme.color.slate600,
          }}
        >
          Fonte
        </span>
        <span style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: 34, lineHeight: 1.25, color: theme.color.ink, opacity: textIn }}>
          {parts.source}
        </span>
        {parts.meta ? (
          <span style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: 30, lineHeight: 1.25, color: theme.color.slate600, opacity: textIn }}>
            {parts.meta}
          </span>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: SourceCitation,
  sample: {
    source: 'Stack Overflow Developer Survey',
    detail: '65 mil respostas',
    year: '2024',
  },
  defaultDuration: 5,
  description: 'Crédito discreto da fonte de um dado, gráfico ou imagem enquanto ele está na tela.',
};
