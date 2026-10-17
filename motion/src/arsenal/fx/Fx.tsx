import { AbsoluteFill, interpolate, useVideoConfig } from 'remotion';

import { type BaseProps, usePresence } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { withAlpha } from '../../components/SectionTitle';
import { motion, theme } from '../../theme';

export interface FxProps {
  variant: string;
  /** 0–1 */
  intensity?: number;
  /** centro do holofote/da área destacada/da vinheta, 0–1 */
  focus?: { x: number; y: number };
  /** tamanho da área destacada em `dim-rect`, em fração do quadro */
  size?: { w: number; h: number };
  /** cor das barras em `side-bars` */
  tone?: 'ink' | 'paper';
}

interface Point {
  x: number;
  y: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const lerp = (from: number, to: number, k: number) => from + (to - from) * clamp01(k);

/** Altura de cada barra do letterbox: de 2:1 (intensidade 0) a 2.39:1 (intensidade 1). */
export function letterboxBar(width: number, height: number, intensity: number): number {
  return Math.max(0, Math.round((height - width / lerp(2, 2.39, intensity)) / 2));
}

/** Largura de cada barra lateral: de 16:10 (intensidade 0) a 4:3 (intensidade 1). */
export function sideBar(width: number, height: number, intensity: number): number {
  return Math.max(0, Math.round((width - height * lerp(1.6, 4 / 3, intensity)) / 2));
}

/** Holofote: quanto mais intenso, menor o círculo claro e mais escuro o entorno. */
export function spotlight(height: number, intensity: number): { radius: number; feather: number; dim: number } {
  const radius = Math.round(height * lerp(0.46, 0.26, intensity));
  return { radius, feather: Math.round(radius * 0.45), dim: lerp(0.4, 0.82, intensity) };
}

/** Retângulo destacado em pixels, centrado no foco e sempre dentro da margem do quadro. */
export function dimRect(width: number, height: number, focus: Point, size: { w: number; h: number }, margin = 24) {
  const w = Math.round(Math.min(width - margin * 2, width * clamp01(size.w)));
  const h = Math.round(Math.min(height - margin * 2, height * clamp01(size.h)));
  const x = Math.round(Math.min(Math.max(width * focus.x - w / 2, margin), width - margin - w));
  const y = Math.round(Math.min(Math.max(height * focus.y - h / 2, margin), height - margin - h));
  return { x, y, w, h };
}

/** Opacidade máxima de cada textura/luz: o teto é baixo de propósito, a edição não pode aparecer. */
export function fxAlpha(variant: string, intensity: number): number {
  const range: Record<string, [number, number]> = {
    vignette: [0.3, 0.8],
    grain: [0.025, 0.11],
    scanlines: [0.08, 0.26],
    'light-leak': [0.3, 0.7],
    'brand-glow': [0.25, 0.6],
    'dim-rect': [0.4, 0.8],
  };
  const [from, to] = range[variant] ?? [1, 1];
  return lerp(from, to, intensity);
}

/** Espessura da moldura paper, proporcional à altura do quadro. */
export function frameThickness(height: number, intensity: number): number {
  return Math.round((lerp(20, 56, intensity) * height) / 1080);
}

/** Comprimento do braço das cantoneiras. */
export function cornerLength(height: number, intensity: number): number {
  return Math.round((lerp(48, 110, intensity) * height) / 1080);
}

/**
 * Light leak ao longo da própria duração: atravessa o quadro da esquerda para a direita
 * e a opacidade faz um sino (nasce, passa, some), então não precisa de presença.
 */
export function leakAt(progress: number, intensity: number): { x: number; opacity: number } {
  const p = clamp01(progress);
  return { x: -0.25 + 1.5 * p, opacity: Math.sin(Math.PI * p) ** 2 * fxAlpha('light-leak', intensity) };
}

interface LayerProps {
  k: number;
  focus: Point;
  size: { w: number; h: number };
  tone: 'ink' | 'paper';
  durationInFrames: number;
}

const Letterbox: React.FC<LayerProps> = ({ k, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { value } = usePresence(durationInFrames, motion.slow, motion.base);
  const bar = letterboxBar(width, height, k) * value;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: bar, background: theme.color.night }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: bar, background: theme.color.night }} />
    </AbsoluteFill>
  );
};

const SideBars: React.FC<LayerProps> = ({ k, tone, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { value } = usePresence(durationInFrames, motion.slow, motion.base);
  const bar = sideBar(width, height, k) * value;
  const background = tone === 'paper' ? theme.color.paper : theme.color.ink;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: bar, background }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: bar, background }} />
    </AbsoluteFill>
  );
};

const PaperFrame: React.FC<LayerProps> = ({ k, durationInFrames }) => {
  const { height } = useVideoConfig();
  const { enter, exit } = usePresence(durationInFrames, motion.slow, motion.base);
  const thickness = frameThickness(height, k) * enter;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: 1 - exit }}>
      <div
        style={{
          position: 'absolute',
          inset: thickness,
          borderRadius: theme.radius.card * enter,
          // o anel externo gigante é a moldura; o interno dá a sombra do "cartão" sobre o footage
          boxShadow: `0 0 0 4000px ${theme.color.paper}, inset 0 0 0 2px ${withAlpha(theme.color.white, 0.5)}, inset 0 18px 40px -22px ${withAlpha(theme.color.slate900, 0.7)}`,
        }}
      />
    </AbsoluteFill>
  );
};

const CornerMarks: React.FC<LayerProps> = ({ k, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { enter, value } = usePresence(durationInFrames);
  const arm = cornerLength(height, k) * enter;
  const { x, y } = theme.safe;
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [width - x, y, -1, 1],
    [x, height - y, 1, -1],
    [width - x, height - y, -1, -1],
  ];
  const path = corners.map(([cx, cy, dx, dy]) => `M ${cx + arm * dx} ${cy} L ${cx} ${cy} L ${cx} ${cy + arm * dy}`).join(' ');
  return (
    <AbsoluteFill style={{ opacity: value }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} stroke={withAlpha(theme.color.ink, 0.55)} strokeWidth={9} />
        <path d={path} stroke={theme.color.white} strokeWidth={4} />
        <circle cx={x + 34} cy={y + 34} r={9 * enter} fill={theme.color.coral} />
      </svg>
    </AbsoluteFill>
  );
};

const Spotlight: React.FC<LayerProps> = ({ k, focus, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { enter, value } = usePresence(durationInFrames, motion.slow, motion.base);
  const light = spotlight(height, k);
  // o círculo fecha sobre o foco na entrada, como um diafragma
  const radius = light.radius * (1 + (1 - enter) * 0.6);
  return (
    <AbsoluteFill
      style={{
        opacity: value,
        background: `radial-gradient(circle at ${width * focus.x}px ${height * focus.y}px, transparent ${radius - light.feather}px, ${withAlpha(theme.color.ink, light.dim)} ${radius + light.feather}px)`,
      }}
    />
  );
};

const DimRect: React.FC<LayerProps> = ({ k, focus, size, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { enter, value } = usePresence(durationInFrames);
  const rect = dimRect(width, height, focus, size);
  const grow = (1 - enter) * 18;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: value }}>
      <div
        style={{
          position: 'absolute',
          left: rect.x - grow,
          top: rect.y - grow,
          width: rect.w + grow * 2,
          height: rect.h + grow * 2,
          borderRadius: theme.radius.card,
          boxShadow: `0 0 0 4000px ${withAlpha(theme.color.ink, fxAlpha('dim-rect', k))}, inset 0 0 0 2px ${withAlpha(theme.color.white, 0.45)}`,
        }}
      />
    </AbsoluteFill>
  );
};

const Vignette: React.FC<LayerProps> = ({ k, focus, durationInFrames }) => {
  const { value } = usePresence(durationInFrames, motion.slow, motion.base);
  return (
    <AbsoluteFill
      style={{
        opacity: value,
        background: `radial-gradient(ellipse 75% 75% at ${focus.x * 100}% ${focus.y * 100}%, transparent 42%, ${withAlpha(theme.color.ink, fxAlpha('vignette', k))} 100%)`,
      }}
    />
  );
};

const Scanlines: React.FC<LayerProps> = ({ k, durationInFrames }) => {
  const { value } = usePresence(durationInFrames);
  return (
    <AbsoluteFill
      style={{
        opacity: value,
        // período de 6 px: mais fino que isso vira moiré quando o preview é renderizado em escala menor
        background: `repeating-linear-gradient(to bottom, ${withAlpha(theme.color.ink, fxAlpha('scanlines', k))} 0px, ${withAlpha(theme.color.ink, fxAlpha('scanlines', k))} 3px, transparent 3px, transparent 6px)`,
      }}
    />
  );
};

const Grain: React.FC<LayerProps> = ({ k, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { frame, value } = usePresence(durationInFrames);
  // o alfa de cada grão vem do ruído: metade dos grãos clareia e metade escurece, sem véu cinza
  const gain = fxAlpha('grain', k) * 4;
  const speck = (sign: 1 | -1, level: number) => `0 0 0 0 ${level}  0 0 0 0 ${level}  0 0 0 0 ${level}  ${sign * gain} 0 0 0 ${(-sign * gain) / 2}`;
  // o grão troca a cada 2 frames: parado parece sujeira na lente, a cada frame vira chiado
  const seed = Math.floor(frame / 2) + 1;
  return (
    <AbsoluteFill style={{ opacity: value }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <filter id="fx-grain-light" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={seed} />
          <feColorMatrix type="matrix" values={speck(1, 1)} />
        </filter>
        <filter id="fx-grain-dark" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={seed} />
          <feColorMatrix type="matrix" values={speck(-1, 0)} />
        </filter>
        <rect width={width} height={height} filter="url(#fx-grain-light)" />
        <rect width={width} height={height} filter="url(#fx-grain-dark)" />
      </svg>
    </AbsoluteFill>
  );
};

const LightLeak: React.FC<LayerProps> = ({ k, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { frame } = usePresence(durationInFrames);
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: motion.move,
  });
  const leak = leakAt(progress, k);
  const cx = width * leak.x;
  return (
    <AbsoluteFill
      style={{
        opacity: leak.opacity,
        background: [
          `radial-gradient(ellipse ${width * 0.42}px ${height * 0.95}px at ${cx}px ${height * 0.3}px, ${withAlpha(theme.color.glowPeach, 0.95)} 0%, ${withAlpha(theme.color.coral, 0.45)} 45%, transparent 100%)`,
          `radial-gradient(ellipse ${width * 0.3}px ${height * 0.7}px at ${cx - width * 0.22}px ${height * 0.85}px, ${withAlpha(theme.color.coral, 0.32)} 0%, transparent 100%)`,
        ].join(', '),
      }}
    />
  );
};

const BrandGlow: React.FC<LayerProps> = ({ k, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { frame, value } = usePresence(durationInFrames, motion.slow, motion.base);
  const alpha = fxAlpha('brand-glow', k);
  // respiração lenta ao longo de toda a duração, para o glow não parecer um adesivo parado
  const drift = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], { extrapolateRight: 'clamp', easing: motion.move });
  const disc = height * (0.62 + 0.05 * drift);
  return (
    <AbsoluteFill
      style={{
        opacity: value,
        background: [
          `radial-gradient(circle ${disc}px at ${width * 0.04}px ${height * 0.02}px, ${withAlpha(theme.color.glowMint, alpha)} 0%, ${withAlpha(theme.color.glowPeriwinkle, alpha * 0.45)} 45%, transparent 100%)`,
          `radial-gradient(circle ${disc}px at ${width * 0.97}px ${height * 0.98}px, ${withAlpha(theme.color.glowPeriwinkle, alpha)} 0%, ${withAlpha(theme.color.glowPeach, alpha * 0.45)} 45%, transparent 100%)`,
        ].join(', '),
      }}
    />
  );
};

const layers: Record<string, React.FC<LayerProps>> = {
  letterbox: Letterbox,
  'side-bars': SideBars,
  'paper-frame': PaperFrame,
  'corner-marks': CornerMarks,
  'brand-glow': BrandGlow,
  spotlight: Spotlight,
  'dim-rect': DimRect,
  vignette: Vignette,
  scanlines: Scanlines,
  grain: Grain,
  'light-leak': LightLeak,
};

export const fxVariants: string[] = Object.keys(layers);

/** Efeito de tela cheia sobre o footage (camada com alfa). O catálogo fica em `src/arsenal/effects.ts`. */
export const Fx: React.FC<FxProps & BaseProps> = ({
  variant,
  intensity = 0.5,
  focus = { x: 0.5, y: 0.4 },
  size = { w: 0.5, h: 0.5 },
  tone = 'ink',
  durationInFrames,
}) => {
  const Layer = layers[variant];
  if (!Layer) throw new Error(`Variante de Fx desconhecida: "${variant}" (use uma de: ${fxVariants.join(', ')})`);
  return <Layer k={clamp01(intensity)} focus={focus} size={size} tone={tone} durationInFrames={durationInFrames} />;
};

export const entry: ComponentEntry = {
  component: Fx,
  sample: { variant: 'letterbox', intensity: 0.6 },
  defaultDuration: 5,
  vertical: { zone: 'frame' },
  description:
    'Efeito de tela cheia sobre o footage (letterbox, moldura paper, holofote, vinheta, grão, scanlines, light leak, glows). Escolha a variante pelo preset do arsenal de efeitos.',
};
