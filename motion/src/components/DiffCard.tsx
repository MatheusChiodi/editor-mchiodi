import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { clip, CodeTokens, DarkWindow, darkTone, eyebrow, monoColumns, monoText, WINDOW_PAD_X, WINDOW_PAD_Y } from './c2-kit';
import { type CodeLanguage, fitFontSize, MONO_ADVANCE, prepareCode, tokenize } from './CodeCard';
import type { ComponentEntry } from './registry';

export interface DiffCardProps {
  before: string;
  after: string;
  title?: string;
  /** linguagem do highlight (`ts`, `js`, `tsx`, `json`, `bash`, `java`, `python`, `sql`); padrão `ts` */
  language?: string;
}

export type DiffKind = 'same' | 'removed' | 'added' | 'gap';

export interface DiffRow {
  kind: DiffKind;
  text: string;
  /** em `gap`: quantas linhas iguais foram escondidas */
  hidden?: number;
}

/** Diff por linhas via maior subsequência comum: o que sai do `before` vem antes do que entra no `after`. */
export function diffLines(before: readonly string[], after: readonly string[]): DiffRow[] {
  const rows = before.length;
  const cols = after.length;
  const lcs: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lcs[i]![j] = before[i] === after[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const result: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      result.push({ kind: 'same', text: before[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) result.push({ kind: 'removed', text: before[i++]! });
    else result.push({ kind: 'added', text: after[j++]! });
  }
  while (i < rows) result.push({ kind: 'removed', text: before[i++]! });
  while (j < cols) result.push({ kind: 'added', text: after[j++]! });
  return result;
}

/** Esconde trechos iguais longe das mudanças (mantém `context` linhas de vizinhança) quando o diff passa de `maxRows`. */
export function collapseContext(rows: readonly DiffRow[], maxRows: number, context = 1): DiffRow[] {
  if (rows.length <= maxRows) return [...rows];
  const keep = rows.map((row) => row.kind !== 'same');
  rows.forEach((row, index) => {
    if (row.kind === 'same') return;
    for (let near = Math.max(0, index - context); near <= Math.min(rows.length - 1, index + context); near++) keep[near] = true;
  });
  const result: DiffRow[] = [];
  rows.forEach((row, index) => {
    if (keep[index]) result.push(row);
    else {
      const last = result.at(-1);
      if (last?.kind === 'gap') last.hidden = (last.hidden ?? 0) + 1;
      else result.push({ kind: 'gap', text: '', hidden: 1 });
    }
  });
  if (result.length <= maxRows) return result;
  const cut = result.slice(0, maxRows - 1);
  const hidden = result.slice(maxRows - 1).reduce((sum, row) => sum + (row.kind === 'gap' ? (row.hidden ?? 0) : 1), 0);
  return [...cut, { kind: 'gap', text: '', hidden }];
}

/** Alinha o diff em duas colunas: um bloco removido fica de frente para o bloco que o substituiu; o que sobra vira vão (`null`). */
export function splitSides(rows: readonly DiffRow[]): { left: (DiffRow | null)[]; right: (DiffRow | null)[] } {
  const left: (DiffRow | null)[] = [];
  const right: (DiffRow | null)[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index]!;
    if (row.kind === 'same' || row.kind === 'gap') {
      left.push(row);
      right.push(row);
      index++;
      continue;
    }
    const removed: DiffRow[] = [];
    const added: DiffRow[] = [];
    while (rows[index]?.kind === 'removed') removed.push(rows[index++]!);
    while (rows[index]?.kind === 'added') added.push(rows[index++]!);
    for (let pair = 0; pair < Math.max(removed.length, added.length); pair++) {
      left.push(removed[pair] ?? null);
      right.push(added[pair] ?? null);
    }
  }
  return { left, right };
}

export function diffStats(rows: readonly DiffRow[]): { added: number; removed: number } {
  return {
    added: rows.filter((row) => row.kind === 'added').length,
    removed: rows.filter((row) => row.kind === 'removed').length,
  };
}

export const SPLIT_MAX_CHARS = 38;
export const SPLIT_MAX_ROWS = 10;
export const UNIFIED_MAX_ROWS = 12;

/** Lado a lado só quando as linhas são curtas, o diff é pequeno e há o que comparar dos dois lados; senão, unificado. */
export function diffMode(rows: readonly DiffRow[]): 'split' | 'unified' {
  const { added, removed } = diffStats(rows);
  const longest = Math.max(0, ...rows.map((row) => row.text.length));
  const aligned = splitSides(rows).left.length;
  return added > 0 && removed > 0 && longest <= SPLIT_MAX_CHARS && aligned <= SPLIT_MAX_ROWS ? 'split' : 'unified';
}

const LANGUAGES: readonly CodeLanguage[] = ['ts', 'js', 'tsx', 'json', 'bash', 'java', 'python', 'sql'];

export function resolveLanguage(language?: string): CodeLanguage {
  const wanted = language?.trim().toLowerCase();
  const alias: Record<string, CodeLanguage> = { typescript: 'ts', javascript: 'js', jsx: 'tsx', sh: 'bash', shell: 'bash', py: 'python' };
  if (wanted && alias[wanted]) return alias[wanted];
  return LANGUAGES.find((known) => known === wanted) ?? 'ts';
}

const SIGN_CHARS = 2;
const BEFORE_START = 0.35;
const LINE_STEP = 0.07;

/**
 * Três tempos do diff: o código antigo aparece, as linhas removidas são marcadas e só então entram as novas.
 * Os intervalos crescem com a duração para dar tempo de ler o "antes" enquanto a fala explica o problema.
 */
export function diffTimeline(beforeCount: number, durationSec: number): { removedAt: number; addedAt: number } {
  const shown = BEFORE_START + Math.max(0, beforeCount) * LINE_STEP + 0.3;
  const removedAt = Math.max(shown, durationSec * 0.2);
  const addedAt = removedAt + Math.max(0.6, durationSec * 0.13);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { removedAt: round(removedAt), addedAt: round(addedAt) };
}
const tone = { removed: darkTone.rose, added: theme.color.emerald } as const;

interface RowProps {
  row: DiffRow | null;
  language: CodeLanguage;
  columns: number;
  fontSize: number;
  lineHeight: number;
  bleed: number;
  /** entrada da linha (0–1) */
  appear: number;
  /** intensidade da faixa de mudança (0–1) */
  mark: number;
}

const Row: React.FC<RowProps> = ({ row, language, columns, fontSize, lineHeight, bleed, appear, mark }) => {
  if (!row) return <div style={{ height: lineHeight }} />;
  if (row.kind === 'gap') {
    return (
      <div style={{ height: lineHeight, color: theme.color.slate600, opacity: appear }}>
        {' '.repeat(SIGN_CHARS)}… {row.hidden} {row.hidden === 1 ? 'linha igual' : 'linhas iguais'}
      </div>
    );
  }
  const changed = row.kind !== 'same';
  const color = row.kind === 'removed' ? tone.removed : tone.added;
  return (
    <div style={{ position: 'relative', height: lineHeight }}>
      {changed ? <div style={{ position: 'absolute', inset: `0 ${-bleed}px`, background: color, opacity: 0.2 * mark * appear }} /> : null}
      <div style={{ position: 'relative', opacity: appear * (row.kind === 'removed' ? 1 - 0.25 * mark : 1), translate: `${(1 - appear) * 16}px 0` }}>
        <span style={{ display: 'inline-block', width: SIGN_CHARS * fontSize * MONO_ADVANCE, fontWeight: 700, color, opacity: changed ? mark : 0 }}>
          {row.kind === 'removed' ? '-' : '+'}
        </span>
        <CodeTokens tokens={tokenize(clip(row.text, columns - SIGN_CHARS), language)} />
      </div>
    </div>
  );
};

export const DiffCard: React.FC<DiffCardProps & BaseProps> = ({ before, after, title = 'diff', language, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const { width } = useVideoConfig();
  const lang = resolveLanguage(language);

  const all = diffLines(prepareCode(before, 200), prepareCode(after, 200));
  const mode = diffMode(all);
  const rows = mode === 'split' ? all : collapseContext(all, UNIFIED_MAX_ROWS);
  const stats = diffStats(all);
  const longest = Math.max(1, ...rows.map((row) => row.text.length)) + SIGN_CHARS;
  const maxWidth = Math.min(1640, width - theme.safe.x * 2);

  const step = LINE_STEP;
  const beforeCount = rows.filter((row) => row.kind !== 'added').length;
  const { removedAt, addedAt } = diffTimeline(beforeCount, durationInFrames / fps);
  const removedMark = progressAt(frame, fps, removedAt, 0.4);
  const addedIn = progressAt(frame, fps, addedAt, 0.5);
  const tag = `-${stats.removed}  +${stats.added}`;

  if (mode === 'split') {
    const sides = splitSides(rows);
    const gap = 2;
    const pane = (maxWidth - gap) / 2;
    const fontSize = fitFontSize(longest, pane - WINDOW_PAD_X * 2, 32, 24);
    const columns = monoColumns(pane - WINDOW_PAD_X * 2, fontSize);
    const lineHeight = Math.round(fontSize * 1.6);
    const paneWidth = Math.min(pane, Math.max(520, longest * fontSize * MONO_ADVANCE + WINDOW_PAD_X * 2));
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <DarkWindow width={paneWidth * 2 + gap} title={title} tag={tag} enter={enter} exit={exit} value={value}>
          <div style={{ display: 'flex', gap, background: theme.color.slate600 }}>
            {(['left', 'right'] as const).map((side) => (
              <div key={side} style={{ width: paneWidth, boxSizing: 'border-box', padding: `${WINDOW_PAD_Y - 8}px ${WINDOW_PAD_X}px ${WINDOW_PAD_Y}px`, background: theme.color.slate900, overflow: 'hidden' }}>
                <div style={{ ...eyebrow(20, theme.color.slate300), marginBottom: 14, opacity: side === 'left' ? 1 : 0.35 + 0.65 * addedIn }}>
                  {side === 'left' ? 'Antes' : 'Depois'}
                </div>
                <div style={monoText(fontSize, lineHeight)}>
                  {sides[side].map((row, index) => {
                    const base = progressAt(frame, fps, BEFORE_START + index * step, 0.3);
                    const isAdded = row?.kind === 'added';
                    return (
                      <Row
                        key={index}
                        row={row}
                        language={lang}
                        columns={columns}
                        fontSize={fontSize}
                        lineHeight={lineHeight}
                        bleed={WINDOW_PAD_X}
                        appear={side === 'left' ? base : isAdded ? addedIn : Math.min(base, addedIn + 0.35)}
                        mark={isAdded ? addedIn : removedMark}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DarkWindow>
      </AbsoluteFill>
    );
  }

  const inner = maxWidth - WINDOW_PAD_X * 2;
  const fontSize = fitFontSize(longest, inner, 34, 24);
  const columns = monoColumns(inner, fontSize);
  const lineHeight = Math.round(fontSize * 1.6);
  const cardWidth = Math.min(maxWidth, Math.max(860, Math.min(longest, columns) * fontSize * MONO_ADVANCE + WINDOW_PAD_X * 2));
  let beforeIndex = 0;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <DarkWindow width={cardWidth} title={title} tag={tag} enter={enter} exit={exit} value={value}>
        <div style={{ padding: `${WINDOW_PAD_Y}px ${WINDOW_PAD_X}px`, ...monoText(fontSize, lineHeight) }}>
          {rows.map((row, index) => {
            const isAdded = row.kind === 'added';
            const appear = isAdded ? addedIn : progressAt(frame, fps, BEFORE_START + beforeIndex++ * step, 0.3);
            return (
              // 0fr→1fr: a linha nova abre espaço no meio do código em vez de já ocupar um buraco
              <div key={index} style={{ display: 'grid', gridTemplateRows: `${isAdded ? addedIn : 1}fr`, margin: `0 ${-WINDOW_PAD_X}px` }}>
                <div style={{ minHeight: 0, overflow: 'hidden', padding: `0 ${WINDOW_PAD_X}px` }}>
                  <Row
                    row={row}
                    language={lang}
                    columns={columns}
                    fontSize={fontSize}
                    lineHeight={lineHeight}
                    bleed={WINDOW_PAD_X}
                    appear={appear}
                    mark={isAdded ? addedIn : removedMark}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </DarkWindow>
    </AbsoluteFill>
  );
};

const sample: DiffCardProps = {
  title: 'useFetch.ts',
  language: 'ts',
  before: [
    'useEffect(() => {',
    '  fetch(url)',
    '    .then((res) => res.json())',
    '    .then(setData);',
    '}, []);',
  ].join('\n'),
  after: [
    'useEffect(() => {',
    '  const controller = new AbortController();',
    '  fetch(url, { signal: controller.signal })',
    '    .then((res) => res.json())',
    '    .then(setData);',
    '  return () => controller.abort();',
    '}, [url]);',
  ].join('\n'),
};

export const entry: ComponentEntry = {
  component: DiffCard,
  sample: { ...sample },
  defaultDuration: 9,
  vertical: { zone: 'full' },
  description: 'Antes e depois de um trecho de código, com linhas removidas em rose e adicionadas em emerald; use para mostrar a correção de um bug ou uma refatoração.',
};
