// Peças compartilhadas pelas cenas AlfredDio, TudoNaDio e ArtigoReconhecido.
// Nome em minúsculas: o `scenes sync` só registra arquivos PascalCase.
import { alpha, longShadow } from '../../scene-kit';
import { theme } from '../../theme';

/** Ícones próprios em traço fino (grade 24x24), no mesmo padrão de `scene-kit/icons`. */
export const GLYPHS = {
  bell: ['M4 17a8 8 0 0 1 16 0', 'M2.5 17h19', 'M12 9V6.5', 'M10 6.5h4', 'M5 20.5h14'],
  book: [
    'M3.5 5.5A1.5 1.5 0 0 1 5 4h5.5A1.5 1.5 0 0 1 12 5.5V20a2 2 0 0 0-2-1.5H3.5v-13z',
    'M20.5 5.5A1.5 1.5 0 0 0 19 4h-5.5A1.5 1.5 0 0 0 12 5.5V20a2 2 0 0 1 2-1.5h6.5v-13z',
  ],
  flag: ['M5.5 21V3.5', 'M5.5 4.5H18l-2.5 4 2.5 4H5.5'],
  users: [
    'M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    'M2.5 20c0-3.2 2.9-5 6.5-5s6.5 1.8 6.5 5',
    'M16 4.3a3.5 3.5 0 0 1 0 6.4',
    'M18 15.4c2.1.6 3.5 2.2 3.5 4.6',
  ],
  chat: ['M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 4v-4H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z', 'M8 9h8', 'M8 12.5h5'],
  file: ['M7 3h7l5 5v11.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7 3z', 'M14 3v5h5', 'M9.5 13h5.5', 'M9.5 16.5h5.5'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0V4z', 'M8 5.5H5a3 3 0 0 0 3 4', 'M16 5.5h3a3 3 0 0 1-3 4', 'M12 13v4.5', 'M8 20.5h8', 'M9.5 17.5h5'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  heart: ['M12 20.5S3.5 15.5 3.5 9.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8.5 1.6c0 6.3-8.5 11.3-8.5 11.3z'],
  award: ['M12 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M8.5 14L7 21l5-2.8 5 2.8-1.5-7'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
} as const satisfies Record<string, readonly string[]>;

export type GlyphName = keyof typeof GLYPHS;

export const Glyph: React.FC<{ name: GlyphName; size?: number; color?: string; strokeWidth?: number; draw?: number }> = ({
  name,
  size = 48,
  color = theme.color.slate900,
  strokeWidth = 1.75,
  draw = 1,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {GLYPHS[name].map((d, index) => (
      <path key={index} d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} opacity={draw > 0 ? 1 : 0} />
    ))}
  </svg>
);

type GlyphBadgeVariant = 'paper' | 'ink' | 'coral' | 'emerald';

const badgeVariants: Record<GlyphBadgeVariant, { background: string; border: string; stroke: string }> = {
  paper: { background: alpha(theme.color.white, 0.85), border: alpha(theme.color.white, 0.9), stroke: theme.color.slate900 },
  ink: { background: theme.color.slate900, border: theme.color.slate900, stroke: theme.color.white },
  coral: { background: theme.color.coral, border: theme.color.coral, stroke: theme.color.white },
  emerald: { background: alpha(theme.color.emerald, 0.16), border: alpha(theme.color.emerald, 0.7), stroke: theme.color.slate900 },
};

/** Igual ao `IconBadge` do kit, mas com os ícones desta pasta. */
export const GlyphBadge: React.FC<{ glyph: GlyphName; size?: number; variant?: GlyphBadgeVariant; progress?: number; style?: React.CSSProperties }> = ({
  glyph,
  size = 128,
  variant = 'paper',
  progress = 1,
  style,
}) => {
  const colors = badgeVariants[variant];
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: theme.radius.pill,
        background: colors.background,
        border: `2px solid ${colors.border}`,
        boxShadow: longShadow,
        opacity: Math.min(1, progress * 1.5),
        scale: String(0.8 + 0.2 * progress),
        ...style,
      }}
    >
      <Glyph name={glyph} size={size * 0.48} color={colors.stroke} draw={progress} />
    </div>
  );
};
