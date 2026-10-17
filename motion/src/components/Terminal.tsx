import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { CheckMark, CrossMark } from './c1-kit';
import { clip, DarkWindow, darkTone, monoColumns, monoText, WINDOW_PAD_X, WINDOW_PAD_Y } from './c2-kit';
import { fitFontSize, MONO_ADVANCE } from './CodeCard';
import type { ComponentEntry } from './registry';

export type TerminalLineKind = 'command' | 'output' | 'error' | 'success';

export interface TerminalLine {
  text: string;
  kind?: TerminalLineKind;
}

export interface TerminalProps {
  title?: string;
  lines: TerminalLine[];
  /** caracteres por segundo na digitação dos comandos */
  typeSpeed?: number;
}

export interface LineTiming {
  /** segundo em que a linha começa a aparecer */
  start: number;
  /** segundo em que está completa */
  end: number;
}

export const MAX_VISIBLE_LINES = 9;
export const DEFAULT_TYPE_SPEED = 26;
const START_SEC = 0.45;
const AFTER_COMMAND_SEC = 0.35;
const OUTPUT_STEP_SEC = 0.14;
const BEFORE_COMMAND_SEC = 0.4;
const PROMPT_CHARS = 2;

/**
 * Linha do tempo do terminal: comando é digitado no ritmo de `typeSpeed`, saída aparece inteira.
 * Se o roteiro não couber em ~70% do overlay, tudo é comprimido por igual para sobrar leitura.
 */
export function terminalTimeline(lines: readonly TerminalLine[], durationSec: number, typeSpeed = DEFAULT_TYPE_SPEED): LineTiming[] {
  const speed = typeSpeed > 0 ? typeSpeed : DEFAULT_TYPE_SPEED;
  const raw: LineTiming[] = [];
  let cursor = 0;
  lines.forEach((line, index) => {
    const isCommand = (line.kind ?? 'command') === 'command';
    const previous = lines[index - 1];
    const previousIsCommand = previous ? (previous.kind ?? 'command') === 'command' : false;
    if (index > 0) cursor += isCommand ? BEFORE_COMMAND_SEC : previousIsCommand ? AFTER_COMMAND_SEC : OUTPUT_STEP_SEC;
    const start = cursor;
    if (isCommand) cursor += line.text.length / speed;
    raw.push({ start, end: cursor });
  });
  const budget = Math.max(0.5, durationSec * 0.7 - START_SEC);
  const factor = cursor > budget ? budget / cursor : 1;
  const round = (value: number) => Math.round((START_SEC + value * factor) * 1000) / 1000;
  return raw.map((timing) => ({ start: round(timing.start), end: round(timing.end) }));
}

/** Caracteres visíveis de uma linha no instante `sec`: comando cresce de forma linear; saída é tudo ou nada. */
export function visibleChars(line: TerminalLine, timing: LineTiming, sec: number): number {
  if (sec < timing.start) return 0;
  if ((line.kind ?? 'command') !== 'command' || timing.end <= timing.start) return line.text.length;
  const ratio = Math.min(1, (sec - timing.start) / (timing.end - timing.start));
  return Math.floor(ratio * line.text.length);
}

/** Índices das linhas na tela: quando o roteiro passa do limite, o terminal rola e ficam as últimas. */
export function visibleWindow(timeline: readonly LineTiming[], sec: number, max = MAX_VISIBLE_LINES): { first: number; last: number } {
  let last = -1;
  timeline.forEach((timing, index) => {
    if (sec >= timing.start) last = index;
  });
  return { first: Math.max(0, last - max + 1), last };
}

/** Linha em que o cursor está: a que está sendo digitada, ou a última já iniciada. */
export function cursorState(lines: readonly TerminalLine[], timeline: readonly LineTiming[], sec: number): { line: number; typing: boolean } {
  const { last } = visibleWindow(timeline, sec, Number.POSITIVE_INFINITY);
  if (last < 0) return { line: -1, typing: false };
  const timing = timeline[last]!;
  const isCommand = (lines[last]!.kind ?? 'command') === 'command';
  return { line: last, typing: isCommand && sec < timing.end };
}

const lineColor: Record<TerminalLineKind, string> = {
  command: theme.color.paper,
  output: theme.color.slate300,
  error: darkTone.rose,
  success: theme.color.emerald,
};

const MIN_WIDTH = 900;

export const Terminal: React.FC<TerminalProps & BaseProps> = ({ title = 'terminal', lines, typeSpeed, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const { width } = useVideoConfig();
  const sec = frame / fps;

  const timeline = terminalTimeline(lines, durationInFrames / fps, typeSpeed);
  const maxWidth = width - theme.safe.x * 2;
  const longest = Math.max(1, ...lines.map((line) => line.text.length + PROMPT_CHARS));
  const fontSize = fitFontSize(longest, maxWidth - WINDOW_PAD_X * 2, 34, 24);
  const columns = monoColumns(maxWidth - WINDOW_PAD_X * 2, fontSize);
  const lineHeight = Math.round(fontSize * 1.65);
  const cardWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, Math.min(longest, columns) * fontSize * MONO_ADVANCE + WINDOW_PAD_X * 2));
  const rows = Math.min(MAX_VISIBLE_LINES, lines.length);

  const { first, last } = visibleWindow(timeline, sec);
  const cursor = cursorState(lines, timeline, sec);
  const idleSince = cursor.line >= 0 ? timeline[cursor.line]!.end : 0;
  // digitando, o cursor fica aceso; parado, pisca a cada meio segundo
  const cursorOn = cursor.typing || Math.floor(Math.max(0, sec - idleSince) / 0.5) % 2 === 0;
  const markSize = Math.round(fontSize * 0.95);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <DarkWindow width={cardWidth} title={title} enter={enter} exit={exit} value={value}>
        <div style={{ boxSizing: 'border-box', padding: `${WINDOW_PAD_Y}px ${WINDOW_PAD_X}px`, height: rows * lineHeight + WINDOW_PAD_Y * 2, ...monoText(fontSize, lineHeight) }}>
          {lines.map((line, index) => {
            if (index < first || index > last) return null;
            const kind = line.kind ?? 'command';
            const isCommand = kind === 'command';
            const timing = timeline[index]!;
            const appear = isCommand ? 1 : progressAt(frame, fps, timing.start, 0.25);
            const room = columns - PROMPT_CHARS;
            const text = clip(line.text, room).slice(0, visibleChars(line, timing, sec));
            return (
              <div
                key={index}
                style={{
                  height: lineHeight,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: appear,
                  translate: `0 ${(1 - appear) * 8}px`,
                  color: lineColor[kind],
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', width: PROMPT_CHARS * fontSize * MONO_ADVANCE, flexShrink: 0 }}>
                  {isCommand ? <span style={{ color: theme.color.emerald, fontWeight: 700 }}>$</span> : null}
                  {kind === 'error' ? <CrossMark progress={appear} size={markSize} color={darkTone.rose} strokeWidth={3} /> : null}
                  {kind === 'success' ? <CheckMark progress={appear} size={markSize} color={theme.color.emerald} strokeWidth={3} /> : null}
                </span>
                <span>{text}</span>
                {index === cursor.line && isCommand ? (
                  <span
                    style={{
                      display: 'inline-block',
                      width: Math.round(fontSize * 0.55),
                      height: Math.round(fontSize * 1.1),
                      marginLeft: 3,
                      background: theme.color.paper,
                      opacity: cursorOn ? 0.85 : 0,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </DarkWindow>
    </AbsoluteFill>
  );
};

const sample: TerminalProps = {
  title: 'zsh — creatorhub',
  lines: [
    { text: 'npm create vite@latest creatorhub -- --template react-ts', kind: 'command' },
    { text: 'Scaffolding project in ./creatorhub...', kind: 'output' },
    { text: 'npm run build', kind: 'command' },
    { text: 'vite v7.1.4 building for production...', kind: 'output' },
    { text: 'built in 1.84s', kind: 'success' },
  ],
};

export const entry: ComponentEntry = {
  component: Terminal,
  sample: { ...sample },
  defaultDuration: 9,
  description: 'Janela de terminal com comandos digitados e saídas aparecendo; use quando a fala manda rodar um comando ou mostra o resultado dele.',
};
