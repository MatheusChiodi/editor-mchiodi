import { MAX_ALIAS_WORDS, TECH_ALIASES, TECH_BY_ID, type Tech, techKey, techToken } from './catalog.ts';

export interface SpokenWord {
  text: string;
  start: number;
  end: number;
}

export type TechConfidence = 'high' | 'low';

export interface TechMention {
  /** id no catálogo */
  tech: string;
  name: string;
  /** segundos da FONTE */
  start: number;
  end: number;
  /** como foi transcrito */
  heard: string;
  /** primeira palavra em `words` e quantas a menção ocupa */
  wordIndex: number;
  wordCount: number;
  confidence: TechConfidence;
  /** grafia para a legenda quando a menção é uma palavra só */
  caption: string;
  /** o apelido casado também é palavra comum */
  weak: boolean;
}

export interface TechSummary {
  tech: string;
  name: string;
  count: number;
  /** primeira menção (segundos da fonte) */
  first: number;
  confidence: TechConfidence;
  mentions: TechMention[];
}

/** Palavras que indicam que o termo ambíguo ao lado é uma tecnologia ("a linguagem Go", "usando o Spring"). */
const CUES = new Set(
  [
    'linguagem', 'linguagens', 'framework', 'frameworks', 'biblioteca', 'bibliotecas', 'lib', 'libs', 'banco', 'ferramenta', 'ferramentas',
    'editor', 'ide', 'plataforma', 'tecnologia', 'tecnologias', 'stack', 'usando', 'usar', 'uso', 'usei', 'usava', 'utilizando', 'utilizar',
    'utilizo', 'utilizei', 'aprender', 'aprendi', 'aprendendo', 'estudar', 'estudei', 'estudando', 'programar', 'programando', 'programo',
    'codar', 'codando', 'instalar', 'instalei', 'backend', 'frontend', 'api', 'apis', 'plugin', 'extensao', 'deploy', 'curso', 'cursos',
    'bootcamp', 'runtime', 'orm', 'sdk', 'cli', 'app', 'apps', 'aplicativo', 'projeto', 'projetos', 'versao',
  ].map(techToken),
);

/** Quantas palavras para cada lado contam como contexto. */
export const CUE_WINDOW = 4;
export const NEIGHBOR_WINDOW = 6;
export const COMMON_WINDOW = 3;

const SENTENCE_END = /[.!?…]["')]?$/;

interface Token {
  key: string;
  word: number;
}

function tokenize(words: readonly SpokenWord[]): Token[] {
  const tokens: Token[] = [];
  words.forEach((word, index) => {
    for (const part of word.text.split('/')) {
      const key = techToken(part);
      if (key) tokens.push({ key, word: index });
    }
  });
  return tokens;
}

interface Candidate {
  tech: Tech;
  weak: boolean;
  caption: string;
  from: number;
  to: number;
  firstToken: number;
  lastToken: number;
}

/** Nome próprio no meio da frase: o Whisper escreve "Go" e "Angular" com maiúscula quando são nomes. */
function capitalizedMidSentence(words: readonly SpokenWord[], index: number): boolean {
  const text = words[index]!.text.replace(/^["'(]+/, '');
  const previous = words[index - 1];
  if (!previous || SENTENCE_END.test(previous.text)) return false;
  return /^\p{Lu}/u.test(text);
}

/**
 * Tecnologias citadas na transcrição, na ordem da fala. Casa apelidos de até `MAX_ALIAS_WORDS` palavras (o mais longo
 * vence: "java script" não vira Java), sem acento nem caixa. Apelido que também é palavra comum só ganha confiança alta
 * com contexto: palavra-pista perto, outra tecnologia na mesma enumeração ou maiúscula de nome próprio no meio da frase.
 */
export function findTechMentions(words: readonly SpokenWord[]): TechMention[] {
  const tokens = tokenize(words);
  const found: Candidate[] = [];
  for (let index = 0; index < tokens.length; ) {
    let matched = false;
    for (let size = Math.min(MAX_ALIAS_WORDS, tokens.length - index); size >= 1; size -= 1) {
      const alias = TECH_ALIASES.get(tokens.slice(index, index + size).map((token) => token.key).join(' '));
      if (!alias) continue;
      found.push({
        tech: alias.tech,
        weak: alias.weak,
        caption: alias.caption,
        from: tokens[index]!.word,
        to: tokens[index + size - 1]!.word,
        firstToken: index,
        lastToken: index + size - 1,
      });
      index += size;
      matched = true;
      break;
    }
    if (!matched) index += 1;
  }

  const sure = found.filter((candidate) => !candidate.weak);
  return found.map((candidate) => {
    let confident = !candidate.weak;
    if (!confident) {
      // palavra do dia a dia ("vim", "cursor", "meta") pede prova mais forte: a pista vem ANTES ("o editor Vim") e a
      // outra tecnologia fica colada ("Cursor ou VS Code"); "eu vim aqui falar de React" não pode virar o Vim
      const common = candidate.tech.common === true;
      const near = (window: number, token: number) => token >= candidate.firstToken - window && token <= candidate.lastToken + window;
      const cue = tokens.some(
        (token, index) =>
          CUES.has(token.key) &&
          (common
            ? index < candidate.firstToken && index >= candidate.firstToken - COMMON_WINDOW
            : near(CUE_WINDOW, index) && (index < candidate.firstToken || index > candidate.lastToken)),
      );
      const reach = common ? COMMON_WINDOW - 1 : NEIGHBOR_WINDOW;
      const neighbor = sure.some((other) => near(reach, other.firstToken) || near(reach, other.lastToken));
      confident = cue || neighbor || (!common && capitalizedMidSentence(words, candidate.from));
    }
    const first = words[candidate.from]!;
    const last = words[candidate.to]!;
    return {
      tech: candidate.tech.id,
      name: candidate.tech.name,
      start: first.start,
      end: last.end,
      heard: words.slice(candidate.from, candidate.to + 1).map((word) => word.text).join(' '),
      wordIndex: candidate.from,
      wordCount: candidate.to - candidate.from + 1,
      confidence: confident ? 'high' : 'low',
      caption: candidate.caption,
      weak: candidate.weak,
    };
  });
}

/** Uma linha por tecnologia, na ordem da primeira menção. A confiança é a melhor entre as menções. */
export function summarizeTech(mentions: readonly TechMention[]): TechSummary[] {
  const byTech = new Map<string, TechSummary>();
  for (const mention of mentions) {
    const summary = byTech.get(mention.tech);
    if (!summary) {
      byTech.set(mention.tech, { tech: mention.tech, name: mention.name, count: 1, first: mention.start, confidence: mention.confidence, mentions: [mention] });
      continue;
    }
    summary.count += 1;
    summary.mentions.push(mention);
    if (mention.confidence === 'high') summary.confidence = 'high';
  }
  return [...byTech.values()].sort((a, b) => a.first - b.first);
}

const stripPunctuation = (text: string) => text.replace(/[.,;:…!?]+$/g, '').replace(/^["'(]+|["')]+$/g, '');

/**
 * Correções de grafia para `captions.replacements` do rascunho: "riéqui" → "React", "github" → "GitHub".
 * Só menção de UMA palavra, de confiança alta e por apelido que não é palavra comum — a troca vale para toda
 * ocorrência do token, então "go" (verbo) nunca entra. A chave é a palavra como foi transcrita.
 */
export function techReplacements(words: readonly SpokenWord[], mentions: readonly TechMention[] = findTechMentions(words)): Record<string, string> {
  const replacements: Record<string, string> = {};
  for (const mention of mentions) {
    if (mention.wordCount !== 1 || mention.confidence !== 'high' || mention.weak) continue;
    const heard = stripPunctuation(words[mention.wordIndex]!.text);
    const key = techKey(heard);
    // a legenda compara por `normalizeToken`, que perde `#` e `+`: "C#" viraria a chave "c"
    if (key.length < 2 || key !== heard.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')) continue;
    if (heard !== mention.caption) replacements[heard.toLowerCase()] = mention.caption;
  }
  return replacements;
}

export const techName = (id: string) => TECH_BY_ID.get(id)?.name ?? id;
