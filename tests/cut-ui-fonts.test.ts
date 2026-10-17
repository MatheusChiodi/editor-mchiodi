import { describe, expect, it } from 'vitest';

import { bundledUrls, type FontMeta, localFontFile, planLocalFaces } from '../cut/src/lib/fonts.ts';

const G = 'https://fonts.gstatic.com/s/demo/v1';
// o Google repete o mesmo arquivo entre pesos (variável por baixo)
const META: FontMeta = {
  fontFamily: 'Play Fair',
  unicodeRanges: { latin: 'U+0000-00FF', 'latin-ext': 'U+0100-02BA', cyrillic: 'U+0400-045F' },
  fonts: {
    normal: {
      '500': { latin: `${G}/n-lat.woff2`, 'latin-ext': `${G}/n-ext.woff2`, cyrillic: `${G}/n-cyr.woff2` },
      '600': { latin: `${G}/n-lat.woff2`, 'latin-ext': `${G}/n-ext.woff2`, cyrillic: `${G}/n-cyr.woff2` },
    },
    italic: { '600': { latin: `${G}/i-lat.woff2`, 'latin-ext': `${G}/i-ext.woff2` } },
  },
};
const LOCAL = Object.fromEntries(bundledUrls(META).map((url) => [url, `/fonts/${localFontFile(META.fontFamily, url)}`]));

describe('fontes offline do cut', () => {
  it('empacota só latin/latin-ext, sem repetir arquivo entre pesos', () => {
    expect(bundledUrls(META)).toEqual([`${G}/n-lat.woff2`, `${G}/n-ext.woff2`, `${G}/i-lat.woff2`, `${G}/i-ext.woff2`]);
    expect(localFontFile('Play Fair', `${G}/n-lat.woff2`)).toBe('PlayFair-n-lat.woff2');
  });

  it('pedido coberto vira faces locais com os mesmos descritores do loader do Remotion', () => {
    const faces = planLocalFaces(META, LOCAL, 'normal', { weights: ['500', '600'], subsets: ['latin', 'latin-ext'] });
    expect(faces).toHaveLength(4);
    expect(faces![0]).toEqual({ style: 'normal', weight: '500', subset: 'latin', unicodeRange: 'U+0000-00FF', src: '/fonts/PlayFair-n-lat.woff2' });
    expect(planLocalFaces(META, LOCAL, 'italic', { weights: ['600'], subsets: ['latin'] })![0]!.src).toBe('/fonts/PlayFair-i-lat.woff2');
  });

  it('subset fora do build, peso/estilo inexistente ou build sem arquivo → null (usa o loader remoto)', () => {
    expect(planLocalFaces(META, LOCAL, 'normal', { weights: ['500'], subsets: ['cyrillic'] })).toBeNull();
    expect(planLocalFaces(META, LOCAL, 'normal', { weights: ['900'], subsets: ['latin'] })).toBeNull();
    expect(planLocalFaces(META, LOCAL, 'oblique', { weights: ['500'], subsets: ['latin'] })).toBeNull();
    expect(planLocalFaces(META, {}, 'normal', { weights: ['500'], subsets: ['latin'] })).toBeNull();
    // sem subsets: o loader pede todos, inclusive cyrillic
    expect(planLocalFaces(META, LOCAL, 'normal', { weights: ['500'] })).toBeNull();
  });
});
