// Tema BATMAN — noir gótico. Evoca o universo por atmosfera (noite azul-carvão, cidade em agulhas, holofote nas nuvens,
// chuva) e por silhuetas genéricas desenhadas aqui: vigilante de capa, mordomo de fraque com bandeja, vilão de cartola.
// Nada de logotipo, traje ou personagem oficial: o emblema de morcego é um polígono facetado próprio.

import { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { Corners, defineTheme, edgeTint, transitionPhases } from '../shared/generic';
import { type ActorArt, type FrameProps, H, type SceneryProps, type TransitionProps, W } from '../shared/kit';
import { buildingPath, clamp01, fade, mixColor, rand, skyline } from '../shared/math';
import { themeSpec } from '../specs';
import type { ActorKind, ThemePalette } from '../types';

const spec = themeSpec('batman');
const AMBER = '#f6c453';

/** Emblema de morcego PRÓPRIO: polígono facetado, sem oval e sem as curvas de nenhum logotipo existente. Caixa de 80×26. */
export const BAT_GLYPH = 'M0 -4L4 -12L7 -5L14 -9L26 -12L40 -4L31 -3L26 3L19 0L13 7L7 3L0 13L-7 3L-13 7L-19 0L-26 3L-31 -3L-40 -4L-26 -12L-14 -9L-7 -5L-4 -12Z';

// --------------------------------------------------------------------------------------------- cenário

const Far: React.FC<SceneryProps> = ({ palette, t }) => (
  <>
    <defs>
      <radialGradient id="bat-moon-halo">
        <stop offset="0" stopColor={fade(palette.glow, 0.42)} />
        <stop offset="0.4" stopColor={fade(palette.glow, 0.12)} />
        <stop offset="1" stopColor={fade(palette.glow, 0)} />
      </radialGradient>
      <radialGradient id="bat-moon" cx="0.4" cy="0.38">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.7" stopColor="#dfe8fb" />
        <stop offset="1" stopColor="#b9c8e6" />
      </radialGradient>
      <filter id="bat-cloud" x="-30%" y="-80%" width="160%" height="260%">
        <feGaussianBlur stdDeviation="26" />
      </filter>
    </defs>
    <circle cx={1650} cy={150} r={330} fill="url(#bat-moon-halo)" />
    <circle cx={1650} cy={150} r={74} fill="url(#bat-moon)" />
    <g fill={fade('#8fa2c8', 0.5)}>
      <circle cx={1628} cy={132} r={13} />
      <circle cx={1676} cy={172} r={9} />
      <circle cx={1660} cy={118} r={6} />
    </g>
    <g filter="url(#bat-cloud)">
      {[
        [1500, 196, 300, 34, 0.9],
        [1790, 120, 230, 28, 0.85],
        [420, 250, 420, 40, 0.55],
        [1060, 330, 520, 44, 0.5],
        [1700, 400, 400, 38, 0.5],
        [80, 420, 380, 36, 0.45],
      ].map(([x, y, rx, ry, alpha], index) => (
        <ellipse key={index} cx={x! + ((t * (5 + index * 1.7)) % 400) - 60} cy={y} rx={rx} ry={ry} fill={fade(mixColor(palette.sky[2]!, palette.glow, 0.16), alpha!)} />
      ))}
    </g>
  </>
);

const Mid: React.FC<SceneryProps> = ({ palette, ground, t }) => {
  const far = useMemo(() => skyline(11, { minH: 150, maxH: 400, minW: 60, maxW: 130, lit: 0.05 }), []);
  const mid = useMemo(() => skyline(23, { minH: 130, maxH: 330, minW: 90, maxW: 190, lit: 0.13, gothic: 0.45 }), []);
  const farColor = mixColor(palette.shade, palette.sky[2]!, 0.55);
  const midColor = mixColor(palette.shade, palette.sky[1]!, 0.2);
  return (
    <>
      <defs>
        <linearGradient id="bat-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fade(palette.sky[2]!, 0)} />
          <stop offset="1" stopColor={fade(mixColor(palette.sky[2]!, palette.glow, 0.2), 0.75)} />
        </linearGradient>
        <filter id="bat-fog" x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
      </defs>
      <g fill={farColor}>
        {far.map((building, index) => (
          <path key={index} d={buildingPath(building, ground + 30)} />
        ))}
      </g>
      <rect x={-600} y={ground - 260} width={3120} height={300} fill="url(#bat-haze)" />
      <g fill={midColor}>
        {mid.map((building, index) => (
          <path key={index} d={buildingPath(building, ground + 60)} />
        ))}
      </g>
      {/* janelas acesas: poucas, âmbar, algumas piscando devagar */}
      <g fill={AMBER}>
        {mid.flatMap((building, index) =>
          building.lit.map(([col, row]) => {
            const flicker = 0.55 + 0.35 * Math.sin(t * (0.5 + rand(5, index * 31 + col)) + col * 7 + row);
            return <rect key={`${index}-${col}-${row}`} x={building.x + 12 + col * 22} y={ground + 60 - building.h + 16 + row * 30} width={9} height={14} opacity={flicker} />;
          }),
        )}
      </g>
      <g filter="url(#bat-fog)" fill={fade(mixColor(palette.sky[2]!, palette.glow, 0.3), 0.42)}>
        <ellipse cx={500 + Math.sin(t * 0.2) * 60} cy={ground + 10} rx={700} ry={46} />
        <ellipse cx={1500 - Math.sin(t * 0.17) * 70} cy={ground - 20} rx={620} ry={40} />
      </g>
    </>
  );
};

const Near: React.FC<SceneryProps> = ({ palette, ground }) => {
  const rim = fade(palette.secondary, 0.6);
  const stone = mixColor(palette.ground, palette.secondary, 0.1);
  return (
    <>
      <defs>
        <linearGradient id="bat-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mixColor(palette.ground, palette.secondary, 0.16)} />
          <stop offset="0.25" stopColor={palette.ground} />
          <stop offset="1" stopColor="#010204" />
        </linearGradient>
      </defs>
      {/* caixa-d'água à direita e chaminé à esquerda emolduram o quadro */}
      <g fill={palette.figure}>
        <path d={`M1778 ${ground}L1790 ${ground - 150}H1800L1806 ${ground}Z`} />
        <path d={`M1896 ${ground}L1890 ${ground - 150}H1880L1872 ${ground}Z`} />
        <path d={`M1772 ${ground - 150}H1908V${ground - 268}H1772Z`} />
        <path d={`M1760 ${ground - 268}L1840 ${ground - 322}L1920 ${ground - 268}Z`} />
        <path d={`M-60 ${ground}V${ground - 210}H70V${ground}Z`} />
        <path d={`M-74 ${ground - 210}H84V${ground - 232}H-74Z`} />
        <path d={`M8 ${ground - 232}V${ground - 420}`} stroke={palette.figure} strokeWidth={5} />
        <path d={`M-18 ${ground - 372}H34M-8 ${ground - 400}H24`} stroke={palette.figure} strokeWidth={4} />
      </g>
      <g stroke={rim} strokeWidth={2.5} fill="none">
        <path d={`M1772 ${ground - 150}V${ground - 268}L1840 ${ground - 322}`} />
        <path d={`M-74 ${ground - 232}H84`} />
      </g>
      <g stroke={fade(palette.secondary, 0.22)} strokeWidth={2}>
        {[0.25, 0.5, 0.75].map((k) => (
          <path key={k} d={`M1772 ${ground - 150 - 118 * k}H1908`} />
        ))}
      </g>
      <rect x={-600} y={ground} width={3120} height={520} fill="url(#bat-roof)" />
      {/* parapeito: o filete frio é a luz da lua batendo na aresta */}
      <rect x={-600} y={ground - 16} width={3120} height={18} fill={stone} />
      <path d={`M-600 ${ground - 16}H2520`} stroke={rim} strokeWidth={2.5} />
      <g stroke={fade('#000000', 0.55)} strokeWidth={2}>
        {Array.from({ length: 26 }, (_, index) => (
          <path key={index} d={`M${-560 + index * 122} ${ground - 15}V${ground + 2}`} />
        ))}
      </g>
      <path d={`M-600 ${ground + 46}H2520`} stroke={fade(palette.secondary, 0.14)} strokeWidth={2} />
    </>
  );
};

const RAIN = Array.from({ length: 120 }, (_, index) => ({ x: rand(71, index) * 2700 - 380, offset: rand(72, index) * 1400, speed: 900 + rand(73, index) * 700, length: 40 + rand(74, index) * 40 }));

const Rain: React.FC<{ t: number; color: string; strength: number }> = ({ t, color, strength }) => (
  <g stroke={color} strokeWidth={1.8} strokeLinecap="round" opacity={strength}>
    {RAIN.map((drop, index) => {
      const y = ((drop.offset + t * drop.speed) % 1400) - 160;
      return <path key={index} d={`M${(drop.x - y * 0.22).toFixed(1)} ${y.toFixed(1)}l${(-drop.length * 0.22).toFixed(1)} ${drop.length.toFixed(1)}`} />;
    })}
  </g>
);

const Front: React.FC<SceneryProps> = ({ palette, t, intensity }) => <Rain t={t} color={fade(palette.glow, 0.5)} strength={0.3 * intensity} />;

// --------------------------------------------------------------------------------------------- figuras

/** Silhueta com contraluz: a mesma forma desenhada duas vezes, a de baixo deslocada para o lado da luz e na cor fria. */
const Sil: React.FC<{ palette: ThemePalette; rim?: string; children: (fill: string) => React.ReactNode }> = ({ palette, rim, children }) => (
  <>
    <ellipse cx={0} cy={1} rx={30} ry={4} fill={fade('#000000', 0.55)} />
    <g transform="translate(-1.5 -0.8)">{children(fade(rim ?? palette.secondary, 0.9))}</g>
    {children(palette.figure)}
  </>
);

type Head = 'cowl' | 'round' | 'hair' | 'fin' | 'helm' | 'hood';
type Cape = 'long' | 'short' | 'none';

interface Build {
  head: Head;
  cape: Cape;
  /** meia largura dos ombros */
  shoulders: number;
  extra?: 'akimbo' | 'shield' | 'streak' | 'armor' | 'bow';
  /** cor do único detalhe aceso (olhos, visor, cinto) */
  light: string;
}

// seis arquétipos de equipe de heróis, sem identidade: sombra, força, guerreira, velocista, armadura, arqueiro
const BUILDS: Build[] = [
  { head: 'cowl', cape: 'long', shoulders: 14, light: '#ffffff' },
  { head: 'round', cape: 'long', shoulders: 17, extra: 'akimbo', light: AMBER },
  { head: 'hair', cape: 'none', shoulders: 13, extra: 'shield', light: '#ffd9a0' },
  { head: 'fin', cape: 'none', shoulders: 11.5, extra: 'streak', light: '#ffe45c' },
  { head: 'helm', cape: 'none', shoulders: 18, extra: 'armor', light: '#7fd8ff' },
  { head: 'hood', cape: 'short', shoulders: 13, extra: 'bow', light: '#8ff0b0' },
];

function headPath(head: Head): string {
  switch (head) {
    case 'cowl':
      return 'M-8 -91L-9.5 -105L-4 -97.5H4L9.5 -105L8 -91Q8.5 -80 0 -78Q-8.5 -80 -8 -91Z';
    case 'hair':
      return 'M-8 -90A8 8.5 0 1 1 8 -90L11 -70L6 -76Q4 -78 0 -78Q-6 -78 -8 -84Z';
    case 'fin':
      return 'M-7.5 -90A7.5 8.5 0 1 1 7.5 -90Q7.5 -79 0 -78Q-7.5 -79 -7.5 -90ZM-6 -96L-15 -102L-7 -92Z';
    case 'helm':
      return 'M-9 -98H9L10.5 -84L6 -77H-6L-10.5 -84Z';
    case 'hood':
      return 'M0 -103L10 -88L8 -77H-8L-10 -88Z';
    default:
      return 'M-8 -90A8 8.5 0 1 1 8 -90Q8 -79 0 -78Q-8 -79 -8 -90Z';
  }
}

function figure(build: Build, sway: number, fill: string): React.ReactNode {
  const s = build.shoulders;
  const hem = (x: number, y: number) => `${(x + sway * (1 + y / 90)).toFixed(2)} ${y}`;
  return (
    <>
      {build.cape === 'long' ? (
        <path d={`M${-s} -78C${-s - 16} -58 ${-s - 26} -28 ${hem(-s - 30, 0)}L${hem(-s - 19, -7)}L${hem(-s - 11, 0)}L${hem(-s - 2, -7)}L${hem(-4, 0)}L${hem(5, -7)}L${hem(13, 0)}L${hem(22, -7)}L${hem(s + 16, 0)}C${s + 12} -30 ${s + 6} -58 ${s} -78Z`} fill={fill} />
      ) : null}
      {build.cape === 'short' ? <path d={`M${-s} -78C${-s - 8} -64 ${-s - 12} -50 ${hem(-s - 12, -36)}L${hem(-s - 4, -42)}L${hem(-s + 3, -36)}L${-s + 4} -76Z`} fill={fill} /> : null}
      <path d={`M${-s} -78H${s}L${s * 0.72} -44H${-s * 0.72}Z`} fill={fill} />
      <path d={`M${-s * 0.72} -46H-0.6L-2.5 0H-9.5Z`} fill={fill} />
      <path d={`M0.6 -46H${s * 0.72}L9.5 0H2.5Z`} fill={fill} />
      {build.extra === 'akimbo' ? (
        <path d={`M${-s} -76L${-s - 9} -58L${-s * 0.72} -50ZM${s} -76L${s + 9} -58L${s * 0.72} -50Z`} fill={fill} />
      ) : (
        <path d={`M${-s} -77L${-s - 3} -46L${-s + 2} -45ZM${s} -77L${s + 3} -46L${s - 2} -45Z`} fill={fill} stroke={fill} strokeWidth={3.4} strokeLinejoin="round" />
      )}
      {build.extra === 'armor' ? <path d={`M${-s - 4} -76A6 6 0 1 1 ${-s + 8} -76ZM${s - 8} -76A6 6 0 1 1 ${s + 4} -76Z`} fill={fill} /> : null}
      {build.extra === 'shield' ? <circle cx={-s - 3} cy={-52} r={12} fill={fill} /> : null}
      {build.extra === 'shield' ? <path d={`M${s + 3} -47L${s + 6} -101`} stroke={fill} strokeWidth={2.6} strokeLinecap="round" /> : null}
      {build.extra === 'bow' ? <path d={`M${s + 6} -92Q${s + 22} -60 ${s + 6} -28`} fill="none" stroke={fill} strokeWidth={2.6} strokeLinecap="round" /> : null}
      {build.extra === 'bow' ? <path d={`M${-s + 2} -80L${-s - 6} -96M${-s + 6} -80L${-s} -98`} stroke={fill} strokeWidth={2} strokeLinecap="round" /> : null}
      <path d={headPath(build.head)} fill={fill} />
    </>
  );
}

function lights(build: Build): React.ReactNode {
  const color = build.light;
  switch (build.head) {
    case 'helm':
      return (
        <>
          <path d="M-6 -90H6" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={0} cy={-64} r={2.6} fill={color} />
        </>
      );
    case 'hood':
      return <path d="M-4 -86L-1.5 -85M4 -86L1.5 -85" stroke={color} strokeWidth={1.5} strokeLinecap="round" />;
    case 'cowl':
      return <path d="M-5.2 -90.5L-1.6 -89M5.2 -90.5L1.6 -89" stroke={color} strokeWidth={1.7} strokeLinecap="round" />;
    default:
      return build.extra === 'akimbo' ? <path d={`M${-build.shoulders * 0.72} -47H${build.shoulders * 0.72}`} stroke={color} strokeWidth={2.2} /> : null;
  }
}

const hero =
  (pick: (variant: number) => Build): ActorArt =>
  ({ actor, palette, t }) => {
    const build = pick(actor.variant ?? 0);
    const sway = Math.sin(t * 1.3 + (actor.variant ?? 0) * 1.7) * 2.4;
    const lean = build.extra === 'streak' ? 'rotate(5)' : undefined;
    return (
      <g transform={lean}>
        <Sil palette={palette} rim={actor.kind === 'member' ? mixColor(palette.secondary, build.light, 0.35) : undefined}>
          {(fill) => figure(build, sway, fill)}
        </Sil>
        {build.extra === 'streak' ? <path d="M-22 -70H-38M-20 -56H-44M-20 -42H-34" stroke={fade(build.light, 0.7)} strokeWidth={1.8} strokeLinecap="round" /> : null}
        {build.extra === 'shield' ? <circle cx={-16} cy={-52} r={8} fill="none" stroke={fade(build.light, 0.8)} strokeWidth={1.4} /> : null}
        {lights(build)}
      </g>
    );
  };

/** Mordomo de fraque, em silhueta, servindo uma bandeja com cloche: o "ajudante" do universo. */
const Helper: ActorArt = ({ palette, t }) => {
  const lift = Math.sin(t * 1.2) * 0.8;
  const body = (fill: string) => (
    <>
      <path d="M-7.5 -45H-1L-1.8 -3H-7Z" fill={fill} />
      <path d="M1 -45H7.5L7 -3H1.8Z" fill={fill} />
      <path d="M-10 -3H-0.8V0H-11.5ZM0.8 -3H10V0H0.8Z" fill={fill} />
      {/* fraque: frente curta, caudas atrás */}
      <path d="M-10.5 -78H10.5L9 -46L3 -42H-6L-9 -46Z" fill={fill} />
      <path d="M-10.5 -62L-17 -22L-11 -28L-8 -20L-6 -44Z" fill={fill} />
      <path d={`M9.5 -76L18 -62L27 ${(-68 + lift).toFixed(2)}`} fill="none" stroke={fill} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-10 -76L-13 -56L-8 -50" fill="none" stroke={fill} strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-7.2 -88A7.2 7.8 0 1 1 7.2 -88Q7.2 -80 0 -79Q-7.2 -80 -7.2 -88Z" fill={fill} />
    </>
  );
  return (
    <g>
      <Sil palette={palette}>{body}</Sil>
      {/* colarinho e gravata-borboleta: o único branco da figura */}
      <path d="M-3.4 -78L0 -67L3.4 -78Z" fill={fade(palette.glow, 0.92)} />
      <path d="M-4 -78.4L0 -76L4 -78.4V-73.6L0 -76L-4 -73.6Z" fill={palette.figure} />
      <path d="M20 -66L24 -52L29 -66Z" fill={fade(palette.glow, 0.85)} />
      <g transform={`translate(0 ${lift.toFixed(2)})`}>
        <ellipse cx={34} cy={-69} rx={17} ry={2.4} fill={mixColor(palette.glow, palette.secondary, 0.35)} />
        <path d="M22 -70.5A12 11 0 0 1 46 -70.5Z" fill={mixColor(palette.secondary, palette.figure, 0.45)} />
        <path d="M25 -72A9.5 8.5 0 0 1 36 -80.4" fill="none" stroke={fade(palette.glow, 0.8)} strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={34} cy={-82.6} r={1.9} fill={mixColor(palette.glow, palette.secondary, 0.3)} />
      </g>
    </g>
  );
};

/** Vilão de cartola e bengala: arquétipo de showman do crime, sem ser nenhum personagem. */
const Villain: ActorArt = ({ actor, palette, t }) => {
  const energy = actor.energy ?? 0;
  const shake = energy * Math.sin(t * 70) * 1.4;
  const body = (fill: string) => (
    <>
      <path d="M-8 -44H-1L-3 0H-10Z" fill={fill} />
      <path d="M1 -44H8L10 0H3Z" fill={fill} />
      <path d="M-13 -78H13L16 -40L21 -14L11 -24L7 -42H-7L-11 -24L-21 -14L-16 -40Z" fill={fill} />
      <path d="M12 -76L24 -58L27 -40" fill="none" stroke={fill} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-12 -76L-22 -62L-17 -50" fill="none" stroke={fill} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27 -44V0" stroke={fill} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={27} cy={-45} r={3} fill={fill} />
      <path d="M-7.5 -88A7.5 8 0 1 1 7.5 -88Q7.5 -79 0 -78Q-7.5 -79 -7.5 -88Z" fill={fill} />
      <path d="M-13 -94H13V-97H-13ZM-8.5 -97H8.5L9.5 -116H-9.5Z" fill={fill} />
    </>
  );
  return (
    <g transform={`translate(${shake.toFixed(2)} 0)`}>
      <Sil palette={palette} rim={mixColor(palette.secondary, palette.danger, 0.55 + energy * 0.4)}>
        {body}
      </Sil>
      <path d="M-9.5 -103H9.5" stroke={fade(palette.danger, 0.9)} strokeWidth={2.2} />
      <path d="M-4.6 -84.5Q0 -80.5 4.6 -84.5" fill="none" stroke={fade(palette.glow, 0.95)} strokeWidth={1.5} strokeLinecap="round" />
      <path d="M-4.4 -90L-1.6 -89M4.4 -90L1.6 -89" stroke={fade(palette.danger, 0.95)} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
};

/** Holofote nas nuvens com o emblema de morcego próprio: o feixe nasce atrás do telhado e varre devagar. */
const Emblem: ActorArt = ({ palette, t, uid }) => {
  const sweep = Math.sin(t * 0.5) * 2.4;
  return (
    <g transform={`rotate(${sweep.toFixed(2)} -230 330)`}>
      <defs>
        <radialGradient id={`${uid}spot`}>
          <stop offset="0" stopColor={fade('#fff3c4', 0.95)} />
          <stop offset="0.62" stopColor={fade(palette.primary, 0.82)} />
          <stop offset="0.86" stopColor={fade(palette.primary, 0.3)} />
          <stop offset="1" stopColor={fade(palette.primary, 0)} />
        </radialGradient>
        <linearGradient id={`${uid}beam`} gradientUnits="userSpaceOnUse" x1={-230} y1={330} x2={0} y2={-50}>
          <stop offset="0" stopColor={fade(palette.primary, 0)} />
          <stop offset="0.5" stopColor={fade(palette.primary, 0.1)} />
          <stop offset="1" stopColor={fade('#fff3c4', 0.3)} />
        </linearGradient>
        <filter id={`${uid}soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <path d="M-230 330L-58 -34L46 -76Z" fill={`url(#${uid}beam)`} />
      <ellipse cx={0} cy={-50} rx={92} ry={70} fill={fade(palette.primary, 0.1)} filter={`url(#${uid}soft)`} />
      <ellipse cx={0} cy={-50} rx={64} ry={48} fill={`url(#${uid}spot)`} />
      <path d={BAT_GLYPH} transform="translate(0 -50) scale(1.05)" fill={mixColor(palette.sky[0]!, palette.primary, 0.08)} />
    </g>
  );
};

/** Lampião de telhado: aceso (feito), pulsando (atual) ou apagado (bloqueado). */
const Node: ActorArt = ({ actor, palette, t, uid }) => {
  const state = actor.state ?? 'idle';
  const on = state === 'done' || state === 'active';
  const pulse = state === 'active' ? 0.75 + 0.25 * Math.sin(t * 4) : 1;
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}lamp`}>
          <stop offset="0" stopColor={fade(palette.primary, 0.75)} />
          <stop offset="1" stopColor={fade(palette.primary, 0)} />
        </radialGradient>
      </defs>
      {on ? <circle cx={0} cy={-66} r={state === 'active' ? 62 * pulse : 40} fill={`url(#${uid}lamp)`} /> : null}
      <path d="M-3 0V-44H3V0ZM-12 0H12V-5H-12Z" fill={palette.figure} stroke={fade(palette.secondary, 0.5)} strokeWidth={1} />
      <path d="M-20 -88H20L15 -44H-15Z" fill={on ? mixColor(palette.primary, '#ffffff', 0.25) : mixColor(palette.shade, palette.secondary, 0.2)} stroke={palette.figure} strokeWidth={3} />
      <path d="M-24 -88H24L0 -104Z" fill={palette.figure} />
      {state === 'done' ? <path d="M-8 -66L-2 -59L9 -74" fill="none" stroke={palette.figure} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </g>
  );
};

/** Bloco de pedra lavrada: as paredes da caverna/base, com a aresta de cima pegando luz. */
const Block: ActorArt = ({ actor, palette }) => {
  const width = ((actor.w ?? actor.h) / actor.h) * 100;
  const tone = mixColor(palette.shade, palette.secondary, 0.16 + ((actor.variant ?? 0) % 3) * 0.07);
  const active = actor.state === 'active';
  return (
    <g>
      <rect x={-width / 2} y={-100} width={width} height={100} fill={tone} stroke={palette.figure} strokeWidth={3} />
      <path d={`M${-width / 2 + 2} -98H${width / 2 - 2}`} stroke={active ? palette.primary : fade(palette.secondary, 0.75)} strokeWidth={active ? 5 : 3} />
      <path d={`M${-width / 2 + 2} -14H${width / 2 - 2}`} stroke={fade('#000000', 0.35)} strokeWidth={10} />
      <path d={`M${-width * 0.18} -100V-64M${width * 0.24} -36V0`} stroke={fade('#000000', 0.3)} strokeWidth={2} />
    </g>
  );
};

/** Janela gótica acesa: âmbar (opção 0) ou azul frio (opção 1). */
const Choice: ActorArt = ({ actor, palette, uid }) => {
  const second = (actor.variant ?? 0) % 2 === 1;
  const light = second ? palette.secondary : palette.primary;
  const chosen = actor.state === 'active';
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mixColor(light, '#ffffff', 0.45)} />
          <stop offset="1" stopColor={fade(light, chosen ? 0.9 : 0.55)} />
        </linearGradient>
        <radialGradient id={`${uid}halo`}>
          <stop offset="0" stopColor={fade(light, chosen ? 0.55 : 0.25)} />
          <stop offset="1" stopColor={fade(light, 0)} />
        </radialGradient>
      </defs>
      <circle cx={0} cy={-56} r={chosen ? 92 : 70} fill={`url(#${uid}halo)`} />
      <path d="M-32 0V-62Q-32 -96 0 -108Q32 -96 32 -62V0Z" fill={palette.figure} />
      <path d="M-25 -6V-62Q-25 -89 0 -99Q25 -89 25 -62V-6Z" fill={`url(#${uid}glass)`} />
      <path d="M0 -99V-6M-25 -52H25M-25 -62Q0 -40 25 -62" fill="none" stroke={palette.figure} strokeWidth={3} />
    </g>
  );
};

const Aura: ActorArt = ({ actor, palette, t }) => {
  const energy = clamp01(actor.energy ?? 1);
  return (
    <g transform="translate(0 -52)" opacity={energy}>
      <g transform={`rotate(${(t * 8).toFixed(2)})`} fill={fade(palette.primary, 0.14)}>
        {Array.from({ length: 12 }, (_, index) => (
          <path key={index} d="M0 0L-7 -120L7 -120Z" transform={`rotate(${index * 30})`} />
        ))}
      </g>
      <circle r={58} fill={fade(palette.primary, 0.16)} />
      <circle r={46 + Math.sin(t * 3) * 3} fill="none" stroke={fade(palette.primary, 0.7)} strokeWidth={2} />
    </g>
  );
};

const actors: Record<ActorKind, ActorArt> = {
  hero: hero(() => BUILDS[0]!),
  member: hero((variant) => BUILDS[variant % BUILDS.length]!),
  helper: Helper,
  villain: Villain,
  emblem: Emblem,
  node: Node,
  block: Block,
  choice: Choice,
  aura: Aura,
};

// --------------------------------------------------------------------------------------------- moldura e transição

const FRAME_SKYLINE = skyline(41, { from: -20, to: 1960, minH: 30, maxH: 104, minW: 46, maxW: 110, lit: 0, gothic: 0.5 });

/** Sobre o talking head: bordas em noite azul, chuva fina, a cidade em silhueta no rodapé e o holofote num canto. O centro fica livre. */
const Frame: React.FC<FrameProps> = ({ intensity, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { palette } = spec;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: edgeTint(palette.sky[0]!, 0.9 * intensity) }} />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(1720 260) scale(1.5)" opacity={0.9}>
          <Emblem actor={{ id: 'f', kind: 'emblem', x: 0, y: 0, h: 150 }} palette={palette} t={t} uid="batframe" />
        </g>
        <Rain t={t} color={fade(palette.glow, 0.55)} strength={0.26 * intensity} />
        <g fill={palette.figure}>
          {FRAME_SKYLINE.map((building, index) => (
            <path key={index} d={buildingPath(building, H + 4)} />
          ))}
        </g>
      </svg>
      <Corners color={fade(palette.secondary, 0.7)} size={64} weight={3} />
      {label ? (
        <div style={{ position: 'absolute', left: 76, top: 66, fontFamily: theme.chrome.family, fontSize: 40, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#ffffff', textShadow: '0 2px 14px rgba(0,0,0,0.85)' }}>
          <span style={{ color: palette.primary }}>▮ </span>
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const CURTAIN = skyline(57, { from: -20, to: 1960, minH: 60, maxH: 260, minW: 70, maxW: 150, lit: 0, gothic: 0.7 });

/** A cidade sobe e apaga a tela; o holofote com o emblema acende no centro; a nova cena abre por dentro do facho. */
const Transition: React.FC<TransitionProps> = ({ progress }) => {
  const { cover, reveal } = transitionPhases(progress);
  const { palette } = spec;
  const rise = (1 - (1 - cover) ** 3) * (H + 320);
  const spot = clamp01((progress - 0.25) / 0.2) * (1 - reveal);
  const hole = reveal ** 2 * 1400;
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <defs>
          <mask id="bat-iris">
            <rect x={-100} y={-100} width={W + 200} height={H + 200} fill="#ffffff" />
            <ellipse cx={W / 2} cy={H / 2} rx={hole * 1.25} ry={hole} fill="#000000" />
          </mask>
        </defs>
        <g mask="url(#bat-iris)">
          <g transform={`translate(0 ${(H + 300 - rise).toFixed(1)})`} fill={mixColor(palette.sky[0]!, palette.sky[1]!, 0.35)}>
            {CURTAIN.map((building, index) => (
              <path key={index} d={buildingPath(building, 20)} />
            ))}
            <rect x={-100} y={10} width={W + 200} height={H + 400} />
          </g>
          <g transform={`translate(${W / 2} ${H / 2 + 70}) scale(${(2.4 + reveal * 2).toFixed(3)})`} opacity={spot}>
            <ellipse cx={0} cy={-50} rx={64} ry={48} fill={fade(palette.primary, 0.9)} />
            <path d={BAT_GLYPH} transform="translate(0 -50) scale(1.05)" fill={palette.sky[0]} />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const theme = defineTheme(spec, {
  parts: { Far, Mid, Near, Front, actors, grain: 0.3, vignette: 0.5 },
  panel: { radius: 10, border: 2, shadow: '0 26px 60px -22px rgba(0,0,0,0.85)', decor: 'ticks' },
  bar: { kind: 'smooth', radius: 4 },
  Frame,
  Transition,
});

export const batman = theme;
