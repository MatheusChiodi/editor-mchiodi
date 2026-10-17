import { describe, expect, it } from 'vitest';

import {
  checkDescription,
  checkTags,
  checkTitle,
  coverOverlap,
  extractHashtags,
  extractLinks,
  extractPlaceholders,
  formatProblems,
  parseChapters,
  significantWords,
  usefulLength,
} from '../src/pack/check.ts';
import { buildDescription, buildTagsFile, buildTitlesFile } from '../src/pack/describe.ts';
import { packCheck } from '../src/pack/index.ts';
import { parsePackSpec } from '../src/pack/spec.ts';

const codes = (problems: { level: string; code: string }[]) => problems.map((problem) => `${problem.level}:${problem.code}`);

const CHAPTERS = '0:00 Quatro anos de full stack\n0:47 O mito do dev iniciante\n1:56 Profundidade vs. largura\n';

const spec = parsePackSpec({
  keyword: 'full stack',
  titles: [
    { text: 'Fui dev full stack por 4 anos. Por que virei só front-end', why: 'experiência em primeira pessoa + lacuna' },
    { text: 'Full stack ou front-end? O que mudou depois de 4 anos', why: 'pergunta de busca' },
    { text: 'Dev full stack sabe tudo? O que aprendi ao me especializar', why: 'ataca o mito' },
  ],
  thumbs: [{ frame: 2, layout: 'face-right', text: 'Eu não\nsabia tudo', accent: 'tudo' }],
  description: {
    hook: ['Fui dev full stack por 4 anos e achava que sabia tudo.', 'Depois que virei só front-end, percebi o que faltava.'],
    learn: ['Por que saber as duas coisas não é saber tudo', 'O que a experiência de back-end ainda me dá'],
    links: [{ label: 'Canal', url: 'https://www.youtube.com/@MChiodiDev' }],
    cta: 'Se o vídeo ajudou, se inscreve no canal.',
    hashtags: ['fullstack', '#frontend', 'carreira dev'],
  },
  tags: ['dev full stack', 'front-end', 'carreira em programação'],
});

describe('checkTitle', () => {
  it('conta caracteres úteis e aplica as faixas de tamanho', () => {
    expect(usefulLength('  Dev   full stack  ')).toBe(14);
    expect(codes(checkTitle('Fui dev full stack por 4 anos. Por que virei só front-end'))).toEqual([]);
    expect(codes(checkTitle('Full stack'))).toContain('warning:titulo-curto');
    expect(codes(checkTitle('a'.repeat(30) + ' ' + 'b'.repeat(34)))).toContain('warning:titulo-longo');
    expect(codes(checkTitle('a'.repeat(40) + ' ' + 'b'.repeat(34)))).toContain('error:titulo-longo');
    expect(checkTitle('x'.repeat(101))[0]!.message).toContain('no máximo 100');
  });

  it('reprova caixa alta total e avisa gritaria, emoji e pontuação repetida', () => {
    expect(codes(checkTitle('LARGUEI O FULL STACK DEPOIS DE 4 ANOS DE CARREIRA'))).toContain('error:caixa-alta');
    expect(codes(checkTitle('LARGUEI TUDO depois de QUATRO ANOS sendo FULL STACK'))).toContain('warning:caixa-alta');
    expect(codes(checkTitle('Por que larguei o full stack depois de 4 anos (API e CSS)'))).toEqual([]);
    expect(codes(checkTitle('Larguei o full stack depois de 4 anos de carreira 🔥'))).toContain('warning:emoji');
    expect(codes(checkTitle('Você ainda quer ser dev full stack em 2026??'))).toContain('warning:pontuacao');
    expect(codes(checkTitle('Dev full stack: [PREENCHER: número] coisas que aprendi'))).toContain('error:preencher');
  });

  it('cobra a palavra-chave no começo', () => {
    const late = 'Tudo o que eu aprendi em quatro anos trabalhando como dev full stack';
    expect(codes(checkTitle(late, { keyword: 'Full Stack' }))).toContain('warning:palavra-chave');
    expect(codes(checkTitle('Por que virei dev front-end depois de 4 anos', { keyword: 'full stack' }))).toContain('warning:palavra-chave');
    expect(codes(checkTitle('Dev full stack sabe tudo? O que aprendi em 4 anos', { keyword: 'full stack' }))).toEqual([]);
  });

  it('capa e título se completam: repetir avisa', () => {
    expect(significantWords('Larguei o Back-end!')).toEqual(['larguei', 'backend']);
    expect(coverOverlap('Por que larguei o back-end depois de 4 anos', 'Larguei o\nback-end')).toBe(1);
    expect(coverOverlap('Fui dev full stack por 4 anos', 'Eu não sabia tudo')).toBe(0);
    expect(coverOverlap('qualquer', 'o a de')).toBe(0);
    const repeated = checkTitle('Por que larguei o back-end depois de 4 anos de full stack', { coverTexts: ['Larguei o\nback-end', 'Eu não sabia tudo'] });
    expect(codes(repeated)).toEqual(['warning:capa-repete-titulo']);
    expect(repeated[0]!.message).toContain('Larguei o back-end');
  });
});

describe('descrição', () => {
  const description = buildDescription(spec.description!, CHAPTERS);

  it('monta na ordem: gancho, tópicos, capítulos, links, inscrição, hashtags', () => {
    expect(description).toBe(
      [
        'Fui dev full stack por 4 anos e achava que sabia tudo.',
        'Depois que virei só front-end, percebi o que faltava.',
        '',
        'Neste vídeo:',
        '• Por que saber as duas coisas não é saber tudo',
        '• O que a experiência de back-end ainda me dá',
        '',
        'Capítulos:',
        '0:00 Quatro anos de full stack',
        '0:47 O mito do dev iniciante',
        '1:56 Profundidade vs. largura',
        '',
        'Links citados:',
        'Canal: https://www.youtube.com/@MChiodiDev',
        '',
        'Se o vídeo ajudou, se inscreve no canal.',
        '',
        '#fullstack #frontend #carreiradev',
        '',
      ].join('\n'),
    );
    expect(buildDescription({ hook: ['Só o gancho'], learn: [], links: [], cta: '', socials: [], hashtags: [] }, '')).toBe('Só o gancho\n');
  });

  it('a descrição montada passa na conferência', () => {
    expect(checkDescription(description, { keyword: 'full stack', expectedChapters: CHAPTERS })).toEqual([]);
    expect(parseChapters(description)).toEqual([
      { at: 0, title: 'Quatro anos de full stack' },
      { at: 47, title: 'O mito do dev iniciante' },
      { at: 116, title: 'Profundidade vs. largura' },
    ]);
    expect(parseChapters('1:02:03 Fim')[0]!.at).toBe(3723);
    expect(extractHashtags(description)).toEqual(['#fullstack', '#frontend', '#carreiradev']);
    expect(extractHashtags('C# e issue#12 não contam, #dev conta')).toEqual(['#dev']);
    expect(extractLinks(description)).toEqual(['https://www.youtube.com/@MChiodiDev']);
  });

  it('cobra gancho curto, com a palavra-chave e sem começar por link', () => {
    expect(codes(checkDescription(`${'x'.repeat(170)}\n\n${CHAPTERS}`))).toContain('warning:gancho-longo');
    expect(codes(checkDescription(`https://x.dev\n\n${CHAPTERS}`))).toContain('error:sem-gancho');
    expect(codes(checkDescription(`\n\n${CHAPTERS}`))).toContain('error:sem-gancho');
    expect(codes(checkDescription(description, { keyword: 'react' }))).toContain('warning:palavra-chave');
  });

  it('cobra capítulos válidos', () => {
    expect(codes(checkDescription('Gancho do vídeo\n\nSem capítulos aqui'))).toContain('error:sem-capitulos');
    const bad = codes(checkDescription('Gancho\n\n0:05 Início\n0:09 Colado\n'));
    expect(bad.filter((code) => code === 'error:capitulos')).toHaveLength(3);
    expect(codes(checkDescription('Gancho\n\n0:00 A\n2:00 B\n1:00 C\n'))).toContain('error:capitulos');
    expect(codes(checkDescription(description, { expectedChapters: '0:00 Outro\n1:00 Mais\n2:00 Fim\n' }))).toContain('warning:capitulos-desatualizados');
  });

  it('cobra links, hashtags, inscrição, tamanho e caracteres proibidos', () => {
    const bare = codes(checkDescription(`Gancho do vídeo\n\n${CHAPTERS}`));
    expect(bare).toEqual(expect.arrayContaining(['warning:sem-links', 'warning:hashtags', 'warning:sem-cta']));
    expect(codes(checkDescription(`${description}#um #dois`))).toContain('error:hashtags');
    expect(codes(checkDescription(`${description}${'x'.repeat(5000)}`))).toContain('error:descricao-longa');
    expect(codes(checkDescription(`${description}<b>`))).toContain('error:caracter-proibido');
    const pending = checkDescription(`Gancho\n\n${CHAPTERS}\nCurso: [PREENCHER: link do curso citado em 2:10]\nSe inscreve! #dev`);
    expect(codes(pending)).toEqual(['warning:preencher']);
    expect(extractPlaceholders('a [PREENCHER: x] b [preencher: y]')).toHaveLength(2);
  });
});

describe('títulos, tags e conferência completa', () => {
  it('titulo.txt traz a recomendada primeiro, com tamanho e porquê', () => {
    const file = buildTitlesFile(spec.titles);
    expect(file.startsWith('1. Fui dev full stack por 4 anos. Por que virei só front-end\n   57 caracteres · recomendado\n   por quê: experiência')).toBe(true);
    expect(file).toContain('2. Full stack ou front-end? O que mudou depois de 4 anos\n   53 caracteres · alternativa para teste A/B');
    expect(buildTitlesFile([])).toBe('');
  });

  it('tags.txt em uma linha, sem repetição; tags longas demais reprovam', () => {
    expect(buildTagsFile(['dev full stack', ' Front-end ', 'front-end', ''])).toBe('dev full stack, Front-end\n');
    expect(buildTagsFile([])).toBe('');
    expect(checkTags(spec.tags)).toEqual([]);
    expect(codes(checkTags(['a'.repeat(31), 'dev', 'Dev']))).toEqual(['warning:tag-longa', 'warning:tag-repetida']);
    expect(codes(checkTags(Array.from({ length: 30 }, (_, index) => `tag de busca ${index} longa`)))).toContain('error:tags-longas');
  });

  it('packCheck aprova o spec bom e soma os problemas do ruim', () => {
    const good = packCheck(spec, CHAPTERS);
    expect(good.errors).toBe(0);
    expect(good.warnings).toBe(0);
    expect(good.description).toContain('Capítulos:\n0:00');
    expect(good.lines.every((line) => line.startsWith('ok'))).toBe(true);

    const bad = packCheck(parsePackSpec({ titles: [{ text: 'EU NÃO SABIA TUDO SOBRE FULL STACK' }], thumbs: spec.thumbs }), '');
    expect(bad.errors).toBeGreaterThanOrEqual(2);
    expect(bad.description).toBeNull();
    expect(bad.lines.join('\n')).toContain('capa-repete-titulo');
    expect(bad.lines.join('\n')).toContain('sem-descricao');
  });

  it('o spec aceita só o array de capas e explica o que está errado', () => {
    expect(parsePackSpec([{ frame: 1, layout: 'band', text: 'Oi' }]).thumbs).toHaveLength(1);
    expect(() => parsePackSpec({ thumbs: [{ frame: 1, layout: 'diagonal', text: 'Oi' }] })).toThrow(/thumbs\.0\.layout/);
    expect(() => parsePackSpec({ titulo: 'x' })).toThrow(/Spec inválido/);
  });

  it('formata o resultado por escopo', () => {
    expect(formatProblems('tags', [])).toEqual(['ok     tags']);
    const lines = formatProblems('título 1', [{ level: 'error', code: 'caixa-alta', message: 'm' }]);
    expect(lines[0]).toContain('ERRO');
    expect(lines[1]).toContain('caixa-alta: m');
  });
});
