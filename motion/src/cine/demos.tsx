import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { theme } from '../theme';
import { Camera, Layer } from './Camera';
import { brandRamp, mix } from './color';
import { Halation, KeyLight, LightSweep, Shadowed, Vignette } from './Light';
import type { MaskSpec } from './mask-math';
import { MaskReveal, TornReveal, WordMask } from './Masks';
import { MotionBlur, Smear } from './MotionBlur';
import { ANTICIPATION, cineSpring, type SpringPreset, springProgress, SPRINGS, velocityAt } from './spring';
import { Boil, FilmGrain, PaperGrain, PaperSheet } from './Texture';
import { handStroke, smoothPath } from './texture-math';
import { staggerDelays } from './timeline';

// Demonstrações do kit no Studio (pasta "Cinema"). Cada uma isola UMA peça, com a versão "sem" ao lado quando
// a comparação ensina. Não são componentes de EDL: servem para ver, medir custo e copiar o uso.

const label: React.CSSProperties = { fontFamily: theme.font.body, fontWeight: 600, fontSize: 30, letterSpacing: '0.08em', color: theme.color.slate600 };
const title: React.CSSProperties = { fontFamily: theme.font.display, fontWeight: 600, fontSize: 64, color: theme.color.ink };

const Stage: React.FC<{ children: React.ReactNode; grain?: boolean }> = ({ children, grain = true }) => (
  <AbsoluteFill style={{ background: brandRamp('paper', 0.4) }}>
    <KeyLight intensity={0.7} />
    <PaperGrain opacity={0.5} />
    {children}
    <Vignette strength={0.26} />
    {grain ? <FilmGrain opacity={0.45} /> : null}
  </AbsoluteFill>
);

const Card: React.FC<{ text: string; width?: number; elevation?: number; velocity?: { x: number; y: number } }> = ({ text, width = 330, elevation = 10, velocity }) => (
  <PaperSheet width={width} height={96} thickness={4} radius={48} elevation={elevation} velocity={velocity} color={theme.color.white}>
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font.body, fontWeight: 600, fontSize: 36, color: theme.color.ink }}>{text}</div>
  </PaperSheet>
);

/** As quatro molas lado a lado, com antecipação, borrão e sombra que reage. Ida aos 0,3 s e volta aos 2,6 s. */
const SpringsDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const names = Object.keys(SPRINGS) as SpringPreset[];
  return (
    <Stage>
      {names.map((name, index) => {
        const x = (f: number): number =>
          cineSpring(f, fps, { delay: 9, from: 0, to: 1100, spring: name, anticipation: ANTICIPATION }) - cineSpring(f, fps, { delay: 78, from: 0, to: 1100, spring: name, anticipation: ANTICIPATION });
        const v = velocityAt(x, frame);
        return (
          <div key={name} style={{ position: 'absolute', left: 140, top: 130 + index * 220 }}>
            <div style={label}>{name.toUpperCase()}</div>
            <div style={{ position: 'absolute', left: 280, top: 70, width: 1430, height: 2, background: theme.color.slate300 }} />
            <div style={{ position: 'absolute', left: 280, top: 22, translate: `${x(frame).toFixed(2)}px 0` }}>
              <Smear velocity={{ x: v, y: 0 }}>
                <Card text={name} elevation={8 + Math.abs(v) * 0.9} velocity={{ x: v, y: 0 }} />
              </Smear>
            </div>
          </div>
        );
      })}
    </Stage>
  );
};

/** O mesmo cartão cruzando a tela: sem borrão, com `Smear` e com `MotionBlur`. Pause no meio para comparar. */
const BlurDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const x = (f: number): number => cineSpring(f, fps, { delay: 8, from: -500, to: 1250, spring: 'firme' });
  const rotation = (f: number): number => (1 - springProgress(f, fps, { delay: 8, spring: 'firme' })) * -24;
  const v = velocityAt(x, frame);
  const rows = ['sem borrão', 'Smear (direcional)', 'MotionBlur (subframes)'];
  const card = (f: number): React.ReactNode => (
    <div style={{ position: 'absolute', left: 120, top: 70, translate: `${x(f).toFixed(2)}px 0`, rotate: `${rotation(f).toFixed(2)}deg` }}>
      <Card text="MChiodi Cinema" width={480} />
    </div>
  );
  return (
    <Stage>
      {rows.map((text, index) => (
        <div key={text} style={{ position: 'absolute', left: 0, top: 80 + index * 310, width: 1920, height: 300 }}>
          <div style={{ ...label, position: 'absolute', left: 120, top: 0 }}>{text.toUpperCase()}</div>
          {index === 0 ? card(frame) : null}
          {index === 1 ? (
            <div style={{ position: 'absolute', left: 120, top: 70, translate: `${x(frame).toFixed(2)}px 0` }}>
              <Smear velocity={{ x: v, y: 0 }}>
                <div style={{ rotate: `${rotation(frame).toFixed(2)}deg` }}>
                  <Card text="MChiodi Cinema" width={480} />
                </div>
              </Smear>
            </div>
          ) : null}
          {index === 2 ? (
            <MotionBlur velocity={{ x: v, y: 0 }} samples={10}>
              {card}
            </MotionBlur>
          ) : null}
        </div>
      ))}
    </Stage>
  );
};

/** Cinco planos numerados: dolly-in, truck e rack focus do fundo ao primeiro plano. */
const CameraDemo: React.FC = () => {
  const depths = [1600, 800, 0, -350, -620];
  return (
    <AbsoluteFill style={{ background: brandRamp('paper', 0.4) }}>
      <Camera
        shake
        keyframes={[
          { frame: 0, x: -260, z: -500, focus: 1600, aperture: 16, roll: 1.5 },
          { frame: 50, x: 0, z: 0, roll: 0, ease: 'pesada' },
          { frame: 60, focus: 1600 },
          { frame: 95, focus: 0 },
          { frame: 130, focus: 0, x: 0 },
          { frame: 165, focus: -620, x: 240 },
          { frame: 210, x: -120, z: 260, focus: 0 },
        ]}
      >
        <Layer depth={2600} bleed={400} dof={false}>
          <KeyLight intensity={0.7} />
          <PaperGrain opacity={0.5} />
        </Layer>
        {depths.map((depth, index) => (
          <Layer key={depth} depth={depth}>
            <div style={{ position: 'absolute', left: 250 + index * 300, top: 180 + ((index * 170) % 520), rotate: `${(index - 2) * 4}deg` }}>
              <PaperSheet width={430} height={300} thickness={5} torn={{ bottom: true }} seed={index + 2} elevation={18} color={index === 2 ? theme.color.paper : brandRamp('paper', 0.2 + index * 0.18)}>
                <div style={{ padding: 34 }}>
                  <div style={label}>PROFUNDIDADE</div>
                  <div style={{ ...title, color: index === 2 ? theme.color.coral : theme.color.ink }}>{depth}</div>
                </div>
              </PaperSheet>
            </div>
          </Layer>
        ))}
      </Camera>
      <Vignette strength={0.28} />
      <FilmGrain opacity={0.45} />
    </AbsoluteFill>
  );
};

/** Luz: varredura no impacto, sombra que acompanha a altura, halation no acento e a versão chapada ao lado. */
const LightDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lift = (f: number): number => Math.sin((f / fps) * 1.6) * 0.5 + 0.5;
  const elevation = 6 + lift(frame) * 90;
  const y = -lift(frame) * 46;
  const body = (
    <div style={{ width: 620, height: 380, padding: 48, boxSizing: 'border-box' }}>
      <div style={label}>LUZ MOTIVADA</div>
      <div style={{ ...title, marginTop: 18 }}>
        Nada <span style={{ fontStyle: 'italic', color: theme.color.coral }}>chapado.</span>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: brandRamp('paper', 0.4) }}>
      <AbsoluteFill style={{ clipPath: 'inset(0 50% 0 0)', background: theme.color.paper }}>
        <div style={{ ...label, position: 'absolute', left: 120, top: 90 }}>HOJE</div>
        <div style={{ position: 'absolute', left: 170, top: 330, background: theme.color.white, borderRadius: 24, boxShadow: theme.shadow.card }}>{body}</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ clipPath: 'inset(0 0 0 50%)' }}>
        <KeyLight intensity={0.75} />
        <PaperGrain opacity={0.5} />
        <div style={{ ...label, position: 'absolute', left: 1080, top: 90 }}>CINEMA</div>
        <div style={{ position: 'absolute', left: 1130, top: 330, translate: `0 ${y.toFixed(2)}px` }}>
          <PaperSheet width={620} height={380} thickness={6} elevation={elevation} velocity={{ x: 0, y: velocityAt((f) => -lift(f) * 46, frame) }} color={theme.color.paper} shading={0.8}>
            <LightSweep at={20} duration={22} intensity={0.9} color="#fffaf0" style={{ width: '100%', height: '100%' }}>
              <div style={{ padding: 48 }}>
                <div style={label}>LUZ MOTIVADA</div>
                <div style={{ ...title, marginTop: 18 }}>
                  Nada{' '}
                  <Halation radius={18} strength={0.5}>
                    <span style={{ fontStyle: 'italic', color: theme.color.coral }}>chapado.</span>
                  </Halation>
                </div>
              </div>
            </LightSweep>
          </PaperSheet>
        </div>
        <div style={{ position: 'absolute', left: 1130, top: 800 }}>
          <Shadowed elevation={interpolate(lift(frame), [0, 1], [4, 40])} radius={48}>
            <div style={{ padding: '22px 44px', borderRadius: 48, background: theme.color.ink, color: theme.color.paper, fontFamily: theme.font.body, fontWeight: 600, fontSize: 36 }}>sombra em três camadas</div>
          </Shadowed>
        </div>
        <Vignette strength={0.3} focus={{ x: 0.75, y: 0.5 }} />
        <FilmGrain opacity={0.45} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Textura: folha rasgada com miolo, espessuras, grão e traço que ferve. */
const TextureDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = Math.min(1, Math.max(0, (frame - 12) / 20));
  const stroke = handStroke(420, { seed: 4, wobble: 6, rise: -6 });
  return (
    <Stage>
      <div style={{ position: 'absolute', left: 150, top: 150, rotate: '-3deg' }}>
        <PaperSheet width={760} height={460} thickness={6} torn seed={5} elevation={22} amplitude={12}>
          <div style={{ padding: 64 }}>
            <div style={label}>PAPEL RASGADO</div>
            <div style={{ ...title, marginTop: 14 }}>Borda com fibra,</div>
            <div style={title}>
              <span style={{ fontStyle: 'italic', color: theme.color.coral }}>não</span> dente de serra.
            </div>
            <Boil amplitude={1.8} rate={8} style={{ marginTop: 12 }}>
              <svg width={460} height={40} viewBox="-10 -20 460 40" style={{ display: 'block', overflow: 'visible' }}>
                <path d={smoothPath(stroke)} fill="none" stroke={theme.color.coral} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              </svg>
            </Boil>
          </div>
        </PaperSheet>
      </div>
      {[2, 5, 9].map((thickness, index) => (
        <div key={thickness} style={{ position: 'absolute', left: 1040 + index * 250, top: 190 + index * 60, rotate: `${index * 3 - 3}deg` }}>
          <PaperSheet width={300} height={210} thickness={thickness} seed={index} elevation={10 + thickness * 2} color={index === 1 ? mix(theme.color.ink, theme.color.paper, 0.08) : theme.color.paper}>
            <div style={{ padding: 28, ...label, color: index === 1 ? theme.color.slate300 : theme.color.slate600 }}>ESPESSURA {thickness}</div>
          </PaperSheet>
        </div>
      ))}
      <div style={{ position: 'absolute', left: 1040, top: 620, rotate: '2deg' }}>
        <PaperSheet width={720} height={300} thickness={4} torn={{ top: true, left: true }} seed={11} elevation={14} color={brandRamp('paper', 0.75)} amplitude={10}>
          <div style={{ padding: '56px 60px' }}>
            <div style={label}>GRÃO DE PAPEL + GRÃO DE FILME</div>
            <div style={{ ...title, fontSize: 52, marginTop: 10 }}>{`quadro ${String(Math.floor((frame / fps) * 8)).padStart(2, '0')} do traço`}</div>
          </div>
        </PaperSheet>
      </div>
    </Stage>
  );
};

/** As máscaras do kit abrindo o mesmo painel, mais a tipografia por linha de base. */
const MasksDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(1, Math.max(0, (frame - 8) / 44));
  const box = { width: 540, height: 304 };
  const specs: { name: string; mask: MaskSpec }[] = [
    { name: 'iris', mask: { type: 'iris', progress, ...box, x: 0.3, y: 0.6, feather: 0.14 } },
    { name: 'band', mask: { type: 'band', progress, angle: 105, feather: 0.2 } },
    { name: 'ink · wipe', mask: { type: 'ink', progress, seed: 3, angle: 20, roughness: 0.7, frequency: 0.003 } },
    { name: 'ink · bloom', mask: { type: 'ink', progress, seed: 8, mode: 'bloom', origin: { x: 0.35, y: 0.55 }, roughness: 0.8, frequency: 0.003 } },
    { name: 'blinds', mask: { type: 'blinds', progress, count: 7, cascade: 0.6 } },
    { name: 'shape · hexagon', mask: { type: 'shape', shape: 'hexagon', progress } },
  ];
  const words = ['Máscara', 'tem', 'borda', 'com', 'caráter.'];
  const delays = staggerDelays(words.length, { step: 3, start: 14 });
  return (
    <Stage>
      {specs.map(({ name, mask }, index) => (
        <div key={name} style={{ position: 'absolute', left: 110 + (index % 3) * 580, top: 70 + Math.floor(index / 3) * 380, ...box }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 20, border: `2px dashed ${theme.color.slate300}` }} />
          <MaskReveal mask={mask}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: `linear-gradient(135deg, ${theme.color.ink}, ${theme.color.slate900} 60%, ${mix(theme.color.ink, theme.color.coral, 0.35)})`, display: 'flex', alignItems: 'flex-end', padding: 28, boxSizing: 'border-box' }}>
              <div style={{ ...label, color: theme.color.paper }}>{name.toUpperCase()}</div>
            </div>
          </MaskReveal>
        </div>
      ))}
      <div style={{ ...title, position: 'absolute', left: 110, top: 860, fontSize: 84 }}>
        {words.map((word, index) => (
          <WordMask key={word} progress={Math.min(1, springProgress(frame, fps, { delay: delays[index], spring: 'suave' }))} style={{ marginRight: '0.26em' }}>
            <span style={index === 4 ? { fontStyle: 'italic', color: theme.color.coral } : undefined}>{word}</span>
          </WordMask>
        ))}
      </div>
    </Stage>
  );
};

/** Rasgo de papel com fibra, miolo e sombra, cobrindo um quadro escuro (o lugar do footage). */
const TearDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = (f: number): number => Math.min(1, cineSpring(f, fps, { delay: 6, spring: 'pesada' }));
  const speed = velocityAt((f) => progress(f) * 2200, frame);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(120deg, ${theme.color.slate900}, #3b4252)` }}>
      <div style={{ ...label, position: 'absolute', right: 120, bottom: 90, color: theme.color.slate300 }}>FOOTAGE</div>
      <MotionBlur velocity={{ x: speed, y: 0 }} samples={8}>
        {(f) => (
          <TornReveal progress={progress(f)} seed={6} amplitude={18} lean={130}>
            <Stage grain={false}>
              <div style={{ ...title, position: 'absolute', left: 160, top: 430, fontSize: 96 }}>
                A cena entra <span style={{ fontStyle: 'italic', color: theme.color.coral }}>rasgando.</span>
              </div>
            </Stage>
          </TornReveal>
        )}
      </MotionBlur>
      <FilmGrain opacity={0.4} />
    </AbsoluteFill>
  );
};

export interface CineDemo {
  id: string;
  component: React.FC;
  durationInFrames: number;
}

/** Composições da pasta "Cinema" do Studio (`pnpm mce still Cine-Luz --frame 30`). */
export const cineDemos: CineDemo[] = [
  { id: 'Cine-Molas', component: SpringsDemo, durationInFrames: 150 },
  { id: 'Cine-Blur', component: BlurDemo, durationInFrames: 60 },
  { id: 'Cine-Camera', component: CameraDemo, durationInFrames: 220 },
  { id: 'Cine-Luz', component: LightDemo, durationInFrames: 150 },
  { id: 'Cine-Textura', component: TextureDemo, durationInFrames: 120 },
  { id: 'Cine-Mascaras', component: MasksDemo, durationInFrames: 90 },
  { id: 'Cine-Rasgo', component: TearDemo, durationInFrames: 60 },
];
