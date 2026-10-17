import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { analyzeSpeech } from '../src/analyze/index.ts';
import { parseLoudnorm, parseSilences } from '../src/analyze/media.ts';
import { renderTakes } from '../src/analyze/takes.ts';
import type { Analysis, Transcript } from '../src/analyze/types.ts';
import { configSchema } from '../src/config.ts';
import { diffEdl, edlPath, listVersions, loadEdl, saveNewVersion, validateEdl } from '../src/edl/store.ts';
import { escapeFilterText } from '../src/lib/ffpath.ts';
import { formatClock, parseRational, round3, toFrames } from '../src/lib/time.ts';
import { type ProjectPaths, readJson, slugFromFile, slugify, writeJson } from '../src/project/paths.ts';
import { script } from './helpers.ts';

describe('parsers do ffmpeg', () => {
  it('parseSilences lê pares start/end e ignora start sem end', () => {
    const stderr = [
      '[silencedetect @ 0x1] silence_start: 1.5',
      '[silencedetect @ 0x1] silence_end: 2.75 | silence_duration: 1.25',
      '[silencedetect @ 0x1] silence_start: -0.01',
      '[silencedetect @ 0x1] silence_end: 0.4 | silence_duration: 0.41',
      '[silencedetect @ 0x1] silence_start: 9.1',
    ].join('\r\n');
    expect(parseSilences(stderr)).toEqual([
      { start: 1.5, end: 2.75 },
      { start: 0, end: 0.4 },
    ]);
  });

  it('parseLoudnorm extrai a medição do JSON no fim do stderr', () => {
    const stderr = `frame=1 {lixo}\n[Parsed_loudnorm_0 @ 0x2]\n{\n"input_i" : "-21.30",\n"input_tp" : "-3.10",\n"input_lra" : "6.40",\n"input_thresh" : "-31.50",\n"target_offset" : "0.10"\n}\n`;
    expect(parseLoudnorm(stderr)).toEqual({ integratedLufs: -21.3, truePeakDb: -3.1, lra: 6.4, threshold: -31.5 });
  });

  it('parseLoudnorm falha claro quando não há medição', () => {
    expect(() => parseLoudnorm('sem json')).toThrow(/loudnorm/);
  });
});

describe('lib/time', () => {
  it('formata e converte', () => {
    expect(formatClock(83.456)).toBe('01:23.46');
    expect(formatClock(5, 0)).toBe('00:05');
    expect(parseRational('60000/1001')).toBeCloseTo(59.94, 2);
    expect(parseRational('30')).toBe(30);
    expect(parseRational('0/0')).toBe(0);
    expect(toFrames(1.5, 30)).toBe(45);
    expect(round3(1.23456)).toBe(1.235);
  });

  it('escapeFilterText neutraliza separadores do filtergraph', () => {
    expect(escapeFilterText('a:b,c')).toBe('a\\:b\\,c');
  });
});

describe('config', () => {
  it('tem padrões completos e aceita sobrescrita parcial', () => {
    const config = configSchema.parse({ cuts: { padIn: 0.2 }, output: { fps: 'source' } });
    expect(config.cuts.padIn).toBe(0.2);
    expect(config.cuts.padOut).toBe(0.16);
    expect(config.output.fps).toBe('source');
    expect(config.transcribe.language).toBe('pt');
  });
});

describe('project/paths', () => {
  it('slugify tira acento, espaço e pontuação', () => {
    expect(slugify('Dev Full Stack para dev Front End ')).toBe('dev-full-stack-para-dev-front-end');
    expect(slugify('Ação & Reação!')).toBe('acao-reacao');
    expect(slugify('???')).toBe('video');
    expect(slugFromFile('D:\\inbox\\Meu Vídeo 01.mp4')).toBe('meu-video-01');
  });
});

describe('analyzeSpeech + takes.md', () => {
  const words = script('Hoje a gente vai falar sobre o |1 Hoje a gente vai falar sobre React. |2 ééé é isso.');
  const transcript = { words } as Transcript;
  const { phrases, flags } = analyzeSpeech(transcript, []);

  it('junta todas as detecções em ordem de tempo', () => {
    expect(phrases).toHaveLength(3);
    expect(flags.map((flag) => flag.kind)).toEqual(expect.arrayContaining(['retake', 'filler', 'voiced-gap']));
    flags.forEach((flag, index) => {
      if (index > 0) expect(flag.start).toBeGreaterThanOrEqual(flags[index - 1]!.start);
    });
  });

  it('takes.md lista frases, pausas e sugestões com o referencial da fonte', () => {
    const analysis: Analysis = {
      source: {
        path: 'D:\\inbox\\aula.mp4', durationSec: 12, fps: 60, width: 1920, height: 1080,
        videoCodec: 'h264', isVfr: false, audioRate: 48000, audioChannels: 2, hasAudio: true,
      },
      renderSource: 'D:\\inbox\\aula.mp4',
      proxy: 'proxy.mp4',
      loudness: { integratedLufs: -19.2, truePeakDb: -2, lra: 5, threshold: -29 },
      silences: [],
      scenes: [],
      phrases,
      flags,
      createdAt: '2026-10-11T00:00:00.000Z',
    };
    const takes = renderTakes(analysis, 0.65);
    expect(takes).toContain('# takes — aula.mp4');
    expect(takes).toContain('P001 00:00.00–');
    expect(takes).toContain('>> RETAKE');
    expect(takes).toContain('[auto, conf');
    expect(takes).toContain('[sugestão, conf 0.50]');
    expect(takes).toContain('‖ 2.0s');
    expect(takes).toContain('-19.2 LUFS');
  });
});

describe('edl/store', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mce-'));
  const paths = { slug: 'teste', edlDir: join(dir, 'edl') } as ProjectPaths;
  const data = {
    project: 'teste',
    source: { path: 'C:/v.mp4', durationSec: 60, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [{ id: 'c001', start: 0, end: 10 }],
  };
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('cada gravação vira uma nova versão, sem sobrescrever', () => {
    expect(listVersions(paths)).toEqual([]);
    expect(() => loadEdl(paths)).toThrow(/Nenhuma EDL/);
    const first = saveNewVersion(paths, data);
    const second = saveNewVersion(paths, { ...data, clips: [{ id: 'c001', start: 0, end: 8 }], notes: 'mais curto' });
    expect([first.version, second.version]).toEqual([1, 2]);
    expect(listVersions(paths)).toEqual([1, 2]);
    expect(loadEdl(paths).notes).toBe('mais curto');
    expect(loadEdl(paths, 1).clips[0]!.end).toBe(10);
    expect(readJson<{ version: number }>(edlPath(paths, 1)).version).toBe(1);
  });

  it('recusa versão inexistente e EDL inválida, com mensagem legível', () => {
    expect(() => loadEdl(paths, 9)).toThrow(/v9 não existe/);
    expect(() => saveNewVersion(paths, { ...data, clips: [] })).toThrow(/EDL inválida/);
    expect(() => validateEdl({ ...data, version: 1, createdAt: 'x', clips: [{ id: 'C 1', start: 5, end: 2 }] })).toThrow(/clips\.0/);
    expect(listVersions(paths)).toEqual([1, 2]);
  });

  it('diffEdl resume o que mudou', () => {
    const a = loadEdl(paths, 1);
    const b = validateEdl({
      ...a,
      overlays: [{ id: 'o1', component: 'LowerThird', at: 2, duration: 3 }],
      grade: { preset: 'warm' },
    });
    expect(diffEdl(a, b)).toEqual(['clipes: 1 → 1 (duração +0.00s)', 'overlays: +1 / -0', 'grade: alterado']);
  });

  it('writeJson cria a pasta e readJson tolera BOM', () => {
    const file = join(dir, 'a', 'b.json');
    writeJson(file, { ok: true });
    expect(readJson(file)).toEqual({ ok: true });
  });
});
