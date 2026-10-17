import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Analysis, Transcript } from '../analyze/types.ts';
import { resolveAsset } from '../assets/library.ts';
import { loadConfig } from '../config.ts';
import type { Edl } from '../edl/schema.ts';
import { buildTimeline, type Timeline } from '../edl/timeline.ts';
import type { ProgressFn } from '../lib/ffmpeg.ts';
import { type ProjectPaths, readJson, writeJson } from '../project/paths.ts';
import { missingScenes, syncScenes } from '../scenes/sync.ts';
import { collectSfx, gainFilter, limiterFilter, type MusicBed, voiceChain } from './audio.ts';
import { bumperDurations } from './bumpers.ts';
import { buildSrt } from './srt.ts';
import type { ExportPlan } from './formats.ts';
import { prepareDenoise } from './denoise.ts';
import { compose, measureChain, totalDuration } from './compose.ts';
import { renderCut } from './cuts.ts';
import { effectFilters, placeEffects } from './effects.ts';
import { placeBroll, placeLayout, resolveScreen, screenAlign } from './layout.ts';
import { buildOverlayProps, overlayFile, renderBumper, renderOverlay } from './overlay.ts';
import { formatShortsPick, pickShortsOverlays, shortsEdl, shortsFrame, SHORTS_MAX_SEC, verticalCrop } from './shorts.ts';
import { resolveShortFocus } from './shorts-focus.ts';
import { formatStageFocus, stageFocusMap } from './stage-focus.ts';
import { loadStageFocus } from './stage-focus-io.ts';
import { prepareStabilize } from './stabilize.ts';
import { placeStages, reframeFilters, windowLayouts } from './reframe.ts';
import { gradeFilters, placeZooms, zoomFilters } from './video.ts';

export type RenderMode = 'preview' | 'final';
export type RenderVariant = 'main' | 'shorts';

export interface RenderOptions {
  mode: RenderMode;
  /** `shorts` renderiza o trecho vertical definido em `edl.shorts` */
  variant?: RenderVariant;
  /** pula a camada do Remotion: só cortes e áudio (iteração rápida de ritmo) */
  skipOverlay?: boolean;
  /** exportação (`mce export`): formato, reenquadramento e teto de bitrate; entrega em renders/<slug>-<formato>.mp4 + .srt */
  export?: ExportPlan;
  onProgress?: ProgressFn;
  log?: (message: string) => void;
}

export interface RenderResult {
  file: string;
  dir: string;
  timeline: Timeline;
  /** duração do arquivo final, com vinhetas */
  durationSec: number;
  elapsedSec: number;
}

/** Tamanho do preview: mesma proporção, altura reduzida, dimensões pares. */
export function previewSize(output: Edl['output'], scale: number): { width: number; height: number } {
  const even = (value: number) => Math.round((value * scale) / 2) * 2;
  return { width: even(output.width), height: even(output.height) };
}

export function renderDir(paths: ProjectPaths, edl: Edl, mode: RenderMode, variant: RenderVariant = 'main'): string {
  return join(paths.rendersDir, `v${edl.version}-${variant === 'shorts' ? 'shorts-' : ''}${mode}`);
}

/** Nome do arquivo dentro da pasta de render e nome de entrega em output/<projeto>/. */
export function outputNames(mode: RenderMode, variant: RenderVariant): { file: string; delivered: string | null } {
  if (variant === 'shorts') return { file: `shorts-${mode}.mp4`, delivered: mode === 'final' ? 'final-shorts.mp4' : null };
  return { file: `${mode}.mp4`, delivered: mode === 'final' ? 'final.mp4' : null };
}

/**
 * Executa a EDL: (1) cortes em passe único a partir da fonte, (2) camada de gráficos
 * no Remotion com alfa, (3) composição + áudio tratado + encode. O renderer não decide nada.
 */
export async function render(paths: ProjectPaths, source: Edl, options: RenderOptions): Promise<RenderResult> {
  const config = loadConfig();
  const log = options.log ?? (() => {});
  const startedAt = Date.now();
  const analysis = readJson<Analysis>(paths.analysis);
  const transcript = readJson<Transcript>(paths.words);
  const final = options.mode === 'final';
  const plan = options.export ?? null;
  const variant = plan?.variant ?? options.variant ?? 'main';
  const shorts = variant === 'shorts';
  const edl = shorts ? shortsEdl(source) : source;
  const dir = plan ? join(paths.rendersDir, `v${source.version}-${plan.dirName}`) : renderDir(paths, source, options.mode, variant);
  mkdirSync(dir, { recursive: true });

  const { fps } = edl.output;
  const timeline = buildTimeline(edl.clips, fps);
  const scale = final ? 1 : config.render.previewScale;
  const size = final ? edl.output : previewSize(edl.output, scale);
  log(`${shorts ? 'shorts ' : ''}${options.mode}: ${timeline.clips.length} clipes, ${timeline.durationSec.toFixed(1)}s @ ${fps} fps, ${size.width}x${size.height}`);
  if (shorts && timeline.durationSec > SHORTS_MAX_SEC) {
    log(`aviso: o Short ficou com ${timeline.durationSec.toFixed(1)}s (acima de ${SHORTS_MAX_SEC}s); encurte edl.shorts`);
  }

  // o índice das cenas sob medida precisa estar em dia antes do bundle do Remotion
  const absent = missingScenes(edl.overlays.map((item) => item.component), syncScenes());
  if (absent.length) throw new Error(`Cenas citadas na EDL não existem em motion/src/scenes: ${absent.join(', ')}`);

  // tela gravada: só entra se a EDL define o arquivo e algum segmento que a use (e nunca no Short)
  // Short: cada overlay do trecho vai para uma caixa vertical que não cobre legenda nem rosto
  // palcos: foco "auto" acha o apresentador no intervalo; foco fixo que corta o rosto vira aviso
  const stageFocus = shorts || options.skipOverlay ? null : await loadStageFocus(paths, edl, timeline, { onProgress: options.onProgress });
  if (stageFocus?.missing) log(`aviso: foco dos palcos sem detector (${stageFocus.missing})`);
  for (const line of stageFocus ? formatStageFocus(stageFocus.plans) : []) log(line);
  const props = buildOverlayProps(edl, timeline, transcript, shorts ? shortsFrame(edl) : undefined, stageFocus ? stageFocusMap(stageFocus.plans) : undefined);
  if (shorts) log(formatShortsPick(pickShortsOverlays(source, timeline)));
  const staged = !options.skipOverlay;
  const layout = shorts ? [] : [...placeLayout(edl.layout.segments, timeline), ...(staged ? windowLayouts(props.overlays, fps) : [])];
  const screenSource = layout.length && edl.layout.screen ? resolveScreen(edl.layout.screen.path, edl.source.path) : null;
  if (layout.length && !screenSource) log('aviso: o layout pede gravação de tela, mas o arquivo não foi encontrado; seguindo só com a câmera');
  const screenCut = screenSource ? join(dir, 'screen.mkv') : null;

  // a voz limpa vem do arquivo original mesmo no preview: o proxy tem as mesmas amostras no mesmo lugar
  const denoise = await prepareDenoise(edl.audio.denoise, edl.source.path, paths.analysisDir, { ...config.denoise, configPath: config.denoise.deepFilterPath, log });

  // a análise é do arquivo que o corte lê (proxy no preview, original no final): o .trf é em pixels daquele quadro
  const cutSource = final ? edl.source.path : analysis.proxy;
  const stabilize = await prepareStabilize(edl.stabilize, cutSource, paths.analysisDir, { fps, log });

  // foco do Short: `auto` detecta o apresentador no proxy (cacheado) e planeja o pan em tempo da fonte
  const focus = shorts ? await resolveShortFocus(paths, source) : null;
  if (shorts && source.shorts!.focusX === 'auto') log(`foco auto: ${Array.isArray(focus) ? `pan com ${focus.length} keyframes` : `fixo em ${focus}`}`);

  const cut = join(dir, 'cut.mkv');
  await renderCut(timeline, {
    audioSource: denoise.audioSource ?? undefined,
    screen: screenSource ? { align: screenAlign(edl.layout.screen!.offsetSec, fps) } : undefined,
    screenSource: screenSource ?? undefined,
    screenOutput: screenCut ?? undefined,
    source: cutSource,
    stabilize: stabilize.transform ?? undefined,
    output: cut,
    graphFile: join(dir, 'cut.graph.txt'),
    quality: final ? 'mezzanine' : 'preview',
    fps,
    ...size,
    prep: focus !== null ? verticalCrop(focus, size) : undefined,
    fadeMs: edl.audio.cutFadeMs,
    transitions: edl.transitions,
    sourceFrames: Math.floor(edl.source.durationSec * fps),
    onProgress: options.onProgress,
  });

  let overlay: string | null = null;
  writeJson(join(dir, 'overlay.props.json'), props);
  if (!options.skipOverlay && (props.captions.length > 0 || props.overlays.length > 0)) {
    overlay = overlayFile(dir);
    await renderOverlay(props, {
      output: overlay,
      scale,
      concurrency: config.render.remotionConcurrency,
      onProgress: options.onProgress,
    });
  }

  // vinhetas só no vídeo principal; o Short começa direto no conteúdo
  const bumpers = bumperDurations(shorts ? { intro: false, outro: false } : edl);
  let intro: string | null = null;
  let outro: string | null = null;
  if (bumpers.introSec > 0) {
    intro = join(dir, 'intro.mp4');
    await renderBumper('Intro', bumpers.introSec, { ...edl.output, output: intro, scale });
  }
  if (bumpers.outroSec > 0) {
    outro = join(dir, 'outro.mp4');
    await renderBumper('Outro', bumpers.outroSec, { ...edl.output, output: outro, scale });
  }

  const voice = voiceChain({ ...edl.audio, denoise: denoise.denoise });
  const measured = await measureChain(cut, voice);
  log(`voz tratada: ${measured.integratedLufs.toFixed(1)} LUFS → alvo ${edl.audio.targetLufs} LUFS`);

  const missing: string[] = [];
  const sfx = collectSfx(edl, timeline, (name) => {
    const path = resolveAsset('sfx', name);
    if (!path) missing.push(`sfx/${name}`);
    return path;
  });
  let music: MusicBed | null = null;
  if (edl.music) {
    const path = resolveAsset('music', edl.music.file);
    if (path) music = { ...edl.music, file: path };
    else missing.push(`music/${edl.music.file}`);
  }
  const broll = placeBroll(
    edl.broll.flatMap((item) => {
      const path = resolveAsset('broll', item.file);
      if (!path) missing.push(`broll/${item.file}`);
      return path ? [{ ...item, file: path }] : [];
    }),
    timeline,
  );
  if (missing.length) log(`aviso: assets não encontrados (ignorados): ${[...new Set(missing)].join(', ')}`);

  // exportação não substitui a entrega (output/final.mp4): é um arquivo à parte em renders/
  const names = plan ? { file: `${plan.dirName}.mp4`, delivered: null } : outputNames(options.mode, variant);
  const file = join(dir, names.file);
  const composeOptions = {
    durationSec: timeline.durationSec,
    fps,
    ...size,
    videoFilters: [
      ...gradeFilters(edl.grade),
      ...zoomFilters(placeZooms(edl.zooms, timeline), size.width, size.height),
      ...effectFilters(placeEffects(edl.effects, timeline), size, fps),
      // por último: cor, zoom e efeitos viajam junto com o footage para dentro do cartão
      ...(staged ? reframeFilters(placeStages(props.overlays, fps), size.width, size.height) : []),
    ],
    voiceFilters: [...voice, gainFilter(measured.integratedLufs, edl.audio)],
    limiter: limiterFilter(edl.audio),
    music,
    sfx,
    bumpers,
  };
  await compose({
    ...composeOptions,
    cut,
    overlay,
    intro,
    outro,
    screen: screenCut,
    layout,
    broll,
    output: file,
    graphFile: join(dir, 'compose.graph.txt'),
    quality: final ? 'final' : 'preview',
    reformat: plan?.reformat ?? null,
    maxrateK: plan?.maxrateK,
    onProgress: options.onProgress,
  });

  if (names.delivered) {
    mkdirSync(paths.outputDir, { recursive: true });
    copyFileSync(file, join(paths.outputDir, names.delivered));
  }
  const durationSec = totalDuration({ ...composeOptions, hasIntro: intro !== null, hasOutro: outro !== null });
  if (plan) {
    copyFileSync(file, plan.file);
    // legenda ao lado do vídeo, no tempo do arquivo (depois da vinheta de abertura)
    writeFileSync(plan.srt, buildSrt(transcript.words, timeline, edl.captions, intro !== null ? bumpers.introSec : 0), 'utf8');
    return { file: plan.file, dir, timeline, durationSec, elapsedSec: (Date.now() - startedAt) / 1000 };
  }
  return { file, dir, timeline, durationSec, elapsedSec: (Date.now() - startedAt) / 1000 };
}
