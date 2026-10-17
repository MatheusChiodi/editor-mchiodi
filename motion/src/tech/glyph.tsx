import { isTechIconName, labelTech, monogram, resolveTech, type Tech } from '../../../src/tech/catalog';
import { brandOn, FALLBACK_INK, type Surface } from '../../../src/tech/color';
import { theme } from '../theme';
import { TECH_ICONS } from './icons.generated';

// Base sem dependência do scene-kit: o `Icon` do kit importa daqui para resolver `tech:<id>`.

/** O catálogo tem desenho para esta tecnologia? Sem ele, o glifo é o monograma. */
export function hasTechArt(tech: Pick<Tech, 'icon'>): boolean {
  return tech.icon !== null && Object.hasOwn(TECH_ICONS, tech.icon);
}

/** Corpo do monograma em fração do lado: duas letras cabem maiores que três. */
export function monogramScale(letters: string): number {
  return letters.length <= 1 ? 0.7 : letters.length === 2 ? 0.56 : letters.length === 3 ? 0.42 : 0.34;
}

/**
 * Tecnologia que um item mostra: o `icon` explícito (`tech:react`) ou, com a detecção ligada, a que o rótulo nomeia.
 * É o único ponto em que os componentes decidem "aqui vai um ícone de tecnologia".
 */
export function techFor(label: unknown, icon?: unknown, auto: boolean = true): Tech | undefined {
  if (typeof icon === 'string' && isTechIconName(icon)) return resolveTech(icon);
  if (!auto || typeof label !== 'string') return undefined;
  // sem desenho no conjunto não há o que pôr ao lado do nome: o monograma fica para quem pede a tecnologia explicitamente
  const tech = labelTech(label);
  return tech && hasTechArt(tech) ? tech : undefined;
}

export interface TechGlyphProps {
  tech: Tech;
  size: number;
  /** cor do desenho quando não há `surface` (variante mono), e a reserva quando a cor da marca não contrasta */
  color?: string;
  /** superfície em que o glifo está: com ela, sai na cor da marca sempre que houver contraste */
  surface?: Surface;
  /** 0→1: entrada padrão (cresce de 80% e aparece) */
  progress?: number;
  style?: React.CSSProperties;
}

/** O desenho da tecnologia (ou o monograma), sem ladrilho. Nunca distorce: o viewBox é quadrado e o SVG também. */
export const TechGlyph: React.FC<TechGlyphProps> = ({ tech, size, color, surface, progress = 1, style }) => {
  const fill = surface ? brandOn(surface, tech.color, color ?? FALLBACK_INK[surface]) : (color ?? theme.color.ink);
  const shared: React.CSSProperties = { flexShrink: 0, opacity: Math.min(1, progress * 1.6), scale: String(0.8 + 0.2 * progress), ...style };
  const icon = tech.icon ? TECH_ICONS[tech.icon] : undefined;
  if (!icon) {
    const letters = monogram(tech);
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.font.display,
          fontWeight: 600,
          fontSize: size * monogramScale(letters) * 1.25,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: fill,
          ...shared,
        }}
      >
        {letters}
      </div>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${icon.box} ${icon.box}`} fill={fill} fillRule={icon.evenodd ? 'evenodd' : undefined} style={shared}>
      {icon.paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
};

export interface TechMarkProps extends Omit<TechGlyphProps, 'tech'> {
  /** rótulo do item: se nomeia uma tecnologia do catálogo, o ícone aparece sozinho */
  label?: unknown;
  /** `tech:<id>` explícito (vence o rótulo) */
  icon?: unknown;
  /** `autoTechIcons` do componente: false desliga a detecção pelo rótulo */
  auto?: boolean;
}

/** Ícone de tecnologia ao lado de um rótulo; não desenha nada quando o item não é uma tecnologia. */
export const TechMark: React.FC<TechMarkProps> = ({ label, icon, auto = true, ...glyph }) => {
  const tech = techFor(label, icon, auto);
  return tech ? <TechGlyph tech={tech} {...glyph} /> : null;
};
