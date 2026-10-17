import { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import {
  ANTICIPATION,
  Boil,
  brandRamp,
  Camera,
  cameraShake,
  cineSpring,
  cueProgress,
  departure,
  drag,
  FilmGrain,
  glowShadow,
  handStroke,
  impactEnvelope,
  KeyLight,
  Layer,
  LightSweep,
  mix,
  MotionBlur,
  PaperGrain,
  PaperSheet,
  Smear,
  smoothPath,
  springProgress,
  velocityAt,
  Vignette,
  wiggle,
  withAlpha,
  WordMask,
} from '../cine';
import { backSheets, chipPlacements, frontScraps, heroBox, showcaseCamera, showcaseCues } from '../cine/showcase';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface CineShowcaseProps {
  /** rótulo pequeno acima do título (caixa alta) */
  eyebrow?: string;
  /** a frase; marque UMA palavra ou expressão com *asteriscos* para o acento coral em itálico */
  title: string;
  /** até 4 etiquetas de apoio, que saem de trás da folha */
  chips?: string[];
  /** segundo em que as palavras do título começam (padrão: logo após o pouso da folha) */
  titleAt?: number;
  /** segundo de entrada de cada etiqueta (padrão: em sequência depois do traço) */
  chipsAt?: number[];
  /** muda rasgos, posições e tremores sem mudar o desenho */
  seed?: number;
}

const GLOW = (color: string, strength: number): string => `radial-gradient(closest-side, ${withAlpha(color, strength)} 0%, ${withAlpha(color, strength * 0.4)} 48%, ${withAlpha(color, 0)} 100%)`;

/**
 * Cena de abertura de bloco no padrão "MChiodi Cinema": uma folha de papel pousa num mundo de papel com
 * profundidade, a câmera avança e puxa o foco, a luz varre no pouso e o título sobe palavra a palavra.
 * É também a vitrine do kit `motion/src/cine`: câmera, luz, blur, textura e mola na mesma cena.
 */
export const CineShowcase: React.FC<CineShowcaseProps & BaseProps> = ({ eyebrow, title, chips = [], titleAt, chipsAt, seed = 1, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // o layout é desenhado em 1920×1080 e escalado: o render de teste em 720p usa a mesma cena
  const unit = width / 1920;

  const hero = useMemo(() => heroBox(title, Boolean(eyebrow)), [title, eyebrow]);
  const wordCount = hero.lines.reduce((sum, line) => sum + line.length, 0);
  const cues = useMemo(() => showcaseCues(fps, durationInFrames, wordCount, Math.min(4, chips.length), { titleAt, chipsAt }), [fps, durationInFrames, wordCount, chips.length, titleAt, chipsAt]);
  const keyframes = useMemo(() => showcaseCamera(cues, durationInFrames), [cues, durationInFrames]);
  const sheets = useMemo(() => backSheets(seed), [seed]);
  const scraps = useMemo(() => frontScraps(seed), [seed]);
  const tags = useMemo(() => chipPlacements(chips.length, hero), [chips.length, hero]);

  // a folha-herói cai de cima girando; a mola `pesada` dá o peso e o pouso sacode a câmera
  const fall = (f: number): number => springProgress(f, fps, { delay: cues.sheet.start, spring: 'pesada' });
  const leave = (f: number): number => departure(f, fps, { start: cues.exit.start, seconds: cues.exit.duration / fps, recoil: 0.05 });
  const heroY = (f: number): number => (1 - fall(f)) * -820 + leave(f) * -1250;
  const heroX = (f: number): number => (1 - fall(f)) * 210;
  const heroRotation = (f: number): number => (1 - fall(f)) * -10 + wiggle(f, fps, { frequency: 0.22, amplitude: 0.35, seed }) + leave(f) * 7;
  const speedY = velocityAt(heroY, frame);
  const speedX = velocityAt(heroX, frame);
  const elevation = 24 + Math.max(0, 1 - fall(frame)) * 150 + leave(frame) * 160;
  // tremor = respiração constante + sacudida do pouso. Duas fontes de frequência FIXA somadas: mudar a
  // frequência de um ruído no tempo faz a fase saltar
  const impact = impactEnvelope(frame, cues.land.start, fps, 0.09);
  const breath = cameraShake(frame, fps, { amplitude: 2.2, frequency: 0.5, rotation: 0.1, seed });
  const jolt = cameraShake(frame, fps, { amplitude: 10, frequency: 9, rotation: 0.4, seed: seed + 71, envelope: impact });
  const shake = { x: breath.x + jolt.x, y: breath.y + jolt.y, roll: breath.roll + jolt.roll };

  const ruleProgress = cueProgress(frame, cues.rule);
  const ruleEase = 1 - (1 - ruleProgress) ** 3;
  const ruleWidth = Math.min(hero.width - 192, 460);
  const stroke = useMemo(() => handStroke(ruleWidth, { seed: seed + 5, wobble: 5, rise: -5 }), [ruleWidth, seed]);
  const lineStarts = hero.lines.map((_, lineIndex) => hero.lines.slice(0, lineIndex).reduce((sum, line) => sum + line.length, 0));

  const heroSheet = (f: number): React.ReactNode => (
    <div
      style={{
        position: 'absolute',
        left: (1920 - hero.width) / 2,
        top: (1080 - hero.height) / 2 - 14,
        translate: `${heroX(f).toFixed(2)}px ${heroY(f).toFixed(2)}px`,
        rotate: `${heroRotation(f).toFixed(3)}deg`,
      }}
    >
      <PaperSheet width={hero.width} height={hero.height} thickness={6} torn={{ bottom: true, right: true }} amplitude={8} seed={seed + 3} elevation={elevation} velocity={{ x: speedX, y: speedY }} color={theme.color.paper} shading={0.8}>
        <LightSweep at={cues.sweep.start} duration={cues.sweep.duration} width={0.34} intensity={0.9} color="#fffaf0" style={{ width: '100%', height: '100%' }}>
          <div style={{ padding: '70px 96px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {eyebrow ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: Math.min(1, Math.max(0, fall(f) * 2 - 1)) }}>
                <div style={{ width: 34, height: 3, borderRadius: 2, background: theme.color.slate600 }} />
                <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: 28, letterSpacing: '0.3em', textTransform: 'uppercase', color: theme.color.slate600 }}>{eyebrow}</div>
              </div>
            ) : null}
            <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: hero.fontSize, lineHeight: 1.14, letterSpacing: '-0.012em', color: theme.color.ink }}>
              {hero.lines.map((line, lineIndex) => (
                <div key={lineIndex} style={{ whiteSpace: 'nowrap' }}>
                  {line.map((word, index) => {
                    const progress = springProgress(f, fps, { delay: cues.words[lineStarts[lineIndex]! + index] ?? 0, spring: 'suave' });
                    return (
                      <WordMask key={index} progress={Math.min(1, progress)} style={{ marginRight: '0.26em' }}>
                        {word.accent ? <span style={{ fontStyle: 'italic', color: theme.color.coral, textShadow: glowShadow({ radius: 30, strength: 0.34 * progress }) }}>{word.text}</span> : word.text}
                      </WordMask>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {ruleProgress > 0 ? (
            <Boil amplitude={1.5} rate={8} seed={seed} style={{ position: 'absolute', left: 96, bottom: 58 }}>
              <svg width={ruleWidth + 24} height={44} viewBox={`-12 -22 ${ruleWidth + 24} 44`} style={{ display: 'block', overflow: 'visible' }}>
                <path d={smoothPath(stroke)} fill="none" stroke={theme.color.coral} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ruleEase} />
              </svg>
            </Boil>
          ) : null}
        </LightSweep>
      </PaperSheet>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: theme.color.paper }}>
      <AbsoluteFill style={{ width: 1920, height: 1080, transform: `scale(${unit})`, transformOrigin: '0 0' }}>
        <Camera keyframes={keyframes} lens={{ focalLength: 1200, maxBlur: 26 }}>
          <ShakeLayer shake={shake}>
            <Layer depth={2400} bleed={320} dof={false} style={{ background: brandRamp('paper', 0.7) }}>
              <div style={{ position: 'absolute', left: -320, top: -380, width: 1700, height: 1700, background: GLOW(theme.color.glowPeach, 0.5) }} />
              <div style={{ position: 'absolute', right: -260, bottom: -460, width: 1800, height: 1800, background: GLOW(theme.color.glowPeriwinkle, 0.5) }} />
              <div style={{ position: 'absolute', left: 700, top: 60, width: 1100, height: 1100, background: GLOW(theme.color.glowMint, 0.2) }} />
              <KeyLight intensity={0.85} falloff={0.34} seed={seed} />
              <PaperGrain opacity={0.55} seed={seed} />
            </Layer>

            <Layer depth={900}>
              {sheets.map((sheet, index) => {
                const drift = wiggle(frame, fps, { frequency: 0.16, amplitude: 1.2, seed: sheet.seed });
                const ink = sheet.tone < 0;
                return (
                  <div key={index} style={{ position: 'absolute', left: sheet.x, top: sheet.y, rotate: `${(sheet.rotation + drift).toFixed(2)}deg` }}>
                    <PaperSheet width={sheet.width} height={sheet.height} thickness={4} torn amplitude={13} seed={sheet.seed} elevation={26} grain={0.5} color={ink ? mix(theme.color.ink, theme.color.paper, 0.1) : brandRamp('paper', sheet.tone)} />
                  </div>
                );
              })}
            </Layer>

            <Layer depth={60}>
              {tags.map((tag, index) => {
                const start = cues.chips[index] ?? 0;
                const move = (f: number): number => springProgress(f, fps, { delay: start, spring: 'firme', anticipation: ANTICIPATION });
                const out = leave(frame);
                const p = move(frame);
                if (frame < start) return null;
                const x = (f: number): number => tag.fromX + (tag.x - tag.fromX) * move(f);
                const y = (f: number): number => tag.fromY + (tag.y - tag.fromY) * move(f);
                const vx = velocityAt(x, frame);
                const vy = velocityAt(y, frame);
                const label = chips[index] ?? '';
                const chipWidth = Math.round(label.length * 24 + 120);
                return (
                  <div key={index} style={{ position: 'absolute', left: x(frame) - chipWidth / 2, top: y(frame) - 50 + out * 500, rotate: `${(tag.rotation * p + drag(vx, { factor: 0.1, max: 7 })).toFixed(2)}deg`, opacity: Math.min(1, Math.max(0, p * 4)) }}>
                    <Smear velocity={{ x: vx, y: vy }}>
                      <PaperSheet width={chipWidth} height={100} thickness={5} radius={50} seed={seed + index} elevation={8 + Math.hypot(vx, vy) * 1.2} color={theme.color.white} grain={0.3}>
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: theme.font.body, fontWeight: 600, fontSize: 42, color: theme.color.ink }}>
                          <span style={{ width: 13, height: 13, borderRadius: 7, background: theme.color.slate300 }} />
                          {label}
                        </div>
                      </PaperSheet>
                    </Smear>
                  </div>
                );
              })}
            </Layer>

            <Layer depth={0}>
              <MotionBlur velocity={{ x: speedX, y: speedY }} samples={8}>
                {heroSheet}
              </MotionBlur>
            </Layer>

            <Layer depth={-520}>
              {scraps.map((scrap, index) => (
                <div key={index} style={{ position: 'absolute', left: scrap.x, top: scrap.y, rotate: `${(scrap.rotation + wiggle(frame, fps, { frequency: 0.2, amplitude: 1.6, seed: scrap.seed })).toFixed(2)}deg` }}>
                  <PaperSheet width={scrap.width} height={scrap.height} thickness={5} torn amplitude={14} seed={scrap.seed} elevation={40} grain={0.4} color={brandRamp('paper', scrap.tone)} />
                </div>
              ))}
            </Layer>
          </ShakeLayer>
        </Camera>
        <Vignette strength={0.4} focus={{ x: 0.5, y: 0.48 }} />
        <FilmGrain opacity={0.5} seed={seed} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Tremor aplicado à cena inteira (o percurso da câmera vem dos keyframes; o tremor muda com o impacto). */
const ShakeLayer: React.FC<{ shake: { x: number; y: number; roll: number }; children: React.ReactNode }> = ({ shake, children }) => (
  <AbsoluteFill style={{ transform: `translate(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px) rotate(${shake.roll.toFixed(3)}deg) scale(1.012)` }}>{children}</AbsoluteFill>
);

export const entry: ComponentEntry = {
  component: CineShowcase,
  opaque: true,
  defaultDuration: 8,
  description:
    'Abertura de bloco em cena de papel com profundidade (padrão MChiodi Cinema): folha que pousa com peso, câmera em dolly com rack focus, varredura de luz no pouso, título palavra a palavra com um acento coral e etiquetas de apoio. Use na tese de um capítulo ou na promessa do vídeo, em tela cheia (esconde o footage); no máximo uma por capítulo.',
  sample: {
    eyebrow: 'Capítulo 2',
    title: 'Cada vídeo, um pequeno *filme.*',
    chips: ['profundidade', 'luz', 'peso'],
  },
};
