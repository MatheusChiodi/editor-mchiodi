import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { cardSurface, sequenceTimes } from './c1-kit';
import { clip, Icon, LineBand, monoColumns } from './c2-kit';
import { MONO_ADVANCE } from './CodeCard';
import type { ComponentEntry } from './registry';

export interface FileTreeItem {
  /** caminho relativo à raiz, com `/`; terminar em `/` marca uma pasta */
  path: string;
  highlight?: boolean;
  note?: string;
}

export interface FileTreeProps {
  root: string;
  items: FileTreeItem[];
  /** segundo (relativo ao início do overlay) em que cada item de `items` aparece */
  revealAt?: number[];
}

export interface TreeRow {
  name: string;
  /** 1 = filho direto da raiz */
  depth: number;
  isDir: boolean;
  highlight: boolean;
  note?: string;
  /** índice do item que primeiro trouxe esta linha (pasta implícita herda o do primeiro arquivo dentro dela) */
  item: number;
  /** último filho do pai: o conector vira um "L" */
  last: boolean;
  /** para cada nível ancestral, se a linha guia vertical continua passando por esta linha */
  guides: boolean[];
}

interface TreeNode {
  name: string;
  isDir: boolean;
  highlight: boolean;
  note?: string;
  item: number;
  children: TreeNode[];
}

export const MAX_TREE_ROWS = 13;

/**
 * Transforma a lista de caminhos em linhas prontas para desenhar. Pastas intermediárias são
 * criadas sozinhas, a ordem é a de primeira aparição e quem tem filhos é sempre pasta.
 */
export function buildTree(items: readonly FileTreeItem[]): TreeRow[] {
  const top: TreeNode[] = [];
  items.forEach((item, index) => {
    const normalized = item.path.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    let siblings = top;
    parts.forEach((name, level) => {
      const leaf = level === parts.length - 1;
      let node = siblings.find((candidate) => candidate.name === name);
      if (!node) {
        node = { name, isDir: !leaf || normalized.endsWith('/'), highlight: false, item: index, children: [] };
        siblings.push(node);
      }
      if (leaf) {
        node.highlight ||= Boolean(item.highlight);
        node.note ??= item.note;
      } else node.isDir = true;
      siblings = node.children;
    });
  });

  const rows: TreeRow[] = [];
  const walk = (nodes: TreeNode[], depth: number, guides: boolean[]) => {
    nodes.forEach((node, index) => {
      const last = index === nodes.length - 1;
      rows.push({ name: node.name, depth, isDir: node.isDir, highlight: node.highlight, note: node.note, item: node.item, last, guides });
      walk(node.children, depth + 1, [...guides, !last]);
    });
  };
  walk(top, 1, []);
  return rows;
}

/** Limita as linhas visíveis e diz quantas ficaram de fora (para o rodapé "+ N"). */
export function limitRows(rows: readonly TreeRow[], max = MAX_TREE_ROWS): { rows: TreeRow[]; hidden: number } {
  if (rows.length <= max) return { rows: [...rows], hidden: 0 };
  return { rows: rows.slice(0, max - 1), hidden: rows.length - (max - 1) };
}

const WIDTH = 800;
const NOTE_PAD = 56;
const MAX_NOTE_CHARS = 24;
const MIN_NOTE_CHARS = 8;

/**
 * Divide a largura da linha entre o nome (mono) e a nota (pílula): o nome tem prioridade, mas cede
 * até metade da linha para a nota caber; se nem assim houver lugar para 8 caracteres, a nota some.
 */
export function rowRoom(nameLength: number, noteLength: number, available: number, font = 30, noteFont = 24): { nameChars: number; noteChars: number } {
  const columns = monoColumns(available, font);
  if (noteLength <= 0) return { nameChars: columns, noteChars: 0 };
  const noteFor = (nameChars: number) =>
    Math.min(noteLength, MAX_NOTE_CHARS, Math.floor((available - nameChars * font * MONO_ADVANCE - NOTE_PAD) / (noteFont * 0.56)));
  const full = Math.min(nameLength, columns);
  if (noteFor(full) >= Math.min(noteLength, MIN_NOTE_CHARS)) return { nameChars: full, noteChars: noteFor(full) };
  const half = Math.min(full, Math.max(6, Math.floor(columns / 2)));
  const squeezed = noteFor(half);
  return squeezed >= Math.min(noteLength, MIN_NOTE_CHARS) ? { nameChars: half, noteChars: squeezed } : { nameChars: full, noteChars: 0 };
}
const PAD = 40;
const ROW = 58;
const INDENT = 38;
const FONT = 30;
const NOTE_FONT = 24;

export const FileTree: React.FC<FileTreeProps & BaseProps> = ({ root, items, revealAt, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const { rows, hidden } = limitRows(buildTree(items));
  const times = sequenceTimes(items.length, revealAt, 0.5, 0.4);
  const inner = WIDTH - PAD * 2;
  const guide = theme.color.slate300;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: theme.safe.x }}>
      <div
        style={{
          ...cardSurface,
          width: WIDTH,
          boxSizing: 'border-box',
          padding: `${PAD - 6}px ${PAD}px`,
          overflow: 'hidden',
          opacity: value,
          translate: `${(1 - enter) * -56 - exit * 28}px 0`,
        }}
      >
        <div style={{ height: ROW, display: 'flex', alignItems: 'center', gap: 14, fontFamily: theme.font.mono, fontWeight: 700, fontSize: FONT, color: theme.color.ink }}>
          <Icon name="folder" size={34} color={theme.color.ink} strokeWidth={2} />
          <span style={{ whiteSpace: 'pre' }}>{clip(root, monoColumns(inner - 48, FONT))}</span>
        </div>
        {rows.map((row, index) => {
          const time = times[row.item] ?? 0;
          const appear = progressAt(frame, fps, time, 0.35);
          const mark = row.highlight ? progressAt(frame, fps, time + 0.25, 0.45) : 0;
          const label = row.isDir ? `${row.name}/` : row.name;
          const room = rowRoom(label.length, row.note?.length ?? 0, inner - row.depth * INDENT - 46);
          return (
            // 0fr→1fr: a linha ainda não revelada não ocupa altura, então o cartão cresce com a árvore
            <div key={index} style={{ display: 'grid', gridTemplateRows: `${appear}fr` }}>
              <div style={{ minHeight: 0, overflow: 'hidden', margin: `0 ${-PAD}px`, padding: `0 ${PAD}px` }}>
                <div style={{ position: 'relative', height: ROW, display: 'flex', alignItems: 'center', opacity: appear }}>
                  {row.highlight ? <LineBand color={theme.color.coral} progress={mark} bleed={PAD} strength={0.16} /> : null}
                  {Array.from({ length: row.depth }, (_, level) => {
                    const own = level === row.depth - 1;
                    const through = own ? !row.last : row.guides[level];
                    return (
                      <div key={level} style={{ position: 'relative', flexShrink: 0, width: INDENT, height: ROW }}>
                        {own || through ? (
                          <div style={{ position: 'absolute', left: 16, top: 0, width: 2, height: through ? ROW : ROW / 2, background: guide }} />
                        ) : null}
                        {own ? <div style={{ position: 'absolute', left: 16, top: ROW / 2 - 1, width: INDENT - 22, height: 2, background: guide }} /> : null}
                      </div>
                    );
                  })}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <Icon name={row.isDir ? 'folder' : 'file'} size={30} color={row.isDir ? theme.color.ink : theme.color.slate600} strokeWidth={2} />
                    <span
                      style={{
                        fontFamily: theme.font.mono,
                        fontWeight: row.isDir || row.highlight ? 700 : 500,
                        fontSize: FONT,
                        whiteSpace: 'pre',
                        color: theme.color.ink,
                      }}
                    >
                      {clip(label, room.nameChars)}
                    </span>
                  </div>
                  {row.note && room.noteChars ? (
                    <div
                      style={{
                        position: 'relative',
                        flexShrink: 0,
                        padding: '5px 18px',
                        borderRadius: theme.radius.pill,
                        background: theme.color.white,
                        border: `1px solid ${theme.color.slate300}`,
                        fontFamily: theme.font.body,
                        fontWeight: 600,
                        fontSize: NOTE_FONT,
                        whiteSpace: 'nowrap',
                        color: theme.color.slate600,
                        opacity: progressAt(frame, fps, time + 0.2, 0.35),
                      }}
                    >
                      {clip(row.note, room.noteChars)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {hidden ? (
          <div
            style={{
              height: ROW - 10,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: INDENT,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: NOTE_FONT,
              color: theme.color.slate600,
              opacity: progressAt(frame, fps, (times.at(-1) ?? 0) + 0.2),
            }}
          >
            + {hidden} {hidden === 1 ? 'item' : 'itens'}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const sample: FileTreeProps = {
  root: 'mchiodi-editor',
  items: [
    { path: 'src/analyze/transcribe.ts' },
    { path: 'src/edl/schema.ts', highlight: true, note: 'fonte da verdade' },
    { path: 'src/render/cuts.ts' },
    { path: 'motion/src/components/' },
    { path: 'motion/src/theme.ts', note: 'tokens da marca' },
    { path: 'package.json' },
  ],
};

export const entry: ComponentEntry = {
  component: FileTree,
  sample: { ...sample },
  defaultDuration: 8,
  description: 'Árvore de pastas e arquivos que cresce item a item, com um arquivo em destaque; use para explicar a estrutura de um projeto ou onde fica um arquivo.',
};
