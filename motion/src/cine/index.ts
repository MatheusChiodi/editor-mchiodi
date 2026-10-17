// Kit cinematográfico MChiodi ("MChiodi Cinema"). A direção de arte e os critérios de aceite estão em docs/cinema.md.
// Tudo aqui é determinístico, dirigido por `useCurrentFrame()` e medido: veja o custo de cada peça em docs/cinema.md §10.
//
// Receita de uma cena (ordem das camadas, de baixo para cima):
//
//   <Camera shake keyframes={[{ frame: 0, z: -240, focus: -500, aperture: 14 }, { frame: 34, z: 0, focus: 0, ease: 'pesada' }]}>
//     <Layer depth={1800} bleed={200}> fundo: papel + <PaperGrain/> + <KeyLight/> </Layer>
//     <Layer depth={600}>  apoio: folhas e formas fora de foco </Layer>
//     <Layer depth={0}>    assunto: <MotionBlur speed={…}>{(f) => <PaperSheet …/>}</MotionBlur> </Layer>
//     <Layer depth={-500}> primeiro plano: recortes desfocados que passam na frente </Layer>
//   </Camera>
//   <Vignette /> <FilmGrain />
//
// Tempos: declare as deixas com `resolveTimeline` e anime com `cineSpring`:
//
//   const t = resolveTimeline([{ id: 'sheet', at: 4, duration: 22 }, { id: 'title', after: 'sheet', offset: -6 }, { id: 'rule', with: 'title', offset: 9 }]);
//   const y = (f: number) => cineSpring(f, fps, { delay: t.sheet.start, from: -700, to: 0, spring: 'pesada', anticipation: ANTICIPATION });

export { adaptiveSamples, type AdaptiveOptions, blurLength, type ShutterOptions, type ShutterSample, shutterSamples, type SmearSpec, smearSpec, type Vec2, velocity2D } from './blur';
export { Camera, type CameraProps, Layer, type LayerProps, rollCover, useCamera, useLayer } from './Camera';
export {
  addCamera,
  CAMERA_REST,
  cameraAt,
  type CameraEase,
  type CameraKeyframe,
  cameraShake,
  type CameraState,
  DEFAULT_FOCAL_LENGTH,
  impactEnvelope,
  type LayerProjection,
  layerTransform,
  type LensOptions,
  projectLayer,
  type ShakeOptions,
} from './camera-math';
export { atmosphere, brandRamp, lightness, mix, parseColor, ramp, type RampName, ramps, type Rgba, shadowColor, toCss, withAlpha } from './color';
export { Halation, type HalationProps, KeyLight, type KeyLightProps, LightSweep, type LightSweepProps, Shadowed, type ShadowedProps, Vignette } from './Light';
export {
  boxShadowCss,
  castShadow,
  dropShadowCss,
  type GlowOptions,
  glowShadow,
  KEY_LIGHT_ANGLE,
  lightWrap,
  rimLight,
  type RimOptions,
  type ShadowLayer,
  type ShadowOptions,
  sweepGradient,
  type SweepOptions,
  sweepTextBackground,
  vignetteGradient,
  type VignetteOptions,
} from './light-math';
export { MaskReveal, type MaskRevealProps, TornReveal, type TornRevealProps, WordMask, type WordMaskProps } from './Masks';
export {
  bandMask,
  type BandOptions,
  baselineReveal,
  blindsClip,
  type BlindsOptions,
  type ClipShape,
  inkLevels,
  inkMask,
  type InkOptions,
  irisMask,
  type IrisOptions,
  irisReach,
  type MaskSpec,
  maskStyle,
  shapeClip,
} from './mask-math';
export { MotionBlur, type MotionBlurProps, Smear, type SmearProps } from './MotionBlur';
export { fbm1D, fbm2D, type FbmOptions, hash, hash2, noise1D, noise2D, rng, seedFrom, simplex2D, steppedIndex, wiggle, wiggle2D, type WiggleOptions } from './noise';
export {
  ANTICIPATION,
  type AnticipationOptions,
  cineSpring,
  type CineSpringOptions,
  departure,
  drag,
  follow,
  settleTime,
  type SpringConfig,
  springConfig,
  type SpringInput,
  springOvershoot,
  type SpringPreset,
  springProgress,
  SPRINGS,
  springValue,
  springVelocity,
  stretch,
  velocityAt,
} from './spring';
export { Boil, type BoilProps, FilmGrain, type FilmGrainProps, PaperGrain, type PaperGrainProps, PaperSheet, type PaperSheetProps } from './Texture';
export {
  boilPoints,
  boilSeed,
  filmGrainTile,
  type GrainOptions,
  grainOffset,
  handStroke,
  type PaperEdge,
  paperEdges,
  paperGrainTile,
  smoothPath,
  type TornOptions,
  tornProfile,
  tornRectPath,
  type TornRectOptions,
  type TornWipe,
  tornWipe,
  type TornWipeOptions,
} from './texture-math';
export { type Cue, cueProgress, frames, type ResolvedCue, resolveTimeline, staggerDelays, type StaggerOptions, staggerOrder, type StaggerOrigin, timelineEnd } from './timeline';
