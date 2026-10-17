import { statfsSync } from 'node:fs';
import { freemem, totalmem } from 'node:os';

import { run } from '../lib/exec.ts';
import type { DeepFilterLookup } from '../render/denoise.ts';

const GB = 1024 ** 3;
/** Abaixo disso a máquina já matou render (16 GB de RAM no total). */
export const RAM_ALERT_BYTES = 2 * GB;
export const DISK_ALERT_BYTES = 10 * GB;
const NVIDIA_ARGS = ['--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'];

export interface Vram {
  usedMb: number;
  totalMb: number;
}

export interface Health {
  ramFreeBytes: number;
  ramTotalBytes: number;
  vram: Vram | null;
  /** espaço livre no disco dos projetos; null quando não deu para medir */
  diskFreeBytes: number | null;
}

/** Saída de `nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits` (primeira GPU). */
export function parseNvidiaSmi(stdout: string): Vram | null {
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*$/.exec(line);
    if (!match) continue;
    const usedMb = Number(match[1]);
    const totalMb = Number(match[2]);
    if (totalMb > 0) return { usedMb, totalMb };
  }
  return null;
}

export interface HealthPart {
  text: string;
  /** versão curta, para tela estreita */
  short: string;
  alert: boolean;
}

const gb = (bytes: number) => (bytes / GB).toFixed(1).replace('.', ',');
const whole = (bytes: number) => String(Math.floor(bytes / GB));

/** Os pedaços do cabeçalho: RAM livre/total, VRAM usada/total e disco livre, cada um com seu alerta. */
export function healthParts(health: Health): HealthPart[] {
  const parts: HealthPart[] = [
    {
      text: `RAM livre ${gb(health.ramFreeBytes)}/${gb(health.ramTotalBytes)} GB`,
      short: `RAM ${gb(health.ramFreeBytes)}G`,
      alert: health.ramFreeBytes < RAM_ALERT_BYTES,
    },
  ];
  if (health.vram) {
    const used = (health.vram.usedMb / 1024).toFixed(1).replace('.', ',');
    const total = (health.vram.totalMb / 1024).toFixed(1).replace('.', ',');
    parts.push({ text: `VRAM ${used}/${total} GB`, short: `VRAM ${used}/${total}`, alert: false });
  }
  if (health.diskFreeBytes !== null) {
    const low = health.diskFreeBytes < DISK_ALERT_BYTES;
    const size = low ? gb(health.diskFreeBytes) : whole(health.diskFreeBytes);
    parts.push({ text: `disco ${size} GB livres`, short: `disco ${size}G`, alert: low });
  }
  return parts;
}

export function diskFree(dir: string): number | null {
  try {
    const stats = statfsSync(dir);
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}

export function readHealth(dir: string, vram: Vram | null): Health {
  return { ramFreeBytes: freemem(), ramTotalBytes: totalmem(), vram, diskFreeBytes: diskFree(dir) };
}

type Runner = (command: string, args: string[], options: { signal: AbortSignal }) => Promise<{ stdout: string }>;

/** Uma leitura do nvidia-smi com prazo curto; sem placa, sem driver ou travado, devolve null sem reclamar. */
export async function queryVram(runner: Runner = run, timeoutMs = 2500): Promise<Vram | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return parseNvidiaSmi((await runner('nvidia-smi', NVIDIA_ARGS, { signal: controller.signal })).stdout);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface ToolCheck {
  name: string;
  ok: boolean;
  detail: string;
  /** falta que impede o pipeline de rodar (o deep-filter é opcional) */
  required: boolean;
}

/** O deep-filter é opcional: sem ele, `audio.denoise: "deepfilter"` cai para o afftdn. */
export function deepFilterCheck(lookup: DeepFilterLookup): ToolCheck {
  const base = { name: 'deep-filter', required: false };
  if (lookup.path) return { ...base, ok: true, detail: `${lookup.path} (via ${lookup.via}); audio.denoise "deepfilter" disponível` };
  if (lookup.missing) return { ...base, ok: false, detail: `${lookup.via} aponta para "${lookup.missing}", que não existe; "deepfilter" cai para afftdn` };
  return { ...base, ok: false, detail: 'não encontrado no PATH (nem MCE_DEEPFILTER / denoise.deepFilterPath); "deepfilter" cai para afftdn' };
}

/** Linhas do `mce doctor`: uma por ferramenta, `ok`/`falta`/`opcional`. */
export function doctorLines(checks: ToolCheck[]): string[] {
  const width = Math.max(...checks.map((check) => check.name.length));
  return checks.map((check) => `${check.ok ? 'ok      ' : check.required ? 'FALTA   ' : 'opcional'}  ${check.name.padEnd(width)}  ${check.detail}`);
}

export interface VramSampler {
  /** último valor lido; dispara uma leitura nova em segundo plano se a última tem mais de `everyMs` */
  current(): Vram | null;
}

/** O painel redesenha várias vezes por segundo; o nvidia-smi roda no máximo a cada `everyMs`, um por vez. */
export function createVramSampler(options: { query?: () => Promise<Vram | null>; everyMs?: number; keepMs?: number; clock?: () => number } = {}): VramSampler {
  const query = options.query ?? (() => queryVram());
  const everyMs = options.everyMs ?? 5000;
  // uma leitura que estourou o prazo (máquina ocupada no render) não apaga o número: só some se a falha persistir
  const keepMs = options.keepMs ?? 30_000;
  const clock = options.clock ?? Date.now;
  let value: Vram | null = null;
  let askedAt = -Infinity;
  let readAt = -Infinity;
  let busy = false;
  return {
    current() {
      const now = clock();
      if (!busy && now - askedAt >= everyMs) {
        busy = true;
        askedAt = now;
        void query()
          .catch(() => null)
          .then((next) => {
            if (next) {
              value = next;
              readAt = clock();
            }
            busy = false;
          });
      }
      return now - readAt <= keepMs ? value : null;
    },
  };
}
