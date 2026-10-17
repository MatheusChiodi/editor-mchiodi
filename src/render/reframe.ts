import {
  type FootageTransform,
  IDENTITY,
  normalizePushes,
  type PlacedPush,
  pushWeights,
  screenSpan,
  slotRect,
  slotTransform,
  type StagePlan,
  stageRamps,
  windowBodyRect,
  windowSide,
} from '../../motion/src/arsenal/stage.ts';
import type { OverlayItem } from '../../motion/src/types.ts';
import { BRAND } from '../arsenal/effects.ts';
import type { PlacedLayout } from './layout.ts';

export interface PlacedStage {
  /** segundos do vídeo final, na grade de frames da camada de gráficos */
  start: number;
  end: number;
  plan: StagePlan;
}

/** Palcos (overlays com `presenter`) no tempo de saída, a partir dos mesmos frames que o Remotion usa. */
export function placeStages(items: OverlayItem[], fps: number): PlacedStage[] {
  return items
    .filter((item) => item.stage)
    .map((item) => ({ start: item.from / fps, end: (item.from + item.durationInFrames) / fps, plan: item.stage! }))
    .sort((a, b) => a.start - b.start);
}

// 6 casas: o instante de um frame (n/30) não pode arredondar para o frame vizinho
const fixed = (value: number) => Number(value.toFixed(6)).toString();
const signed = (value: number) => (value < 0 ? `(${fixed(value)})` : fixed(value));

/** Progresso linear 0→1 que começa em `startSec` e dura `durationSec`, como expressão do ffmpeg em `t`. */
export function rampExpr(startSec: number, durationSec: number): string {
  return `clip((t-${fixed(startSec)})/${fixed(durationSec)},0,1)`;
}

/**
 * A curva da troca (`easeInOut` de motion/src/arsenal/stage.ts, equivalente a `cubic-bezier(0.65, 0, 0.35, 1)`)
 * aplicada a um progresso `p` já limitado a 0–1. Mesma forma fechada dos dois lados; o teste compara frame a frame.
 */
export function curveExpr(p: string): string {
  return `(lt(${p},0.5)*4*pow(${p},3)+gte(${p},0.5)*(1-pow(2-2*${p},3)/2))`;
}

/** Envelope de um push (entra e, se tiver volta, sai) em `t`; `originSec` é o início do overlay no vídeo final. */
export function pushEnvelopeExpr(push: PlacedPush, originSec: number): string {
  const enter = curveExpr(rampExpr(originSec + push.at, push.inSec));
  return push.outAt === null ? enter : `(${enter}-${curveExpr(rampExpr(originSec + push.outAt, push.outSec))})`;
}

/** Soma de `peso × envelope` dos pushes; `0` quando não há nenhum. */
export function pushSumExpr(pushes: readonly PlacedPush[], originSec: number, weight: (push: PlacedPush) => number): string {
  const terms = pushes.map((push) => `${signed(weight(push))}*${pushEnvelopeExpr(push, originSec)}`);
  return terms.length ? terms.join('+') : '0';
}

/**
 * Um parâmetro da transformação ao longo do palco, como expressão do ffmpeg em `t`: parte de `from`,
 * pousa em `to` (mais o que os pushes somam, `pushed`) e volta ao repouso `rest`, na curva da troca.
 * É a mesma conta de `transformAt` em motion/src/arsenal/stage.ts; o teste compara as duas.
 */
export function stageTermExpr(stage: PlacedStage, from: number, to: number, rest: number, pushed = ''): string {
  const duration = stage.end - stage.start;
  const ramps = stageRamps(duration, stage.plan.transitionSec);
  // fim exclusivo: dois palcos colados nunca somam no frame da emenda
  const active = `gte(t,${fixed(stage.start)})*lt(t,${fixed(stage.end)})`;
  const enter = curveExpr(rampExpr(stage.start, ramps.enter));
  const travel = pushed ? `(${signed(to - from)}+${pushed})` : signed(to - from);
  const landed = `(${signed(from)}+${travel}*${enter})`;
  if (stage.plan.holdExit) return `${active}*(${landed}-${signed(rest)})`;
  const exit = curveExpr(rampExpr(stage.end - ramps.exit, ramps.exit));
  return `${active}*(${landed}-${signed(rest)})*(1-${exit})`;
}

/** Escala e posição do footage em função de `t`, somando todos os palcos (eles não se sobrepõem). */
export function stageExpressions(stages: PlacedStage[], width: number, height: number): { scale: string; x: string; y: string; active: string } {
  const sum = (key: keyof FootageTransform) =>
    stages
      .map((stage) => {
        const from = stage.plan.from ? slotTransform(stage.plan.from, width, height) : IDENTITY;
        const to = slotTransform(stage.plan, width, height);
        const pushes = stage.plan.pushes ?? [];
        const pushed = pushes.length ? pushSumExpr(pushes, stage.start, (push) => pushWeights(to, slotRect(stage.plan.slot), push, width, height)[key]) : '';
        return stageTermExpr(stage, from[key], to[key], IDENTITY[key], pushed);
      })
      .join('+');
  return {
    scale: `(1+${sum('scale')})`,
    x: `(${sum('x')})`,
    y: `(${sum('y')})`,
    active: stages.map((stage) => `gte(t,${fixed(stage.start)})*lt(t,${fixed(stage.end)})`).join('+'),
  };
}

/**
 * Reenquadra o footage durante os palcos: escala por frame e pousa sobre um fundo paper na posição do
 * cartão (ou do corpo da janela, com os zooms). Fora dos palcos o quadro passa intacto. É um sub-grafo de
 * uma entrada e uma saída, então vale como um item da cadeia de filtros do vídeo.
 */
export function reframeFilters(stages: PlacedStage[], width: number, height: number): string[] {
  if (stages.length === 0) return [];
  const { scale, x, y, active } = stageExpressions(stages, width, height);
  return [
    [
      'split=3[rfa][rfb][rfc]',
      `[rfc]drawbox=x=0:y=0:w=iw:h=ih:color=0x${BRAND.paper.slice(1)}:t=fill[rfp]`,
      `[rfb]scale=w='trunc(${width}*${scale}/2)*2':h='trunc(${height}*${scale}/2)*2':eval=frame:flags=bicubic[rfs]`,
      `[rfp][rfs]overlay=x='${x}':y='${y}':eval=frame[rfl]`,
      `[rfa][rfl]overlay=enable='${active}'`,
    ].join(';'),
  ];
}

/**
 * Overlays `WindowStage` com `kind: "screen"`: a gravação de tela entra no corpo da janela (espelhada quando
 * o apresentador está à esquerda), só enquanto a tampa está aberta, e com os zooms pedidos em `push`.
 */
export function windowLayouts(items: OverlayItem[], fps: number): PlacedLayout[] {
  return items
    .filter((item) => item.component === 'WindowStage' && item.props.kind === 'screen')
    .map((item) => {
      const origin = item.from / fps;
      const duration = item.durationInFrames / fps;
      const span = screenSpan(item.stage, duration, { component: 'WindowStage', kind: 'screen' });
      const pushes = normalizePushes(item.props.push, duration);
      return {
        start: origin + span.openAt,
        end: origin + span.closeAt,
        mode: 'window' as const,
        pipCorner: 'bottom-right' as const,
        rect: windowBodyRect(windowSide(item.stage?.slot, item.props.mirror === true), true),
        ...(pushes.length ? { pushes, origin } : {}),
      };
    });
}
