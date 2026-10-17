/**
 * Vocabulário do b-roll: normalização PT-BR (sem acento, sem caixa, plural e diminutivo reduzidos) e grupos de
 * sinônimos simples. Um grupo junta o que a fala diz ("celular", "smartphone") com o que um nome de arquivo
 * costuma ter ("phone"), e traz a busca em inglês usada no banco de vídeos (Pexels).
 */

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Palavras de um texto livre (fala ou nome de arquivo), normalizadas. */
export function words(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Radical simples do PT-BR: plural e diminutivo. Determinístico e conservador (palavra curta fica como está). */
export function stem(word: string): string {
  let token = normalizeText(word).replace(/[^a-z0-9]/g, '');
  if (token.length <= 3) return token;
  const rules: [RegExp, string][] = [
    [/quinh(a|o)s?$/, 'c$1'],
    [/guinh(a|o)s?$/, 'g$1'],
    [/zinh(a|o)s?$/, '$1'],
    [/inh(a|o)s?$/, '$1'],
    [/oes$/, 'ao'],
    [/aes$/, 'ao'],
    [/ais$/, 'al'],
    [/eis$/, 'el'],
    [/ois$/, 'ol'],
    [/(r|z)es$/, '$1'],
    [/ns$/, 'm'],
    [/([^s])s$/, '$1'],
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(token)) {
      token = token.replace(pattern, replacement);
      break;
    }
  }
  return token;
}

/** Palavras que nunca viram tag nem gatilho (artigos, preposições, números soltos, sufixos de banco de imagem). */
export const STOPWORDS = new Set(
  [
    'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'com', 'por', 'para',
    'pra', 'the', 'of', 'and', 'in', 'on', 'with', 'at', 'to', 'video', 'videos', 'clip', 'stock', 'footage', 'pexels', 'hd',
    'uhd', 'fhd', '4k', '1080p', '720p', '2160p', 'final', 'copy', 'copia', 'broll', 'b', 'roll', 'mp4', 'mov',
  ].map(normalizeText),
);

export interface TermGroup {
  /** chave estável do grupo */
  key: string;
  /** como a fala e os nomes de arquivo escrevem (comparação por `stem`) */
  terms: string[];
  /** busca em inglês no banco de vídeos */
  query: string;
  kind: 'objeto' | 'lugar' | 'acao';
}

// prettier-ignore
export const TERM_GROUPS: readonly TermGroup[] = [
  { key: 'celular', kind: 'objeto', query: 'smartphone', terms: ['celular', 'smartphone', 'telefone', 'phone', 'iphone', 'android', 'mobile'] },
  { key: 'tablet', kind: 'objeto', query: 'tablet', terms: ['tablet', 'ipad'] },
  { key: 'computador', kind: 'objeto', query: 'laptop typing', terms: ['computador', 'notebook', 'laptop', 'pc', 'computer', 'desktop', 'maquina'] },
  { key: 'teclado', kind: 'objeto', query: 'keyboard typing', terms: ['teclado', 'keyboard', 'digitar', 'digitando', 'typing'] },
  { key: 'monitor', kind: 'objeto', query: 'computer monitor', terms: ['monitor', 'tela', 'screen', 'telinha'] },
  { key: 'codigo', kind: 'acao', query: 'programming code', terms: ['codigo', 'programar', 'programando', 'programacao', 'programador', 'code', 'coding', 'programming', 'codar', 'codando'] },
  { key: 'site', kind: 'objeto', query: 'website browsing', terms: ['site', 'website', 'navegador', 'browser', 'pagina', 'web'] },
  { key: 'app', kind: 'objeto', query: 'mobile app', terms: ['app', 'aplicativo', 'aplicacao', 'application'] },
  { key: 'banco-de-dados', kind: 'objeto', query: 'data center server', terms: ['banco', 'database', 'servidor', 'server', 'datacenter', 'dados', 'data'] },
  { key: 'cafe', kind: 'objeto', query: 'coffee mug', terms: ['cafe', 'caneca', 'xicara', 'coffee', 'mug', 'cup'] },
  { key: 'caderno', kind: 'objeto', query: 'writing notebook', terms: ['caderno', 'anotacao', 'anotar', 'anotado', 'bloco', 'notepad', 'writing', 'caneta', 'pen'] },
  { key: 'livro', kind: 'objeto', query: 'reading book', terms: ['livro', 'book', 'ler', 'lendo', 'leitura', 'reading'] },
  { key: 'dinheiro', kind: 'objeto', query: 'money cash', terms: ['dinheiro', 'grana', 'salario', 'money', 'cash', 'pagamento'] },
  { key: 'relogio', kind: 'objeto', query: 'clock ticking', terms: ['relogio', 'clock', 'hora', 'horas', 'prazo', 'deadline'] },
  { key: 'calendario', kind: 'objeto', query: 'calendar', terms: ['calendario', 'calendar', 'agenda'] },
  { key: 'grafico', kind: 'objeto', query: 'business chart', terms: ['grafico', 'chart', 'metrica', 'estatistica'] },
  { key: 'escritorio', kind: 'lugar', query: 'office work', terms: ['escritorio', 'office', 'empresa', 'firma', 'trabalho', 'emprego'] },
  { key: 'casa', kind: 'lugar', query: 'home office', terms: ['casa', 'home', 'quarto', 'homeoffice'] },
  { key: 'cidade', kind: 'lugar', query: 'city timelapse', terms: ['cidade', 'city', 'rua', 'street', 'transito'] },
  { key: 'faculdade', kind: 'lugar', query: 'university students', terms: ['faculdade', 'universidade', 'university', 'college', 'escola', 'school', 'aula'] },
  { key: 'reuniao', kind: 'acao', query: 'team meeting', terms: ['reuniao', 'meeting', 'equipe', 'team', 'colega', 'cliente'] },
  { key: 'estudar', kind: 'acao', query: 'studying', terms: ['estudar', 'estudando', 'estudo', 'study', 'studying', 'curso', 'aprender', 'aprendendo'] },
  { key: 'dormir', kind: 'acao', query: 'tired sleeping', terms: ['dormir', 'sono', 'cansado', 'cansaco', 'sleep', 'tired'] },
  { key: 'viagem', kind: 'acao', query: 'airplane travel', terms: ['viagem', 'viajar', 'aviao', 'travel', 'airplane'] },
  { key: 'mercado', kind: 'lugar', query: 'job interview', terms: ['mercado', 'vaga', 'entrevista', 'contratar', 'contratado', 'interview', 'job'] },
];

/** termos de grupo que também são palavra de todo dia na fala ("os dados", "a tela"): gatilho fraco, nota menor */
export const WEAK_TERMS: ReadonlySet<string> = new Set(
  ['dados', 'data', 'tela', 'trabalho', 'hora', 'horas', 'web', 'banco', 'pagina', 'aula', 'mercado', 'empresa', 'aplicacao', 'maquina', 'curso', 'aprender', 'cliente'].map(
    (term) => stem(term),
  ),
);

/** stem → grupos em que aparece */
const GROUP_INDEX: ReadonlyMap<string, TermGroup[]> = (() => {
  const index = new Map<string, TermGroup[]>();
  for (const group of TERM_GROUPS) {
    for (const term of group.terms) {
      const key = stem(term);
      index.set(key, [...(index.get(key) ?? []), group]);
    }
  }
  return index;
})();

export function groupsOf(word: string): TermGroup[] {
  return GROUP_INDEX.get(stem(word)) ?? [];
}

/** Tags normalizadas de um texto livre: radicais, sem stopword, sem número solto (ids de banco de imagem). */
export function tagsOf(text: string): string[] {
  const tags = words(text)
    .filter((word) => !STOPWORDS.has(word) && !/^\d+$/.test(word) && word.length > 1)
    .map(stem);
  return [...new Set(tags)];
}

/** Expande tags com os sinônimos dos grupos a que pertencem (o que se compara com a biblioteca). */
export function expandTags(tags: readonly string[]): string[] {
  const out = new Set(tags.map(stem));
  for (const tag of tags) for (const group of groupsOf(tag)) for (const term of group.terms) out.add(stem(term));
  return [...out];
}
