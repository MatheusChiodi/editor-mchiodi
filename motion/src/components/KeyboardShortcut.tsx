import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface KeyboardShortcutProps {
  /** teclas na ordem em que são pressionadas, ex.: `['Ctrl', 'Shift', 'P']` (máx. 5) */
  keys: string[];
  /** o que o atalho faz */
  label?: string;
}

export const MAX_KEYS = 5;
export const PRESS_START = 0.55;
export const PRESS_STEP = 0.3;
const PRESS_SEC = 0.1;
const HOLD_SEC = 0.75;
const RELEASE_SEC = 0.16;

const ALIASES: Record<string, string> = {
  control: 'Ctrl',
  ctrl: 'Ctrl',
  command: 'Cmd',
  cmd: 'Cmd',
  meta: 'Cmd',
  option: 'Alt',
  alt: 'Alt',
  shift: 'Shift',
  escape: 'Esc',
  esc: 'Esc',
  return: 'Enter',
  enter: 'Enter',
  tab: 'Tab',
  space: 'Espaço',
  ' ': 'Espaço',
  backspace: 'Backspace',
  delete: 'Del',
  del: 'Del',
};

/** Nome da tecla como vem impresso no teclado: apelidos comuns normalizados, letra solta em maiúscula. */
export function keyLabel(key: string): string {
  const alias = ALIASES[key === ' ' ? key : key.trim().toLowerCase()];
  if (alias) return alias;
  const trimmed = key.trim();
  return trimmed.length === 1 ? trimmed.toUpperCase() : trimmed;
}

/** Largura da tecla: quadrada para um caractere, crescendo com o nome. */
export function keyWidth(label: string, size = 136): number {
  return Math.round(Math.max(size, size * 0.62 + label.length * size * 0.24));
}

/** Segundo em que cada tecla desce. */
export function pressTimes(count: number): number[] {
  return Array.from({ length: count }, (_, index) => Math.round((PRESS_START + index * PRESS_STEP) * 1000) / 1000);
}

/**
 * Quanto a tecla está afundada (0–1): cada uma desce na sua vez e fica segurada;
 * todas soltam juntas depois da última, como num atalho de verdade.
 */
export function keyDepth(index: number, count: number, sec: number): number {
  const times = pressTimes(count);
  const down = times[index];
  if (down === undefined) return 0;
  const release = times[count - 1]! + PRESS_SEC + HOLD_SEC;
  if (sec <= down) return 0;
  if (sec < down + PRESS_SEC) return (sec - down) / PRESS_SEC;
  if (sec <= release) return 1;
  return Math.max(0, 1 - (sec - release) / RELEASE_SEC);
}

/** Escala que faz a fileira de teclas caber na largura disponível. */
export function rowScale(labels: readonly string[], available: number, size = 136, gap = 64): number {
  const total = labels.reduce((sum, label) => sum + keyWidth(label, size), 0) + gap * Math.max(0, labels.length - 1);
  return total <= available || total === 0 ? 1 : available / total;
}

const SIZE = 136;
const TRAVEL = 12;
const outline = `0 0 14px rgba(17,24,39,0.9), 0 2px 4px rgba(17,24,39,0.9)`;

export const KeyboardShortcut: React.FC<KeyboardShortcutProps & BaseProps> = ({ keys, label, durationInFrames }) => {
  const { frame, fps, exit } = usePresence(durationInFrames);
  const { width } = useVideoConfig();
  const sec = frame / fps;

  const labels = keys.slice(0, MAX_KEYS).map(keyLabel);
  const scale = rowScale(labels, width - theme.safe.x * 2);
  const size = SIZE * scale;
  const done = (pressTimes(labels.length).at(-1) ?? PRESS_START) + PRESS_SEC;
  const labelIn = progressAt(frame, fps, done + 0.05);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 54, opacity: 1 - exit, translate: `0 ${exit * 16}px` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {labels.map((text, index) => {
          const appear = progressAt(frame, fps, 0.08 * index);
          const depth = keyDepth(index, labels.length, sec);
          const lift = (1 - depth) * TRAVEL * scale;
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
              {index > 0 ? (
                <div
                  style={{
                    width: 64 * scale,
                    textAlign: 'center',
                    fontFamily: theme.font.body,
                    fontWeight: 600,
                    fontSize: 54 * scale,
                    color: theme.color.white,
                    textShadow: outline,
                    opacity: appear,
                    translate: `0 ${-8 * scale}px`,
                  }}
                >
                  +
                </div>
              ) : null}
              {/* base fixa: é a lateral da tecla, que aparece mais quando a face está levantada */}
              <div
                style={{
                  position: 'relative',
                  width: keyWidth(text, size),
                  height: size,
                  marginTop: TRAVEL * scale,
                  borderRadius: 26 * scale,
                  background: theme.color.slate300,
                  boxShadow: `0 ${(18 - 10 * depth) * scale}px ${(34 - 16 * depth) * scale}px -${14 * scale}px rgba(15,23,42,0.8)`,
                  opacity: appear,
                  translate: `0 ${(1 - appear) * 26}px`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    top: -lift,
                    bottom: lift,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 26 * scale,
                    background: theme.color.paper,
                    border: `1px solid ${theme.color.white}`,
                    fontFamily: theme.font.body,
                    fontWeight: 800,
                    fontSize: (text.length === 1 ? 60 : 42) * scale,
                    letterSpacing: '-0.01em',
                    color: theme.color.ink,
                  }}
                >
                  {text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {label ? (
        <div
          style={{
            maxWidth: width - theme.safe.x * 2,
            boxSizing: 'border-box',
            padding: '14px 36px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            borderRadius: theme.radius.pill,
            background: theme.color.ink,
            boxShadow: theme.shadow.card,
            fontFamily: theme.font.body,
            fontWeight: 600,
            fontSize: 38,
            color: theme.color.white,
            opacity: labelIn,
            translate: `0 ${(1 - labelIn) * 16}px`,
          }}
        >
          <div style={{ flexShrink: 0, width: 14, height: 14, borderRadius: theme.radius.pill, background: theme.color.coral }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const sample: KeyboardShortcutProps = {
  keys: ['Ctrl', 'Shift', 'P'],
  label: 'Abre a paleta de comandos do VS Code',
};

export const entry: ComponentEntry = {
  component: KeyboardShortcut,
  sample: { ...sample },
  defaultDuration: 4,
  description: 'Teclas pressionadas em sequência com a legenda do que o atalho faz; use sempre que um atalho de teclado for citado.',
};
