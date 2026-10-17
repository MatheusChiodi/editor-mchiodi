import { spawn } from 'node:child_process';

export interface RunOptions {
  cwd?: string;
  onStderrLine?: (line: string) => void;
  onStdoutLine?: (line: string) => void;
  env?: NodeJS.ProcessEnv;
  /** encerra o processo quando o sinal dispara (tempo esgotado, cancelamento) */
  signal?: AbortSignal;
}

export interface RunResult {
  stdout: string;
  stderr: string;
}

export class CommandError extends Error {
  constructor(
    readonly command: string,
    readonly code: number | null,
    readonly stderr: string,
  ) {
    super(`${command} saiu com código ${code}\n${stderr.split('\n').slice(-15).join('\n')}`);
  }
}

function lineSplitter(onLine?: (line: string) => void) {
  let pending = '';
  return (chunk: string) => {
    if (!onLine) return;
    pending += chunk;
    // ffmpeg usa \r para a linha de progresso
    const parts = pending.split(/\r?\n|\r/);
    pending = parts.pop() ?? '';
    for (const part of parts) if (part) onLine(part);
  };
}

/** Roda um binário sem shell: args chegam intactos, sem escape de PowerShell/cmd. */
export function run(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: options.signal,
    });
    let stdout = '';
    let stderr = '';
    const feedOut = lineSplitter(options.onStdoutLine);
    const feedErr = lineSplitter(options.onStderrLine);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
      feedOut(chunk);
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
      feedErr(chunk);
    });
    child.on('error', (error) => reject(new CommandError(command, null, String(error))));
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new CommandError(command, code, stderr));
    });
  });
}
