import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { StabilizeSettings } from '../edl/schema.ts';
import { run } from '../lib/exec.ts';
import { ffmpeg } from '../lib/ffmpeg.ts';
import { escapeFilterPath } from '../lib/ffpath.ts';
import type { SourceIdentity } from './denoise.ts';

/**
 * Estabilização com o vidstab do ffmpeg, em dois passos. A detecção (`vidstabdetect`) é PRÉ-PASSO
 * sobre o mesmo arquivo e a mesma cadência que o grafo de corte lê (`fps=N:start_time=0`), então o
 * frame K do .trf é o frame K que o corte recorta. A transformação (`vidstabtransform`) entra no
 * grafo de corte logo depois do `fps`, antes da escala, do recorte do Short, do zoom e do reframe:
 * é 1 frame entra, 1 frame sai, e os índices de trim e o áudio não mudam.
 */

export const VIDSTAB_FILTERS = ['vidstabdetect', 'vidstabtransform'] as const;
/** precisão da busca de movimento (1–15); a máxima custa pouco a mais na detecção */
export const DETECT_ACCURACY = 15;
/** muda quando a detecção muda de forma que invalide os .trf já gerados */
const CACHE_VERSION = 1;

/** `ffmpeg -filters` lista os dois filtros quando o build tem libvidstab. */
export function parseVidstabSupport(filtersOutput: string): boolean {
  const names = new Set(filtersOutput.split(/\r?\n/).map((line) => line.trim().split(/\s+/)[1]).filter(Boolean));
  return VIDSTAB_FILTERS.every((name) => names.has(name));
}

export interface StabilizePlan {
  enabled: boolean;
  warning: string | null;
}

/** Desligado na EDL não pergunta nada; ligado sem vidstab vira aviso, nunca erro de render. */
export function resolveStabilize(settings: StabilizeSettings, available: boolean): StabilizePlan {
  if (!settings.enabled) return { enabled: false, warning: null };
  if (available) return { enabled: true, warning: null };
  return { enabled: false, warning: 'aviso: stabilize ligado, mas este ffmpeg não tem libvidstab; seguindo sem estabilizar' };
}

/** Chave do .trf: identidade do arquivo analisado + o que muda a detecção (cadência e tremor). Suavização e zoom só mexem na transformação. */
export function stabilizeCacheKey(source: SourceIdentity, settings: Pick<StabilizeSettings, 'shakiness'>, fps: number): string {
  const identity = JSON.stringify([CACHE_VERSION, resolve(source.path).toLowerCase(), source.size, Math.round(source.mtimeMs), fps, settings.shakiness, DETECT_ACCURACY]);
  return createHash('sha1').update(identity).digest('hex').slice(0, 16);
}

/** Cadeia do pré-passo: a mesma normalização de cadência do grafo de corte, depois a detecção. */
export function detectFilters(trf: string, settings: Pick<StabilizeSettings, 'shakiness'>, fps: number): string {
  return `fps=${fps}:start_time=0,vidstabdetect=shakiness=${settings.shakiness}:accuracy=${DETECT_ACCURACY}:result=${escapeFilterPath(trf)}`;
}

/**
 * Transformação: `optzoom=1` calcula o zoom fixo mínimo que esconde as bordas; `zoom` soma por cima.
 * Zoom fixo (e não `optzoom=2`, adaptativo) para não "respirar" junto com os zooms da EDL.
 */
export function transformFilter(trf: string, settings: Pick<StabilizeSettings, 'smoothing' | 'zoom'>): string {
  const zoom = Number(settings.zoom.toFixed(2)).toString();
  return `vidstabtransform=input=${escapeFilterPath(trf)}:smoothing=${settings.smoothing}:optzoom=1:zoom=${zoom}:interpol=bicubic`;
}

// ---------------------------------------------------------------- casca (ffmpeg)

let vidstabAvailable: boolean | null = null;

/** Pergunta uma vez ao ffmpeg se ele tem os filtros do vidstab. */
export async function hasVidstab(): Promise<boolean> {
  if (vidstabAvailable !== null) return vidstabAvailable;
  try {
    vidstabAvailable = parseVidstabSupport((await run('ffmpeg', ['-hide_banner', '-filters'])).stdout);
  } catch {
    vidstabAvailable = false;
  }
  return vidstabAvailable;
}

export interface DetectResult {
  trf: string;
  cached: boolean;
}

/** Roda (ou reaproveita) a detecção sobre `input`, gravando o .trf em `cacheDir`. */
export async function detectMotion(input: string, cacheDir: string, settings: Pick<StabilizeSettings, 'shakiness'>, fps: number): Promise<DetectResult> {
  const stat = statSync(input);
  const key = stabilizeCacheKey({ path: input, size: stat.size, mtimeMs: stat.mtimeMs }, settings, fps);
  const trf = join(cacheDir, `vidstab-${key}.trf`);
  if (existsSync(trf)) return { trf, cached: true };
  mkdirSync(cacheDir, { recursive: true });
  // grava num temporário e renomeia: uma detecção interrompida não vira cache meio escrito
  const tmp = join(cacheDir, `vidstab-${key}.tmp.trf`);
  rmSync(tmp, { force: true });
  try {
    await ffmpeg(['-i', input, '-map', '0:v:0', '-an', '-vf', detectFilters(tmp, settings, fps), '-f', 'null', '-'], { label: 'estabilização: analisando o tremor' });
    renameSync(tmp, trf);
  } finally {
    rmSync(tmp, { force: true });
  }
  return { trf, cached: false };
}

export interface PreparedStabilize extends StabilizePlan {
  /** filtro para o grafo de corte; null = sem estabilização */
  transform: string | null;
}

/** Pré-passo do render: resolve, detecta (ou usa o cache) e devolve o filtro. Qualquer falha vira aviso e o render segue. */
export async function prepareStabilize(
  settings: StabilizeSettings,
  input: string,
  analysisDir: string,
  options: { fps: number; log: (message: string) => void; available?: boolean },
): Promise<PreparedStabilize> {
  if (!settings.enabled) return { enabled: false, warning: null, transform: null };
  const plan = resolveStabilize(settings, options.available ?? (await hasVidstab()));
  if (!plan.enabled) {
    options.log(plan.warning!);
    return { ...plan, transform: null };
  }
  try {
    const result = await detectMotion(input, join(analysisDir, 'stabilize'), settings, options.fps);
    options.log(`estabilização: ${result.cached ? 'análise em cache' : 'análise pronta'} (suavização ${settings.smoothing}, zoom extra ${settings.zoom}%)`);
    return { ...plan, transform: transformFilter(result.trf, settings) };
  } catch (error) {
    const warning = `aviso: estabilização falhou (${error instanceof Error ? error.message.split('\n')[0] : String(error)}); seguindo sem estabilizar`;
    options.log(warning);
    return { enabled: false, warning, transform: null };
  }
}
