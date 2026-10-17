import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { Easing } from 'remotion';

import { easeInOut } from './arsenal/stage';

/** Durações, distâncias e curvas medidas do nível max (a tabela mora no módulo puro que o ffmpeg também lê). */
export { stageMotion } from './arsenal/stage';

const inter = loadInter('normal', { weights: ['500', '600', '800'], subsets: ['latin', 'latin-ext'] });
const playfair = loadPlayfair('normal', { weights: ['600'], subsets: ['latin', 'latin-ext'] });
// itálico só no peso de título: é a palavra em coral das frases serifadas
loadPlayfair('italic', { weights: ['600'], subsets: ['latin', 'latin-ext'] });
const mono = loadMono('normal', { weights: ['500', '700'], subsets: ['latin', 'latin-ext'] });

/**
 * Tokens do design system MChiodi, adaptados para vídeo: no site o fundo é `paper`;
 * sobre footage, as superfícies claras viram cartões e o texto solto fica branco com contorno `ink`.
 */
export const theme = {
  color: {
    paper: '#f8f8f2',
    ink: '#111827',
    slate900: '#0f172a',
    slate600: '#475569',
    slate300: '#cbd5e1',
    coral: '#ff5555',
    coralDeep: '#ca3434',
    emerald: '#34d399',
    night: '#0c0c0c',
    white: '#ffffff',
    glowMint: '#9dffce',
    glowPeriwinkle: '#7c93ff',
    glowPeach: '#ffb86c',
  },
  font: {
    body: inter.fontFamily,
    display: playfair.fontFamily,
    mono: mono.fontFamily,
  },
  radius: { card: 24, panel: 16, pill: 9999 },
  shadow: {
    card: '0 18px 35px -20px rgba(15,23,42,0.55)',
    raised: '0 30px 70px -30px rgba(15,23,42,0.75)',
  },
  /** margem segura: nada de texto fora dela (UI do YouTube, cortes de TV) */
  safe: { x: 96, y: 64 },
} as const;

/**
 * Linguagem de movimento única do canal: tudo entra desacelerando e sai acelerando,
 * com as mesmas duas curvas. É o que dá consistência entre componentes.
 */
export const motion = {
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  exit: Easing.bezier(0.7, 0, 0.84, 0),
  move: Easing.bezier(0.45, 0, 0.55, 1),
  pop: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** troca de layout, zoom na janela, palavra e saída do nível max: `cubic-bezier(0.65, 0, 0.35, 1)` na forma que o ffmpeg também avalia */
  stage: easeInOut,
  /** durações em segundos */
  fast: 0.2,
  base: 0.4,
  slow: 0.7,
} as const;
