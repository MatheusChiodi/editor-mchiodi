import { evolvePath, getBoundingBox, getLength, getPointAtLength } from '@remotion/paths';
import { makeHeart } from '@remotion/shapes';
import { Easing } from 'remotion';

import { loopProgress, springAt, wobble } from '../anim';
import { burstParticles, mulberry32, particleState } from '../components/Burst';
import { blobPath, blobPoints } from '../components/OrganicBlob';
import { theme } from '../theme';
import { StoryShot } from './story/Shot';
import type { MotifId, Shot } from './types';
import { mixHex } from './visuals';

/**
 * Motivos ilustrativos das cenas. Cada um desenha em SVG, centrado em (0, 0), numa área de ~±330 × ±300 (unidade de
 * 1080p; o chamador escala). Animam pelo tempo da própria cena e reagem ao grave (`bass`) e à batida (`pulse`).
 */
export interface MotifProps {
  /** quadros desde o começo da cena */
  frame: number;
  fps: number;
  /** 0–1 ao longo da cena */
  progress: number;
  palette: [string, string, string];
  bass: number;
  pulse: number;
  variant: number;
  keyword: string | null;
  /** muda o sorteio dos elementos entre cenas do mesmo motivo */
  seed: number;
  /** plano de história (só no motivo `story`) */
  shot?: Shot;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const outCubic = Easing.out(Easing.cubic);
const PAPER = theme.color.paper;
const INK = theme.color.ink;

const Phone: React.FC<MotifProps> = ({ frame, fps, palette: [bg, accent, glow], pulse }) => {
  const cycle = 3.4;
  const t = (frame / fps) % cycle;
  // digita (0–1.5 s), segura, apaga (2.1–2.7 s): a mensagem nunca é enviada
  const typed = t < 1.5 ? outCubic(t / 1.5) : t < 2.1 ? 1 : t < 2.7 ? 1 - (t - 2.1) / 0.6 : 0;
  const deleting = t >= 2.1 && t < 2.9;
  const draft = clamp01((t - 2.1) / 0.8);
  return (
    <g>
      <rect x={-150} y={-285} width={300} height={570} rx={46} fill="#090c14" stroke={glow} strokeWidth={5} opacity={0.98} />
      <rect x={-134} y={-268} width={268} height={536} rx={34} fill={mixHex(bg, '#000000', 0.35)} />
      <circle cx={-96} cy={-232} r={18} fill={accent} />
      <rect x={-68} y={-244} width={96} height={12} rx={6} fill={PAPER} opacity={0.75} />
      <rect x={-68} y={-224} width={60} height={9} rx={4.5} fill={PAPER} opacity={0.35} />
      {/* conversa: uma mensagem recebida e um rascunho que sobe e some */}
      <rect x={-116} y={-170} width={170} height={52} rx={22} fill={PAPER} opacity={0.18} />
      <rect x={-116} y={-100} width={120} height={46} rx={20} fill={PAPER} opacity={0.18} />
      <g opacity={deleting ? 1 - draft : 0} transform={`translate(${draft * 40} ${-draft * 90})`}>
        <rect x={-40} y={90} width={150} height={46} rx={20} fill={accent} opacity={0.85} />
      </g>
      {/* caixa de texto */}
      <rect x={-118} y={188} width={198} height={54} rx={27} fill="#05070c" stroke={PAPER} strokeWidth={2} opacity={0.9} />
      <rect x={-100} y={207} width={Math.max(0, 160 * typed)} height={12} rx={6} fill={PAPER} />
      <rect x={-100} y={226} width={Math.max(0, 110 * typed)} height={8} rx={4} fill={PAPER} opacity={0.5} />
      {typed < 1 && !deleting ? <rect x={-100 + 160 * typed + 4} y={204} width={4} height={30} rx={2} fill={glow} opacity={Math.floor(frame / 8) % 2 ? 0.2 : 1} /> : null}
      <circle cx={112} cy={215} r={26} fill={accent} transform={`scale(${1 + 0.1 * pulse})`} style={{ transformOrigin: '112px 215px' }} />
      <path d="M 102 215 L 122 215 M 114 206 L 123 215 L 114 224" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

const HEART = makeHeart({ height: 300 });
const HEART_BOX = getBoundingBox(HEART.path);
const CRACK = 'M 0 -120 L -24 -70 L 20 -30 L -18 20 L 14 70 L -6 120';

const Heart: React.FC<MotifProps> = ({ frame, fps, progress, palette: [, accent, glow], bass, pulse }) => {
  const scale = (1 + 0.14 * bass + 0.08 * pulse) * (0.7 + 0.3 * springAt(frame, fps, 0));
  const crack = evolvePath(clamp01((progress - 0.3) / 0.35), CRACK);
  const cx = (HEART_BOX.x1 + HEART_BOX.x2) / 2;
  const cy = (HEART_BOX.y1 + HEART_BOX.y2) / 2;
  const ecg = 'M -320 230 L -200 230 L -170 230 L -150 180 L -120 280 L -95 230 L 320 230';
  const head = getPointAtLength(ecg, loopProgress(frame, fps, 2.2) * getLength(ecg)) ?? { x: 0, y: 0 };
  return (
    <g>
      <circle cx={0} cy={-10} r={230 * scale} fill={glow} opacity={0.12 + 0.1 * bass} />
      <g transform={`translate(0 -20) scale(${scale}) translate(${-cx} ${-cy})`}>
        <path d={HEART.path} fill={accent} stroke={PAPER} strokeWidth={8} strokeLinejoin="round" />
      </g>
      <g transform={`translate(0 -20) scale(${scale})`}>
        <path d={CRACK} fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={crack.strokeDasharray} strokeDashoffset={crack.strokeDashoffset} />
      </g>
      <path d={ecg} fill="none" stroke={glow} strokeWidth={5} strokeLinecap="round" opacity={0.55} />
      <circle cx={head.x} cy={head.y} r={9 + 4 * pulse} fill={PAPER} />
    </g>
  );
};

const Night: React.FC<MotifProps> = ({ frame, fps, progress, palette: [, accent, glow], seed }) => {
  const random = mulberry32(seed + 11);
  const stars = Array.from({ length: 46 }, () => ({ x: (random() - 0.5) * 640, y: (random() - 0.5) * 560, r: 1.5 + random() * 3.2, speed: 1 + random() * 2.5, phase: random() * 6 }));
  const t = frame / fps;
  const rise = outCubic(clamp01(progress * 2.2));
  return (
    <g>
      {stars.map((star, i) => (
        <circle key={i} cx={star.x} cy={star.y} r={star.r} fill={i % 5 === 0 ? glow : PAPER} opacity={0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase))} />
      ))}
      <g transform={`translate(${60 - 40 * progress} ${-60 + (1 - rise) * 120})`}>
        <circle r={150} fill={glow} opacity={0.14} />
        <mask id="moon-cut">
          <rect x={-200} y={-200} width={400} height={400} fill="#fff" />
          <circle cx={62} cy={-26} r={116} fill="#000" />
        </mask>
        <circle r={124} fill="#f4efd6" mask="url(#moon-cut)" />
      </g>
      <path d="M -330 230 C -200 170, -90 250, 40 200 S 250 180, 330 230 L 330 300 L -330 300 Z" fill={accent} opacity={0.22} />
    </g>
  );
};

const Morning: React.FC<MotifProps> = ({ frame, fps, progress, palette: [bg, accent, glow] }) => {
  const t = frame / fps;
  const sunY = 150 - outCubic(clamp01(progress * 1.4)) * 190;
  return (
    <g>
      <clipPath id="window-clip">
        <rect x={-150} y={-190} width={300} height={380} rx={10} />
      </clipPath>
      <g clipPath="url(#window-clip)">
        <rect x={-150} y={-190} width={300} height={380} fill={mixHex(bg, accent, 0.35)} />
        <rect x={-150} y={-190} width={300} height={380} fill={mixHex('#ffb86c', '#ff5555', 0.2)} opacity={0.35 * outCubic(progress)} />
        <g transform={`translate(0 ${sunY})`}>
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1={0} y1={-96} x2={0} y2={-150} stroke={glow} strokeWidth={8} strokeLinecap="round" opacity={0.55} transform={`rotate(${i * 30 + t * 12})`} />
          ))}
          <circle r={72} fill="#ffe08a" />
        </g>
        <path d="M -150 150 C -90 110, -30 140, 40 120 S 120 130, 150 118 L 150 190 L -150 190 Z" fill={mixHex(bg, '#000000', 0.45)} />
      </g>
      <rect x={-150} y={-190} width={300} height={380} rx={10} fill="none" stroke={PAPER} strokeWidth={14} />
      <line x1={0} y1={-190} x2={0} y2={190} stroke={PAPER} strokeWidth={10} />
      <line x1={-150} y1={0} x2={150} y2={0} stroke={PAPER} strokeWidth={10} />
      <rect x={-176} y={186} width={352} height={20} rx={8} fill={PAPER} />
    </g>
  );
};

const Photos: React.FC<MotifProps> = ({ frame, fps, palette: [bg, accent, glow], variant, seed }) => {
  const angles = [[-11, 3, 12], [9, -6, 4], [-4, 10, -12]][variant % 3]!;
  return (
    <g>
      {angles.map((angle, i) => {
        const enter = springAt(frame, fps, i * 0.28);
        const x = (i - 1) * 165;
        const sway = wobble(frame, fps, `photo${seed}${i}`, 3, 0.4);
        return (
          <g key={i} transform={`translate(${x} ${(1 - enter) * 380 + sway - 10}) rotate(${angle + sway * 0.4})`} opacity={enter}>
            <rect x={-105} y={-135} width={210} height={262} rx={6} fill={PAPER} />
            <rect x={-90} y={-120} width={180} height={178} fill={mixHex(bg, i % 2 ? glow : accent, 0.55)} />
            <circle cx={36} cy={-66} r={22} fill="#ffe08a" opacity={0.9} />
            <path d="M -90 58 L -40 -20 L 0 30 L 36 -8 L 90 58 Z" fill={mixHex(bg, '#000000', 0.4)} />
            <circle cx={-34} cy={-4} r={20} fill={PAPER} opacity={0.9} />
            <path d="M -62 58 Q -34 12 -6 58 Z" fill={PAPER} opacity={0.9} />
            <rect x={-70} y={82} width={110 - i * 14} height={10} rx={5} fill={INK} opacity={0.45} />
          </g>
        );
      })}
    </g>
  );
};

const Clock: React.FC<MotifProps> = ({ frame, fps, progress, palette: [, accent, glow], pulse }) => {
  const t = frame / fps;
  // o relógio gira para trás, cada vez mais rápido
  const minute = -(progress * 900 + t * 30 + 360 * progress * progress * 2);
  const hour = minute / 12;
  return (
    <g>
      <circle r={200} fill="none" stroke={glow} strokeWidth={5} opacity={0.35 + 0.3 * pulse} />
      <circle r={178} fill={mixHex('#000000', accent, 0.14)} stroke={PAPER} strokeWidth={10} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={0} y1={-150} x2={0} y2={i % 3 === 0 ? -122 : -134} stroke={PAPER} strokeWidth={i % 3 === 0 ? 9 : 5} strokeLinecap="round" transform={`rotate(${i * 30})`} />
      ))}
      {[24, 14, 6].map((lag, i) => (
        <line key={i} x1={0} y1={0} x2={0} y2={-132} stroke={glow} strokeWidth={7} strokeLinecap="round" opacity={0.12 + i * 0.05} transform={`rotate(${minute + lag * (i + 1)})`} />
      ))}
      <line x1={0} y1={0} x2={0} y2={-128} stroke={accent} strokeWidth={9} strokeLinecap="round" transform={`rotate(${minute})`} />
      <line x1={0} y1={0} x2={0} y2={-92} stroke={PAPER} strokeWidth={13} strokeLinecap="round" transform={`rotate(${hour})`} />
      <circle r={13} fill={PAPER} />
    </g>
  );
};

const Rain: React.FC<MotifProps> = ({ frame, fps, palette: [, accent, glow], bass, seed }) => {
  const random = mulberry32(seed + 5);
  const t = frame / fps;
  const drops = Array.from({ length: 34 }, () => ({ x: (random() - 0.5) * 560, speed: 420 + random() * 360, offset: random() * 500, length: 22 + random() * 24 }));
  return (
    <g>
      <g transform="translate(0 -170)" fill={mixHex('#2a3350', accent, 0.25)}>
        <circle cx={-90} cy={10} r={62} />
        <circle cx={-20} cy={-26} r={84} />
        <circle cx={70} cy={0} r={68} />
        <circle cx={130} cy={22} r={46} />
        <rect x={-150} y={10} width={300} height={58} rx={29} />
      </g>
      {drops.map((drop, i) => {
        const y = -100 + ((t * drop.speed + drop.offset) % 470);
        return <line key={i} x1={drop.x} y1={y} x2={drop.x - 7} y2={y + drop.length} stroke={i % 4 === 0 ? glow : accent} strokeWidth={4 + bass * 2} strokeLinecap="round" opacity={0.75} />;
      })}
      {[0, 1, 2].map((i) => {
        const phase = loopProgress(frame, fps, 1.6) + i / 3;
        const p = phase % 1;
        return <ellipse key={i} cx={(i - 1) * 150} cy={285} rx={20 + p * 90} ry={5 + p * 16} fill="none" stroke={glow} strokeWidth={3} opacity={1 - p} />;
      })}
    </g>
  );
};

const ROAD = 'M -250 250 C -140 120, 140 170, 60 40 S -100 -90, 70 -210';

const Road: React.FC<MotifProps> = ({ frame, fps, progress, palette: [bg, accent, glow], pulse }) => {
  const draw = outCubic(clamp01(progress * 1.5));
  const state = evolvePath(draw, ROAD);
  const length = getLength(ROAD);
  const head = getPointAtLength(ROAD, draw * length) ?? { x: 0, y: 0 };
  return (
    <g>
      <circle cx={90} cy={-230} r={44 + 6 * pulse} fill="#ffe08a" opacity={0.9} />
      <path d={ROAD} fill="none" stroke={mixHex(bg, '#000000', 0.5)} strokeWidth={74} strokeLinecap="round" strokeDasharray={state.strokeDasharray} strokeDashoffset={state.strokeDashoffset} />
      <path d={ROAD} fill="none" stroke={PAPER} strokeWidth={5} strokeLinecap="round" strokeDasharray="22 26" strokeDashoffset={-frame * 1.2} opacity={0.85} />
      <circle cx={head.x} cy={head.y} r={20} fill={accent} stroke={PAPER} strokeWidth={6} />
      <circle cx={head.x} cy={head.y} r={34 + 10 * pulse} fill="none" stroke={glow} strokeWidth={4} opacity={0.5} />
    </g>
  );
};

const Shout: React.FC<MotifProps> = ({ frame, fps, palette: [, accent, glow], bass, pulse }) => {
  const t = frame / fps;
  const points = Array.from({ length: 56 }, (_, i) => {
    const x = -300 + (600 * i) / 55;
    const envelope = Math.sin((Math.PI * i) / 55);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${(Math.sin(i * 0.55 + t * 9) * (14 + bass * 130) * envelope).toFixed(1)}`;
  }).join(' ');
  return (
    <g>
      {[0, 1, 2, 3].map((i) => {
        const p = (loopProgress(frame, fps, 1.4) + i / 4) % 1;
        return <circle key={i} r={40 + p * 300} fill="none" stroke={i % 2 ? glow : accent} strokeWidth={10 * (1 - p) + 2} opacity={0.8 * (1 - p)} />;
      })}
      <circle r={52 + 14 * pulse} fill={accent} stroke={PAPER} strokeWidth={8} />
      <path d={points} fill="none" stroke={PAPER} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

const JAG_L = '0,-190 -14,-150 12,-110 -16,-70 10,-30 -14,10 12,50 -12,90 8,130 -6,170 0,190';

const Paper: React.FC<MotifProps> = ({ frame, fps, progress, palette: [, accent, glow], seed }) => {
  const q = outCubic(clamp01((progress - 0.15) * 1.6));
  const random = mulberry32(seed + 3);
  const scraps = Array.from({ length: 14 }, () => ({ x: (random() - 0.5) * 120, speed: 80 + random() * 140, spin: (random() - 0.5) * 300, size: 8 + random() * 14 }));
  const t = frame / fps;
  const jag = JAG_L.split(' ').map((pair) => pair.split(',').map(Number) as [number, number]);
  const left = `M -150 -190 L ${jag.map(([x, y]) => `${x} ${y}`).join(' L ')} L -150 190 Z`;
  const right = `M 150 -190 L ${jag.map(([x, y]) => `${x} ${y}`).join(' L ')} L 150 190 Z`;
  const half = (path: string, side: -1 | 1) => (
    <g transform={`translate(${side * (6 + 130 * q)} ${q * 14}) rotate(${side * 9 * q})`}>
      <path d={path} fill={PAPER} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      {[-130, -92, -54, -16, 22, 60, 98].map((y, i) => (
        <rect key={i} x={side === -1 ? -128 : 30} y={y} width={side === -1 ? 100 - (i % 3) * 20 : 96 - (i % 2) * 24} height={9} rx={4} fill={INK} opacity={0.4} />
      ))}
      <rect x={side === -1 ? -128 : 30} y={-170} width={70} height={14} rx={6} fill={accent} />
    </g>
  );
  return (
    <g>
      {half(left, -1)}
      {half(right, 1)}
      {scraps.map((scrap, i) => (
        <rect key={i} x={scrap.x - scrap.size / 2} y={-40 + ((t * scrap.speed) % 330) * q} width={scrap.size} height={scrap.size * 0.7} fill={i % 3 ? PAPER : glow} opacity={q * 0.85} transform={`rotate(${scrap.spin * t} ${scrap.x} 0)`} />
      ))}
    </g>
  );
};

const Words: React.FC<MotifProps> = ({ frame, fps, progress, palette: [, accent, glow], keyword, pulse, seed }) => {
  const word = (keyword ?? '').toUpperCase();
  const size = Math.max(90, Math.min(210, 520 / Math.max(3, word.length) * 1.7));
  const pop = springAt(frame, fps, 0.05, { damping: 9, stiffness: 140, mass: 0.7 });
  const random = mulberry32(seed + 17);
  return (
    <g>
      {[0, 1].map((i) => (
        <circle key={i} r={150 + i * 70 + 24 * pulse} fill="none" stroke={i ? glow : accent} strokeWidth={6} opacity={0.35 - i * 0.12} />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={(random() - 0.5) * 620} cy={(random() - 0.5) * 520} r={4 + random() * 8} fill={i % 2 ? glow : accent} opacity={0.35 + 0.3 * Math.sin(frame / fps * 2 + i)} />
      ))}
      {word ? (
        <>
          <text textAnchor="middle" y={size * 0.3} fontSize={size} fontWeight={800} fontFamily={theme.font.body} fill={PAPER} stroke={INK} strokeWidth={size * 0.12} paintOrder="stroke fill" strokeLinejoin="round" transform={`scale(${0.6 + 0.4 * pop + 0.04 * pulse})`} opacity={clamp01(pop * 2)}>
            {word}
          </text>
          <rect x={-size * 0.1 * Math.max(3, word.length) * 0.35 * clamp01(progress * 4)} y={size * 0.46} width={size * 0.1 * Math.max(3, word.length) * 0.7 * clamp01(progress * 4)} height={12} rx={6} fill={accent} />
        </>
      ) : null}
    </g>
  );
};

const Burst: React.FC<MotifProps> = ({ frame, palette: [, accent, glow], pulse, seed }) => {
  const period = 42;
  const age = frame % period;
  const round = Math.floor(frame / period);
  return (
    <g>
      {burstParticles(seed + round, 26).map((particle, i) => {
        const state = particleState(particle, age / period, 330);
        const size = particle.size * 1.3;
        return <rect key={i} x={state.x - size / 2} y={state.y - size / 2} width={particle.streak ? size * 2.4 : size} height={size} rx={size / 2} fill={i % 3 ? accent : glow} opacity={state.opacity} transform={`rotate(${particle.angle} ${state.x} ${state.y}) scale(${state.scale})`} style={{ transformOrigin: `${state.x}px ${state.y}px` }} />;
      })}
      <circle r={70 + 90 * (1 - Math.exp(-age / 8)) } fill="none" stroke={glow} strokeWidth={8} opacity={Math.exp(-age / 10)} />
      <circle r={58 + 14 * pulse} fill={accent} stroke={PAPER} strokeWidth={8} />
    </g>
  );
};

const Blob: React.FC<MotifProps> = ({ frame, fps, palette: [, accent, glow], bass, pulse, seed }) => {
  const radius = 200 * (0.78 + 0.5 * bass + 0.08 * pulse);
  const d = blobPath(blobPoints(frame, fps, `blob${seed}`, { points: 9, radius, amp: 0.1 + 0.2 * bass, speed: 0.35 }));
  return (
    <g>
      <circle r={radius * 1.35} fill={glow} opacity={0.12} />
      <path d={d} fill={accent} fillOpacity={0.92} stroke={PAPER} strokeWidth={8} />
    </g>
  );
};

/** Plano com personagem e cenário: desenhado no palco 1920×1080 (o MusicVideo o põe em tela cheia, não na área central). */
const Story: React.FC<MotifProps> = ({ shot, frame, fps, progress, palette, pulse, seed }) =>
  shot ? <StoryShot shot={shot} frame={frame} fps={fps} progress={progress} accent={palette[1]} pulse={pulse} seed={seed} /> : null;

export const MOTIFS: Record<MotifId, React.FC<MotifProps>> = {
  story: Story,
  phone: Phone,
  heart: Heart,
  night: Night,
  morning: Morning,
  photos: Photos,
  clock: Clock,
  rain: Rain,
  road: Road,
  shout: Shout,
  paper: Paper,
  words: Words,
  burst: Burst,
  blob: Blob,
};
