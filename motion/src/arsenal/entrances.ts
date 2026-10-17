import type { CSSProperties } from 'react';

export interface EntranceStyle {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  skewX?: number;
  blur?: number;
  clipPath?: string;
  transformOrigin?: string;
  /** em, somado ao tracking que o texto já tem */
  letterSpacing?: number;
}

export type EntranceUnit = 'block' | 'line' | 'word' | 'char';
export type EntranceEasing = 'enter' | 'move' | 'pop';
export type EntranceCategory = 'fade' | 'slide' | 'scale' | 'mask' | 'blur' | 'rotate' | 'text' | 'emphasis';

export interface EntrancePreset {
  id: string;
  label: string;
  description: string;
  unit: EntranceUnit;
  durationSec: number;
  /** passo entre units; em `block` é o passo entre elementos irmãos */
  staggerSec: number;
  easing: EntranceEasing;
  category: EntranceCategory;
  style: (progress: number) => EntranceStyle;
}

// O recorte aberto passa da caixa: sem essa folga o clip-path cortaria a sombra do cartão e as descendentes do texto.
const BLEED = 80;
const MIN_EXIT_SEC = 0.2;

const STAGGER: Record<EntranceUnit, number> = { block: 0.1, line: 0.12, word: 0.06, char: 0.025 };

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round = (value: number): number => Math.round(value * 1000) / 1000;

/** Valor que parte de `start` e zera no repouso. Com `motion.pop` o progresso passa de 1 e o valor cruza o zero de leve. */
const from = (start: number, progress: number): number => start * (1 - progress);
const scaleFrom = (start: number, progress: number): number => 1 + from(start - 1, progress);
const fade = (progress: number, speed = 1): number => clamp01(progress * speed);

function edge(closed: number): string {
  const share = clamp01(closed);
  return `calc(${round(share * 100)}% - ${round((1 - share) * BLEED)}px)`;
}

/** `inset()` em que cada lado vai da fração fechada (0–1 da caixa) até aberto com folga. No repouso não há recorte. */
function inset(progress: number, top: number, right: number, bottom: number, left: number): string | undefined {
  if (progress >= 1) return undefined;
  const closed = 1 - clamp01(progress);
  return `inset(${edge(top * closed)} ${edge(right * closed)} ${edge(bottom * closed)} ${edge(left * closed)})`;
}

function iris(progress: number): string | undefined {
  if (progress >= 1) return undefined;
  const open = clamp01(progress);
  return `circle(calc(${round(open * 75)}% + ${round(open * BLEED * 1.5)}px) at 50% 50%)`;
}

function diagonal(progress: number): string | undefined {
  if (progress >= 1) return undefined;
  const open = clamp01(progress);
  const leg = `calc(${round(open * 300)}% + ${round(open * BLEED * 5 - BLEED)}px)`;
  return `polygon(-${BLEED}px -${BLEED}px, ${leg} -${BLEED}px, -${BLEED}px ${leg})`;
}

/** Sobe por trás de uma linha de base fixa: o recorte de baixo acompanha o deslocamento. */
function baseline(progress: number, distance: number): string | undefined {
  if (progress >= 1) return undefined;
  return `inset(-${BLEED}px -${BLEED}px ${round(Math.max(0, from(distance, progress)))}px -${BLEED}px)`;
}

type PresetInput = Omit<EntrancePreset, 'durationSec' | 'staggerSec' | 'easing' | 'unit'> &
  Partial<Pick<EntrancePreset, 'durationSec' | 'staggerSec' | 'easing' | 'unit'>>;

function preset(input: PresetInput): EntrancePreset {
  const unit = input.unit ?? 'block';
  return { unit, durationSec: 0.4, staggerSec: STAGGER[unit], easing: 'enter', ...input };
}

const presets: EntrancePreset[] = [
  // fade
  preset({
    id: 'fade',
    label: 'Fade',
    description: 'Padrão neutro, quando o elemento só precisa aparecer sem chamar atenção.',
    category: 'fade',
    style: (p) => ({ opacity: fade(p) }),
  }),
  preset({
    id: 'fade-up',
    label: 'Fade subindo',
    description: 'Entrada padrão de cartões e textos na base ou no centro da tela.',
    category: 'fade',
    style: (p) => ({ opacity: fade(p), y: from(24, p) }),
  }),
  preset({
    id: 'fade-down',
    label: 'Fade descendo',
    description: 'Para o que nasce no topo da tela, como selos e avisos.',
    category: 'fade',
    style: (p) => ({ opacity: fade(p), y: from(-24, p) }),
  }),
  preset({
    id: 'fade-left',
    label: 'Fade para a esquerda',
    description: 'Elemento ancorado à direita, entrando em direção ao centro.',
    category: 'fade',
    style: (p) => ({ opacity: fade(p), x: from(28, p) }),
  }),
  preset({
    id: 'fade-right',
    label: 'Fade para a direita',
    description: 'Elemento ancorado à esquerda, entrando em direção ao centro.',
    category: 'fade',
    style: (p) => ({ opacity: fade(p), x: from(-28, p) }),
  }),

  // slide
  preset({
    id: 'slide-up',
    label: 'Deslize para cima',
    description: 'Painel grande que sobe da base, com mais presença que o fade.',
    category: 'slide',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p, 2), y: from(60, p) }),
  }),
  preset({
    id: 'slide-down',
    label: 'Deslize para baixo',
    description: 'Faixa ou barra que desce do topo.',
    category: 'slide',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p, 2), y: from(-60, p) }),
  }),
  preset({
    id: 'slide-left',
    label: 'Deslize para a esquerda',
    description: 'Cartão lateral que chega pela direita, como uma lista ao lado de quem fala.',
    category: 'slide',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p, 2), x: from(60, p) }),
  }),
  preset({
    id: 'slide-right',
    label: 'Deslize para a direita',
    description: 'Cartão lateral que chega pela esquerda, como um lower third.',
    category: 'slide',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p, 2), x: from(-60, p) }),
  }),
  preset({
    id: 'slide-skew',
    label: 'Deslize inclinado',
    description: 'Troca de energia: o elemento chega com pressa e se endireita.',
    category: 'slide',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p, 2), x: from(56, p), skewX: from(-8, p) }),
  }),
  preset({
    id: 'drift-up',
    label: 'Deriva lenta',
    description: 'Tom sóbrio ou investigativo: sobe devagar, sem arrancada.',
    category: 'slide',
    durationSec: 0.7,
    easing: 'move',
    style: (p) => ({ opacity: fade(p), y: from(40, p) }),
  }),

  // scale
  preset({
    id: 'scale-in',
    label: 'Escala',
    description: 'Cartão central que ganha corpo, como diagramas e código.',
    category: 'scale',
    style: (p) => ({ opacity: fade(p), scale: scaleFrom(0.92, p) }),
  }),
  preset({
    id: 'scale-settle',
    label: 'Assentar',
    description: 'Imagem ou print que pousa na tela vindo de perto.',
    category: 'scale',
    style: (p) => ({ opacity: fade(p), scale: scaleFrom(1.06, p) }),
  }),
  preset({
    id: 'scale-corner',
    label: 'Escala pelo canto',
    description: 'Balão ou callout que nasce do ponto que ele aponta.',
    category: 'scale',
    style: (p) => ({ opacity: fade(p), scale: scaleFrom(0.9, p), transformOrigin: 'left top' }),
  }),
  preset({
    id: 'scale-rise',
    label: 'Escala subindo',
    description: 'Cartão que cresce a partir da base enquanto sobe.',
    category: 'scale',
    style: (p) => ({ opacity: fade(p), scale: scaleFrom(0.94, p), y: from(18, p), transformOrigin: 'center bottom' }),
  }),
  preset({
    id: 'grow-x',
    label: 'Crescer na horizontal',
    description: 'Traços, sublinhados e barras horizontais que se desenham da esquerda.',
    category: 'scale',
    style: (p) => ({ scaleX: Math.max(0, p), transformOrigin: 'left center' }),
  }),
  preset({
    id: 'grow-y',
    label: 'Crescer na vertical',
    description: 'Barras de acento e colunas de gráfico que sobem da base.',
    category: 'scale',
    style: (p) => ({ scaleY: Math.max(0, p), transformOrigin: 'center bottom' }),
  }),

  // mask
  preset({
    id: 'wipe-right',
    label: 'Cortina para a direita',
    description: 'Revela no sentido da leitura; bom para títulos e linhas de código.',
    category: 'mask',
    durationSec: 0.5,
    style: (p) => ({ clipPath: inset(p, 0, 1, 0, 0) }),
  }),
  preset({
    id: 'wipe-left',
    label: 'Cortina para a esquerda',
    description: 'Revela da direita para a esquerda, para elementos ancorados à direita.',
    category: 'mask',
    durationSec: 0.5,
    style: (p) => ({ clipPath: inset(p, 0, 0, 0, 1) }),
  }),
  preset({
    id: 'wipe-up',
    label: 'Cortina para cima',
    description: 'Revela de baixo para cima, como algo sendo erguido.',
    category: 'mask',
    durationSec: 0.5,
    style: (p) => ({ clipPath: inset(p, 1, 0, 0, 0) }),
  }),
  preset({
    id: 'wipe-down',
    label: 'Cortina para baixo',
    description: 'Revela de cima para baixo, para listas e blocos longos.',
    category: 'mask',
    durationSec: 0.5,
    style: (p) => ({ clipPath: inset(p, 0, 0, 1, 0) }),
  }),
  preset({
    id: 'split-x',
    label: 'Abrir do centro',
    description: 'Título de capítulo que se abre para os dois lados.',
    category: 'mask',
    durationSec: 0.5,
    style: (p) => ({ clipPath: inset(p, 0, 0.5, 0, 0.5) }),
  }),
  preset({
    id: 'split-y',
    label: 'Abrir na vertical',
    description: 'Faixa que se abre a partir da linha do meio.',
    category: 'mask',
    durationSec: 0.5,
    style: (p) => ({ clipPath: inset(p, 0.5, 0, 0.5, 0) }),
  }),
  preset({
    id: 'iris',
    label: 'Íris',
    description: 'Foco em um ponto: ícone, avatar ou detalhe que abre do centro.',
    category: 'mask',
    durationSec: 0.5,
    style: (p) => ({ clipPath: iris(p) }),
  }),
  preset({
    id: 'wipe-diagonal',
    label: 'Cortina diagonal',
    description: 'Revela pela diagonal, para imagens e cartões de destaque.',
    category: 'mask',
    durationSec: 0.6,
    style: (p) => ({ clipPath: diagonal(p) }),
  }),
  preset({
    id: 'mask-rise',
    label: 'Máscara subindo',
    description: 'Título que emerge de trás de uma linha de base.',
    category: 'mask',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p, 2.5), y: from(56, p), clipPath: baseline(p, 56) }),
  }),

  // blur
  preset({
    id: 'blur-in',
    label: 'Foco',
    description: 'Entrada suave e parada, para frases de impacto no centro.',
    category: 'blur',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p), blur: Math.max(0, from(12, p)) }),
  }),
  preset({
    id: 'blur-up',
    label: 'Foco subindo',
    description: 'Como o fade subindo, com mais delicadeza; bom em tom sério.',
    category: 'blur',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p), blur: Math.max(0, from(10, p)), y: from(20, p) }),
  }),
  preset({
    id: 'blur-focus',
    label: 'Puxar foco',
    description: 'Imagem ou print que entra em foco como em uma lente.',
    category: 'blur',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p), blur: Math.max(0, from(10, p)), scale: scaleFrom(1.04, p) }),
  }),
  preset({
    id: 'blur-slide',
    label: 'Foco lateral',
    description: 'Elemento lateral que chega em movimento e ganha nitidez.',
    category: 'blur',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p), blur: Math.max(0, from(8, p)), x: from(-32, p) }),
  }),

  // rotate
  preset({
    id: 'tilt-left',
    label: 'Inclinar da esquerda',
    description: 'Cartão informal que se endireita ao subir; tom leve.',
    category: 'rotate',
    style: (p) => ({ opacity: fade(p), rotate: from(-3, p), y: from(24, p) }),
  }),
  preset({
    id: 'tilt-right',
    label: 'Inclinar da direita',
    description: 'Par do anterior, para alternar o lado em uma sequência.',
    category: 'rotate',
    style: (p) => ({ opacity: fade(p), rotate: from(3, p), y: from(24, p) }),
  }),
  preset({
    id: 'swing-in',
    label: 'Dobradiça',
    description: 'Etiqueta ou nota presa por um canto que gira até o lugar.',
    category: 'rotate',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p), rotate: from(5, p), transformOrigin: 'left top' }),
  }),
  preset({
    id: 'skew-in',
    label: 'Endireitar',
    description: 'Elemento que chega inclinado pela esquerda e se endireita.',
    category: 'rotate',
    style: (p) => ({ opacity: fade(p), skewX: from(8, p), x: from(-24, p) }),
  }),

  // text
  preset({
    id: 'lines-rise',
    label: 'Linhas subindo',
    description: 'Parágrafo curto ou título de duas linhas, uma linha por vez.',
    category: 'text',
    unit: 'line',
    style: (p) => ({ opacity: fade(p), y: from(28, p) }),
  }),
  preset({
    id: 'lines-wipe',
    label: 'Linhas em cortina',
    description: 'Texto que se escreve linha a linha no sentido da leitura.',
    category: 'text',
    unit: 'line',
    durationSec: 0.5,
    style: (p) => ({ clipPath: inset(p, 0, 1, 0, 0) }),
  }),
  preset({
    id: 'lines-mask-rise',
    label: 'Linhas em máscara',
    description: 'Título editorial: cada linha emerge da própria linha de base.',
    category: 'text',
    unit: 'line',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p, 2.5), y: from(56, p), clipPath: baseline(p, 56) }),
  }),
  preset({
    id: 'words-rise',
    label: 'Palavras subindo',
    description: 'Frase dita em voz alta, palavra por palavra no ritmo da fala.',
    category: 'text',
    unit: 'word',
    style: (p) => ({ opacity: fade(p), y: from(22, p) }),
  }),
  preset({
    id: 'words-fade',
    label: 'Palavras em fade',
    description: 'Citação ou definição lida com calma, sem movimento.',
    category: 'text',
    unit: 'word',
    style: (p) => ({ opacity: fade(p) }),
  }),
  preset({
    id: 'words-blur',
    label: 'Palavras em foco',
    description: 'Frase de abertura ou de fechamento, com peso.',
    category: 'text',
    unit: 'word',
    durationSec: 0.5,
    style: (p) => ({ opacity: fade(p), blur: Math.max(0, from(8, p)) }),
  }),
  preset({
    id: 'words-scale',
    label: 'Palavras crescendo',
    description: 'Lista de termos curtos que brotam da linha de base.',
    category: 'text',
    unit: 'word',
    style: (p) => ({ opacity: fade(p), scale: scaleFrom(0.9, p), transformOrigin: 'center bottom' }),
  }),
  preset({
    id: 'chars-fade',
    label: 'Letras em fade',
    description: 'Efeito de digitação suave para nomes, comandos e termos técnicos.',
    category: 'text',
    unit: 'char',
    durationSec: 0.2,
    style: (p) => ({ opacity: fade(p) }),
  }),
  preset({
    id: 'chars-rise',
    label: 'Letras subindo',
    description: 'Palavra única em destaque, como o nome de uma tecnologia.',
    category: 'text',
    unit: 'char',
    style: (p) => ({ opacity: fade(p), y: from(16, p) }),
  }),
  preset({
    id: 'tracking-in',
    label: 'Fechar espaçamento',
    description: 'Eyebrow ou rótulo em caixa alta que se fecha até o tracking final.',
    category: 'text',
    unit: 'line',
    durationSec: 0.6,
    style: (p) => ({ opacity: fade(p), letterSpacing: Math.max(0, from(0.2, p)) }),
  }),

  // emphasis
  preset({
    id: 'pop',
    label: 'Pop',
    description: 'O único destaque da cena: número, selo ou resposta.',
    category: 'emphasis',
    easing: 'pop',
    style: (p) => ({ opacity: fade(p, 2), scale: scaleFrom(0.9, p) }),
  }),
  preset({
    id: 'pop-up',
    label: 'Pop subindo',
    description: 'Destaque que salta da base, como um botão de inscrição.',
    category: 'emphasis',
    easing: 'pop',
    style: (p) => ({ opacity: fade(p, 2), scale: scaleFrom(0.94, p), y: from(20, p) }),
  }),
  preset({
    id: 'stamp',
    label: 'Carimbo',
    description: 'Veredito sobre o que está na tela: certo, errado, resolvido.',
    category: 'emphasis',
    easing: 'pop',
    style: (p) => ({ opacity: fade(p, 2), scale: scaleFrom(1.12, p) }),
  }),
  preset({
    id: 'pop-tilt',
    label: 'Adesivo',
    description: 'Selo informal colado com leve giro; só em tom de humor.',
    category: 'emphasis',
    easing: 'pop',
    style: (p) => ({ opacity: fade(p, 2), scale: scaleFrom(0.92, p), rotate: from(-4, p) }),
  }),
  preset({
    id: 'words-pop',
    label: 'Palavras em pop',
    description: 'Frase curta de efeito, com cada palavra batendo no ritmo.',
    category: 'emphasis',
    unit: 'word',
    easing: 'pop',
    staggerSec: 0.08,
    style: (p) => ({ opacity: fade(p, 2), scale: scaleFrom(0.86, p), transformOrigin: 'center bottom' }),
  }),
  preset({
    id: 'chars-pop',
    label: 'Letras em pop',
    description: 'Uma palavra-chave que merece peso, letra por letra.',
    category: 'emphasis',
    unit: 'char',
    easing: 'pop',
    staggerSec: 0.03,
    style: (p) => ({ opacity: fade(p, 2), y: from(14, p) }),
  }),
];

export const entrances: Record<string, EntrancePreset> = Object.fromEntries(presets.map((item) => [item.id, item]));

export function getEntrance(id: string): EntrancePreset {
  const found = entrances[id];
  if (!found) throw new Error(`Efeito de entrada desconhecido: "${id}"`);
  return found;
}

/** Monta `transform`, `filter` e `clipPath`; o que está em repouso fica de fora do CSS. */
export function toCss(style: EntranceStyle): CSSProperties {
  const css: CSSProperties = {};
  if (style.opacity !== undefined) css.opacity = round(clamp01(style.opacity));

  const x = style.x ?? 0;
  const y = style.y ?? 0;
  const scaleX = (style.scale ?? 1) * (style.scaleX ?? 1);
  const scaleY = (style.scale ?? 1) * (style.scaleY ?? 1);
  const transform: string[] = [];
  if (x !== 0 || y !== 0) transform.push(`translate(${round(x)}px, ${round(y)}px)`);
  if (style.rotate) transform.push(`rotate(${round(style.rotate)}deg)`);
  if (style.skewX) transform.push(`skewX(${round(style.skewX)}deg)`);
  if (scaleX !== 1 || scaleY !== 1) transform.push(`scale(${round(scaleX)}, ${round(scaleY)})`);
  if (transform.length > 0) {
    css.transform = transform.join(' ');
    if (style.transformOrigin) css.transformOrigin = style.transformOrigin;
  }

  if (style.blur !== undefined && style.blur > 0) css.filter = `blur(${round(style.blur)}px)`;
  if (style.clipPath) css.clipPath = style.clipPath;
  if (style.letterSpacing) css.letterSpacing = `${round(style.letterSpacing)}em`;
  return css;
}

export function entranceStyle(id: string, progress: number): EntranceStyle {
  return getEntrance(id).style(progress);
}

/** Saída = a entrada de trás para a frente, com metade do deslocamento: quem sai não pode competir com quem entra. */
export function exitStyle(id: string, progress: number): EntranceStyle {
  const style = getEntrance(id).style(1 - clamp01(progress));
  const halved: EntranceStyle = { ...style };
  for (const key of ['x', 'y', 'rotate', 'skewX'] as const) {
    const value = style[key];
    if (value !== undefined) halved[key] = value / 2;
  }
  return halved;
}

/** `progress` 0→1 já com o easing do preset aplicado por quem chama. */
export function entranceCss(id: string, progress: number): CSSProperties {
  return toCss(entranceStyle(id, progress));
}

/** `progress` 0→1 (0 = repouso, 1 = fora), já com `motion.exit` aplicado por quem chama. */
export function exitCss(id: string, progress: number): CSSProperties {
  return toCss(exitStyle(id, progress));
}

export function exitDurationSec(preset: EntrancePreset): number {
  return Math.max(MIN_EXIT_SEC, preset.durationSec / 2);
}

/** Atraso em segundos do i-ésimo unit (linha, palavra, caractere ou elemento irmão). */
export function unitDelay(preset: EntrancePreset, index: number): number {
  return index * preset.staggerSec;
}

/** Instante em que o último de `count` units termina de entrar. */
export function entranceEndSec(preset: EntrancePreset, count: number): number {
  return unitDelay(preset, Math.max(0, count - 1)) + preset.durationSec;
}

export interface TextToken {
  text: string;
  /** ordem de animação; `null` é espaço, que não anima */
  index: number | null;
  /** palavra a que o caractere pertence, para a linha não quebrar no meio dela */
  group: number;
}

const graphemes = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

/**
 * Divide o texto pela unidade do preset sem perder nenhum caractere: `word` e `char` devolvem
 * os espaços como tokens próprios; `line` quebra em `\n` (quem chama decide as linhas).
 */
export function splitUnits(text: string, unit: EntranceUnit): TextToken[] {
  if (unit === 'block') return [{ text, index: 0, group: 0 }];
  if (unit === 'line') return text.split('\n').map((line, index) => ({ text: line, index, group: index }));

  const tokens: TextToken[] = [];
  let index = 0;
  let group = 0;
  for (const part of text.split(/(\s+)/)) {
    if (part === '') continue;
    if (/^\s+$/.test(part)) {
      tokens.push({ text: part, index: null, group: -1 });
      continue;
    }
    if (unit === 'word') {
      tokens.push({ text: part, index: index++, group });
    } else {
      for (const { segment } of graphemes.segment(part)) tokens.push({ text: segment, index: index++, group });
    }
    group++;
  }
  return tokens;
}

const PAGE_SIZE = 10;

export function paginate(ids: readonly string[], size: number = PAGE_SIZE): string[][] {
  const pages: string[][] = [];
  for (let start = 0; start < ids.length; start += size) pages.push(ids.slice(start, start + size));
  return pages;
}
