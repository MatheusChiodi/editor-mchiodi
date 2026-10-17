import { voxelPalette } from '../theme';

/** Letra do desenho → cor. `.` (ou qualquer letra fora do mapa) é transparente. */
export const PIXEL_COLORS: Record<string, string> = {
  a: voxelPalette.accent,
  w: voxelPalette.text,
  k: voxelPalette.ok,
  c: voxelPalette.gem,
  g: '#2E3050',
  p: '#B8BAD4',
  h: '#9A7550',
  t: '#6B6E90',
  y: '#FFD866',
};

export function pixelColor(char: string, colors: Record<string, string> = PIXEL_COLORS): string | null {
  return colors[char] ?? null;
}

/** Ícones genéricos em pixel (12x12). Uma cena pode passar o próprio desenho em `rows`. */
export const PIXEL_ICONS = {
  check: [
    '............',
    '..........kk',
    '.........kkk',
    '........kkk.',
    '.......kkk..',
    'kk....kkk...',
    'kkk..kkk....',
    '.kkkkkk.....',
    '..kkkk......',
    '...kk.......',
    '............',
    '............',
  ],
  star: [
    '.....yy.....',
    '.....yy.....',
    '....yyyy....',
    'yyyyyyyyyyyy',
    '.yyyyyyyyyy.',
    '..yyyyyyyy..',
    '...yyyyyy...',
    '..yyyyyyyy..',
    '..yyy..yyy..',
    '.yyy....yyy.',
    '.yy......yy.',
    '............',
  ],
  gem: [
    '............',
    '..cccccccc..',
    '.ccwwcccccc.',
    'ccwwcccccccc',
    'cccccccccccc',
    '.cccccccccc.',
    '..cccccccc..',
    '...cccccc...',
    '....cccc....',
    '.....cc.....',
    '............',
    '............',
  ],
  pickaxe: [
    '..ppppppp...',
    '.pppppppppp.',
    'pp.....hhpp.',
    'p.....hhh.pp',
    '.....hhh..pp',
    '....hhh....p',
    '...hhh.....p',
    '..hhh.......',
    '.hhh........',
    'hhh.........',
    'hh..........',
    '............',
  ],
  alert: [
    '.....aa.....',
    '....aaaa....',
    '....awwa....',
    '...aawwaa...',
    '...aawwaa...',
    '..aaawwaaa..',
    '..aaawwaaa..',
    '.aaaaaaaaaa.',
    '.aaaawwaaaa.',
    'aaaaawwaaaaa',
    'aaaaaaaaaaaa',
    '............',
  ],
} as const satisfies Record<string, readonly string[]>;

export type PixelIconName = keyof typeof PIXEL_ICONS;

export interface PixelIconProps {
  name?: PixelIconName;
  /** desenho próprio: uma string por linha, uma letra por pixel */
  rows?: readonly string[];
  colors?: Record<string, string>;
  size: number;
}

export const PixelIcon: React.FC<PixelIconProps> = ({ name = 'check', rows = PIXEL_ICONS[name], colors, size }) => {
  const columns = Math.max(1, ...rows.map((row) => row.length));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${columns} ${Math.max(1, rows.length)}`} shapeRendering="crispEdges">
      {rows.flatMap((row, y) =>
        [...row].map((char, x) => {
          const fill = pixelColor(char, colors);
          return fill ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} /> : null;
        }),
      )}
    </svg>
  );
};
