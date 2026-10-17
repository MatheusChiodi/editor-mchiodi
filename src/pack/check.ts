import type { Problem } from '../../motion/src/thumbnail/layout.ts';

/** Limites do YouTube e do que cabe na tela; os números de gosto estão no agente `packager`. */
export const TITLE = { ideal: 60, mobileCut: 70, hardMax: 100, short: 30, keywordWithin: 40 } as const;
export const DESCRIPTION = { hookChars: 150, max: 5000, maxHashtags: 3, minChapters: 3, chapterGapSec: 10 } as const;
export const TAGS = { maxChars: 500, tagChars: 30 } as const;

const STOPWORDS = new Set(
  'a o as os um uma uns umas de do da dos das em no na nos nas por pra para com sem que e ou se eu me meu minha voce voces ele ela isso isto esse essa este esta como mais mas nao sim foi ser sao era ja so ao aos pelo pela the of to and'.split(' '),
);

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Palavras que carregam sentido, sem acento e sem pontuação ("Back-end" → "backend"). */
export function significantWords(text: string): string[] {
  return fold(text)
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ''))
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

/** Caracteres que contam: sem espaço nas pontas nem espaço duplicado. */
export function usefulLength(text: string): number {
  return [...text.trim().replace(/\s+/g, ' ')].length;
}

/** Quanto do texto da capa já está no título (0–1). Capa e título se completam; repetir desperdiça os dois. */
export function coverOverlap(title: string, coverText: string): number {
  const cover = [...new Set(significantWords(coverText))];
  if (cover.length === 0) return 0;
  const inTitle = new Set(significantWords(title));
  return cover.filter((word) => inTitle.has(word)).length / cover.length;
}

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '');
  return letters.length >= 6 && letters === letters.toUpperCase();
}

export function checkTitle(title: string, context: { coverTexts?: string[]; keyword?: string } = {}): Problem[] {
  const problems: Problem[] = [];
  const add = (level: Problem['level'], code: string, message: string) => problems.push({ level, code, message });
  const length = usefulLength(title);

  if (length > TITLE.hardMax) add('error', 'titulo-longo', `${length} caracteres: o YouTube aceita no máximo ${TITLE.hardMax}`);
  else if (length > TITLE.mobileCut) add('error', 'titulo-longo', `${length} caracteres: acima de ${TITLE.mobileCut} o título é cortado no celular`);
  else if (length > TITLE.ideal) add('warning', 'titulo-longo', `${length} caracteres: o ideal é até ${TITLE.ideal}`);
  else if (length < TITLE.short) add('warning', 'titulo-curto', `${length} caracteres: sobra espaço para a palavra-chave ou o benefício (ideal 40–${TITLE.ideal})`);

  if (isAllCaps(title)) add('error', 'caixa-alta', 'título inteiro em caixa alta');
  else {
    const words = title.split(/\s+/).filter((word) => word.replace(/[^\p{L}]/gu, '').length >= 4);
    const shouting = words.filter((word) => word === word.toUpperCase());
    if (words.length >= 3 && shouting.length / words.length > 0.5) add('warning', 'caixa-alta', 'mais da metade do título em caixa alta');
  }
  if (/\p{Extended_Pictographic}/u.test(title)) add('warning', 'emoji', 'emoji no título: o canal não usa');
  if (/[!?]{2,}/.test(title)) add('warning', 'pontuacao', 'pontuação repetida ("!!", "??") soa clickbait');
  if (/\[PREENCHER/i.test(title)) add('error', 'preencher', 'o título ainda tem um [PREENCHER: ...]');

  const keyword = context.keyword?.trim();
  if (keyword) {
    const index = fold(title).indexOf(fold(keyword));
    if (index < 0) add('warning', 'palavra-chave', `a palavra-chave "${keyword}" não está no título`);
    else if (index > TITLE.keywordWithin) add('warning', 'palavra-chave', `a palavra-chave "${keyword}" só aparece no caractere ${index}: traga para o começo`);
  }
  for (const cover of context.coverTexts ?? []) {
    const overlap = coverOverlap(title, cover);
    if (overlap >= 0.75) {
      add('warning', 'capa-repete-titulo', `a capa "${cover.replace(/\n/g, ' ')}" repete o título (${Math.round(overlap * 100)}% das palavras): a capa deve COMPLETAR, não repetir`);
    }
  }
  return problems;
}

const CHAPTER_LINE = /^\s*((?:\d+:)?\d{1,2}:\d{2})\s+(\S.*)$/;

function clockToSeconds(clock: string): number {
  return clock.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

export interface DescriptionChapter {
  at: number;
  title: string;
}

/** Linhas "0:00 Título" da descrição, na ordem em que aparecem. */
export function parseChapters(description: string): DescriptionChapter[] {
  return description.split(/\r?\n/).flatMap((line) => {
    const match = CHAPTER_LINE.exec(line);
    return match ? [{ at: clockToSeconds(match[1]!), title: match[2]!.trim() }] : [];
  });
}

export function extractHashtags(description: string): string[] {
  return description.match(/(?<![\p{L}\d&/])#[\p{L}\d_]+/gu) ?? [];
}

export function extractLinks(description: string): string[] {
  return description.match(/https?:\/\/[^\s)\]]+/g) ?? [];
}

export function extractPlaceholders(text: string): string[] {
  return text.match(/\[PREENCHER[^\]]*\]/gi) ?? [];
}

export function checkDescription(description: string, context: { keyword?: string; expectedChapters?: string } = {}): Problem[] {
  const problems: Problem[] = [];
  const add = (level: Problem['level'], code: string, message: string) => problems.push({ level, code, message });
  const length = [...description].length;

  if (length > DESCRIPTION.max) add('error', 'descricao-longa', `${length} caracteres: o YouTube aceita no máximo ${DESCRIPTION.max}`);
  if (/[<>]/.test(description)) add('error', 'caracter-proibido', 'a descrição tem "<" ou ">": o YouTube recusa');

  const lines = description.split(/\r?\n/);
  const hook = lines.slice(0, 2).map((line) => line.trim()).filter(Boolean);
  const hookText = hook.join(' ');
  if (hook.length === 0) add('error', 'sem-gancho', 'as 2 primeiras linhas estão vazias: é o que aparece antes do "mostrar mais"');
  else {
    if (/^(https?:\/\/|#)/.test(hook[0]!) || CHAPTER_LINE.test(hook[0]!)) add('error', 'sem-gancho', 'a primeira linha é link, hashtag ou capítulo: comece pelo gancho');
    if ([...hookText].length > DESCRIPTION.hookChars) {
      add('warning', 'gancho-longo', `o gancho tem ${[...hookText].length} caracteres: só ~${DESCRIPTION.hookChars} aparecem antes do "mostrar mais"`);
    }
    const keyword = context.keyword?.trim();
    if (keyword && !fold(hookText).includes(fold(keyword))) add('warning', 'palavra-chave', `a palavra-chave "${keyword}" não está no gancho da descrição`);
  }

  const chapters = parseChapters(description);
  if (chapters.length === 0) add('error', 'sem-capitulos', 'a descrição não tem capítulos (linhas "0:00 Título")');
  else {
    if (chapters[0]!.at !== 0) add('error', 'capitulos', 'o primeiro capítulo precisa começar em 0:00');
    if (chapters.length < DESCRIPTION.minChapters) add('error', 'capitulos', `${chapters.length} capítulos: o YouTube só ativa a divisão com ${DESCRIPTION.minChapters} ou mais`);
    chapters.forEach((chapter, index) => {
      const previous = chapters[index - 1];
      if (!previous) return;
      if (chapter.at <= previous.at) add('error', 'capitulos', `"${chapter.title}" não está em ordem crescente`);
      else if (chapter.at - previous.at < DESCRIPTION.chapterGapSec) add('error', 'capitulos', `"${chapter.title}" começa menos de ${DESCRIPTION.chapterGapSec}s depois de "${previous.title}"`);
    });
    const expected = context.expectedChapters ? parseChapters(context.expectedChapters) : [];
    if (expected.length && JSON.stringify(expected) !== JSON.stringify(chapters)) {
      add('warning', 'capitulos-desatualizados', 'os capítulos da descrição não batem com os da EDL: rode `pack write` de novo');
    }
  }

  const placeholders = extractPlaceholders(description);
  if (extractLinks(description).length === 0 && placeholders.length === 0) add('warning', 'sem-links', 'nenhum link na descrição (citados no vídeo, redes, inscrição)');
  for (const placeholder of placeholders) add('warning', 'preencher', `falta preencher antes de publicar: ${placeholder}`);

  const hashtags = extractHashtags(description);
  if (hashtags.length > DESCRIPTION.maxHashtags) add('error', 'hashtags', `${hashtags.length} hashtags: use no máximo ${DESCRIPTION.maxHashtags}`);
  else if (hashtags.length === 0) add('warning', 'hashtags', 'sem hashtags (até 3 aparecem acima do título)');
  if (!/inscrev/i.test(description)) add('warning', 'sem-cta', 'falta a chamada para inscrição');
  return problems;
}

export function checkTags(tags: string[]): Problem[] {
  const problems: Problem[] = [];
  const total = tags.join(',').length;
  if (total > TAGS.maxChars) problems.push({ level: 'error', code: 'tags-longas', message: `${total} caracteres de tags: o YouTube aceita ${TAGS.maxChars}` });
  for (const tag of tags) {
    if (tag.length > TAGS.tagChars) problems.push({ level: 'warning', code: 'tag-longa', message: `"${tag}" tem ${tag.length} caracteres: tag é termo de busca, não frase` });
  }
  const seen = new Set<string>();
  for (const tag of tags) {
    const key = fold(tag.trim());
    if (seen.has(key)) problems.push({ level: 'warning', code: 'tag-repetida', message: `tag repetida: "${tag}"` });
    seen.add(key);
  }
  return problems;
}

export function formatProblems(scope: string, problems: Problem[]): string[] {
  if (problems.length === 0) return [`ok     ${scope}`];
  return [
    `${problems.some((problem) => problem.level === 'error') ? 'ERRO  ' : 'aviso '} ${scope}`,
    ...problems.map((problem) => `         ${problem.level === 'error' ? 'ERRO' : 'aviso'} ${problem.code}: ${problem.message}`),
  ];
}
