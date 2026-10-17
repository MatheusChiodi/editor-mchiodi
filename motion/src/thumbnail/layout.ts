/**
 * Geometria e regras de legibilidade da capa (miniatura do YouTube, 1280×720). Tudo aqui é puro:
 * o componente `Thumbnail` só desenha o plano que sai de `planThumb`, e `mce pack thumb` valida
 * o mesmo plano antes de renderizar. Sem imports do Remotion, para rodar nos testes e na CLI.
 */

export const THUMB = { width: 1280, height: 720, margin: 56 } as const;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Canto onde o YouTube sobrepõe a duração do vídeo: nada de texto ali. */
export const DURATION_ZONE: Rect = { x: THUMB.width - 236, y: THUMB.height - 104, width: 236, height: 104 };

export const LAYOUT_IDS = ['face-right', 'face-left', 'band', 'split', 'number'] as const;
export type ThumbLayout = (typeof LAYOUT_IDS)[number];

export const LAYOUT_LABEL: Record<ThumbLayout, string> = {
  'face-right': 'rosto à direita, texto à esquerda',
  'face-left': 'rosto à esquerda, texto à direita',
  band: 'texto sobre faixa inferior',
  split: 'antes/depois (duas metades; uma linha do texto para cada lado)',
  number: 'número gigante + texto, rosto à direita',
};

export type ThumbFont = 'display' | 'body';

export type ThumbSupport =
  | { kind: 'pill'; text: string; tone?: 'paper' | 'coral' | 'emerald' }
  | { kind: 'arrow' }
  | { kind: 'badge'; text: string };

/** O que o agente decide sobre o texto e a composição; a foto entra à parte. */
export type ThumbDesign = {
  layout: ThumbLayout;
  /** 2–4 palavras; `\n` força a quebra de linha (no `split`: linha 1 = esquerda, linha 2 = direita) */
  text: string;
  /** a ÚNICA palavra em coral */
  accent?: string;
  font?: ThumbFont;
  uppercase?: boolean;
  /** layout `number`: o número gigante ("4", "10x", "R$ 0") e a unidade opcional ("anos") */
  number?: string;
  unit?: string;
  support?: ThumbSupport;
  /** layout `band`: cor da faixa */
  tone?: 'paper' | 'ink';
};

export const COLORS = {
  paper: '#f8f8f2',
  ink: '#111827',
  white: '#ffffff',
  coral: '#ff5555',
  coralDeep: '#ca3434',
  emerald: '#34d399',
} as const;

export const TEXT_LIMITS = {
  /** ideal: até 4 palavras; 5 avisa; 7+ reprova */
  idealWords: 4,
  maxWords: 6,
  /** caracteres por linha a partir dos quais o texto começa a encolher demais */
  lineChars: 14,
  /** abaixo disso a letra some na miniatura de 168 px do celular (84 px → 11 px) */
  minFontSize: 84,
  maxFontSize: { display: 236, body: 220 } as Record<ThumbFont, number>,
  /** o texto precisa ocupar pelo menos 1/3 da largura */
  minWidthRatio: 1 / 3,
  /** contraste mínimo texto × fundo (WCAG AA para texto normal; a capa é vista minúscula) */
  minContrast: 4.5,
  /** acento sobre a superfície: texto enorme, vale o AA de texto grande */
  minAccentContrast: 3,
} as const;

const LINE_HEIGHT: Record<ThumbFont, number> = { display: 1.04, body: 0.98 };
const TRACKING = -0.02;

/* ------------------------------------------------------------------ cor */

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminância relativa (WCAG), 0 = preto, 1 = branco. */
export function luminance(rgb: readonly [number, number, number]): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrastRatio(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` com opacidade `alpha` sobre `bottom`. */
export function blend(top: readonly [number, number, number], bottom: readonly [number, number, number], alpha: number): [number, number, number] {
  return [0, 1, 2].map((i) => Math.round(top[i]! * alpha + bottom[i]! * (1 - alpha))) as [number, number, number];
}

/** Coral da marca onde ele lê; sobre papel o coral claro não chega a 3:1, então entra o coral escuro. */
export function accentOn(surface: string): string {
  const base = hexToRgb(surface);
  return contrastRatio(hexToRgb(COLORS.coral), base) >= TEXT_LIMITS.minAccentContrast ? COLORS.coral : COLORS.coralDeep;
}

/* ---------------------------------------------------------------- imagem */

export interface Placement {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Posiciona a foto dentro de uma caixa, cobrindo-a inteira: o ponto `focus` da foto (0–1, o rosto)
 * vai parar em `anchor` (0–1 da caixa) com `zoom` aplicado. Se isso deixaria um buraco na borda,
 * a foto encosta na borda (o rosto fica o mais perto possível do alvo).
 */
export function placeImage(image: { width: number; height: number }, box: { width: number; height: number }, focus: Point, zoom: number, anchor: Point): Placement {
  const scale = Math.max(box.width / image.width, box.height / image.height) * Math.max(1, zoom);
  const width = image.width * scale;
  const height = image.height * scale;
  const clamp = (value: number, min: number) => Math.min(0, Math.max(min, value));
  return {
    left: clamp(anchor.x * box.width - focus.x * width, box.width - width),
    top: clamp(anchor.y * box.height - focus.y * height, box.height - height),
    width,
    height,
  };
}

/** Região da FOTO (em pixels dela) que aparece sob um retângulo da caixa: para medir o fundo real do texto. */
export function sourceRegion(placement: Placement, image: { width: number; height: number }, rect: Rect): Rect {
  const scale = placement.width / image.width;
  const x = Math.max(0, (rect.x - placement.left) / scale);
  const y = Math.max(0, (rect.y - placement.top) / scale);
  return {
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.max(1, Math.floor(Math.min(image.width - x, rect.width / scale))),
    height: Math.max(1, Math.floor(Math.min(image.height - y, rect.height / scale))),
  };
}

/* ----------------------------------------------------------------- texto */

const NARROW = new Set([...'iljtfrI1.,:;!\'|()[]']);
const WIDE = new Set([...'mwMW@%']);
const FONT_FACTOR: Record<ThumbFont, number> = { display: 0.98, body: 1.07 };

/** Largura estimada em `em`. Não há medição de fonte fora do browser; a folga fica em `fitFontSize`. */
export function emWidth(text: string, font: ThumbFont): number {
  let total = 0;
  for (const char of text) {
    if (char === ' ') total += 0.27;
    else if (NARROW.has(char)) total += 0.33;
    else if (WIDE.has(char)) total += 0.9;
    else if (/[0-9]/.test(char)) total += 0.62;
    else if (char === '-' || char === '–' || char === '—') total += 0.42;
    else if (char !== char.toLowerCase() || /[^\p{L}]/u.test(char)) total += 0.7;
    else total += 0.56;
    total += TRACKING;
  }
  return Math.max(0, total) * FONT_FACTOR[font];
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Todas as formas de partir `words` em `count` linhas, mantendo a ordem; devolve a de menor linha mais larga. */
export function balanceLines(words: string[], count: number, font: ThumbFont): string[] {
  if (count <= 1 || words.length <= 1) return [words.join(' ')];
  const lines = Math.min(count, words.length);
  let best: string[] = [];
  let bestWidth = Number.POSITIVE_INFINITY;
  const walk = (start: number, left: number, acc: string[]) => {
    if (left === 1) {
      const candidate = [...acc, words.slice(start).join(' ')];
      const widest = Math.max(...candidate.map((line) => emWidth(line, font)));
      if (widest < bestWidth) {
        bestWidth = widest;
        best = candidate;
      }
      return;
    }
    for (let end = start + 1; end <= words.length - (left - 1); end++) walk(end, left - 1, [...acc, words.slice(start, end).join(' ')]);
  };
  walk(0, lines, []);
  return best;
}

export function fitFontSize(lines: string[], box: { width: number; height: number }, font: ThumbFont, max: number = TEXT_LIMITS.maxFontSize[font]): number {
  const widest = Math.max(0.01, ...lines.map((line) => emWidth(line, font)));
  // 4% de folga: a largura é estimada
  return Math.floor(Math.min(max, (box.width * 0.96) / widest, box.height / (lines.length * LINE_HEIGHT[font])));
}

/** Quebra o texto no número de linhas que deixa a letra maior. `\n` no texto é respeitado como está. */
export function breakText(text: string, box: { width: number; height: number }, font: ThumbFont, maxLines = 3): { lines: string[]; fontSize: number } {
  const forced = text.split('\n').map((line) => line.trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (forced.length > 1) return { lines: forced, fontSize: fitFontSize(forced, box, font) };
  const words = (forced[0] ?? '').split(' ').filter(Boolean);
  let best = { lines: [words.join(' ')], fontSize: 0 };
  for (let count = 1; count <= Math.min(maxLines, Math.max(1, words.length)); count++) {
    const lines = balanceLines(words, count, font);
    const fontSize = fitFontSize(lines, box, font);
    if (fontSize > best.fontSize) best = { lines, fontSize };
  }
  return best;
}

export interface Segment {
  text: string;
  accent: boolean;
}

function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Marca a primeira ocorrência da palavra de acento; o resto fica liso. */
export function accentSegments(lines: string[], accent: string | undefined): Segment[][] {
  const target = accent ? normalizeWord(accent) : '';
  let used = false;
  return lines.map((line) => {
    const segments: Segment[] = [];
    const plain = (text: string) => {
      const last = segments[segments.length - 1];
      if (last && !last.accent) last.text += text;
      else segments.push({ text, accent: false });
    };
    line.split(' ').forEach((word, index) => {
      const hit = !used && target !== '' && normalizeWord(word) === target;
      if (index > 0) plain(' ');
      if (hit) {
        used = true;
        segments.push({ text: word, accent: true });
      } else plain(word);
    });
    return segments;
  });
}

/* ------------------------------------------------------------------ plano */

export interface TextBlock {
  /** área reservada ao bloco */
  box: Rect;
  /** onde o texto realmente cai (estimado) */
  rect: Rect;
  lines: Segment[][];
  font: ThumbFont;
  fontSize: number;
  lineHeight: number;
  color: string;
  accentColor: string;
  /** cor por trás do texto: `photo` = foto + véu escuro */
  surface: 'photo' | 'paper' | 'ink';
}

export interface ScrimStop {
  at: number;
  alpha: number;
}

export interface ImageSlot {
  box: Rect;
  /** onde o rosto deve cair dentro da caixa (0–1) */
  anchor: Point;
  /** polígono de recorte em pixels da capa (split) */
  clip?: Point[];
  muted?: boolean;
}

export interface ThumbPlan {
  layout: ThumbLayout;
  blocks: TextBlock[];
  images: ImageSlot[];
  /** véu `ink` sobre a foto; `axis` diz a direção em que `at` cresce */
  scrim: { axis: 'x' | 'y'; stops: ScrimStop[] } | null;
  band: Rect | null;
  bandColor: string | null;
  number: { text: string; unit: string | null; rect: Rect; fontSize: number; unitSize: number } | null;
  pill: { rect: Rect; text: string; background: string; color: string; fontSize: number } | null;
  badge: { center: Point; radius: number; text: string; fontSize: number } | null;
  arrow: { from: Point; to: Point; bend: number } | null;
  divider: { top: Point; bottom: Point; center: Point } | null;
}

const FULL: Rect = { x: 0, y: 0, width: THUMB.width, height: THUMB.height };

const FACE_SCRIM: ScrimStop[] = [
  { at: 0, alpha: 0.94 },
  { at: 0.46, alpha: 0.82 },
  { at: 0.72, alpha: 0 },
];

export function scrimAlphaAt(stops: ScrimStop[], at: number): number {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 0;
  if (at <= first.at) return first.alpha;
  if (at >= last.at) return last.alpha;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    if (at <= b.at) return a.alpha + ((at - a.at) / (b.at - a.at || 1)) * (b.alpha - a.alpha);
  }
  return last.alpha;
}

function block(
  text: string,
  box: Rect,
  design: ThumbDesign,
  options: { surface: TextBlock['surface']; valign: 'center' | 'top' | 'bottom'; maxLines?: number; fontSize?: number },
): TextBlock {
  const font = design.font ?? 'display';
  const shown = design.uppercase ? text.toUpperCase() : text;
  const broken = breakText(shown, box, font, options.maxLines ?? 3);
  const fontSize = options.fontSize ?? broken.fontSize;
  const lineHeight = LINE_HEIGHT[font];
  const height = broken.lines.length * lineHeight * fontSize;
  const width = Math.min(box.width, Math.max(...broken.lines.map((line) => emWidth(line, font))) * fontSize);
  const y = options.valign === 'top' ? box.y : options.valign === 'bottom' ? box.y + box.height - height : box.y + (box.height - height) / 2;
  const base = options.surface === 'paper' ? COLORS.paper : COLORS.ink;
  return {
    box,
    rect: { x: box.x, y, width, height },
    lines: accentSegments(broken.lines, design.accent),
    font,
    fontSize,
    lineHeight,
    color: options.surface === 'paper' ? COLORS.ink : COLORS.white,
    accentColor: accentOn(base),
    surface: options.surface,
  };
}

const PILL_HEIGHT = 58;
const PILL_GAP = 20;

function pillFor(design: ThumbDesign, at: Point): ThumbPlan['pill'] {
  if (design.support?.kind !== 'pill') return null;
  const tone = design.support.tone ?? 'coral';
  const text = design.support.text.toUpperCase();
  const fontSize = 30;
  const width = Math.round(emWidth(text, 'body') * fontSize * 1.12 + 56);
  return {
    rect: { x: at.x, y: at.y, width, height: PILL_HEIGHT },
    text,
    background: tone === 'paper' ? COLORS.paper : tone === 'emerald' ? COLORS.emerald : COLORS.coral,
    color: tone === 'coral' ? COLORS.white : COLORS.ink,
    fontSize,
  };
}

function badgeFor(design: ThumbDesign, center: Point): ThumbPlan['badge'] {
  if (design.support?.kind !== 'badge') return null;
  const text = design.support.text.toUpperCase();
  const radius = 104;
  const widest = Math.max(...text.split(/\s+/).map((word) => emWidth(word, 'body')));
  return { center, radius, text, fontSize: Math.floor(Math.min(58, (radius * 1.5) / widest)) };
}

/** Empurra o bloco de texto para baixo para a pílula caber em cima, mantendo o conjunto centrado. */
function withPill(box: Rect, design: ThumbDesign): { box: Rect; pillAt: (textBlock: TextBlock) => Point } {
  if (design.support?.kind !== 'pill') return { box, pillAt: () => ({ x: 0, y: 0 }) };
  const reserve = PILL_HEIGHT + PILL_GAP;
  return {
    box: { ...box, y: box.y + reserve, height: box.height - reserve },
    pillAt: (textBlock) => ({ x: textBlock.rect.x + 4, y: textBlock.rect.y - reserve }),
  };
}

/** O plano completo da capa: onde cai cada coisa e com que tamanho. */
export function planThumb(design: ThumbDesign): ThumbPlan {
  const { width: W, height: H, margin: M } = THUMB;
  const empty = { scrim: null, band: null, bandColor: null, number: null, pill: null, badge: null, arrow: null, divider: null } as const;

  if (design.layout === 'face-right' || design.layout === 'face-left') {
    const right = design.layout === 'face-right';
    // à direita o bloco termina antes da zona da duração
    const area: Rect = right ? { x: M, y: 64, width: 640, height: H - 128 } : { x: W - M - 636, y: 56, width: 636, height: DURATION_ZONE.y - 56 - 12 };
    const { box, pillAt } = withPill(area, design);
    const text = block(design.text, box, design, { surface: 'photo', valign: 'center' });
    const faceX = right ? 0.755 : 0.245;
    return {
      ...empty,
      layout: design.layout,
      blocks: [text],
      images: [{ box: FULL, anchor: { x: faceX, y: 0.43 } }],
      scrim: { axis: 'x', stops: right ? FACE_SCRIM : FACE_SCRIM.map((stop) => ({ at: 1 - stop.at, alpha: stop.alpha })).reverse() },
      pill: pillFor(design, pillAt(text)),
      badge: badgeFor(design, { x: right ? W - M - 110 : M + 110, y: 138 }),
      arrow:
        design.support?.kind === 'arrow'
          ? right
            ? { from: { x: text.rect.x + text.rect.width * 0.62, y: text.rect.y + text.rect.height + 44 }, to: { x: faceX * W - 215, y: 0.63 * H }, bend: 0.3 }
            : { from: { x: text.rect.x + text.rect.width * 0.38, y: text.rect.y + text.rect.height + 44 }, to: { x: faceX * W + 215, y: 0.63 * H }, bend: -0.3 }
          : null,
    };
  }

  if (design.layout === 'band') {
    const paper = (design.tone ?? 'paper') === 'paper';
    // a faixa tem a altura do texto: uma linha não deixa um bloco de papel vazio
    const textWidth = DURATION_ZONE.x - M - 20;
    const probe = block(design.text, { x: M, y: 0, width: textWidth, height: 232 }, design, { surface: 'paper', valign: 'center', maxLines: 2 });
    const bandHeight = Math.round(probe.rect.height + 64);
    const band: Rect = { x: 0, y: H - bandHeight, width: W, height: bandHeight };
    const text = block(design.text, { x: M, y: band.y + 10 + 27, width: textWidth, height: probe.rect.height }, design, {
      surface: paper ? 'paper' : 'ink',
      valign: 'center',
      maxLines: 2,
      fontSize: probe.fontSize,
    });
    return {
      ...empty,
      layout: design.layout,
      blocks: [text],
      images: [{ box: { x: 0, y: 0, width: W, height: band.y + 4 }, anchor: { x: 0.5, y: 0.5 } }],
      band,
      bandColor: paper ? COLORS.paper : COLORS.ink,
      pill: pillFor(design, { x: M, y: band.y - PILL_HEIGHT / 2 }),
      badge: badgeFor(design, { x: W - M - 110, y: 138 }),
    };
  }

  if (design.layout === 'split') {
    const [leftText = '', rightText = ''] = design.text.split('\n').map((line) => line.trim());
    const leftBox: Rect = { x: 36, y: 400, width: 540, height: 200 };
    const rightBox: Rect = { x: 700, y: 400, width: 540, height: 200 };
    const probe = [leftText, rightText].map((line, index) => block(line, index === 0 ? leftBox : rightBox, design, { surface: 'photo', valign: 'bottom', maxLines: 2 }));
    const fontSize = Math.min(...probe.map((item) => item.fontSize));
    const blocks = [leftText, rightText].map((line, index) => block(line, index === 0 ? leftBox : rightBox, design, { surface: 'photo', valign: 'bottom', maxLines: 2, fontSize }));
    const top = { x: 690, y: 0 };
    const bottom = { x: 590, y: H };
    return {
      ...empty,
      layout: design.layout,
      blocks,
      images: [
        { box: { x: 0, y: 0, width: 690, height: H }, anchor: { x: 0.46, y: 0.36 }, clip: [{ x: 0, y: 0 }, top, bottom, { x: 0, y: H }], muted: true },
        { box: { x: 590, y: 0, width: 690, height: H }, anchor: { x: 0.54, y: 0.36 }, clip: [top, { x: W, y: 0 }, { x: W, y: H }, bottom] },
      ],
      scrim: { axis: 'y', stops: [{ at: 0.38, alpha: 0 }, { at: 0.72, alpha: 0.86 }, { at: 1, alpha: 0.94 }] },
      divider: { top, bottom, center: { x: 640, y: 300 } },
      pill: pillFor(design, { x: M, y: 44 }),
    };
  }

  // number
  const numberText = (design.number ?? '').trim() || '?';
  const unit = design.unit?.trim() || null;
  const numberBox = { width: unit ? 430 : 600, height: 340 };
  const numberSize = Math.floor(Math.min(400, (numberBox.width * 0.96) / emWidth(numberText, 'body'), numberBox.height / 0.84));
  const unitSize = Math.round(Math.min(96, numberSize * 0.26));
  const numberRect: Rect = {
    x: M,
    y: 44,
    width: Math.round(emWidth(numberText, 'body') * numberSize + (unit ? 18 + emWidth(unit, 'body') * unitSize : 0)),
    height: Math.round(numberSize * 0.84),
  };
  const textTop = numberRect.y + numberRect.height + 14;
  const text = block(design.text, { x: M, y: textTop, width: 660, height: H - 60 - textTop }, design, { surface: 'photo', valign: 'top', maxLines: 2 });
  return {
    ...empty,
    layout: 'number',
    blocks: [text],
    images: [{ box: FULL, anchor: { x: 0.765, y: 0.43 } }],
    scrim: { axis: 'x', stops: FACE_SCRIM },
    number: { text: numberText, unit, rect: numberRect, fontSize: numberSize, unitSize },
    badge: badgeFor(design, { x: W - M - 110, y: 138 }),
  };
}

/* ------------------------------------------------------------- validação */

export interface Problem {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Menor opacidade do véu sob o bloco: é onde o texto corre mais risco. */
export function scrimUnder(plan: ThumbPlan, rect: Rect): number {
  if (!plan.scrim) return 0;
  const size = plan.scrim.axis === 'x' ? THUMB.width : THUMB.height;
  const from = (plan.scrim.axis === 'x' ? rect.x : rect.y) / size;
  const to = (plan.scrim.axis === 'x' ? rect.x + rect.width : rect.y + rect.height) / size;
  return Math.min(scrimAlphaAt(plan.scrim.stops, from), scrimAlphaAt(plan.scrim.stops, to));
}

/**
 * Contraste do texto contra o que está atrás dele. Sobre a foto, `photo` é a cor média medida
 * na região do texto (a casca mede com sharp); o véu `ink` entra por cima na conta.
 */
export function blockContrast(plan: ThumbPlan, textBlock: TextBlock, photo: readonly [number, number, number] = [128, 128, 128]): number {
  const text = hexToRgb(textBlock.color);
  if (textBlock.surface !== 'photo') return contrastRatio(text, hexToRgb(textBlock.surface === 'paper' ? COLORS.paper : COLORS.ink));
  return contrastRatio(text, blend(hexToRgb(COLORS.ink), photo, scrimUnder(plan, textBlock.rect)));
}

/** Regras de legibilidade da capa. `photo[i]` = cor média da foto sob o bloco `i`, quando medida. */
export function checkThumb(design: ThumbDesign, photo?: (readonly [number, number, number])[]): Problem[] {
  const problems: Problem[] = [];
  const add = (level: Problem['level'], code: string, message: string) => problems.push({ level, code, message });
  const words = countWords(design.text);

  if (words === 0) add('error', 'sem-texto', 'a capa não tem texto');
  if (words > TEXT_LIMITS.maxWords) add('error', 'texto-longo', `${words} palavras na capa: o limite é ${TEXT_LIMITS.maxWords} e o ideal é 2–${TEXT_LIMITS.idealWords}`);
  else if (words > TEXT_LIMITS.idealWords) add('warning', 'texto-longo', `${words} palavras: capa boa tem 2–${TEXT_LIMITS.idealWords}`);

  if (design.accent) {
    if (countWords(design.accent) !== 1) add('error', 'acento', `"accent" é UMA palavra em coral, veio "${design.accent}"`);
    else if (!accentSegments(design.text.split('\n'), design.accent).flat().some((segment) => segment.accent)) {
      add('error', 'acento', `a palavra de acento "${design.accent}" não está no texto`);
    }
  } else if (design.layout !== 'number') add('warning', 'acento', 'sem palavra em coral: marque a que carrega a ideia');
  // no layout number o coral já é o número

  if (design.layout === 'split' && design.text.split('\n').filter((line) => line.trim()).length !== 2) {
    add('error', 'split-linhas', 'o layout split precisa de exatamente 2 linhas (`\\n`): a primeira vai à esquerda, a segunda à direita');
  }
  if (design.layout === 'number' && !design.number?.trim()) add('error', 'sem-numero', 'o layout number precisa do campo "number"');
  if (design.layout === 'split' && design.support?.kind === 'arrow') add('warning', 'apoio', 'seta não tem efeito no layout split');

  const plan = planThumb(design);
  const font = design.font ?? 'display';
  const fontSize = Math.min(...plan.blocks.map((item) => item.fontSize));
  if (fontSize < TEXT_LIMITS.minFontSize) {
    add('error', 'letra-pequena', `a letra ficou com ${fontSize}px (mínimo ${TEXT_LIMITS.minFontSize}): some na miniatura do celular. Encurte o texto ou quebre em mais linhas`);
  }
  for (const item of plan.blocks) {
    for (const line of item.lines) {
      const text = line.map((segment) => segment.text).join('');
      if (text.length > TEXT_LIMITS.lineChars) add('warning', 'linha-longa', `"${text}" tem ${text.length} caracteres (ideal até ${TEXT_LIMITS.lineChars} por linha)`);
    }
  }

  // no split as duas metades formam uma frase só: vale a soma
  const widest = design.layout === 'split' ? plan.blocks.reduce((sum, item) => sum + item.rect.width, 0) : Math.max(...plan.blocks.map((item) => item.rect.width), plan.number?.rect.width ?? 0);
  if (widest < THUMB.width * TEXT_LIMITS.minWidthRatio) {
    add('warning', 'texto-estreito', `o texto ocupa ${Math.round((widest / THUMB.width) * 100)}% da largura (mínimo 33%): use menos linhas ou a fonte ${font === 'display' ? 'body' : 'display'}`);
  }

  const occupied: Rect[] = [...plan.blocks.map((item) => item.rect), ...(plan.number ? [plan.number.rect] : []), ...(plan.pill ? [plan.pill.rect] : [])];
  if (plan.badge) occupied.push({ x: plan.badge.center.x - plan.badge.radius, y: plan.badge.center.y - plan.badge.radius, width: plan.badge.radius * 2, height: plan.badge.radius * 2 });
  if (occupied.some((rect) => intersects(rect, DURATION_ZONE))) add('error', 'zona-da-duracao', 'há texto no canto inferior direito, onde o YouTube põe a duração');
  if (occupied.some((rect) => rect.x < 0 || rect.y < 0 || rect.x + rect.width > THUMB.width || rect.y + rect.height > THUMB.height)) {
    add('error', 'fora-do-quadro', 'há texto saindo do quadro');
  }

  plan.blocks.forEach((item, index) => {
    const ratio = blockContrast(plan, item, photo?.[index]);
    if ((item.surface !== 'photo' || photo?.[index]) && ratio < TEXT_LIMITS.minContrast) {
      add('error', 'contraste', `contraste do texto ${ratio.toFixed(1)}:1 (mínimo ${TEXT_LIMITS.minContrast}:1): escureça a foto (dim) ou mude o enquadramento`);
    }
  });
  return problems;
}
