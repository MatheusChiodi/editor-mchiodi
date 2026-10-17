import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, resolve, win32 } from 'node:path';

import type { AudioSettings } from '../edl/schema.ts';
import { run } from '../lib/exec.ts';
import { ffmpeg } from '../lib/ffmpeg.ts';

/**
 * Denoise neural da voz com o binário `deep-filter` (DeepFilterNet, Rust). Roda como PRÉ-PASSO:
 * extrai a voz da fonte em WAV 48 kHz mono, limpa, mede e desfaz o atraso do modelo e guarda o
 * resultado em cache. O render usa esse WAV como entrada de áudio no lugar do original, com as
 * mesmas amostras no mesmo lugar: os cortes continuam por índice de amostra, sem conta nova.
 */

export type DenoiseMode = AudioSettings['denoise'];

/** o afftdn que entra quando o deep-filter não está disponível (o padrão da EDL) */
export const DEEPFILTER_FALLBACK: DenoiseMode = 'light';
/** o deep-filter só aceita 48 kHz */
export const DEEPFILTER_RATE = 48000;
/** atraso máximo procurado na correlação; o do modelo fica perto de 30 ms */
export const MAX_DELAY_SEC = 0.1;
/** abaixo disso a correlação não é confiável para alinhar (fonte muda, saída corrompida) */
export const MIN_CORRELATION = 0.3;
/** trecho usado para medir o atraso: o mais alto da fonte, para ter fala de verdade */
export const MEASURE_WINDOW_SEC = 20;
/** muda quando o pré-passo muda de forma que invalide os WAVs já gerados */
const CACHE_VERSION = 1;

export interface DenoisePlan {
  /** o que a cadeia de voz usa: com `deepfilter`, ela não aplica afftdn por cima */
  denoise: DenoiseMode;
  deepfilter: boolean;
  warning: string | null;
}

/** Decide o denoise efetivo: `deepfilter` sem binário cai para o afftdn, com aviso, sem quebrar o render. */
export function resolveDenoise(requested: DenoiseMode, binary: string | null): DenoisePlan {
  if (requested !== 'deepfilter') return { denoise: requested, deepfilter: false, warning: null };
  if (binary) return { denoise: 'deepfilter', deepfilter: true, warning: null };
  return fallbackPlan('binário deep-filter não encontrado (PATH, MCE_DEEPFILTER ou denoise.deepFilterPath no mce.config.json)');
}

export function fallbackPlan(reason: string): DenoisePlan {
  return { denoise: DEEPFILTER_FALLBACK, deepfilter: false, warning: `aviso: denoise deepfilter indisponível (${reason}); usando afftdn ${DEEPFILTER_FALLBACK}` };
}

export interface DeepFilterLookup {
  path: string | null;
  /** de onde veio (ou de onde deveria ter vindo) o binário */
  via: 'MCE_DEEPFILTER' | 'mce.config.json' | 'PATH' | null;
  /** caminho configurado que não existe */
  missing: string | null;
}

const DEEPFILTER_NAMES = ['deep-filter'];

/** Procura um executável nos diretórios do PATH (no Windows, com as extensões executáveis). */
export function findOnPath(names: string[], env: NodeJS.ProcessEnv, platform: NodeJS.Platform, exists: (file: string) => boolean): string | null {
  // no Windows a variável costuma se chamar "Path"
  const key = Object.keys(env).find((name) => name.toUpperCase() === 'PATH');
  const path = platform === 'win32' ? win32 : posix;
  const dirs = (key ? env[key] ?? '' : '').split(path.delimiter).filter(Boolean);
  // .cmd/.bat precisariam de shell para rodar; o binário do DeepFilterNet é um .exe
  const extensions = platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of dirs) {
    for (const name of names) {
      for (const extension of extensions) {
        const candidate = path.join(dir.replace(/^"|"$/g, ''), name + extension);
        if (exists(candidate)) return candidate;
      }
    }
  }
  return null;
}

/** Ordem: env `MCE_DEEPFILTER` > `denoise.deepFilterPath` do mce.config.json > PATH. Caminho explícito que não existe não cai no PATH. */
export function resolveDeepFilterBinary(options: {
  env: NodeJS.ProcessEnv;
  configPath: string;
  platform: NodeJS.Platform;
  exists: (file: string) => boolean;
}): DeepFilterLookup {
  const fromEnv = options.env.MCE_DEEPFILTER?.trim();
  const fromConfig = options.configPath.trim();
  const explicit = fromEnv ? { file: fromEnv, via: 'MCE_DEEPFILTER' as const } : fromConfig ? { file: fromConfig, via: 'mce.config.json' as const } : null;
  if (explicit) {
    return options.exists(explicit.file)
      ? { path: resolve(explicit.file), via: explicit.via, missing: null }
      : { path: null, via: explicit.via, missing: explicit.file };
  }
  const found = findOnPath(DEEPFILTER_NAMES, options.env, options.platform, options.exists);
  return { path: found, via: found ? 'PATH' : null, missing: null };
}

export interface DeepFilterSettings {
  /** teto de atenuação em dB; 100 = sem teto */
  attenLimDb: number;
  postFilter: boolean;
}

/** Argumentos do `deep-filter`: `-D` já compensa o atraso do STFT e do lookahead; o resíduo é medido depois. */
export function deepFilterArgs(input: string, outDir: string, settings: DeepFilterSettings): string[] {
  return [
    '-D',
    ...(settings.postFilter ? ['--pf'] : []),
    ...(settings.attenLimDb < 100 ? ['-a', String(settings.attenLimDb)] : []),
    '-o', outDir,
    input,
  ];
}

export interface SourceIdentity {
  path: string;
  size: number;
  mtimeMs: number;
}

/**
 * Chave do cache: identidade do arquivo (caminho, tamanho, mtime) + parâmetros do modelo.
 * Hash do conteúdo inteiro custaria ler GBs a cada render; tamanho + mtime pegam qualquer regravação.
 */
export function denoiseCacheKey(source: SourceIdentity, settings: DeepFilterSettings): string {
  const identity = JSON.stringify([CACHE_VERSION, resolve(source.path).toLowerCase(), source.size, Math.round(source.mtimeMs), settings.attenLimDb, settings.postFilter]);
  return createHash('sha1').update(identity).digest('hex').slice(0, 16);
}

/** Mesma reamostragem do grafo de corte: a amostra N do WAV é a amostra N que o corte recortaria da fonte. */
export const EXTRACT_FILTER = `aresample=${DEEPFILTER_RATE}:async=1:first_pts=0`;

/** RMS de cada bloco de `block` amostras. */
export function rmsPerBlock(samples: Float32Array, block: number): number[] {
  const out: number[] = [];
  for (let start = 0; start < samples.length; start += block) {
    const end = Math.min(samples.length, start + block);
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += samples[index]! * samples[index]!;
    out.push(Math.sqrt(sum / (end - start)));
  }
  return out;
}

/** Início (em blocos) da janela de `size` blocos com mais energia. */
export function loudestWindow(energy: number[], size: number): number {
  if (energy.length <= size) return 0;
  let sum = energy.slice(0, size).reduce((total, value) => total + value * value, 0);
  let best = sum;
  let bestStart = 0;
  for (let start = 1; start + size <= energy.length; start += 1) {
    sum += energy[start + size - 1]! ** 2 - energy[start - 1]! ** 2;
    if (sum > best) {
      best = sum;
      bestStart = start;
    }
  }
  return bestStart;
}

/** Média de `factor` amostras: passa-baixa grosseiro, suficiente para a busca grossa do atraso. */
export function decimate(samples: Float32Array, factor: number): Float32Array {
  const out = new Float32Array(Math.floor(samples.length / factor));
  for (let index = 0; index < out.length; index += 1) {
    let sum = 0;
    for (let offset = 0; offset < factor; offset += 1) sum += samples[index * factor + offset]!;
    out[index] = sum / factor;
  }
  return out;
}

export interface LagEstimate {
  /** amostras: positivo = `signal` atrasado em relação a `reference` */
  lag: number;
  /** correlação normalizada no melhor atraso (1 = idênticos) */
  score: number;
}

/** Correlação cruzada direta em `[minLag, maxLag]`: `signal[n + lag] ≈ reference[n]`. */
export function correlateLag(reference: Float32Array, signal: Float32Array, minLag: number, maxLag: number): LagEstimate {
  let refEnergy = 0;
  let sigEnergy = 0;
  for (const value of reference) refEnergy += value * value;
  for (const value of signal) sigEnergy += value * value;
  const norm = Math.sqrt(refEnergy * sigEnergy);
  let best: LagEstimate = { lag: 0, score: -Infinity };
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const from = Math.max(0, -lag);
    const to = Math.min(reference.length, signal.length - lag);
    let sum = 0;
    for (let index = from; index < to; index += 1) sum += reference[index]! * signal[index + lag]!;
    const score = norm > 0 ? sum / norm : 0;
    if (score > best.score) best = { lag, score };
  }
  return best;
}

/** Atraso em duas etapas: busca grossa decimada em ±`maxLag`, refinamento amostra a amostra em volta. */
export function estimateDelay(reference: Float32Array, signal: Float32Array, maxLag: number, factor = 6): LagEstimate {
  const coarseMax = Math.ceil(maxLag / factor);
  const coarse = correlateLag(decimate(reference, factor), decimate(signal, factor), -coarseMax, coarseMax);
  const center = coarse.lag * factor;
  return correlateLag(reference, signal, Math.max(-maxLag, center - factor * 2), Math.min(maxLag, center + factor * 2));
}

/** Filtros que desfazem o atraso medido e fecham o arquivo com exatamente `totalSamples`. */
export function alignFilters(lag: number, totalSamples: number): string[] {
  const shift = lag > 0 ? [`atrim=start_sample=${lag}`, 'asetpts=PTS-STARTPTS'] : lag < 0 ? [`adelay=delays=${-lag}S:all=1`] : [];
  return [...shift, 'apad', `atrim=end_sample=${totalSamples}`];
}

// ---------------------------------------------------------------- casca (ffmpeg + binário)

/** Lê `count` amostras s16le mono a partir de `start` de um PCM cru. */
function readPcm(file: string, start: number, count: number): Float32Array {
  const fd = openSync(file, 'r');
  try {
    const bytes = Buffer.alloc(count * 2);
    const read = readSync(fd, bytes, 0, bytes.length, start * 2);
    const out = new Float32Array(Math.floor(read / 2));
    for (let index = 0; index < out.length; index += 1) out[index] = bytes.readInt16LE(index * 2) / 32768;
    return out;
  } finally {
    closeSync(fd);
  }
}

/** Energia por segundo do PCM inteiro, lida em blocos (não carrega 1 h de áudio na memória). */
function energyPerSecond(file: string, rate: number): number[] {
  const total = statSync(file).size / 2;
  const energy: number[] = [];
  for (let start = 0; start < total; start += rate) energy.push(...rmsPerBlock(readPcm(file, start, Math.min(rate, total - start)), rate));
  return energy;
}

/** Mede o atraso de `clean` em relação a `original` (PCM s16le mono 48 kHz) no trecho mais alto da fonte. */
export function measureDelay(original: string, clean: string, rate = DEEPFILTER_RATE): LagEstimate {
  const start = loudestWindow(energyPerSecond(original, rate), MEASURE_WINDOW_SEC) * rate;
  const count = MEASURE_WINDOW_SEC * rate;
  return estimateDelay(readPcm(original, start, count), readPcm(clean, start, count), Math.round(MAX_DELAY_SEC * rate));
}

export type DeepFilterRunner = (binary: string, args: string[]) => Promise<void>;

const defaultRunner: DeepFilterRunner = async (binary, args) => {
  await run(binary, args);
};

export interface DeepFilterResult {
  file: string;
  cached: boolean;
  lag: number;
  score: number;
}

/**
 * Voz limpa e alinhada à fonte, em cache por fonte + parâmetros. Falha (binário quebrado,
 * correlação baixa) vira exceção: quem chama decide cair para o afftdn.
 */
export async function deepFilterVoice(
  source: string,
  cacheDir: string,
  options: DeepFilterSettings & { binary: string; runner?: DeepFilterRunner; log?: (message: string) => void },
): Promise<DeepFilterResult> {
  const stat = statSync(source);
  const key = denoiseCacheKey({ path: source, size: stat.size, mtimeMs: stat.mtimeMs }, options);
  const file = join(cacheDir, `deepfilter-${key}.wav`);
  const meta = join(cacheDir, `deepfilter-${key}.json`);
  if (existsSync(file)) return { file, cached: true, lag: 0, score: 1 };

  const work = join(cacheDir, `work-${key}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, 'out'), { recursive: true });
  try {
    const voiceWav = join(work, 'voice.wav');
    const originalPcm = join(work, 'original.pcm');
    const cleanPcm = join(work, 'clean.pcm');
    await ffmpeg(
      [
        '-i', source,
        '-map', '0:a:0', '-vn', '-af', EXTRACT_FILTER, '-ac', '1', '-c:a', 'pcm_s16le', voiceWav,
        '-map', '0:a:0', '-vn', '-af', EXTRACT_FILTER, '-ac', '1', '-f', 's16le', '-c:a', 'pcm_s16le', originalPcm,
      ],
      { label: 'denoise: extraindo a voz' },
    );
    options.log?.('denoise: rodando deep-filter');
    await (options.runner ?? defaultRunner)(options.binary, deepFilterArgs(voiceWav, join(work, 'out'), options));
    const produced = readdirSync(join(work, 'out')).find((name) => name.toLowerCase().endsWith('.wav'));
    if (!produced) throw new Error('o deep-filter não gerou WAV');
    // a saída pode vir em float ou com outro layout: normaliza para s16le mono antes de medir
    await ffmpeg(['-i', join(work, 'out', produced), '-ac', '1', '-ar', String(DEEPFILTER_RATE), '-f', 's16le', '-c:a', 'pcm_s16le', cleanPcm], {
      label: 'denoise: lendo a saída',
    });

    const { lag, score } = measureDelay(originalPcm, cleanPcm);
    if (!(score >= MIN_CORRELATION)) throw new Error(`não deu para alinhar a voz limpa (correlação ${score.toFixed(2)})`);
    const totalSamples = statSync(originalPcm).size / 2;
    const tmp = join(work, 'aligned.wav');
    await ffmpeg(
      [
        '-f', 's16le', '-ar', String(DEEPFILTER_RATE), '-ac', '1', '-i', cleanPcm,
        '-af', alignFilters(lag, totalSamples).join(','), '-c:a', 'pcm_s16le', tmp,
      ],
      { label: 'denoise: alinhando' },
    );
    renameSync(tmp, file);
    writeFileSync(meta, `${JSON.stringify({ source: resolve(source), lagSamples: lag, score, totalSamples, ...pickSettings(options) }, null, 2)}\n`, 'utf8');
    options.log?.(`denoise: deep-filter pronto (atraso residual ${lag} amostras, correlação ${score.toFixed(2)})`);
    return { file, cached: false, lag, score };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function pickSettings(settings: DeepFilterSettings): DeepFilterSettings {
  return { attenLimDb: settings.attenLimDb, postFilter: settings.postFilter };
}

export interface PreparedDenoise extends DenoisePlan {
  /** WAV limpo para usar como entrada de áudio do corte; null = áudio da própria fonte */
  audioSource: string | null;
}

/** Pré-passo do render: resolve o modo, roda (ou reaproveita) o deep-filter e cai para o afftdn em qualquer falha. */
export async function prepareDenoise(
  requested: DenoiseMode,
  source: string,
  analysisDir: string,
  options: DeepFilterSettings & { configPath: string; log: (message: string) => void; runner?: DeepFilterRunner; lookup?: DeepFilterLookup },
): Promise<PreparedDenoise> {
  if (requested !== 'deepfilter') return { ...resolveDenoise(requested, null), audioSource: null };
  const lookup = options.lookup ?? resolveDeepFilterBinary({ env: process.env, configPath: options.configPath, platform: process.platform, exists: existsSync });
  let plan = resolveDenoise(requested, lookup.path);
  if (plan.deepfilter) {
    try {
      const result = await deepFilterVoice(source, join(analysisDir, 'denoise'), { ...options, binary: lookup.path! });
      if (result.cached) options.log('denoise: deep-filter em cache');
      return { ...plan, audioSource: result.file };
    } catch (error) {
      plan = fallbackPlan(error instanceof Error ? error.message.split('\n')[0]! : String(error));
    }
  }
  if (lookup.missing) plan = fallbackPlan(`${lookup.via} aponta para "${lookup.missing}", que não existe`);
  options.log(plan.warning!);
  return { ...plan, audioSource: null };
}
