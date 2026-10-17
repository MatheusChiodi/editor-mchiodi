import { techFor } from '../tech/glyph';
import { theme } from '../theme';
import { Icon, type IconName } from './icons';
import { rise } from './timing';
import { alpha, pillShadow, text as sizes, type Tone, toneColors } from './tokens';

export type PillVariant = 'glass' | 'ink' | 'emerald' | 'coral';

export interface PillProps {
  variant?: PillVariant;
  icon?: IconName;
  /** bolinha de status à esquerda (emerald = "funciona", coral = acento) */
  dot?: boolean;
  fontSize?: number;
  /** 0→1: entrada padrão do kit */
  progress?: number;
  /** false: não põe o ícone sozinho quando o texto é o nome de uma tecnologia do catálogo */
  autoTechIcons?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const variants: Record<PillVariant, { background: string; border: string; color: string; dot: string }> = {
  glass: { background: alpha(theme.color.white, 0.75), border: alpha(theme.color.slate300, 0.8), color: theme.color.slate600, dot: theme.color.slate300 },
  ink: { background: theme.color.slate900, border: theme.color.slate900, color: theme.color.white, dot: theme.color.emerald },
  emerald: { background: alpha(theme.color.emerald, 0.14), border: alpha(theme.color.emerald, 0.6), color: theme.color.slate900, dot: theme.color.emerald },
  // coral nunca vira texto corrido: só a borda e a bolinha carregam o acento
  coral: { background: alpha(theme.color.white, 0.85), border: theme.color.coral, color: theme.color.slate900, dot: theme.color.coral },
};

/** Rótulo em pílula: a forma padrão de etiqueta do design system. */
export const Pill: React.FC<PillProps> = ({ variant = 'glass', icon: given, dot = false, fontSize = sizes.label, progress = 1, autoTechIcons = true, style, children }) => {
  const colors = variants[variant];
  // rótulo que é o nome de uma tecnologia ganha o ícone dela sem o diretor pedir (as cenas e modelos herdam daqui)
  const tech = given || dot ? undefined : techFor(children, undefined, autoTechIcons);
  const icon = given ?? (tech ? (`tech:${tech.id}` as const) : undefined);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: fontSize * 0.4,
        padding: `${fontSize * 0.42}px ${fontSize * 0.9}px`,
        borderRadius: theme.radius.pill,
        background: colors.background,
        border: `2px solid ${colors.border}`,
        boxShadow: pillShadow,
        fontFamily: theme.font.body,
        fontWeight: 500,
        fontSize,
        lineHeight: 1.15,
        color: colors.color,
        whiteSpace: 'nowrap',
        ...rise(progress, 16),
        ...style,
      }}
    >
      {dot ? <span style={{ width: fontSize * 0.36, height: fontSize * 0.36, borderRadius: theme.radius.pill, background: colors.dot }} /> : null}
      {icon ? <Icon name={icon} size={fontSize * 0.95} color={colors.color} surface={variant === 'ink' ? 'dark' : 'light'} /> : null}
      {children}
    </div>
  );
};

export interface EyebrowProps {
  color?: 'slate' | 'coral';
  tone?: Tone;
  progress?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** Rótulo de seção: caixa alta com tracking 0.3em. No máximo um em coral por tela. */
export const Eyebrow: React.FC<EyebrowProps> = ({ color = 'slate', tone = 'paper', progress = 1, style, children }) => (
  <div
    style={{
      fontFamily: theme.font.body,
      fontWeight: 600,
      fontSize: sizes.eyebrow,
      lineHeight: 1.2,
      letterSpacing: '0.3em',
      // o tracking sobra depois da última letra e descentraliza o texto
      marginRight: '-0.3em',
      textTransform: 'uppercase',
      color: color === 'coral' ? theme.color.coral : toneColors(tone).text,
      ...rise(progress, 16),
      ...style,
    }}
  >
    {children}
  </div>
);
