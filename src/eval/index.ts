import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { findAnalogies } from '../analogy/detect.ts';
import { effects as effectPresets } from '../arsenal/effects.ts';
import { measureLoudness, probe } from '../analyze/media.ts';
import { buildPhrases } from '../analyze/speech.ts';
import { renderTimelineView, type ViewBand, viewPath } from '../analyze/timeline-view.ts';
import { transcribe } from '../analyze/transcribe.ts';
import type { Transcript } from '../analyze/types.ts';
import { loadConfig } from '../config.ts';
import { levelProfile } from '../edl/levels.ts';
import type { Edl } from '../edl/schema.ts';
import { buildTimeline, cutPoints, sourceToOutput } from '../edl/timeline.ts';
import { run } from '../lib/exec.ts';
import { formatClock } from '../lib/time.ts';
import { ffmpeg, type ProgressFn } from '../lib/ffmpeg.ts';
import { type ProjectPaths, readJson, writeJson } from '../project/paths.ts';
import { bumperDurations } from '../render/bumpers.ts';
import { buildCaptions } from '../render/captions.ts';
import { AUDIO_RATE } from '../render/cuts.ts';
import { loadSceneLinks } from '../scenes/models.ts';
import { findTechMentions } from '../tech/detect.ts';
import {
  compareWords,
  type Finding,
  findCutWords,
  judgeCuts,
  judgeDuration,
  judgeLoudness,
  judgeSync,
  lintStyle,
  measureCuts,
  speechLevel,
  type TimedWord,
} from './checks.ts';
import {
  clipEdges,
  type DecisionPoint,
  findCaptionOverGraphic,
  findTightEdges,
  judgeJoins,
  judgeJumps,
  jumpScore,
  measureJoins,
  rankDecisionPoints,
} from './edges.ts';
import { findMissingTechIcons } from './tech.ts';
import { measureJumpCuts, renderContactSheet } from './visual.ts';

export interface EvalOptions {
  /** retranscreve o vídeo renderizado para conferir sincronia das legendas (usa a GPU) */
  transcribe: boolean;
  /** quantas imagens de corte gerar para inspeção visual */
  maxViews: number;
  onProgress?: ProgressFn;
}

export interface EvalReport {
  edlVersion: number;
  file: string;
  createdAt: string;
  passed: boolean;
  metrics: {
    durationSec: number;
    expectedSec: number;
    loudnessLufs: number;
    truePeakDb: number;
    cuts: number;
    captionOffsetMs: number | null;
    wordsMatched: number | null;
  };
  findings: Finding[];
  /** PNGs para o diretor abrir e julgar o que não dá para medir (salto visual, texto ilegível) */
  views: { at: number; why: string; file: string }[];
  /** prancha de contato: os cortes mais suspeitos, quadro antes | depois (ausente em avaliações antigas) */
  contactSheet?: string | null;
  decisionPoints?: DecisionPoint[];
}

async function streamDuration(file: string, stream: 'v:0' | 'a:0'): Promise<number> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-select_streams', stream, '-show_entries', 'stream=duration:format=duration',
    '-of', 'default=nw=1:nk=1', file,
  ]);
  const value = stdout.split(/\r?\n/).map(Number).find((item) => Number.isFinite(item) && item > 0);
  return value ?? 0;
}

async function loadSamples(file: string, workDir: string): Promise<Float32Array> {
  const pcm = join(workDir, 'audio.pcm');
  await ffmpeg(['-i', file, '-vn', '-ac', '1', '-ar', String(AUDIO_RATE), '-f', 's16le', pcm]);
  const raw = readFileSync(pcm);
  rmSync(pcm);
  const samples = new Float32Array(raw.length / 2);
  for (let index = 0; index < samples.length; index += 1) samples[index] = raw.readInt16LE(index * 2) / 32768;
  return samples;
}

export function shiftTimes(times: number[], offset: number): number[] {
  return offset === 0 ? times : times.map((time) => time + offset);
}

/** Escolhe os pontos que valem uma imagem: cortes com problema primeiro, depois overlays, depois amostra de cortes. */
export function pickViewpoints(
  cuts: number[],
  overlays: { id: string; at: number; duration: number }[],
  findings: Finding[],
  limit: number,
): { at: number; why: string }[] {
  const points: { at: number; why: string }[] = [];
  const add = (at: number, why: string) => {
    if (points.length < limit && !points.some((point) => Math.abs(point.at - at) < 1)) points.push({ at, why });
  };
  for (const finding of findings) if (finding.at !== null) add(finding.at, finding.check);
  for (const overlay of overlays) add(overlay.at + Math.min(overlay.duration / 2, 1.2), `overlay ${overlay.id}`);
  const step = Math.max(1, Math.ceil(cuts.length / Math.max(1, limit - points.length)));
  for (let index = 0; index < cuts.length; index += step) add(cuts[index]!, 'corte (amostra)');
  return points.sort((a, b) => a.at - b.at);
}

/**
 * Autoavaliação: analisa o vídeo RENDERIZADO (não a EDL) e devolve o que precisa mudar.
 * Erros reprovam; avisos pedem que o diretor olhe a imagem e decida.
 */
export async function evaluate(paths: ProjectPaths, edl: Edl, file: string, dir: string, options: EvalOptions): Promise<EvalReport> {
  const config = loadConfig();
  const workDir = join(dir, 'eval');
  mkdirSync(workDir, { recursive: true });
  const source = readJson<Transcript>(paths.words);
  const timeline = buildTimeline(edl.clips, edl.output.fps);
  // a vinheta de abertura empurra todo o conteúdo para a frente no arquivo final
  const { introSec, outroSec } = bumperDurations(edl);
  const expectedSec = timeline.durationSec + introSec + outroSec;
  const cuts = shiftTimes(cutPoints(timeline), introSec);

  const profile = levelProfile(edl.level);
  const out = (time: number) => sourceToOutput(timeline, time);
  const placedOverlays = edl.overlays.flatMap((overlay) => {
    const start = out(overlay.at);
    return start === null ? [] : [{ ...overlay, out: start }];
  });
  // a legenda `long` mora na faixa inferior; no `shorts` ela fica a 420 px da base, acima dos lower thirds
  const captionSpans = edl.captions.enabled && edl.captions.style === 'long'
    ? buildCaptions(source.words, timeline, edl.captions).map((caption) => ({ start: caption.startMs / 1000, end: caption.endMs / 1000 }))
    : [];

  const findings: Finding[] = [...findCutWords(edl, source.words, timeline), ...findTightEdges(timeline, source.words), ...findCaptionOverGraphic(placedOverlays, captionSpans), ...lintStyle(edl, timeline, undefined, loadSceneLinks(), source.words, findAnalogies(source.words, buildPhrases(source.words))), ...findMissingTechIcons(edl, timeline, findTechMentions(source.words), levelProfile(edl.level))].map((finding) =>
    finding.at === null ? finding : { ...finding, at: finding.at + introSec },
  );

  const [videoSec, audioSec] = await Promise.all([streamDuration(file, 'v:0'), streamDuration(file, 'a:0')]);
  findings.push(...judgeDuration(videoSec, audioSec, expectedSec, edl.output.fps));

  const loudness = await measureLoudness(file);
  findings.push(...judgeLoudness(loudness.integratedLufs, loudness.truePeakDb, edl.audio.targetLufs, edl.audio.truePeakDb));

  const samples = await loadSamples(file, workDir);
  const cutFindings = judgeCuts(measureCuts(samples, AUDIO_RATE, cuts));
  findings.push(...cutFindings);
  const popped = cutFindings.filter((finding) => finding.check === 'estalo').map((finding) => finding.at!);
  findings.push(...judgeJoins(measureJoins(samples, AUDIO_RATE, cuts, speechLevel(samples, AUDIO_RATE)), popped));

  // jump cut: só as junções que são corte de verdade (a fonte não continua de um clipe para o outro)
  const info = await probe(file);
  const realCuts = clipEdges(timeline)
    .filter((edge) => edge.side === 'início' && edge.clip !== timeline.clips[0])
    .map((edge) => ({ at: edge.at + introSec, clip: edge.clip }));
  const jumps = await measureJumpCuts(file, realCuts, { fps: edl.output.fps, width: info.width, height: info.height }, workDir);
  const zoomsAt = [...edl.zooms, ...edl.effects.filter((effect) => effectPresets[effect.preset]?.category === 'camera')]
    .flatMap((zoom) => {
      const start = out(zoom.at);
      return start === null ? [] : [start + introSec];
    });
  findings.push(...judgeJumps(jumps, {
    level: profile.id,
    zoomMinGapSec: profile.limits.zoomMinGapSec,
    zoomsAt,
    transitionInto: new Set(edl.transitions.map((transition) => transition.intoClip)),
  }));

  let captionOffsetMs: number | null = null;
  let wordsMatched: number | null = null;
  let heard: TimedWord[] = [];
  if (options.transcribe) {
    const wav = join(workDir, 'rendered16k.wav');
    await ffmpeg(['-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
    const rendered = await transcribe(wav, join(workDir, 'rendered.words.json'), config.transcribe, options.onProgress);
    rmSync(wav);
    heard = rendered.words;
    const expected: TimedWord[] = buildCaptions(source.words, timeline, { ...edl.captions, enabled: true }).map((caption) => ({
      text: caption.text,
      start: caption.startMs / 1000 + introSec,
      end: caption.endMs / 1000 + introSec,
    }));
    const sync = compareWords(expected, heard);
    captionOffsetMs = Math.round(sync.medianOffset * 1000);
    wordsMatched = sync.matched;
    findings.push(...judgeSync(sync, cuts));
  }

  const overlays = edl.overlays.map((overlay) => ({
    id: overlay.id,
    at: (sourceToOutput(timeline, overlay.at) ?? 0) + introSec,
    duration: overlay.duration,
  }));
  const decisionPoints = rankDecisionPoints(cuts, findings, new Map(jumps.map((jump) => [jump.at, jumpScore(jump.diff)])), Math.max(1, options.maxViews));
  const contactSheet = await renderContactSheet(
    file,
    decisionPoints,
    { fps: edl.output.fps, width: info.width, height: info.height },
    `${edl.project} · v${edl.version} · cortes mais suspeitos (último quadro antes | primeiro depois)`,
    join(workDir, 'contact-sheet.png'),
  );

  const bands: ViewBand[] = [];
  const views: EvalReport['views'] = [];
  for (const point of pickViewpoints(cuts, overlays, findings, options.maxViews)) {
    const from = Math.max(0, point.at - 1.5);
    const to = Math.min(info.durationSec, point.at + 1.5);
    const output = viewPath(workDir, from, to, 'out');
    await renderTimelineView({
      title: `${edl.project} · v${edl.version} · renderizado · ${point.why}`,
      from,
      to,
      video: file,
      words: heard,
      bands,
      markers: cuts.filter((cut) => cut >= from && cut <= to).map((cut) => ({ at: cut, label: 'corte' })),
      output,
    });
    views.push({ ...point, file: output });
  }

  const report: EvalReport = {
    edlVersion: edl.version,
    file,
    createdAt: new Date().toISOString(),
    passed: !findings.some((finding) => finding.severity === 'error'),
    metrics: {
      durationSec: videoSec,
      expectedSec,
      loudnessLufs: loudness.integratedLufs,
      truePeakDb: loudness.truePeakDb,
      cuts: cuts.length,
      captionOffsetMs,
      wordsMatched,
    },
    findings,
    views,
    contactSheet,
    decisionPoints,
  };
  writeJson(join(dir, 'eval.json'), report);
  return report;
}

/** Todas as avaliações já feitas no projeto (uma por pasta de render), em ordem cronológica. */
export function collectEvaluations(rendersDir: string): EvalReport[] {
  if (!existsSync(rendersDir)) return [];
  return readdirSync(rendersDir)
    .map((name) => join(rendersDir, name, 'eval.json'))
    .filter((file) => existsSync(file))
    .map((file) => readJson<EvalReport>(file))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function formatReport(report: EvalReport): string {
  const { metrics } = report;
  const lines = [
    `autoavaliação da EDL v${report.edlVersion}: ${report.passed ? 'APROVADO' : 'REPROVADO'}`,
    `duração ${metrics.durationSec.toFixed(2)}s (esperado ${metrics.expectedSec.toFixed(2)}s) · ${metrics.cuts} cortes · ${metrics.loudnessLufs.toFixed(1)} LUFS · pico ${metrics.truePeakDb.toFixed(1)} dBTP` +
      (metrics.captionOffsetMs === null ? '' : ` · legenda ${metrics.captionOffsetMs >= 0 ? '+' : ''}${metrics.captionOffsetMs} ms`),
  ];
  for (const finding of report.findings) {
    lines.push(`[${finding.severity === 'error' ? 'ERRO' : 'aviso'}] ${finding.check}: ${finding.message}`, `        → ${finding.fix}`);
  }
  if (report.findings.length === 0) lines.push('nenhum problema medido.');
  if (report.contactSheet) {
    lines.push('', `prancha de contato (${report.decisionPoints?.length ?? 0} cortes mais suspeitos, antes | depois): ${report.contactSheet}`);
    for (const [index, point] of (report.decisionPoints ?? []).entries()) {
      lines.push(`  #${index + 1} ${formatClock(point.at)}  ${point.checks.join(', ') || 'salto visual'}`);
    }
  }
  if (report.views.length) {
    lines.push('', 'abra estas imagens e confira salto visual, legenda cobrindo algo e texto ilegível:');
    for (const view of report.views) lines.push(`  ${view.file}  (${view.why})`);
  }
  return lines.join('\n');
}
