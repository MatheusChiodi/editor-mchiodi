import { describe, expect, it } from 'vitest';

import { edlSchema, stabilizeSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { doctorLines, vidstabCheck } from '../src/project/health.ts';
import { buildCutGraph } from '../src/render/cuts.ts';
import {
  detectFilters,
  parseVidstabSupport,
  prepareStabilize,
  resolveStabilize,
  stabilizeCacheKey,
  transformFilter,
} from '../src/render/stabilize.ts';

const minimalEdl = {
  version: 1,
  project: 'x',
  createdAt: '2026-01-01',
  source: { path: 'a.mp4', durationSec: 10, fps: 30, width: 1920, height: 1080 },
  output: { fps: 30, width: 1920, height: 1080 },
  clips: [{ id: 'c1', start: 0, end: 5 }],
};

const on = stabilizeSchema.parse({ enabled: true });

describe('estabilização (vidstab)', () => {
  it('EDL antiga continua válida e sai com stabilize desligado', () => {
    const edl = edlSchema.parse(minimalEdl);
    expect(edl.stabilize).toEqual({ enabled: false, shakiness: 5, smoothing: 15, zoom: 0, reason: '' });
    expect(() => edlSchema.parse({ ...minimalEdl, stabilize: { enabled: true, shakiness: 11 } })).toThrow();
    expect(() => edlSchema.parse({ ...minimalEdl, stabilize: { enabled: true, zoom: 25 } })).toThrow();
  });

  it('detecta o vidstab na saída de ffmpeg -filters', () => {
    const header = 'Filters:\n  T.. = Timeline support\n  ... abench            A->A       Benchmark part of a filtergraph.\n';
    const both = `${header} .. vidstabdetect     V->V       Extract relative transformations\n .. vidstabtransform  V->V       Transform the frames\r\n`;
    expect(parseVidstabSupport(both)).toBe(true);
    expect(parseVidstabSupport(header)).toBe(false);
    expect(parseVidstabSupport(`${header} .. vidstabdetect     V->V       só um dos dois\n`)).toBe(false);
  });

  it('desligado não estabiliza; ligado sem vidstab avisa em vez de quebrar', () => {
    expect(resolveStabilize(stabilizeSchema.parse({}), false)).toEqual({ enabled: false, warning: null });
    expect(resolveStabilize(on, true)).toEqual({ enabled: true, warning: null });
    const missing = resolveStabilize(on, false);
    expect(missing.enabled).toBe(false);
    expect(missing.warning).toContain('libvidstab');
  });

  it('prepareStabilize: sem vidstab devolve sem filtro e loga o aviso, sem tocar no disco', async () => {
    const logs: string[] = [];
    const off = await prepareStabilize(stabilizeSchema.parse({}), 'Z:/nao/existe.mp4', 'Z:/nada', { fps: 30, log: (m) => logs.push(m), available: false });
    expect(off).toEqual({ enabled: false, warning: null, transform: null });
    const absent = await prepareStabilize(on, 'Z:/nao/existe.mp4', 'Z:/nada', { fps: 30, log: (m) => logs.push(m), available: false });
    expect(absent.transform).toBeNull();
    expect(logs).toHaveLength(1);
    const broken = await prepareStabilize(on, 'Z:/nao/existe.mp4', 'Z:/nada', { fps: 30, log: (m) => logs.push(m), available: true });
    expect(broken.transform).toBeNull();
    expect(broken.warning).toContain('seguindo sem estabilizar');
  });

  it('chave do cache muda com arquivo, cadência e tremor, mas não com suavização/zoom', () => {
    const file = { path: 'D:\\v\\a.mp4', size: 1000, mtimeMs: 123.4 };
    const base = stabilizeCacheKey(file, on, 30);
    expect(base).toMatch(/^[0-9a-f]{16}$/);
    expect(stabilizeCacheKey({ ...file, path: 'd:\\V\\A.mp4' }, on, 30)).toBe(base);
    expect(stabilizeCacheKey({ ...file, size: 1001 }, on, 30)).not.toBe(base);
    expect(stabilizeCacheKey({ ...file, mtimeMs: 999 }, on, 30)).not.toBe(base);
    expect(stabilizeCacheKey(file, on, 60)).not.toBe(base);
    expect(stabilizeCacheKey(file, { shakiness: 8 }, 30)).not.toBe(base);
    expect(stabilizeCacheKey(file, { ...on, smoothing: 40, zoom: 5 } as typeof on, 30)).toBe(base);
  });

  it('filtros escapam o caminho do .trf (o ":" do drive) e normalizam a cadência como o corte', () => {
    const detect = detectFilters('C:\\cache\\v.trf', { shakiness: 7 }, 30);
    expect(detect).toBe("fps=30:start_time=0,vidstabdetect=shakiness=7:accuracy=15:result='C\\:/cache/v.trf'");
    const transform = transformFilter('C:\\cache\\v.trf', { smoothing: 20, zoom: 2.5 });
    expect(transform).toBe("vidstabtransform=input='C\\:/cache/v.trf':smoothing=20:optzoom=1:zoom=2.5:interpol=bicubic");
  });

  it('no grafo de corte a transformação vem logo após o fps, antes da escala/recorte, e não muda os trims', () => {
    const timeline = buildTimeline([{ id: 'c1', start: 0.5, end: 2 }, { id: 'c2', start: 3, end: 4 }], 30);
    const options = { fps: 30, width: 640, height: 360, fadeMs: 12 };
    const plain = buildCutGraph(timeline, options);
    const stab = transformFilter('C:\\t.trf', on);
    const graph = buildCutGraph(timeline, { ...options, stabilize: stab, prep: 'crop=ih*9/16:ih,scale=640:360' });
    expect(graph.split('\n')[0]).toBe(`[0:v]fps=30:start_time=0,${stab},crop=ih*9/16:ih,scale=640:360,format=yuv420p,split=2[vs0][vs1];`);
    const trims = (text: string) => text.match(/trim=start_frame=\d+:end_frame=\d+|atrim=[^,\]]+/g);
    expect(trims(graph)).toEqual(trims(plain));
    expect(plain).not.toContain('vidstab');
  });

  it('doctor reporta o vidstab como opcional', () => {
    expect(vidstabCheck(true)).toMatchObject({ name: 'vidstab', ok: true, required: false });
    const absent = vidstabCheck(false);
    expect(absent).toMatchObject({ ok: false, required: false });
    expect(doctorLines([absent])[0]).toMatch(/^opcional {2}vidstab/);
  });
});
