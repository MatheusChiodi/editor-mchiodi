import type { Edl } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { formatClock } from '../lib/time.ts';
import { iconSource, TECH_BY_ID, TECH_PREFIX, TECHS, type Tech } from './catalog.ts';
import { summarizeTech, type TechMention, type TechSummary } from './detect.ts';
import { overlayTechIds } from './overlay.ts';

const stamp = (seconds: number) => formatClock(seconds, 2);

/** Seção "Tecnologias citadas" do takes.md; vazia quando a fala não cita nenhuma. */
export function takesTechSection(mentions: readonly TechMention[]): string[] {
  const all = summarizeTech(mentions);
  if (all.length === 0) return [];
  const sure = all.filter((item) => item.confidence === 'high');
  const maybe = all.filter((item) => item.confidence === 'low');
  const lines = ['## Tecnologias citadas', ''];
  if (sure.length) {
    lines.push('Cada uma ganha o ícone na PRIMEIRA menção (`tech:<id>` num ícone, `TechBadge`, `TechRow` ou rótulo com o nome). Confira: `pnpm mce tech <projeto>`.', '');
    for (const item of sure) lines.push(`- ${item.name} (\`${TECH_PREFIX}${item.tech}\`) · ${item.count}x · primeira em ${stamp(item.first)}${heardAs(item)}`);
  }
  if (maybe.length) {
    lines.push(
      ...(sure.length ? [''] : []),
      `Confiança baixa (palavra comum, sem contexto de tecnologia; não é cobrada): ${maybe.map((item) => `${item.name} ${item.count}x (${stamp(item.first)})`).join(' · ')}`,
    );
  }
  lines.push('');
  return lines;
}

/** Mostra a transcrição quando ela difere do nome ("riéqui"): é o que o diretor vai procurar na frase. */
function heardAs(item: TechSummary): string {
  const clean = (text: string) => text.replace(/[.,;:…!?"'()]+/g, '').trim();
  const variants = [...new Set(item.mentions.map((mention) => clean(mention.heard)))].filter((heard) => heard.toLowerCase() !== item.name.toLowerCase());
  return variants.length ? ` · transcrito como "${variants.join('", "')}"` : '';
}

/** Marca no fim da linha da frase: ` [tech: HTML, CSS]`. Só as de confiança alta, sem repetir. */
export function phraseTechMark(mentions: readonly TechMention[], phrase: { from: number; to: number }): string {
  const names = [...new Set(mentions.filter((mention) => mention.confidence === 'high' && mention.wordIndex >= phrase.from && mention.wordIndex < phrase.to).map((mention) => mention.name))];
  return names.length ? `  [tech: ${names.join(', ')}]` : '';
}

export interface TechCoverageRow {
  tech: string;
  name: string;
  count: number;
  confidence: TechSummary['confidence'];
  /** menções que sobreviveram ao corte: fonte e saída */
  kept: { source: number; output: number }[];
  /** menções cortadas da EDL */
  cut: number;
  /** overlays que mostram o ícone desta tecnologia, na ordem do vídeo */
  shownBy: { id: string; component: string; output: number }[];
}

/** Para o `mce tech`: cada tecnologia citada, onde, e que overlays da EDL já mostram o ícone dela. */
export function techCoverage(mentions: readonly TechMention[], edl: Pick<Edl, 'overlays'> | null, timeline: Timeline | null): TechCoverageRow[] {
  return summarizeTech(mentions).map((item) => {
    const kept: TechCoverageRow['kept'] = [];
    for (const mention of item.mentions) {
      const output = timeline ? sourceToOutput(timeline, mention.start) : mention.start;
      if (output !== null) kept.push({ source: mention.start, output });
    }
    const shownBy: TechCoverageRow['shownBy'] = [];
    for (const overlay of edl?.overlays ?? []) {
      if (!overlayTechIds(overlay.component, overlay.props).includes(item.tech)) continue;
      const output = timeline ? sourceToOutput(timeline, overlay.at) : overlay.at;
      if (output !== null) shownBy.push({ id: overlay.id, component: overlay.component, output });
    }
    shownBy.sort((a, b) => a.output - b.output);
    return { tech: item.tech, name: item.name, count: item.count, confidence: item.confidence, kept, cut: item.count - kept.length, shownBy };
  });
}

export function formatTechCoverage(rows: readonly TechCoverageRow[], hasEdl: boolean): string {
  if (rows.length === 0) return 'nenhuma tecnologia do catálogo na fala (pnpm mce arsenal tech lista o catálogo)';
  const lines: string[] = [];
  for (const row of rows) {
    const where = row.kept.map((item) => (hasEdl ? `${stamp(item.source)}→${stamp(item.output)}` : stamp(item.source))).join(', ') || 'todas as menções foram cortadas';
    const status =
      row.confidence === 'low'
        ? 'confiança baixa (não cobrada)'
        : TECH_BY_ID.get(row.tech)?.icon == null
          ? 'sem ícone no conjunto (monograma; não cobrada)'
          : !hasEdl
            ? 'sem EDL ainda'
          : row.shownBy.length
            ? `ícone em ${row.shownBy.map((item) => `${item.id} (${item.component}, ${stamp(item.output)})`).join(', ')}`
            : row.kept.length
              ? 'SEM ÍCONE na EDL'
              : 'fora do corte';
    lines.push(`${row.name.padEnd(20)} ${TECH_PREFIX}${row.tech}  ·  ${row.count}x  ·  ${where}${row.cut && row.kept.length ? ` (+${row.cut} cortadas)` : ''}  ·  ${status}`);
  }
  if (hasEdl) lines.push('', 'tempos: fonte→vídeo final. Sem ícone: `TechBadge` na primeira menção, `tech:<id>` num ícone ou o nome num rótulo.');
  return lines.join('\n');
}

/** Itens do catálogo para o `mce arsenal tech`. */
export function techCatalogItems(techs: readonly Tech[] = TECHS): { id: string; group: string; description: string; usage: string; details: string[] }[] {
  return techs.map((tech) => {
    const source = iconSource(tech);
    return {
      id: `${TECH_PREFIX}${tech.id}`,
      group: `${tech.category} · ${source === 'monograma' ? 'sem ícone no conjunto (monograma)' : source}`,
      description: `${tech.name} (${tech.category}) — ${[...tech.aliases, ...(tech.weak ?? []).map((alias) => `${alias}*`)].slice(0, 6).join(', ') || 'sem apelidos'}`,
      usage: `overlays[]: { "component": "TechBadge", "duration": 3, "props": { "tech": "${tech.id}" } }  ·  em qualquer prop de ícone: "${TECH_PREFIX}${tech.id}"`,
      details: [`· cor ${tech.color} · apelidos de fala: ${[...tech.aliases, ...(tech.weak ?? []).map((alias) => `${alias}* (só com contexto)`)].join(', ') || '—'}`],
    };
  });
}

