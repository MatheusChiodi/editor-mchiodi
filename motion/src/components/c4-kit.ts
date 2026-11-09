import type React from 'react';

import { theme } from '../theme';

/**
 * Texto solto sobre footage: branco com contorno `ink` grosso (pintado por fora do traço da letra), que lê tanto sobre
 * parede branca quanto sobre cena escura. A sombra sozinha sumia em fundo claro.
 */
export function outlinedLabel(fontSize: number): React.CSSProperties {
  return {
    fontFamily: theme.font.body,
    fontWeight: 800,
    fontSize,
    color: theme.color.white,
    WebkitTextStroke: `${Math.max(4, Math.round(fontSize * 0.14))}px ${theme.color.ink}`,
    paintOrder: 'stroke fill',
    textShadow: `0 4px 14px rgba(15,23,42,0.55)`,
    textAlign: 'center',
  };
}
