import { run } from './exec.ts';

export interface ProgressInfo {
  label: string;
  percent: number;
  etaSec: number | null;
}

export type ProgressFn = (info: ProgressInfo) => void;

/** Barra de progresso de uma linha, com ETA. Em modo headless (sem TTY) imprime a cada 10%. */
export function consoleProgress(): ProgressFn {
  let lastBucket = -1;
  return ({ label, percent, etaSec }) => {
    const eta = etaSec === null ? '' : ` · faltam ~${formatEta(etaSec)}`;
    if (process.stderr.isTTY) {
      process.stderr.write(`\r${label}: ${percent.toFixed(0).padStart(3)}%${eta}      `);
      if (percent >= 100) process.stderr.write('\n');
      return;
    }
    const bucket = Math.floor(percent / 10);
    if (bucket !== lastBucket) {
      lastBucket = bucket;
      process.stderr.write(`${label}: ${percent.toFixed(0)}%${eta}\n`);
    }
  };
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  return `${Math.floor(seconds / 60)}min ${Math.round(seconds % 60)}s`;
}

function parseFfmpegTime(line: string): number | null {
  const match = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export interface FfmpegOptions {
  label?: string;
  /** duração esperada da saída, para calcular o percentual */
  durationSec?: number;
  onProgress?: ProgressFn;
  cwd?: string;
}

export async function ffmpeg(args: string[], options: FfmpegOptions = {}): Promise<string> {
  const startedAt = Date.now();
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-y', '-nostdin', ...args], {
    cwd: options.cwd,
    onStderrLine: (line) => {
      if (!options.onProgress || !options.durationSec) return;
      const time = parseFfmpegTime(line);
      if (time === null) return;
      const ratio = Math.min(1, time / options.durationSec);
      const elapsed = (Date.now() - startedAt) / 1000;
      const etaSec = ratio > 0.02 ? (elapsed / ratio) * (1 - ratio) : null;
      options.onProgress({ label: options.label ?? 'ffmpeg', percent: ratio * 100, etaSec });
    },
  });
  if (options.onProgress && options.durationSec) {
    options.onProgress({ label: options.label ?? 'ffmpeg', percent: 100, etaSec: 0 });
  }
  return stderr;
}

let nvencAvailable: boolean | null = null;

/** Estar listado em `-encoders` não garante que o NVENC funciona; testa de verdade uma vez. */
export async function hasNvenc(): Promise<boolean> {
  if (nvencAvailable !== null) return nvencAvailable;
  try {
    await run('ffmpeg', [
      '-hide_banner', '-nostdin', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:r=30:d=0.2',
      '-c:v', 'h264_nvenc', '-f', 'null', '-',
    ]);
    nvencAvailable = true;
  } catch {
    nvencAvailable = false;
  }
  return nvencAvailable;
}

export type Quality = 'proxy' | 'preview' | 'mezzanine' | 'final';

/** Args de encode de vídeo H.264, com NVENC quando disponível. */
export async function videoEncodeArgs(quality: Quality): Promise<string[]> {
  const nvenc = await hasNvenc();
  const level = { proxy: 30, preview: 27, mezzanine: 14, final: 18 }[quality];
  if (nvenc) {
    const preset = quality === 'final' || quality === 'mezzanine' ? 'p6' : 'p3';
    return [
      '-c:v', 'h264_nvenc', '-preset', preset, '-tune', 'hq', '-rc', 'vbr', '-cq', String(level), '-b:v', '0',
      ...(quality === 'final' ? ['-spatial-aq', '1', '-temporal-aq', '1', '-rc-lookahead', '20', '-bf', '3'] : []),
      '-pix_fmt', 'yuv420p',
    ];
  }
  const preset = quality === 'final' || quality === 'mezzanine' ? 'slow' : 'veryfast';
  return ['-c:v', 'libx264', '-preset', preset, '-crf', String(level), '-pix_fmt', 'yuv420p'];
}
