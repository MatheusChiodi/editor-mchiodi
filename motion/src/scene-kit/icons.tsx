import { isTechIconName, resolveTech } from '../../../src/tech/catalog';
import type { Surface } from '../../../src/tech/color';
import { TechGlyph } from '../tech/glyph';
import { theme } from '../theme';

/**
 * Ícones próprios em traço fino (grade 24x24, estilo lucide). Cada um é uma lista de `d` de path:
 * sem dependência de biblioteca de ícones no bundle. Logo de TECNOLOGIA não se desenha aqui: vem da biblioteca
 * (`tech:<id>`, motion/src/tech), que o `Icon` abaixo resolve no mesmo lugar.
 */
export const ICONS = {
  server: [
    'M4 3.5h16a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 20 10.5H4A1.5 1.5 0 0 1 2.5 9V5A1.5 1.5 0 0 1 4 3.5z',
    'M4 13.5h16a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19v-4A1.5 1.5 0 0 1 4 13.5z',
    'M6.5 7h.01',
    'M6.5 17h.01',
    'M10.5 7h7',
    'M10.5 17h7',
  ],
  database: [
    'M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3z',
    'M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6',
    'M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6',
  ],
  browser: [
    'M4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-13A1.5 1.5 0 0 1 4.5 4z',
    'M3 9h18',
    'M6.25 6.5h.01',
    'M9 6.5h.01',
    'M7 13h6',
    'M7 16.5h10',
  ],
  phone: ['M8.5 2h7A2.5 2.5 0 0 1 18 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19.5v-15A2.5 2.5 0 0 1 8.5 2z', 'M10.5 18.5h3'],
  code: ['M8 7l-5 5 5 5', 'M16 7l5 5-5 5', 'M13.5 4.5l-3 15'],
  gear: [
    'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    'M12 2v3',
    'M12 19v3',
    'M2 12h3',
    'M19 12h3',
    'M4.93 4.93l2.12 2.12',
    'M16.95 16.95l2.12 2.12',
    'M4.93 19.07l2.12-2.12',
    'M16.95 7.05l2.12-2.12',
  ],
  bolt: ['M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z'],
  lock: ['M6.5 11h11A1.5 1.5 0 0 1 19 12.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-7A1.5 1.5 0 0 1 6.5 11z', 'M8 11V7.5a4 4 0 0 1 8 0V11', 'M12 15v2'],
  user: ['M12 3.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4.5 20.5c0-3.6 3.3-5.5 7.5-5.5s7.5 1.9 7.5 5.5'],
  cloud: ['M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.6a4 4 0 0 1-.5 7.9H7z'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  // substantivos gerais, para os modelos de animação (motion/src/scenes/modelos) receberem o ícone por nome
  bell: ['M4 17a8 8 0 0 1 16 0', 'M2.5 17h19', 'M12 9V6.5', 'M10 6.5h4', 'M5 20.5h14'],
  book: [
    'M3.5 5.5A1.5 1.5 0 0 1 5 4h5.5A1.5 1.5 0 0 1 12 5.5V20a2 2 0 0 0-2-1.5H3.5v-13z',
    'M20.5 5.5A1.5 1.5 0 0 0 19 4h-5.5A1.5 1.5 0 0 0 12 5.5V20a2 2 0 0 1 2-1.5h6.5v-13z',
  ],
  flag: ['M5.5 21V3.5', 'M5.5 4.5H18l-2.5 4 2.5 4H5.5'],
  users: [
    'M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    'M2.5 20c0-3.2 2.9-5 6.5-5s6.5 1.8 6.5 5',
    'M16 4.3a3.5 3.5 0 0 1 0 6.4',
    'M18 15.4c2.1.6 3.5 2.2 3.5 4.6',
  ],
  chat: ['M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 4v-4H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z', 'M8 9h8', 'M8 12.5h5'],
  file: ['M7 3h7l5 5v11.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7 3z', 'M14 3v5h5', 'M9.5 13h5.5', 'M9.5 16.5h5.5'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0V4z', 'M8 5.5H5a3 3 0 0 0 3 4', 'M16 5.5h3a3 3 0 0 1-3 4', 'M12 13v4.5', 'M8 20.5h8', 'M9.5 17.5h5'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  heart: ['M12 20.5S3.5 15.5 3.5 9.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8.5 1.6c0 6.3-8.5 11.3-8.5 11.3z'],
  award: ['M12 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M8.5 14L7 21l5-2.8 5 2.8-1.5-7'],
} as const satisfies Record<string, readonly string[]>;

export type StrokeIconName = keyof typeof ICONS;
/** Ícone de tecnologia do catálogo (src/tech/catalog.ts): `tech:react`, `tech:nodejs`… */
export type TechIconName = `tech:${string}`;
/** Todo nome que uma prop `icon` aceita: um ícone de traço do kit ou `tech:<id>`. */
export type IconName = StrokeIconName | TechIconName;

export const ICON_NAMES = Object.keys(ICONS) as StrokeIconName[];

export function isStrokeIconName(value: string): value is StrokeIconName {
  return Object.hasOwn(ICONS, value);
}

/** Vale para os ícones de traço e para `tech:<id>` de uma tecnologia que existe no catálogo. */
export function isIconName(value: string): value is IconName {
  return isStrokeIconName(value) || isTechIconName(value);
}

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** espessura na grade de 24: 1.75 é o traço fino do site */
  strokeWidth?: number;
  /** 0→1: o ícone se desenha pelo traço */
  draw?: number;
  /** só para `tech:<id>`: superfície em que o ícone está; com ela o logo sai na cor da marca quando há contraste, senão em `color` */
  surface?: Surface;
}

/**
 * O ponto único de resolução de ícone do projeto: nome de traço desenha o traço; `tech:<id>` desenha o logo da
 * tecnologia pela biblioteca (cheio, sem distorcer). Nome desconhecido não desenha nada em vez de quebrar o render.
 */
export const Icon: React.FC<IconProps> = ({ name, size = 48, color = theme.color.slate900, strokeWidth = 1.75, draw = 1, surface }) => {
  if (!isStrokeIconName(name)) {
    const tech = resolveTech(name);
    return tech ? <TechGlyph tech={tech} size={size} color={color} surface={surface} progress={draw} /> : null;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map((d, index) => (
        <path key={index} d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} opacity={draw > 0 ? 1 : 0} />
      ))}
    </svg>
  );
};

/** Mesmo componente, com o nome que diz o que ele faz: aceita qualquer ícone (traço ou tecnologia). */
export const AnyIcon = Icon;
