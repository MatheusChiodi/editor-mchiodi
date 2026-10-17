import { resolveTech, type Tech } from '../../../src/tech/catalog';
import { brandOn, inkOn, SURFACE, tileFor } from '../../../src/tech/color';
import { theme } from '../theme';
import { hasTechArt, TechGlyph } from './glyph';

export type TechVariant = 'brand' | 'mono' | 'chip';
export const TECH_VARIANTS: readonly TechVariant[] = ['brand', 'mono', 'chip'];
export type TechTone = 'ink' | 'paper';

export const resolveVariant = (value: unknown, fallback: TechVariant = 'brand'): TechVariant =>
  TECH_VARIANTS.includes(value as TechVariant) ? (value as TechVariant) : fallback;

/** Nome fora do catálogo não quebra o render: vira um monograma neutro com o texto recebido. */
export function techOrPlaceholder(name: string): Tech {
  return resolveTech(name) ?? { id: name, name: name.replace(/^tech:/, ''), icon: null, color: theme.color.slate600, category: 'ferramenta', aliases: [] };
}

export interface TechTile {
  background: string;
  glyph: string;
  border: string;
}

/**
 * Cores da variante `brand`: desenho na cor oficial sobre o ladrilho (claro ou escuro) que dá mais contraste.
 * Sem desenho no conjunto, o ladrilho é a cor da marca e o monograma vai em tinta legível.
 */
export function brandTile(tech: Pick<Tech, 'icon' | 'color'>): TechTile {
  if (!hasTechArt(tech)) return { background: tech.color, glyph: inkOn(tech.color), border: 'rgba(17,24,39,0.12)' };
  const surface = tileFor(tech.color);
  return {
    background: SURFACE[surface],
    glyph: brandOn(surface, tech.color),
    border: surface === 'light' ? 'rgba(17,24,39,0.10)' : 'rgba(255,255,255,0.16)',
  };
}

export interface TechIconProps {
  /** id do catálogo, apelido ou `tech:<id>` */
  name: string;
  /** `brand`: cor oficial num ladrilho · `mono`: só o desenho, numa tinta · `chip`: ícone + nome numa pílula */
  variant?: TechVariant;
  /** lado do ladrilho/desenho; no chip, a altura da pílula */
  size?: number;
  /** `mono`: tinta do desenho (ink para fundo claro, paper para vídeo/fundo escuro) · `chip`: cor da pílula */
  tone?: TechTone;
  /** 0→1: entrada padrão do projeto */
  progress?: number;
  /** texto do chip quando não é o nome oficial */
  label?: string;
  style?: React.CSSProperties;
}

/**
 * O ícone de uma tecnologia, sempre pela biblioteca: nunca redesenhado, esticado ou recolorido fora destas três variantes.
 * Serve só para identificar a tecnologia citada.
 */
export const TechIcon: React.FC<TechIconProps> = ({ name, variant = 'brand', size = 120, tone, progress = 1, label, style }) => {
  const tech = techOrPlaceholder(name);
  const entrance: React.CSSProperties = { opacity: Math.min(1, progress * 1.6), scale: String(0.8 + 0.2 * progress), translate: `0 ${(1 - progress) * 18}px` };

  if (variant === 'mono') {
    return <TechGlyph tech={tech} size={size} color={tone === 'ink' ? theme.color.ink : theme.color.paper} style={{ ...entrance, ...style }} />;
  }

  if (variant === 'chip') {
    const dark = tone === 'ink';
    return (
      <div
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: size * 0.2,
          height: size,
          boxSizing: 'border-box',
          padding: `0 ${size * 0.34}px 0 ${size * 0.24}px`,
          borderRadius: theme.radius.pill,
          background: dark ? theme.color.ink : theme.color.paper,
          border: `1px solid ${dark ? 'rgba(255,255,255,0.16)' : 'rgba(17,24,39,0.10)'}`,
          boxShadow: theme.shadow.card,
          fontFamily: theme.font.body,
          fontWeight: 600,
          fontSize: size * 0.44,
          lineHeight: 1,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          color: dark ? theme.color.paper : theme.color.ink,
          ...entrance,
          ...style,
        }}
      >
        <TechGlyph tech={tech} size={size * 0.56} surface={dark ? 'dark' : 'light'} />
        {label ?? tech.name}
      </div>
    );
  }

  const tile = brandTile(tech);
  return (
    <div
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: size * 0.24,
        background: tile.background,
        border: `1px solid ${tile.border}`,
        boxShadow: theme.shadow.card,
        ...entrance,
        ...style,
      }}
    >
      <TechGlyph tech={tech} size={size * 0.6} color={tile.glyph} />
    </div>
  );
};
