import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Config } from '../config.ts';
import { CommandError, run } from '../lib/exec.ts';
import type { ProgressFn } from '../lib/ffmpeg.ts';
import { readJson, ROOT } from '../project/paths.ts';
import type { Transcript } from './types.ts';

const TRANSCRIBER_DIR = join(ROOT, 'transcriber');
const VENV_PYTHON = join(TRANSCRIBER_DIR, '.venv', 'Scripts', 'python.exe');

/** Chama o sidecar Python (WhisperX). O contrato de saída está em transcriber/transcribe.py. */
export async function transcribe(
  audioPath: string,
  outputPath: string,
  config: Config['transcribe'],
  onProgress?: ProgressFn,
): Promise<Transcript> {
  if (!existsSync(VENV_PYTHON)) {
    throw new Error(
      `Ambiente de transcrição ausente (${VENV_PYTHON}).\nInstale com: cd transcriber ; uv sync  (veja o README)`,
    );
  }
  const args = transcribeArgs(audioPath, outputPath, config);
  for (let attempt = 1; ; attempt += 1) {
    const startedAt = Date.now();
    try {
      await run(VENV_PYTHON, args, {
        cwd: TRANSCRIBER_DIR,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
        onStderrLine: (line) => {
          const match = /^PROGRESS (\d+(?:\.\d+)?) (.*)$/.exec(line);
          if (!match || !onProgress) return;
          const percent = Number(match[1]);
          const elapsed = (Date.now() - startedAt) / 1000;
          onProgress({
            label: `transcrição (${match[2]})`,
            percent,
            etaSec: percent > 5 ? (elapsed / percent) * (100 - percent) : null,
          });
        },
      });
      break;
    } catch (error) {
      // logo depois de um encode NVENC o processo às vezes morre ao iniciar a CUDA; a 2ª tentativa passa
      const crashed = error instanceof CommandError && isNativeCrash(error.code);
      if (!crashed || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }
  return readJson<Transcript>(outputPath);
}

const MAX_ATTEMPTS = 3;

/** No Windows, um processo derrubado por exceção nativa sai com NTSTATUS (0xC0000000+); `null` = morto por sinal. */
export function isNativeCrash(code: number | null): boolean {
  return code === null || code >= 0xc0000000 || code < 0;
}

export function transcribeArgs(audioPath: string, outputPath: string, config: Config['transcribe']): string[] {
  return [
    join(TRANSCRIBER_DIR, 'transcribe.py'),
    '--input', audioPath,
    '--output', outputPath,
    '--language', config.language,
    '--model', config.model,
    '--device', config.device,
    '--compute-type', config.computeType,
    '--batch-size', String(config.batchSize),
    ...(config.prompt ? ['--prompt', config.prompt] : []),
  ];
}
