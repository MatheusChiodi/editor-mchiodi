import { CAPTION_LAYOUT, type CaptionPreset, captionPresets } from './captions/presets';

/**
 * Diagramação dos gráficos no Short 9:16. Módulo puro (sem React): o pipeline monta o quadro, o `Overlay`
 * posiciona cada componente numa caixa, e os testes provam que caixa nenhuma cobre a legenda ou o rosto.
 *
 * O componente não é recortado do 16:9: ele é desenhado dentro de uma caixa própria (o flex dele refaz o
 * layout na largura do vertical) e a caixa inteira é escalada para caber na zona.
 */

/**
 * Onde o componente entra no vertical:
 * - `top`: acima do rosto (o terço de cima, onde o Short costuma ter o gráfico);
 * - `bottom`: entre o rosto e a legenda (só cabe quando o rosto está alto; senão cai para `top`);
 * - `full`: inserto do topo até a legenda; cobre o rosto de propósito (código, diagrama, tabela);
 * - `frame`: o quadro inteiro, sem caixa (efeitos e stingers, que já são de tela cheia);
 * - `skip`: não entra no Short (CTA de inscrição, lower third largo, palcos e camadas fixas).
 */
export const VERTICAL_ZONES = ['top', 'bottom', 'full', 'frame', 'skip'] as const;
export type VerticalZone = (typeof VERTICAL_ZONES)[number];

export interface VerticalSpec {
  zone: VerticalZone;
  /** escala do desenho dentro da zona (1 = tamanho de projeto do componente); sem valor, a padrão da zona */
  scale?: number;
}

/** Faixa vertical em px do quadro do Short. */
export interface Band {
  top: number;
  bottom: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tudo que a diagramação precisa saber do Short: tamanho, áreas seguras, rosto e legenda. */
export interface VerticalFrame {
  width: number;
  height: number;
  /** interface do app (busca em cima, título/canal embaixo): nenhum gráfico de caixa entra nela */
  safeTop: number;
  safeX: number;
  /** folga entre a caixa e o que ela não pode cobrir */
  gap: number;
  face: Band;
  /** faixa das legendas; `null` sem legenda */
  captions: Band | null;
}

export interface VerticalBox extends Rect {
  zone: Exclude<VerticalZone, 'skip'>;
  scale: number;
}

/** Interface do YouTube Shorts/Reels sobre o quadro de 1080x1920 (medido nos apps). */
export const SHORTS_SAFE = { top: 140, x: 60, gap: 36 } as const;

/**
 * Faixa do rosto em fração da altura: recorte de altura inteira de um apresentador sentado (topo do cabelo a ~31%,
 * queixo a ~58% no teste-fullstack). Ajustável por EDL em `shorts.faceBand`.
 */
export const DEFAULT_FACE_BAND = { top: 0.3, bottom: 0.6 } as const;

/** Zona menor que isso não comporta um cartão legível: `bottom` cai para `top`, `top` cai para `full`. */
export const MIN_ZONE_HEIGHT = 200;

/**
 * Escala padrão de cada zona. Cartão de texto em 0,9: no Short a letra precisa ficar grande. Inserto em 0,7: o
 * componente enxerga ~1370 px de largura, perto do que foi desenhado para o 16:9, sem estourar a caixa.
 */
export const ZONE_SCALE: Record<Exclude<VerticalZone, 'skip' | 'frame'>, number> = { top: 0.9, bottom: 0.9, full: 0.7 };

/** Sem metadado: cartão no terço de cima. Cena sob medida (`scene:`) é inserto de tela inteira. */
export const DEFAULT_VERTICAL: VerticalSpec = { zone: 'top' };
export const DEFAULT_SCENE_VERTICAL: VerticalSpec = { zone: 'full' };

const SCALE_RANGE = [0.3, 1.5] as const;

/**
 * Faixa ocupada pela legenda do Short no estilo dado: página ancorada no fundo (`CAPTION_LAYOUT.bottom`), até
 * 2 linhas, mais o contorno, o crescimento da palavra ativa e o deslocamento da entrada.
 */
export function captionBand(preset: CaptionPreset, height: number): Band {
  const spec = captionPresets[preset];
  const fontSize = spec.fontSize.shorts;
  const lines = spec.singleLine ? 1 : CAPTION_LAYOUT.maxLines;
  const stroke = spec.stroke.shorts;
  const base = height - CAPTION_LAYOUT.bottom.shorts;
  const text = lines * fontSize * CAPTION_LAYOUT.lineHeight + (lines - 1) * CAPTION_LAYOUT.rowGap;
  const grow = fontSize * spec.activeScale;
  return {
    top: Math.floor(base - text - grow - stroke),
    bottom: Math.ceil(base + CAPTION_LAYOUT.enterShift + stroke),
  };
}

export interface VerticalFrameOptions {
  width: number;
  height: number;
  /** estilo da legenda; `null` = Short sem legenda */
  captions: CaptionPreset | null;
  /** faixa do rosto em fração da altura */
  faceBand?: Band;
}

export function verticalFrame(options: VerticalFrameOptions): VerticalFrame {
  const face = options.faceBand ?? DEFAULT_FACE_BAND;
  // as áreas seguras são do quadro de 1080x1920; preview em escala menor encolhe junto
  const unit = options.height / 1920;
  return {
    width: options.width,
    height: options.height,
    safeTop: Math.round(SHORTS_SAFE.top * unit),
    safeX: Math.round(SHORTS_SAFE.x * unit),
    gap: Math.round(SHORTS_SAFE.gap * unit),
    face: { top: Math.round(face.top * options.height), bottom: Math.round(face.bottom * options.height) },
    captions: options.captions ? scaleBand(captionBand(options.captions, 1920), unit) : null,
  };
}

function scaleBand(band: Band, unit: number): Band {
  return { top: Math.floor(band.top * unit), bottom: Math.ceil(band.bottom * unit) };
}

/** Limite de baixo para caixas: a legenda, ou o fim da área útil sem ela (a interface de baixo do app). */
function floorOf(frame: VerticalFrame): number {
  return frame.captions ? frame.captions.top : frame.height - Math.round(frame.height * 0.16);
}

/** Retângulo disponível de cada zona, já com folgas. `null` quando não sobra altura útil. */
export function zoneRect(zone: Exclude<VerticalZone, 'skip' | 'frame'>, frame: VerticalFrame): Rect | null {
  const x = frame.safeX;
  const width = frame.width - 2 * frame.safeX;
  const floor = floorOf(frame) - frame.gap;
  const span = (top: number, bottom: number): Rect | null => (bottom - top > 0 ? { x, y: top, width, height: bottom - top } : null);
  switch (zone) {
    case 'top':
      return span(frame.safeTop, Math.min(frame.face.top - frame.gap, floor));
    case 'bottom':
      return span(Math.max(frame.face.bottom + frame.gap, frame.safeTop), floor);
    case 'full':
      return span(frame.safeTop, floor);
  }
}

const FALLBACK: Record<'top' | 'bottom', 'top' | 'full'> = { bottom: 'top', top: 'full' };

/**
 * Caixa do componente no Short, ou `null` se ele não entra. Zona apertada demais cai para a seguinte
 * (`bottom` → `top` → `full`), e a escala da zona vale para a caixa nova.
 */
export function placeVertical(spec: VerticalSpec, frame: VerticalFrame): VerticalBox | null {
  if (spec.zone === 'skip') return null;
  if (spec.zone === 'frame') return { zone: 'frame', x: 0, y: 0, width: frame.width, height: frame.height, scale: 1 };
  let zone: Exclude<VerticalZone, 'skip' | 'frame'> = spec.zone;
  let rect = zoneRect(zone, frame);
  const minHeight = MIN_ZONE_HEIGHT * (frame.height / 1920);
  while (zone !== 'full' && (!rect || rect.height < minHeight)) {
    zone = FALLBACK[zone];
    rect = zoneRect(zone, frame);
  }
  if (!rect) return null;
  const unit = frame.height / 1920;
  const scale = clamp(spec.scale ?? ZONE_SCALE[zone], SCALE_RANGE[0], SCALE_RANGE[1]) * unit;
  return { zone, ...rect, scale };
}

/** Tamanho de projeto da caixa: o que o componente "enxerga" como quadro (useVideoConfig) antes da escala. */
export function designSize(box: Pick<VerticalBox, 'width' | 'height' | 'scale'>): { width: number; height: number } {
  return { width: Math.round(box.width / box.scale), height: Math.round(box.height / box.scale) };
}

export function overlaps(rect: Pick<Rect, 'y' | 'height'>, band: Band): boolean {
  return rect.y < band.bottom && rect.y + rect.height > band.top;
}

/** O que a caixa cobre (a legenda nunca; o rosto só no inserto `full` e no quadro inteiro). */
export function collisions(box: VerticalBox, frame: VerticalFrame): ('captions' | 'face')[] {
  if (box.zone === 'frame') return [];
  const hits: ('captions' | 'face')[] = [];
  if (frame.captions && overlaps(box, frame.captions)) hits.push('captions');
  if (overlaps(box, frame.face)) hits.push('face');
  return hits;
}

/** Spec que vale para um overlay: o override da EDL vence o metadado do componente, que vence o padrão. */
export function resolveVertical(component: string, entry: VerticalSpec | undefined, override: VerticalSpec | undefined): VerticalSpec {
  return override ?? entry ?? (component.startsWith('scene:') ? DEFAULT_SCENE_VERTICAL : DEFAULT_VERTICAL);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
