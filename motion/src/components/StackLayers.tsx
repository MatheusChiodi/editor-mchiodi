import { AbsoluteFill, useVideoConfig } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { techFor, TechGlyph } from '../tech/glyph';
import { theme } from '../theme';
import { Pill } from './c1-kit';
import { fitLabel } from './Diagram';
import type { ComponentEntry } from './registry';

export interface StackLayer {
  label: string;
  detail?: string;
}

export interface StackLayersProps {
  /** de cima para baixo, ex.: Frontend / API / Banco (máx. 5) */
  layers: StackLayer[];
  /** índice (0-based) da camada em destaque */
  active?: number;
  title?: string;
  /** false: camada com nome de tecnologia não ganha o logo sozinha */
  autoTechIcons?: boolean;
}

export interface Slab {
  x: number;
  y: number;
  width: number;
  height: number;
  /** profundidade das faces de cima e lateral */
  depth: number;
}

export const MAX_LAYERS = 5;
const SLAB = { width: 980, height: 116, depth: 30, gap: 20 } as const;
const TITLE_SPACE = 84;

/**
 * Caixas das faces frontais, empilhadas e centradas. Cada camada ocupa a face + a profundidade
 * da tampa; se a pilha não couber na altura segura, tudo encolhe na mesma proporção.
 */
export function stackLayout(count: number, canvas: { width: number; height: number }, hasTitle = false): { slabs: Slab[]; scale: number } {
  const total = Math.max(0, Math.min(MAX_LAYERS, count));
  if (total === 0) return { slabs: [], scale: 1 };
  const step = SLAB.height + SLAB.depth + SLAB.gap;
  const natural = total * step - SLAB.gap + (hasTitle ? TITLE_SPACE : 0);
  const available = canvas.height - theme.safe.y * 2;
  const scale = Math.min(1, available / natural);
  const width = SLAB.width * scale;
  const depth = SLAB.depth * scale;
  const top = (canvas.height - natural * scale) / 2 + (hasTitle ? TITLE_SPACE * scale : 0) + depth;
  return {
    scale,
    slabs: Array.from({ length: total }, (_, index) => ({
      // a face lateral avança `depth` para a direita: desconta metade para o conjunto ficar centrado
      x: (canvas.width - width - depth) / 2,
      y: top + index * step * scale,
      width,
      height: SLAB.height * scale,
      depth,
    })),
  };
}

export const BUILD_START = 0.3;
export const BUILD_STEP = 0.16;

/** Segundo em que cada camada pousa: a pilha é montada de baixo para cima. */
export function buildTimes(count: number): number[] {
  return Array.from({ length: count }, (_, index) => Math.round((BUILD_START + (count - 1 - index) * BUILD_STEP) * 1000) / 1000);
}

/** Índice ativo válido ou -1. */
export function activeLayer(active: number | undefined, count: number): number {
  return active !== undefined && Number.isInteger(active) && active >= 0 && active < count ? active : -1;
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } as const;

export const StackLayers: React.FC<StackLayersProps & BaseProps> = ({ layers, active, title, autoTechIcons = true, durationInFrames }) => {
  const { frame, fps, exit } = usePresence(durationInFrames);
  const { width, height } = useVideoConfig();

  const shown = layers.slice(0, MAX_LAYERS);
  const { slabs, scale } = stackLayout(shown.length, { width, height }, Boolean(title));
  const times = buildTimes(shown.length);
  const focusIndex = activeLayer(active, shown.length);
  const focus = focusIndex >= 0 ? progressAt(frame, fps, BUILD_START + shown.length * BUILD_STEP + 0.35, 0.5) : 0;
  const first = slabs[0];

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, translate: `0 ${exit * 16}px` }}>
      {title && first ? (
        <div style={{ position: 'absolute', left: first.x, top: first.y - first.depth - TITLE_SPACE * scale, opacity: progressAt(frame, fps, 0.1) }}>
          <Pill dot={theme.color.coral}>{title}</Pill>
        </div>
      ) : null}
      {shown.map((layer, index) => {
        const slab = slabs[index]!;
        const land = progressAt(frame, fps, times[index]!, 0.5);
        const on = index === focusIndex ? focus : 0;
        const off = focusIndex >= 0 && index !== focusIndex ? focus : 0;
        const textRoom = SLAB.width - 88 - 36 - 28;
        const tech = techFor(layer.label, undefined, autoTechIcons);
        const overlay = (dark: string): React.CSSProperties => ({ position: 'absolute', inset: 0, background: dark, opacity: on });
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: slab.x,
              top: slab.y,
              width: slab.width,
              height: slab.height,
              // camadas de cima ficam na frente: a tampa de uma cobre o pé da de cima
              zIndex: shown.length - index,
              opacity: land,
              translate: `${-36 * on * scale}px ${(1 - land) * -48}px`,
              filter: `drop-shadow(0 ${22 * scale}px ${26 * scale}px rgba(15,23,42,${0.5 - 0.15 * off}))`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: -slab.depth,
                width: slab.width,
                height: slab.depth,
                transform: 'skewX(-45deg)',
                transformOrigin: 'bottom left',
                background: theme.color.white,
              }}
            >
              <div style={overlay(theme.color.slate600)} />
            </div>
            <div
              style={{
                position: 'absolute',
                left: slab.width,
                top: 0,
                width: slab.depth,
                height: slab.height,
                transform: 'skewY(-45deg)',
                transformOrigin: 'top left',
                background: theme.color.slate300,
              }}
            >
              <div style={overlay(theme.color.night)} />
            </div>
            <div style={{ position: 'absolute', inset: 0, background: theme.color.paper }}>
              <div style={overlay(theme.color.slate900)} />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  boxSizing: 'border-box',
                  padding: `0 ${44 * scale}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 28 * scale,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: (14 + 22 * on) * scale,
                    height: 14 * scale,
                    borderRadius: theme.radius.pill,
                    background: on > 0 ? theme.color.coral : theme.color.slate300,
                  }}
                />
                {/* camada que é uma tecnologia ("PostgreSQL") leva o logo antes do nome */}
                {tech ? <TechGlyph tech={tech} size={52 * scale} surface={on > 0.5 ? 'dark' : 'light'} progress={land} /> : null}
                <div
                  style={{
                    ...ellipsis,
                    flexShrink: 0,
                    maxWidth: layer.detail ? '56%' : '100%',
                    fontFamily: theme.font.body,
                    fontWeight: 800,
                    fontSize: fitLabel(layer.label, (textRoom - (tech ? 80 : 0)) * (layer.detail ? 0.54 : 1), 42, 32) * scale,
                    letterSpacing: '-0.01em',
                    color: on > 0.5 ? theme.color.white : theme.color.ink,
                  }}
                >
                  {layer.label}
                </div>
                {layer.detail ? (
                  <div
                    style={{
                      ...ellipsis,
                      flex: 1,
                      textAlign: 'right',
                      fontFamily: theme.font.body,
                      fontWeight: 500,
                      fontSize: fitLabel(layer.detail, textRoom * 0.44, 30, 24, 0.52) * scale,
                      color: on > 0.5 ? theme.color.slate300 : theme.color.slate600,
                    }}
                  >
                    {layer.detail}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const sample: StackLayersProps = {
  title: 'Stack do creatorhub',
  active: 1,
  layers: [
    { label: 'Frontend', detail: 'React 19 + Tailwind 4' },
    { label: 'API', detail: 'Cloudflare Workers' },
    { label: 'Dados', detail: 'KV na borda' },
    { label: 'Deploy', detail: 'Vercel + Wrangler' },
  ],
};

export const entry: ComponentEntry = {
  component: StackLayers,
  sample: { ...sample },
  defaultDuration: 7,
  description: 'Camadas empilhadas em perspectiva com uma em destaque; use para explicar a stack de um projeto ou em que camada um problema acontece.',
};
