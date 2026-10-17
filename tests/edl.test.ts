import { describe, expect, it } from 'vitest';

import { buildPhrases, detectFillers, detectMarkers, detectRetakes } from '../src/analyze/speech.ts';
import { configSchema } from '../src/config.ts';
import { autocut, silentSeconds } from '../src/edl/autocut.ts';
import { edlSchema, type EdlInput } from '../src/edl/schema.ts';
import { buildTimeline, cutPoints, mapSpan, outputToSource, sourceToOutput } from '../src/edl/timeline.ts';
import { escapeFilterPath } from '../src/lib/ffpath.ts';
import { formatChapter, frameAt, frameSeekTime, quantize } from '../src/lib/time.ts';
import { AUDIO_RATE, buildCutGraph, edgeFadeSec, planTransitions } from '../src/render/cuts.ts';
import { script } from './helpers.ts';

const base: EdlInput = {
  version: 1,
  project: 'teste',
  createdAt: '2026-10-11T00:00:00.000Z',
  source: { path: 'C:/v.mp4', durationSec: 60, fps: 60, width: 1920, height: 1080 },
  output: { fps: 30, width: 1920, height: 1080 },
  clips: [
    { id: 'c001', start: 1, end: 10 },
    { id: 'c002', start: 12, end: 30 },
  ],
};

describe('edlSchema', () => {
  it('aceita a EDL mínima e preenche os padrões', () => {
    const edl = edlSchema.parse(base);
    expect(edl.captions.enabled).toBe(true);
    expect(edl.audio.targetLufs).toBe(-14);
    expect(edl.overlays).toEqual([]);
  });

  it('recusa clipes sobrepostos ou fora de ordem', () => {
    const result = edlSchema.safeParse({ ...base, clips: [base.clips[1], base.clips[0]] });
    expect(result.success).toBe(false);
  });

  it('recusa clipe além do fim da fonte', () => {
    const result = edlSchema.safeParse({ ...base, clips: [{ id: 'c001', start: 50, end: 70 }] });
    expect(result.success).toBe(false);
  });

  it('recusa overlay ancorado num trecho cortado', () => {
    const overlay = { id: 'o1', component: 'LowerThird', at: 11, duration: 3 };
    expect(edlSchema.safeParse({ ...base, overlays: [overlay] }).success).toBe(false);
    expect(edlSchema.safeParse({ ...base, overlays: [{ ...overlay, at: 13 }] }).success).toBe(true);
  });

  it('recusa ids duplicados e transição no primeiro clipe', () => {
    const duplicated = { ...base, clips: [base.clips[0], { ...base.clips[1]!, id: 'c001' }] };
    expect(edlSchema.safeParse(duplicated).success).toBe(false);
    const transition = { id: 't1', intoClip: 'c001', type: 'whip-pan' };
    expect(edlSchema.safeParse({ ...base, transitions: [transition] }).success).toBe(false);
    expect(edlSchema.safeParse({ ...base, transitions: [{ ...transition, intoClip: 'c002' }] }).success).toBe(true);
  });

  it('exige ao menos 3 capítulos quando houver capítulos', () => {
    const chapters = [{ title: 'Intro', at: 1 }, { title: 'Meio', at: 13 }];
    expect(edlSchema.safeParse({ ...base, chapters }).success).toBe(false);
    expect(edlSchema.safeParse({ ...base, chapters: [...chapters, { title: 'Fim', at: 25 }] }).success).toBe(true);
  });
});

describe('timeline', () => {
  const timeline = buildTimeline(base.clips, 30);

  it('empilha os clipes na saída', () => {
    expect(timeline.durationSec).toBe(27);
    expect(timeline.clips[1]).toMatchObject({ outputStart: 9, outputEnd: 27, startFrame: 360, endFrame: 900 });
    expect(cutPoints(timeline)).toEqual([9]);
  });

  it('converte fonte ↔ saída e devolve null no trecho cortado', () => {
    expect(sourceToOutput(timeline, 5)).toBe(4);
    expect(sourceToOutput(timeline, 13.5)).toBe(10.5);
    expect(sourceToOutput(timeline, 11)).toBeNull();
    expect(outputToSource(timeline, 10.5)).toBe(13.5);
  });

  it('recorta palavra que atravessa um corte e descarta a cortada', () => {
    expect(mapSpan(timeline, { start: 9.8, end: 10.4 })).toEqual({ start: 8.8, end: 9 });
    expect(mapSpan(timeline, { start: 10.5, end: 11 })).toBeNull();
  });

  it('quantiza na grade de frames: a soma dos clipes é a duração exata', () => {
    const odd = buildTimeline(
      [
        { id: 'a', start: 0.013, end: 2.349 },
        { id: 'b', start: 3.1234, end: 7.7777 },
        { id: 'c', start: 8.001, end: 8.01 },
      ],
      30,
    );
    const frames = odd.clips.reduce((sum, clip) => sum + (clip.endFrame - clip.startFrame), 0);
    expect(odd.durationSec * 30).toBeCloseTo(frames, 6);
    // o clipe "c" tem menos de 1 frame e some
    expect(odd.clips.map((clip) => clip.id)).toEqual(['a', 'b']);
  });
});

describe('lib', () => {
  it('quantize', () => {
    expect(quantize(1.02, 30)).toBeCloseTo(1 + 1 / 30, 6);
    expect(quantize(1.02, 30, 'floor')).toBeCloseTo(1, 6);
    expect(quantize(1.02, 30, 'ceil')).toBeCloseTo(1 + 1 / 30, 6);
    expect(quantize(2, 30, 'ceil')).toBe(2);
  });

  it('frameAt e frameSeekTime miram o frame na tela, nunca o seguinte', () => {
    expect(frameAt(10.5 / 30, 30)).toBe(10);
    expect(frameAt(0.967, 30)).toBe(29);
    expect(frameAt(12 / 30, 30)).toBe(12);
    expect(frameSeekTime(29, 30)).toBeLessThan(29 / 30);
    expect(frameSeekTime(29, 30)).toBeGreaterThan(28.5 / 30);
    expect(frameSeekTime(0, 30)).toBe(0);
  });

  it('formatChapter', () => {
    expect(formatChapter(0)).toBe('0:00');
    expect(formatChapter(754.9)).toBe('12:34');
    expect(formatChapter(3723)).toBe('1:02:03');
  });

  it('escapeFilterPath protege o ":" do drive', () => {
    expect(escapeFilterPath('C:\\videos\\meu video\\legenda.ass')).toBe("'C\\:/videos/meu video/legenda.ass'");
  });
});

describe('buildCutGraph', () => {
  it('recorta por frame e por amostra, com fade em cada borda', () => {
    const timeline = buildTimeline(base.clips, 30);
    const graph = buildCutGraph(timeline, { fps: 30, width: 1920, height: 1080, fadeMs: 12 });
    expect(graph).toContain('trim=start_frame=30:end_frame=300');
    expect(graph).toContain(`atrim=start_sample=${AUDIO_RATE}:end_sample=${AUDIO_RATE * 10}`);
    expect(graph).toContain('afade=t=out:st=8.988000:d=0.012');
    expect(graph).toContain('[v0][v1]concat=n=2:v=1:a=0,fps=30[vcut]');
    expect(graph).toContain('[a0][a1]concat=n=2:v=0:a=1[acut]');
    expect(graph).not.toContain('xfade');
  });

  it('edgeFadeSec: fade pedido, limitado a 1/3 do clipe; zero desliga', () => {
    expect(edgeFadeSec(9, 0.012)).toBe(0.012);
    expect(edgeFadeSec(0.09, 0.05)).toBe(0.03);
    expect(edgeFadeSec(0.1, 0.03)).toBe(0.03);
    expect(edgeFadeSec(5, 0)).toBe(0);
    expect(edgeFadeSec(0, 0.012)).toBe(0);
    // os dois fades cabem no clipe sem se sobrepor
    for (const length of [0.01, 0.05, 0.1, 1]) expect(edgeFadeSec(length, 0.05) * 2).toBeLessThanOrEqual(length);
  });

  it('clipe curto ainda ganha fade (encolhido) em vez de corte seco', () => {
    // 3 frames a 30 fps = 0.1 s; fade de 50 ms vira 1/3 do clipe
    const timeline = buildTimeline([{ id: 'a', start: 1, end: 3 }, { id: 'b', start: 4, end: 4.1 }], 30);
    const graph = buildCutGraph(timeline, { fps: 30, width: 640, height: 360, fadeMs: 50 });
    expect(graph).toContain('afade=t=in:st=0:d=0.033333');
    expect(graph).toContain('afade=t=out:st=0.066667:d=0.033333');
    expect(graph).toContain('afade=t=out:st=1.950000:d=0.05');
    expect(buildCutGraph(timeline, { fps: 30, width: 640, height: 360, fadeMs: 0 })).not.toContain('afade');
  });

  it('transição empresta frames dos dois lados e mantém a duração total', () => {
    const clips = [
      { id: 'a', start: 1, end: 5 },
      { id: 'b', start: 8, end: 12 },
      { id: 'c', start: 14, end: 18 },
    ];
    const timeline = buildTimeline(clips, 30);
    const options = {
      fps: 30, width: 1280, height: 720, fadeMs: 12, sourceFrames: 600,
      transitions: [{ intoClip: 'c', type: 'wipe' as const, duration: 0.4 }],
    };
    expect(planTransitions(timeline, options)).toEqual([{ index: 2, type: 'wipe', half: 6 }]);
    const graph = buildCutGraph(timeline, options);
    // b ganha 6 frames no fim, c ganha 6 no começo; o áudio não muda
    expect(graph).toContain('[vs1]trim=start_frame=240:end_frame=366');
    expect(graph).toContain('[vs2]trim=start_frame=414:end_frame=540');
    expect(graph).toContain(`atrim=start_sample=${14 * AUDIO_RATE}:end_sample=${18 * AUDIO_RATE}`);
    expect(graph).toContain('[v0][v1]concat=n=2:v=1:a=0,fps=30[r0]');
    // bloco 1 tem 120+126 frames; o xfade começa 12 frames antes do fim dele
    expect(graph).toContain('[r0][r1]xfade=transition=smoothleft:duration=0.400000:offset=7.800000[vcut]');
  });

  it('encolhe ou descarta a transição quando não há frames para emprestar', () => {
    const timeline = buildTimeline([{ id: 'a', start: 0, end: 4 }, { id: 'b', start: 0.1 + 4, end: 8 }], 30);
    const base = { fps: 30, width: 1280, height: 720, fadeMs: 12 };
    const wanted = [{ intoClip: 'b', type: 'glitch' as const, duration: 1 }];
    expect(planTransitions(timeline, { ...base, transitions: wanted, sourceFrames: 123 })[0]!.half).toBe(3);
    expect(planTransitions(timeline, { ...base, transitions: wanted, sourceFrames: 120 })).toEqual([]);
    expect(planTransitions(timeline, { ...base, transitions: [{ ...wanted[0]!, intoClip: 'a' }] })).toEqual([]);
  });
});

describe('autocut', () => {
  const cuts = configSchema.parse({}).cuts;

  function run(text: string, voiced: number[] = []) {
    const words = script(text, 0.5);
    const phrases = buildPhrases(words);
    const flags = [...detectMarkers(phrases, words), ...detectRetakes(phrases, words), ...detectFillers(words)];
    const durationSec = words.at(-1)!.end + 1;
    // todo intervalo entre palavras é silêncio, exceto os listados em `voiced`
    const silences = words
      .slice(0, -1)
      .map((word, index) => ({ start: word.end + 0.01, end: words[index + 1]!.start - 0.01 }))
      .filter((span) => span.end - span.start > 0.1 && !voiced.includes(words.findIndex((word) => word.end + 0.01 === span.start)));
    return { words, result: autocut({ words, phrases, flags, silences, durationSec, fps: 30, cuts }) };
  }

  it('não corta pausa que tem som (sem silêncio medido), mesmo longa', () => {
    const { result } = run('primeira frase aqui |2 segunda frase aqui.', [2]);
    expect(result.clips).toHaveLength(1);
    expect(silentSeconds({ start: 1, end: 3 }, [{ start: 0, end: 1.5 }, { start: 2.5, end: 9 }])).toBeCloseTo(1, 6);
  });

  it('encurta pausa longa sem cortar dentro de palavra', () => {
    const { words, result } = run('primeira frase aqui. |2 segunda frase aqui.');
    expect(result.clips).toHaveLength(2);
    for (const clip of result.clips) {
      for (const word of words) {
        const inside = word.start < clip.end && word.end > clip.start;
        if (inside) {
          expect(word.start).toBeGreaterThanOrEqual(clip.start);
          expect(word.end).toBeLessThanOrEqual(clip.end);
        }
      }
    }
    expect(result.removed.some((item) => item.kind === 'silence')).toBe(true);
  });

  it('remove o retake e mantém a última versão', () => {
    const { result } = run('Hoje a gente vai falar sobre o |1 Hoje a gente vai falar sobre React e hooks.');
    expect(result.clips).toHaveLength(1);
    expect(result.clips[0]!.quote).toContain('React');
    expect(result.removed[0]!.kind).toBe('retake');
  });

  it('remove hesitação no meio da frase', () => {
    const { words, result } = run('o React ééé usa hooks');
    const filler = words[2]!;
    expect(result.clips).toHaveLength(2);
    expect(result.clips.every((clip) => clip.end <= filler.start || clip.start >= filler.end)).toBe(true);
  });

  it('clipes saem em ordem e sem sobreposição', () => {
    const { result } = run('um dois três. |1 quatro cinco |0.5 seis. |3 sete oito nove dez.');
    result.clips.forEach((clip, index) => {
      expect(clip.end).toBeGreaterThan(clip.start);
      if (index > 0) expect(clip.start).toBeGreaterThanOrEqual(result.clips[index - 1]!.end);
    });
  });
});
