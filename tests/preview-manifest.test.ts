import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { buildManifest, cleanStale, filePrefix, needsRender, readManifest, RENDER_VERSION, sceneHash, staleFiles, writeManifest } from '../src/preview/manifest.ts';
import { edlSnippet, overlayId, parseSceneSource, stripFrames } from '../src/preview/meta.ts';

const dir = mkdtempSync(join(tmpdir(), 'mce-preview-manifest-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const strip = { fps: 30, durationInFrames: 180, width: 1920, height: 1080, strip: [{ frame: 15, file: 'abc-f0015.jpg' }], stripMs: 900 };
const full = { ...strip, video: 'abc-preview.mp4', videoMs: 4000 };

describe('manifest das prévias', () => {
  it('o hash muda com a cena ou com um auxiliar da pasta, e não depende da ordem dos auxiliares', () => {
    const helpers = [
      { name: 'kit.tsx', content: 'a' },
      { name: 'glyphs.tsx', content: 'b' },
    ];
    const base = sceneHash('cena', helpers);
    expect(sceneHash('cena', [...helpers].reverse())).toBe(base);
    expect(sceneHash('cena!', helpers)).not.toBe(base);
    expect(sceneHash('cena', [helpers[0]!, { name: 'glyphs.tsx', content: 'c' }])).not.toBe(base);
    expect(filePrefix(base)).toHaveLength(10);
  });

  it('só re-renderiza o que mudou, ficou pela metade ou perdeu arquivo', () => {
    const manifest = buildManifest('p/Cena', 'h1', full, 123);
    const all = () => true;
    expect(needsRender(null, 'h1', all)).toBe(true);
    expect(needsRender(manifest, 'h1', all)).toBe(false);
    expect(needsRender(manifest, 'h2', all)).toBe(true);
    expect(needsRender({ ...manifest, version: RENDER_VERSION + 1 }, 'h1', all)).toBe(true);
    expect(needsRender(manifest, 'h1', (file) => file !== 'abc-preview.mp4')).toBe(true);
    expect(needsRender(manifest, 'h1', (file) => file !== 'abc-f0015.jpg')).toBe(true);
  });

  it('só a tira basta quando a prévia animada não foi pedida', () => {
    const onlyStrip = buildManifest('p/Cena', 'h1', strip, 123);
    expect(onlyStrip.video).toBeNull();
    expect(onlyStrip.timings).toEqual({ stripMs: 900, videoMs: null });
    expect(needsRender(onlyStrip, 'h1', () => true)).toBe(true);
    expect(needsRender(onlyStrip, 'h1', () => true, false)).toBe(false);
  });

  it('grava, relê e limpa os arquivos de renders antigos', () => {
    const manifest = writeManifest(dir, buildManifest('p/Cena', 'h1', full, 123));
    expect(readManifest(dir)).toEqual(manifest);
    expect(readManifest(join(dir, 'nao-existe'))).toBeNull();
    for (const file of ['abc-f0015.jpg', 'abc-preview.mp4', 'old-f0015.jpg', 'old-preview.mp4']) writeFileSync(join(dir, file), 'x');
    expect(staleFiles(readdirSync(dir), manifest).sort()).toEqual(['old-f0015.jpg', 'old-preview.mp4']);
    cleanStale(dir, manifest);
    expect(readdirSync(dir).sort()).toEqual(['abc-f0015.jpg', 'abc-preview.mp4', 'manifest.json']);
  });
});

describe('o que dá para saber da cena lendo o fonte', () => {
  const source = `
export interface FilaProps {
  revealAt?: { entra: number; sai: number };
}
const DEFAULT_REVEAL = { entra: 0.4, sai: 3.25 };
export const Fila: React.FC<FilaProps> = ({ revealAt = DEFAULT_REVEAL }) => null;
export const entry: ComponentEntry = {
  component: Fila,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 6.5,
  description:
    'Cena papel: a fila "anda". ' +
    "Use quando a fala citar ordem.",
};`;

  it('lê descrição, duração e tempos do revealAt', () => {
    expect(parseSceneSource(source)).toEqual({
      description: 'Cena papel: a fila "anda". Use quando a fala citar ordem.',
      defaultDuration: 6.5,
      revealAt: { entra: 0.4, sai: 3.25 },
    });
  });

  it('aceita revealAt inline no sample e duração por constante', () => {
    const inline = `const DURATION = 8;\nexport const entry = { sample: { title: 'x', revealAt: { a: 1, b: 2.5 } }, defaultDuration: DURATION, description: \`ok\` };`;
    expect(parseSceneSource(inline)).toEqual({ description: 'ok', defaultDuration: 8, revealAt: { a: 1, b: 2.5 } });
  });

  it('sem exemplo numérico, fica com as chaves da interface; sem entry, tudo vazio', () => {
    const keysOnly = 'interface P { revealAt?: { um: number; dois?: number } }\nexport const entry = { sample: {}, defaultDuration: 4, description: "d" };';
    expect(Object.keys(parseSceneSource(keysOnly).revealAt)).toEqual(['um', 'dois']);
    expect(parseSceneSource('export const x = 1;')).toEqual({ description: null, defaultDuration: null, revealAt: {} });
  });

  it('frames da tira cobrem a duração sem repetir nem estourar', () => {
    expect(stripFrames(180)).toEqual([15, 45, 75, 105, 135, 165]);
    expect(stripFrames(3)).toEqual([0, 1, 2]);
    expect(stripFrames(1)).toEqual([0]);
  });

  it('monta o overlay pronto para a EDL', () => {
    expect(overlayId('DeCoracao')).toBe('de-coracao');
    expect(overlayId('HTTPServer2')).toBe('http-server2');
    expect(JSON.parse(edlSnippet('aula', 'FilaDeEventos', 6.5, { entra: 0.4, sai: Number.NaN }))).toEqual({
      id: 'fila-de-eventos',
      component: 'scene:aula/FilaDeEventos',
      at: 0,
      duration: 6.5,
      props: { revealAt: { entra: 0.4 } },
      reason: '',
    });
    expect(JSON.parse(edlSnippet('aula', 'Fila', 4)).props).toEqual({});
  });
});
