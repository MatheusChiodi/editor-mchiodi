import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { clip, CodeTokens, DarkWindow, LineBand, monoColumns, monoText, WINDOW_PAD_X, WINDOW_PAD_Y } from './c2-kit';
import { fitFontSize, MONO_ADVANCE, prepareCode, revealStep, tokenizeLines } from './CodeCard';
import type { ComponentEntry } from './registry';

export interface JsonViewerProps {
  /** texto JSON (se for inválido, é mostrado como veio, sem destaque por caminho) */
  json: string;
  title?: string;
  /** chave em destaque, ex.: `user.name` ou `items[0].id` */
  highlightPath?: string;
  /** profundidade a partir da qual objetos e listas aparecem fechados (`{ … }`); a raiz é 0 */
  collapsedDepth?: number;
}

export interface JsonLine {
  text: string;
  /** caminho pontuado da chave que a linha pertence (`''` na raiz) */
  path: string;
}

/** `$.items[0].id` → `items.0.id`: uma forma só para comparar caminhos. */
export function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\$\.?/, '')
    .replace(/\[["']?([^\]"']+)["']?\]/g, '.$1')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
}

/**
 * JSON reidentado, uma entrada por linha, cada uma sabendo de que caminho veio.
 * As linhas de abrir e fechar um objeto carregam o caminho do próprio objeto.
 */
export function jsonLines(value: unknown, collapsedDepth = Number.POSITIVE_INFINITY): JsonLine[] {
  const lines: JsonLine[] = [];
  const walk = (node: unknown, prefix: string, depth: number, path: string, comma: string) => {
    const indent = '  '.repeat(depth);
    if (node === null || typeof node !== 'object') {
      lines.push({ text: `${indent}${prefix}${JSON.stringify(node) ?? 'null'}${comma}`, path });
      return;
    }
    const isArray = Array.isArray(node);
    const entries: [string, unknown][] = isArray ? node.map((item, index) => [String(index), item]) : Object.entries(node);
    const [open, close] = isArray ? ['[', ']'] : ['{', '}'];
    if (entries.length === 0) {
      lines.push({ text: `${indent}${prefix}${open}${close}${comma}`, path });
      return;
    }
    if (depth >= collapsedDepth) {
      lines.push({ text: `${indent}${prefix}${open} … ${close}${comma}`, path });
      return;
    }
    lines.push({ text: `${indent}${prefix}${open}`, path });
    entries.forEach(([key, child], index) => {
      const childPath = path ? `${path}.${key}` : key;
      walk(child, isArray ? '' : `${JSON.stringify(key)}: `, depth + 1, childPath, index < entries.length - 1 ? ',' : '');
    });
    lines.push({ text: `${indent}${close}${comma}`, path });
  };
  walk(value, '', 0, '', '');
  return lines;
}

/** Linhas do visualizador a partir do texto: JSON válido é estruturado; inválido vira texto puro. */
export function parseJsonLines(json: string, collapsedDepth?: number): { lines: JsonLine[]; valid: boolean } {
  try {
    return { lines: jsonLines(JSON.parse(json), collapsedDepth), valid: true };
  } catch {
    return { lines: prepareCode(json, Number.POSITIVE_INFINITY).map((text) => ({ text, path: '' })), valid: false };
  }
}

/** Índices das linhas que pertencem ao caminho destacado (a chave e tudo dentro dela). */
export function highlightedLines(lines: readonly JsonLine[], highlightPath?: string): number[] {
  const target = highlightPath === undefined ? '' : normalizePath(highlightPath);
  if (!target) return [];
  return lines.flatMap((line, index) => (line.path === target || line.path.startsWith(`${target}.`) ? [index] : []));
}

export const MAX_JSON_LINES = 13;

/** Janela de linhas visíveis: começa no topo, mas desce o suficiente para o destaque aparecer inteiro (ou pelo menos o começo dele). */
export function lineWindow(total: number, max = MAX_JSON_LINES, focus: readonly number[] = []): { start: number; end: number } {
  if (total <= max) return { start: 0, end: total };
  const first = focus[0];
  const last = focus.at(-1);
  if (first === undefined || last === undefined || last < max - 1) return { start: 0, end: max };
  const start = Math.min(total - max, Math.max(0, Math.min(first - 1, last - max + 2)));
  return { start, end: start + max };
}

const START_SEC = 0.35;
const MIN_WIDTH = 820;

export const JsonViewer: React.FC<JsonViewerProps & BaseProps> = ({ json, title = 'response.json', highlightPath, collapsedDepth, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const { width } = useVideoConfig();

  const { lines } = parseJsonLines(json, collapsedDepth);
  const marks = highlightedLines(lines, highlightPath);
  const range = lineWindow(lines.length, MAX_JSON_LINES, marks);
  const shown = lines.slice(range.start, range.end);
  const marked = new Set(marks.map((index) => index - range.start));

  const maxWidth = Math.min(1500, width - theme.safe.x * 2);
  const inner = maxWidth - WINDOW_PAD_X * 2;
  const longest = Math.max(1, ...shown.map((line) => line.text.length));
  const fontSize = fitFontSize(longest, inner, 34, 24);
  const columns = monoColumns(inner, fontSize);
  const lineHeight = Math.round(fontSize * 1.55);
  const texts = shown.map((line) => clip(line.text, columns));
  const tokens = tokenizeLines(texts, 'json');
  const cardWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, Math.min(longest, columns) * fontSize * MONO_ADVANCE + WINDOW_PAD_X * 2));

  const step = revealStep(shown.length, durationInFrames / fps);
  const doneSec = START_SEC + Math.max(0, shown.length - 1) * step + motion.base;
  const highlight = marked.size ? progressAt(frame, fps, doneSec + 0.1, 0.5) : 0;
  const more = (text: string) => (
    <div style={{ height: lineHeight * 0.8, color: theme.color.slate600, opacity: progressAt(frame, fps, START_SEC) }}>{text}</div>
  );

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <DarkWindow width={cardWidth} title={title} tag="json" enter={enter} exit={exit} value={value}>
        <div style={{ padding: `${WINDOW_PAD_Y}px ${WINDOW_PAD_X}px`, ...monoText(fontSize, lineHeight) }}>
          {range.start > 0 ? more('…') : null}
          {texts.map((_, index) => {
            const lineEnter = progressAt(frame, fps, START_SEC + index * step);
            const isMarked = marked.has(index);
            const dim = highlight && !isMarked ? 1 - 0.5 * highlight : 1;
            return (
              <div key={index} style={{ position: 'relative', height: lineHeight }}>
                {isMarked ? <LineBand color={theme.color.coral} progress={highlight} bleed={WINDOW_PAD_X} /> : null}
                <div style={{ position: 'relative', opacity: lineEnter * dim, translate: `${(1 - lineEnter) * 18}px 0` }}>
                  <CodeTokens tokens={tokens[index] ?? []} />
                </div>
              </div>
            );
          })}
          {range.end < lines.length ? more(`… + ${lines.length - range.end} linhas`) : null}
        </div>
      </DarkWindow>
    </AbsoluteFill>
  );
};

const sample: JsonViewerProps = {
  title: 'GET /api/usuario/87',
  highlightPath: 'usuario.plano',
  json: JSON.stringify({
    usuario: { id: 87, nome: 'Matheus Chiodi', plano: 'pro', ativo: true },
    projetos: ['creatorhub', 'mchiodi-editor'],
    ultimoAcesso: '2026-10-12T14:03:00Z',
  }),
};

export const entry: ComponentEntry = {
  component: JsonViewer,
  sample: { ...sample },
  defaultDuration: 8,
  vertical: { zone: 'full' },
  description: 'JSON identado e colorido com uma chave em destaque; use quando a fala aponta um campo específico de uma resposta de API ou de um arquivo de configuração.',
};
