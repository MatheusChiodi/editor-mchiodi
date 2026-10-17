import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export type CodeLanguage = 'ts' | 'js' | 'tsx' | 'json' | 'bash' | 'java' | 'python' | 'sql';
export type TokenType = 'keyword' | 'string' | 'number' | 'comment' | 'punctuation' | 'identifier' | 'function' | 'plain';

export interface Token {
  type: TokenType;
  text: string;
}

export interface CodeCardProps {
  code: string;
  language?: CodeLanguage;
  title?: string;
  /** linhas (1-based) que ganham destaque depois que o código termina de aparecer */
  highlightLines?: number[];
  mode?: 'type' | 'reveal';
}

export const MAX_LINES = 12;
/** largura do caractere da JetBrains Mono em relação ao tamanho da fonte */
export const MONO_ADVANCE = 0.6;

const words = (list: string) => new Set(list.split(' '));

const C_COMMENT = String.raw`\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`;
// `#` só abre comentário no começo da linha ou depois de espaço (não em `$#` nem em URL)
const HASH_COMMENT = String.raw`(?<![^\s])#[^\n]*`;
const SQL_COMMENT = String.raw`--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`;
const NO_COMMENT = String.raw`(?!)`;
const QUOTED = String.raw`"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?`;
const TEMPLATE = String.raw`\x60(?:\\.|[^\x60\\])*\x60?`;
const TRIPLE = String.raw`"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)`;
const NUMBER = String.raw`0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?`;
const IDENTIFIER = String.raw`[\p{L}_$][\p{L}\p{N}_$]*`;

interface Grammar {
  comment: string;
  string: string;
  keywords: Set<string>;
  caseInsensitive?: boolean;
}

const SCRIPT_KEYWORDS = words(
  'const let var function return if else for while do switch case break continue new class extends implements import export from default async await try catch finally throw typeof instanceof in of void null undefined true false this super interface type enum as readonly public private protected static yield delete satisfies keyof',
);
const script: Grammar = { comment: C_COMMENT, string: `${QUOTED}|${TEMPLATE}`, keywords: SCRIPT_KEYWORDS };

const grammars: Record<CodeLanguage, Grammar> = {
  ts: script,
  js: script,
  tsx: script,
  json: { comment: NO_COMMENT, string: QUOTED, keywords: words('true false null') },
  bash: {
    comment: HASH_COMMENT,
    string: QUOTED,
    keywords: words('if then else elif fi for in do done while until case esac function return export local echo cd sudo exit source'),
  },
  java: {
    comment: C_COMMENT,
    string: QUOTED,
    keywords: words(
      'abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new null package private protected public record return short static super switch synchronized this throw throws transient try var void volatile while true false',
    ),
  },
  python: {
    comment: HASH_COMMENT,
    string: `${TRIPLE}|${QUOTED}`,
    keywords: words(
      'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return self True try while with yield',
    ),
  },
  sql: {
    comment: SQL_COMMENT,
    string: QUOTED,
    caseInsensitive: true,
    keywords: words(
      'SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP INDEX VIEW JOIN INNER LEFT RIGHT OUTER FULL ON AS AND OR NOT NULL IS IN LIKE BETWEEN ORDER BY GROUP HAVING LIMIT OFFSET DISTINCT UNION ALL PRIMARY KEY FOREIGN REFERENCES DEFAULT CASE WHEN THEN ELSE END EXISTS COUNT SUM AVG MIN MAX DESC ASC WITH ROWNUM',
    ),
  },
};

/**
 * Tokenizer leve por regex: não entende a gramática, só classifica o suficiente para colorir.
 * A concatenação dos tokens devolve exatamente o texto de entrada.
 */
export function tokenize(code: string, language: CodeLanguage = 'ts'): Token[] {
  const grammar = grammars[language];
  const pattern = new RegExp(
    `(?<comment>${grammar.comment})|(?<string>${grammar.string})|(?<number>${NUMBER})|(?<identifier>${IDENTIFIER})|(?<space>\\s+)|(?<other>[\\s\\S])`,
    'gu',
  );
  const tokens: Token[] = [];
  for (const match of code.matchAll(pattern)) {
    const groups = match.groups ?? {};
    const text = match[0];
    const rest = code.slice(match.index + text.length);
    let type: TokenType = 'punctuation';
    if (groups.comment !== undefined) type = 'comment';
    // chave de objeto JSON lê melhor como identificador do que como string
    else if (groups.string !== undefined) type = language === 'json' && /^\s*:/.test(rest) ? 'identifier' : 'string';
    else if (groups.number !== undefined) type = 'number';
    else if (groups.identifier !== undefined) {
      const isKeyword = grammar.keywords.has(grammar.caseInsensitive ? text.toUpperCase() : text);
      type = isKeyword ? 'keyword' : /^\s*\(/.test(rest) ? 'function' : 'identifier';
    } else if (groups.space !== undefined) type = 'plain';

    const last = tokens.at(-1);
    if (last && last.type === type && (type === 'plain' || type === 'punctuation')) last.text += text;
    else tokens.push({ type, text });
  }
  return tokens;
}

/** Normaliza o código para o cartão: tabs viram 2 espaços, sem linhas vazias nas pontas, no máximo `MAX_LINES`. */
export function prepareCode(code: string, maxLines = MAX_LINES): string[] {
  const lines = code
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\t/g, '  ').trimEnd());
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines.at(-1) === '') lines.pop();
  return lines.slice(0, maxLines);
}

/** Tokeniza o bloco inteiro (comentário/string de várias linhas continuam certos) e separa por linha. */
export function tokenizeLines(lines: string[], language: CodeLanguage = 'ts'): Token[][] {
  const result: Token[][] = [[]];
  for (const token of tokenize(lines.join('\n'), language)) {
    token.text.split('\n').forEach((part, index) => {
      if (index > 0) result.push([]);
      if (part) result.at(-1)!.push({ type: token.type, text: part });
    });
  }
  return result;
}

/** Primeiros `count` caracteres de uma linha tokenizada, preservando as classes. */
export function sliceTokens(tokens: Token[], count: number): Token[] {
  const result: Token[] = [];
  let remaining = count;
  for (const token of tokens) {
    if (remaining <= 0) break;
    result.push(token.text.length <= remaining ? token : { type: token.type, text: token.text.slice(0, remaining) });
    remaining -= token.text.length;
  }
  return result;
}

/** Maior fonte (entre `min` e `max`) em que `maxChars` colunas monoespaçadas cabem em `availableWidth`. */
export function fitFontSize(maxChars: number, availableWidth: number, max = 34, min = 18): number {
  if (maxChars <= 0) return max;
  return Math.max(min, Math.min(max, Math.floor(availableWidth / (maxChars * MONO_ADVANCE))));
}

const indentOf = (line: string) => line.length - line.trimStart().length;

/** Toques de teclado para digitar o bloco: a indentação vem de graça (como num editor), cada quebra custa 1. */
export function typedUnits(lines: string[]): number {
  return lines.reduce((sum, line) => sum + line.length - indentOf(line), 0) + Math.max(0, lines.length - 1);
}

/** Dado o número de toques já feitos, quantos caracteres de cada linha estão visíveis e em que linha está o cursor. */
export function lineProgress(lines: string[], typed: number): { visible: number[]; cursorLine: number } {
  const visible = lines.map(() => 0);
  let remaining = Math.max(0, Math.floor(typed));
  let cursorLine = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const indent = indentOf(line);
    const body = line.length - indent;
    cursorLine = index;
    if (index < lines.length - 1 && remaining > body) {
      visible[index] = line.length;
      remaining -= body + 1;
    } else {
      visible[index] = indent + Math.min(remaining, body);
      break;
    }
  }
  return { visible, cursorLine };
}

const START_SEC = 0.35;
const CHARS_PER_SEC = 34;
const REVEAL_STEP_SEC = 0.16;

/** Tempo reservado para o código aparecer: ~60% do overlay, para sobrar tempo de leitura. */
export function appearBudget(durationSec: number): number {
  return Math.max(0.4, durationSec * 0.6 - START_SEC);
}

/** Duração da digitação: ritmo natural, acelerando só se o bloco não couber no tempo reservado. */
export function typingSeconds(units: number, durationSec: number): number {
  return Math.min(units / CHARS_PER_SEC, appearBudget(durationSec));
}

/** Toques já feitos no frame (ritmo constante: digitação com easing parece falsa). */
export function typedAt(frame: number, fps: number, units: number, typingSec: number, startSec = START_SEC): number {
  if (typingSec <= 0) return frame >= startSec * fps ? units : 0;
  const elapsed = frame / fps - startSec;
  return Math.max(0, Math.min(units, Math.floor((elapsed / typingSec) * units)));
}

/** Intervalo entre linhas no modo `reveal`. */
export function revealStep(lineCount: number, durationSec: number): number {
  return Math.min(REVEAL_STEP_SEC, appearBudget(durationSec) / Math.max(1, lineCount));
}

const tokenColor: Record<TokenType, string> = {
  keyword: theme.color.coral,
  string: theme.color.emerald,
  number: theme.color.glowPeach,
  comment: theme.color.slate300,
  punctuation: theme.color.slate300,
  identifier: theme.color.paper,
  function: theme.color.glowPeriwinkle,
  plain: theme.color.paper,
};

const PAD_X = 44;
const PAD_Y = 30;
const BAR_HEIGHT = 68;
const GUTTER_CHARS = 4;
const MIN_WIDTH = 820;

export const CodeCard: React.FC<CodeCardProps & BaseProps> = ({
  code,
  language = 'ts',
  title,
  highlightLines = [],
  mode = 'type',
  durationInFrames,
}) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const { width } = useVideoConfig();
  const durationSec = durationInFrames / fps;

  const lines = prepareCode(code);
  const tokens = tokenizeLines(lines, language);
  const maxChars = Math.max(1, ...lines.map((line) => line.length));
  const maxWidth = width - theme.safe.x * 2;
  const fontSize = fitFontSize(maxChars + GUTTER_CHARS, maxWidth - PAD_X * 2);
  const charWidth = fontSize * MONO_ADVANCE;
  const lineHeight = Math.round(fontSize * 1.6);
  const cardWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, (maxChars + GUTTER_CHARS) * charWidth + PAD_X * 2));

  const units = typedUnits(lines);
  const typingSec = typingSeconds(units, durationSec);
  const step = revealStep(lines.length, durationSec);
  const typing = mode === 'type';
  const typed = typedAt(frame, fps, units, typingSec);
  const progress = typing ? lineProgress(lines, typed) : null;
  const doneSec = typing ? START_SEC + typingSec : START_SEC + (lines.length - 1) * step + motion.base;
  const done = frame >= doneSec * fps;

  const highlight = highlightLines.length ? progressAt(frame, fps, doneSec + 0.15) : 0;
  const marked = new Set(highlightLines);
  const cursorLine = progress && !done ? progress.cursorLine : lines.length - 1;
  // parado, o cursor pisca a cada meio segundo; digitando, fica aceso
  const cursorOn = typing && !done ? frame >= START_SEC * fps : done && Math.floor((frame - doneSec * fps) / (fps / 2)) % 2 === 0;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: 1 - exit }}>
      <div
        style={{
          width: cardWidth,
          borderRadius: theme.radius.card,
          overflow: 'hidden',
          background: theme.color.slate900,
          boxShadow: `${theme.shadow.raised}, 0 0 0 1px ${theme.color.slate600}`,
          opacity: enter,
          translate: `0 ${(1 - enter) * 28 + exit * 16}px`,
          scale: String(0.97 + 0.03 * value),
        }}
      >
        <div
          style={{
            height: BAR_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: `0 ${PAD_X - 14}px`,
            background: theme.color.night,
          }}
        >
          {[theme.color.coral, theme.color.glowPeach, theme.color.emerald].map((color) => (
            <div key={color} style={{ width: 16, height: 16, borderRadius: theme.radius.pill, background: color }} />
          ))}
          {title ? (
            <div
              style={{
                marginLeft: 16,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: theme.font.mono,
                fontWeight: 500,
                fontSize: 24,
                color: theme.color.slate300,
              }}
            >
              {title}
            </div>
          ) : null}
        </div>
        <div
          style={{
            padding: `${PAD_Y}px ${PAD_X}px`,
            fontFamily: theme.font.mono,
            fontWeight: 500,
            fontSize,
            lineHeight: `${lineHeight}px`,
            fontVariantLigatures: 'none',
          }}
        >
          {lines.map((line, index) => {
            const lineEnter = typing ? 1 : progressAt(frame, fps, START_SEC + index * step);
            const visible = progress ? progress.visible[index]! : line.length;
            const reached = progress ? index <= progress.cursorLine : true;
            const isMarked = marked.has(index + 1);
            const dim = highlight && !isMarked ? 1 - 0.45 * highlight : 1;
            return (
              <div key={index} style={{ position: 'relative', height: lineHeight, whiteSpace: 'pre' }}>
                {isMarked ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: `0 ${-PAD_X}px`,
                      background: theme.color.coral,
                      opacity: 0.2 * highlight,
                      scale: `${highlight} 1`,
                      transformOrigin: 'left center',
                    }}
                  />
                ) : null}
                {isMarked ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: -PAD_X,
                      top: 0,
                      bottom: 0,
                      width: 6,
                      background: theme.color.coral,
                      opacity: highlight,
                    }}
                  />
                ) : null}
                <div style={{ position: 'relative', opacity: lineEnter * dim, translate: `${(1 - lineEnter) * 18}px 0` }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: GUTTER_CHARS * charWidth,
                      color: theme.color.slate600,
                      opacity: reached ? 1 : 0.45,
                    }}
                  >
                    {String(index + 1).padStart(2, ' ')}
                  </span>
                  {sliceTokens(tokens[index] ?? [], visible).map((token, tokenIndex) => (
                    <span
                      key={tokenIndex}
                      style={{
                        color: tokenColor[token.type],
                        opacity: token.type === 'comment' ? 0.6 : 1,
                        fontStyle: token.type === 'comment' ? 'italic' : 'normal',
                      }}
                    >
                      {token.text}
                    </span>
                  ))}
                  {index === cursorLine ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: Math.max(3, Math.round(fontSize * 0.09)),
                        height: Math.round(fontSize * 1.15),
                        marginLeft: 2,
                        verticalAlign: 'text-bottom',
                        background: theme.color.coral,
                        opacity: cursorOn ? 1 : 0,
                      }}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const sample: CodeCardProps = {
  title: 'useDebounce.ts',
  language: 'ts',
  mode: 'type',
  highlightLines: [5, 6],
  code: [
    'export function useDebounce<T>(value: T, delayMs = 300): T {',
    '  const [debounced, setDebounced] = useState(value);',
    '',
    '  useEffect(() => {',
    '    const id = setTimeout(() => setDebounced(value), delayMs);',
    '    return () => clearTimeout(id); // cancela a espera anterior',
    '  }, [value, delayMs]);',
    '',
    '  return debounced;',
    '}',
  ].join('\n'),
};

export const entry: ComponentEntry = {
  component: CodeCard,
  sample: { ...sample },
  defaultDuration: 9,
  vertical: { zone: 'full' },
  description: 'Janela de editor com código digitado ou revelado linha a linha; use sempre que código for dito em voz alta (máx. 12 linhas).',
};
