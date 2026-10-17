import type { CameraKeyframe } from './camera-math';
import { hash } from './noise';
import { type Cue, type ResolvedCue, resolveTimeline, staggerDelays } from './timeline';

// Lógica pura da cena-vitrine `CineShowcase`: marcação do título, quebra de linhas, layout dos planos e deixas.

export interface TitleWord {
  text: string;
  /** palavra marcada com *asteriscos*: o único acento coral da tela */
  accent: boolean;
}

/** `Cada vídeo, um *filme*` → palavras com a marcada em destaque. Só a PRIMEIRA marcação vale (um acento por tela). */
export function parseTitle(title: string): TitleWord[] {
  let used = false;
  let open = false;
  const words: TitleWord[] = [];
  for (const raw of title.trim().split(/\s+/).filter(Boolean)) {
    const starts = raw.startsWith('*');
    const ends = raw.length > 1 && /\*[.,;:!?…]*$/.test(raw);
    const inside = open || starts;
    const text = raw.replace(/\*/g, '');
    const accent = inside && !used;
    if (text) words.push({ text, accent });
    if (starts && !ends) open = true;
    if (ends && inside) {
      open = false;
      used = true;
    }
  }
  return words;
}

/** Quebra as palavras em linhas de até `maxChars`, equilibrando: a última linha não fica órfã com uma palavra curta. */
export function wrapTitle(words: readonly TitleWord[], maxChars = 22): TitleWord[][] {
  const lines: TitleWord[][] = [];
  let line: TitleWord[] = [];
  let length = 0;
  for (const word of words) {
    const next = length + (line.length ? 1 : 0) + word.text.length;
    if (line.length && next > maxChars) {
      lines.push(line);
      line = [];
      length = 0;
    }
    length += (line.length ? 1 : 0) + word.text.length;
    line.push(word);
  }
  if (line.length) lines.push(line);
  const last = lines[lines.length - 1];
  const previous = lines[lines.length - 2];
  if (last && previous && last.length === 1 && previous.length > 2 && last[0]!.text.length < 6) last.unshift(previous.pop()!);
  return lines;
}

export interface HeroBox {
  width: number;
  height: number;
  fontSize: number;
  lines: TitleWord[][];
}

/** Tamanho da folha-herói a partir do título: a fonte desce um degrau quando passa de três linhas. */
export function heroBox(title: string, hasEyebrow: boolean): HeroBox {
  const words = parseTitle(title);
  let fontSize = 104;
  let lines = wrapTitle(words, 20);
  if (lines.length > 3) {
    fontSize = 84;
    lines = wrapTitle(words, 25);
  }
  const widest = Math.max(1, ...lines.map((line) => line.reduce((sum, word) => sum + word.text.length, line.length - 1)));
  const width = Math.round(Math.min(1320, Math.max(760, widest * fontSize * 0.5 + 220)));
  const height = Math.round(150 + (hasEyebrow ? 64 : 0) + lines.length * fontSize * 1.14 + 46);
  return { width, height, fontSize, lines };
}

export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** 0–1 na rampa de papel (0 = branco na luz, 1 = papel na sombra); -1 = folha de tinta */
  tone: number;
  seed: number;
}

const jitter = (index: number, seed: number, amount: number): number => (hash(index, seed) - 0.5) * 2 * amount;

/** Folhas grandes do plano de apoio (atrás do assunto), uma em cada canto, saindo do quadro. */
export function backSheets(seed: number, width = 1920, height = 1080): Placement[] {
  const base: Omit<Placement, 'seed'>[] = [
    { x: -260, y: -230, width: 700, height: 500, rotation: -9, tone: 0.3 },
    { x: width - 470, y: -250, width: 760, height: 520, rotation: 8, tone: -1 },
    { x: -330, y: height - 290, width: 760, height: 520, rotation: 6, tone: 0.5 },
    { x: width - 520, y: height - 300, width: 780, height: 540, rotation: -7, tone: 0.18 },
  ];
  return base.map((sheet, index) => ({
    ...sheet,
    x: Math.round(sheet.x + jitter(index, seed, 40)),
    y: Math.round(sheet.y + jitter(index, seed + 9, 30)),
    rotation: Math.round((sheet.rotation + jitter(index, seed + 17, 2.5)) * 10) / 10,
    seed: seed + index * 11,
  }));
}

/** Recortes do primeiro plano: poucos, grandes, nos cantos, sempre fora de foco. */
export function frontScraps(seed: number, width = 1920, height = 1080): Placement[] {
  const base: Omit<Placement, 'seed'>[] = [
    { x: -330, y: height - 330, width: 640, height: 520, rotation: 16, tone: 0.12 },
    { x: width - 330, y: -260, width: 600, height: 460, rotation: -13, tone: 0.6 },
  ];
  return base.map((scrap, index) => ({
    ...scrap,
    x: Math.round(scrap.x + jitter(index, seed + 31, 30)),
    y: Math.round(scrap.y + jitter(index, seed + 37, 24)),
    seed: seed + 100 + index * 13,
  }));
}

export interface ChipPlacement {
  /** centro da etiqueta no repouso */
  x: number;
  y: number;
  rotation: number;
  /** de onde ela sai (atrás da folha-herói) */
  fromX: number;
  fromY: number;
}

/** Etiquetas de apoio: saem de trás da folha-herói e pousam em volta dela, alternando lados. Até 4. */
export function chipPlacements(count: number, hero: { width: number; height: number }, width = 1920, height = 1080): ChipPlacement[] {
  const cx = width / 2;
  const cy = height / 2;
  const reachX = hero.width / 2 + 40;
  const reachY = hero.height / 2 + 62;
  const slots = [
    { x: cx - reachX * 0.62, y: cy + reachY, rotation: -4 },
    { x: cx + reachX * 0.58, y: cy + reachY + 14, rotation: 3.5 },
    { x: cx + reachX * 0.66, y: cy - reachY - 4, rotation: -3 },
    { x: cx - reachX * 0.6, y: cy - reachY + 6, rotation: 4 },
  ];
  return slots.slice(0, Math.max(0, Math.min(4, count))).map((slot) => ({
    ...slot,
    x: Math.round(Math.min(width - 250, Math.max(250, slot.x))),
    y: Math.round(Math.min(height - 84, Math.max(84, slot.y))),
    fromX: Math.round(cx + (slot.x - cx) * 0.45),
    fromY: Math.round(cy + (slot.y - cy) * 0.35),
  }));
}

export interface ShowcaseCues {
  sheet: ResolvedCue;
  land: ResolvedCue;
  sweep: ResolvedCue;
  words: number[];
  rule: ResolvedCue;
  chips: number[];
  exit: ResolvedCue;
}

/**
 * Deixas da cena, em frames. A folha pousa, a luz varre no pouso, as palavras sobem em sequência, o traço
 * risca na última palavra, há um respiro e só então as etiquetas chegam. `titleAt`/`chipsAt` (s) sobrepõem.
 */
export function showcaseCues(fps: number, durationInFrames: number, wordCount: number, chipCount: number, options: { titleAt?: number; chipsAt?: number[] } = {}): ShowcaseCues {
  const f = (seconds: number): number => Math.round(seconds * fps);
  const cues: Cue[] = [
    { id: 'sheet', at: f(0.2), duration: f(0.75) },
    // a mola `pesada` cruza o alvo aos ~0,55 s: é o "pouso", onde entram o tremor e a varredura
    { id: 'land', with: 'sheet', offset: f(0.55) },
    { id: 'sweep', with: 'land', offset: 2, duration: f(0.7) },
    options.titleAt === undefined ? { id: 'title', with: 'land', offset: f(0.1) } : { id: 'title', at: f(options.titleAt) },
    { id: 'exit', at: durationInFrames - f(0.5), duration: f(0.5) },
  ];
  const timeline = resolveTimeline(cues);
  const words = staggerDelays(wordCount, { step: 3, start: timeline.title!.start }).map(Math.round);
  const lastWord = words[words.length - 1] ?? timeline.title!.start;
  const rule: ResolvedCue = { start: lastWord + f(0.3), duration: f(0.45), end: lastWord + f(0.75) };
  const autoChips = staggerDelays(chipCount, { step: f(0.4), start: rule.end + f(0.35) }).map(Math.round);
  const chips = autoChips.map((auto, index) => (options.chipsAt?.[index] === undefined ? auto : f(options.chipsAt[index]!)));
  return { sheet: timeline.sheet!, land: timeline.land!, sweep: timeline.sweep!, words, rule, chips, exit: timeline.exit! };
}

/**
 * Câmera da cena: abre recuada e com o foco no primeiro plano, avança e puxa o foco para a folha (rack focus),
 * deriva devagar durante a leitura e dá um empurrão curto quando as etiquetas chegam. Nunca fica parada.
 */
export function showcaseCamera(cues: ShowcaseCues, durationInFrames: number): CameraKeyframe[] {
  const firstChip = cues.chips[0];
  const push: CameraKeyframe[] = firstChip === undefined ? [] : [{ frame: firstChip - 6, z: 70, x: 14, y: -6 }, { frame: firstChip + 30, z: 20, x: 26, y: 4, ease: 'suave' }];
  return [
    { frame: 0, x: -150, y: 46, z: -460, roll: 1.3, focus: -520, aperture: 11 },
    { frame: cues.sheet.start + 4, focus: -520 },
    { frame: cues.land.start + 4, focus: 0 },
    { frame: cues.land.start + 14, x: 0, y: 0, z: 0, roll: 0, ease: 'out' },
    ...push,
    { frame: cues.exit.start, z: firstChip === undefined ? 90 : 60, x: 50, y: -10 },
    { frame: durationInFrames, z: 260, x: 80, y: -20, ease: 'in' },
  ];
}
