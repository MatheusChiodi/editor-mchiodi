import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel';
import { loadFont as loadOrbitron } from '@remotion/google-fonts/Orbitron';

import { voxelFonts } from '../../scene-kit/voxel/theme';
import { theme } from '../../theme';

const bebas = loadBebas('normal', { weights: ['400'], subsets: ['latin', 'latin-ext'] });
const cinzel = loadCinzel('normal', { weights: ['700'], subsets: ['latin', 'latin-ext'] });
const orbitron = loadOrbitron('normal', { weights: ['700'], subsets: ['latin'] });

/** Fonte de APOIO de um tema (rótulos de HUD, eyebrow, números de nível). O conteúdo continua em Playfair/Inter. */
export interface ChromeFont {
  family: string;
  weight: number;
  spacing: string;
  /** multiplicador do tamanho pedido: cada fonte ocupa uma largura diferente no mesmo corpo */
  scale: number;
}

/** Só fontes livres do Google Fonts, pelo nome que está em `ThemeSpec.chromeFont`. */
export const CHROME_FONTS: Record<string, ChromeFont> = {
  Inter: { family: theme.font.body, weight: 600, spacing: '0.3em', scale: 1 },
  'Bebas Neue': { family: bebas.fontFamily, weight: 400, spacing: '0.16em', scale: 1.28 },
  'Press Start 2P': { family: voxelFonts.title, weight: 400, spacing: '0.02em', scale: 0.62 },
  'JetBrains Mono': { family: theme.font.mono, weight: 700, spacing: '0.14em', scale: 0.94 },
  Orbitron: { family: orbitron.fontFamily, weight: 700, spacing: '0.22em', scale: 0.86 },
  Cinzel: { family: cinzel.fontFamily, weight: 700, spacing: '0.16em', scale: 1 },
};

export function chromeFont(name: string): ChromeFont {
  return CHROME_FONTS[name] ?? CHROME_FONTS.Inter!;
}
