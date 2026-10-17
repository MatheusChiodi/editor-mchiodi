// Tipos dos TEMAS de universo (analogias). Módulo puro: o lado Node (catálogo, lint, CLI) importa daqui sem carregar React nem Three.

export type ThemeCategory = 'super-herois' | 'fantasia' | 'ficcao-cientifica' | 'jogo-8bit' | 'anime' | 'esporte' | 'tabuleiro';

/**
 * `completo`: cenário, figuras, adereços, luz, moldura e transição próprios.
 * `minimo`: paleta + 2–3 peças próprias; o resto vem do tema da categoria (`base`).
 * `categoria`: o genérico da categoria, para a referência que não tem tema próprio.
 * `neutro`: o estilo padrão do canal (papel), para a analogia sem universo.
 */
export type ThemeStatus = 'completo' | 'minimo' | 'categoria' | 'neutro';

export interface ThemePalette {
  /** fundo/céu, de cima para baixo */
  sky: string[];
  /** massa do chão e do primeiro plano */
  ground: string;
  /** silhuetas distantes do cenário */
  shade: string;
  /** corpo das figuras */
  figure: string;
  /** cor-assinatura do universo: cenário e adereços, nunca o texto de conteúdo */
  primary: string;
  secondary: string;
  /** cor da luz (holofote, brilho, contraluz) */
  glow: string;
  /** título e texto de apoio escritos direto sobre o cenário */
  title: string;
  text: string;
  /** superfície dos cartões de conteúdo */
  panel: string;
  panelBorder: string;
  panelText: string;
  panelMuted: string;
  ok: string;
  danger: string;
}

export interface ThemeSpec {
  /** igual ao id do universo no catálogo (`src/analogy/catalog.ts`) e ao valor da prop `theme` na EDL */
  id: string;
  name: string;
  category: ThemeCategory | 'neutro';
  status: ThemeStatus;
  /** tema de que este herda cenário e figuras (os mínimos herdam do tema da categoria) */
  base?: string;
  /** cenário escuro: título em branco; claro: título em tinta */
  dark: boolean;
  palette: ThemePalette;
  /** fonte de apoio (rótulos de HUD, eyebrow): livre, do Google Fonts. O texto de conteúdo continua em Playfair/Inter */
  chromeFont: string;
  /** o que o tema desenha, em uma frase */
  description: string;
  /** peças de cenário e adereços próprias deste tema */
  pieces: string[];
  /** como o tema evoca o universo sem reproduzir nada dele */
  rights: string;
}

/** Papéis que um modelo de analogia pede ao tema. Cada tema desenha cada papel do seu jeito. */
export type ActorKind = 'hero' | 'helper' | 'villain' | 'member' | 'emblem' | 'node' | 'block' | 'choice' | 'aura';

export const ACTOR_KINDS: readonly ActorKind[] = ['hero', 'helper', 'villain', 'member', 'emblem', 'node', 'block', 'choice', 'aura'];

export type ActorState = 'idle' | 'active' | 'done' | 'locked' | 'hit' | 'dim';

/** Um elemento do mundo, posicionado pelo layout puro do modelo em px de um quadro 1920×1080. */
export interface Actor {
  id: string;
  kind: ActorKind;
  /** centro horizontal */
  x: number;
  /** base (os pés, o pé do bloco) */
  y: number;
  /** altura */
  h: number;
  /** largura, para as peças que não são figuras (bloco, nó); o padrão é a altura */
  w?: number;
  /** variação do desenho: membro 0..5 da equipe, opção 0/1 da escolha, tipo do bloco */
  variant?: number;
  /** 0→1: entrada */
  progress?: number;
  state?: ActorState;
  /** olha para a esquerda */
  flip?: boolean;
  /** 0–1: energia extra (golpe recebido, brilho da subida de nível) */
  energy?: number;
}
