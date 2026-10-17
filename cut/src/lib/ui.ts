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

/** Linha de log do job → progresso, quando o processo não escreve live.json (ex.: "  42%"). */
export function percentFromLine(line: string): number | null {
  const match = /(\d{1,3}(?:[.,]\d+)?)\s?%/.exec(line);
  if (!match) return null;
  const value = Number(match[1]!.replace(',', '.'));
  return value >= 0 && value <= 100 ? value : null;
}
