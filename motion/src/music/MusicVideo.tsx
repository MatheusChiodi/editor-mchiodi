import { AbsoluteFill, Audio, interpolate, useCurrentFrame } from 'remotion';

import { springAt } from '../anim';
import { withAlpha } from '../components/SectionTitle';
import { theme } from '../theme';
import { Bokeh, CinemaDefs, GodRays, Grade, Grain, LensFlare, Letterbox, LightLeaks, Vignette } from './cinema';
import { cameraTransform, letterboxBar, TRANSITION_FRAMES, transitionState } from './cinema-math';
import { MOTIFS } from './motifs';
import { MUSIC_BARS, type MusicPlan, type MusicScene } from './types';
import { beatPulse, lyricAt, mixHex, paletteAt, sceneAt, sectionIndexAt, wordStates } from './visuals';

/** `type` e não `interface`: o Remotion exige props que casem com `Record<string, unknown>`. */
export type MusicVideoProps = {
  plan: MusicPlan;
  /** só no player do navegador (preview ao vivo); no render a música entra pelo ffmpeg */
  audioSrc?: string;
};

/** Quadro de um índice dentro da série, sem estourar nas pontas. */
const pick = (series: number[], frame: number) => series[Math.max(0, Math.min(series.length - 1, frame))] ?? 0;

/**
 * Vídeo de música em modo cinema. Cada cena é um plano de história (personagem num cenário) ou uma ilustração do que a
 * letra diz; entre elas há transição (fade, flash, cortina, zoom, glitch, whip) e cada plano tem câmera própria
 * (aproxima, afasta, panorâmica, inclina, balança). Por cima: bloom, aberração cromática nas batidas, grade de cor,
 * vazamentos de luz, bokeh, raios, lens flare, grão, vinheta, faixas cinemascope, espectro e letra em karaokê.
 * Tudo vem do plano (`mce music`); o componente não analisa áudio.
 */
export const MusicVideo: React.FC<MusicVideoProps> = ({ plan, audioSrc }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = plan;
  const unit = Math.min(width, height) / 1080;
  const palette = paletteAt(plan, frame);
  const [bg, accent, glow] = palette;
  const section = plan.sections[sectionIndexAt(plan, frame)]!;
  const bass = pick(plan.bass, frame);
  const bars = plan.bars[Math.min(plan.bars.length - 1, frame)] ?? new Array<number>(MUSIC_BARS).fill(0);
  const pulse = beatPulse(frame, plan.beats, 8);
  const downPulse = beatPulse(frame, plan.downbeats, 5);

  const { scene, index, local, duration, progress } = sceneAt(plan, frame);
  const previous = index > 0 ? plan.scenes[index - 1]! : null;
  const inTransition = previous !== null && local < TRANSITION_FRAMES;
  const ts = inTransition ? transitionState(scene.transition ?? 'fade', local / TRANSITION_FRAMES) : null;
  // pequeno glitch nos tempos fortes dos trechos fortes, além do glitch das transições
  const glitch = Math.max(ts?.glitch ?? 0, section.energy === 'high' ? downPulse * 0.22 : 0);
  const chroma = 0.6 + 3.6 * pulse + glitch * 7;

  const cx = width / 2;
  const cy = height * 0.4;

  /** Uma cena posicionada: plano de história em tela cheia (cobrindo o quadro) ou ilustração na área central. */
  const layer = (s: MusicScene, sceneIndex: number, localFrame: number, prog: number, style: { opacity: number; scale: number; x: number; filter?: string; clip?: string }) => {
    const story = s.motif === 'story';
    const cam = cameraTransform(s.camera ?? 'still', prog, localFrame, fps, pulse);
    const base = story ? Math.max(width / 1920, height / 1080) : unit * 1.15;
    const Motif = MOTIFS[s.motif];
    return (
      <g key={sceneIndex} opacity={style.opacity} filter={style.filter} clipPath={style.clip}>
        <g transform={`translate(${(story ? width / 2 : cx) + cam.x * unit + style.x * width} ${(story ? height / 2 : cy) + cam.y * unit}) rotate(${cam.rotate}) scale(${base * cam.scale * style.scale})`}>
          <Motif frame={localFrame} fps={fps} progress={prog} palette={palette} bass={bass} pulse={pulse} variant={s.variant} keyword={s.keyword} seed={sceneIndex * 7 + s.variant} shot={s.shot} />
        </g>
      </g>
    );
  };

  const fadeFromBlack = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const incoming = layer(scene, index, local, progress, {
    opacity: (ts ? ts.inOpacity : 1) * (index === 0 ? fadeFromBlack : 1),
    scale: ts?.inScale ?? 1,
    x: ts?.inX ?? 0,
    filter: ts && ts.blur > 0 ? 'url(#blurIn)' : undefined,
    clip: ts && ts.wipe < 1 ? 'url(#wipeClip)' : undefined,
  });
  const outgoing =
    previous && ts && ts.outOpacity > 0.001
      ? layer(previous, index - 1, previous.endFrame - previous.startFrame + local, 1, { opacity: ts.outOpacity, scale: ts.outScale, x: ts.outX, filter: ts.blur > 0 ? 'url(#blurOut)' : undefined })
      : null;

  const layerProps = { width, height, frame, fps, palette, pulse, downPulse, energy: section.energy };
  const bar = letterboxBar(width, height);
  const flash = Math.max(ts?.flash ?? 0, section.energy === 'high' ? downPulse * 0.1 : 0);

  const barAreaW = width * 0.62;
  const barW = (barAreaW / MUSIC_BARS) * 0.55;
  const barMax = bar > 0 ? bar * 0.5 : height * 0.12;
  const barBase = bar > 0 ? height - bar * 0.28 : height - 40 * unit;

  const lyric = lyricAt(plan, frame);
  const fontSize = lyric ? Math.round(64 * unit * Math.min(1, Math.max(0.58, 30 / Math.max(1, lyric.line.text.length)))) : 0;
  const lyricEnter = lyric ? springAt(frame, fps, (lyric.line.startFrame - 8) / fps) : 0;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${bg} 0%, ${mixHex(bg, accent, 0.28)} 100%)`, overflow: 'hidden' }}>
      {audioSrc ? <Audio src={audioSrc} /> : null}

      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <CinemaDefs frame={frame} chroma={chroma} glitch={glitch} blurIn={(ts?.blur ?? 0) * unit} blurOut={(ts?.blur ?? 0) * unit} />
        <clipPath id="wipeClip">
          <rect x={0} y={0} width={width * (ts?.wipe ?? 1)} height={height} />
        </clipPath>
        <g filter="url(#ca)">
          <g filter="url(#bloom)">
            <g filter={glitch > 0.02 ? 'url(#glitch)' : undefined}>
              {outgoing}
              {incoming}
            </g>
          </g>
        </g>
      </svg>

      <GodRays {...layerProps} />
      <LightLeaks {...layerProps} />
      <Bokeh {...layerProps} seed={Math.round(plan.bpm) + 11} />
      <LensFlare {...layerProps} />
      {flash > 0.005 ? <AbsoluteFill style={{ background: '#ffffff', opacity: flash }} /> : null}
      <Grade energy={section.energy} />
      <Vignette />
      <Grain width={width} height={height} frame={frame} />

      {/* legibilidade da letra: degradê escuro no pé do quadro */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.4, background: 'linear-gradient(to top, rgba(0,0,0,0.62), transparent)' }} />

      <Letterbox width={width} height={height} />

      {/* espectro dentro da faixa de baixo */}
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        {bars.map((value, i) => {
          const h = Math.max(4 * unit, value * barMax);
          const x = (width - barAreaW) / 2 + (barAreaW / MUSIC_BARS) * i + (barAreaW / MUSIC_BARS - barW) / 2;
          return <rect key={i} x={x} y={barBase - h} width={barW} height={h} rx={barW / 2} fill={mixHex(accent, glow, i / (MUSIC_BARS - 1))} opacity={0.85} />;
        })}
      </svg>

      {plan.title ? (
        <div
          style={{
            position: 'absolute',
            top: height * 0.4,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: 86 * unit,
            letterSpacing: '0.06em',
            color: '#fff',
            textShadow: `0 4px 40px rgba(0,0,0,0.85), 0 0 60px ${withAlpha(glow, 0.5)}`,
            opacity: interpolate(frame, [14, 40, 78, 108], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            scale: 1 + interpolate(frame, [0, 120], [0, 0.05], { extrapolateRight: 'clamp' }),
          }}
        >
          {plan.title}
        </div>
      ) : null}

      {/* letra em karaokê, em serifa, acima da faixa preta */}
      {lyric ? (
        <div
          style={{
            position: 'absolute',
            left: width * 0.07,
            right: width * 0.07,
            bottom: (bar > 0 ? bar : 150 * unit) + 36 * unit,
            textAlign: 'center',
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize,
            lineHeight: 1.15,
            letterSpacing: '0.015em',
            textShadow: '0 3px 22px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
            opacity: lyricEnter,
            translate: `0 ${(1 - lyricEnter) * 22 * unit}px`,
          }}
        >
          {wordStates(lyric.line, frame).map((word, i) => (
            <span key={i} style={{ color: word.state === 'active' ? glow : '#fff', opacity: word.state === 'next' ? 0.55 : 1, display: 'inline-block', scale: word.state === 'active' ? 1.06 : 1, marginRight: '0.26em', textShadow: word.state === 'active' ? `0 3px 22px rgba(0,0,0,0.9), 0 0 24px ${withAlpha(glow, 0.8)}` : undefined }}>
              {word.text}
            </span>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
