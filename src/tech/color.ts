// Contraste dos ícones de tecnologia (WCAG 2.x). Puro: o componente e os testes usam as mesmas contas.

/** Superfícies do design system sobre as quais um ícone é desenhado. */
export const SURFACE = { light: '#ffffff', dark: '#111827' } as const;
export type Surface = keyof typeof SURFACE;

/** Tinta de reserva quando a cor da marca não tem contraste com a superfície. */
export const FALLBACK_INK = { light: '#111827', dark: '#f8f8f2' } as const;

/** Contraste mínimo de um elemento gráfico (WCAG 1.4.11). */
export const MIN_ICON_CONTRAST = 3;

function channel(value: number): number {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa (0–1) de `#RRGGBB`. */
export function luminance(hex: string): number {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
}

/** Razão de contraste (1–21) entre duas cores. */
export function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** Ladrilho da variante `brand`: o claro ou o escuro, o que der mais contraste com a cor da marca. */
export function tileFor(brand: string): Surface {
  return contrastRatio(brand, SURFACE.light) >= contrastRatio(brand, SURFACE.dark) ? 'light' : 'dark';
}

/**
 * Cor em que o ícone é desenhado sobre uma superfície: a da marca quando ela se destaca, senão a tinta de reserva
 * (logo preto em fundo escuro vira claro; logo amarelo em fundo claro vira ink).
 */
export function brandOn(surface: Surface, brand: string, fallback: string = FALLBACK_INK[surface]): string {
  return contrastRatio(brand, SURFACE[surface]) >= MIN_ICON_CONTRAST ? brand : fallback;
}

/** Tinta legível (ink ou branco) para texto sobre uma cor cheia: o monograma em cima da cor da marca. */
export function inkOn(background: string): string {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, SURFACE.dark) ? '#ffffff' : SURFACE.dark;
}
