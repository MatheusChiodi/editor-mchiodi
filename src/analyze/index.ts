import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { findAnalogies } from '../analogy/detect.ts';
import { loadConfig } from '../config.ts';
import type { ProgressFn } from '../lib/ffmpeg.ts';
import { ensureProject, type ProjectPaths, readJson, slugFromFile, writeJson } from '../project/paths.ts';
import { findTechMentions } from '../tech/detect.ts';
import { detectScenes, detectSilences, ingest, measureLoudness, probe } from './media.ts';
import {
  buildPhrases,
  detectFillers,
  detectMarkers,
  detectRestarts,
  detectRetakes,
  detectVoicedGaps,
} from './speech.ts';
import { renderTakes } from './takes.ts';
import { transcribe } from './transcribe.ts';
import type { Analysis, Flag, Span, Transcript } from './types.ts';

export interface AnalyzeOptions {
  slug?: string;
  /** refaz tudo, inclusive proxy e transcrição */
  force?: boolean;
  onProgress?: ProgressFn;
  log?: (message: string) => void;
}

/** Limiar de silêncio relativo ao nível da fala: funciona em gravação baixa ou alta. */
function silenceThreshold(integratedLufs: number): number {
  return Math.round(Math.min(-28, Math.max(-50, integratedLufs - 20)));
}

export function analyzeSpeech(transcript: Transcript, silences: Span[]): { phrases: Analysis['phrases']; flags: Flag[] } {
  const phrases = buildPhrases(transcript.words);
  const flags = [
    ...detectMarkers(phrases, transcript.words),
    ...detectRetakes(phrases, transcript.words),
    ...detectRestarts(phrases, transcript.words),
    ...detectFillers(transcript.words),
    ...detectVoicedGaps(transcript.words, silences),
  ].sort((a, b) => a.start - b.start);
  return { phrases, flags };
}

export async function analyze(sourcePath: string, options: AnalyzeOptions = {}): Promise<ProjectPaths> {
  const config = loadConfig();
  const log = options.log ?? (() => {});
  const paths = ensureProject(options.slug ?? slugFromFile(sourcePath));

  const source = await probe(sourcePath);
  if (!source.hasAudio) throw new Error('O vídeo não tem trilha de áudio');
  log(`fonte: ${source.width}x${source.height} @ ${source.fps} fps, ${source.durationSec}s${source.isVfr ? ' (VFR)' : ''}`);

  const cfrSource = join(paths.analysisDir, 'source.cfr.mkv');
  let renderSource = source.isVfr ? cfrSource : source.path;
  // derivados mais novos que a fonte continuam válidos, mesmo se a análise anterior parou no meio
  const sourceTime = statSync(source.path).mtimeMs;
  const fresh = (file: string) => existsSync(file) && statSync(file).mtimeMs > sourceTime;
  const reuseMedia = !options.force && fresh(paths.proxy) && fresh(paths.audio16k) && (!source.isVfr || fresh(cfrSource));
  if (reuseMedia) {
    log('proxy e áudio já existem, reaproveitando');
  } else {
    ({ renderSource } = await ingest(source, paths, options.onProgress));
  }

  let transcript: Transcript;
  if (!options.force && reuseMedia && existsSync(paths.words)) {
    transcript = readJson<Transcript>(paths.words);
    log('transcrição já existe, reaproveitando');
  } else {
    transcript = await transcribe(paths.audio16k, paths.words, config.transcribe, options.onProgress);
    if (transcript.meta.fallback) log(`aviso: transcrição caiu para fallback (${transcript.meta.fallback})`);
  }
  if (transcript.words.length === 0) throw new Error('A transcrição não encontrou fala no vídeo');

  const loudness = await measureLoudness(paths.audio16k);
  const [silences, scenes] = await Promise.all([
    detectSilences(paths.audio16k, silenceThreshold(loudness.integratedLufs)),
    detectScenes(paths.proxy),
  ]);

  const analysis: Analysis = {
    source,
    renderSource,
    proxy: paths.proxy,
    loudness,
    silences,
    scenes,
    ...analyzeSpeech(transcript, silences),
    createdAt: new Date().toISOString(),
  };
  writeJson(paths.analysis, analysis);
  writeFileSync(paths.takes, renderTakes(analysis, config.cuts.minFlagConfidence, { analogies: findAnalogies(transcript.words, analysis.phrases), tech: findTechMentions(transcript.words) }), 'utf8');
  if (!existsSync(paths.meta)) writeJson(paths.meta, { slug: paths.slug, source: source.path, createdAt: analysis.createdAt });
  log(`${analysis.phrases.length} frases, ${analysis.flags.length} sugestões de corte → ${paths.takes}`);
  return paths;
}
