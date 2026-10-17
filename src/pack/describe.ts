import { usefulLength } from './check.ts';
import type { DescriptionSpec, PackSpec } from './spec.ts';

function hashtag(tag: string): string {
  return `#${tag.replace(/^#+/, '').replace(/\s+/g, '')}`;
}

/**
 * Descrição pronta para colar. A ordem é a do que o YouTube mostra: gancho (antes do "mostrar mais"),
 * o que a pessoa aprende, capítulos, links, inscrição, redes e hashtags. Seção vazia não entra.
 */
export function buildDescription(spec: DescriptionSpec, chapters: string): string {
  const sections: string[] = [spec.hook.map((line) => line.trim()).join('\n')];
  if (spec.learn.length) sections.push(['Neste vídeo:', ...spec.learn.map((item) => `• ${item.trim()}`)].join('\n'));
  if (chapters.trim()) sections.push(['Capítulos:', chapters.trim()].join('\n'));
  if (spec.links.length) sections.push(['Links citados:', ...spec.links.map((item) => `${item.label}: ${item.url}`)].join('\n'));
  if (spec.cta.trim()) sections.push(spec.cta.trim());
  if (spec.extra?.trim()) sections.push(spec.extra.trim());
  if (spec.socials.length) sections.push(['Redes:', ...spec.socials.map((item) => `${item.label}: ${item.url}`)].join('\n'));
  if (spec.hashtags.length) sections.push(spec.hashtags.map(hashtag).join(' '));
  return `${sections.join('\n\n')}\n`;
}

/** titulo.txt: a opção recomendada primeiro, cada uma com o tamanho e uma linha de porquê. */
export function buildTitlesFile(titles: PackSpec['titles']): string {
  return titles
    .map((title, index) => {
      const head = `${index + 1}. ${title.text.trim()}`;
      const meta = `   ${usefulLength(title.text)} caracteres${index === 0 ? ' · recomendado' : ' · alternativa para teste A/B'}`;
      return [head, meta, ...(title.why.trim() ? [`   por quê: ${title.why.trim()}`] : [])].join('\n');
    })
    .join('\n\n')
    .concat(titles.length ? '\n' : '');
}

/** tags.txt: uma linha separada por vírgula, que é como o YouTube Studio aceita colar. */
export function buildTagsFile(tags: string[]): string {
  const seen = new Set<string>();
  const unique = tags.map((tag) => tag.trim()).filter((tag) => tag && !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()));
  return unique.length ? `${unique.join(', ')}\n` : '';
}
