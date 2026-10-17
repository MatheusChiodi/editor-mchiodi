// Contas compartilhadas pelos modelos PilhaEmDoisGrupos, ColunasComLinhaParada, DegrauEVao, FileiraDeItens,
// HubComSatelites, CartaoComContadoresESelo e TrocaEntreDoisPolos. Só funções puras (testadas em tests/models-a.test.ts).
// Nome em minúsculas: o `scenes sync` só registra arquivos PascalCase.
import { type IconName, isIconName } from '../../scene-kit/icons';
import { CAPTION_ZONE } from '../../scene-kit/tokens';
import { theme } from '../../theme';

/** Área útil de uma cena em 1080p: dentro da margem segura e acima da faixa das legendas. */
export const AREA = { width: 1920 - theme.safe.x * 2, height: 1080 - theme.safe.y - CAPTION_ZONE } as const;

/** Nenhum texto de modelo fica abaixo disto (px em 1080p). */
export const MIN_TEXT = 34;

/** Largura média de um caractere em fração do tamanho da fonte (arredondada para cima: melhor sobrar que estourar). */
export const CHAR = { body: 0.56, bold: 0.6, display: 0.52, digits: 0.62 } as const;

export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : min)));
}

/** Largura estimada (px) de `text` em uma linha: os modelos decidem o layout sem medir o DOM. */
export function textWidth(text: string, fontSize: number, ratio: number = CHAR.body): number {
  return [...text].length * fontSize * ratio;
}

/** Maior tamanho entre `min` e `base` em que `text` cabe em `maxWidth` numa linha (`min` quando nem assim cabe). */
export function fitFont(text: string, maxWidth: number, base: number, min: number = MIN_TEXT, ratio: number = CHAR.body): number {
  const unit = textWidth(text, 1, ratio);
  if (unit <= 0) return base;
  return Math.max(min, Math.min(base, Math.floor(maxWidth / unit)));
}

/** Quantas linhas `text` ocupa em `maxWidth`, quebrando por palavra. */
export function lineCount(text: string, maxWidth: number, fontSize: number, ratio: number = CHAR.body): number {
  const space = fontSize * ratio;
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const width = textWidth(word, fontSize, ratio);
    if (used > 0 && used + space + width > maxWidth) {
      lines += 1;
      used = width;
    } else {
      used += (used > 0 ? space : 0) + width;
    }
  }
  return lines;
}

/** Largura estimada de uma `Pill` do kit: texto + padding (0.9em de cada lado) + borda, mais bolinha ou ícone. */
export function pillWidth(label: string, fontSize: number, adornment: 'none' | 'dot' | 'icon' = 'none'): number {
  const extra = adornment === 'dot' ? fontSize * 0.76 : adornment === 'icon' ? fontSize * 1.35 : 0;
  return Math.ceil(textWidth(label, fontSize) + fontSize * 1.8 + 4 + extra);
}

/** Tamanho de fonte de uma `Pill` para ela caber em `maxWidth`. */
export function fitPill(label: string, maxWidth: number, base = 36, adornment: 'none' | 'dot' | 'icon' = 'none'): number {
  for (let size = base; size > MIN_TEXT; size -= 1) if (pillWidth(label, size, adornment) <= maxWidth) return size;
  return MIN_TEXT;
}

/**
 * Tempos de uma lista: usa o que veio em `given` (por índice) e, onde falta, segue em sequência depois do anterior.
 * É o que deixa o diretor informar só os tempos que tirou da fala.
 */
export function sequence(count: number, given: readonly (number | null | undefined)[] | undefined, firstSec: number, staggerSec: number): number[] {
  const times: number[] = [];
  for (let index = 0; index < Math.max(0, count); index += 1) {
    const value = given?.[index];
    times.push(typeof value === 'number' && Number.isFinite(value) ? value : index === 0 ? firstSec : times[index - 1]! + staggerSec);
  }
  return times;
}

/** Tempo informado ou o padrão: props de tempo vêm do JSON da EDL, então podem faltar ou vir quebradas. */
export function timeOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Ícone pelo nome (vem do JSON da EDL): nome desconhecido cai no `fallback` em vez de quebrar o render. */
export function iconOr(name: unknown, fallback?: IconName): IconName | undefined {
  return typeof name === 'string' && isIconName(name) ? name : fallback;
}

/**
 * Tamanho do título (Playfair) para ele ficar em UMA linha dentro de `maxWidth`: os modelos calculam a altura do palco
 * contando com isso. Abaixo de `min` o título quebra em duas linhas (frase longa demais para a cena).
 */
export function titleSize(title: string, base: number, maxWidth = 1500, min = 60): number {
  return fitFont(title, maxWidth, base, Math.min(base, min), CHAR.display);
}

/** Altura estimada (px) de um `Statement` do kit: eyebrow, título (uma ou mais linhas) e apoio. */
export function statementHeight(title: string, fontSize: number, options: { eyebrow?: boolean; support?: string; maxWidth?: number } = {}): number {
  const maxWidth = options.maxWidth ?? 1500;
  const gap = fontSize * 0.3;
  const lines = lineCount(title, maxWidth, fontSize, CHAR.display);
  const supportLines = options.support ? lineCount(options.support, maxWidth * 0.8, 40) : 0;
  return Math.round((options.eyebrow ? MIN_TEXT * 1.2 + gap : 0) + lines * fontSize * 1.12 + (supportLines ? gap + supportLines * 40 * 1.4 : 0));
}

/** Caixa que o conteúdo de uma cena ocupa. Cabe quando não passa de `AREA`. */
export interface Extent {
  width: number;
  height: number;
}

export function fitsArea(extent: Extent): boolean {
  return extent.width <= AREA.width && extent.height <= AREA.height;
}

/** Texto de uma linha que não pode passar da caixa: o excesso vira reticências (sinal para o diretor encurtar o rótulo). */
export const CLIP = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

/** Estilo de uma `Pill` presa a `maxWidth`: o texto vai dentro de um `<span style={CLIP}>`. */
export function pillClamp(maxWidth: number): { maxWidth: number; boxSizing: 'border-box' } {
  return { maxWidth, boxSizing: 'border-box' };
}
