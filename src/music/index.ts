import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Transcript, Word } from '../analyze/types.ts';
import { transcribe } from '../analyze/transcribe.ts';
import { loadConfig } from '../config.ts';
import { ffmpeg, type ProgressFn } from '../lib/ffmpeg.ts';
import { ensureProject, type ProjectPaths, readJson, slugFromFile, writeJson } from '../project/paths.ts';
import type { MusicPlan } from '../../motion/src/music/types.ts';
import { analyzeSpectrum, decodeMono, onsetEnvelope } from './features.ts';
import { alignLyrics, linesFromWords, type LyricLine, parseLyrics, spreadLyrics } from './lyrics.ts';
import { buildMusicPlan } from './plan.ts';
import { renderMusicVideo } from './render.ts';
import { planStory } from './story.ts';
import { type Section, segmentSections } from './sections.ts';
import { bassOnsets, estimateTempo, type Tempo } from './tempo.ts';

export interface MusicOptions {
  slug?: string;
  /** letra em texto, um verso por linha; sem ela, a letra vem do que foi ouvido (se `transcribe`) */
  lyricsFile?: string;
  /** tenta transcrever a voz (letra automática ou alinhamento da letra fornecida) */
  transcribe?: boolean;
  size?: { width: number; height: number };
  fps?: number;
  title?: string;
  /** só analisa e grava o plano, sem renderizar */
  planOnly?: boolean;
  /** metade da resolução: iteração rápida */
  preview?: boolean;
  output?: string;
  onProgress?: ProgressFn;
  log?: (message: string) => void;
}

export interface MusicResult {
  paths: ProjectPaths;
  plan: MusicPlan;
  tempo: Tempo;
  sections: Section[];
  planFile: string;
  file: string | null;
}

const SAMPLE_RATE = 22050;
/** abaixo disso a grade de BPM não é confiável */
const LOW_TEMPO_CONFIDENCE = 0.15;
/** palavras com confiança menor que isso vêm de alucinação do Whisper em trecho instrumental */
const MIN_WORD_SCORE = 0.35;

/** Tempo, batidas, seções, letra e plano visual de uma música; renderiza o vídeo se não for `planOnly`. */
export async function makeMusicVideo(audioPath: string, options: MusicOptions = {}): Promise<MusicResult> {
  const log = options.log ?? (() => {});
  const config = loadConfig();
  const fps = options.fps ?? 30;
  const size = options.size ?? { width: 1920, height: 1080 };
  const paths = ensureProject(options.slug ?? slugFromFile(audioPath));
  const title = options.title ?? '';

  log('ouvindo a música...');
  const samples = await decodeMono(audioPath, SAMPLE_RATE);
  if (samples.length < SAMPLE_RATE * 2) throw new Error('Áudio curto demais (menos de 2 s) ou ilegível');
  const features = analyzeSpectrum(samples, SAMPLE_RATE, { fps });
  const onset = onsetEnvelope(samples, SAMPLE_RATE, 100);
  let tempo = estimateTempo(onset, { bass: { rate: fps, values: features.bass } });
  // grade de BPM pouco confiável (violão, rubato, pulso fraco): as batidas passam a vir dos golpes reais do grave
  if (tempo.confidence < LOW_TEMPO_CONFIDENCE) {
    const hits = bassOnsets(features.bass, fps);
    log(`aviso: tempo pouco confiável (${tempo.bpm || '?'} BPM, confiança ${tempo.confidence.toFixed(2)}); batidas pelos golpes do grave`);
    tempo = { ...tempo, beats: hits.beats, downbeats: hits.downbeats };
  }
  const energy = features.rms.map((value, index) => 0.6 * value + 0.4 * features.bass[index]!);
  const sections = segmentSections(energy, fps);
  log(`${features.durationSec.toFixed(0)}s · ${tempo.bpm || '?'} BPM · ${tempo.beats.length} batidas · ${sections.length} seções (${sections.map((s) => s.energy).join(' → ')})`);

  // letra: a fornecida (alinhada ao que foi ouvido) ou a ouvida
  const given = options.lyricsFile ? parseLyrics(readFileSync(options.lyricsFile, 'utf8')) : [];
  let heard: Word[] = [];
  if (options.transcribe !== false) {
    try {
      // transcrição mais nova que o áudio continua valendo (a letra e o plano mudam, a voz não)
      const cached = existsSync(paths.words) && statSync(paths.words).mtimeMs > statSync(audioPath).mtimeMs;
      let transcript: Transcript;
      if (cached) {
        log('transcrição já existe, reaproveitando');
        transcript = readJson<Transcript>(paths.words);
      } else {
        await ffmpeg(['-i', audioPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', paths.audio16k]);
        log('transcrevendo a voz...');
        transcript = await transcribe(paths.audio16k, paths.words, config.transcribe, options.onProgress);
      }
      heard = transcript.words.filter((word) => word.score >= MIN_WORD_SCORE);
      log(`${heard.length} palavras ouvidas`);
    } catch (error) {
      log(`aviso: sem transcrição (${(error as Error).message.split('\n')[0]}); seguindo sem ela`);
    }
  }

  let lyrics: LyricLine[] = [];
  if (given.length) {
    lyrics = alignLyrics(given, heard);
    if (lyrics.length === 0) {
      const sung = sections.find((section) => section.energy !== 'low') ?? sections[0]!;
      lyrics = spreadLyrics(given, sung.start, Math.max(sung.start + 1, features.durationSec - 3));
      log('aviso: não consegui alinhar a letra à voz; distribuí os versos pelo tempo (sincronia aproximada)');
    } else {
      log(`${lyrics.length} versos alinhados à voz`);
    }
  } else if (heard.length) {
    lyrics = linesFromWords(heard);
    log(`${lyrics.length} versos pela transcrição (sem letra fornecida)`);
  } else {
    log('sem letra: vídeo instrumental');
  }

  const scenes = planStory({ lyrics, sections, durationSec: features.durationSec, beats: tempo.beats, downbeats: tempo.downbeats });
  const stories = scenes.filter((scene) => scene.motif === 'story').length;
  log(`${scenes.length} cenas (${stories} planos de história, ${scenes.length - stories} ilustrações)`);
  const plan = buildMusicPlan({ title, size, features, tempo, sections, lyrics, scenes });
  const planFile = join(paths.analysisDir, 'music.plan.json');
  writeJson(planFile, plan);
  writeJson(join(paths.analysisDir, 'music.json'), { audio: audioPath, tempo: { ...tempo, beats: undefined, downbeats: undefined, beatCount: tempo.beats.length }, sections, scenes, lyrics });
  if (options.planOnly) return { paths, plan, tempo, sections, planFile, file: null };

  const file = options.output ?? join(paths.outputDir, options.preview ? 'music-preview.mp4' : 'music.mp4');
  await renderMusicVideo(plan, audioPath, file, { workDir: paths.rendersDir, scale: options.preview ? 0.5 : 1, concurrency: config.render.remotionConcurrency, onProgress: options.onProgress });
  return { paths, plan, tempo, sections, planFile, file };
}
