import { loadFont as loadPressStart } from '@remotion/google-fonts/PressStart2P';
import { loadFont as loadVt323 } from '@remotion/google-fonts/VT323';

import { theme } from '../../theme';

const pressStart = loadPressStart('normal', { weights: ['400'], subsets: ['latin', 'latin-ext'] });
const vt323 = loadVt323('normal', { weights: ['400'], subsets: ['latin', 'latin-ext'] });

/** Fontes de pixel: a exceção "game" do canal, só dentro de cena voxel. */
export const voxelFonts = {
  title: pressStart.fontFamily,
  mono: vt323.fontFamily,
} as const;

/** Paleta do mundo voxel (do voxel-story). O acento continua sendo o coral da marca. */
export const voxelPalette = {
  accent: theme.color.coral,
  ok: '#4ADE80',
  gem: '#4BE4FF',
  nightTop: '#0A0A1F',
  nightBottom: '#1B1B3A',
  dayTop: '#5B8FD9',
  dayBottom: '#CFE8FF',
  dawnTop: '#39407E',
  dawnMid: '#F2A0A8',
  dawnBottom: '#FFBE7A',
  panel: '#12122B',
  text: '#F4F4F8',
  muted: '#A9ABC8',
  panelBorder: '#F4F4F8',
  panelInner: '#3A3D66',
  shadow: 'rgba(4, 4, 14, 0.55)',
} as const;
