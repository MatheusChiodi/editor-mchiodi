/**
 * Palco: layouts em que o FOOTAGE é reenquadrado (apresentador num cartão sobre papel, ou o footage inteiro
 * dentro de uma janela) e a troca entre eles. Módulo puro, sem Remotion nem Node: o ffmpeg (que move o
 * footage) e a camada de gráficos (que desenha o papel com o buraco) calculam a mesma geometria e as mesmas
 * curvas a partir daqui, e por isso andam juntos frame a frame.
 */

export type PresenterSlot = 'right' | 'left' | 'pip-br' | 'pip-bl' | 'pip-tr' | 'pip-tl' | 'window' | 'window-right';
export const PRESENTER_SLOTS: readonly PresenterSlot[] = ['right', 'left', 'pip-br', 'pip-bl', 'pip-tr', 'pip-tl', 'window', 'window-right'];

export type StageBackdrop = 'paper' | 'night' | 'none';
export type OverlayWipe = 'none' | 'tear';

/** Retângulo normalizado (0–1) em relação ao quadro. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Gramática de movimento do palco, medida a 30 fps em 720p na referência do nível max
 * (docs/referencia-max/movimento-hd.md). Durações em segundos (frames / 30), distâncias em px de um quadro
 * de 1080 de altura. É a única tabela: componentes, camada de gráficos e ffmpeg leem daqui.
 */
export const stageMotion = {
  /**
   * Troca de layout (o retângulo do apresentador): 27 f nas duas direções, curva `easeInOut`.
   * Para a versão mais seca, troque aqui (ex.: `inSec: 0.5, outSec: 0.4`) ou use `presenter.transitionSec` no overlay.
   */
  layout: { inSec: 27 / 30, outSec: 27 / 30 },
  /** cartão do apresentador: raio e borda (a borda cresce de 0 com o progresso da troca) */
  presenterCard: { radius: 34, border: 5 },
  /** o conteúdo novo só começa a entrar com a troca em andamento (a referência corta no frame 5–10) */
  contentDelaySec: 8 / 30,
  /** piso de opacidade do elemento-âncora na emenda de dois palcos colados: o conteúdo cruza sem frame vazio */
  swapFloor: 0.35,
  pill: { sec: 10 / 30, rise: 26, scaleFrom: 0.92 },
  /** cartão de fileira */
  tile: { sec: 10 / 30, rise: 51 },
  /** cartão grande / recorte de documento */
  doc: { sec: 10 / 30, rise: 66 },
  /** janela (troca de conteúdo) */
  window: { sec: 10 / 30, rise: 36, scaleFrom: 0.9 },
  /** palavra de título/frase serifada: opacidade em 10 f; o Y fica parado 2 f e desce; blur nos 3 primeiros */
  word: { sec: 10 / 30, stepSec: 3.5 / 30, minGapSec: 3 / 30, holdSec: 2 / 30, settleSec: 8 / 30, blurSec: 3 / 30, blurPx: 9, riseTitle: 20, risePhrase: 36 },
  eyebrow: { sec: 10 / 30, leadSec: 3 / 30 },
  /**
   * saída de grupo: 8 f visíveis; coreografada: cada item em 7 f, 2 f de defasagem, o último a entrar sai primeiro;
   * voltando à tela cheia, o conteúdo fica parado os primeiros 4 f da troca (na referência, até o frame 4–10)
   */
  exit: { sec: 8 / 30, itemSec: 7 / 30, staggerSec: 2 / 30, lagSec: 4 / 30 },
  /** zoom na janela: 36 f para entrar, 27 f para voltar, padrão 1,25 */
  push: { inSec: 36 / 30, outSec: 27 / 30, scale: 1.25, maxScale: 3 },
  /** rasgo de papel: 11 f, easeInOutQuad, ~11 dentes de 4,8% da largura */
  tear: { sec: 11 / 30, teeth: 11, depth: 4.8 },
  /** destaque na tela gravada (melhoria sobre a referência): escurecer, contorno desenhado, anel de clique */
  focus: { dim: 0.58, fadeSec: 8 / 30, outlineSec: 10 / 30, ringSec: 10 / 30 },
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, k: number) => from + (to - from) * k;

/**
 * A curva única da referência, `cubic-bezier(0.65, 0, 0.35, 1)`, na forma fechada equivalente (easeInOutCubic):
 * assim o ffmpeg avalia exatamente a mesma conta que o Remotion (uma bezier não cabe numa expressão).
 */
export const easeInOut = (p: number) => {
  const k = clamp01(p);
  return k < 0.5 ? 4 * k ** 3 : 1 - (2 - 2 * k) ** 3 / 2;
};
export const easeInOutQuad = (p: number) => {
  const k = clamp01(p);
  return k < 0.5 ? 2 * k * k : 1 - (2 - 2 * k) ** 2 / 2;
};
/** entradas de pílula e cartão: desaceleram sem ultrapassar o alvo */
export const easeOutQuad = (p: number) => 1 - (1 - clamp01(p)) ** 2;
export const easeOut = (p: number) => 1 - (1 - clamp01(p)) ** 3;
export const easeIn = (p: number) => clamp01(p) ** 3;

export interface PushSpec {
  /** segundos, relativos ao início do overlay */
  at: number;
  scale?: number;
  /** ponto da janela (0–1) que fica parado enquanto ela cresce: o alvo */
  x?: number;
  y?: number;
  /** segundos em zoom antes de voltar; sem valor, fica até o próximo push ou até o fim */
  hold?: number;
}

export interface PlacedPush {
  at: number;
  inSec: number;
  scale: number;
  x: number;
  y: number;
  /** início da volta; null = fica em zoom até o fim do overlay */
  outAt: number | null;
  outSec: number;
}

/** Estado do conteúdo da janela: escala e deslocamento (em frações do corpo da janela, sempre ≤ 0). */
export interface PushState {
  scale: number;
  tx: number;
  ty: number;
}

/**
 * Lista de zooms na ordem do tempo. Quando um push começa antes de o anterior voltar, os dois se cruzam
 * (o anterior sai na mesma curva e duração em que o novo entra): vira um pan suave de um alvo ao outro.
 */
export function normalizePushes(push: unknown, durationSec: number): PlacedPush[] {
  const list = (Array.isArray(push) ? push : push ? [push] : []) as Partial<PushSpec>[];
  const number = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  const valid = list
    .filter((item) => item && typeof item === 'object' && typeof item.at === 'number' && Number.isFinite(item.at) && item.at >= 0 && item.at < durationSec)
    .sort((a, b) => a.at! - b.at!);
  const { inSec, outSec, scale, maxScale } = stageMotion.push;
  return valid.map((item, index) => {
    const next = valid[index + 1];
    const natural = typeof item.hold === 'number' && Number.isFinite(item.hold) ? item.at! + inSec + Math.max(0, item.hold) : null;
    const crossed = next !== undefined && (natural === null || natural + outSec > next.at!);
    return {
      at: item.at!,
      inSec,
      scale: Math.min(maxScale, Math.max(1, number(item.scale, scale))),
      x: clamp01(number(item.x, 0.5)),
      y: clamp01(number(item.y, 0.5)),
      outAt: crossed ? next!.at! : natural,
      outSec: crossed ? inSec : outSec,
    };
  });
}

/** Quanto do push está aplicado (0–1) em `sec`: entra e, se tiver volta, sai na mesma curva. */
export function pushEnvelope(push: PlacedPush, sec: number): number {
  return easeInOut((sec - push.at) / push.inSec) - (push.outAt === null ? 0 : easeInOut((sec - push.outAt) / push.outSec));
}

/** Soma dos pushes em `sec`. É combinação de estados que cobrem o corpo da janela, então cobre sempre. */
export function pushAt(pushes: readonly PlacedPush[], sec: number): PushState {
  let scale = 1;
  let tx = 0;
  let ty = 0;
  for (const push of pushes) {
    const k = pushEnvelope(push, sec) * (push.scale - 1);
    scale += k;
    tx -= push.x * k;
    ty -= push.y * k;
  }
  return { scale, tx, ty };
}

/** Ponto do conteúdo (0–1) → ponto do corpo da janela (0–1) com o zoom aplicado. */
export function pushPoint(state: PushState, point: Point): Point {
  return { x: point.x * state.scale + state.tx, y: point.y * state.scale + state.ty };
}

export interface PresenterSpec {
  slot: PresenterSlot;
  /** onde está o rosto no footage (0–1) */
  focus: Point;
  /** aproximação além do mínimo que cobre o cartão; sem valor, a padrão do slot */
  zoom?: number;
  backdrop: StageBackdrop;
  /** duração (s) da troca de layout deste palco; sem valor, `stageMotion.layout` */
  transitionSec?: number;
}

export interface StageNeighbor {
  slot: PresenterSlot;
  focus: Point;
  zoom?: number;
  /** componente e variante (`props.kind`) do palco vizinho: o mesmo palco colado mantém a moldura */
  component?: string;
  kind?: string;
}

/** O que a camada de gráficos e o ffmpeg precisam para animar um palco. */
export interface StagePlan extends PresenterSpec {
  /** slot do palco imediatamente anterior: o cartão desliza de lá em vez de nascer da tela cheia */
  from: StageNeighbor | null;
  /** o palco seguinte começa colado neste: o cartão fica onde está em vez de voltar à tela cheia */
  holdExit: boolean;
  /** o palco seguinte, quando colado */
  next?: Pick<StageNeighbor, 'slot' | 'component' | 'kind'> | null;
  /** zooms do footage dentro do buraco (slots `window`): somados à transformação pousada */
  pushes?: PlacedPush[];
}

export const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** segundos da troca de layout (padrão); ver `stageMotion.layout` */
export const STAGE_IN = stageMotion.layout.inSec;
export const STAGE_OUT = stageMotion.layout.outSec;
/** raio do cartão, em px de um quadro de 1080 de altura */
export const CARD_RADIUS = stageMotion.presenterCard.radius;
/** sobra de escala para o footage nunca deixar fresta na borda do buraco (arredondamento para pixel par) */
const COVER_MARGIN = 1.006;

// medidas em 720p (design-hd §2.5): canto 21,4% × 36,2% com margens 2,9% / 5,1%; cartão 24,3% × 89,9% a 1,8% da borda
const PIP = { w: 0.214, h: 0.362, marginX: 0.029, marginY: 0.051 };
const CARD = { w: 0.243, h: 0.899, marginX: 0.018 };

/** Janela flutuante do `WindowStage` (medida: x 3,7–74,4%, y 8,3–87,9%, raio 19). `bar` é a barra de título. */
export const WINDOW = { x: 0.037, y: 0.083, w: 0.707, h: 0.796, bar: 0.045, radius: 19 };

export type WindowSide = 'left' | 'right';

export const isWindowSlot = (slot: PresenterSlot | null | undefined): boolean => slot === 'window' || slot === 'window-right';

/**
 * De que lado a janela fica: espelha (janela à direita) quando o apresentador está do lado esquerdo,
 * para o canto nunca cair sobre ela. Sem palco, vale `mirror`.
 */
export function windowSide(slot: PresenterSlot | null | undefined, mirror = false): WindowSide {
  if (!slot) return mirror ? 'right' : 'left';
  return slot === 'pip-bl' || slot === 'pip-tl' || slot === 'left' || slot === 'window-right' ? 'right' : 'left';
}

/**
 * Moldura da janela. Com `media` (gravação de tela ou footage dentro dela) o corpo tem a proporção do quadro,
 * para a tela caber inteira sem faixas; a janela fica um pouco mais baixa e centrada na mesma faixa.
 */
export function windowRect(side: WindowSide = 'left', media = false): Rect {
  const h = media ? WINDOW.w + WINDOW.bar : WINDOW.h;
  return { x: side === 'right' ? 1 - WINDOW.x - WINDOW.w : WINDOW.x, y: WINDOW.y + (WINDOW.h - h) / 2, w: WINDOW.w, h };
}

/** Corpo (área útil) da janela, por onde a gravação de tela ou o footage aparece. */
export function windowBodyRect(side: WindowSide = 'left', media = true): Rect {
  const rect = windowRect(side, media);
  return { x: rect.x, y: rect.y + WINDOW.bar, w: rect.w, h: rect.h - WINDOW.bar };
}

/** Coluna ao lado da janela onde as pílulas de anotação empilham, desviando do canto do apresentador. */
export function noteColumn(side: WindowSide, slot: PresenterSlot | null | undefined): Rect {
  const gap = 0.014;
  const margin = 0.02;
  const w = 1 - WINDOW.x - WINDOW.w - gap - margin;
  let top = WINDOW.y + 0.012;
  let bottom = WINDOW.y + WINDOW.h;
  if (slot && slot.startsWith('pip-')) {
    const pip = slotRect(slot);
    if (slot.startsWith('pip-b')) bottom = pip.y - 0.03;
    else top = pip.y + pip.h + 0.04;
  }
  return { x: side === 'left' ? WINDOW.x + WINDOW.w + gap : margin, y: top, w, h: bottom - top };
}

/** Onde o cartão do apresentador (ou o footage, nos slots `window`) fica em cada slot. */
export function slotRect(slot: PresenterSlot): Rect {
  switch (slot) {
    case 'right':
      return { x: 1 - CARD.marginX - CARD.w, y: (1 - CARD.h) / 2, w: CARD.w, h: CARD.h };
    case 'left':
      return { x: CARD.marginX, y: (1 - CARD.h) / 2, w: CARD.w, h: CARD.h };
    case 'window':
      return windowBodyRect('left', true);
    case 'window-right':
      return windowBodyRect('right', true);
    default: {
      const right = slot.endsWith('r');
      const bottom = slot.startsWith('pip-b');
      return {
        x: right ? 1 - PIP.marginX - PIP.w : PIP.marginX,
        y: bottom ? 1 - PIP.marginY - PIP.h : PIP.marginY,
        w: PIP.w,
        h: PIP.h,
      };
    }
  }
}

/** Aproximação padrão (medida): o cartão vertical é "cover" puro; o canto aproxima 1,6× no rosto; a janela mostra o footage inteiro. */
export function slotZoom(slot: PresenterSlot): number {
  return slot.startsWith('pip-') ? 1.6 : 1;
}

/** Raios [topo-esq, topo-dir, base-dir, base-esq] e borda do buraco pousado: o cartão é todo arredondado; a janela, só embaixo. */
export function slotFrame(slot: PresenterSlot): { radii: [number, number, number, number]; border: number } {
  if (isWindowSlot(slot)) return { radii: [0, 0, WINDOW.radius, WINDOW.radius], border: 0 };
  const r = stageMotion.presenterCard.radius;
  return { radii: [r, r, r, r], border: stageMotion.presenterCard.border };
}

/** Faixa do quadro que sobra para o conteúdo quando o apresentador ocupa um cartão lateral. */
export function contentRect(slot: PresenterSlot | null): Rect {
  if (slot === 'right') return { x: 0, y: 0, w: 1 - CARD.w - CARD.marginX * 2, h: 1 };
  if (slot === 'left') return { x: CARD.w + CARD.marginX * 2, y: 0, w: 1 - CARD.w - CARD.marginX * 2, h: 1 };
  return FULL;
}

/** Durações de entrada e saída da troca: num palco curto, cada uma fica com no máximo um terço. */
export function stageRamps(durationSec: number, transitionSec?: number): { enter: number; exit: number } {
  const custom = typeof transitionSec === 'number' && Number.isFinite(transitionSec) && transitionSec > 0 ? transitionSec : null;
  return {
    enter: Math.min(custom ?? stageMotion.layout.inSec, durationSec / 3),
    exit: Math.min(custom ?? stageMotion.layout.outSec, durationSec / 3),
  };
}

/** Progresso da entrada (0→1) e da saída (0→1) em `sec` segundos depois do início do palco, na curva da troca. */
export function stageProgress(sec: number, durationSec: number, holdExit = false, transitionSec?: number): { enter: number; exit: number } {
  const ramps = stageRamps(durationSec, transitionSec);
  return {
    enter: easeInOut(sec / ramps.enter),
    exit: holdExit ? 0 : easeInOut((sec - (durationSec - ramps.exit)) / ramps.exit),
  };
}

export function lerpRect(from: Rect, to: Rect, k: number): Rect {
  return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), w: lerp(from.w, to.w, k), h: lerp(from.h, to.h, k) };
}

export interface Hole {
  rect: Rect;
  /** raio da base (px de 1080): o mesmo dos quatro cantos no cartão */
  radius: number;
  /** [topo-esq, topo-dir, base-dir, base-esq] */
  radii: [number, number, number, number];
  /** espessura da borda clara (px de 1080): cresce de 0 junto com a troca */
  border: number;
}

/** Buraco por onde o footage aparece: sai do retângulo de origem, pousa no slot e, na saída, volta à tela cheia. */
export function holeAt(plan: Pick<StagePlan, 'slot' | 'from' | 'holdExit' | 'transitionSec'>, sec: number, durationSec: number): Hole {
  const { enter, exit } = stageProgress(sec, durationSec, plan.holdExit, plan.transitionSec);
  const landed = lerpRect(plan.from ? slotRect(plan.from.slot) : FULL, slotRect(plan.slot), enter);
  const to = slotFrame(plan.slot);
  const from = plan.from ? slotFrame(plan.from.slot) : { radii: [0, 0, 0, 0] as [number, number, number, number], border: 0 };
  const mix = (a: number, b: number) => lerp(a, b, enter) * (1 - exit);
  const radii = to.radii.map((value, index) => mix(from.radii[index]!, value)) as [number, number, number, number];
  return { rect: lerpRect(landed, FULL, exit), radius: radii[2], radii, border: mix(from.border, to.border) };
}

export interface FootageTransform {
  /** fator de escala do footage */
  scale: number;
  /** canto superior esquerdo do footage escalado, em px do quadro */
  x: number;
  y: number;
}

export const IDENTITY: FootageTransform = { scale: 1, x: 0, y: 0 };

/**
 * Escala e posição que fazem o footage cobrir o retângulo com o foco (o rosto) no centro dele.
 * O que sobra para fora fica escondido atrás do papel.
 */
export function coverTransform(rect: Rect, focus: Point, zoom: number, width: number, height: number): FootageTransform {
  const box = { x: rect.x * width, y: rect.y * height, w: rect.w * width, h: rect.h * height };
  const scale = Math.max(box.w / width, box.h / height) * Math.max(1, zoom) * COVER_MARGIN;
  const place = (start: number, size: number, full: number, at: number) =>
    // o foco vai para o centro, sem deixar o footage descobrir nenhuma borda do retângulo
    Math.min(start, Math.max(start + size - full * scale, start + size / 2 - at * full * scale));
  return { scale, x: place(box.x, box.w, width, focus.x), y: place(box.y, box.h, height, focus.y) };
}

export function slotTransform(spec: Pick<PresenterSpec, 'slot' | 'focus' | 'zoom'>, width: number, height: number): FootageTransform {
  return coverTransform(slotRect(spec.slot), spec.focus, spec.zoom ?? slotZoom(spec.slot), width, height);
}

/**
 * Quanto cada push soma à transformação pousada, por unidade do envelope dele: o footage cresce em volta do
 * alvo sem sair do buraco. O ffmpeg usa estes mesmos pesos (src/render/reframe.ts).
 */
export function pushWeights(base: FootageTransform, rect: Rect, push: Pick<PlacedPush, 'scale' | 'x' | 'y'>, width: number, height: number): FootageTransform {
  const k = push.scale - 1;
  return {
    scale: base.scale * k,
    x: k * (base.x - rect.x * width - push.x * rect.w * width),
    y: k * (base.y - rect.y * height - push.y * rect.h * height),
  };
}

/**
 * Transformação do footage no mesmo instante de `holeAt`. As duas são interpolações lineares com os
 * mesmos pesos entre extremos em que o footage cobre o buraco; logo, cobre no caminho inteiro.
 */
export function transformAt(plan: Pick<StagePlan, 'slot' | 'focus' | 'zoom' | 'from' | 'holdExit' | 'transitionSec' | 'pushes'>, sec: number, durationSec: number, width: number, height: number): FootageTransform {
  const { enter, exit } = stageProgress(sec, durationSec, plan.holdExit, plan.transitionSec);
  const from = plan.from ? slotTransform(plan.from, width, height) : IDENTITY;
  const to = { ...slotTransform(plan, width, height) };
  const base = { ...to };
  for (const push of plan.pushes ?? []) {
    const weight = pushWeights(base, slotRect(plan.slot), push, width, height);
    const k = pushEnvelope(push, sec);
    to.scale += weight.scale * k;
    to.x += weight.x * k;
    to.y += weight.y * k;
  }
  const mix = (a: number, b: number, rest: number) => lerp(lerp(a, b, enter), rest, exit);
  return { scale: mix(from.scale, to.scale, 1), x: mix(from.x, to.x, 0), y: mix(from.y, to.y, 0) };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Retângulo de cantos arredondados como subcaminho SVG; `radius` único ou [topo-esq, topo-dir, base-dir, base-esq]. */
export function roundedRectPath(x: number, y: number, w: number, h: number, radius: number | readonly [number, number, number, number]): string {
  const limit = Math.min(w / 2, h / 2);
  const [tl, tr, br, bl] = (typeof radius === 'number' ? [radius, radius, radius, radius] : radius).map((value) => Math.max(0, Math.min(value, limit))) as [number, number, number, number];
  const [x0, y0, x1, y1] = [round(x), round(y), round(x + w), round(y + h)];
  if (Math.max(tl, tr, br, bl) < 0.01) return `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
  const arc = (r: number, toX: number, toY: number) => (r < 0.01 ? '' : `A${round(r)} ${round(r)} 0 0 1 ${round(toX)} ${round(toY)}`);
  return [
    `M${round(x + tl)} ${y0}H${round(x + w - tr)}`,
    arc(tr, x + w, y + tr),
    `V${round(y + h - br)}`,
    arc(br, x + w - br, y + h),
    `H${round(x + bl)}`,
    arc(bl, x, y + h - bl),
    `V${round(y + tl)}`,
    arc(tl, x + tl, y),
    'Z',
  ].join('');
}

/** Quadro inteiro menos os retângulos (regra evenodd): o papel com os buracos por onde o footage aparece. */
export function holePath(width: number, height: number, holes: { rect: Rect; radius: number; radii?: readonly [number, number, number, number] }[]): string {
  const cuts = holes.map(({ rect, radius, radii }) => roundedRectPath(rect.x * width, rect.y * height, rect.w * width, rect.h * height, radii ?? radius));
  return [`M0 0H${width}V${height}H0Z`, ...cuts].join('');
}

/** segundos que o rasgo leva para atravessar o quadro (11 f) */
export const TEAR_SEC = stageMotion.tear.sec;

/** Ruído determinístico em [-1, 1] por dente: o rasgo é irregular, mas igual em todo render. */
export function tearJitter(index: number): number {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

/**
 * Polígono (em %) de um rasgo de papel que revela o overlay da esquerda para a direita: borda dura em
 * zigue-zague de segmentos retos, dentes de ~4,8% da largura com passo irregular.
 * `progress` 0 = nada visível; 1 = quadro inteiro (quem chama aplica `easeInOutQuad` ao tempo).
 */
export function tearPolygon(progress: number): string {
  const p = clamp01(progress);
  if (p >= 1) return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  const { teeth, depth } = stageMotion.tear;
  // a borda percorre 100% + a altura do dente, para os dentes saírem do quadro
  const edge = -depth + (100 + depth) * p;
  const points = ['0% 0%'];
  const last = teeth * 2;
  for (let index = 0; index <= last; index += 1) {
    const tooth = index % 2 === 0 ? depth : 0;
    const y = index === 0 ? 0 : index === last ? 100 : ((index + tearJitter(index + 50) * 0.32) / last) * 100;
    points.push(`${round(Math.max(0, edge + tooth + tearJitter(index) * 0.7))}% ${round(y)}%`);
  }
  points.push('0% 100%');
  return `polygon(${points.join(', ')})`;
}

export interface ContentTiming {
  /** quando o conteúdo do palco começa a entrar (s) */
  startSec: number;
  /** quando o conteúdo começa a sair (s) */
  exitSec: number;
  /** vem colado de outro palco / o próximo palco começa colado: o conteúdo cruza em vez de nascer do vazio */
  linkedIn: boolean;
  linkedOut: boolean;
}

/**
 * Relógio do conteúdo de um palco com `items` elementos que saem em cascata. Voltando para a tela cheia, a
 * saída começa junto com a troca (o cartão cresce por cima do que ainda resta); colado no próximo palco,
 * termina exatamente no último frame.
 */
export function contentTiming(plan: Pick<StagePlan, 'from' | 'holdExit' | 'transitionSec'> | null | undefined, durationSec: number, items = 1): ContentTiming {
  const span = stageMotion.exit.itemSec + (Math.max(1, items) - 1) * stageMotion.exit.staggerSec;
  const atEnd = Math.max(0, durationSec - span);
  if (!plan) return { startSec: stageMotion.contentDelaySec, exitSec: atEnd, linkedIn: false, linkedOut: false };
  return {
    startSec: plan.from ? 0 : stageMotion.contentDelaySec,
    exitSec: plan.holdExit ? atEnd : Math.min(atEnd, durationSec - stageRamps(durationSec, plan.transitionSec).exit + stageMotion.exit.lagSec),
    linkedIn: Boolean(plan.from),
    linkedOut: plan.holdExit,
  };
}

/** Saída 0→1 de um item da cascata: `order` 0 é o último que entrou e o primeiro a sair. */
export function exitCue(sec: number, exitSec: number, order: number): number {
  return easeInOut((sec - exitSec - order * stageMotion.exit.staggerSec) / stageMotion.exit.itemSec);
}

/**
 * Opacidade do elemento-âncora (título, moldura): na emenda de dois palcos colados ele não chega a zero,
 * então nunca há um frame de papel vazio entre um conteúdo e o outro.
 */
export function anchorOpacity(enter: number, exit: number, timing: Pick<ContentTiming, 'linkedIn' | 'linkedOut'>): number {
  const floor = stageMotion.swapFloor;
  const shown = timing.linkedIn ? floor + (1 - floor) * clamp01(enter) : clamp01(enter);
  return shown * (timing.linkedOut ? 1 - (1 - floor) * clamp01(exit) : 1 - clamp01(exit));
}

/** Dois palcos colados são "o mesmo palco" quando o componente, a variante e o lado da janela coincidem: a moldura fica. */
export function sameStage(a: Pick<StageNeighbor, 'slot' | 'component' | 'kind'> | null | undefined, b: Pick<StageNeighbor, 'slot' | 'component' | 'kind'>): boolean {
  return Boolean(a && a.component && a.component === b.component && (a.kind ?? '') === (b.kind ?? '') && windowSide(a.slot) === windowSide(b.slot));
}

/**
 * Intervalo (s, relativo ao overlay) em que a gravação de tela aparece no corpo da janela (`kind: "screen"`).
 * Enquanto o cartão do apresentador ainda passa por cima da janela (troca de layout), a "tampa" escura fica
 * fechada: o ffmpeg só compõe a tela dentro deste intervalo e o componente abre a tampa nele.
 */
export function screenSpan(plan: Pick<StagePlan, 'from' | 'holdExit' | 'transitionSec' | 'slot' | 'next'> | null | undefined, durationSec: number, self: Pick<StageNeighbor, 'component' | 'kind'>): { openAt: number; closeAt: number } {
  if (!plan) return { openAt: 0, closeAt: durationSec };
  const ramps = stageRamps(durationSec, plan.transitionSec);
  const me = { ...self, slot: plan.slot };
  return {
    openAt: sameStage(plan.from, me) ? 0 : ramps.enter * (plan.from ? 0.5 : 1),
    closeAt: plan.holdExit ? durationSec : durationSec - ramps.exit,
  };
}

/**
 * Liga palcos colados: se um começa no frame em que o anterior acaba, o cartão desliza direto de um
 * slot para o outro (como na referência: janela → citação com o apresentador parado no canto).
 */
export function linkStages<T extends { from: number; durationInFrames: number; presenter?: PresenterSpec | null; component?: string; kind?: string }>(
  items: T[],
  toleranceFrames = 2,
): Map<T, StagePlan> {
  const staged = items.filter((item) => item.presenter).sort((a, b) => a.from - b.from);
  const plans = new Map<T, StagePlan>();
  const tag = (item: T) => ({ ...(item.component ? { component: item.component } : {}), ...(item.kind ? { kind: item.kind } : {}) });
  staged.forEach((item, index) => {
    const previous = staged[index - 1];
    const next = staged[index + 1];
    const touches = (a: T, b: T) => Math.abs(a.from + a.durationInFrames - b.from) <= toleranceFrames;
    const before = previous && touches(previous, item) ? previous : null;
    const after = next && touches(item, next) ? next : null;
    plans.set(item, {
      ...item.presenter!,
      from: before ? { slot: before.presenter!.slot, focus: before.presenter!.focus, zoom: before.presenter!.zoom, ...tag(before) } : null,
      holdExit: Boolean(after),
      ...(after ? { next: { slot: after.presenter!.slot, ...tag(after) } } : {}),
    });
  });
  return plans;
}
