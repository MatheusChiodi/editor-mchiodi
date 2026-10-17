import { theme } from '../theme';
import { Icon, type IconName } from './icons';
import { alpha, longShadow } from './tokens';

export type BadgeVariant = 'paper' | 'ink' | 'coral' | 'emerald';

export interface IconBadgeProps {
  icon: IconName;
  size?: number;
  variant?: BadgeVariant;
  /** 0→1: o disco cresce e o ícone se desenha */
  progress?: number;
  style?: React.CSSProperties;
}

const variants: Record<BadgeVariant, { background: string; border: string; stroke: string }> = {
  paper: { background: alpha(theme.color.white, 0.85), border: alpha(theme.color.white, 0.9), stroke: theme.color.slate900 },
  ink: { background: theme.color.slate900, border: theme.color.slate900, stroke: theme.color.white },
  coral: { background: theme.color.coral, border: theme.color.coral, stroke: theme.color.white },
  emerald: { background: alpha(theme.color.emerald, 0.16), border: alpha(theme.color.emerald, 0.7), stroke: theme.color.slate900 },
};

/** Ícone em traço fino dentro de um disco: o "substantivo" de uma cena (servidor, banco, navegador…). */
export const IconBadge: React.FC<IconBadgeProps> = ({ icon, size = 128, variant = 'paper', progress = 1, style }) => {
  const colors = variants[variant];
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
      {/* `tech:<id>`: cor da marca no disco claro ou escuro; no coral (o acento da tela) o logo fica na tinta do disco */}
      <Icon name={icon} size={size * 0.48} color={colors.stroke} draw={progress} surface={variant === 'coral' ? undefined : variant === 'ink' ? 'dark' : 'light'} />
    </div>
  );
};
