import type { Tech } from './catalog.ts';

// Gerador de `motion/src/tech/icons.generated.ts`: só o subconjunto do catálogo entra no bundle do Remotion
// (o simple-icons inteiro tem mais de 3 mil ícones). Tudo aqui é puro; quem lê o disco é `scripts/sync-tech-icons.ts`.

export interface IconData {
  /** lado do viewBox (quadrado, começando em 0 0) */
  box: number;
  paths: string[];
  /** preenchimento par-ímpar (alguns desenhos do devicon) */
  evenodd?: true;
}

export interface IconSet {
  version: string;
  license: string;
}

const ALLOWED_TAGS = new Set(['svg', 'g', 'path', 'title']);

/**
 * Extrai os paths de um SVG de ícone. Recusa o que não saberíamos desenhar igual (outras formas, `transform`, viewBox
 * não quadrado): melhor o sync falhar do que um logo sair deformado.
 */
export function parseIconSvg(svg: string, name: string): IconData {
  const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!viewBox || viewBox[1] !== viewBox[2]) throw new Error(`${name}: viewBox ausente ou não quadrado`);
  for (const [, tag] of svg.matchAll(/<([a-zA-Z][\w:-]*)/g)) {
    if (!ALLOWED_TAGS.has(tag!)) throw new Error(`${name}: elemento <${tag}> não suportado`);
  }
  if (/\stransform=/.test(svg)) throw new Error(`${name}: transform não suportado`);
  const paths = [...svg.matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)].map((match) => match[1]!.replace(/\s+/g, ' ').trim());
  if (paths.length === 0) throw new Error(`${name}: nenhum <path>`);
  const data: IconData = { box: Number(viewBox[1]), paths };
  if (/(fill|clip)-rule="evenodd"/.test(svg)) data.evenodd = true;
  return data;
}

/** Arquivo do ícone dentro do pacote: `react` → `icons/react.svg` (simple-icons); `devicon:vscode/vscode-plain` → `icons/vscode/vscode-plain.svg`. */
export function iconFile(icon: string): { set: 'simple-icons' | 'devicon'; path: string } {
  return icon.startsWith('devicon:') ? { set: 'devicon', path: `icons/${icon.slice('devicon:'.length)}.svg` } : { set: 'simple-icons', path: `icons/${icon}.svg` };
}

/** Chaves de ícone que o catálogo usa, sem repetição, em ordem alfabética (diff estável). */
export function iconKeys(techs: readonly Pick<Tech, 'icon'>[]): string[] {
  return [...new Set(techs.map((tech) => tech.icon).filter((icon): icon is string => icon !== null))].sort();
}

export function renderIconModule(icons: Record<string, IconData>, sets: Record<'simple-icons' | 'devicon', IconSet>): string {
  const entries = Object.keys(icons)
    .sort()
    .map((key) => {
      const icon = icons[key]!;
      const paths = icon.paths.map((path) => JSON.stringify(path)).join(', ');
      return `  ${JSON.stringify(key)}: { box: ${icon.box}, paths: [${paths}]${icon.evenodd ? ', evenodd: true' : ''} },`;
    });
  return [
    '// GERADO por `pnpm run sync-tech-icons` a partir de src/tech/catalog.ts. Não edite à mão.',
    `// Desenhos: simple-icons ${sets['simple-icons'].version} (${sets['simple-icons'].license}) e devicon ${sets.devicon.version} (${sets.devicon.license}).`,
    '// As marcas pertencem aos seus donos; aqui só identificam a tecnologia citada no vídeo.',
    '',
    'export interface TechIconData {',
    '  /** lado do viewBox quadrado */',
    '  box: number;',
    '  paths: string[];',
    '  evenodd?: true;',
    '}',
    '',
    `export const TECH_ICON_SETS = ${JSON.stringify(sets)} as const;`,
    '',
    '// prettier-ignore',
    'export const TECH_ICONS: Record<string, TechIconData> = {',
    ...entries,
    '};',
    '',
  ].join('\n');
}
