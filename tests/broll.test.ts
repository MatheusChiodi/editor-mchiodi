import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { missingQueries } from '../src/broll/cli.ts';
import { type BrollEntry, LOCAL_LICENSE, makeEntry, PEXELS_LICENSE, planIndex, readIndex, scanFiles, tagsFromName, updateIndex } from '../src/broll/library.ts';
import { fetchBroll, type FetchFn, knownPexelsIds, pickFile, pickVideo, type PexelsVideo, searchUrl } from '../src/broll/pexels.ts';
import { applyBroll, brollCap, findTriggers, formatBroll, matchLibrary, suggestBroll, type BrollSuggestInput } from '../src/broll/suggest.ts';
import { expandTags, groupsOf, stem, tagsOf } from '../src/broll/terms.ts';
import { levelProfile } from '../src/edl/levels.ts';
import { edlSchema, type EdlInput } from '../src/edl/schema.ts';
import { diffEdl } from '../src/edl/store.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { visualEvents } from '../src/eval/checks.ts';
import { buildComposeGraph, composeArgs, composeInputs } from '../src/render/compose.ts';
import { buildBrollGraph, placeBroll } from '../src/render/layout.ts';
import { shortsEdl } from '../src/render/shorts.ts';
import type { TechMention } from '../src/tech/detect.ts';
import { script } from './helpers.ts';

const tmp = mkdtempSync(join(tmpdir(), 'mce-broll-unit-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const base: EdlInput = {
  version: 1,
  project: 'teste',
  createdAt: '2026-10-17T00:00:00.000Z',
  source: { path: 'C:/v.mp4', durationSec: 200, fps: 30, width: 1920, height: 1080 },
  output: { fps: 30, width: 1920, height: 1080 },
  clips: [
    { id: 'c001', start: 0, end: 20 },
    { id: 'c002', start: 22, end: 180 },
  ],
};

const entry = (file: string, tags: string[], durationSec = 10): BrollEntry => ({
  file, tags, durationSec, width: 1920, height: 1080, source: 'local', license: LOCAL_LICENSE, size: 1, mtimeMs: 1, addedAt: '2026-10-17',
});

describe('vocabulário (normalização PT-BR)', () => {
  it('tira acento, caixa, plural e diminutivo', () => {
    expect(stem('Celulares')).toBe('celular');
    expect(stem('canequinha')).toBe('caneca');
    expect(stem('aplicações')).toBe('aplicacao');
    expect(stem('códigos')).toBe('codigo');
    expect(stem('papéis')).toBe('papel');
    expect(stem('apps')).toBe('app');
    expect(stem('gás')).toBe('gas');
  });

  it('acha o grupo pela palavra falada e expande os sinônimos', () => {
    expect(groupsOf('celulares')[0]?.key).toBe('celular');
    expect(groupsOf('xícara')[0]?.key).toBe('cafe');
    expect(groupsOf('cachorro')).toEqual([]);
    expect(expandTags(['caneca'])).toEqual(expect.arrayContaining(['caneca', 'cafe', 'coffee', 'mug']));
  });

  it('tags de texto livre ignoram stopwords, números soltos e sufixos de banco de imagem', () => {
    expect(tagsOf('Pexels 855282 man typing on laptop 1080p')).toEqual(['man', 'typing', 'laptop']);
  });
});

describe('biblioteca (assets/broll/index.json)', () => {
  it('tags vêm das pastas e do nome do arquivo', () => {
    expect(tagsFromName('cafe/Caneca-fumaça_01.mp4')).toEqual(['cafe', 'caneca', 'fumaca']);
    expect(tagsFromName('pexels/writing-notebook-1234.mp4')).toEqual(['writing', 'notebook']);
  });

  it('planIndex só mede o que é novo ou mudou e acusa o que sumiu', () => {
    const current = { updatedAt: '', entries: [entry('a.mp4', ['a']), entry('b.mp4', ['b'])] };
    const plan = planIndex(current, [
      { file: 'a.mp4', size: 1, mtimeMs: 1 },
      { file: 'c.mp4', size: 5, mtimeMs: 9 },
    ]);
    expect(plan.kept.map((item) => item.file)).toEqual(['a.mp4']);
    expect(plan.toProbe.map((item) => item.file)).toEqual(['c.mp4']);
    expect(plan.removed).toEqual(['b.mp4']);
  });

  it('re-medir preserva tags manuais, origem e licença', () => {
    const previous = { ...entry('pexels/x-1.mp4', ['manual']), source: 'pexels' as const, license: PEXELS_LICENSE, author: 'Fulano', url: 'https://www.pexels.com/video/x-1/' };
    const made = makeEntry({ file: 'pexels/x-1.mp4', size: 2, mtimeMs: 3 }, { durationSec: 7, width: 1280, height: 720 }, previous, 'agora');
    expect(made).toMatchObject({ tags: ['manual'], source: 'pexels', license: PEXELS_LICENSE, author: 'Fulano', durationSec: 7, size: 2, addedAt: '2026-10-17' });
    expect(makeEntry({ file: 'rua/cidade.mov', size: 2, mtimeMs: 3 }, { durationSec: 7, width: 1280, height: 720 }, undefined, 'agora')).toMatchObject({
      tags: ['rua', 'cidade'], source: 'local', license: LOCAL_LICENSE, addedAt: 'agora',
    });
  });

  it('updateIndex varre a pasta (recursivo, só vídeo) e grava o índice', async () => {
    const root = join(tmp, 'lib');
    mkdirSync(join(root, 'cafe'), { recursive: true });
    writeFileSync(join(root, 'cafe', 'caneca.mp4'), 'x');
    writeFileSync(join(root, 'notas.txt'), 'x');
    writeFileSync(join(root, 'quebrado.mov'), 'x');
    expect(scanFiles(root).map((file) => file.file)).toEqual(['cafe/caneca.mp4', 'quebrado.mov']);
    const measure = async (path: string) => {
      if (path.endsWith('quebrado.mov')) throw new Error('sem vídeo');
      return { durationSec: 6, width: 1920, height: 1080 };
    };
    const result = await updateIndex(root, measure);
    expect(result.added).toEqual(['cafe/caneca.mp4']);
    expect(result.failed.map((item) => item.file)).toEqual(['quebrado.mov']);
    expect(readIndex(root).entries[0]).toMatchObject({ file: 'cafe/caneca.mp4', tags: ['cafe', 'caneca'], durationSec: 6 });
    // segunda passada: nada novo para medir
    const again = await updateIndex(root, async () => {
      throw new Error('não devia medir');
    });
    expect(again.added).toEqual([]);
  });
});

describe('EDL: broll', () => {
  const item = { id: 'broll-1', file: 'cafe/caneca.mp4', start: 5, end: 8, reason: 'ilustra "caneca"' };

  it('aceita o inserto e preenche from/fit', () => {
    const edl = edlSchema.parse({ ...base, broll: [item] });
    expect(edl.broll[0]).toMatchObject({ from: 0, fit: 'cover' });
  });

  it('exige reason, fim depois do começo, começo num trecho mantido e id único', () => {
    expect(edlSchema.safeParse({ ...base, broll: [{ ...item, reason: ' ' }] }).success).toBe(false);
    expect(edlSchema.safeParse({ ...base, broll: [{ ...item, end: 4 }] }).success).toBe(false);
    expect(edlSchema.safeParse({ ...base, broll: [{ ...item, start: 21, end: 24 }] }).success).toBe(false);
    expect(edlSchema.safeParse({ ...base, broll: [{ ...item, id: 'c001' }] }).success).toBe(false);
  });

  it('diffEdl conta o b-roll e o Short só leva o do trecho', () => {
    const a = edlSchema.parse(base);
    const b = edlSchema.parse({ ...base, broll: [item], shorts: { start: 30, end: 60 } });
    expect(diffEdl(a, b)).toContain('broll: +1 / -0');
    expect(shortsEdl(b).broll).toEqual([]);
    expect(shortsEdl({ ...b, shorts: { ...b.shorts!, start: 0, end: 30 } }).broll).toHaveLength(1);
  });

  it('a avaliação conta entrada e saída do b-roll como algo novo na tela', () => {
    const edl = edlSchema.parse({ ...base, broll: [item] });
    expect(visualEvents(edl, buildTimeline(edl.clips, 30))).toEqual([5, 8]);
  });
});

describe('render: posicionamento e grafo', () => {
  const timeline = buildTimeline(base.clips, 30);

  it('placeBroll converte para a saída e atravessa o corte num intervalo só', () => {
    expect(placeBroll([{ file: 'x.mp4', start: 18, end: 24, from: 1, fit: 'cover' }], timeline)).toEqual([{ file: 'x.mp4', start: 18, end: 22, from: 1, fit: 'cover' }]);
    expect(placeBroll([{ file: 'x.mp4', start: 20.5, end: 21.5, from: 0, fit: 'cover' }], timeline)).toEqual([]);
  });

  it('cada b-roll é aparado, levado ao fps, deslocado e ligado só no seu intervalo', () => {
    const items = placeBroll(
      [
        { file: 'a.mp4', start: 5, end: 8, from: 0, fit: 'cover' },
        { file: 'b.mp4', start: 40, end: 42, from: 2, fit: 'contain' },
      ],
      timeline,
    );
    const lines = buildBrollGraph({ base: '[brbase]', inputs: [3, 4], items, width: 1920, height: 1080, fps: 30, output: '[brolled]' }).join('\n');
    expect(lines).toContain('[3:v]trim=duration=3.000,setpts=PTS-STARTPTS,fps=30,scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,format=yuv420p,setpts=PTS+5.000/TB[brsrc0]');
    expect(lines).toContain("[brbase][brsrc0]overlay=0:0:eof_action=pass:enable='between(t,5.000,8.000)'[brout0]");
    expect(lines).toContain('force_original_aspect_ratio=decrease');
    expect(lines).toContain("enable='between(t,38.000,40.000)'[brout1]");
    expect(lines.trimEnd().endsWith('[brout1]null[brolled]')).toBe(true);
  });

  it('o b-roll entra depois da tela gravada, com -ss no `from`, e fica abaixo dos gráficos', () => {
    const broll = placeBroll([{ file: 'C:/b/a.mp4', start: 5, end: 8, from: 1.5, fit: 'cover' }], timeline);
    const options = {
      width: 1920, height: 1080, fps: 30, durationSec: 178, videoFilters: [], voiceFilters: [], limiter: 'alimiter',
      music: null, sfx: [], hasIntro: false, hasOutro: false, bumpers: { introSec: 0, outroSec: 0 }, hasOverlay: true, broll,
    };
    expect(composeInputs(options)).toMatchObject({ overlay: 1, screen: null, broll: [2] });
    const graph = buildComposeGraph(options);
    expect(graph).toContain('[0:v]scale=1920:1080:flags=lanczos[brbase]');
    expect(graph).toContain('[brolled]null[base]');
    expect(graph.indexOf('[brolled]')).toBeLessThan(graph.indexOf('[gfx]'));
    expect(composeArgs({ cut: 'cut.mkv', overlay: 'o.mov', music: null, sfx: [], intro: null, outro: null, broll })).toEqual(['-i', 'cut.mkv', '-i', 'o.mov', '-ss', '1.500', '-i', 'C:/b/a.mp4']);
    expect(buildComposeGraph({ ...options, broll: [] })).not.toContain('brbase');
  });
});

describe('sugestão', () => {
  const words = script(
    'então hoje eu vou falar da minha rotina |2 eu pego meu celular de manhã |15 e abro o app |25 depois eu tomo um café na caneca e sento |20 abro o React e começo a programar o dia inteiro',
    10,
  );
  const tech: TechMention[] = (() => {
    const index = words.findIndex((word) => word.text === 'React');
    const word = words[index]!;
    return [{ tech: 'react', name: 'React', start: word.start, end: word.end, heard: 'React', wordIndex: index, wordCount: 1, confidence: 'high', caption: 'React', weak: false }];
  })();
  const input = (over: Partial<BrollSuggestInput> = {}): BrollSuggestInput => ({
    words,
    edl: edlSchema.parse(base),
    library: [],
    tech,
    budget: levelProfile('max').broll,
    ...over,
  });

  it('nível limpa não leva b-roll; o teto cresce com o nível e a duração', () => {
    expect(suggestBroll(input({ budget: levelProfile('limpa').broll }))).toEqual([]);
    expect(brollCap(levelProfile('limpa').broll, 600)).toBe(0);
    expect(brollCap(levelProfile('normal').broll, 60)).toBe(1);
    expect(brollCap(levelProfile('max').broll, 120)).toBe(5);
    expect(formatBroll([], { level: 'limpa', cap: 0, libraryCount: 0 })).toContain('sem b-roll');
  });

  it('acha gatilhos concretos, de tecnologia e da biblioteca', () => {
    const triggers = findTriggers(words, tech, new Set(['rotina']));
    const byWord = Object.fromEntries(triggers.map((trigger) => [trigger.heard, trigger.kind]));
    expect(byWord).toMatchObject({ celular: 'objeto', app: 'objeto', café: 'objeto', caneca: 'objeto', React: 'tecnologia', programar: 'acao', rotina: 'biblioteca' });
    expect(byWord.hoje).toBeUndefined();
  });

  it('sugere em segundos da fonte, com reason e o termo de busca quando falta arquivo', () => {
    const candidates = suggestBroll(input());
    expect(candidates.length).toBeGreaterThan(0);
    const phone = candidates.find((candidate) => candidate.trigger === 'celular')!;
    const word = words.find((item) => item.text === 'celular')!;
    expect(phone.start).toBe(word.start);
    expect(phone.end).toBeCloseTo(word.start + 4, 3);
    expect(phone.file).toBeNull();
    expect(phone.missing).toBe('smartphone');
    expect(phone.reason).toMatch(/^ilustra "celular" \(objeto citado\)/);
    // ordem de tempo e distância mínima do nível
    for (let index = 1; index < candidates.length; index += 1) {
      expect(candidates[index]!.outputStart - candidates[index - 1]!.outputStart).toBeGreaterThanOrEqual(levelProfile('max').broll.minGapSec);
    }
  });

  it('não colide com gráfico, tela gravada nem b-roll que já existe', () => {
    const word = words.find((item) => item.text === 'celular')!;
    const edl = edlSchema.parse({ ...base, overlays: [{ id: 'g1', component: 'LowerThird', at: word.start - 1, duration: 3, reason: 'x' }] });
    expect(suggestBroll(input({ edl })).some((candidate) => candidate.trigger === 'celular')).toBe(false);
    const screen = edlSchema.parse({ ...base, layout: { segments: [{ start: word.start, end: word.start + 1, mode: 'screen' }] } });
    expect(suggestBroll(input({ edl: screen })).some((candidate) => candidate.trigger === 'celular')).toBe(false);
    const taken = edlSchema.parse({ ...base, broll: [{ id: 'b1', file: 'x.mp4', start: word.start + 1, end: word.start + 2, reason: 'x' }] });
    expect(suggestBroll(input({ edl: taken })).some((candidate) => candidate.trigger === 'celular')).toBe(false);
  });

  it('casa com a biblioteca por sinônimo e encolhe o inserto para caber num arquivo curto', () => {
    const library = [entry('phone/smartphone-mao.mp4', ['phone', 'smartphone', 'mao'], 2.5), entry('cafe/xicara.mp4', ['cafe', 'xicara'])];
    const candidates = suggestBroll(input({ library }));
    const phone = candidates.find((candidate) => candidate.trigger === 'celular')!;
    expect(phone.file).toBe('phone/smartphone-mao.mp4');
    expect(phone.outputEnd - phone.outputStart).toBeCloseTo(2.5, 3);
    expect(phone.missing).toBeNull();
    const coffee = candidates.find((candidate) => candidate.term === 'cafe');
    expect(coffee?.file).toBe('cafe/xicara.mp4');
  });

  it('matchLibrary prefere a palavra exata e varia o arquivo', () => {
    const library = [entry('a.mp4', ['coffee']), entry('b.mp4', ['caneca'])];
    expect(matchLibrary(expandTags(['caneca']), 'caneca', library, 3, new Map())?.file).toBe('b.mp4');
    expect(matchLibrary(expandTags(['caneca']), 'caneca', library, 3, new Map([['b.mp4', 2]]))?.file).toBe('a.mp4');
    expect(matchLibrary(['carro'], 'carro', library, 3, new Map())).toBeNull();
  });

  it('applyBroll grava só o que tem arquivo, com ids novos, reason e notes; a EDL resultante valida', () => {
    const edl = edlSchema.parse({ ...base, broll: [{ id: 'broll-1', file: 'x.mp4', start: 2, end: 3, reason: 'antigo' }] });
    const library = [entry('phone/smartphone.mp4', ['smartphone'])];
    const candidates = suggestBroll(input({ edl, library }));
    const { data, applied } = applyBroll(edl, candidates);
    expect(applied.every((candidate) => candidate.file)).toBe(true);
    expect(data.broll.map((item) => item.id)).toEqual(['broll-1', 'broll-2']);
    expect(data.broll[1]).toMatchObject({ file: 'phone/smartphone.mp4', from: 0, fit: 'cover' });
    expect(data.broll[1]!.reason).toContain('celular');
    expect(data.notes).toContain('B-roll assistido');
    expect(data.notes).toMatch(/sem arquivo ficaram de fora/);
    expect(edlSchema.safeParse({ ...data, version: 2, createdAt: 'x' }).success).toBe(true);
  });

  it('missingQueries junta os termos faltando, sem repetir, pela nota', () => {
    expect(
      missingQueries(
        [
          { missing: 'a', score: 1 },
          { missing: null, score: 3 },
          { missing: 'b', score: 2 },
          { missing: 'a', score: 0.5 },
        ],
        5,
      ),
    ).toEqual(['b', 'a']);
  });
});

describe('Pexels (fetch mockado)', () => {
  const video = (id: number, duration: number, files: Partial<PexelsVideo['video_files'][number]>[]): PexelsVideo => ({
    id, width: 3840, height: 2160, duration, url: `https://www.pexels.com/video/coisa-${id}/`, user: { name: 'Autora', url: 'https://www.pexels.com/@autora' },
    video_files: files.map((file, index) => ({ id: index, quality: 'hd', file_type: 'video/mp4', width: 1920, height: 1080, link: `https://cdn/${id}/${index}.mp4`, ...file })),
  });

  it('escolhe HD mp4 até 1920 de largura, em vídeo curto ainda não baixado', () => {
    const v = video(1, 10, [{ width: 3840, quality: 'uhd' }, { width: 1280 }, { width: 1920 }, { width: 1920, file_type: 'video/webm' }]);
    expect(pickFile(v)?.width).toBe(1920);
    expect(pickVideo({ videos: [video(2, 60, [{}]), video(3, 2, [{}]), v] }, new Set())?.video.id).toBe(1);
    expect(pickVideo({ videos: [v] }, new Set([1]))).toBeNull();
    expect(searchUrl('coffee mug')).toBe('https://api.pexels.com/videos/search?query=coffee+mug&per_page=10&orientation=landscape&size=medium');
    expect(knownPexelsIds({ updatedAt: '', entries: [{ ...entry('pexels/a.mp4', []), url: 'https://www.pexels.com/video/coisa-77/' }] })).toEqual(new Set([77]));
  });

  it('baixa para pexels/, registra origem/autor/licença no índice e manda a chave no header', async () => {
    const root = join(tmp, 'pexels-lib');
    const calls: { url: string; auth?: string }[] = [];
    const fake: FetchFn = async (url, init) => {
      calls.push({ url, auth: init?.headers?.Authorization });
      if (url.startsWith('https://api.pexels.com')) {
        const query = new URL(url).searchParams.get('query');
        if (query === 'nada') return { ok: true, status: 200, json: async () => ({ videos: [] }), arrayBuffer: async () => new ArrayBuffer(0) };
        return { ok: true, status: 200, json: async () => ({ videos: [video(42, 8, [{}])] }), arrayBuffer: async () => new ArrayBuffer(0) };
      }
      return { ok: true, status: 200, json: async () => ({}), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    };
    const results = await fetchBroll({ apiKey: 'chave', queries: ['coffee mug', 'nada'], fetch: fake, root });
    expect(results.map((result) => result.file)).toEqual(['pexels/coffee-mug-42.mp4', null]);
    expect(readFileSync(join(root, 'pexels', 'coffee-mug-42.mp4'))).toHaveLength(3);
    expect(calls.filter((call) => call.url.startsWith('https://api.pexels.com')).every((call) => call.auth === 'chave')).toBe(true);
    const saved = readIndex(root).entries[0]!;
    expect(saved).toMatchObject({ file: 'pexels/coffee-mug-42.mp4', source: 'pexels', license: PEXELS_LICENSE, durationSec: 8, url: 'https://www.pexels.com/video/coisa-42/' });
    expect(saved.author).toContain('Autora');
    expect(saved.tags).toEqual(expect.arrayContaining(['coffee', 'mug', 'cafe', 'caneca']));
  });

  it('chave recusada para a busca sem baixar nada', async () => {
    const root = join(tmp, 'pexels-401');
    const fake: FetchFn = async () => ({ ok: false, status: 401, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) });
    const results = await fetchBroll({ apiKey: 'errada', queries: ['a', 'b'], fetch: fake, root });
    expect(results).toEqual([{ query: 'a', file: null, note: 'chave do Pexels recusada (PEXELS_API_KEY)' }]);
  });
});
