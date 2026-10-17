import { describe, expect, it } from 'vitest';

import { buildTimeline } from '../src/edl/timeline.ts';
import { alignTokens, buildSrt, buildSrtCues, importSrt, parseSrt } from '../src/render/srt.ts';
import { baseEdl, WORDS } from './cut-fixture.ts';

const edl = baseEdl();
const timeline = buildTimeline(edl.clips, edl.output.fps);

describe('buildSrt', () => {
  it('legendas no tempo de SAÍDA, com as páginas do render', () => {
    const cues = buildSrtCues(WORDS, timeline, edl.captions);
    // as pausas encurtadas pelo corte ficam abaixo de 550 ms na saída: a página só quebra no limite de 5 palavras
    expect(cues.map((cue) => cue.text)).toEqual(['ola pessoal hoje vamos falar', 'de reakt e vite tambem']);
    // "de" começa em 2.75 na fonte; o clipe c002 começa em 1.9 e entra em 1.2 na saída
    expect(cues[1]!.start).toBeCloseTo(1.2 + (2.75 - 1.9), 2);
  });

  it('aplica replacements, quebra por maxWordsPerPage e desloca pela vinheta', () => {
    const captions = { ...edl.captions, maxWordsPerPage: 2, replacements: { reakt: 'React' } };
    const text = buildSrt(WORDS, timeline, captions, 2.5);
    expect(text).toContain('\nReact e\n');
    expect(text.startsWith('1\n00:00:02,500 --> ')).toBe(true);
    expect(parseSrt(text).length).toBe(5);
  });
});

describe('parseSrt', () => {
  it('lê CRLF, BOM e legenda em várias linhas', () => {
    const cues = parseSrt('﻿1\r\n00:00:01,000 --> 00:00:02,500\r\nola\r\nmundo\r\n\r\n2\r\n00:01:00.250 --> 00:01:01,000\r\nfim\r\n');
    expect(cues).toEqual([
      { index: 1, start: 1, end: 2.5, text: 'ola mundo' },
      { index: 2, start: 60.25, end: 61, text: 'fim' },
    ]);
  });
});

describe('alignTokens', () => {
  it('casa iguais e marca trocas', () => {
    expect(alignTokens(['a', 'b', 'c'], ['a', 'x', 'c']).map((step) => step.kind)).toEqual(['equal', 'sub', 'equal']);
  });
});

describe('importSrt', () => {
  const exported = buildSrt(WORDS, timeline, edl.captions);

  it('roundtrip sem mudança não gera nada', () => {
    expect(importSrt(exported, WORDS, timeline, edl.captions)).toEqual({ ops: [], changes: [], unmatched: [] });
  });

  it('correção de grafia vira replacement da palavra transcrita', () => {
    const fixed = exported.replace('reakt', 'React').replace('vite', 'Vite');
    const result = importSrt(fixed, WORDS, timeline, edl.captions);
    expect(result.ops).toEqual([
      { type: 'captionReplace', from: 'reakt', to: 'React' },
      { type: 'captionReplace', from: 'vite', to: 'Vite' },
    ]);
    expect(result.changes[0]!.at).toBe(3.1);
  });

  it('uma palavra virando duas junta; palavra apagada não vira troca', () => {
    expect(importSrt(exported.replace('reakt', 'React JS'), WORDS, timeline, edl.captions).ops).toEqual([
      { type: 'captionReplace', from: 'reakt', to: 'React JS' },
    ]);
    const deleted = importSrt(exported.replace('ola pessoal', 'pessoal'), WORDS, timeline, edl.captions);
    expect(deleted.ops).toEqual([]);
    expect(deleted.unmatched[0]).toContain('"ola"');
  });

  it('voltar à grafia transcrita desfaz a correção; com vinheta, alinha pelo deslocamento', () => {
    const captions = { ...edl.captions, replacements: { reakt: 'React' } };
    const shifted = buildSrt(WORDS, timeline, captions, 2.5).replace('React', 'reakt');
    expect(importSrt(shifted, WORDS, timeline, captions, 2.5).ops).toEqual([{ type: 'captionReplace', from: 'reakt', to: null }]);
  });
});
