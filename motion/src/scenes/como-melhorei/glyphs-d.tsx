// Ícones em traço fino (grade 24x24) usados só pelas cenas MentoriaAoVivo, DeCoracao, EstudarEPraticar e OEstalo.
// Arquivo em minúsculas: o `scenes sync` não o trata como cena.
import { alpha, longShadow } from '../../scene-kit';
import { theme } from '../../theme';

export const GLYPHS = {
  heart: ['M12 20.5C5.5 15.5 3 12.3 3 8.9A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 9 1.9c0 3.4-2.5 6.6-9 11.6z'],
  book: [
    'M12 6.5C10.2 5 7.6 4.5 3.5 4.5v13c4.1 0 6.7.5 8.5 2',
    'M12 6.5c1.8-1.5 4.4-2 8.5-2v13c-4.1 0-6.7.5-8.5 2',
    'M12 6.5v13',
  ],
  users: [
    'M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    'M2.5 20c0-3.3 2.9-5 6.5-5s6.5 1.7 6.5 5',
    'M16 4.3a3.5 3.5 0 0 1 0 6.4',
    'M18 15.4c2.1.6 3.5 2.1 3.5 4.6',
  ],
  bulb: ['M8.5 14.5c-.3-1.4-1-2.1-1.8-3A6 6 0 1 1 17.3 11.5c-.8.9-1.5 1.6-1.8 3z', 'M9 17.5h6', 'M10 21h4'],
  tag: [
    'M3.5 4.5a1 1 0 0 1 1-1h7.1a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7z',
    'M8 8h.01',
  ],
  code: ['M8 7l-5 5 5 5', 'M16 7l5 5-5 5', 'M13.5 4.5l-3 15'],
} as const satisfies Record<string, readonly string[]>;

export type GlyphName = keyof typeof GLYPHS;

export interface GlyphProps {
  name: GlyphName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** 0→1: o ícone se desenha pelo traço */
  draw?: number;
  /** preenchimento do primeiro path (a forma principal) */
  fill?: string;
}

export const Glyph: React.FC<GlyphProps> = ({ name, size = 48, color = theme.color.slate900, strokeWidth = 1.75, draw = 1, fill = 'none' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', overflow: 'visible' }}
  >
    {GLYPHS[name].map((d, index) => (
      <path key={index} d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} opacity={draw > 0 ? 1 : 0} fill={index === 0 ? fill : 'none'} />
    ))}
  </svg>
);

export interface GlyphBadgeProps {
  glyph: GlyphName;
  size?: number;
  variant?: 'paper' | 'ink';
  progress?: number;
  style?: React.CSSProperties;
}

/** Mesmo disco do `IconBadge` do kit, para os ícones deste arquivo. */
export const GlyphBadge: React.FC<GlyphBadgeProps> = ({ glyph, size = 128, variant = 'paper', progress = 1, style }) => {
  const ink = variant === 'ink';
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
        background: ink ? theme.color.slate900 : alpha(theme.color.white, 0.85),
        border: `2px solid ${ink ? theme.color.slate900 : alpha(theme.color.white, 0.9)}`,
        boxShadow: longShadow,
        opacity: Math.min(1, progress * 1.5),
        scale: String(0.8 + 0.2 * progress),
        ...style,
      }}
    >
      <Glyph name={glyph} size={size * 0.48} color={ink ? theme.color.white : theme.color.slate900} draw={progress} />
    </div>
  );
};
