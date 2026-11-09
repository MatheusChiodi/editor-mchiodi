import type { Shot } from '../types';
import { mixHex } from '../visuals';
import { Character, DEFAULT_COLORS } from './Character';
import { handPositions, rig } from './rig';
import { isSeated, Setting, SKY, STAGE, stageSpot, Weather } from './Settings';

export interface StoryShotProps {
  shot: Shot;
  /** quadros desde o começo da cena */
  frame: number;
  fps: number;
  /** 0–1 ao longo da cena */
  progress: number;
  /** cor de destaque da seção: tinge a roupa do personagem de leve */
  accent: string;
  pulse: number;
  seed: number;
}

const OUTLINE = DEFAULT_COLORS.outline;

/** Objeto na mão do personagem: celular aceso, foto, flor. O guarda-chuva fica sobre a cabeça. */
function Prop({ id, hand, t, pulse }: { id: Shot['props'][number]; hand: { x: number; y: number }; t: number; pulse: number }) {
  switch (id) {
    case 'phone':
      return (
        <g transform={`translate(${hand.x} ${hand.y}) rotate(-12)`}>
          <circle cx={-6} cy={-30} r={64} fill="#9fe8ff" opacity={0.16 + 0.05 * pulse} />
          <rect x={-10} y={-34} width={22} height={36} rx={4} fill="#0b0f1a" stroke="#cfe0ff" strokeWidth={2.5} />
          <rect x={-7} y={-31} width={16} height={29} rx={2} fill={`hsl(${190 + Math.sin(t * 2) * 8} 90% 70%)`} />
        </g>
      );
    case 'photo':
      return (
        <g transform={`translate(${hand.x} ${hand.y}) rotate(-8)`}>
          <rect x={-14} y={-38} width={30} height={38} rx={2} fill="#f8f8f2" stroke={OUTLINE} strokeWidth={2.5} />
          <rect x={-10} y={-34} width={22} height={24} fill="#d9a066" />
          <circle cx={-2} cy={-26} r={5} fill="#f0c29b" />
        </g>
      );
    case 'flower':
      return (
        <g transform={`translate(${hand.x} ${hand.y})`}>
          <line x1={0} y1={0} x2={4} y2={-46} stroke="#2e8b57" strokeWidth={4} strokeLinecap="round" />
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} cx={4} cy={-60} rx={7} ry={11} fill="#ff6b8a" stroke={OUTLINE} strokeWidth={1.8} transform={`rotate(${angle} 4 -50)`} />
          ))}
          <circle cx={4} cy={-50} r={5} fill="#ffd27a" />
        </g>
      );
    default:
      return null;
  }
}

/**
 * Plano da história: cenário do horário, personagem com a pose e o humor do momento, objeto na mão e chuva por cima.
 * Em "andar", o personagem atravessa o quadro enquanto o cenário corre para trás (parallax).
 */
export const StoryShot: React.FC<StoryShotProps> = ({ shot, frame, fps, progress, accent, pulse, seed }) => {
  const t = frame / fps;
  const spot = stageSpot(shot.setting);
  const seated = isSeated(shot.setting, shot.pose);
  const walking = shot.pose === 'walk';
  const drift = walking ? -(progress - 0.5) * 520 : -(progress - 0.5) * 70;
  const sky = SKY[shot.time];

  let figure: React.ReactNode = null;
  if (spot) {
    const joints = rig(shot.pose, shot.mood, t, { seated, seed });
    const x = spot.x + (walking ? (progress - 0.5) * 260 : 0);
    const hipY = spot.ground - 112 * spot.scale;
    const hands = handPositions(joints);
    const colors = { ...DEFAULT_COLORS, shirt: mixHex('#e2574c', accent, 0.22) };
    const handProps = shot.props.filter((id) => id !== 'umbrella' && id !== 'lamp');
    figure = (
      <g>
        <ellipse cx={x} cy={spot.ground + 6} rx={78 * spot.scale} ry={11 * spot.scale} fill="#000" opacity={0.38} />
        <g transform={`translate(${x} ${hipY}) scale(${spot.scale})`}>
          <Character joints={joints} t={t} colors={colors} back={shot.pose === 'back'} />
          {handProps.map((id) => (
            <Prop key={id} id={id} hand={hands.r} t={t} pulse={pulse} />
          ))}
          {shot.props.includes('umbrella') ? (
            <g>
              <line x1={10} y1={-168} x2={hands.r.x} y2={hands.r.y} stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
              <path d="M -100 -168 Q 10 -270 120 -168 Q 70 -190 10 -168 Q -50 -190 -100 -168 Z" fill="#4a6cf7" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
            </g>
          ) : null}
        </g>
      </g>
    );
  }

  return (
    <g>
      <Setting setting={shot.setting} time={shot.time} weather={shot.weather} frame={frame} fps={fps} drift={drift} seed={seed} />
      {figure}
      <Weather weather={shot.weather} frame={frame} fps={fps} seed={seed} />
      <rect x={-STAGE.width / 2} y={-STAGE.height / 2} width={STAGE.width} height={STAGE.height} fill={sky.tint} opacity={0.07} />
    </g>
  );
};
