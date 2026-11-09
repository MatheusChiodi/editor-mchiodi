/**
 * Footage do preview: traduz o quadro calculado por src/render/footage-frame.ts (as contas do render) em CSS.
 * Duas camadas: `stage` (o quadro inteiro encolhido para a caixa do palco, sobre papel) e `video` (zoom da EDL,
 * zooms de ajuste e efeitos de câmera dentro do quadro; o `stage` recorta o que sobra, como o `crop` do render).
 */
import { BRAND } from '../../../src/arsenal/effects.ts';
import type { Footprints } from '../../../src/edl/fit.ts';
import { withFit } from '../../../src/edl/fit.ts';
import type { Edl, Grade } from '../../../src/edl/schema.ts';
import { sourceToOutput, type Timeline } from '../../../src/edl/timeline.ts';
import { footageFrameAt, type FootageFrame, type FootageInput } from '../../../src/render/footage-frame.ts';
import { placeEffects } from '../../../src/render/effects.ts';
import { placeStages } from '../../../src/render/reframe.ts';
import { gradeCss, placeZooms } from '../../../src/render/video.ts';
import type { GuardPayload } from '../../../src/cut/guard.ts';
import type { OverlayItem } from '../../../motion/src/types.ts';

export interface LayerCss {
  transform: string;
  transformOrigin: string;
  background?: string;
}

export interface FootageCss {
  stage: LayerCss;
  video: LayerCss & { filter: string };
  /** efeitos `filter` ativos que o preview não reproduz (cor, luz, glitch…) */
  uncovered: string[];
}

const px = (value: number) => `${Math.round(value * 100) / 100}px`;
const num = (value: number) => String(Math.round(value * 1e6) / 1e6);

/** Entrada do quadro: os mesmos zooms (EDL + ajuste do servidor), efeitos e palcos que o render usa. */
export function footageInput(edl: Edl, timeline: Timeline, overlays: readonly OverlayItem[], guard: Pick<GuardPayload, 'zooms'> | null, footprints: Footprints): FootageInput {
  // sem o plano do servidor ainda, o ajuste é o de footprints com o rosto padrão (withFit); com ele, o do detector
  const zooms = guard ? [...edl.zooms.filter((zoom) => !zoom.id.startsWith('fit-')), ...guard.zooms] : withFit(edl, footprints).zooms;
  return {
    zooms: placeZooms(zooms, timeline),
    effects: placeEffects(edl.effects, timeline),
    stages: placeStages([...overlays], edl.output.fps),
    width: edl.output.width,
    height: edl.output.height,
    fps: edl.output.fps,
  };
}

export function frameCss(frame: FootageFrame, size: { width: number; height: number }, boxWidth: number, grade: Grade): FootageCss {
  const k = boxWidth / size.width;
  const { inner, stage } = frame;
  const identity = inner.sx === 1 && inner.sy === 1 && inner.tx === 0 && inner.ty === 0;
  return {
    stage: stage
      ? {
          transform: `translate(${px(stage.x * k)}, ${px(stage.y * k)}) scale(${num(stage.w / size.width)}, ${num(stage.h / size.height)})`,
          transformOrigin: '0 0',
          background: BRAND.paper,
        }
      : { transform: 'none', transformOrigin: '0 0', background: 'transparent' },
    video: {
      transform: identity ? 'none' : `translate(${px(inner.tx * k)}, ${px(inner.ty * k)}) scale(${num(inner.sx)}, ${num(inner.sy)})`,
      transformOrigin: '0 0',
      filter: gradeCss(grade),
    },
    uncovered: frame.uncovered,
  };
}

/** CSS do footage em `source` (segundos da fonte); `none` quando o instante foi cortado. */
export function footageCssAt(input: FootageInput, timeline: Timeline, source: number, boxWidth: number, grade: Grade): FootageCss {
  const output = sourceToOutput(timeline, source);
  const size = { width: input.width, height: input.height };
  if (output === null) return frameCss({ inner: { sx: 1, sy: 1, tx: 0, ty: 0 }, stage: null, uncovered: [] }, size, boxWidth, grade);
  return frameCss(footageFrameAt(input, output), size, boxWidth, grade);
}
