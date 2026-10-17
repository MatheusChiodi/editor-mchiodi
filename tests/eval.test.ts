import { describe, expect, it } from 'vitest';

import { effects } from '../src/arsenal/effects.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import {
  compareWords,
  findCutWords,
  judgeCuts,
  judgeDuration,
  judgeLoudness,
  judgeSync,
  lintStyle,
  measureCuts,
  speechLevel,
} from '../src/eval/checks.ts';
import { formatReport, pickViewpoints } from '../src/eval/index.ts';
import { script } from './helpers.ts';

const RATE = 48000;

function edlWith(extra: Record<string, unknown>) {
  return edlSchema.parse({
    version: 3,
    project: 'teste',
    createdAt: '2026-10-11T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 400, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [
      { id: 'c1', start: 0, end: 100 },
      { id: 'c2', start: 110, end: 400 },
    ],
    ...extra,
  });
}

describe('findCutWords', () => {
  const words = script('um dois três quatro cinco seis');

  it('acusa borda de clipe dentro de uma palavra, dizendo como corrigir', () => {
    const middle = (words[2]!.start + words[2]!.end) / 2;
    const clips = [{ id: 'c1', start: 0, end: middle }, { id: 'c2', start: words[4]!.start - 0.03, end: 3 }];
    const findings = findCutWords({ clips } as never, words, buildTimeline(clips, 30));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'error', check: 'corte-em-palavra' });
    expect(findings[0]!.message).toContain('"três"');
    expect(findings[0]!.fix).toContain('clips[c1].end');
  });

  it('borda na pausa entre palavras passa', () => {
    const clips = [{ id: 'c1', start: 0, end: words[2]!.end + 0.02 }];
    expect(findCutWords({ clips } as never, words, buildTimeline(clips, 30))).toEqual([]);
  });
});

describe('lintStyle', () => {
  it('EDL limpa não gera avisos', () => {
    const edl = edlWith({});
    expect(lintStyle(edl, buildTimeline(edl.clips, 30))).toEqual([]);
  });

  it('acusa zooms colados, gráficos sobrepostos, curtos e sem motivo', () => {
    const edl = edlWith({
      zooms: [
        { id: 'z1', at: 10, duration: 2, reason: 'ênfase' },
        { id: 'z2', at: 15, duration: 2, reason: 'ênfase' },
      ],
      overlays: [
        { id: 'o1', component: 'LowerThird', at: 20, duration: 5, reason: 'nome' },
        { id: 'o2', component: 'Counter', at: 22, duration: 0.5 },
      ],
    });
    const checks = lintStyle(edl, buildTimeline(edl.clips, 30)).map((finding) => finding.check);
    expect(checks).toEqual(expect.arrayContaining(['zoom-frequente', 'graficos-sobrepostos', 'grafico-curto', 'sem-motivo']));
  });

  it('efeito de câmera conta como zoom, e zoom/efeito/transição sem motivo geram aviso', () => {
    const camera = Object.values(effects).find((preset) => preset.category === 'camera')!;
    const edl = edlWith({
      zooms: [{ id: 'z1', at: 10, duration: 2, reason: 'ênfase' }],
      effects: [{ id: 'e1', preset: camera.id, at: 14 }],
      transitions: [{ id: 't1', intoClip: 'c2', type: 'wipe', reason: 'capítulo' }],
    });
    const findings = lintStyle(edl, buildTimeline(edl.clips, 30));
    expect(findings.map((finding) => finding.check)).toEqual(['zoom-frequente', 'sem-motivo']);
    expect(findings[1]!.message).toContain('"e1"');
  });

  it('usa o tempo de saída: itens separados por um trecho cortado ficam próximos', () => {
    const edl = edlWith({
      transitions: [{ id: 't1', intoClip: 'c2', type: 'wipe', reason: 'capítulo' }],
      overlays: [
        { id: 'm1', component: 'MemeInsert', at: 50, duration: 2, reason: 'piada' },
        { id: 'm2', component: 'MemeInsert', at: 135, duration: 2, reason: 'piada' },
      ],
    });
    const findings = lintStyle(edl, buildTimeline(edl.clips, 30));
    expect(findings.map((finding) => finding.check)).toEqual(['meme-frequente']);
    expect(findings[0]!.at).toBe(125);
  });

  it('acusa sequência picotada', () => {
    const clips = [0, 1, 2, 3].map((index) => ({ id: `s${index}`, start: index * 2, end: index * 2 + 0.6 }));
    const edl = edlWith({ clips: [...clips, { id: 'long', start: 20, end: 60 }] });
    expect(lintStyle(edl, buildTimeline(edl.clips, 30)).map((finding) => finding.check)).toContain('picotado');
  });
});

/** 2s de "fala" (senoide) com um corte em 1s: com ou sem fade. */
function tone(fade: boolean): Float32Array {
  const samples = new Float32Array(RATE * 2);
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / RATE;
    let gain = 0.3;
    if (fade) {
      const distance = Math.abs(time - 1);
      if (distance < 0.1) gain *= Math.max(0, (distance - 0.012) / 0.088);
    }
    samples[index] = gain * Math.sin(2 * Math.PI * 220 * time + (time >= 1 ? 1.3 : 0));
  }
  return samples;
}

describe('áudio nos cortes', () => {
  it('speechLevel ignora o silêncio', () => {
    const samples = new Float32Array(RATE * 2);
    for (let index = 0; index < RATE; index += 1) samples[index] = 0.3 * Math.sin((2 * Math.PI * 220 * index) / RATE);
    expect(speechLevel(samples, RATE)).toBeCloseTo(0.3 / Math.SQRT2, 2);
    expect(speechLevel(new Float32Array(0), RATE)).toBe(0);
  });

  it('corte com fade e pausa passa', () => {
    expect(judgeCuts(measureCuts(tone(true), RATE, [1]))).toEqual([]);
  });

  it('corte seco em cima de som acusa estalo e corte em som', () => {
    const checks = judgeCuts(measureCuts(tone(false), RATE, [1])).map((finding) => finding.check);
    expect(checks).toEqual(['estalo', 'corte-em-som']);
  });
});

describe('sincronia das legendas', () => {
  const expected = script('hoje vamos falar de React e de hooks no projeto');

  it('alinha apesar de palavras a mais e mede o deslocamento', () => {
    const heard = [
      { text: 'Então', start: -0.3, end: -0.1 },
      ...expected.map((word) => ({ ...word, text: word.text.toUpperCase(), start: word.start + 0.05, end: word.end + 0.05 })),
    ];
    const result = compareWords(expected, heard);
    expect(result.matched).toBe(expected.length);
    expect(result.medianOffset).toBeCloseTo(0.05, 3);
    expect(result.missing).toEqual([]);
    expect(judgeSync(result, [])).toEqual([]);
  });

  it('acusa legenda fora de sincronia', () => {
    const heard = expected.map((word) => ({ ...word, start: word.start + 0.4, end: word.end + 0.4 }));
    const findings = judgeSync(compareWords(expected, heard), []);
    expect(findings[0]).toMatchObject({ severity: 'error', check: 'legenda-dessincronizada' });
  });

  it('palavra sumida perto de um corte vira aviso localizado', () => {
    const heard = expected.filter((word) => word.text !== 'React');
    const result = compareWords(expected, heard);
    expect(result.missing.map((word) => word.text)).toEqual(['React']);
    const react = expected.find((word) => word.text === 'React')!;
    expect(judgeSync(result, [react.end + 0.1]).map((finding) => finding.check)).toEqual(['palavra-perdida-no-corte']);
    expect(judgeSync(result, [50])).toEqual([]);
  });
});

describe('loudness e duração', () => {
  it('aceita dentro da tolerância e recusa fora', () => {
    expect(judgeLoudness(-14.6, -1.8, -14, -1.5)).toEqual([]);
    expect(judgeLoudness(-17, -0.2, -14, -1.5).map((finding) => finding.check)).toEqual(['loudness', 'pico']);
  });

  it('acusa duração diferente da EDL e drift entre áudio e vídeo', () => {
    expect(judgeDuration(100, 100.02, 100, 30)).toEqual([]);
    expect(judgeDuration(100.3, 101.5, 100, 30).map((finding) => finding.check)).toEqual(['duracao', 'drift-av']);
  });
});

describe('pickViewpoints', () => {
  it('prioriza problemas, depois overlays, e amostra os cortes sem repetir pontos próximos', () => {
    const cuts = Array.from({ length: 40 }, (_, index) => 10 + index * 5);
    const points = pickViewpoints(
      cuts,
      [{ id: 'o1', at: 30, duration: 4 }],
      [{ severity: 'error', check: 'estalo', at: 55, message: '', fix: '' }],
      6,
    );
    expect(points).toHaveLength(6);
    expect(points.map((point) => point.why)).toEqual(expect.arrayContaining(['estalo', 'overlay o1', 'corte (amostra)']));
    points.forEach((point, index) => {
      if (index > 0) expect(point.at - points[index - 1]!.at).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('formatReport', () => {
  it('resume o veredito, as correções e as imagens', () => {
    const text = formatReport({
      edlVersion: 2,
      file: 'preview.mp4',
      createdAt: '',
      passed: false,
      metrics: { durationSec: 60, expectedSec: 60, loudnessLufs: -14.2, truePeakDb: -1.9, cuts: 12, captionOffsetMs: 30, wordsMatched: 100 },
      findings: [{ severity: 'error', check: 'estalo', at: 5, message: 'áudio não zera', fix: 'confira o fade' }],
      views: [{ at: 5, why: 'estalo', file: 'view.png' }],
    });
    expect(text).toContain('EDL v2: REPROVADO');
    expect(text).toContain('[ERRO] estalo: áudio não zera');
    expect(text).toContain('→ confira o fade');
    expect(text).toContain('legenda +30 ms');
    expect(text).toContain('view.png  (estalo)');
  });
});
