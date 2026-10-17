// Regenera motion/src/tech/icons.generated.ts com os ícones que o catálogo (src/tech/catalog.ts) usa.
// Rode depois de mexer no catálogo ou de atualizar simple-icons/devicon: `pnpm run sync-tech-icons` (`--check` só confere).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TECHS } from '../src/tech/catalog.ts';
import { type IconData, iconFile, iconKeys, type IconSet, parseIconSvg, renderIconModule } from '../src/tech/icon-module.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ICONS_MODULE = join(ROOT, 'motion', 'src', 'tech', 'icons.generated.ts');

function packageDir(name: string): { dir: string; set: IconSet } {
  // direto em node_modules: o simple-icons não exporta o próprio package.json
  const dir = join(ROOT, 'node_modules', name);
  const { version, license } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as IconSet;
  return { dir, set: { version, license } };
}

/** Conteúdo do módulo gerado, lido dos pacotes instalados. */
export function buildIconModule(): string {
  const packages = { 'simple-icons': packageDir('simple-icons'), devicon: packageDir('devicon') };
  const icons: Record<string, IconData> = {};
  for (const key of iconKeys(TECHS)) {
    const { set, path } = iconFile(key);
    let svg: string;
    try {
      svg = readFileSync(join(packages[set].dir, path), 'utf8');
    } catch {
      throw new Error(`ícone "${key}" não existe em ${set} ${packages[set].set.version}: troque o slug no catálogo ou use icon: null (monograma)`);
    }
    icons[key] = parseIconSvg(svg, key);
  }
  return renderIconModule(icons, { 'simple-icons': packages['simple-icons'].set, devicon: packages.devicon.set });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = buildIconModule();
  if (process.argv.includes('--check')) {
    if (readFileSync(ICONS_MODULE, 'utf8') !== content) {
      console.error('icons.generated.ts está desatualizado: rode pnpm run sync-tech-icons');
      process.exitCode = 1;
    } else console.log('icons.generated.ts em dia');
  } else {
    writeFileSync(ICONS_MODULE, content, 'utf8');
    console.log(`${ICONS_MODULE}\n${iconKeys(TECHS).length} ícones · ${(content.length / 1024).toFixed(0)} KB`);
  }
}
