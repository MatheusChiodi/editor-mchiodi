// Kit comum dos temas de universo: o contrato de um tema, o mundo 2D em planos (câmera do kit cine),
// e as peças de interface que vestem o conteúdo (cartão, rótulo, barra, título) com os tokens do tema.
//
// Divisão de papéis: o UNIVERSO fica no cenário, nas figuras e no acabamento dos cartões;
// o CONTEÚDO (título, rótulos dos itens) continua em Playfair/Inter com o acento coral do canal.

import { useId } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { Camera, FilmGrain, Layer, Vignette } from '../../cine';
import { Words } from '../../scene-kit';
import { motion, theme as brand } from '../../theme';
import type { Actor, ActorKind, ThemePalette, ThemeSpec } from '../types';
import { type ChromeFont, chromeFont } from './fonts';
import { clamp01, fade } from './math';

export const W = 1920;
export const H = 1080;

// --------------------------------------------------------------------------------------------- contrato

export interface WorldProps {
  /** figuras e adereços posicionados pelo layout do modelo */
  actors: Actor[];
  /** y (px) do chão onde os pés pisam */
  ground: number;
  /** 0–1: quanto de atmosfera entra (chuva, partículas, varredura). No tom sóbrio o diretor passa ~0.4 */
  intensity?: number;
  durationInFrames: number;
  /** interface do modelo: fica no plano do assunto, alinhada com as figuras */
  children?: React.ReactNode;
}

export interface FrameProps {
  intensity: number;
  /** rótulo curto no canto (o nome do universo ou uma legenda de HUD) */
  label?: string;
  durationInFrames: number;
}

export interface TransitionProps {
  /** 0→1: cobre a tela até ~0.45, fica coberta, e descobre depois de ~0.55 */
  progress: number;
  /** texto opcional que a transição carrega (o letreiro, o rótulo do universo) */
  text?: string;
}

export type PanelDecor = 'card' | 'ticks' | 'bevel' | 'pixel' | 'scan' | 'ink';

export interface PanelLook {
  radius: number;
  border: number;
  shadow: string;
  decor: PanelDecor;
}

export interface BarLook {
  /** `smooth`: barra contínua; `segments`: gomos; `pixel`: gomos quadrados com moldura dura */
  kind: 'smooth' | 'segments' | 'pixel';
  radius: number;
}

/** Um tema pronto para os modelos: ficha + fonte de apoio + acabamento + os três desenhos (mundo, moldura, transição). */
export interface AnalogyTheme {
  spec: ThemeSpec;
  chrome: ChromeFont;
  panel: PanelLook;
  bar: BarLook;
  /** espessura do traço dos ícones de conteúdo dentro dos cartões (temas em pixel pedem traço mais grosso) */
  iconStroke: number;
  World: React.FC<WorldProps>;
  Frame: React.FC<FrameProps>;
  Transition: React.FC<TransitionProps>;
}

// --------------------------------------------------------------------------------------------- mundo 2D

export interface SceneryProps {
  palette: ThemePalette;
  ground: number;
  /** segundos desde o início da cena */
  t: number;
  frame: number;
  intensity: number;
}

export interface ArtProps {
  actor: Actor;
  palette: ThemePalette;
  t: number;
  /** id único desta figura, para gradientes e filtros SVG */
  uid: string;
}

/** Desenho de um papel num espaço de 100 unidades de altura: pés em (0, 0), cabeça em y = -100. */
export type ActorArt = React.FC<ArtProps>;

export interface Parts2d {
  /** plano distante (céu, lua, planetas): quase não se move com a câmera */
  Far?: React.FC<SceneryProps>;
  /** plano médio (cidade, colinas) */
  Mid?: React.FC<SceneryProps>;
  /** plano do assunto, atrás das figuras: o chão onde elas pisam */
  Near?: React.FC<SceneryProps>;
  /** primeiro plano, na frente de tudo (chuva, névoa, partículas) */
  Front?: React.FC<SceneryProps>;
  /** luz em espaço de tela, por cima da cena (não segue a câmera) */
  Light?: React.FC<SceneryProps>;
  actors: Record<ActorKind, ActorArt>;
  /** grão de filme por cima (0 desliga: temas em pixel ficam limpos) */
  grain?: number;
  vignette?: number;
}

const Plane: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  // overflow visível: o cenário é desenhado com sobra além do quadro, para o movimento de câmera não mostrar a borda
  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
    {children}
  </svg>
);

const DIM: Partial<Record<NonNullable<Actor['state']>, number>> = { dim: 0.4, locked: 0.5 };

/** Ordem de desenho: emblema e aura por trás, depois quem está mais ao fundo (y menor). */
export function drawOrder(actors: Actor[]): Actor[] {
  const layer = (actor: Actor) => (actor.kind === 'emblem' ? 0 : actor.kind === 'aura' ? 1 : 2);
  return [...actors].sort((a, b) => layer(a) - layer(b) || a.y - b.y);
}

const ActorLayer: React.FC<{ actors: Actor[]; parts: Parts2d; palette: ThemePalette; t: number; uid: string }> = ({ actors, parts, palette, t, uid }) => (
  <>
    {drawOrder(actors).map((actor) => {
      const progress = clamp01(actor.progress ?? 1);
      if (progress <= 0) return null;
      const Art = parts.actors[actor.kind];
      const scale = actor.h / 100;
      return (
        <g
          key={actor.id}
          transform={`translate(${actor.x.toFixed(2)} ${(actor.y + (1 - progress) * 26).toFixed(2)}) scale(${(actor.flip ? -scale : scale).toFixed(4)} ${scale.toFixed(4)})`}
          opacity={progress * (DIM[actor.state ?? 'idle'] ?? 1)}
        >
          <Art actor={actor} palette={palette} t={t} uid={`${uid}${actor.id.replace(/[^a-zA-Z0-9]/g, '')}`} />
        </g>
      );
    })}
  </>
);

/** Mundo 2D de um tema: planos em profundidade na câmera do kit cine, figuras no plano do assunto e a interface do modelo junto delas. */
export function createWorld2d(spec: ThemeSpec, parts: Parts2d): React.FC<WorldProps> {
  const World: React.FC<WorldProps> = ({ actors, ground, intensity = 1, durationInFrames, children }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const scenery: SceneryProps = { palette: spec.palette, ground, t: frame / fps, frame, intensity };
    const sky = spec.palette.sky;
    const { Far, Mid, Near, Front, Light } = parts;
    return (
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${sky.join(', ')})`, overflow: 'hidden' }}>
        <Camera
          keyframes={[
            // chega empurrando e nunca para: a câmera segue derivando até o fim da cena
            { frame: 0, z: -150, x: -34, y: 10 },
            { frame: Math.round(fps * 1.4), z: 0, x: 0, y: 0, ease: 'out' },
            { frame: Math.max(Math.round(fps * 1.5), durationInFrames), z: 34 * intensity, x: 26 * intensity, y: -4, ease: 'linear' },
          ]}
        >
          {Far ? (
            <Layer depth={2400} dof={false}>
              <Plane>
                <Far {...scenery} />
              </Plane>
            </Layer>
          ) : null}
          {Mid ? (
            <Layer depth={900} dof={false}>
              <Plane>
                <Mid {...scenery} />
              </Plane>
            </Layer>
          ) : null}
          <Layer depth={0} dof={false}>
            <Plane>
              {/* o emblema (holofote, estandarte) fica no céu, atrás do chão; o resto pisa nele */}
              <ActorLayer actors={actors.filter((actor) => actor.kind === 'emblem')} parts={parts} palette={spec.palette} t={scenery.t} uid={uid} />
              {Near ? <Near {...scenery} /> : null}
              <ActorLayer actors={actors.filter((actor) => actor.kind !== 'emblem')} parts={parts} palette={spec.palette} t={scenery.t} uid={uid} />
            </Plane>
            {children}
          </Layer>
          {Front ? (
            <Layer depth={-380} dof={false}>
              <Plane>
                <Front {...scenery} />
              </Plane>
            </Layer>
          ) : null}
        </Camera>
        {Light ? (
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <Plane>
              <Light {...scenery} />
            </Plane>
          </AbsoluteFill>
        ) : null}
        {parts.vignette ? <Vignette strength={parts.vignette} tint={spec.dark ? '#000000' : spec.palette.shade} breathe={0.08} /> : null}
        {parts.grain ? <FilmGrain opacity={parts.grain} /> : null}
      </AbsoluteFill>
    );
  };
  return World;
}

// --------------------------------------------------------------------------------------------- interface vestida pelo tema

export type PanelTone = 'default' | 'primary' | 'ok' | 'danger' | 'muted';

export interface ThemePanelProps {
  theme: AnalogyTheme;
  tone?: PanelTone;
  /** 0→1: entrada */
  progress?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function toneColor(theme: AnalogyTheme, tone: PanelTone): string {
  const { palette } = theme.spec;
  if (tone === 'primary') return palette.primary;
  if (tone === 'ok') return palette.ok;
  if (tone === 'danger') return palette.danger;
  return palette.panelBorder;
}

const PIXEL_NOTCH = 'polygon(0 8px, 8px 8px, 8px 0, calc(100% - 8px) 0, calc(100% - 8px) 8px, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 8px calc(100% - 8px), 0 calc(100% - 8px))';

/** Cartão de conteúdo com o acabamento do tema. O texto dentro dele é do canal (Inter), na cor `panelText`. */
export const ThemePanel: React.FC<ThemePanelProps> = ({ theme, tone = 'default', progress = 1, style, children }) => {
  const { palette } = theme.spec;
  const look = theme.panel;
  const edge = toneColor(theme, tone);
  const base: React.CSSProperties = {
    position: 'relative',
    boxSizing: 'border-box',
    background: palette.panel,
    color: palette.panelText,
    borderRadius: look.radius,
    border: `${look.border}px solid ${edge}`,
    boxShadow: look.shadow,
    fontFamily: brand.font.body,
    opacity: tone === 'muted' ? 0.55 * progress : progress,
    translate: `0px ${((1 - progress) * 26).toFixed(2)}px`,
  };
  let decor: React.ReactNode = null;
  if (look.decor === 'ticks') {
    // cantoneiras: a moldura de "ficha de caso"
    const tick = (corner: React.CSSProperties) => <span style={{ position: 'absolute', width: 16, height: 16, borderColor: fade(palette.glow, 0.85), borderStyle: 'solid', borderWidth: 0, ...corner }} />;
    decor = (
      <>
        {tick({ top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 })}
        {tick({ top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 })}
        {tick({ bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 })}
        {tick({ bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 })}
      </>
    );
  } else if (look.decor === 'bevel') {
    base.boxShadow = `inset 5px 5px 0 rgba(255,255,255,0.75), inset -5px -5px 0 rgba(0,0,0,0.32), ${look.shadow}`;
  } else if (look.decor === 'pixel') {
    base.clipPath = PIXEL_NOTCH;
    base.boxShadow = undefined;
    base.filter = `drop-shadow(8px 8px 0 ${fade('#000000', 0.35)})`;
  } else if (look.decor === 'scan') {
    base.backgroundImage = `repeating-linear-gradient(180deg, ${fade(edge, 0.09)} 0px, ${fade(edge, 0.09)} 2px, transparent 2px, transparent 6px)`;
    base.boxShadow = `0 0 26px ${fade(edge, 0.3)}, inset 0 0 22px ${fade(edge, 0.14)}`;
  } else if (look.decor === 'ink') {
    base.outline = `2px solid ${fade(edge, 0.55)}`;
    base.outlineOffset = -9;
  }
  // `clip-path` recortaria o filtro de sombra: no acabamento em pixel a sombra vai num invólucro
  if (look.decor === 'pixel') {
    const { filter, opacity, translate, ...face } = base;
    const { width, height, flex, flexShrink, flexGrow, alignSelf, position, left, top, right, bottom, ...inner } = style ?? {};
    return (
      <div style={{ position: position ?? 'relative', left, top, right, bottom, width, height, flex, flexShrink, flexGrow, alignSelf, filter, opacity, translate }}>
        <div style={{ ...face, width: '100%', height: '100%', ...inner }}>{children}</div>
      </div>
    );
  }
  return (
    <div style={{ ...base, ...style }}>
      {decor}
      {children}
    </div>
  );
};

export interface ChromeProps {
  theme: AnalogyTheme;
  /** corpo em px na escala da Inter; cada fonte de apoio ajusta o seu */
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** Texto de APOIO na fonte do universo: eyebrow, rótulo de HUD, "NV 3". Sempre curto e em caixa alta. */
export const Chrome: React.FC<ChromeProps> = ({ theme, size = 34, color, style, children }) => (
  <span
    style={{
      display: 'inline-block',
      fontFamily: theme.chrome.family,
      fontWeight: theme.chrome.weight,
      fontSize: Math.round(size * theme.chrome.scale),
      letterSpacing: theme.chrome.spacing,
      lineHeight: 1.2,
      textTransform: 'uppercase',
      color: color ?? theme.spec.palette.text,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </span>
);

/** Sombra que descola o texto do cenário sem virar contorno duro. */
export function titleShadow(spec: ThemeSpec): string {
  const base = spec.dark ? '#000000' : spec.palette.sky[0]!;
  return `0 2px 0 ${fade(base, spec.dark ? 0.55 : 0.7)}, 0 6px 26px ${fade(base, spec.dark ? 0.75 : 0.9)}, 0 0 60px ${fade(base, spec.dark ? 0.5 : 0.8)}`;
}

export interface ThemeTitleProps {
  theme: AnalogyTheme;
  title: string;
  /** trecho do título em coral: o acento do canal, o único da tela */
  accent?: string;
  eyebrow?: string;
  atSec?: number;
  fontSize?: number;
  align?: 'left' | 'center';
  maxWidth?: number;
  style?: React.CSSProperties;
}

/** Título de conteúdo sobre o cenário: Playfair do canal, palavra a palavra, com o trecho de acento em coral; o eyebrow vai na fonte do universo. */
export const ThemeTitle: React.FC<ThemeTitleProps> = ({ theme, title, accent, eyebrow, atSec = 0.15, fontSize = 80, align = 'left', maxWidth = 1100, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { spec } = theme;
  const eyebrowIn = interpolate(frame, [atSec * fps, (atSec + motion.base) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: motion.enter });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align, gap: fontSize * 0.2, maxWidth, ...style }}>
      {eyebrow ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: eyebrowIn, translate: `0px ${((1 - eyebrowIn) * 14).toFixed(2)}px` }}>
          <span style={{ width: 44, height: 4, background: spec.palette.primary, boxShadow: spec.dark ? `0 0 14px ${fade(spec.palette.primary, 0.7)}` : undefined }} />
          <Chrome theme={theme} size={30} color={spec.dark ? spec.palette.primary : spec.palette.text} style={{ textShadow: titleShadow(spec) }}>
            {eyebrow}
          </Chrome>
        </div>
      ) : null}
      <div style={{ fontFamily: brand.font.display, fontWeight: 600, fontSize, lineHeight: 1.1, letterSpacing: '-0.01em', color: spec.palette.title, textShadow: titleShadow(spec) }}>
        <Words text={title} accent={accent} delay={atSec + (eyebrow ? 0.15 : 0)} />
      </div>
    </div>
  );
};

export interface ThemeBarProps {
  theme: AnalogyTheme;
  /** 0–1 */
  value: number;
  width: number;
  height?: number;
  color?: string;
  segments?: number;
  style?: React.CSSProperties;
}

/** Barra de vida/XP no acabamento do tema. */
export const ThemeBar: React.FC<ThemeBarProps> = ({ theme, value, width, height = 30, color, segments = 10, style }) => {
  const { palette } = theme.spec;
  const fill = color ?? palette.primary;
  const amount = clamp01(value);
  const look = theme.bar;
  const frameStyle: React.CSSProperties = {
    position: 'relative',
    boxSizing: 'border-box',
    width,
    height,
    borderRadius: look.radius,
    border: `${look.kind === 'pixel' ? 5 : 2}px solid ${look.kind === 'pixel' ? palette.panelBorder : fade(palette.panelText, 0.55)}`,
    background: fade(theme.spec.dark ? '#000000' : palette.figure, theme.spec.dark ? 0.55 : 0.16),
    overflow: 'hidden',
    ...style,
  };
  if (look.kind === 'smooth') {
    return (
      <div style={frameStyle}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(amount * 100).toFixed(2)}%`, background: `linear-gradient(180deg, ${fade(fill, 1)}, ${fade(fill, 0.78)})`, boxShadow: `0 0 18px ${fade(fill, 0.6)}` }} />
      </div>
    );
  }
  const lit = amount * segments;
  return (
    <div style={{ ...frameStyle, display: 'flex', gap: look.kind === 'pixel' ? 4 : 3, padding: look.kind === 'pixel' ? 4 : 3 }}>
      {Array.from({ length: segments }, (_, index) => (
        <div key={index} style={{ flex: 1, borderRadius: Math.max(0, look.radius - 3), background: fill, opacity: clamp01(lit - index) * 0.95 + 0.05 * Number(lit > index) }} />
      ))}
    </div>
  );
};

/** Contorno de um texto branco sobre céu claro (temas em pixel): quatro sombras duras na cor de tinta. */
export function hardOutline(color: string, size = 3): string {
  return [`${size}px 0 0 ${color}`, `-${size}px 0 0 ${color}`, `0 ${size}px 0 ${color}`, `0 -${size}px 0 ${color}`, `${size}px ${size + 2}px 0 ${fade(color, 0.6)}`].join(', ');
}
