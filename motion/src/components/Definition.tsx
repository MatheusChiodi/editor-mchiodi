import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { TechMark } from '../tech/glyph';
import { motion, theme } from '../theme';
import { cardSurface, type FontTier, fitFontSize, Pill, rise } from './c1-kit';
import type { ComponentEntry } from './registry';

export interface DefinitionProps {
  term: string;
  meaning: string;
  /** classe gramatical ou etiqueta: "substantivo", "sigla", "padrão de projeto" */
  kind?: string;
  /** false: termo que é o nome de uma tecnologia não ganha o logo sozinho */
  autoTechIcons?: boolean;
}

export const TERM_TIERS: readonly FontTier[] = [
  { fontSize: 104, maxChars: 12 },
  { fontSize: 84, maxChars: 18 },
  { fontSize: 66, maxChars: 26 },
  { fontSize: 52, maxChars: Number.POSITIVE_INFINITY },
];

export const MEANING_TIERS: readonly FontTier[] = [
  { fontSize: 42, maxChars: 90 },
  { fontSize: 38, maxChars: 170 },
  { fontSize: 34, maxChars: Number.POSITIVE_INFINITY },
];

/** Definição com ponto final, como em dicionário; respeita a pontuação que já vier. */
export function withFullStop(meaning: string): string {
  const text = meaning.trim();
  if (!text) return '';
  return /[.!?…:;]$/.test(text) ? text : `${text}.`;
}

export const Definition: React.FC<DefinitionProps & BaseProps> = ({ term, meaning, kind, autoTechIcons = true, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const label = kind?.trim();
  const body = withFullStop(meaning);
  const accent = progressAt(frame, fps, 0.3, motion.slow);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: theme.safe.x }}>
      <div
        style={{
          ...cardSurface,
          display: 'flex',
          flexDirection: 'column',
          width: 1040,
          padding: '56px 68px 60px',
          opacity: value,
          translate: `${(1 - enter) * -56 - exit * 28}px 0`,
        }}
      >
        {label ? (
          <Pill style={{ ...rise(progressAt(frame, fps, 0.1)), marginBottom: 20 }}>{label}</Pill>
        ) : null}
        <div
          style={{
            ...rise(progressAt(frame, fps, 0.16, motion.slow), 20),
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: fitFontSize(term, TERM_TIERS),
            lineHeight: 1.1,
            letterSpacing: '-0.015em',
            color: theme.color.slate900,
            overflowWrap: 'anywhere',
          }}
        >
          {/* verbete de uma tecnologia ("Docker"): o logo vem junto do termo */}
          <TechMark label={term} auto={autoTechIcons} size={fitFontSize(term, TERM_TIERS) * 0.78} surface="light" style={{ verticalAlign: '-0.1em', marginRight: 24 }} />
          {term.trim()}
        </div>
        <div
          style={{
            width: 96,
            height: 6,
            marginTop: 26,
            marginBottom: 26,
            borderRadius: theme.radius.pill,
            background: theme.color.coral,
            scale: `${accent} 1`,
            transformOrigin: 'left center',
          }}
        />
        <div
          style={{
            ...rise(progressAt(frame, fps, 0.4)),
            fontFamily: theme.font.body,
            fontWeight: 500,
            fontSize: fitFontSize(body, MEANING_TIERS),
            lineHeight: 1.36,
            color: theme.color.ink,
            overflowWrap: 'anywhere',
          }}
        >
          {body}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Definition,
  sample: {
    term: 'Idempotência',
    kind: 'substantivo feminino',
    meaning: 'Propriedade de uma operação que dá o mesmo resultado se for executada uma ou mil vezes',
  },
  defaultDuration: 7,
  vertical: { zone: 'top' },
  description: 'Apresenta um termo técnico na primeira vez em que aparece, no formato de verbete de dicionário.',
};
