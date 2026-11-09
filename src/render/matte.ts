import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { run } from '../lib/exec.ts';
import type { ProgressFn } from '../lib/ffmpeg.ts';
import { ROOT } from '../project/paths.ts';
import type { FrameSpec } from './background.ts';

const MATTING_DIR = join(ROOT, 'matting');
const VENV_PYTHON = join(MATTING_DIR, '.venv', 'Scripts', 'python.exe');

export interface MatteOptions extends FrameSpec {
  frames: number;
  downsample: number;
  variant?: 'mobilenetv3' | 'resnet50';
  device?: 'cuda' | 'cpu';
}

/** Argumentos do sidecar; o contrato está em matting/matte.py. */
export function matteArgs(input: string, output: string, options: MatteOptions): string[] {
  return [
    join(MATTING_DIR, 'matte.py'),
    '--input', input,
    '--output', output,
    '--width', String(options.width),
    '--height', String(options.height),
    '--fps', String(options.fps),
    '--frames', String(options.frames),
    '--downsample', String(options.downsample),
    '--variant', options.variant ?? 'mobilenetv3',
    '--device', options.device ?? 'cuda',
  ];
}

/** Gera a máscara de pessoa (vídeo em cinza) de `input` com o RobustVideoMatting. */
export async function renderMatte(input: string, output: string, options: MatteOptions, onProgress?: ProgressFn): Promise<void> {
  if (!existsSync(VENV_PYTHON)) {
    throw new Error(`Ambiente de matting ausente (${VENV_PYTHON}).\nInstale com: cd matting ; uv sync  (veja o README)`);
  }
  const startedAt = Date.now();
  await run(VENV_PYTHON, matteArgs(input, output, options), {
    cwd: MATTING_DIR,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    onStderrLine: (line) => {
      const match = /^PROGRESS (\d+(?:\.\d+)?) (.*)$/.exec(line);
      if (!match || !onProgress) return;
      const percent = Number(match[1]);
      const elapsed = (Date.now() - startedAt) / 1000;
      onProgress({ label: `máscara (${match[2]})`, percent, etaSec: percent > 5 ? (elapsed / percent) * (100 - percent) : null });
    },
  });
}
