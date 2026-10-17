import type { CaptionStyle, StyledCaption } from '../types';

/**
 * Estilos de legenda (`captions.preset` na EDL). Módulo puro: o pipeline lê os limites de página daqui
 * e o componente `Captions` lê a aparência. As cores são chaves de `theme.color`, nunca hex solto.
 */
export const CAPTION_PRESETS = ['padrao', 'karaoke', 'pop', 'destaque-caixa', 'minimal', 'bold-shorts'] as const;
export type CaptionPreset = (typeof CAPTION_PRESETS)[number];

export type ColorToken = 'white' | 'coral' | 'coralDeep' | 'emerald' | 'glowPeach' | 'ink';

/** Como a palavra que está sendo falada se diferencia das outras. */
export type ActiveMode = 'scale' | 'fill' | 'pop' | 'pill' | 'none';

interface PerFormat<T> {
  long: T;
  shorts: T;
}

export interface CaptionLookSpec {
  label: string;
  description: string;
  /** quando usar (STYLE.md §7) */
  when: string;
  fontSize: PerFormat<number>;
  fontWeight: 600 | 800;
  /** `shorts`: só no formato vertical (o padrão de sempre) */
  uppercase: boolean | 'shorts';
  /** contorno `ink` em px; 0 = sem contorno */
  stroke: PerFormat<number>;
  shadow: 'deep' | 'soft';
  active: ActiveMode;
  /** cor da palavra ativa (`fill`: cor que preenche; `pill`: fundo da caixa) */
  activeColor: ColorToken;
  /** escala extra da palavra ativa */
  activeScale: number;
  /** palavra ainda não falada */
  upcomingOpacity: number;
  highlightColor: ColorToken;
  /** teto de palavras por página (o menor entre este e `maxWordsPerPage` da EDL) */
  maxWords?: number;
  /** largura máxima da página em caracteres; sem valor, a do formato */
  maxChars?: PerFormat<number>;
  /** nunca quebra a página em duas linhas */
  singleLine: boolean;
  /** espaço entre palavras em px; sem valor, o de sempre. Pop e caixa precisam de folga: a palavra ativa cresce/ganha fundo */
  wordGap?: PerFormat<number>;
}

/** Espaço entre palavras de sempre. */
export const DEFAULT_WORD_GAP: PerFormat<number> = { long: 18, shorts: 22 };

/** Largura de página de sempre (antes dos estilos existirem). */
export const DEFAULT_MAX_CHARS: PerFormat<number> = { long: 34, shorts: 16 };

export const captionPresets: Record<CaptionPreset, CaptionLookSpec> = {
  padrao: {
    label: 'Padrão',
    description: 'Inter 800 branca com contorno escuro; a palavra falada acende e cresce 5%, as próximas esperam a meia-luz.',
    when: 'vídeo longo 16:9 (o default); qualquer EDL sem preset continua assim',
    fontSize: { long: 58, shorts: 84 },
    fontWeight: 800,
    uppercase: 'shorts',
    stroke: { long: 9, shorts: 12 },
    shadow: 'deep',
    active: 'scale',
    activeColor: 'white',
    activeScale: 0.05,
    upcomingOpacity: 0.55,
    highlightColor: 'coral',
    singleLine: false,
  },
  karaoke: {
    label: 'Karaokê',
    description: 'A página inteira aparece branca e a palavra falada se preenche de coral da esquerda para a direita, no tempo da fala.',
    when: 'tutorial falado e trecho de leitura, quando seguir a fala palavra a palavra ajuda',
    fontSize: { long: 58, shorts: 84 },
    fontWeight: 800,
    uppercase: 'shorts',
    stroke: { long: 9, shorts: 12 },
    shadow: 'deep',
    active: 'fill',
    activeColor: 'coral',
    activeScale: 0,
    upcomingOpacity: 1,
    highlightColor: 'emerald',
    singleLine: false,
  },
  pop: {
    label: 'Pop',
    description: 'Cada palavra surge quando é dita, entrando com escala e overshoot (curva pop); a ativa fica 12% maior.',
    when: 'trecho enérgico, gancho e piada; evite em explicação longa (cansa)',
    fontSize: { long: 62, shorts: 88 },
    fontWeight: 800,
    uppercase: 'shorts',
    stroke: { long: 9, shorts: 12 },
    shadow: 'deep',
    active: 'pop',
    activeColor: 'white',
    activeScale: 0.12,
    upcomingOpacity: 0,
    highlightColor: 'coral',
    maxWords: 4,
    singleLine: false,
    wordGap: { long: 30, shorts: 34 },
  },
  'destaque-caixa': {
    label: 'Destaque em caixa',
    description: 'A palavra falada ganha uma pill coral atrás dela, que acompanha a fala; as outras ficam brancas com contorno.',
    when: 'vídeo com fundo muito movimentado ou claro, onde só o contorno não basta para guiar o olho',
    fontSize: { long: 58, shorts: 84 },
    fontWeight: 800,
    uppercase: 'shorts',
    stroke: { long: 9, shorts: 12 },
    shadow: 'deep',
    active: 'pill',
    activeColor: 'coral',
    activeScale: 0,
    upcomingOpacity: 1,
    highlightColor: 'coral',
    singleLine: false,
    wordGap: { long: 26, shorts: 30 },
  },
  minimal: {
    label: 'Minimal',
    description: 'Uma linha só, Inter 600 menor, sem contorno e com sombra suave; sem efeito na palavra ativa.',
    when: 'vídeo sóbrio, entrevista ou tela gravada cheia de informação, onde a legenda não pode competir',
    fontSize: { long: 46, shorts: 64 },
    fontWeight: 600,
    uppercase: false,
    stroke: { long: 0, shorts: 0 },
    shadow: 'soft',
    active: 'none',
    activeColor: 'white',
    activeScale: 0,
    upcomingOpacity: 1,
    highlightColor: 'coral',
    maxChars: { long: 42, shorts: 22 },
    singleLine: true,
  },
  'bold-shorts': {
    label: 'Bold Shorts',
    description: 'Caixa alta, enorme, de 1 a 3 palavras por página; a palavra ativa fica pêssego e cresce.',
    when: 'Short 9:16 (pensado para o vertical); no 16:9 só em vinheta ou frase de efeito',
    fontSize: { long: 96, shorts: 112 },
    fontWeight: 800,
    uppercase: true,
    stroke: { long: 14, shorts: 14 },
    shadow: 'deep',
    active: 'scale',
    activeColor: 'glowPeach',
    activeScale: 0.08,
    upcomingOpacity: 1,
    highlightColor: 'coral',
    maxWords: 3,
    maxChars: { long: 22, shorts: 14 },
    singleLine: false,
    wordGap: { long: 40, shorts: 34 },
  },
};

/**
 * Geometria da página de legenda: o `Captions` desenha com estes números e o Short (motion/src/vertical.ts)
 * calcula a faixa que nenhum gráfico pode cobrir. Página de no máximo 2 linhas (3 palavras, 16 caracteres no vertical).
 */
export const CAPTION_LAYOUT = {
  bottom: { long: 92, shorts: 420 } as PerFormat<number>,
  lineHeight: 1.18,
  rowGap: 6,
  /** a página entra subindo estes px */
  enterShift: 14,
  maxLines: 2,
} as const;

/** Aparência concreta de um estilo num formato. */
export interface CaptionLook {
  fontSize: number;
  fontWeight: 600 | 800;
  uppercase: boolean;
  stroke: number;
  shadow: string;
  active: ActiveMode;
  activeColor: ColorToken;
  activeScale: number;
  upcomingOpacity: number;
  highlightColor: ColorToken;
  singleLine: boolean;
  wordGap: number;
}

const SHADOWS = { deep: '0 6px 18px rgba(0,0,0,0.45)', soft: '0 2px 10px rgba(0,0,0,0.6)' } as const;

export function resolveLook(preset: CaptionPreset, style: CaptionStyle): CaptionLook {
  const spec = captionPresets[preset];
  return {
    fontSize: spec.fontSize[style],
    fontWeight: spec.fontWeight,
    uppercase: spec.uppercase === 'shorts' ? style === 'shorts' : spec.uppercase,
    stroke: spec.stroke[style],
    shadow: SHADOWS[spec.shadow],
    active: spec.active,
    activeColor: spec.activeColor,
    activeScale: spec.activeScale,
    upcomingOpacity: spec.upcomingOpacity,
    highlightColor: spec.highlightColor,
    singleLine: spec.singleLine,
    wordGap: (spec.wordGap ?? DEFAULT_WORD_GAP)[style],
  };
}

/** Limites de paginação que o pipeline aplica: o estilo só aperta, nunca afrouxa o que a EDL pediu. */
export function pageLimits(preset: CaptionPreset, style: CaptionStyle, maxWordsPerPage: number): { maxWords: number; maxChars: number } {
  const spec = captionPresets[preset];
  return {
    maxWords: Math.min(maxWordsPerPage, spec.maxWords ?? Infinity),
    maxChars: (spec.maxChars ?? DEFAULT_MAX_CHARS)[style],
  };
}

/** Janela extra em que a palavra continua "ativa" depois de acabar (evita piscar entre palavras coladas). */
export const ACTIVE_TAIL_MS = 60;

export interface WordPhase {
  spoken: boolean;
  active: boolean;
  /** 0–1 ao longo da duração da palavra (karaokê) */
  progress: number;
}

export function wordPhase(word: Pick<StyledCaption, 'startMs' | 'endMs'>, nowMs: number): WordPhase {
  const spoken = nowMs >= word.startMs;
  const duration = Math.max(1, word.endMs - word.startMs);
  return {
    spoken,
    active: spoken && nowMs < word.endMs + ACTIVE_TAIL_MS,
    progress: Math.min(1, Math.max(0, (nowMs - word.startMs) / duration)),
  };
}

/** Índice da palavra sendo falada na página (-1 antes da primeira e depois da cauda da última). */
export function activeWordIndex(words: Pick<StyledCaption, 'startMs' | 'endMs'>[], nowMs: number): number {
  for (let index = words.length - 1; index >= 0; index -= 1) {
    const word = words[index]!;
    if (nowMs >= word.startMs) return nowMs < word.endMs + ACTIVE_TAIL_MS ? index : -1;
  }
  return -1;
}

/**
 * Garante o teto de palavras por página sem desfazer as quebras que já vieram (frase, pausa, corte):
 * só acrescenta quebras. Sem teto, devolve a mesma lista.
 */
export function enforceMaxWords<T extends Pick<StyledCaption, 'pageBreakAfter'>>(captions: T[], maxWords: number | undefined): T[] {
  if (!maxWords) return captions;
  let count = 0;
  return captions.map((caption) => {
    count += 1;
    if (caption.pageBreakAfter || count >= maxWords) {
      count = 0;
      return caption.pageBreakAfter ? caption : { ...caption, pageBreakAfter: true };
    }
    return caption;
  });
}
