import { FOREARM, type Joints, SHIN, shoulderPosition, THIGH, UPPER_ARM } from './rig';

export interface CharacterColors {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  outline: string;
}

export const DEFAULT_COLORS: CharacterColors = {
  skin: '#f0c29b',
  hair: '#1f1410',
  shirt: '#e2574c',
  pants: '#27325a',
  shoes: '#10141f',
  outline: '#0b0f1a',
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const point = (origin: { x: number; y: number }, angle: number, length: number) => ({ x: origin.x + Math.sin(rad(angle)) * length, y: origin.y + Math.cos(rad(angle)) * length });

interface LimbProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  width: number;
  color: string;
  outline: string;
}

/** Segmento de membro com contorno grosso: o traço de "desenho" do personagem. */
const Limb: React.FC<LimbProps> = ({ from, to, width, color, outline }) => (
  <>
    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={outline} strokeWidth={width + 7} strokeLinecap="round" />
    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={width} strokeLinecap="round" />
  </>
);

export interface CharacterProps {
  joints: Joints;
  /** segundos desde o começo do plano (anima a lágrima) */
  t: number;
  colors?: CharacterColors;
  /** de costas: sem rosto, cabelo cobrindo a cabeça */
  back?: boolean;
}

/**
 * Personagem em perfil, de frente para a direita, origem no quadril. Camadas de trás para a frente: braço e perna do
 * fundo (mais escuros), tronco, perna da frente, cabeça e braço da frente. O rosto reage ao humor: olhar, piscada,
 * sobrancelha, boca e lágrima.
 */
export const Character: React.FC<CharacterProps> = ({ joints: j, t, colors = DEFAULT_COLORS, back = false }) => {
  const c = colors;
  const hip = { x: 0, y: j.bodyY };
  const shoulder = shoulderPosition(j);
  const dark = (color: string) => color; // o fundo é escurecido por opacidade, não por cor, para não depender da paleta

  const arm = (pair: [number, number], far: boolean) => {
    const elbow = point(shoulder, pair[0] + j.torsoTilt, UPPER_ARM);
    const hand = point(elbow, pair[0] + pair[1] + j.torsoTilt, FOREARM);
    return (
      <g opacity={far ? 0.78 : 1}>
        <Limb from={shoulder} to={elbow} width={17} color={dark(c.shirt)} outline={c.outline} />
        <Limb from={elbow} to={hand} width={14} color={c.skin} outline={c.outline} />
        <circle cx={hand.x} cy={hand.y} r={9} fill={c.skin} stroke={c.outline} strokeWidth={3} />
      </g>
    );
  };

  const leg = (pair: [number, number], far: boolean) => {
    const knee = point(hip, pair[0], THIGH);
    const foot = point(knee, pair[0] - pair[1], SHIN);
    return (
      <g opacity={far ? 0.8 : 1}>
        <Limb from={hip} to={knee} width={21} color={c.pants} outline={c.outline} />
        <Limb from={knee} to={foot} width={18} color={c.pants} outline={c.outline} />
        <path d={`M ${foot.x - 10} ${foot.y - 4} q 4 -6 14 -4 q 16 2 20 10 q 0 8 -10 8 h -22 q -8 0 -2 -14 z`} fill={c.shoes} stroke={c.outline} strokeWidth={3} strokeLinejoin="round" />
      </g>
    );
  };

  // eixo da cabeça: pescoço acima do ombro, inclinado com o tronco
  const neck = { x: shoulder.x + Math.sin(rad(j.torsoTilt)) * 6, y: shoulder.y - Math.cos(rad(j.torsoTilt)) * 6 };
  const angry = j.brow <= -0.95 && j.mouth > -0.5;
  const eyeOpen = 1 - j.eyesClosed * 0.92;
  const innerBrow = angry ? 5 * -j.brow : j.brow < 0 ? j.brow * 5 : 0;
  const browLift = j.brow > 0 ? -j.brow * 5 : 0;
  const teardrop = ((t * 38) % 40) / 40;

  return (
    <g strokeLinejoin="round">
      {arm(j.lArm, true)}
      {leg(j.lLeg, true)}

      {/* tronco */}
      <g transform={`translate(${hip.x} ${hip.y}) rotate(${j.torsoTilt})`}>
        <path d="M -30 -66 Q -34 -72 -22 -74 H 24 Q 36 -72 32 -62 L 30 -4 Q 28 8 14 8 H -14 Q -30 8 -30 -6 Z" fill={c.shirt} stroke={c.outline} strokeWidth={3.5} />
        <path d="M -8 -74 Q 0 -60 10 -74" fill="none" stroke={c.outline} strokeWidth={3} opacity={0.5} />
      </g>

      {leg(j.rLeg, false)}

      {/* cabeça */}
      <g transform={`translate(${neck.x} ${neck.y}) rotate(${j.headTilt})`}>
        <rect x={-9} y={-12} width={18} height={20} rx={7} fill={c.skin} stroke={c.outline} strokeWidth={3} />
        <g transform="translate(4 -40)">
          {/* cabelo de trás */}
          <path d="M -34 -4 Q -42 40 -22 58 Q -10 42 -8 8 Z" fill={c.hair} stroke={c.outline} strokeWidth={3} />
          <circle r={33} fill={back ? c.hair : c.skin} stroke={c.outline} strokeWidth={3.5} />
          {back ? (
            <path d="M -33 4 Q -30 -40 4 -37 Q 34 -34 33 6 Q 20 -8 0 -10 Q -20 -8 -33 4 Z M -33 4 Q -30 34 0 35 Q 30 34 33 6" fill={c.hair} stroke={c.outline} strokeWidth={2.5} />
          ) : (
            <>
              {/* orelha */}
              <ellipse cx={-8} cy={4} rx={6} ry={9} fill={c.skin} stroke={c.outline} strokeWidth={2.5} />
              {/* olho */}
              <ellipse cx={14 + j.gaze[0] * 2.5} cy={-2 + j.gaze[1] * 3} rx={7.5} ry={9 * eyeOpen + 0.8} fill="#fff" stroke={c.outline} strokeWidth={2.5} />
              <circle cx={15.5 + j.gaze[0] * 4} cy={-2 + j.gaze[1] * 5} r={3.8 * Math.min(1, eyeOpen + 0.2)} fill={c.outline} />
              {/* sobrancelha */}
              <path d={`M 6 ${-17 + innerBrow + browLift} L 23 ${-18 + browLift - (angry ? -3 : j.brow < 0 ? -j.brow * 2 : 0)}`} stroke={c.outline} strokeWidth={4} strokeLinecap="round" fill="none" />
              {/* nariz */}
              <path d="M 31 2 q 6 4 0 8" fill="none" stroke={c.outline} strokeWidth={2.8} strokeLinecap="round" />
              {/* boca */}
              <path d={`M 12 19 Q 20 ${19 + j.mouth * 9} 28 18`} fill={j.mouth > 0.5 ? '#fff' : 'none'} stroke={c.outline} strokeWidth={3} strokeLinecap="round" />
              {/* bochecha corada quando chora ou sorri */}
              {j.tear > 0 || j.mouth > 0.5 ? <ellipse cx={6} cy={14} rx={7} ry={4} fill="#ff7b7b" opacity={0.35} /> : null}
              {j.tear > 0
                ? [0, 0.5].map((offset) => {
                    const p = (teardrop + offset) % 1;
                    return <path key={offset} d={`M ${16 + p * 4} ${8 + p * 30} q -4 7 0 9 q 4 -2 0 -9 z`} fill="#8fd3ff" opacity={1 - p} stroke="#5aaee0" strokeWidth={1} />;
                  })
                : null}
            </>
          )}
          {/* cabelo da frente */}
          <path d={back ? 'M 0 0' : 'M -34 2 Q -36 -38 4 -37 Q 36 -34 33 -8 Q 22 -22 6 -18 Q -10 -14 -16 6 Q -26 -4 -34 2 Z'} fill={c.hair} stroke={c.outline} strokeWidth={3} />
        </g>
      </g>

      {arm(j.rArm, false)}
    </g>
  );
};
