import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { theme } from '../theme';
import type { Vec2 } from './blur';
import { withAlpha } from './color';
import { boxShadowCss, castShadow, dropShadowCss, KEY_LIGHT_ANGLE, sweepGradient, type SweepOptions, vignetteGradient, type VignetteOptions } from './light-math';
import { wiggle } from './noise';

const smoother = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

export interface LightSweepProps extends Omit<SweepOptions, 'progress'> {
  /** frame em que a faixa começa a entrar */
  at?: number;
  /** frames para atravessar o elemento (14–24) */
  duration?: number;
  /** progresso direto 0→1 (ignora `at`/`duration`) */
  progress?: number;
  /** raio da caixa: a faixa é recortada junto */
  radius?: number | string;
  /** `screen` clareia tinta e cor (padrão); `soft-light` é mais discreto; `overlay` satura */
  blend?: React.CSSProperties['mixBlendMode'];
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Varredura de luz sobre qualquer elemento retangular (cartão, janela, pílula, foto). Dispare no IMPACTO
 * (a palavra-chave, o pouso do cartão), nunca em laço.
 *
 * @example
 * <LightSweep at={landFrame} duration={18} radius={24}><Card /></LightSweep>
 */
export const LightSweep: React.FC<LightSweepProps> = ({ at = 0, duration = 18, progress, radius = 0, blend = 'screen', style, children, ...sweep }) => {
  const frame = useCurrentFrame();
  const value = progress ?? smoother(Math.min(1, Math.max(0, (frame - at) / duration)));
  const visible = value > 0 && value < 1;
  return (
    <div style={{ position: 'relative', isolation: 'isolate', ...style }}>
      {children}
      {visible ? (
        <div style={{ position: 'absolute', inset: 0, borderRadius: radius, background: sweepGradient({ ...sweep, progress: value }), mixBlendMode: blend, pointerEvents: 'none' }} />
      ) : null}
    </div>
  );
};

export interface ShadowedProps {
  /** altura sobre a superfície em px: anime junto com o movimento (alto no voo, baixo no pouso) */
  elevation: number;
  /** velocidade em px/frame: a sombra alonga e atrasa */
  velocity?: Vec2;
  /** `box` usa `box-shadow` (barato, segue `radius`); `alpha` usa `drop-shadow` (segue recorte e transparência) */
  shape?: 'box' | 'alpha';
  radius?: number | string;
  lightAngle?: number;
  strength?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Sombra projetada dinâmica. A sombra é o que diz a que altura o objeto está: sem ela mudar, o objeto não voa.
 *
 * @example
 * <Shadowed elevation={interpolate(landing, [0, 1], [70, 10])} velocity={{ x: 0, y: vy }} radius={24}><Card /></Shadowed>
 */
export const Shadowed: React.FC<ShadowedProps> = ({ elevation, velocity, shape = 'box', radius = theme.radius.card, lightAngle = KEY_LIGHT_ANGLE, strength = 1, style, children }) => {
  const layers = castShadow({ elevation, velocity, lightAngle, strength });
  return <div style={shape === 'box' ? { borderRadius: radius, boxShadow: boxShadowCss(layers), ...style } : { filter: dropShadowCss(layers), ...style }}>{children}</div>;
};

export interface HalationProps {
  /** raio do halo em px */
  radius?: number;
  /** 0–1 */
  strength?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Halation: uma cópia desfocada do próprio elemento por baixo, como o brilho que o filme dá ao que é saturado.
 * Use no ÚNICO acento da tela (a palavra coral, o selo). Custa um blur do tamanho do elemento: não use em tela cheia.
 * Para texto simples, `glowShadow()` em `text-shadow` dá quase o mesmo sem filtro.
 */
export const Halation: React.FC<HalationProps> = ({ radius = 22, strength = 0.55, style, children }) => (
  <div style={{ position: 'relative', display: 'inline-block', ...style }}>
    <div aria-hidden style={{ position: 'absolute', inset: 0, filter: `blur(${radius}px) saturate(1.5)`, opacity: strength, pointerEvents: 'none' }}>
      {children}
    </div>
    <div style={{ position: 'relative' }}>{children}</div>
  </div>
);

/** Vinheta viva em tela cheia: cantos escurecem, o centro segue o assunto e a força respira. */
export const Vignette: React.FC<VignetteOptions & { style?: React.CSSProperties }> = ({ style, ...options }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <AbsoluteFill style={{ background: vignetteGradient(frame, fps, options), pointerEvents: 'none', ...style }} />;
};

export interface KeyLightProps {
  /** de onde a luz vem (graus; padrão alto à esquerda) */
  angle?: number;
  /** 0–1: força da luz no lado iluminado */
  intensity?: number;
  /** 0–1: força da sombra no lado oposto */
  falloff?: number;
  /** cor da luz (padrão: branco quente) */
  color?: string;
  /** a luz deriva devagar (px) para o quadro nunca ficar parado */
  drift?: number;
  seed?: number;
}

/**
 * Luz-chave da cena: clareia o lado de onde a luz vem e deixa cair o lado oposto. Vai por cima do fundo e por
 * baixo do conteúdo. Dois gradientes, sem filtro: é o que tira o papel do "chapado".
 */
export const KeyLight: React.FC<KeyLightProps> = ({ angle = KEY_LIGHT_ANGLE, intensity = 0.55, falloff = 0.16, color = '#fff6e8', drift = 40, seed = 5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const radians = (angle * Math.PI) / 180;
  const dx = wiggle(frame, fps, { frequency: 0.12, amplitude: drift, seed });
  const dy = wiggle(frame, fps, { frequency: 0.1, amplitude: drift * 0.6, seed: seed + 3 });
  // a luz nasce fora do quadro, na direção de onde vem
  const lightX = 50 + Math.cos(radians) * 62;
  const lightY = 50 + Math.sin(radians) * 62;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 95% 95% at calc(${lightX.toFixed(1)}% + ${dx.toFixed(1)}px) calc(${lightY.toFixed(1)}% + ${dy.toFixed(1)}px), ${withAlpha(color, intensity)} 0%, ${withAlpha(color, intensity * 0.35)} 38%, ${withAlpha(color, 0)} 72%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 110% 110% at calc(${(100 - lightX).toFixed(1)}% - ${dx.toFixed(1)}px) calc(${(100 - lightY).toFixed(1)}% - ${dy.toFixed(1)}px), ${withAlpha(theme.color.slate900, falloff)} 0%, ${withAlpha(theme.color.slate900, falloff * 0.4)} 40%, ${withAlpha(theme.color.slate900, 0)} 75%)`,
          mixBlendMode: 'multiply',
        }}
      />
    </AbsoluteFill>
  );
};
