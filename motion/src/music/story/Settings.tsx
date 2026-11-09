import { loopProgress, wobble } from '../../anim';
import { mulberry32 } from '../../components/Burst';
import { mixHex } from '../visuals';
import type { PoseId, SettingId, TimeId, WeatherId } from '../types';

/**
 * Cenários da história, desenhados em SVG no "palco" de 1920×1080 com a origem no centro (x ±960, y ±540). Cada um tem
 * céu por horário, camadas com parallax (`drift`), luzes acesas à noite e o ponto onde o personagem pisa (`stageSpot`).
 */
export interface SettingProps {
  setting: SettingId;
  time: TimeId;
  weather: WeatherId;
  frame: number;
  fps: number;
  /** deslocamento horizontal em px; cada camada anda uma fração dele (parallax) */
  drift: number;
  seed: number;
}

export const STAGE = { width: 1920, height: 1080 } as const;
const W2 = STAGE.width / 2;
const H2 = STAGE.height / 2;

interface Sky {
  top: string;
  bottom: string;
  tint: string;
  lit: boolean;
}

export const SKY: Record<TimeId, Sky> = {
  night: { top: '#060a22', bottom: '#1b2a63', tint: '#0b1240', lit: true },
  dawn: { top: '#2b2a63', bottom: '#ffa07a', tint: '#ff9a76', lit: true },
  day: { top: '#5db6ff', bottom: '#e4f5ff', tint: '#ffffff', lit: false },
  dusk: { top: '#24164a', bottom: '#ff6b6b', tint: '#ff5f6d', lit: true },
};

export interface Spot {
  x: number;
  /** y do chão onde os pés pisam */
  ground: number;
  scale: number;
}

const SPOTS: Record<SettingId, Spot | null> = {
  bedroom: { x: -40, ground: 300, scale: 1.5 },
  street: { x: -80, ground: 262, scale: 1.55 },
  rooftop: { x: 120, ground: 250, scale: 1.6 },
  park: { x: -60, ground: 280, scale: 1.5 },
  shore: { x: -140, ground: 322, scale: 1.55 },
  hills: { x: -100, ground: 330, scale: 1.55 },
  window: null,
};

/** Onde o personagem fica no cenário; `null` no plano de janela (sem personagem). */
export const stageSpot = (setting: SettingId): Spot | null => SPOTS[setting];

/** Sentado na cama e no banco; nos outros cenários, em pé ou andando. */
export const isSeated = (setting: SettingId, pose: PoseId): boolean => (setting === 'bedroom' || setting === 'park') && pose !== 'walk';

const rect = (x: number, y: number, w: number, h: number, fill: string, extra: Record<string, unknown> = {}) => <rect x={x} y={y} width={w} height={h} fill={fill} {...extra} />;

/** Prédios em sequência (com janelas acesas à noite) ocupando a largura do palco. */
function Skyline({ seed, base, min, max, color, windows, offset }: { seed: number; base: number; min: number; max: number; color: string; windows: boolean; offset: number }) {
  const random = mulberry32(seed);
  const items: React.ReactNode[] = [];
  let x = -W2 - 200;
  let i = 0;
  while (x < W2 + 200) {
    const w = 80 + random() * 90;
    const h = min + random() * (max - min);
    items.push(<rect key={`b${i}`} x={x} y={base - h} width={w} height={h + 600} fill={color} />);
    if (windows) {
      for (let wy = base - h + 18; wy < base - 14; wy += 30) {
        for (let wx = x + 12; wx < x + w - 18; wx += 24) {
          if (random() > 0.62) items.push(<rect key={`w${i}-${wx}-${wy}`} x={wx} y={wy} width={11} height={16} fill={random() > 0.5 ? '#ffd98a' : '#ffe9b8'} opacity={0.85} />);
        }
      }
    }
    x += w + 4;
    i++;
  }
  return <g transform={`translate(${offset} 0)`}>{items}</g>;
}

function Stars({ seed, frame, fps, dim }: { seed: number; frame: number; fps: number; dim: number }) {
  const random = mulberry32(seed + 90);
  return (
    <g>
      {Array.from({ length: 80 }, (_, i) => {
        const x = (random() - 0.5) * STAGE.width;
        const y = -H2 + random() * 520;
        const r = 1 + random() * 2.4;
        const speed = 1 + random() * 2.5;
        return <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={dim * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin((frame / fps) * speed + i)))} />;
      })}
    </g>
  );
}

/** Astro do céu: lua à noite, sol baixo no amanhecer e no entardecer, sol alto de dia. */
function Celestial({ time, drift }: { time: TimeId; drift: number }) {
  const o = drift * 0.05;
  if (time === 'night') {
    return (
      <g transform={`translate(${520 + o} -260)`}>
        <circle r={150} fill="#cfe0ff" opacity={0.08} />
        <circle r={96} fill="#cfe0ff" opacity={0.12} />
        <circle r={58} fill="#f4efd6" />
        <circle cx={-16} cy={-10} r={9} fill="#ddd6b4" />
        <circle cx={18} cy={14} r={6} fill="#ddd6b4" />
        <circle cx={10} cy={-24} r={5} fill="#e6dfc0" />
      </g>
    );
  }
  const low = time !== 'day';
  return (
    <g transform={`translate(${(low ? -330 : 560) + o} ${low ? 90 : -300})`}>
      <circle r={low ? 230 : 160} fill="#ffd27a" opacity={0.16} />
      <circle r={low ? 140 : 96} fill="#ffd27a" opacity={0.24} />
      <circle r={low ? 88 : 62} fill="#ffe29a" />
    </g>
  );
}

function Bedroom({ time, frame, fps, drift }: SettingProps) {
  const sky = SKY[time];
  const lamp = time === 'night' || time === 'dusk' || time === 'dawn';
  return (
    <g>
      {/* parede e piso */}
      {rect(-W2, -H2, STAGE.width, 760, mixHex(sky.top, '#2a2140', 0.55))}
      {rect(-W2, 220, STAGE.width, 320, '#1a1426')}
      {rect(-W2, 214, STAGE.width, 10, '#0d0a16')}
      {/* janela com céu e cidade */}
      <g transform={`translate(${-430 + drift * 0.15} -250)`}>
        <clipPath id="bed-win"><rect width={330} height={340} /></clipPath>
        <g clipPath="url(#bed-win)">
          {rect(0, 0, 330, 340, sky.bottom)}
          {rect(0, 0, 330, 170, sky.top)}
          <circle cx={240} cy={70} r={34} fill="#f4efd6" opacity={time === 'night' ? 1 : 0.5} />
          <Skyline seed={7} base={330} min={50} max={130} color="#0b1030" windows offset={drift * 0.3} />
        </g>
        <rect width={330} height={340} fill="none" stroke="#e9e4f0" strokeWidth={14} />
        <line x1={165} y1={0} x2={165} y2={340} stroke="#e9e4f0" strokeWidth={9} />
        <line x1={0} y1={170} x2={330} y2={170} stroke="#e9e4f0" strokeWidth={9} />
        {rect(-22, 336, 374, 18, '#e9e4f0')}
      </g>
      {/* luar entrando pela janela no chão */}
      <path d="M -430 330 L -100 330 L 120 540 L -520 540 Z" fill="#cfe0ff" opacity={0.05} />
      {/* cama */}
      <g>
        {rect(-120, 120, 740, 120, '#3a3466', { rx: 16 })}
        {rect(560, 40, 60, 230, '#2a2450', { rx: 10 })}
        {rect(-120, 218, 740, 36, '#241f46', { rx: 10 })}
        {rect(470, 110, 130, 54, '#e9e4f0', { rx: 22 })}
        {rect(-120, 150, 560, 70, '#e2574c', { rx: 18, opacity: 0.9 })}
        {rect(-90, 160, 480, 12, '#ffffff', { rx: 6, opacity: 0.2 })}
      </g>
      {/* mesa e abajur */}
      <g transform="translate(-860 0)">
        {rect(0, 130, 280, 18, '#241f46', { rx: 6 })}
        {rect(18, 148, 14, 150, '#241f46')}
        {rect(248, 148, 14, 150, '#241f46')}
        {rect(40, 80, 120, 50, '#10162e', { rx: 6 })}
        {rect(46, 86, 108, 38, mixHex('#6ee7f9', '#10162e', 0.4), { rx: 4 })}
        <rect x={190} y={90} width={8} height={40} fill="#cfd6ff" />
        <path d="M 170 90 L 218 90 L 206 60 L 182 60 Z" fill={lamp ? '#ffd98a' : '#8d86a8'} />
        {lamp ? <circle cx={194} cy={96} r={150} fill="#ffd98a" opacity={0.12 + 0.02 * Math.sin((frame / fps) * 3)} /> : null}
      </g>
      {/* quadro na parede */}
      <g transform="translate(260 -240)">
        {rect(0, 0, 150, 190, '#e9e4f0', { rx: 6 })}
        {rect(14, 14, 122, 150, mixHex(sky.bottom, '#6ee7f9', 0.3))}
        <path d="M 14 164 L 60 100 L 90 140 L 110 112 L 136 164 Z" fill="#0b1030" opacity={0.7} />
      </g>
      <ellipse cx={-120} cy={430} rx={420} ry={60} fill="#3a2f66" opacity={0.55} />
    </g>
  );
}

function Street({ time, weather, frame, fps, drift, seed }: SettingProps) {
  const sky = SKY[time];
  const night = sky.lit;
  const far = mixHex(sky.bottom, '#06091c', 0.62);
  const mid = mixHex(sky.bottom, '#04060f', 0.8);
  return (
    <g>
      <Skyline seed={seed + 1} base={140} min={140} max={340} color={far} windows={night} offset={drift * 0.2} />
      <Skyline seed={seed + 2} base={230} min={120} max={300} color={mid} windows={night} offset={drift * 0.5} />
      {rect(-W2, 214, STAGE.width, 48, '#1b2036')}
      {rect(-W2, 262, STAGE.width, 280, '#0e111d')}
      {rect(-W2, 258, STAGE.width, 6, '#2a3150')}
      {Array.from({ length: 9 }, (_, i) => rect(-W2 + ((i * 260 + drift) % (STAGE.width + 260)) - 130, 410, 130, 10, '#e9e4f0', { opacity: 0.55, key: i }))}
      {/* postes */}
      {[-640, 100, 760].map((x, i) => {
        const px = x + drift * 0.9;
        return (
          <g key={i} transform={`translate(${px} 0)`}>
            {rect(-6, -150, 12, 400, '#0a0d1a')}
            <path d="M -6 -150 q 0 -26 40 -26 h 30" stroke="#0a0d1a" strokeWidth={10} fill="none" strokeLinecap="round" />
            <rect x={56} y={-182} width={46} height={16} rx={6} fill={night ? '#ffe9b8' : '#8d86a8'} />
            {night ? <circle cx={79} cy={-160} r={170} fill="#ffd98a" opacity={0.1 + 0.012 * Math.sin((frame / fps) * 4 + i)} /> : null}
            {night && weather === 'rain' ? <ellipse cx={79} cy={330} rx={60} ry={90} fill="#ffd98a" opacity={0.12} /> : null}
          </g>
        );
      })}
    </g>
  );
}

function Rooftop({ time, frame, fps, drift, seed }: SettingProps) {
  const sky = SKY[time];
  const night = sky.lit;
  return (
    <g>
      <Skyline seed={seed + 3} base={420} min={120} max={420} color={mixHex(sky.bottom, '#06091c', 0.55)} windows={night} offset={drift * 0.2} />
      <Skyline seed={seed + 4} base={540} min={80} max={300} color={mixHex(sky.bottom, '#03050d', 0.78)} windows={night} offset={drift * 0.45} />
      {rect(-W2, 250, STAGE.width, 300, '#10131f')}
      {rect(-W2, 236, STAGE.width, 26, '#2a3050')}
      {Array.from({ length: 24 }, (_, i) => rect(-W2 + i * 90, 236, 3, 26, '#0a0d18', { key: i }))}
      {rect(-W2, 262, STAGE.width, 8, '#0a0d18')}
      <g transform={`translate(${620 + drift * 0.9} 0)`}>
        {rect(0, 130, 160, 120, '#1c2138', { rx: 8 })}
        {rect(18, 90, 124, 44, '#232946', { rx: 6 })}
        <circle cx={80} cy={100 + Math.sin((frame / fps) * 2) * 2} r={10} fill="#ff5555" opacity={0.9} />
      </g>
    </g>
  );
}

function Park({ time, frame, fps, drift, seed }: SettingProps) {
  const sky = SKY[time];
  const lit = sky.lit;
  const grass = mixHex(sky.bottom, '#12351f', 0.7);
  const trees = [-720, -330, 560, 880];
  return (
    <g>
      <path d={`M -960 120 C -600 20, -300 140, 0 70 S 600 10, 960 100 L 960 540 L -960 540 Z`} fill={mixHex(grass, sky.bottom, 0.25)} transform={`translate(${drift * 0.15} 0)`} />
      {trees.map((x, i) => (
        <g key={i} transform={`translate(${x + drift * (0.35 + i * 0.05)} 0)`}>
          {rect(-14, 10, 28, 250, '#2a1d1a', { rx: 6 })}
          <circle cx={0} cy={-30} r={120} fill={mixHex(grass, '#06140c', 0.35)} />
          <circle cx={-70} cy={20} r={84} fill={mixHex(grass, '#06140c', 0.45)} />
          <circle cx={74} cy={14} r={88} fill={mixHex(grass, '#06140c', 0.3)} />
        </g>
      ))}
      {rect(-W2, 258, STAGE.width, 300, grass)}
      <path d="M -300 540 C -200 380, 100 330, 520 258 L 640 258 C 300 340, 40 420, -60 540 Z" fill="#c9b68f" opacity={0.28} />
      {/* banco */}
      <g transform="translate(-60 0)">
        {rect(-130, 214, 260, 18, '#6b4a30', { rx: 4 })}
        {rect(-130, 150, 260, 14, '#6b4a30', { rx: 4 })}
        {rect(-130, 176, 260, 14, '#6b4a30', { rx: 4 })}
        {rect(-118, 230, 14, 60, '#1b1420')}
        {rect(104, 230, 14, 60, '#1b1420')}
      </g>
      {/* poste de luz */}
      <g transform={`translate(${480 + drift * 0.9} 0)`}>
        {rect(-6, -60, 12, 320, '#0a0d1a')}
        <circle cx={0} cy={-76} r={20} fill={lit ? '#ffe9b8' : '#8d86a8'} />
        {lit ? <circle cx={0} cy={-76} r={170} fill="#ffd98a" opacity={0.11 + 0.012 * Math.sin((frame / fps) * 3 + seed)} /> : null}
      </g>
    </g>
  );
}

function Shore({ time, frame, fps, drift }: SettingProps) {
  const sky = SKY[time];
  const t = frame / fps;
  const sea = mixHex(sky.bottom, '#06204a', 0.7);
  const wave = (offset: number, amp: number, y: number, color: string, speed: number) => {
    const points = Array.from({ length: 41 }, (_, i) => {
      const x = -W2 + (STAGE.width * i) / 40;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y + Math.sin(x * 0.012 + t * speed + offset) * amp}`;
    }).join(' ');
    return <path d={`${points} L ${W2} 400 L ${-W2} 400 Z`} fill={color} />;
  };
  return (
    <g>
      {rect(-W2, 40, STAGE.width, 340, sea)}
      {/* reflexo do astro */}
      <g opacity={0.35} transform={`translate(${(time === 'night' ? 520 : time === 'day' ? 560 : -330) + drift * 0.05} 0)`}>
        {Array.from({ length: 9 }, (_, i) => rect(-50 + i * 4, 70 + i * 28, 100 - i * 8, 8, time === 'night' ? '#f4efd6' : '#ffe29a', { rx: 4, opacity: 1 - i * 0.09, key: i }))}
      </g>
      {wave(0, 6, 120, mixHex(sea, '#fff', 0.06), 0.9)}
      {wave(2, 9, 180, mixHex(sea, '#fff', 0.1), 1.2)}
      {wave(4, 12, 240, mixHex(sea, '#fff', 0.16), 1.5)}
      {/* areia */}
      <path d="M -960 300 C -500 270, 200 330, 960 290 L 960 540 L -960 540 Z" fill={mixHex('#d9c39a', sky.top, time === 'day' ? 0.05 : 0.55)} />
      <path d="M -960 300 C -500 270, 200 330, 960 290" stroke="#fff" strokeWidth={6} fill="none" opacity={0.3 + 0.15 * Math.sin(t * 1.5)} />
    </g>
  );
}

function Hills({ time, frame, fps, drift, seed }: SettingProps) {
  const sky = SKY[time];
  const t = frame / fps;
  const tone = (k: number) => mixHex(sky.bottom, '#12261f', k);
  const bird = (x: number, y: number, s: number, i: number) => (
    <path key={i} d={`M ${x - 18 * s} ${y} q ${9 * s} ${-12 * s + Math.sin(t * 7 + i) * 5 * s} ${18 * s} 0 q ${9 * s} ${-12 * s - Math.sin(t * 7 + i) * 5 * s} ${18 * s} 0`} fill="none" stroke="#0b0f1a" strokeWidth={3 * s} strokeLinecap="round" />
  );
  return (
    <g>
      <path d="M -960 120 C -520 20, -160 140, 160 60 S 700 0, 960 90 L 960 540 L -960 540 Z" fill={tone(0.45)} transform={`translate(${drift * 0.15} 0)`} />
      <path d="M -960 200 C -600 110, -240 230, 120 150 S 640 100, 960 190 L 960 540 L -960 540 Z" fill={tone(0.62)} transform={`translate(${drift * 0.4} 0)`} />
      <path d="M -960 300 C -560 240, -200 330, 160 270 S 640 230, 960 300 L 960 540 L -960 540 Z" fill={tone(0.8)} transform={`translate(${drift * 0.8} 0)`} />
      {[0, 1, 2, 3].map((i) => bird(-300 + ((i * 190 + t * 40) % 900), -190 + i * 34 + Math.sin(t + i) * 8, 1 + (i % 2) * 0.4, i + seed))}
      {Array.from({ length: 36 }, (_, i) => {
        const x = -W2 + ((i * 97 + seed * 13) % STAGE.width);
        return <path key={i} d={`M ${x} 540 q ${wobble(Math.round(t * 30), fps, `g${i}`, 5, 0.6)} -40 ${6 + (i % 3) * 3} -${46 + (i % 5) * 8}`} stroke={tone(0.9)} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />;
      })}
    </g>
  );
}

function WindowSetting({ time, frame, fps, drift, seed }: SettingProps) {
  const sky = SKY[time];
  const t = frame / fps;
  const random = mulberry32(seed + 5);
  return (
    <g>
      {rect(-W2, -H2, STAGE.width, STAGE.height, '#07091a')}
      {/* luzes da cidade desfocadas atrás do vidro */}
      {Array.from({ length: 34 }, (_, i) => {
        const x = (random() - 0.5) * 1500 + drift * 0.3;
        const y = -80 + random() * 380;
        const r = 14 + random() * 38;
        return <circle key={i} cx={x} cy={y} r={r} fill={['#ffd98a', '#7c93ff', '#ff6b8a', '#9dffce'][i % 4]} opacity={0.2 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.3 + i))} />;
      })}
      <rect x={-600} y={-420} width={1200} height={760} fill="none" stroke="#0c0f20" strokeWidth={48} />
      <line x1={0} y1={-420} x2={0} y2={340} stroke="#0c0f20" strokeWidth={30} />
      {/* gotas escorrendo no vidro */}
      {Array.from({ length: 26 }, (_, i) => {
        const x = -560 + random() * 1120;
        const speed = 40 + random() * 120;
        const y = -400 + ((t * speed + random() * 700) % 740);
        return <path key={i} d={`M ${x} ${y} q -6 20 0 30 q 6 -10 0 -30 z`} fill="#bfe6ff" opacity={0.55} />;
      })}
      {rect(-W2, 340, STAGE.width, 200, '#0c0f20')}
      {rect(-W2, 330, STAGE.width, 14, '#1c2140')}
      {/* o cenário só dá um tom para a cena combinar com o horário */}
      <rect x={-W2} y={-H2} width={STAGE.width} height={STAGE.height} fill={sky.tint} opacity={0.05} />
    </g>
  );
}

const BY_SETTING: Record<SettingId, React.FC<SettingProps>> = {
  bedroom: Bedroom,
  street: Street,
  rooftop: Rooftop,
  park: Park,
  shore: Shore,
  hills: Hills,
  window: WindowSetting,
};

/** Cenário completo: céu do horário, astro, estrelas e o cenário escolhido. */
export const Setting: React.FC<SettingProps> = (props) => {
  const { setting, time, frame, fps, drift } = props;
  const sky = SKY[time];
  const Scene = BY_SETTING[setting];
  const id = `sky-${time}`;
  const indoor = setting === 'bedroom' || setting === 'window';
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky.top} />
          <stop offset="100%" stopColor={sky.bottom} />
        </linearGradient>
      </defs>
      {!indoor ? (
        <>
          <rect x={-W2} y={-H2} width={STAGE.width} height={STAGE.height} fill={`url(#${id})`} />
          {sky.lit && time !== 'dusk' ? <Stars seed={props.seed} frame={frame} fps={fps} dim={time === 'night' ? 1 : 0.4} /> : null}
          <Celestial time={time} drift={drift} />
        </>
      ) : null}
      <Scene {...props} />
    </g>
  );
};

/** Chuva e neblina por cima de tudo. */
export const Weather: React.FC<{ weather: WeatherId; frame: number; fps: number; seed: number }> = ({ weather, frame, fps, seed }) => {
  const t = frame / fps;
  if (weather === 'clear') return null;
  if (weather === 'fog') {
    const x = loopProgress(frame, fps, 30, true);
    return (
      <g>
        <rect x={-W2} y={80} width={STAGE.width} height={300} fill="#cfd8ff" opacity={0.1 + 0.05 * x} />
        <rect x={-W2} y={200} width={STAGE.width} height={340} fill="#cfd8ff" opacity={0.12} />
      </g>
    );
  }
  const random = mulberry32(seed + 31);
  return (
    <g>
      {Array.from({ length: 130 }, (_, i) => {
        const x = -W2 - 100 + random() * (STAGE.width + 200);
        const speed = 900 + random() * 700;
        const y = -H2 + ((t * speed + random() * 1200) % (STAGE.height + 120)) - 60;
        const len = 26 + random() * 30;
        return <line key={i} x1={x} y1={y} x2={x - len * 0.32} y2={y + len} stroke="#bfd8ff" strokeWidth={2.4} opacity={0.35 + 0.25 * random()} />;
      })}
      <rect x={-W2} y={-H2} width={STAGE.width} height={STAGE.height} fill="#0a1230" opacity={0.18} />
    </g>
  );
};
