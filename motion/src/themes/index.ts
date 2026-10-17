// Registro dos TEMAS de universo. A ficha de cada um (paleta, peças, direitos) está em `./specs.ts` (módulo puro);
// aqui entram os desenhos. Tema novo: ficha em specs.ts + pasta `./<id>/index.tsx` + uma linha neste registro.

import { batman } from './batman';
import { neutro } from './neutro';
import type { AnalogyTheme } from './shared/kit';
import { NEUTRAL_THEME, resolveThemeId } from './specs';

export const themes: Record<string, AnalogyTheme> = {
  [NEUTRAL_THEME]: neutro,
  batman,
};

/**
 * Tema pedido na prop `theme` de um modelo. Id desconhecido cai no tema da categoria (se informada) e depois no neutro:
 * uma EDL com um universo que ainda não tem tema continua renderizando.
 */
export function getTheme(id?: string | null, category?: string | null): AnalogyTheme {
  return themes[resolveThemeId(id, category)] ?? themes[id ?? ''] ?? neutro;
}

export { NEUTRAL_THEME, resolveThemeId, THEME_SPECS, themeSpec } from './specs';
export type { AnalogyTheme, FrameProps, TransitionProps, WorldProps } from './shared/kit';
export { Chrome, ThemeBar, ThemePanel, ThemeTitle } from './shared/kit';
export type { Actor, ActorKind, ThemePalette, ThemeSpec } from './types';
