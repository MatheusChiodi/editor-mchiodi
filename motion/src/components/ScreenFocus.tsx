import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import { easeInOut, easeOutQuad, FULL, type PushState, pushPoint, type Rect, roundedRectPath, stageMotion } from '../arsenal/stage';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';

/** Retângulo destacado da tela (0–1 do conteúdo): o entorno escurece e um contorno coral é desenhado em volta. */
export interface FocusBox {
  /** segundos, relativos ao início do overlay */
  at: number;
  /** segundos na tela; sem valor, fica até o fim */
  duration?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** quanto o entorno escurece (0–0,85); `false` desliga */
  dim?: number | boolean;
  /** contorno coral desenhado; padrão ligado */
  outline?: boolean;
}

/** Clique num ponto da tela (0–1 do conteúdo): anel que expande e some. */
export interface ClickRing {
  at: number;
  x: number;
  y: number;
}

export const MAX_FOCUS = 6;
export const MAX_CLICKS = 12;
export const RING = { from: 10, to: 56, stroke: 6 } as const;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function validBoxes(boxes: unknown): FocusBox[] {
  if (!Array.isArray(boxes)) return [];
  return (boxes as FocusBox[]).filter((box) => box && finite(box.at) && box.at >= 0 && finite(box.x) && finite(box.y) && finite(box.w) && finite(box.h) && box.w > 0 && box.h > 0).slice(0, MAX_FOCUS);
}

export function validClicks(clicks: unknown): ClickRing[] {
  if (!Array.isArray(clicks)) return [];
  return (clicks as ClickRing[]).filter((click) => click && finite(click.at) && click.at >= 0 && finite(click.x) && finite(click.y)).slice(0, MAX_CLICKS);
}

/** Força do escurecimento pedida pela caixa (0 = sem escurecer). */
export function boxDim(box: Pick<FocusBox, 'dim'>): number {
  if (box.dim === false) return 0;
  return finite(box.dim) ? Math.min(0.85, Math.max(0, box.dim)) : stageMotion.focus.dim;
}

/** Presença (0–1, entra e sai em 8 f) e traço do contorno (0–1, desenhado em 10 f) de uma caixa em `sec`. */
export function focusState(box: Pick<FocusBox, 'at' | 'duration'>, sec: number, totalSec: number): { visible: number; draw: number } {
  const { fadeSec, outlineSec } = stageMotion.focus;
  const end = finite(box.duration) && box.duration > 0 ? Math.min(totalSec, box.at + box.duration) : totalSec;
  return {
    visible: easeInOut((sec - box.at) / fadeSec) * (1 - easeInOut((sec - (end - fadeSec)) / fadeSec)),
    draw: easeInOut((sec - box.at) / outlineSec),
  };
}

/** Anel de clique em `sec`: nasce pequeno e opaco no ponto, expande desacelerando e some. Fora do intervalo, null. */
export function ringState(click: Pick<ClickRing, 'at'>, sec: number): { radius: number; opacity: number } | null {
  const k = (sec - click.at) / stageMotion.focus.ringSec;
  if (k < 0 || k >= 1) return null;
  return { radius: RING.from + (RING.to - RING.from) * easeOutQuad(k), opacity: 1 - k * k };
}

/** Caixa do conteúdo (0–1) → px dentro do corpo da janela, acompanhando o zoom. */
export function mapBox(box: Pick<FocusBox, 'x' | 'y' | 'w' | 'h'>, state: PushState, width: number, height: number): { x: number; y: number; w: number; h: number } {
  const corner = pushPoint(state, { x: box.x, y: box.y });
  return { x: corner.x * width, y: corner.y * height, w: box.w * state.scale * width, h: box.h * state.scale * height };
}

export interface FocusLayerProps {
  /** onde fica o corpo da janela (ou a tela inteira), em px */
  left: number;
  top: number;
  width: number;
  height: number;
  /** zoom atual do conteúdo: os destaques andam junto */
  state: PushState;
  boxes: FocusBox[];
  clicks: ClickRing[];
  sec: number;
  totalSec: number;
  /** raio dos cantos de baixo, para o escurecimento não vazar da janela */
  radius?: number;
}

/**
 * Foco sobre a tela gravada, o que a referência não tem: escurece o entorno do que a fala cita, desenha um
 * contorno coral em volta e marca cada clique com um anel. Recortado no corpo da janela.
 */
export const FocusLayer: React.FC<FocusLayerProps> = ({ left, top, width, height, state, boxes, clicks, sec, totalSec, radius = 0 }) => {
  const shown = boxes
    .map((box) => ({ box, rect: mapBox(box, state, width, height), ...focusState(box, sec, totalSec) }))
    .filter((item) => item.visible > 0.001);
  const rings = clicks.map((click) => ({ click, ring: ringState(click, sec) })).filter((item) => item.ring);
  if (shown.length === 0 && rings.length === 0) return null;
  const dim = Math.max(0, ...shown.map((item) => item.visible * boxDim(item.box)));
  const pad = 8;
  const corner = 12;
  const cut = (rect: { x: number; y: number; w: number; h: number }) => roundedRectPath(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2, corner);
  return (
    <div style={{ position: 'absolute', left, top, width, height, overflow: 'hidden', borderRadius: `0 0 ${radius}px ${radius}px` }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        {dim > 0.001 ? <path d={[`M0 0H${width}V${height}H0Z`, ...shown.filter((item) => boxDim(item.box) > 0).map((item) => cut(item.rect))].join('')} fillRule="evenodd" fill={theme.color.night} opacity={dim} /> : null}
        {shown
          .filter((item) => item.box.outline !== false)
          .map((item, index) => {
            const w = item.rect.w + pad * 2;
            const h = item.rect.h + pad * 2;
            const perimeter = 2 * (w + h);
            return (
              <rect
                key={index}
                x={item.rect.x - pad}
                y={item.rect.y - pad}
                width={w}
                height={h}
                rx={corner}
                fill="none"
                stroke={theme.color.coral}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={perimeter}
                strokeDashoffset={perimeter * (1 - item.draw)}
                opacity={item.visible}
              />
            );
          })}
        {rings.map(({ click, ring }, index) => {
          const point = pushPoint(state, click);
          return (
            <g key={index} opacity={ring!.opacity}>
              {/* contorno claro por baixo: o anel lê sobre tela clara ou escura */}
              <circle cx={point.x * width} cy={point.y * height} r={ring!.radius} fill="none" stroke={theme.color.white} strokeWidth={RING.stroke + 4} opacity={0.85} />
              <circle cx={point.x * width} cy={point.y * height} r={ring!.radius} fill="none" stroke={theme.color.coral} strokeWidth={RING.stroke} />
              <circle cx={point.x * width} cy={point.y * height} r={7} fill={theme.color.coral} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export interface ScreenFocusProps {
  /** retângulos destacados, em frações da área */
  boxes?: FocusBox[];
  clicks?: ClickRing[];
  /** área do quadro onde a tela está (0–1); sem valor, o quadro inteiro */
  area?: Rect;
}

/**
 * Destaque sobre a tela gravada em tela cheia (`layout.segments` com `screen`/`pip`): escurece o entorno de um
 * retângulo, desenha o contorno coral e marca cliques. Dentro do `WindowStage`, use as props `focus` e `clicks` dele.
 */
export const ScreenFocus: React.FC<ScreenFocusProps & BaseProps> = ({ boxes, clicks, area = FULL, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <FocusLayer
        left={area.x * width}
        top={area.y * height}
        width={area.w * width}
        height={area.h * height}
        state={{ scale: 1, tx: 0, ty: 0 }}
        boxes={validBoxes(boxes)}
        clicks={validClicks(clicks)}
        sec={frame / fps}
        totalSec={durationInFrames / fps}
      />
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: ScreenFocus,
  sample: {
    boxes: [{ at: 0.4, duration: 3.2, x: 0.56, y: 0.3, w: 0.3, h: 0.22 }],
    clicks: [{ at: 1.2, x: 0.7, y: 0.42 }, { at: 2.4, x: 0.62, y: 0.36 }],
  },
  defaultDuration: 4.5,
  description:
    'Foco sobre a tela gravada em tela cheia: escurece o entorno de um retângulo (`boxes[]`, em frações da tela), desenha um contorno coral em volta e marca cada clique com um anel (`clicks[]`). Use quando a fala diz "aqui", "nesse botão", "aparece". Dentro do `WindowStage`, use as props `focus`/`clicks` dele.',
};
