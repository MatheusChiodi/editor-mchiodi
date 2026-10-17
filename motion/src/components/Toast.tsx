import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { theme } from '../theme';
import { cardSurface, status } from './c1-kit';
import { clamp01, cornerPlacement, tone } from './c3-kit';
import type { ComponentEntry } from './registry';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right';

export interface ToastProps {
  title: string;
  message?: string;
  kind?: ToastKind;
  position?: ToastPosition;
}

/** Cor de acento e fundo do ícone por tipo. O ícone sempre acompanha a cor: ela sozinha não comunica. */
export function toastTone(kind: ToastKind): { color: string; wash: string } {
  switch (kind) {
    case 'success':
      return { color: status.emeraldDeep, wash: tone.emeraldWash };
    case 'warning':
      return { color: status.amber, wash: tone.amberWash };
    case 'error':
      return { color: status.rose, wash: tone.roseWash };
    default:
      return { color: tone.periwinkleInk, wash: tone.periwinkleWash };
  }
}

/**
 * Deslocamento horizontal (px): entra vindo de fora da tela pelo lado em que está ancorado
 * e sai pelo mesmo lado. `distance` precisa cobrir a largura do cartão mais a margem.
 */
export function toastOffset(side: -1 | 1, enter: number, exit: number, distance: number): number {
  return side * distance * (1 - enter + exit);
}

/** Vida restante da notificação (1→0), descontadas a entrada e a saída: é a barrinha que esvazia. */
export function toastLife(sec: number, totalSec: number, enterSec = 0.4, exitSec = 0.2): number {
  const span = totalSec - enterSec - exitSec;
  return span <= 0 ? 0 : 1 - clamp01((sec - enterSec) / span);
}

const ICONS: Record<ToastKind, string[]> = {
  info: ['M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z', 'M12 16.5v-5', 'M12 7.6v.2'],
  success: ['M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z', 'M8.3 12.3l2.6 2.6 4.8-5.2'],
  warning: ['M10.4 4.1L2.6 17.6a1.9 1.9 0 0 0 1.6 2.9h15.6a1.9 1.9 0 0 0 1.6-2.9L13.6 4.1a1.9 1.9 0 0 0-3.2 0z', 'M12 9.5v4.2', 'M12 16.8v.2'],
  error: ['M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z', 'M15 9l-6 6', 'M9 9l6 6'],
};

const WIDTH = 680;

export const Toast: React.FC<ToastProps & BaseProps> = ({ title, message, kind = 'info', position = 'top-right', durationInFrames }) => {
  const { frame, fps, enter, exit } = usePresence(durationInFrames, 0.45, 0.25);
  const { justifyContent, alignItems, side } = cornerPlacement(position);
  const { color, wash } = toastTone(kind);
  const icon = progressAt(frame, fps, 0.25, 0.6);
  const life = toastLife(frame / fps, durationInFrames / fps, 0.45, 0.25);

  return (
    <AbsoluteFill style={{ justifyContent, alignItems, padding: `${theme.safe.y}px ${theme.safe.x}px` }}>
      <div
        style={{
          ...cardSurface,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: message ? 'flex-start' : 'center',
          gap: 24,
          width: WIDTH,
          boxSizing: 'border-box',
          padding: '28px 34px 34px 28px',
          translate: `${toastOffset(side, enter, exit, WIDTH + theme.safe.x + 40)}px 0`,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: theme.radius.pill,
            background: wash,
          }}
        >
          <svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
            {icon > 0 ? ICONS[kind].map((d) => <path key={d} d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - icon} />) : null}
          </svg>
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: theme.font.body, overflowWrap: 'anywhere' }}>
          <div style={{ fontWeight: 800, fontSize: 34, lineHeight: 1.2, letterSpacing: '-0.01em', color: theme.color.ink }}>{title}</div>
          {message ? <div style={{ fontWeight: 500, fontSize: 28, lineHeight: 1.3, color: theme.color.slate600 }}>{message}</div> : null}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 6,
            background: color,
            opacity: 0.85,
            scale: `${life} 1`,
            transformOrigin: 'left center',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: Toast,
  sample: {
    kind: 'success',
    title: 'Deploy concluído',
    message: 'A versão 2.4.0 já está em produção na Vercel.',
    position: 'top-right',
  },
  defaultDuration: 4,
  description: 'Notificação de sistema que desliza do canto: aviso rápido, resultado de uma ação ou comentário lateral à fala.',
};
