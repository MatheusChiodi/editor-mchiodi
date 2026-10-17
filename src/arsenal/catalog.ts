import { entrances } from '../../motion/src/arsenal/entrances.ts';
import { registry } from '../../motion/src/components/registry.ts';
import { themeItems } from '../analogy/report.ts';
import { loadScenes, modelsOf, modelSnippet, type SceneInfo } from '../scenes/models.ts';
import { techCatalogItems } from '../tech/report.ts';
import { effects } from './effects.ts';
import { transitions } from './transitions.ts';

export type ArsenalKind = 'components' | 'models' | 'themes' | 'tech' | 'entrances' | 'transitions' | 'effects';
export const ARSENAL_KINDS: ArsenalKind[] = ['components', 'models', 'themes', 'tech', 'entrances', 'transitions', 'effects'];

export interface CatalogItem {
  id: string;
  /** agrupamento dentro da categoria (tipo, energia, etc.) */
  group: string;
  description: string;
  /** como usar na EDL */
  usage: string;
  /** linhas extras do modo detalhado (os slots de um modelo); também entram na busca */
  details?: string[];
}

/** Modelo de animação (motion/src/scenes/modelos/) como item do catálogo: tags, origem e duração no grupo, slots no detalhe. */
export function modelItem(model: SceneInfo): CatalogItem {
  const group = [
    `${model.defaultDuration ?? '?'}s`,
    model.tags.join(', ') || 'sem tags',
    model.origin ? `nasceu em ${model.origin.project} (${model.origin.date})` : 'origem não registrada',
  ].join(' · ');
  return {
    id: model.name,
    group,
    description: model.description ?? '(sem descrição)',
    usage: `overlays[]: ${modelSnippet(model)}`,
    details: model.slots.map((slot) => `· ${slot.name}: ${slot.type} — ${slot.description}`),
  };
}

/** Componentes internos, que a EDL não referencia diretamente. */
const INTERNAL_COMPONENTS = new Set(['Stinger', 'Fx', 'Intro', 'Outro']);

function compact(value: unknown): string {
  const text = JSON.stringify(value);
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

/**
 * Tudo que já existe pronto. O diretor consulta isto antes de pedir algo novo ao motion-designer.
 * `scenesDir` só muda de onde os modelos são lidos (testes).
 */
export function catalog(kind: ArsenalKind, scenesDir?: string): CatalogItem[] {
  switch (kind) {
    case 'models':
      return modelsOf(loadScenes(scenesDir)).map(modelItem);
    case 'themes':
      // temas de universo para as analogias (motion/src/themes): valor da prop `theme` dos modelos Analogia* e do ThemeFrame
      return themeItems();
    case 'tech':
      // tecnologias com ícone (src/tech/catalog.ts): o id vale em qualquer prop de ícone como `tech:<id>` e no TechBadge/TechRow
      return techCatalogItems();
    case 'components':
      return Object.entries(registry)
        .filter(([name]) => !INTERNAL_COMPONENTS.has(name))
        .map(([name, entry]) => ({
          id: name,
          group: `${entry.defaultDuration}s`,
          description: entry.description,
          usage: `overlays[]: { "component": "${name}", "duration": ${entry.defaultDuration}, "props": ${compact(entry.sample)} }`,
        }));
    case 'entrances':
      return Object.values(entrances).map((preset) => ({
        id: preset.id,
        group: `${preset.category} · ${preset.unit}`,
        description: `${preset.label} — ${preset.description}`,
        usage: `overlays[]: { "component": "TextReveal", "props": { "text": "...", "entrance": "${preset.id}" } }`,
      }));
    case 'transitions':
      return Object.values(transitions).map((preset) => ({
        id: preset.id,
        group: `${preset.kind} · ${preset.energy} · ${preset.tone}`,
        description: `${preset.label} — ${preset.description}`,
        usage: `transitions[]: { "intoClip": "<clipe>", "type": "${preset.id}" }  (padrão ${preset.defaultDuration}s)`,
      }));
    case 'effects':
      return Object.values(effects).map((preset) => ({
        id: preset.id,
        group: `${preset.category} · ${preset.kind} · ${preset.tone}`,
        description: `${preset.label} — ${preset.description}`,
        usage: `effects[]: { "preset": "${preset.id}", "at": <s>, ${preset.defaultDuration === null ? '"duration": <s>' : `"duration": ${preset.defaultDuration}`}, "intensity": ${preset.defaultIntensity} }`,
      }));
  }
}

export function counts(): Record<ArsenalKind, number> {
  return Object.fromEntries(ARSENAL_KINDS.map((kind) => [kind, catalog(kind).length])) as Record<ArsenalKind, number>;
}

/** Busca por texto no id, grupo e descrição, sem acento nem caixa. */
export function search(items: CatalogItem[], query: string): CatalogItem[] {
  const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;
  return items.filter((item) => {
    const haystack = normalize(`${item.id} ${item.group} ${item.description} ${(item.details ?? []).join(' ')}`);
    return terms.every((term) => haystack.includes(term));
  });
}

export function formatCatalog(items: CatalogItem[], verbose: boolean): string {
  return items
    .map((item) =>
      verbose
        ? [`${item.id}  [${item.group}]`, `   ${item.description}`, ...(item.details ?? []).map((line) => `   ${line}`), `   ${item.usage}`].join('\n')
        : `${item.id.padEnd(22)} [${item.group}] ${item.description}`,
    )
    .join('\n');
}
