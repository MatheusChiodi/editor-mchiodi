import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';

import { bundledUrls, type FontMeta, localFontFile } from './src/lib/fonts.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE = join(ROOT, 'node_modules', '.cache', 'mce-cut-fonts');
const LIB = fileURLToPath(new URL('./src/lib/fonts.ts', import.meta.url));
const PREFIX = '\0mce-font:';

async function fetchCached(url: string, file: string): Promise<Buffer | null> {
  const cached = join(CACHE, file);
  if (existsSync(cached)) return readFileSync(cached);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(cached, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Só no build: troca `@remotion/google-fonts/<Família>` por um módulo que registra os woff2 empacotados em dist/fonts/
 * (regras e fallback em src/lib/fonts.ts). Precisa de rede só no primeiro build; depois, o cache.
 */
export function offlineGoogleFonts(): Plugin {
  const assets = new Map<string, Buffer>();
  return {
    name: 'mce-offline-google-fonts',
    apply: 'build',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!/^@remotion\/google-fonts\/[A-Za-z0-9]+$/.test(source)) return null;
      const real = await this.resolve(source, importer, { skipSelf: true });
      return real ? `${PREFIX}${real.id}` : null;
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const real = id.slice(PREFIX.length);
      const meta = ((await import(pathToFileURL(real).href)) as { getInfo: () => FontMeta }).getInfo();
      const local: Record<string, string> = {};
      for (const url of bundledUrls(meta)) {
        const file = localFontFile(meta.fontFamily, url);
        const data = await fetchCached(url, file);
        if (!data) {
          this.warn(`fonte ${meta.fontFamily}: sem rede e sem cache para ${url}; no app ela vem do Google Fonts (offline, fonte do sistema)`);
          continue;
        }
        assets.set(`fonts/${file}`, data);
        local[url] = `/fonts/${file}`;
      }
      return [
        // a exportação local `loadFont` vence a do `export *` (o resto, como loadVariableFont, segue o original)
        `export * from ${JSON.stringify(real)};`,
        `import { getInfo, loadFont as remoteLoadFont } from ${JSON.stringify(real)};`,
        `import { loadLocalFonts } from ${JSON.stringify(LIB)};`,
        `const LOCAL = ${JSON.stringify(local)};`,
        'export const loadFont = (style, options) => loadLocalFonts(getInfo(), LOCAL, style, options, remoteLoadFont);',
      ].join('\n');
    },
    generateBundle() {
      for (const [fileName, source] of assets) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
