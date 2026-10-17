import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTimeline } from '../src/edl/timeline.ts';
import { run } from '../src/lib/exec.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';
import { buildComposeGraph, compose, composeInputs } from '../src/render/compose.ts';
import { buildCutGraph, renderCut } from '../src/render/cuts.ts';
import {
  buildLayoutGraph,
  enableExpr,
  type PipCorner,
  pipPosition,
  placeLayout,
  resolveScreen,
  screenAlign,
  SPLIT_SCREEN,
} from '../src/render/layout.ts';

const clips = [
  { id: 'c1', start: 0, end: 4 },
  { id: 'c2', start: 6, end: 10 },
];
const timeline = buildTimeline(clips, 30);
const segment = (start: number, end: number, mode: 'camera' | 'screen' | 'pip' | 'split', pipCorner: PipCorner = 'bottom-right') => ({
  start, end, mode, pipCorner,
});

describe('placeLayout', () => {
  it('converte para o tempo de saída e parte o segmento que atravessa um corte', () => {
    const placed = placeLayout([segment(2, 8, 'pip')], timeline);
    expect(placed.map((item) => [item.start, item.end, item.mode])).toEqual([
      [2, 4, 'pip'],
      [4, 6, 'pip'],
    ]);
  });

  it('ignora o modo camera e o que caiu em trecho cortado', () => {
    expect(placeLayout([segment(0, 3, 'camera'), segment(4.2, 5.8, 'screen')], timeline)).toEqual([]);
  });
});

describe('geometria', () => {
  it('enableExpr soma os intervalos; sem intervalo nunca liga', () => {
    expect(enableExpr([])).toBe('0');
    expect(enableExpr([{ start: 1, end: 2.5 }, { start: 4, end: 5 }])).toBe('between(t,1.000,2.500)+between(t,4.000,5.000)');
  });

  it('o quadro da câmera fica no canto pedido, com dimensões pares e dentro da tela', () => {
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      const box = pipPosition(corner, 1920, 1080);
      expect(box.w % 2).toBe(0);
      expect(box.h % 2).toBe(0);
      expect(box.x).toBeGreaterThan(0);
      expect(box.y).toBeGreaterThan(0);
      expect(box.x + box.w).toBeLessThan(1920);
      expect(box.y + box.h).toBeLessThan(1080);
      expect(box.x < 960).toBe(corner.endsWith('left'));
      expect(box.y < 540).toBe(corner.startsWith('top'));
    }
  });

  it('screenAlign completa com preto se a tela começou depois e descarta o começo se começou antes', () => {
    expect(screenAlign(0, 30)).toBe('fps=30:start_time=0,tpad=stop_mode=clone:stop_duration=3600');
    expect(screenAlign(1.5, 30)).toContain('tpad=start_duration=1.500');
    expect(screenAlign(-2, 30)).toContain('trim=start=2.000,setpts=PTS-STARTPTS');
    // sempre um único tpad: dois encadeados perdem o preenchimento do fim
    for (const offset of [0, 1.5, -2]) expect(screenAlign(offset, 30).match(/tpad=/g)).toHaveLength(1);
  });

  it('resolveScreen devolve null para arquivo inexistente', () => {
    expect(resolveScreen('tela.mp4', 'C:/nao/existe/video.mp4')).toBeNull();
  });
});

describe('grafos', () => {
  const layout = placeLayout([segment(1, 2, 'screen'), segment(2, 3, 'pip', 'bottom-right'), segment(6.5, 8, 'split')], timeline);

  it('o corte da tela usa os mesmos frames da câmera', () => {
    const graph = buildCutGraph(timeline, { fps: 30, width: 640, height: 360, fadeMs: 12, screen: { align: screenAlign(0, 30) } });
    expect(graph).toContain('[ss1]trim=start_frame=180:end_frame=300,setpts=PTS-STARTPTS[sv1]');
    expect(graph).toContain('[sv0][sv1]concat=n=2:v=1:a=0,fps=30[scut]');
    expect(buildCutGraph(timeline, { fps: 30, width: 640, height: 360, fadeMs: 12 })).not.toContain('[scut]');
  });

  it('a composição liga cada modo só no seu intervalo', () => {
    const lines = buildLayoutGraph({ camera: '[camera]', screenInput: 3, layout, width: 1920, height: 1080, output: '[laid]' }).join('\n');
    expect(lines).toContain('[camera]split=3[lcam0][lpipsrc0][lsplitcam]');
    expect(lines).toContain("overlay=0:0:enable='between(t,1.000,2.000)+between(t,2.000,3.000)'[lstep0]");
    expect(lines).toContain("enable='between(t,2.000,3.000)'[lstep1]");
    expect(lines).toContain(`[lsplitscr]scale=${Math.round((1920 * SPLIT_SCREEN) / 2) * 2}:1080`);
    expect(lines).toContain("enable='between(t,4.500,6.000)'[lsplitout]");
    expect(lines.trimEnd().endsWith('[lsplitout]null[laid]')).toBe(true);
  });

  it('só com tela cheia, não cria ramos de pip nem de split', () => {
    const only = placeLayout([segment(1, 2, 'screen')], timeline);
    const lines = buildLayoutGraph({ camera: '[camera]', screenInput: 1, layout: only, width: 1920, height: 1080, output: '[laid]' }).join('\n');
    expect(lines).toContain('[camera]split=1[lcam0]');
    expect(lines).not.toContain('hstack');
    expect(lines).not.toContain('lpip');
  });

  it('a tela gravada é a última entrada e a câmera tratada passa pelo layout antes dos gráficos', () => {
    const base = {
      width: 1920, height: 1080, fps: 30, durationSec: 8, videoFilters: ['eq=contrast=1.04'],
      voiceFilters: [], limiter: 'alimiter', music: null, sfx: [], hasIntro: false, hasOutro: true, bumpers: { introSec: 0, outroSec: 8 },
    };
    expect(composeInputs({ ...base, hasOverlay: true, layout })).toMatchObject({ overlay: 1, outro: 2, screen: 3 });
    expect(composeInputs({ ...base, hasOverlay: true, layout: [] }).screen).toBeNull();
    const graph = buildComposeGraph({ ...base, hasOverlay: true, layout });
    expect(graph).toContain('[0:v]scale=1920:1080:flags=lanczos,eq=contrast=1.04[camera]');
    expect(graph).toContain('[laid]null[base]');
    expect(buildComposeGraph({ ...base, hasOverlay: false, layout })).toContain('[laid]null,format=yuv420p[vmain]');
  });
});

describe('tela gravada no ffmpeg (integração)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mce-layout-'));
  const camera = join(dir, 'camera.mp4');
  const screen = join(dir, 'screen.mp4');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  beforeAll(async () => {
    await ffmpeg([
      '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=10', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=48000:d=10',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', camera,
    ]);
    // tela em 4:3, mais curta que a câmera e começando 1 s depois
    await ffmpeg(['-f', 'lavfi', '-i', 'smptebars=s=640x480:r=30:d=6', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', screen]);
  }, 60_000);

  it('corta a tela junto com a câmera e compõe pip + split sem mudar a duração', async () => {
    const cut = join(dir, 'cut.mkv');
    const screenCut = join(dir, 'screen.mkv');
    await renderCut(timeline, {
      source: camera,
      output: cut,
      screenSource: screen,
      screenOutput: screenCut,
      screen: { align: screenAlign(1, 30) },
      graphFile: join(dir, 'cut.graph.txt'),
      quality: 'preview',
      fps: 30,
      width: 640,
      height: 360,
      fadeMs: 12,
    });
    const frames = async (file: string) => {
      const { stdout } = await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]);
      return Number(stdout.trim().split(/\r?\n/)[0]);
    };
    expect(await frames(cut)).toBe(240);
    expect(await frames(screenCut)).toBe(240);

    const output = join(dir, 'out.mp4');
    await compose({
      cut,
      overlay: null,
      intro: null,
      outro: null,
      screen: screenCut,
      layout: placeLayout([segment(1, 3, 'pip', 'top-left'), segment(6.5, 9, 'split')], timeline),
      bumpers: { introSec: 0, outroSec: 0 },
      output,
      graphFile: join(dir, 'compose.graph.txt'),
      quality: 'preview',
      durationSec: timeline.durationSec,
      fps: 30,
      width: 640,
      height: 360,
      videoFilters: [],
      voiceFilters: [],
      limiter: 'anull',
      music: null,
      sfx: [],
    });
    expect(await frames(output)).toBe(240);
  }, 180_000);
});
