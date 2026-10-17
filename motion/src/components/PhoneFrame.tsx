import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { theme } from '../theme';
import { fitWire, WireBlock, type WireBlockSpec } from './c2-kit';
import type { ComponentEntry } from './registry';

export interface PhoneBlock {
  kind: 'heading' | 'text' | 'button' | 'image' | 'list';
  label?: string;
}

export interface PhoneFrameProps {
  /** título da tela (barra superior do app) */
  title?: string;
  /** wireframe da tela, de cima para baixo (máx. 5 blocos) */
  blocks?: PhoneBlock[];
  side?: 'left' | 'right';
}

export const PHONE = { width: 452, height: 920, bezel: 16, radius: 68 } as const;
export const DEFAULT_PHONE_BLOCKS: PhoneBlock[] = [{ kind: 'image' }, { kind: 'heading' }, { kind: 'list' }, { kind: 'button' }];

/** Canto superior esquerdo do aparelho: encostado na margem segura do lado pedido, centrado na vertical. */
export function phonePosition(
  side: 'left' | 'right',
  canvas: { width: number; height: number },
  size: { width: number; height: number } = PHONE,
): { x: number; y: number } {
  const inset = theme.safe.x + 64;
  return {
    x: side === 'left' ? inset : canvas.width - inset - size.width,
    y: Math.round((canvas.height - size.height) / 2),
  };
}

const STATUS_BAR = 64;
const HEADER = 84;
const PAD_X = 30;
const PAD_Y = 26;
const SCALE = 0.84;
const BLOCKS_START = 0.45;

export const PhoneFrame: React.FC<PhoneFrameProps & BaseProps> = ({ title, blocks, side = 'right', durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames, 0.5);
  const { width, height } = useVideoConfig();
  const position = phonePosition(side, { width, height });
  const direction = side === 'left' ? -1 : 1;

  const screenHeight = PHONE.height - PHONE.bezel * 2;
  const source: WireBlockSpec[] = blocks?.length ? blocks : DEFAULT_PHONE_BLOCKS;
  const available = screenHeight - STATUS_BAR - (title ? HEADER : 0) - PAD_Y * 2 - 30;
  const layout = fitWire(source, available, 5, SCALE);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: PHONE.width,
          height: PHONE.height,
          boxSizing: 'border-box',
          padding: PHONE.bezel,
          borderRadius: PHONE.radius,
          background: theme.color.ink,
          boxShadow: `${theme.shadow.raised}, 0 0 0 2px ${theme.color.slate600}`,
          opacity: value,
          translate: `${direction * ((1 - enter) * 40 + exit * 24)}px ${(1 - enter) * 24}px`,
          rotate: `${direction * (1 - enter) * 3}deg`,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: PHONE.radius - PHONE.bezel,
            background: theme.color.paper,
          }}
        >
          <div style={{ flexShrink: 0, height: STATUS_BAR, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 124, height: 32, borderRadius: theme.radius.pill, background: theme.color.ink }} />
          </div>
          {title ? (
            <div
              style={{
                flexShrink: 0,
                height: HEADER,
                boxSizing: 'border-box',
                padding: `0 ${PAD_X}px`,
                display: 'flex',
                alignItems: 'center',
                borderBottom: `1px solid ${theme.color.slate300}`,
                fontFamily: theme.font.display,
                fontWeight: 600,
                fontSize: 38,
                letterSpacing: '-0.01em',
                color: theme.color.slate900,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            </div>
          ) : null}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 26 * SCALE * layout.scale, padding: `${PAD_Y}px ${PAD_X}px` }}>
            {layout.blocks.map((block, index) => (
              <WireBlock
                key={index}
                block={block}
                height={layout.heights[index]!}
                scale={SCALE * Math.max(0.85, layout.scale)}
                appear={progressAt(frame, fps, stagger(index, 0.14, BLOCKS_START))}
              />
            ))}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 150, height: 7, borderRadius: theme.radius.pill, background: theme.color.slate300 }} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const sample: PhoneFrameProps = {
  title: 'Meus treinos',
  side: 'right',
  blocks: [
    { kind: 'image', label: 'gráfico da semana' },
    { kind: 'heading', label: 'Hoje: pernas' },
    { kind: 'list', label: 'Agachamento livre' },
    { kind: 'button', label: 'Começar treino' },
  ],
};

export const entry: ComponentEntry = {
  component: PhoneFrame,
  sample: { ...sample },
  defaultDuration: 7,
  vertical: { zone: 'full' },
  description: 'Celular com um wireframe da tela, encostado num dos lados; use quando a fala descreve um app mobile ou uma tela de React Native.',
};
