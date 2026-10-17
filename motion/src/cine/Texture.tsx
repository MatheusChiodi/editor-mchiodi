import { useId, useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { theme } from '../theme';
import type { Vec2 } from './blur';
import { boxShadowCss, castShadow, dropShadowCss, KEY_LIGHT_ANGLE, rimLight } from './light-math';
import { boilSeed, filmGrainTile, grainOffset, paperEdges, paperGrainTile, tornRectPath } from './texture-math';

export interface FilmGrainProps {
  /** 0–1 (0,35–0,6 sobre papel claro; 0,25–0,4 sobre footage) */
  opacity?: number;
  seed?: number;
  /** lado do ladrilho em px: maior = grão mais grosso depois de ampliado */
  size?: number;
  /** frames em que o mesmo grão fica na tela (1 = muda todo frame) */
  hold?: number;
  blend?: React.CSSProperties['mixBlendMode'];
  frequency?: number;
}

/**
 * Grão de filme em tela cheia, por cima de tudo. Um ladrilho de 256 px rasterizado uma vez e deslocado a cada
 * frame: custo desprezível. É a última camada da cena, junto com a `<Vignette>`.
 */
export const FilmGrain: React.FC<FilmGrainProps> = ({ opacity = 0.45, seed = 1, size = 256, hold = 1, blend = 'overlay', frequency = 0.85 }) => {
  const frame = useCurrentFrame();
  const tile = useMemo(() => filmGrainTile({ seed, size, frequency }), [seed, size, frequency]);
  const offset = grainOffset(frame, { seed, size, hold });
  return <AbsoluteFill style={{ backgroundImage: tile, backgroundSize: `${size}px ${size}px`, backgroundPosition: `${offset.x}px ${offset.y}px`, mixBlendMode: blend, opacity, pointerEvents: 'none' }} />;
};

export interface PaperGrainProps {
  opacity?: number;
  seed?: number;
  /** 0–1: fibras alongadas (0 = papel liso) */
  fibers?: number;
  size?: number;
  radius?: number | string;
}

/** Dente e fibra do papel, estáticos, em `multiply`. Preenche o pai posicionado (fundo de cena, face de cartão). */
export const PaperGrain: React.FC<PaperGrainProps> = ({ opacity = 0.5, seed = 7, fibers = 0.3, size = 320, radius }) => {
  const tile = useMemo(() => paperGrainTile({ seed, size, fibers }), [seed, size, fibers]);
  return <div style={{ position: 'absolute', inset: 0, borderRadius: radius, backgroundImage: tile, backgroundSize: `${size}px ${size}px`, mixBlendMode: 'multiply', opacity, pointerEvents: 'none' }} />;
};

export interface PaperSheetProps {
  width: number;
  height: number;
  /** espessura em px: 2 = folha, 5 = cartão, 9 = papelão */
  thickness?: number;
  /** lados rasgados; `true` rasga os quatro. Sem rasgo, a folha tem cantos de raio `radius` */
  torn?: boolean | { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };
  /** amplitude do rasgo em px */
  amplitude?: number;
  radius?: number;
  seed?: number;
  /** cor da face (tokens do tema) */
  color?: string;
  /** altura sobre a superfície: dirige a sombra */
  elevation?: number;
  velocity?: Vec2;
  /** 0–1: grão do papel na face */
  grain?: number;
  /** 0–1: queda de luz na face (clara do lado da luz, mais escura no oposto). 0 = face chapada */
  shading?: number;
  lightAngle?: number;
  style?: React.CSSProperties;
  /** estilo da face (padding, layout do conteúdo) */
  faceStyle?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Material de papel: face com grão, espessura (cópias empilhadas atrás), filete de luz na aresta iluminada e
 * sombra projetada que reage à altura e à velocidade. Com `torn`, as bordas são rasgadas e aparece o miolo
 * branco do papel. É o cartão-base do canal: use no lugar de `div` branca com `box-shadow`.
 *
 * @example
 * <PaperSheet width={720} height={420} thickness={5} elevation={14} torn={{ bottom: true }} seed={3}>…</PaperSheet>
 */
export const PaperSheet: React.FC<PaperSheetProps> = ({
  width,
  height,
  thickness = 4,
  torn = false,
  amplitude = 9,
  radius = theme.radius.card,
  seed = 1,
  color = theme.color.paper,
  elevation = 12,
  velocity,
  grain = 0.45,
  shading = 0.5,
  lightAngle = KEY_LIGHT_ANGLE,
  style,
  faceStyle,
  children,
}) => {
  const edges = torn === true ? { top: true, right: true, bottom: true, left: true } : torn || null;
  const shadow = castShadow({ elevation, velocity, lightAngle });
  const facePath = useMemo(() => (edges ? `path('${tornRectPath({ width, height, edges, amplitude, seed })}')` : undefined), [edges, width, height, amplitude, seed]);
  // o miolo do papel rasga num lugar um pouco diferente da face: a diferença é a fibra branca na borda
  const corePath = useMemo(() => (edges ? `path('${tornRectPath({ width, height, edges, amplitude: amplitude * 0.62, seed: seed + 50, roughness: 0.7 })}')` : undefined), [edges, width, height, amplitude, seed]);
  const layers = paperEdges(thickness, lightAngle);
  const shape: React.CSSProperties = edges ? {} : { borderRadius: radius };
  return (
    <div style={{ position: 'relative', width, height, ...(edges ? { filter: dropShadowCss(shadow) } : { borderRadius: radius, boxShadow: boxShadowCss(shadow) }), ...style }}>
      {[...layers].reverse().map((edge, index) => (
        <div key={index} style={{ position: 'absolute', inset: 0, translate: `${edge.x}px ${edge.y}px`, background: edge.color, clipPath: facePath, ...shape }} />
      ))}
      {edges ? <div style={{ position: 'absolute', inset: 0, background: theme.color.white, clipPath: corePath }} /> : null}
      <div style={{ position: 'absolute', inset: 0, background: color, clipPath: facePath, overflow: 'hidden', boxShadow: edges ? undefined : rimLight({ lightAngle }), ...shape, ...faceStyle }}>
        {grain > 0 ? <PaperGrain opacity={grain} seed={seed + 7} /> : null}
        {shading > 0 ? (
          // o CSS mede o ângulo do gradiente a partir do topo, em sentido horário: +270 converte da direção da luz
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${lightAngle + 270}deg, rgba(255,255,255,${(shading * 0.55).toFixed(3)}) 0%, rgba(255,255,255,0) 42%, rgba(15,23,42,${(shading * 0.11).toFixed(3)}) 100%)`, pointerEvents: 'none' }} />
        ) : null}
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>{children}</div>
      </div>
    </div>
  );
};

export interface BoilProps {
  /** deslocamento máximo em px (1–2,5: acima disso vira defeito) */
  amplitude?: number;
  /** trocas por segundo (6–12) */
  rate?: number;
  seed?: number;
  /** escala do ruído: menor = ondulação larga; maior = tremor fino */
  frequency?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * "Boil": o traço desenhado à mão ferve de leve, em passos (não a 30 fps). Envolva SÓ traços, setas, sublinhados
 * e rabiscos; nunca texto de leitura nem cartões. É um filtro de deslocamento: mantenha o elemento pequeno.
 *
 * @example
 * <Boil amplitude={1.6} rate={8}><svg>…sublinhado…</svg></Boil>
 */
export const Boil: React.FC<BoilProps> = ({ amplitude = 1.6, rate = 8, seed = 1, frequency = 0.035, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = `cine-boil-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div style={{ filter: `url(#${id})`, ...style }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id={id} x="-10%" y="-40%" width="120%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={2} seed={boilSeed(frame, fps, { rate, seed })} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={amplitude * 2} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {children}
    </div>
  );
};
