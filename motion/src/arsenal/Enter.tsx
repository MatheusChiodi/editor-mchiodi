import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { motion } from '../theme';
import {
  type EntranceStyle,
  type TextToken,
  entranceStyle,
  exitDurationSec,
  exitStyle,
  getEntrance,
  splitUnits,
  toCss,
  unitDelay,
} from './entrances';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export interface EnterTiming {
  /** segundos, relativos ao início da <Sequence>, em que a entrada começa */
  delaySec?: number;
  /** duração do elemento em frames; necessária para a saída */
  durationInFrames?: number;
  exit?: boolean;
}

/**
 * Estilo do preset em um frame: entra a partir de `delaySec` na curva do preset e, com `exit`,
 * sai nos últimos frames em `motion.exit`. Função pura para poder ser testada.
 */
export function enterStyleAt(id: string, frame: number, fps: number, timing: EnterTiming = {}): EntranceStyle {
  const { delaySec = 0, durationInFrames, exit = false } = timing;
  const preset = getEntrance(id);
  if (exit && durationInFrames !== undefined) {
    const start = durationInFrames - exitDurationSec(preset) * fps;
    const leaving = interpolate(frame, [start, durationInFrames], [0, 1], { ...clamp, easing: motion.exit });
    if (leaving > 0) return exitStyle(id, leaving);
  }
  const start = delaySec * fps;
  const progress = interpolate(frame, [start, start + preset.durationSec * fps], [0, 1], {
    ...clamp,
    easing: motion[preset.easing],
  });
  return entranceStyle(id, progress);
}

export interface EnterProps extends EnterTiming {
  preset: string;
  /** posição entre elementos irmãos: soma `unitDelay` ao atraso */
  index?: number;
  /** substitui o frame da composição (loops e previews) */
  frame?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const Enter: React.FC<EnterProps> = ({ preset, delaySec = 0, durationInFrames, exit, index = 0, frame, style, children }) => {
  const current = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = delaySec + unitDelay(getEntrance(preset), index);
  const animated = toCss(enterStyleAt(preset, frame ?? current, fps, { delaySec: delay, durationInFrames, exit }));

  return <div style={{ ...style, ...animated }}>{children}</div>;
};

export interface EnterTextProps extends EnterTiming {
  preset: string;
  text: string;
  /** tracking do próprio texto em em (ex.: 0.3 no eyebrow); os presets de espaçamento somam a ele */
  trackingEm?: number;
  frame?: number;
  style?: React.CSSProperties;
}

/** Caracteres da mesma palavra ficam juntos para a linha nunca quebrar no meio dela. */
function groupTokens(tokens: readonly TextToken[]): TextToken[][] {
  const groups: TextToken[][] = [];
  for (const token of tokens) {
    const last = groups[groups.length - 1];
    if (last && token.index !== null && last[0]!.index !== null && last[0]!.group === token.group) last.push(token);
    else groups.push([token]);
  }
  return groups;
}

export const EnterText: React.FC<EnterTextProps> = ({ preset, text, delaySec = 0, durationInFrames, exit, trackingEm = 0, frame, style }) => {
  const current = useCurrentFrame();
  const { fps } = useVideoConfig();
  const definition = getEntrance(preset);
  const inline = definition.unit === 'word' || definition.unit === 'char';

  const unitStyle = (index: number): React.CSSProperties => {
    const delay = delaySec + unitDelay(definition, index);
    const base = enterStyleAt(preset, frame ?? current, fps, { delaySec: delay, durationInFrames, exit });
    return toCss(base.letterSpacing === undefined ? base : { ...base, letterSpacing: base.letterSpacing + trackingEm });
  };

  return (
    <div style={{ letterSpacing: trackingEm ? `${trackingEm}em` : undefined, ...style, whiteSpace: inline ? 'pre-wrap' : 'pre' }}>
      {groupTokens(splitUnits(text, definition.unit)).map((group, key) => {
        const first = group[0]!;
        if (first.index === null) return first.text;
        if (!inline) {
          return (
            // linha vazia precisa manter a altura para o bloco não encolher
            <div key={key} style={{ minHeight: '1lh', ...unitStyle(first.index) }}>
              {first.text}
            </div>
          );
        }
        if (definition.unit === 'word') {
          return (
            <span key={key} style={{ display: 'inline-block', ...unitStyle(first.index) }}>
              {first.text}
            </span>
          );
        }
        return (
          <span key={key} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
            {group.map((token) => (
              <span key={token.index} style={{ display: 'inline-block', ...unitStyle(token.index ?? 0) }}>
                {token.text}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
};
