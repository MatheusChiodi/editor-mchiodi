// Peças genéricas dirigidas só pela paleta: as figuras "peão" do tema neutro (e dos temas de categoria que não têm figuras
// próprias), a moldura e a transição padrão, e os dois construtores de tema (`defineTheme`, `extendTheme`).

import { AbsoluteFill } from 'remotion';

import { theme as brand } from '../../theme';
import type { ActorKind, ThemeSpec } from '../types';
import { chromeFont } from './fonts';
import { type ActorArt, type AnalogyTheme, type BarLook, createWorld2d, type FrameProps, H, type PanelLook, type Parts2d, type SceneryProps, type TransitionProps, W } from './kit';
import { clamp01, fade, mixColor } from './math';

// --------------------------------------------------------------------------------------------- figuras "peão"

const MEMBER_TINTS = ['#0f172a', '#33407a', '#1f6f5a', '#7a4a1f', '#5a2f7a', '#2f5a7a'];

const Shadow: React.FC<{ color: string; rx?: number }> = ({ color, rx = 30 }) => <ellipse cx={0} cy={1} rx={rx} ry={4.5} fill={fade(color, 0.28)} />;

const pawn = (fill: string) => (
  <>
    <path d="M-21 -63Q-23 -68 -15 -68H15Q23 -68 21 -63L27 0H-27Z" fill={fill} />
    <circle cx={0} cy={-85} r={13.5} fill={fill} />
  </>
);

const Hero: ActorArt = ({ palette, t }) => (
  <g transform={`translate(0 ${(Math.sin(t * 1.6) * 0.5).toFixed(2)})`}>
    <Shadow color={palette.figure} />
    {pawn(palette.figure)}
    {/* o lenço coral é a marca do herói: o acento do canal, em dose pequena */}
    <path d="M-15 -70H15L17 -62H-17Z" fill={brand.color.coral} />
  </g>
);

const Helper: ActorArt = ({ palette, t }) => (
  <g transform={`translate(0 ${(Math.sin(t * 1.4 + 1) * 0.5).toFixed(2)})`}>
    <Shadow color={palette.figure} />
    {pawn(mixColor(palette.figure, palette.sky[0]!, 0.28))}
    <path d="M20 -54L34 -50" stroke={mixColor(palette.figure, palette.sky[0]!, 0.28)} strokeWidth={6} strokeLinecap="round" />
    <ellipse cx={42} cy={-52} rx={17} ry={3} fill={palette.figure} />
    <path d="M30 -54a12 11 0 0 1 24 0Z" fill={palette.panel} stroke={palette.figure} strokeWidth={1.6} />
    <circle cx={42} cy={-66.5} r={1.8} fill={palette.figure} />
  </g>
);

const Villain: ActorArt = ({ actor, palette, t }) => {
  const shake = (actor.energy ?? 0) * Math.sin(t * 60) * 1.2;
  return (
    <g transform={`translate(${shake.toFixed(2)} 0)`}>
      <Shadow color={palette.figure} rx={40} />
      <path d="M-34 0L-30 -58L-18 -72L-22 -92L-8 -80H8L22 -92L18 -72L30 -58L34 0Z" fill={palette.figure} />
      <path d="M-13 -62L-4 -58M13 -62L4 -58" stroke={palette.sky[0]} strokeWidth={3} strokeLinecap="round" />
      <path d="M-12 -44H12" stroke={fade(palette.sky[0]!, 0.6)} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 3" />
    </g>
  );
};

const Member: ActorArt = ({ actor, palette, t }) => {
  const index = actor.variant ?? 0;
  const fill = MEMBER_TINTS[index % MEMBER_TINTS.length]!;
  const badges = [
    <circle key="b" cx={0} cy={-44} r={6} />,
    <rect key="b" x={-6} y={-50} width={12} height={12} rx={2} />,
    <path key="b" d="M0 -52L7 -39H-7Z" />,
    <path key="b" d="M0 -53L7 -45L0 -37L-7 -45Z" />,
    <path key="b" d="M-6 -50H6L9 -44L6 -38H-6L-9 -44Z" />,
    <path key="b" d="M0 -53L2.4 -47H8L3.4 -43.4L5 -37.5L0 -41L-5 -37.5L-3.4 -43.4L-8 -47H-2.4Z" />,
  ];
  return (
    <g transform={`translate(0 ${(Math.sin(t * 1.5 + index) * 0.5).toFixed(2)})`}>
      <Shadow color={palette.figure} />
      {pawn(fill)}
      <g fill={fade('#ffffff', 0.92)}>{badges[index % badges.length]}</g>
    </g>
  );
};

const Emblem: ActorArt = ({ palette, t }) => (
  <g transform="translate(0 -50)" opacity={0.55}>
    <circle r={47} fill="none" stroke={palette.shade} strokeWidth={1.4} strokeDasharray="2 5" transform={`rotate(${(t * 6).toFixed(2)})`} />
    <circle r={38} fill={fade(palette.panel, 0.5)} stroke={palette.shade} strokeWidth={1.6} />
    <path d="M0 -22L5.5 -7H21L9 2.5L13.5 18L0 8.5L-13.5 18L-9 2.5L-21 -7H-5.5Z" fill={fade(palette.secondary, 0.5)} />
  </g>
);

const Node: ActorArt = ({ actor, palette }) => {
  const state = actor.state ?? 'idle';
  const done = state === 'done';
  const active = state === 'active';
  return (
    <g transform="translate(0 -50)">
      {active ? <circle r={47} fill="none" stroke={fade(brand.color.coral, 0.35)} strokeWidth={3} /> : null}
      <circle r={36} fill={done ? fade(palette.ok, 0.22) : palette.panel} stroke={active ? brand.color.coral : done ? palette.ok : palette.shade} strokeWidth={active ? 5 : 3} strokeDasharray={state === 'locked' ? '6 7' : undefined} />
      {done ? <path d="M-14 1L-4 11L15 -10" fill="none" stroke={palette.figure} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {active ? <circle r={9} fill={brand.color.coral} /> : null}
    </g>
  );
};

const Block: ActorArt = ({ actor, palette }) => {
  const width = ((actor.w ?? actor.h) / actor.h) * 100;
  const tints = [palette.panel, mixColor(palette.panel, palette.secondary, 0.18), mixColor(palette.panel, palette.glow, 0.3)];
  return (
    <g>
      <rect x={-width / 2 + 2} y={-96} width={width - 4} height={100} rx={8} fill={fade(palette.figure, 0.12)} />
      <rect x={-width / 2} y={-100} width={width} height={100} rx={8} fill={tints[(actor.variant ?? 0) % tints.length]} stroke={actor.state === 'active' ? brand.color.coral : palette.shade} strokeWidth={actor.state === 'active' ? 3 : 2} />
    </g>
  );
};

const Choice: ActorArt = ({ actor, palette }) => {
  const second = (actor.variant ?? 0) % 2 === 1;
  const tint = second ? brand.color.glowPeach : palette.secondary;
  const chosen = actor.state === 'active';
  return (
    <g>
      <Shadow color={palette.figure} rx={34} />
      <path d="M-30 0V-70A30 30 0 0 1 30 -70V0Z" fill={mixColor(palette.panel, tint, 0.3)} stroke={chosen ? brand.color.coral : palette.shade} strokeWidth={chosen ? 4 : 2.5} />
      <circle cx={second ? -16 : 16} cy={-36} r={3.4} fill={palette.figure} />
      <path d="M-30 -70A30 30 0 0 1 30 -70" fill="none" stroke={fade(tint, 0.9)} strokeWidth={5} />
    </g>
  );
};

const Aura: ActorArt = ({ actor, palette, t }) => {
  const energy = clamp01(actor.energy ?? 1);
  return (
    <g transform="translate(0 -50)">
      {[0, 1, 2].map((ring) => {
        const phase = (t * 0.6 + ring / 3) % 1;
        return <circle key={ring} r={40 + phase * 60} fill="none" stroke={palette.ok} strokeWidth={3 - phase * 2.4} opacity={(1 - phase) * 0.7 * energy} />;
      })}
      <circle r={52} fill={fade(palette.glow, 0.35 * energy)} />
    </g>
  );
};

/** Figuras do tema neutro: servem de padrão para qualquer tema que não desenhe as suas. */
export const PAWN_ACTORS: Record<ActorKind, ActorArt> = { hero: Hero, helper: Helper, villain: Villain, member: Member, emblem: Emblem, node: Node, block: Block, choice: Choice, aura: Aura };

// --------------------------------------------------------------------------------------------- moldura e transição padrão

/** Cantoneiras de HUD nos quatro cantos do quadro. */
export const Corners: React.FC<{ color: string; inset?: number; size?: number; weight?: number }> = ({ color, inset = 44, size = 84, weight = 5 }) => (
  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
    <g fill="none" stroke={color} strokeWidth={weight}>
      <path d={`M${inset} ${inset + size}V${inset}H${inset + size}`} />
      <path d={`M${W - inset - size} ${inset}H${W - inset}V${inset + size}`} />
      <path d={`M${inset} ${H - inset - size}V${H - inset}H${inset + size}`} />
      <path d={`M${W - inset - size} ${H - inset}H${W - inset}V${H - inset - size}`} />
    </g>
  </svg>
);

/** Vinheta que escurece (ou tinge) as bordas e deixa o centro, onde está o rosto, intacto. */
export function edgeTint(color: string, strength: number): string {
  return `radial-gradient(ellipse 78% 82% at 50% 46%, ${fade(color, 0)} 52%, ${fade(color, strength * 0.55)} 78%, ${fade(color, strength)} 100%)`;
}

export function genericFrame(spec: ThemeSpec): React.FC<FrameProps> {
  const font = chromeFont(spec.chromeFont);
  const Frame: React.FC<FrameProps> = ({ intensity, label }) => (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: edgeTint(spec.dark ? spec.palette.sky[0]! : spec.palette.shade, 0.7 * intensity) }} />
      <Corners color={fade(spec.palette.primary, 0.85)} />
      {label ? (
        <div style={{ position: 'absolute', left: 78, top: 70, display: 'flex', alignItems: 'center', gap: 14, fontFamily: font.family, fontWeight: font.weight, fontSize: Math.round(30 * font.scale), letterSpacing: font.spacing, textTransform: 'uppercase', color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>
          <span style={{ width: 14, height: 14, background: spec.palette.primary }} />
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
  return Frame;
}

/** Fases da transição: 0→1 enquanto cobre (até 45%) e 0→1 enquanto descobre (a partir de 55%). */
export function transitionPhases(progress: number): { cover: number; reveal: number } {
  return { cover: clamp01(progress / 0.45), reveal: clamp01((progress - 0.55) / 0.45) };
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t ** 3;

export function genericTransition(spec: ThemeSpec): React.FC<TransitionProps> {
  const Transition: React.FC<TransitionProps> = ({ progress }) => {
    const { cover, reveal } = transitionPhases(progress);
    // cortina diagonal: entra pela esquerda e sai pela direita, com um filete na cor do universo
    const x = -W * 1.4 + easeOut(cover) * W * 1.4 + easeIn(reveal) * W * 1.5;
    return (
      <AbsoluteFill>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
          <path d={`M${x - 40} 0H${x + W * 1.4 + 40}L${x + W * 1.4 - 220} ${H}H${x - 260}Z`} fill={spec.palette.primary} />
          <path d={`M${x} 0H${x + W * 1.4}L${x + W * 1.4 - 220} ${H}H${x - 220}Z`} fill={spec.dark ? spec.palette.sky[0] : spec.palette.figure} />
        </svg>
      </AbsoluteFill>
    );
  };
  return Transition;
}

// --------------------------------------------------------------------------------------------- construtores

/** Tema 2D com as peças guardadas, para um tema mínimo poder herdar delas. */
export interface Theme2d extends AnalogyTheme {
  parts: Parts2d;
}

export interface ThemeOptions {
  parts: Parts2d;
  panel: PanelLook;
  bar?: BarLook;
  iconStroke?: number;
  Frame?: React.FC<FrameProps>;
  Transition?: React.FC<TransitionProps>;
}

export function defineTheme(spec: ThemeSpec, options: ThemeOptions): Theme2d {
  return {
    spec,
    chrome: chromeFont(spec.chromeFont),
    panel: options.panel,
    bar: options.bar ?? { kind: 'smooth', radius: 999 },
    iconStroke: options.iconStroke ?? 1.75,
    World: createWorld2d(spec, options.parts),
    Frame: options.Frame ?? genericFrame(spec),
    Transition: options.Transition ?? genericTransition(spec),
    parts: options.parts,
  };
}

export interface ThemeExtension {
  /** peça de cenário própria, desenhada sobre o plano médio do tema-base */
  Scenery?: React.FC<SceneryProps>;
  /** papéis redesenhados (o emblema do universo, o adereço da escolha…): o resto vem do tema-base */
  actors?: Partial<Record<ActorKind, ActorArt>>;
  panel?: PanelLook;
  Frame?: React.FC<FrameProps>;
  Transition?: React.FC<TransitionProps>;
}

/**
 * Tema MÍNIMO: a ficha (paleta própria) + 2–3 peças. Cenário, figuras, cartões, moldura e transição vêm do tema-base
 * (o da categoria), já recoloridos pela paleta nova.
 */
export function extendTheme(base: Theme2d, spec: ThemeSpec, extension: ThemeExtension = {}): Theme2d {
  const BaseMid = base.parts.Mid;
  const { Scenery } = extension;
  const Mid: React.FC<SceneryProps> | undefined = Scenery
    ? (props) => (
        <>
          {BaseMid ? <BaseMid {...props} /> : null}
          <Scenery {...props} />
        </>
      )
    : BaseMid;
  const parts: Parts2d = { ...base.parts, Mid, actors: { ...base.parts.actors, ...extension.actors } };
  return {
    spec,
    chrome: chromeFont(spec.chromeFont),
    panel: extension.panel ?? base.panel,
    bar: base.bar,
    iconStroke: base.iconStroke,
    World: createWorld2d(spec, parts),
    Frame: extension.Frame ?? genericFrame(spec),
    Transition: extension.Transition ?? genericTransition(spec),
    parts,
  };
}
