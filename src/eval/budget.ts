import { effects } from '../arsenal/effects.ts';
import { BUDGET_KEYS, BUDGET_LABEL, type BudgetKey, type LevelProfile, type RequiredPattern, requiredCount } from '../edl/levels.ts';
import type { Edl } from '../edl/schema.ts';
import { formatClock } from '../lib/time.ts';
import type { Finding } from './checks.ts';

export const SCENE_COMPONENT = /^scene:/;

type Counted = Pick<Edl, 'zooms' | 'overlays' | 'transitions' | 'effects' | 'sfx'>;

/** Efeito de câmera é zoom para o espectador; cena ilustrativa conta à parte dos gráficos. */
export function countItems(edl: Counted): Record<BudgetKey, number> {
  const camera = edl.effects.filter((effect) => effects[effect.preset]?.category === 'camera').length;
  const scenes = edl.overlays.filter((overlay) => SCENE_COMPONENT.test(overlay.component)).length;
  return {
    zooms: edl.zooms.length + camera,
    graphics: edl.overlays.length - scenes,
    scenes,
    transitions: edl.transitions.length,
    effects: edl.effects.length - camera,
    sfx: edl.sfx.length,
  };
}

export interface BudgetRow {
  key: BudgetKey;
  label: string;
  count: number;
  min: number;
  max: number;
}

/** Quantos itens de cada tipo o nível pede para um vídeo desta duração, e quantos a EDL já tem. */
export function buildBudget(edl: Counted, durationSec: number, profile: LevelProfile): BudgetRow[] {
  const minutes = durationSec / 60;
  const counts = countItems(edl);
  return BUDGET_KEYS.map((key) => ({
    key,
    label: BUDGET_LABEL[key],
    count: counts[key],
    min: Math.floor(profile.perMinute[key].min * minutes),
    max: Math.ceil(profile.perMinute[key].max * minutes),
  }));
}

export interface RequiredRow {
  id: string;
  label: string;
  count: number;
  min: number;
  how: string;
}

/** Quantos overlays da EDL satisfazem um padrão obrigatório. */
export function countPattern(edl: Pick<Edl, 'overlays'>, pattern: RequiredPattern): number {
  return edl.overlays.filter((overlay) => {
    if (pattern.feature === 'presenter') return overlay.presenter !== null;
    if (pattern.feature === 'tear') return overlay.wipe === 'tear';
    return pattern.components?.includes(overlay.component) ?? false;
  }).length;
}

/** Padrões obrigatórios do nível × o que a EDL já tem, para um vídeo desta duração. */
export function buildRequired(edl: Pick<Edl, 'overlays'>, durationSec: number, profile: LevelProfile): RequiredRow[] {
  return profile.required.map((pattern) => ({
    id: pattern.id,
    label: pattern.label,
    count: countPattern(edl, pattern),
    min: requiredCount(pattern, durationSec),
    how: pattern.how,
  }));
}

/** Um aviso por padrão obrigatório que falta, dizendo quantos e como montar. */
export function judgeRequired(rows: RequiredRow[], profile: LevelProfile): Finding[] {
  return rows
    .filter((row) => row.count < row.min)
    .map((row) => ({
      severity: 'warning' as const,
      check: 'padrao-obrigatorio',
      at: null,
      message: `${row.label}: ${row.count} de ${row.min} (obrigatório no nível ${profile.id})`,
      fix: `adicione ${row.min - row.count}: ${row.how}`,
    }));
}

function verdict(row: BudgetRow): string {
  if (row.count < row.min) return `faltam ${row.min - row.count}`;
  if (row.count > row.max) return `sobram ${row.count - row.max}`;
  return 'ok';
}

export function formatBudget(profile: LevelProfile, durationSec: number, rows: BudgetRow[], hasMusic: boolean, required: RequiredRow[] = []): string {
  return [
    `nível ${profile.id} (${profile.label}) · ${formatClock(durationSec, 0)} de vídeo`,
    `${''.padEnd(19)} ${'agora'.padStart(5)}  ${'alvo'.padEnd(9)}`,
    ...rows.map((row) => `${row.label.padEnd(19)} ${String(row.count).padStart(5)}  ${`${row.min}–${row.max}`.padEnd(9)} ${verdict(row)}`),
    `${'trilha'.padEnd(19)} ${(hasMusic ? 'sim' : 'não').padStart(5)}  ${(profile.music ? 'sim' : 'opcional').padEnd(9)} ${profile.music && !hasMusic ? 'falta' : 'ok'}`,
    ...(required.length
      ? [
          '',
          `${'padrões obrigatórios'.padEnd(25)} ${'agora'.padStart(5)}  mínimo`,
          ...required.map((row) => `${row.label.padEnd(25)} ${String(row.count).padStart(5)}  ${String(row.min).padEnd(6)} ${row.count < row.min ? `faltam ${row.min - row.count}` : 'ok'}`),
        ]
      : []),
  ].join('\n');
}

/** Edição mais vazia ou mais cheia do que o nível escolhido pede. */
export function judgeBudget(rows: BudgetRow[], profile: LevelProfile, hasMusic: boolean): Finding[] {
  const findings: Finding[] = [];
  for (const row of rows) {
    const target = `nível ${profile.id}: ${row.min}–${row.max}`;
    if (row.count > row.max) {
      findings.push({
        severity: 'warning',
        check: 'acima-do-nivel',
        at: null,
        message: `${row.count} ${row.label} (${target})`,
        fix: `remova ${row.count - row.max}, ficando com os que mais ajudam a explicação, ou suba o nível da EDL`,
      });
    } else if (row.count < row.min) {
      findings.push({
        severity: 'warning',
        check: 'abaixo-do-nivel',
        at: null,
        message: `${row.count} ${row.label} (${target})`,
        fix: `adicione ${row.min - row.count} onde a fala der motivo (pnpm mce levels ${profile.id})`,
      });
    }
  }
  if (profile.music && !hasMusic) {
    findings.push({
      severity: 'warning',
      check: 'abaixo-do-nivel',
      at: null,
      message: `sem trilha (o nível ${profile.id} pede música do começo ao fim)`,
      fix: 'defina `music` com um arquivo de assets/music (pnpm mce assets list)',
    });
  }
  return findings;
}
