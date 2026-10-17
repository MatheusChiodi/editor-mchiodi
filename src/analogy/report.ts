import { THEME_SPECS, THEME_STATUS_LABEL } from '../../motion/src/themes/specs.ts';
import type { ThemeSpec } from '../../motion/src/themes/types.ts';
import type { Edl } from '../edl/schema.ts';
import type { Timeline } from '../edl/timeline.ts';
import { formatClock } from '../lib/time.ts';
import { UNIVERSE_CATEGORIES, UNIVERSES } from './catalog.ts';
import { type Analogy, HIGH_CONFIDENCE } from './detect.ts';
import { analogySnippet, analogyTheme, themedOverlay } from './lint.ts';

function themeLabel(analogy: Analogy): string {
  const theme = analogyTheme(analogy);
  return theme.id === analogy.universe
    ? `tema ${theme.id} (${THEME_STATUS_LABEL[theme.status]})`
    : `tema ${theme.id} (${THEME_STATUS_LABEL[theme.status]}; "${analogy.universe}" ainda não tem tema próprio)`;
}

/** Marca de uma analogia logo abaixo da frase, no estilo das marcas `>>` do takes.md. */
export function takesMark(analogy: Analogy): string {
  return `   >> ANALOGIA ${analogy.universe} [conf ${analogy.confidence.toFixed(2)}]: "${analogy.text}"${analogy.model ? ` → scene:modelos/${analogy.model}` : ''} com theme "${analogy.universe}"`;
}

/** Seção "Analogias" do cabeçalho do takes.md (vazia quando a fala não tem nenhuma). */
export function takesSection(analogies: readonly Analogy[]): string[] {
  if (analogies.length === 0) return [];
  return [
    '## Analogias',
    '',
    `Universos citados na fala. A analogia dita o visual do trecho (STYLE.md §5): cena no tema do universo; conf ≥ ${HIGH_CONFIDENCE} é cobrada na avaliação (\`analogia-sem-tema\`).`,
    'Trecho pronto da EDL: `pnpm mce analogies <projeto> -v` · temas: `pnpm mce arsenal themes`.',
    '',
    ...analogies.map(
      (analogy) =>
        `- ${formatClock(analogy.at, 2)} ${analogy.phraseId} · ${analogy.name} [conf ${analogy.confidence.toFixed(2)}] "${analogy.text}" → ${themeLabel(analogy)}${analogy.model ? ` · modelo ${analogy.model}` : ''}`,
    ),
    '',
  ];
}

export interface AnalogyReportOptions {
  edl?: Pick<Edl, 'overlays' | 'version'> | null;
  timeline?: Timeline | null;
  verbose?: boolean;
}

/** Saída do `pnpm mce analogies <slug>`: cada analogia, o tema disponível e se a EDL atual já cobre. */
export function formatAnalogies(analogies: readonly Analogy[], { edl = null, timeline = null, verbose = false }: AnalogyReportOptions = {}): string {
  if (analogies.length === 0) return 'nenhuma analogia de universo detectada na fala.';
  const lines: string[] = [];
  let missing = 0;
  for (const analogy of analogies) {
    const high = analogy.confidence >= HIGH_CONFIDENCE;
    let status = 'sem EDL';
    if (edl && timeline) {
      const overlay = themedOverlay(edl, timeline, analogy);
      if (overlay) status = `coberta por "${overlay.id}" (${overlay.component})`;
      else {
        status = high ? 'SEM TEMA na EDL' : 'sem tema na EDL (sugestão: confiança baixa)';
        if (high) missing += 1;
      }
    }
    lines.push(
      `${formatClock(analogy.at, 2)} ${analogy.phraseId}  ${analogy.name} [conf ${analogy.confidence.toFixed(2)}]  "${analogy.text}"`,
      `   ${themeLabel(analogy)} · ${analogy.model ? `modelo ${analogy.model}` : 'forma não identificada: escolha um modelo Analogia*'} · ${status}`,
    );
    if (verbose) lines.push(`   overlays[]: ${analogySnippet(analogy)}`);
  }
  const coverage = edl ? ` · EDL v${edl.version}: ${missing === 0 ? 'as de confiança alta estão no tema' : `${missing} de confiança alta sem tema`}` : '';
  return [`${analogies.length} analogia${analogies.length > 1 ? 's' : ''} na fala${coverage}`, '', ...lines].join('\n');
}

export interface ThemeItem {
  id: string;
  group: string;
  description: string;
  usage: string;
  details: string[];
}

/** Os temas como itens do `pnpm mce arsenal themes` (mesma forma dos outros catálogos). */
export function themeItems(specs: ThemeSpec[] = THEME_SPECS): ThemeItem[] {
  return specs.map((spec) => {
    const universes = UNIVERSES.filter((universe) => universe.theme === spec.id).map((universe) => universe.name);
    const category = spec.category === 'neutro' ? 'sem universo' : UNIVERSE_CATEGORIES[spec.category];
    return {
      id: spec.id,
      group: [THEME_STATUS_LABEL[spec.status], category, spec.base ? `herda de ${spec.base}` : null].filter(Boolean).join(' · '),
      description: `${spec.name} — ${spec.description}`,
      usage: `overlays[]: { "component": "scene:modelos/Analogia<Forma>", "props": { "theme": "${spec.id}" } }  ou  { "component": "ThemeFrame", "props": { "theme": "${spec.id}" } }`,
      details: [
        `· peças: ${spec.pieces.join(', ')}`,
        `· fonte de apoio: ${spec.chromeFont} · cenário ${spec.dark ? 'escuro' : 'claro'}`,
        `· direitos: ${spec.rights}`,
        ...(universes.length ? [`· universos: ${universes.join(', ')}`] : []),
      ],
    };
  });
}
