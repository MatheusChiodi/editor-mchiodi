/**
 * Fontes do tema 100% offline no build do MChiodi Cut. Os componentes de motion/src carregam fontes por
 * `@remotion/google-fonts/<Família>`, que busca o woff2 no fonts.gstatic.com em tempo de execução. No `cut:build`
 * o plugin `offlineGoogleFonts` (cut/fonts-plugin.ts) baixa uma vez esses mesmos arquivos (cache em
 * node_modules/.cache/mce-cut-fonts), empacota em dist/fonts/ e troca o módulo por um que registra o FontFace com o
 * arquivo local: mesmos arquivos e descritores do loader do Remotion, então o visual é idêntico ao online.
 * Fallback: pedido que o build não cobriu (subset fora de latin/latin-ext, ou build sem rede e sem cache) cai no
 * loader original do Remotion — online funciona igual; offline, a fonte do sistema até haver rede. O `cut:dev` usa
 * sempre o loader original.
 */

export const BUNDLED_SUBSETS = ['latin', 'latin-ext'];

export interface FontMeta {
  fontFamily: string;
  unicodeRanges: Record<string, string>;
  /** style → weight → subset → url do woff2 */
  fonts: Record<string, Record<string, Record<string, string>>>;
}

export interface FontLoadOptions {
  weights?: string[];
  subsets?: string[];
}

export interface LocalFace {
  style: string;
  weight: string;
  subset: string;
  unicodeRange: string | undefined;
  src: string;
}

/** Arquivos que o build empacota: todos os woff2 de latin/latin-ext da família (o Google repete o mesmo arquivo entre pesos). */
export function bundledUrls(meta: FontMeta, subsets: string[] = BUNDLED_SUBSETS): string[] {
  const urls = new Set<string>();
  for (const weights of Object.values(meta.fonts)) {
    for (const bySubset of Object.values(weights)) {
      for (const subset of subsets) if (bySubset[subset]) urls.add(bySubset[subset]);
    }
  }
  return [...urls];
}

/** Nome do arquivo local: família + nome do woff2 remoto (único no gstatic). */
export function localFontFile(family: string, url: string): string {
  const base = url.split('/').pop()!.replace(/[^A-Za-z0-9._-]/g, '');
  return `${family.replace(/[^A-Za-z0-9]/g, '')}-${base}`;
}

/**
 * Faces que o `loadFont(style, options)` registraria, com o arquivo local. `null` = algum pedido sem arquivo local:
 * quem chama usa o loader remoto inteiro (não mistura metade local, metade remota).
 */
export function planLocalFaces(meta: FontMeta, local: Record<string, string>, style?: string, options: FontLoadOptions = {}): LocalFace[] | null {
  const faces: LocalFace[] = [];
  for (const currentStyle of style ? [style] : Object.keys(meta.fonts)) {
    const weights = meta.fonts[currentStyle];
    if (!weights) return null;
    for (const weight of options.weights ?? Object.keys(weights)) {
      const bySubset = weights[weight];
      if (!bySubset) return null;
      for (const subset of options.subsets ?? Object.keys(bySubset)) {
        const src = bySubset[subset] ? local[bySubset[subset]] : undefined;
        if (!src) return null;
        faces.push({ style: currentStyle, weight, subset, unicodeRange: meta.unicodeRanges[subset], src });
      }
    }
  }
  return faces;
}

const registered = new Map<string, Promise<void>>();

/** Mesmo contrato do `loadFont` do @remotion/google-fonts, com os arquivos do build; sem cobertura, o remoto. */
export function loadLocalFonts<R>(
  meta: FontMeta,
  local: Record<string, string>,
  style: string | undefined,
  options: FontLoadOptions | undefined,
  remote: (style?: string, options?: FontLoadOptions) => R,
): R | { fontFamily: string; fonts: FontMeta['fonts']; unicodeRanges: FontMeta['unicodeRanges']; waitUntilDone: () => Promise<undefined> } {
  const faces = typeof FontFace === 'undefined' ? null : planLocalFaces(meta, local, style, options);
  if (!faces) return remote(style, options);
  const pending = faces.map((face) => {
    const key = `${meta.fontFamily}|${face.style}|${face.weight}|${face.src}`;
    let promise = registered.get(key);
    if (!promise) {
      const fontFace = new FontFace(meta.fontFamily, `url(${face.src}) format('woff2')`, {
        style: face.style,
        weight: face.weight,
        ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}),
      });
      promise = fontFace.load().then(() => void document.fonts.add(fontFace));
      registered.set(key, promise);
    }
    return promise;
  });
  return {
    fontFamily: meta.fontFamily,
    fonts: meta.fonts,
    unicodeRanges: meta.unicodeRanges,
    waitUntilDone: () => Promise.all(pending).then(() => undefined),
  };
}
