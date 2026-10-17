import { existsSync, readFileSync } from 'node:fs';

import { detectFocusTrack, manualTrackPath, parseFocusTrackFile } from '../analyze/focus.ts';
import type { Analysis } from '../analyze/types.ts';
import type { Edl } from '../edl/schema.ts';
import type { ProgressFn } from '../lib/ffmpeg.ts';
import { formatClock } from '../lib/time.ts';
import { type ProjectPaths, readJson } from '../project/paths.ts';
import { cropFraction, type FocusPlan, type FocusSample, planFocus, type ResolvedFocus } from './focus.ts';
import { shortsSpans } from './shorts.ts';

export interface ShortFocusResult {
  plan: FocusPlan;
  /** de onde veio a série: detector (cacheado) ou analysis/focus-track.json */
  origin: 'detector' | 'manual';
}

export interface ShortFocusOptions {
  /** refaz a detecção mesmo com cache válido */
  force?: boolean;
  onProgress?: ProgressFn;
}

/** Série do apresentador: o track à mão (analysis/focus-track.json) vence o detector. */
async function loadSamples(paths: ProjectPaths, edl: Edl, options: ShortFocusOptions): Promise<{ samples: FocusSample[]; origin: ShortFocusResult['origin'] }> {
  const manual = manualTrackPath(paths.analysisDir);
  if (existsSync(manual)) return { samples: parseFocusTrackFile(JSON.parse(readFileSync(manual, 'utf8'))), origin: 'manual' };
  const proxy = existsSync(paths.analysis) ? readJson<Analysis>(paths.analysis).proxy : paths.proxy;
  if (!proxy || !existsSync(proxy)) throw new Error(`foco auto precisa do proxy da análise (${proxy || paths.proxy}); rode pnpm mce analyze`);
  const track = await detectFocusTrack(proxy, {
    cacheDir: paths.analysisDir,
    video: { width: edl.source.width, height: edl.source.height, durationSec: edl.source.durationSec },
    force: options.force,
    onProgress: options.onProgress,
  });
  return { samples: track.samples, origin: 'detector' };
}

/** Plano de foco para o trecho de `edl.shorts` (detecta ou lê o track, e planeja por trecho contínuo). */
export async function planShortFocus(paths: ProjectPaths, edl: Edl, options: ShortFocusOptions = {}): Promise<ShortFocusResult> {
  if (!edl.shorts) throw new Error('A EDL não define `shorts` (trecho do vídeo para o formato vertical)');
  const { samples, origin } = await loadSamples(paths, edl, options);
  const focus = edl.shorts.focusX;
  const plan = planFocus(samples, shortsSpans(edl), {
    crop: cropFraction(edl.source.width, edl.source.height),
    fallback: typeof focus === 'number' ? focus : 0.5,
  });
  return { plan, origin };
}

/** O que o recorte do Short usa: `"auto"` vira o plano; número e keyframes passam direto. */
export async function resolveShortFocus(paths: ProjectPaths, edl: Edl, options: ShortFocusOptions = {}): Promise<ResolvedFocus> {
  const focus = edl.shorts?.focusX ?? 0.5;
  if (focus !== 'auto') return focus;
  return (await planShortFocus(paths, edl, options)).plan.focus;
}

/** Resumo para o terminal: decisão, variação, trechos e keyframes. */
export function formatFocusPlan(result: ShortFocusResult): string {
  const { plan } = result;
  const lines = [
    `foco ${plan.mode === 'fixed' ? `FIXO em ${(plan.focus as number).toFixed(3)}` : `PAN com ${(plan.focus as unknown[]).length} keyframes`}` +
      ` · variação do apresentador ${plan.spreadPx.toFixed(0)} px (ref. 1920) · ${plan.samples} amostras (${result.origin === 'manual' ? 'focus-track.json' : 'detector'})`,
  ];
  for (const segment of plan.segments) {
    lines.push(`  ${formatClock(segment.start)}–${formatClock(segment.end)}  ${segment.mode.padEnd(5)}  centro ${segment.center.toFixed(3)}`);
  }
  if (Array.isArray(plan.focus)) {
    const shown = plan.focus.length > 24 ? [...plan.focus.slice(0, 12), null, ...plan.focus.slice(-12)] : plan.focus;
    lines.push('keyframes (t fonte → x):');
    for (const key of shown) lines.push(key ? `  ${key.t.toFixed(3).padStart(9)}  ${key.x.toFixed(4)}` : '  …');
  }
  return lines.join('\n');
}
