/**
 * Foco do apresentador nos palcos (overlay com `presenter`), em módulo puro. O cartão lateral mostra só ~27% da
 * largura da fonte: um foco fixo copiado de outro vídeo corta o rosto. `"auto"` acha o centro do apresentador no
 * intervalo do palco (a mesma série do foco do Short) e enquadra pela proporção do slot; com foco fixo, a mesma
 * conta só confere se o rosto cabe e vira aviso no render e achado no `mce eval`.
 *
 * O footage do palco é movido pelo ffmpeg com uma transformação constante por palco (src/render/reframe.ts):
 * não há pan dentro do palco, então o apresentador que anda fica na mediana (ou no meio da faixa, se ela couber).
 */
import { coverTransform, isWindowSlot, type Point, type PresenterSlot, slotRect, slotZoom } from '../../motion/src/arsenal/stage.ts';
import type { Edl, Overlay } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';
import type { Finding } from '../eval/checks.ts';
import { DEFAULT_FOCUS_PARAMS, type FocusSample, median, type Span } from './focus.ts';

/** Foco quando não há detector nem valor na EDL (o padrão antigo do schema). */
export const DEFAULT_STAGE_FOCUS: Point = { x: 0.5, y: 0.4 };
/**
 * Meia largura / meia altura do rosto, em fração do quadro 16:9 de quem fala sentado a meio corpo (medido no
 * canal: rosto ≈ 13% da largura e 20% da altura com o cabelo), mais um respiro de 3% até a borda do cartão: com
 * menos que isso a orelha encosta na borda arredondada e o rosto lê como cortado (era o caso do focus 0.47 fixo).
 */
export const FACE_HALF: Point = { x: 0.095, y: 0.12 };
/** Faixa do rosto padrão (fração da altura), a mesma do Short: sem altura detectada, o rosto mora aqui. */
export const DEFAULT_FACE_BAND = { top: 0.3, bottom: 0.6 };
/** Parte do rosto fora do recorte (fração da largura/altura do rosto) a partir da qual vira aviso. */
export const FACE_CUT_TOLERANCE = 0.05;

/** Quanto da fonte (fração da largura e da altura) aparece dentro do buraco do slot. */
export function visibleFraction(slot: PresenterSlot, zoom: number | undefined, width: number, height: number): Point {
  const rect = slotRect(slot);
  const { scale } = coverTransform(rect, { x: 0.5, y: 0.5 }, zoom ?? slotZoom(slot), width, height);
  return { x: Math.min(1, (rect.w * width) / (width * scale)), y: Math.min(1, (rect.h * height) / (height * scale)) };
}

/** Faixa robusta do apresentador num eixo (p10–p90), quartis e o centro (mediana). */
export interface AxisTrack {
  center: number;
  low: number;
  high: number;
  /** p25 e p75: onde ele passa metade do tempo; medem o corte sem contar gesto isolado (a mão vira "rosto") */
  q1: number;
  q3: number;
}

/** Pior corte do rosto entre a mediana e os quartis: pega o apresentador que passa boa parte do palco fora do recorte. */
export function trackOutside(focus: number, visible: number, track: AxisTrack, faceHalf: number): number {
  return Math.max(...[track.center, track.q1, track.q3].map((center) => faceOutside(focus, visible, center, faceHalf)));
}

/**
 * Centro do apresentador → foco do recorte num eixo, pela fração visível `visible`. Janela larga (a faixa do
 * movimento mais o rosto cabem nela): foco no meio da faixa, o rosto fica dentro do começo ao fim. Janela estreita
 * (o cartão vertical): foco no centro exato, que é onde o rosto passa a maior parte do tempo. Em seguida, limita ao
 * que o recorte alcança sem descobrir a borda (a mesma conta de `coverTransform`).
 */
export function centerToStageFocus(track: AxisTrack, visible: number, faceHalf: number): number {
  if (visible >= 1) return 0.5;
  const fits = track.high - track.low + 2 * faceHalf <= visible;
  const target = fits ? (track.low + track.high) / 2 : track.center;
  const half = visible / 2;
  return Math.min(1 - half, Math.max(half, target));
}

/** Onde o recorte realmente fica: o foco limitado ao que a fonte alcança. */
export function windowSpan(focus: number, visible: number): Span {
  const half = Math.min(0.5, visible / 2);
  const center = Math.min(1 - half, Math.max(half, focus));
  return { start: center - half, end: center + half };
}

/** Fração do rosto (0–1) que fica fora do recorte num eixo: rosto = `center ± faceHalf`. */
export function faceOutside(focus: number, visible: number, center: number, faceHalf: number): number {
  if (visible >= 1) return 0;
  const span = windowSpan(focus, visible);
  const face = { start: center - faceHalf, end: center + faceHalf };
  const inside = Math.max(0, Math.min(span.end, face.end) - Math.max(span.start, face.start));
  return 1 - inside / (face.end - face.start);
}

/** Trechos da FONTE que o palco cobre: o intervalo de saída do overlay, de volta pela timeline. */
export function stageSourceSpans(timeline: Timeline, overlay: Pick<Overlay, 'at' | 'duration'>): Span[] {
  const start = sourceToOutput(timeline, overlay.at);
  if (start === null) return [];
  const end = start + overlay.duration;
  return timeline.clips.flatMap((clip) => {
    const from = Math.max(start, clip.outputStart);
    const to = Math.min(end, clip.outputEnd);
    return to - from > 1e-6 ? [{ start: clip.sourceStart + (from - clip.outputStart), end: clip.sourceStart + (to - clip.outputStart) }] : [];
  });
}

function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (pos - low);
}

export function axisTrack(values: readonly number[]): AxisTrack | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return { center: median(sorted), low: quantile(sorted, 0.1), high: quantile(sorted, 0.9), q1: quantile(sorted, 0.25), q3: quantile(sorted, 0.75) };
}

export interface StageFocusPlan {
  id: string;
  slot: PresenterSlot;
  /** segundos do vídeo final (sem vinheta) em que o palco começa */
  out: number;
  /** foco que o render usa */
  focus: Point;
  /** `auto` = calculado aqui; `fixed` = número da EDL */
  mode: 'auto' | 'fixed';
  /** onde o apresentador está (null = sem amostra confiável no intervalo) */
  presenter: { x: AxisTrack; y: AxisTrack | null } | null;
  visible: Point;
  /** fração do rosto fora do recorte, por eixo, com o foco usado */
  cut: Point;
  /** amostras usadas */
  samples: number;
}

export interface StageFocusOptions {
  /** fração da altura onde o rosto fica quando o detector não deu a altura (shorts.faceBand) */
  faceBand?: { top: number; bottom: number };
  minConfidence?: number;
}

/**
 * Resolve o foco de cada palco de footage com apresentador (os slots `window` mostram o footage inteiro e
 * ficam de fora). Foco `"auto"` vira ponto; foco fixo passa direto, com a medida de quanto do rosto ele corta.
 */
export function planStageFocus(
  edl: Pick<Edl, 'overlays' | 'output'> & { shorts?: { faceBand?: { top: number; bottom: number } } | null },
  timeline: Timeline,
  samples: readonly FocusSample[] | null,
  options: StageFocusOptions = {},
): StageFocusPlan[] {
  const { width, height } = edl.output;
  const band = options.faceBand ?? edl.shorts?.faceBand ?? DEFAULT_FACE_BAND;
  const minConfidence = options.minConfidence ?? DEFAULT_FOCUS_PARAMS.minConfidence;
  const plans: StageFocusPlan[] = [];
  for (const overlay of edl.overlays) {
    const presenter = overlay.presenter;
    if (!presenter || overlay.layer === 'persistent' || isWindowSlot(presenter.slot)) continue;
    if (overlay.component === 'WindowStage' && overlay.props.kind === 'footage') continue;
    const out = sourceToOutput(timeline, overlay.at);
    if (out === null) continue;
    const spans = stageSourceSpans(timeline, overlay);
    const kept = (samples ?? []).filter((sample) => sample.confidence >= minConfidence && spans.some((span) => sample.t >= span.start && sample.t <= span.end));
    // o rosto do detector quando ele o achou na maioria das amostras; senão, o centro do apresentador e a faixa do rosto do Short
    const faces = kept.flatMap((sample) => (sample.face ? [sample.face] : []));
    const byFace = faces.length > 0 && faces.length >= kept.length / 2;
    const x = axisTrack(byFace ? faces.map((face) => face.x) : kept.map((sample) => sample.x));
    const y = byFace ? axisTrack(faces.map((face) => face.y)) : null;
    const bandCenter = (band.top + band.bottom) / 2;
    const yTrack = y ?? { center: bandCenter, low: band.top + FACE_HALF.y, high: band.bottom - FACE_HALF.y, q1: bandCenter, q3: bandCenter };
    const visible = visibleFraction(presenter.slot, presenter.zoom, width, height);
    const auto = presenter.focus === 'auto';
    const focus: Point = auto
      ? x
        ? { x: centerToStageFocus(x, visible.x, FACE_HALF.x), y: centerToStageFocus(yTrack, visible.y, FACE_HALF.y) }
        : DEFAULT_STAGE_FOCUS
      : (presenter.focus as Point);
    const cut = x ? { x: trackOutside(focus.x, visible.x, x, FACE_HALF.x), y: trackOutside(focus.y, visible.y, yTrack, FACE_HALF.y) } : { x: 0, y: 0 };
    plans.push({
      id: overlay.id,
      slot: presenter.slot,
      out,
      focus: { x: round4(focus.x), y: round4(focus.y) },
      mode: auto ? 'auto' : 'fixed',
      presenter: x ? { x, y } : null,
      visible,
      cut,
      samples: kept.length,
    });
  }
  return plans;
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

/** Mapa id → foco para `buildOverlayProps`. */
export function stageFocusMap(plans: readonly StageFocusPlan[]): Map<string, Point> {
  return new Map(plans.map((plan) => [plan.id, plan.focus]));
}

const cutsFace = (plan: StageFocusPlan) => Math.max(plan.cut.x, plan.cut.y) > FACE_CUT_TOLERANCE;

/** Linhas para o log do render: um resumo por palco auto e um aviso por rosto cortado. */
export function formatStageFocus(plans: readonly StageFocusPlan[]): string[] {
  const lines: string[] = [];
  for (const plan of plans) {
    const where = `palco ${plan.id} (${plan.slot})`;
    if (plan.mode === 'auto') {
      lines.push(
        plan.presenter
          ? `foco auto: ${where} em x=${plan.focus.x.toFixed(3)} y=${plan.focus.y.toFixed(3)} (apresentador ${plan.presenter.x.low.toFixed(2)}–${plan.presenter.x.high.toFixed(2)}, ${plan.samples} amostras)`
          : `aviso: foco auto do ${where} sem amostra do apresentador; usando ${DEFAULT_STAGE_FOCUS.x}/${DEFAULT_STAGE_FOCUS.y}`,
      );
    }
    if (cutsFace(plan)) lines.push(`aviso: ${where} corta ${(Math.max(plan.cut.x, plan.cut.y) * 100).toFixed(0)}% do rosto com focus ${plan.focus.x}/${plan.focus.y}${plan.mode === 'fixed' ? '; use "focus": "auto"' : ''}`);
  }
  return lines;
}

/**
 * Achado `rosto-fora-do-palco`: o recorte do cartão deixa parte do rosto (centro detectado ± meia largura) de
 * fora. Foco fixo é erro (o conserto é trocar por `"auto"`); foco auto que ainda corta é o apresentador andando
 * mais que a janela, aviso para o diretor olhar o quadro.
 */
export function findFaceOutOfStage(plans: readonly StageFocusPlan[]): Finding[] {
  return plans.filter(cutsFace).map((plan) => {
    const axis = plan.cut.x >= plan.cut.y ? 'x' : 'y';
    const pct = (Math.max(plan.cut.x, plan.cut.y) * 100).toFixed(0);
    const center = axis === 'x' ? plan.presenter!.x.center : (plan.presenter!.y?.center ?? null);
    return {
      severity: plan.mode === 'fixed' ? ('error' as const) : ('warning' as const),
      check: 'rosto-fora-do-palco',
      at: plan.out,
      message: `palco "${plan.id}" (${plan.slot}) corta ${pct}% do rosto no eixo ${axis}: focus.${axis} = ${plan.focus[axis]}${center === null ? '' : `, apresentador em ${center.toFixed(3)}`}`,
      fix:
        plan.mode === 'fixed'
          ? `troque o focus do presenter "${plan.id}" por "auto" (ou omita): o render enquadra pelo detector`
          : `o apresentador se mexe mais que a janela do slot ${plan.slot}: use um slot mais largo (pip-*) ou divida o palco`,
    };
  });
}
