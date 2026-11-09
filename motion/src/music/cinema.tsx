import { loopProgress } from '../anim';
import { withAlpha } from '../components/SectionTitle';
import { bokehParticles, letterboxBar } from './cinema-math';
import { mixHex } from './visuals';

/**
 * Camadas de acabamento "cinema": filtros de bloom, aberração cromática e glitch (em <defs>), color grade, vazamentos
 * de luz, bokeh, raios, lens flare, grão, vinheta e faixas cinemascope. Tudo em SVG/CSS, sem imagem externa.
 */
export interface CinemaLayerProps {
  width: number;
  height: number;
  frame: number;
  fps: number;
  palette: [string, string, string];
  /** pulso da batida, 0–1 */
  pulse: number;
  /** pulso do tempo forte, 0–1 */
  downPulse: number;
  /** energia da seção */
  energy: 'low' | 'mid' | 'high';
}

const fill = { position: 'absolute', inset: 0, pointerEvents: 'none' } as const;

/** Filtros SVG reutilizados pela cena. `chroma` em px de deslocamento dos canais; `glitch` 0–1; `blur` px. */
export const CinemaDefs: React.FC<{ frame: number; chroma: number; glitch: number; blurIn: number; blurOut: number }> = ({ frame, chroma, glitch, blurIn, blurOut }) => (
  <defs>
    <filter id="bloom" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
      <feComponentTransfer in="blur" result="soft">
        <feFuncA type="linear" slope="0.5" />
      </feComponentTransfer>
      <feBlend in="SourceGraphic" in2="soft" mode="screen" />
    </filter>
    <filter id="ca" x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
      <feOffset in="r" dx={chroma} dy="0" result="ro" />
      <feOffset in="b" dx={-chroma} dy="0" result="bo" />
      <feBlend in="ro" in2="g" mode="screen" result="rg" />
      <feBlend in="rg" in2="bo" mode="screen" />
    </filter>
    <filter id="glitch" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0009 0.06" numOctaves="1" seed={frame % 23} result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={glitch * 70} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="blurIn" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation={blurIn} />
    </filter>
    <filter id="blurOut" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation={blurOut} />
    </filter>
    <radialGradient id="bokehA">
      <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
      <stop offset="60%" stopColor="#fff" stopOpacity="0.5" />
      <stop offset="100%" stopColor="#fff" stopOpacity="0" />
    </radialGradient>
  </defs>
);

/** Grade de cor de cinema: sombras frias (teal) e luzes quentes (laranja), em modo de mistura suave. */
export const Grade: React.FC<Pick<CinemaLayerProps, 'energy'>> = ({ energy }) => (
  <>
    <div style={{ ...fill, background: 'linear-gradient(135deg, rgba(0,130,170,0.20) 0%, rgba(0,0,0,0) 55%)', mixBlendMode: 'soft-light' }} />
    <div style={{ ...fill, background: `linear-gradient(315deg, rgba(255,140,60,${energy === 'high' ? 0.28 : 0.18}) 0%, rgba(0,0,0,0) 55%)`, mixBlendMode: 'soft-light' }} />
  </>
);

/** Vazamentos de luz que cruzam o quadro e estouram nos tempos fortes. */
export const LightLeaks: React.FC<CinemaLayerProps> = ({ width, height, frame, fps, palette, downPulse, energy }) => {
  const a = loopProgress(frame, fps, 11);
  const b = loopProgress(frame, fps, 17, true);
  const strength = (energy === 'low' ? 0.16 : 0.24) + 0.4 * downPulse;
  return (
    <>
      <div style={{ ...fill, mixBlendMode: 'screen', opacity: strength, background: `radial-gradient(ellipse 42% 70% at ${a * 140 - 20}% 20%, ${withAlpha(palette[2], 0.85)} 0%, transparent 70%)` }} />
      <div style={{ ...fill, mixBlendMode: 'screen', opacity: strength * 0.8, background: `radial-gradient(ellipse 36% 60% at ${100 - b * 100}% 95%, ${withAlpha(palette[1], 0.8)} 0%, transparent 72%)` }} />
      <div style={{ ...fill, width, height }} />
    </>
  );
};

/** Poeira e bokeh em camadas de profundidade: sobem devagar, as da frente mais rápidas e maiores. */
export const Bokeh: React.FC<CinemaLayerProps & { seed: number; count?: number }> = ({ width, height, frame, fps, palette, seed, count = 34 }) => {
  const unit = Math.min(width, height) / 1080;
  const t = frame / fps;
  return (
    <svg width={width} height={height} style={{ ...fill, mixBlendMode: 'screen' }}>
      {bokehParticles(seed, count).map((p, i) => {
        const y = (((p.y * height - t * p.speed * unit) % (height + 80)) + height + 80) % (height + 80) - 40;
        const x = p.x * width + Math.sin(t * 0.4 + p.phase) * 30 * p.depth * unit;
        const r = p.r * unit;
        return <circle key={i} cx={x} cy={y} r={r} fill={mixHex(palette[1], palette[2], p.hue)} opacity={0.1 + 0.22 * p.depth} />;
      })}
    </svg>
  );
};

/** Raios de luz atravessando a cena, girando devagar. */
export const GodRays: React.FC<CinemaLayerProps> = ({ frame, fps, palette, energy }) => {
  const sweep = loopProgress(frame, fps, 24, true) * 22 - 11;
  return (
    <div
      style={{
        ...fill,
        mixBlendMode: 'screen',
        opacity: energy === 'low' ? 0.35 : 0.55,
        background: `conic-gradient(from ${160 + sweep}deg at 78% -12%, transparent 0deg, ${withAlpha(palette[2], 0.16)} 6deg, transparent 15deg, ${withAlpha(palette[2], 0.1)} 24deg, transparent 33deg, ${withAlpha(palette[2], 0.14)} 44deg, transparent 54deg)`,
      }}
    />
  );
};

/** Lens flare horizontal no estouro do tempo forte (só trechos médios e fortes). */
export const LensFlare: React.FC<CinemaLayerProps> = ({ width, height, palette, downPulse, energy }) =>
  energy === 'low' || downPulse < 0.04 ? null : (
    <div style={{ ...fill, mixBlendMode: 'screen' }}>
      <div style={{ position: 'absolute', left: width * 0.12, width: width * 0.76, top: height * 0.42, height: 5, background: `linear-gradient(90deg, transparent, ${withAlpha(palette[2], 0.9)}, #fff, ${withAlpha(palette[2], 0.9)}, transparent)`, opacity: downPulse, filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', left: width * 0.5 - 90, top: height * 0.42 - 88, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${withAlpha('#ffffff', 0.9)} 0%, ${withAlpha(palette[2], 0.35)} 35%, transparent 70%)`, opacity: downPulse * 0.8 }} />
    </div>
  );

/** Grão de filme (ruído fractal que muda a cada quadro). */
export const Grain: React.FC<{ width: number; height: number; frame: number }> = ({ width, height, frame }) => (
  <svg width={width} height={height} style={{ ...fill, mixBlendMode: 'overlay', opacity: 0.2 }}>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={frame % 11} />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width={width} height={height} filter="url(#grain)" />
  </svg>
);

/** Vinheta: escurece os cantos e leva o olhar para o centro. */
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.62 }) => (
  <div style={{ ...fill, background: `radial-gradient(ellipse 75% 70% at 50% 46%, transparent 52%, rgba(0,0,0,${strength}) 100%)` }} />
);

/** Faixas pretas cinemascope (2,39:1); some em vertical. */
export const Letterbox: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const bar = letterboxBar(width, height);
  if (bar <= 0) return null;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: bar, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bar, background: '#000' }} />
    </>
  );
};
