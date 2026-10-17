import { describe, expect, it } from 'vitest';

import { toPages } from '../motion/src/captions/Captions.tsx';
import type { Transcript } from '../src/analyze/types.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { normalizeChain, voiceChain } from '../src/render/audio.ts';
import { buildCaptions } from '../src/render/captions.ts';
import { resolveAsset, SFX_RECIPES, sfxArgs } from '../src/assets/library.ts';
import { collectSfx, compensate, LATENCY_MS, SFX } from '../src/render/audio.ts';
import { bumperDurations } from '../src/render/bumpers.ts';
import { buildComposeGraph, composeArgs, composeInputs, totalDuration } from '../src/render/compose.ts';
import { previewSize } from '../src/render/index.ts';
import { buildOverlayProps } from '../src/render/overlay.ts';
import { script } from './helpers.ts';

const captionDefaults = edlSchema.shape.captions.parse({});
const audioDefaults = edlSchema.shape.audio.parse({});

describe('buildCaptions', () => {
  const words = script('Hoje a gente vai falar de React, hooks e estado. |2 Bora começar agora?');
  const whole = buildTimeline([{ id: 'c1', start: 0, end: 20 }], 30);

  it('gera uma legenda por palavra, em ms, com espaço à esquerda e sem pontuação final', () => {
    const captions = buildCaptions(words, whole, captionDefaults);
    expect(captions).toHaveLength(words.length);
    expect(captions[0]).toMatchObject({ text: ' Hoje', startMs: 0, endMs: 300 });
    expect(captions.map((caption) => caption.text)).toContain(' React');
    expect(captions.at(-1)!.text).toBe(' agora?');
  });

  it('quebra página em fim de frase, limite de palavras e pausa', () => {
    const captions = buildCaptions(words, whole, { ...captionDefaults, maxWordsPerPage: 4 });
    const pages = toPages(captions).map((page) => page.words.map((word) => word.text.trim()).join(' '));
    expect(pages).toEqual(['Hoje a gente vai', 'falar de React', 'hooks e estado', 'Bora começar agora?']);
  });

  it('descarta palavras cortadas e desloca as demais para o tempo de saída', () => {
    const second = words.findIndex((word) => word.text === 'Bora');
    const timeline = buildTimeline(
      [
        { id: 'c1', start: 0, end: 1.05 },
        { id: 'c2', start: words[second]!.start - 0.1, end: 20 },
      ],
      30,
    );
    const captions = buildCaptions(words, timeline, captionDefaults);
    expect(captions.map((caption) => caption.text.trim())).toEqual(['Hoje', 'a', 'gente', 'Bora', 'começar', 'agora?']);
    const bora = captions[3]!;
    expect(bora.startMs).toBeGreaterThanOrEqual(1050);
    expect(bora.startMs).toBeLessThan(1300);
    captions.forEach((caption, index) => {
      if (index > 0) expect(caption.startMs).toBeGreaterThanOrEqual(captions[index - 1]!.endMs);
    });
  });

  it('marca palavras-chave e aplica correções de grafia', () => {
    const captions = buildCaptions(words, whole, {
      ...captionDefaults,
      highlights: ['React'],
      replacements: { hooks: 'Hooks' },
    });
    expect(captions.filter((caption) => caption.highlight).map((caption) => caption.text)).toEqual([' React']);
    expect(captions.map((caption) => caption.text)).toContain(' Hooks');
  });

  it('desligado não gera nada', () => {
    expect(buildCaptions(words, whole, { ...captionDefaults, enabled: false })).toEqual([]);
  });
});

describe('buildOverlayProps', () => {
  const words = script('um dois três quatro cinco seis sete oito nove dez');
  const transcript = { words } as Transcript;
  const edl = edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-11T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 30, fps: 60, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [
      { id: 'c1', start: 0, end: 2 },
      { id: 'c2', start: 10, end: 20 },
    ],
    overlays: [{ id: 'o1', component: 'LowerThird', at: 11, duration: 4, props: { title: 'Matheus' }, hidesCaptions: true }],
  });
  const timeline = buildTimeline(edl.clips, 30);

  it('converte a âncora da fonte para frames do vídeo final', () => {
    const props = buildOverlayProps(edl, timeline, transcript);
    expect(props.durationInFrames).toBe(360);
    expect(props.overlays[0]).toMatchObject({ from: 90, durationInFrames: 120, hidesCaptions: true, props: { title: 'Matheus' } });
  });

  it('não deixa o overlay passar do fim do vídeo', () => {
    const late = { ...edl, overlays: [{ ...edl.overlays[0]!, at: 19, duration: 5 }] };
    expect(buildOverlayProps(late, timeline, transcript).overlays[0]!.durationInFrames).toBe(30);
  });
});

describe('áudio', () => {
  it('monta a cadeia da voz conforme as opções', () => {
    // logo depois do afftdn vem a compensação do atraso dele
    expect(voiceChain(audioDefaults).map((filter) => filter.split('=')[0])).toEqual([
      'highpass', 'afftdn', 'atrim', 'asetpts', 'deesser', 'acompressor',
    ]);
    expect(voiceChain(audioDefaults)).toContain(`atrim=start=${(LATENCY_MS.afftdn / 1000).toFixed(4)}`);
    const bare = voiceChain({ ...audioDefaults, denoise: 'off', deesser: false });
    expect(bare.map((filter) => filter.split('=')[0])).toEqual(['highpass', 'acompressor']);
  });

  it('normaliza com ganho linear até o alvo e limita abaixo do pico pedido', () => {
    const [volume, limiter] = normalizeChain(-20.5, audioDefaults);
    expect(volume).toBe('volume=6.50dB');
    const limit = Number(/limit=([\d.]+)/.exec(limiter!)![1]);
    expect(20 * Math.log10(limit)).toBeCloseTo(-2, 1);
    // o limitador compensa o próprio lookahead e repõe o fim com apad
    expect(limiter).toContain('atrim=start=0.0050,asetpts=PTS-STARTPTS,apad');
  });

  it('compensate só age quando há atraso', () => {
    expect(compensate(0)).toEqual([]);
    expect(compensate(25)).toEqual(['atrim=start=0.0250', 'asetpts=PTS-STARTPTS']);
  });

  it('trava ganhos absurdos (medição de trecho quase mudo)', () => {
    expect(normalizeChain(-70, audioDefaults)[0]).toBe('volume=20.00dB');
  });
});

describe('buildComposeGraph', () => {
  const base = {
    width: 1920, height: 1080, fps: 30, durationSec: 60, videoFilters: [],
    voiceFilters: ['highpass=f=70'], limiter: 'alimiter=limit=0.8', music: null, sfx: [],
    hasIntro: false, hasOutro: false, bumpers: { introSec: 0, outroSec: 0 },
  };
  const bed = { file: 'C:/m.mp3', gainDb: -24, duck: true, fadeIn: 1.5, fadeOut: 3 };

  it('compõe a camada com alfa sobre o footage', () => {
    const graph = buildComposeGraph({ ...base, hasOverlay: true });
    expect(graph).toContain('[1:v]scale=1920:1080');
    expect(graph).toContain('overlay=0:0:format=auto');
    expect(graph).toContain('[0:a]highpass=f=70[voice]');
    // o atrim fecha o áudio na duração exata do vídeo
    expect(graph).toContain('[voice]alimiter=limit=0.8,atrim=0:60.000,aresample=48000[amain]');
    expect(graph).toContain('[vmain]null[vout]');
    expect(graph).toContain('[amain]anull[aout]');
  });

  it('numera as entradas: corte, overlay, música, um por SFX e vinhetas', () => {
    const sfx = [{ file: 'pop.wav', at: 2, gainDb: -18 }, { file: 'whoosh.wav', at: 9.5, gainDb: -14 }];
    const none = { hasIntro: false, hasOutro: false };
    expect(composeInputs({ hasOverlay: true, music: bed, sfx, hasIntro: true, hasOutro: true })).toEqual({
      overlay: 1, music: 2, sfx: [3, 4], intro: 5, outro: 6, screen: null,
    });
    expect(composeInputs({ hasOverlay: false, music: null, sfx, ...none })).toMatchObject({ overlay: null, music: null, sfx: [1, 2], intro: null });
    expect(composeArgs({ cut: 'cut.mkv', overlay: null, music: bed, sfx, intro: null, outro: 'outro.mp4' })).toEqual([
      '-i', 'cut.mkv', '-stream_loop', '-1', '-i', 'C:/m.mp3', '-i', 'pop.wav', '-i', 'whoosh.wav', '-i', 'outro.mp4',
    ]);
  });

  it('vinhetas entram por concat, com silêncio no áudio, e somam na duração', () => {
    const options = { ...base, hasOverlay: false, hasIntro: true, hasOutro: true, bumpers: { introSec: 2.5, outroSec: 8 } };
    const graph = buildComposeGraph(options);
    expect(graph).toContain('[1:v]fps=30,scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p[introv]');
    expect(graph).toContain('anullsrc=r=48000:cl=stereo,atrim=0:2.500[introa]');
    expect(graph).toContain('[introv][introa][mainv][amain][outrov][outroa]concat=n=3:v=1:a=1[vout][aout]');
    expect(totalDuration(options)).toBe(70.5);
    expect(totalDuration({ ...options, hasOutro: false })).toBe(62.5);
    expect(bumperDurations({ intro: true, outro: false })).toEqual({ introSec: 2.5, outroSec: 0 });
  });

  it('música com ducking usa a voz como chave do sidechain e o amix não rebaixa a voz', () => {
    const graph = buildComposeGraph({
      ...base, hasOverlay: false, music: bed, sfx: [{ file: 'pop.wav', at: 2.5, gainDb: -18 }],
    });
    expect(graph).toContain('[voice]asplit=2[voxmain][voxkey]');
    expect(graph).toContain('afade=t=out:st=57.000:d=3');
    expect(graph).toContain('[bed][voxkey]sidechaincompress=');
    expect(graph).toContain('[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=-18.0dB,adelay=2500:all=1[sfx0]');
    expect(graph).toContain('[voxmain][music][sfx0]amix=inputs=3:normalize=0:duration=first');
  });

  it('música sem ducking entra direto na mixagem', () => {
    const graph = buildComposeGraph({ ...base, hasOverlay: false, music: { ...bed, duck: false } });
    expect(graph).not.toContain('sidechaincompress');
    expect(graph).toContain('[voice][music]amix=inputs=2');
  });

  it('sem overlay usa só o footage, com os filtros de vídeo na ordem', () => {
    const graph = buildComposeGraph({ ...base, hasOverlay: false, videoFilters: ['eq=contrast=1.05', 'unsharp'] });
    expect(graph).not.toContain('[1:v]');
    expect(graph).toContain('[0:v]scale=1920:1080:flags=lanczos,eq=contrast=1.05,unsharp,format=yuv420p[vmain]');
  });
});

describe('collectSfx', () => {
  const edl = edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-11T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 60, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [
      { id: 'c1', start: 0, end: 10 },
      { id: 'c2', start: 20, end: 40 },
    ],
    transitions: [{ id: 't1', intoClip: 'c2', type: 'whip-pan', duration: 0.4 }],
    overlays: [
      { id: 'o1', component: 'LowerThird', at: 2, duration: 4, reason: 'nome' },
      { id: 'o2', component: 'BulletList', at: 20.3, duration: 4, reason: 'lista' },
      { id: 'o3', component: 'SectionTitle', at: 30, duration: 3, reason: 'capítulo' },
    ],
    sfx: [{ id: 's1', file: 'ding.wav', at: 25 }],
  });
  const timeline = buildTimeline(edl.clips, 30);
  const all = (file: string) => `assets/sfx/${file}`;

  it('soma os explícitos, whoosh na transição e pop na entrada de gráfico', () => {
    const cues = collectSfx(edl, timeline, all);
    expect(cues.map((cue) => [cue.file, cue.at])).toEqual([
      [`assets/sfx/${SFX.pop}`, 2],
      [`assets/sfx/${SFX.whoosh}`, 9.8],
      ['assets/sfx/ding.wav', 15],
    ]);
  });

  it('descarta o automático que cairia no mesmo segundo de outro, e mantém o explícito', () => {
    // o pop do BulletList (10.3s) perde para o whoosh (9.8s); SectionTitle não tem pop
    const cues = collectSfx(edl, timeline, all);
    expect(cues.filter((cue) => cue.file.endsWith(SFX.pop))).toHaveLength(1);
    const crowded = { ...edl, sfx: [{ id: 's2', file: 'click.wav', at: 2.2, gainDb: -10 }] };
    expect(collectSfx(crowded, timeline, all).map((cue) => cue.file)).toContain('assets/sfx/click.wav');
  });

  it('ignora o que não está na biblioteca', () => {
    expect(collectSfx(edl, timeline, () => null)).toEqual([]);
  });
});

describe('assets', () => {
  it('toda receita de SFX vira um comando lavfi em 48 kHz estéreo', () => {
    for (const name of Object.values(SFX)) expect(SFX_RECIPES[name]).toBeDefined();
    const args = sfxArgs(SFX_RECIPES[SFX.pop]!, 'pop.wav');
    expect(args.slice(0, 3)).toEqual(['-f', 'lavfi', '-i']);
    expect(args).toContain('48000');
    expect(args.at(-1)).toBe('pop.wav');
  });

  it('resolveAsset devolve null para o que não existe', () => {
    expect(resolveAsset('sfx', 'nao-existe.wav')).toBeNull();
    expect(resolveAsset('music', 'C:/nao/existe.mp3')).toBeNull();
  });
});

describe('previewSize', () => {
  it('reduz mantendo dimensões pares', () => {
    expect(previewSize({ fps: 30, width: 1920, height: 1080 }, 0.5)).toEqual({ width: 960, height: 540 });
    expect(previewSize({ fps: 30, width: 1080, height: 1920 }, 0.37)).toEqual({ width: 400, height: 710 });
  });
});
