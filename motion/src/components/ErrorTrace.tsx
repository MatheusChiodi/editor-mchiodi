import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { theme } from '../theme';
import { DarkWindow, darkTone, Icon, LineBand, monoColumns, monoText, WINDOW_PAD_X, WINDOW_PAD_Y } from './c2-kit';
import { fitFontSize, MONO_ADVANCE } from './CodeCard';
import type { ComponentEntry } from './registry';

export interface ErrorTraceProps {
  /** nome do erro, ex.: `TypeError` */
  title: string;
  message: string;
  /** linhas do stack, da mais interna para a mais externa (máx. 6 visíveis) */
  frames?: string[];
  /** índice (0-based) em `frames` da linha culpada */
  highlight?: number;
}

export interface StackFrame {
  /** função ou método; vazio quando o frame só tem o arquivo */
  fn: string;
  /** arquivo:linha:coluna */
  location: string;
}

/** Entende os formatos comuns de stack (`at fn (arquivo:1:2)`, `at arquivo:1:2`, `fn@arquivo:1:2`). */
export function parseFrame(text: string): StackFrame {
  const line = text.trim().replace(/^at\s+/, '');
  const paren = /^(.*?)\s*\((.+)\)$/.exec(line);
  if (paren) return { fn: paren[1]!.trim(), location: paren[2]!.trim() };
  const firefox = /^([^@\s]*)@(.+)$/.exec(line);
  if (firefox) return { fn: firefox[1]!, location: firefox[2]! };
  return /[\\/]|:\d+/.test(line) ? { fn: '', location: line } : { fn: line, location: '' };
}

/** Encurta um caminho pelo começo: o que importa num stack é o fim (arquivo e linha). */
export function tailClip(text: string, max: number): string {
  if (max <= 0) return '';
  return text.length <= max ? text : `…${text.slice(text.length - Math.max(0, max - 1))}`;
}

export const MAX_FRAMES = 6;

/** Janela de até `max` frames que sempre contém a linha culpada; devolve o índice dela dentro da janela (-1 se não há). */
export function frameWindow(frames: readonly string[], highlight?: number, max = MAX_FRAMES): { frames: string[]; highlight: number } {
  const valid = highlight !== undefined && Number.isInteger(highlight) && highlight >= 0 && highlight < frames.length;
  const first = valid ? Math.max(0, Math.min(highlight - max + 1, frames.length - max)) : 0;
  return { frames: frames.slice(first, first + max), highlight: valid ? highlight - first : -1 };
}

const FRAMES_START = 0.7;
const FRAME_STEP = 0.1;
const AT = 'at ';

export const ErrorTrace: React.FC<ErrorTraceProps & BaseProps> = ({ title, message, frames = [], highlight, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const { width } = useVideoConfig();

  const shown = frameWindow(frames, highlight);
  const parsed = shown.frames.map(parseFrame);
  const maxWidth = Math.min(1560, width - theme.safe.x * 2);
  const inner = maxWidth - WINDOW_PAD_X * 2;
  const longest = Math.max(1, ...parsed.map((item) => AT.length + item.fn.length + (item.fn && item.location ? 3 : 0) + item.location.length));
  const fontSize = fitFontSize(longest + 2, inner, 30, 24);
  const columns = monoColumns(inner, fontSize) - 2;
  const lineHeight = Math.round(fontSize * 1.75);
  const cardWidth = Math.max(1000, Math.min(maxWidth, Math.max(longest + 2, message.length * 0.75) * fontSize * MONO_ADVANCE + WINDOW_PAD_X * 2));
  const blame = shown.highlight >= 0 ? progressAt(frame, fps, FRAMES_START + parsed.length * FRAME_STEP + 0.25, 0.5) : 0;
  const headline = progressAt(frame, fps, 0.2);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <DarkWindow width={cardWidth} title="console" tag="erro" enter={enter} exit={exit} value={value}>
        <div style={{ padding: `${WINDOW_PAD_Y + 4}px ${WINDOW_PAD_X}px ${WINDOW_PAD_Y}px` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: headline, translate: `${(1 - headline) * 18}px 0` }}>
            <Icon name="alert" size={46} color={darkTone.rose} strokeWidth={2} />
            <div
              style={{
                fontFamily: theme.font.mono,
                fontWeight: 700,
                fontSize: 40,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: darkTone.rose,
              }}
            >
              {title}
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: theme.font.mono,
              fontWeight: 500,
              fontSize: 32,
              lineHeight: 1.4,
              color: theme.color.paper,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              opacity: progressAt(frame, fps, 0.32),
            }}
          >
            {message}
          </div>
          {parsed.length ? (
            <div style={{ marginTop: 26, paddingTop: 20, borderTop: `1px solid ${theme.color.slate600}`, ...monoText(fontSize, lineHeight) }}>
              {parsed.map((item, index) => {
                const appear = progressAt(frame, fps, stagger(index, FRAME_STEP, FRAMES_START), 0.3);
                const culprit = index === shown.highlight;
                const dim = blame && !culprit ? 1 - 0.5 * blame : 1;
                const fn = item.fn.slice(0, Math.max(8, columns - AT.length - 12));
                const room = columns - AT.length - fn.length - (fn ? 3 : 0);
                const location = tailClip(item.location, room);
                return (
                  <div key={index} style={{ position: 'relative', height: lineHeight }}>
                    {culprit ? <LineBand color={darkTone.rose} progress={blame} bleed={WINDOW_PAD_X} strength={0.22} /> : null}
                    <div style={{ position: 'relative', opacity: appear * dim, translate: `${(1 - appear) * 16}px 0` }}>
                      <span style={{ color: theme.color.slate600 }}>{AT}</span>
                      <span style={{ color: theme.color.paper, fontWeight: culprit ? 700 : 500 }}>{fn}</span>
                      {location ? (
                        <span style={{ color: culprit ? theme.color.paper : theme.color.slate300 }}>{fn ? ` (${location})` : location}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </DarkWindow>
    </AbsoluteFill>
  );
};

const sample: ErrorTraceProps = {
  title: 'TypeError',
  message: "Cannot read properties of undefined (reading 'map')",
  frames: [
    'at renderRows (src/components/TaskList.tsx:24:18)',
    'at TaskList (src/components/TaskList.tsx:41:10)',
    'at renderWithHooks (react-dom.development.js:15486:18)',
    'at mountIndeterminateComponent (react-dom.development.js:20103:13)',
  ],
  highlight: 0,
};

export const entry: ComponentEntry = {
  component: ErrorTrace,
  sample: { ...sample },
  defaultDuration: 8,
  description: 'Stack trace de erro em janela escura, com a linha culpada em destaque; use quando a fala lê um erro ou mostra onde o bug está.',
};
