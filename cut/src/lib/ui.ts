import type { TimeMap } from './timemap.ts';

/**
 * Tokens de motion/src/theme.ts → variáveis CSS que o Tailwind (@theme) consome. A UI não repete valor de cor:
 * `--mc-coral` vem do tema da marca.
 */
export function themeCssVars(theme: { color: Record<string, string>; font: Record<string, string> }): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme.color)) vars[`--mc-${name.replace(/[A-Z0-9]+/g, (part) => `-${part.toLowerCase()}`)}`] = value;
  for (const [name, value] of Object.entries(theme.font)) vars[`--mc-font-${name}`] = value;
  return vars;
}

/** `#rrggbb` + alfa → `rgba()` (superfícies translúcidas a partir dos tokens). */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export interface EvalFinding {
  severity: string;
  check: string;
  at: number | null;
  message: string;
  fix: string;
  outputSec: number | null;
  sourceSec: number | null;
}

export interface EvalMarker {
  x: number;
  severity: string;
  check: string;
  message: string;
  sourceSec: number;
  index: number;
}

/**
 * Achados do `mce eval` como marcadores. O achado foi medido numa versão da EDL (talvez anterior): o que localiza é o
 * instante da FONTE, que não muda com os cortes; achado sem instante não vira marcador.
 */
export function evalMarkers(findings: EvalFinding[], map: TimeMap): EvalMarker[] {
  const markers: EvalMarker[] = [];
  findings.forEach((finding, index) => {
    if (finding.sourceSec === null) return;
    markers.push({ x: map.toXClamped(finding.sourceSec), severity: finding.severity, check: finding.check, message: finding.message, sourceSec: finding.sourceSec, index });
  });
  return markers;
}

/** Linha de orçamento do nível (itens por minuto) e quanto a EDL atual usa. */
export function budgetUse(count: number, durationSec: number, rate: { min: number; max: number }): { perMinute: number; status: 'abaixo' | 'ok' | 'acima' | 'proibido' } {
  const perMinute = durationSec > 0 ? count / (durationSec / 60) : 0;
  if (rate.max === 0) return { perMinute, status: count > 0 ? 'proibido' : 'ok' };
  if (perMinute > rate.max + 1e-9) return { perMinute, status: 'acima' };
  if (perMinute < rate.min - 1e-9) return { perMinute, status: 'abaixo' };
  return { perMinute, status: 'ok' };
}

/** Duração de saída no header: `m:ss` (ou `h:mm:ss`). */
export function formatClock(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export interface ActivityChip {
  id: 'job' | 'claude';
  label: string;
  tone: 'peri' | 'coral' | 'emerald';
  /** 0–100 quando há progresso conhecido */
  percent: number | null;
}

/** O que está rodando em segundo plano, para o header: render/eval/export e a sessão do Claude. */
export function activityChips(input: {
  job: { kind: string; status: string } | null;
  progress: { percent: number } | null;
  claudeRunning: boolean;
}): ActivityChip[] {
  const chips: ActivityChip[] = [];
  if (input.job?.status === 'running') {
    const percent = input.progress ? Math.min(100, Math.max(0, Math.round(input.progress.percent))) : null;
    chips.push({ id: 'job', label: percent === null ? `${input.job.kind}…` : `${input.job.kind} ${percent}%`, tone: 'peri', percent });
  }
  if (input.claudeRunning) chips.push({ id: 'claude', label: 'Claude editando…', tone: 'coral', percent: null });
  return chips;
}

/** Linha de log do job → progresso, quando o processo não escreve live.json (ex.: "  42%"). */
export function percentFromLine(line: string): number | null {
  const match = /(\d{1,3}(?:[.,]\d+)?)\s?%/.exec(line);
  if (!match) return null;
  const value = Number(match[1]!.replace(',', '.'));
  return value >= 0 && value <= 100 ? value : null;
}
