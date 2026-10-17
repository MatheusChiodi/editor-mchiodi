import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { theme } from '../theme';
import { cardSurface } from './c1-kit';
import { eyebrow, LineBand } from './c2-kit';
import type { ComponentEntry } from './registry';
import { withAlpha } from './SectionTitle';

export type Cell = string | number;

export interface DataTableProps {
  /** cabeçalhos (máx. 6) */
  columns: string[];
  /** linhas (máx. 7); número é formatado em pt-BR e alinhado à direita */
  rows: Cell[][];
  /** índices 0-based */
  highlightRow?: number;
  highlightColumn?: number;
  title?: string;
}

export const MAX_COLUMNS = 6;
export const MAX_ROWS = 7;

/** Número de verdade ou texto que é só um valor com unidade (`1.240`, `98%`, `R$ 12,90`, `140 ms`). */
export function isNumericCell(value: Cell | undefined): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  return /^[-+]?(?:R\$\s?|\$\s?)?\d[\d.,]*\s?(?:%|[a-zA-Zµ]{1,3})?$/.test(value.trim());
}

export function formatCell(value: Cell | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '';
  return value;
}

/** Coluna alinha à direita quando todas as células preenchidas são numéricas. */
export function columnAligns(columnCount: number, rows: readonly (readonly Cell[])[]): ('left' | 'right')[] {
  return Array.from({ length: columnCount }, (_, column) => {
    const filled = rows.map((row) => row[column]).filter((cell) => cell !== undefined && cell !== '');
    return filled.length > 0 && filled.every(isNumericCell) ? 'right' : 'left';
  });
}

export interface TableLayout {
  fontSize: number;
  /** largura de cada coluna, já com o respiro interno */
  widths: number[];
  total: number;
}

const CELL_PAD = 28;
const HEADER_FONT = 20;
const CHAR = 0.62;
// caixa alta com tracking de 0.3em ocupa quase 1em por letra
const HEADER_CHAR = 1.08;

/**
 * Larguras das colunas pelo conteúdo. Tenta o maior corpo (36) e desce até 26; se nem assim couber,
 * as colunas encolhem na proporção e o texto que sobrar é cortado com reticências.
 */
export function tableLayout(columns: readonly string[], rows: readonly (readonly Cell[])[], maxWidth: number, max = 36, min = 26): TableLayout {
  const cellChars = columns.map((_, column) => Math.max(1, ...rows.map((row) => formatCell(row[column]).length)));
  const widthsAt = (fontSize: number) =>
    columns.map((header, column) => Math.ceil(Math.max(cellChars[column]! * fontSize * CHAR, header.length * HEADER_FONT * HEADER_CHAR) + CELL_PAD * 2));
  const sum = (widths: number[]) => widths.reduce((total, width) => total + width, 0);
  let fontSize = max;
  let widths = widthsAt(fontSize);
  while (sum(widths) > maxWidth && fontSize > min) {
    fontSize = Math.max(min, fontSize - 2);
    widths = widthsAt(fontSize);
  }
  const total = sum(widths);
  if (total <= maxWidth) return { fontSize, widths, total };
  const factor = maxWidth / total;
  return { fontSize, widths: widths.map((width) => Math.floor(width * factor)), total: maxWidth };
}

const PAD = 40;
const ROW = 70;
const ROWS_START = 0.45;
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

export const DataTable: React.FC<DataTableProps & BaseProps> = ({ columns, rows, highlightRow, highlightColumn, title, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const { width } = useVideoConfig();

  const heads = columns.slice(0, MAX_COLUMNS);
  const body = rows.slice(0, MAX_ROWS).map((row) => row.slice(0, heads.length));
  const layout = tableLayout(heads, body, width - theme.safe.x * 2 - PAD * 2);
  const aligns = columnAligns(heads.length, body);
  const marked = progressAt(frame, fps, ROWS_START + body.length * 0.1 + 0.3, 0.5);
  const columnLeft = layout.widths.slice(0, highlightColumn ?? 0).reduce((sum, item) => sum + item, 0);
  const hasColumn = highlightColumn !== undefined && highlightColumn >= 0 && highlightColumn < heads.length;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          ...cardSurface,
          boxSizing: 'border-box',
          padding: `${PAD - 4}px ${PAD}px ${PAD - 12}px`,
          overflow: 'hidden',
          opacity: value,
          translate: `0 ${(1 - enter) * 32 + exit * 16}px`,
        }}
      >
        {title ? (
          <div
            style={{
              ...ellipsis,
              maxWidth: Math.max(layout.total, 520),
              marginBottom: 22,
              padding: `0 ${CELL_PAD}px`,
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: 46,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
            }}
          >
            {title}
          </div>
        ) : null}
        <div style={{ position: 'relative', width: layout.total }}>
          {hasColumn ? (
            <div
              style={{
                position: 'absolute',
                left: columnLeft,
                top: 0,
                bottom: 0,
                width: layout.widths[highlightColumn],
                borderRadius: theme.radius.panel,
                background: withAlpha(theme.color.slate300, 0.45),
                opacity: marked,
              }}
            />
          ) : null}
          <div style={{ position: 'relative', display: 'flex', height: 58, alignItems: 'center', borderBottom: `2px solid ${theme.color.slate300}` }}>
            {heads.map((head, column) => (
              <div
                key={column}
                style={{
                  ...eyebrow(HEADER_FONT, column === highlightColumn ? theme.color.ink : undefined),
                  ...ellipsis,
                  boxSizing: 'border-box',
                  width: layout.widths[column],
                  padding: `0 ${CELL_PAD}px`,
                  textAlign: aligns[column],
                }}
              >
                {/* o tracking sobra depois da última letra; à direita isso desalinharia o cabeçalho dos números */}
                <span style={{ marginRight: aligns[column] === 'right' ? '-0.3em' : 0 }}>{head}</span>
              </div>
            ))}
          </div>
          {body.map((row, index) => {
            const appear = progressAt(frame, fps, stagger(index, 0.1, ROWS_START));
            const isMarked = index === highlightRow;
            return (
              <div
                key={index}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  height: ROW,
                  borderTop: index ? `1px solid ${withAlpha(theme.color.slate300, 0.7)}` : undefined,
                  opacity: appear,
                  translate: `0 ${(1 - appear) * 14}px`,
                }}
              >
                {isMarked ? <LineBand color={theme.color.coral} progress={marked} bleed={PAD} strength={0.16} /> : null}
                {heads.map((_, column) => (
                  <div
                    key={column}
                    style={{
                      ...ellipsis,
                      position: 'relative',
                      boxSizing: 'border-box',
                      width: layout.widths[column],
                      padding: `0 ${CELL_PAD}px`,
                      textAlign: aligns[column],
                      fontFamily: theme.font.body,
                      fontWeight: isMarked || column === highlightColumn || column === 0 ? 600 : 500,
                      fontSize: layout.fontSize,
                      fontVariantNumeric: 'tabular-nums',
                      color: isMarked || column === highlightColumn || column === 0 ? theme.color.ink : theme.color.slate600,
                    }}
                  >
                    {formatCell(row[column])}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const sample: DataTableProps = {
  title: 'Tempo de build por ferramenta',
  columns: ['Ferramenta', 'Build frio', 'Rebuild', 'Bundle'],
  rows: [
    ['Webpack 5', '38,2 s', '4,1 s', '412 kB'],
    ['Vite 7', '6,4 s', '0,3 s', '388 kB'],
    ['Turbopack', '5,1 s', '0,2 s', '401 kB'],
    ['esbuild', '1,2 s', '0,1 s', '430 kB'],
  ],
  highlightRow: 1,
};

export const entry: ComponentEntry = {
  component: DataTable,
  sample: { ...sample },
  defaultDuration: 8,
  description: 'Tabela limpa com linhas entrando em sequência e uma linha ou coluna em destaque; use para comparar valores em mais de duas dimensões.',
};
