import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildComposeGraph } from '../src/render/compose.ts';
import { blurPadLines, centerCropChain, exportSize, mobileBitrateK, planExport } from '../src/render/formats.ts';

const output = { fps: 30, width: 1920, height: 1080 };
const shorts = { start: 1, end: 20, focusX: 0.5 as const, graphics: 'auto' as const, reason: '' };

describe('exportSize / mobileBitrateK', () => {
  it('16x9 = saída da EDL; 9x16 = 1080x1920; 1x1 = lado da altura até 1080', () => {
    expect(exportSize('16x9', output)).toEqual({ width: 1920, height: 1080 });
    expect(exportSize('9x16', output)).toEqual({ width: 1080, height: 1920 });
    expect(exportSize('1x1', { fps: 30, width: 1280, height: 720 })).toEqual({ width: 720, height: 720 });
  });

  it('teto de bitrate proporcional a pixels por segundo, entre 2,5 e 10 Mb/s', () => {
    expect(mobileBitrateK(1920, 1080, 30)).toBe(6221);
    expect(mobileBitrateK(320, 180, 30)).toBe(2500);
    expect(mobileBitrateK(3840, 2160, 60)).toBe(10000);
  });
});

describe('planExport', () => {
  const dir = join('x', 'renders');

  it('16x9: sem reenquadrar, entrega em renders/<slug>-16x9.mp4 + .srt', () => {
    const plan = planExport({ output, shorts: null }, { format: '16x9' }, dir, 'demo');
    expect(plan).toMatchObject({ variant: 'main', reformat: null, fit: null, file: join(dir, 'demo-16x9.mp4'), srt: join(dir, 'demo-16x9.srt') });
    expect(plan.bufsizeK).toBe(plan.maxrateK * 2);
  });

  it('9x16 padrão é blur-pad do vídeo inteiro', () => {
    const plan = planExport({ output, shorts: null }, { format: '9x16' }, dir, 'demo');
    expect(plan.fit).toBe('blur-pad');
    expect(plan.reformat!.at(-1)).toMatch(/overlay=x=\(W-w\)\/2:y=\(H-h\)\/2.*\[vfmt\]$/);
    expect(plan.dirName).toBe('export-9x16-blur-pad');
  });

  it('1x1 center-crop recorta em volta do foco', () => {
    const plan = planExport({ output, shorts: null }, { format: '1x1', fit: 'center-crop', focusX: 0.25 }, dir, 'demo');
    expect(plan.reformat).toEqual([`[vout]${centerCropChain({ width: 1080, height: 1080 }, 0.25)},format=yuv420p[vfmt]`]);
    expect(plan.reformat![0]).toContain("x='(iw-ow)*0.250'");
  });

  it('scope shorts usa o render de Short e exige edl.shorts', () => {
    expect(planExport({ output, shorts }, { format: '9x16', scope: 'shorts' }, dir, 'demo')).toMatchObject({ variant: 'shorts', reformat: null, fit: 'center-crop' });
    expect(() => planExport({ output, shorts: null }, { format: '9x16', scope: 'shorts' }, dir, 'demo')).toThrow(/shorts/);
    expect(() => planExport({ output, shorts }, { format: '1x1', scope: 'shorts' }, dir, 'demo')).toThrow(/9x16/);
  });

  it('o reenquadramento entra no fim do grafo de composição e sai em [vfmt]', () => {
    const graph = buildComposeGraph({
      width: 1920, height: 1080, fps: 30, durationSec: 5, videoFilters: [], hasOverlay: false, voiceFilters: [], limiter: 'alimiter',
      music: null, sfx: [], hasIntro: false, hasOutro: false, bumpers: { introSec: 0, outroSec: 0 }, reformat: blurPadLines({ width: 1080, height: 1920 }),
    });
    const lines = graph.split(';\n');
    expect(lines.at(-1)).toContain('[vfmt]');
    expect(lines.findIndex((line) => line.endsWith('[vout][aout]') || line.includes('null[vout]'))).toBeLessThan(lines.length - 4);
  });
});
