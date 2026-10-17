/**
 * Níveis de edição: quanto de zoom, gráfico, cena ilustrativa, transição, efeito e SFX um vídeo leva.
 * O nível fica na EDL (`level`); o diretor lê a orientação, e a autoavaliação cobra os limites e os alvos.
 * O STYLE.md §0 traz a mesma tabela em prosa: mudou aqui, mude lá.
 */
export const LEVEL_IDS = ['limpa', 'normal', 'pro', 'max'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export const DEFAULT_LEVEL: LevelId = 'normal';

export interface StyleLimits {
  /** distância mínima entre dois zooms (ou efeitos de câmera) */
  zoomMinGapSec: number;
  minClipSec: number;
  transitionMinGapSec: number;
  /** quantas transições diferentes cabem num vídeo */
  transitionKindsMax: number;
  /** transições de energia `high` por vídeo */
  highEnergyTransitionsMax: number;
  memeMinGapSec: number;
  overlayMinReadSec: number;
  /** distância mínima entre a entrada de dois gráficos */
  graphicMinGapSec: number;
  /** distância mínima entre duas cenas ilustrativas */
  sceneMinGapSec: number;
  /** maior intervalo sem nada novo na tela (overlay, item revelado, zoom, efeito, transição); null = não cobra */
  maxIdleSec: number | null;
  /**
   * Fatia mínima do vídeo que precisa estar editada (0–1). Um trecho conta como "sem edição" quando passa de
   * `maxIdleSec` sem nada novo: é o apresentador falando sozinho ou mostrando a tela. null = não cobra.
   */
  minEditedShare: number | null;
  /** duração máxima de cada trecho sem edição; null = não cobra */
  maxPlainSec: number | null;
  /**
   * Sincronia com a fala: cada entrada (o `at` do overlay e os cues internos) cai entre `before` segundos antes e
   * `after` depois do início de uma palavra. null = não cobra.
   */
  syncWindowSec: { before: number; after: number } | null;
  /** parte editada mínima entre dois trechos sem edição ("nunca dois respiros seguidos"); null = não cobra */
  minBetweenPlainSec: number | null;
  /** cobra a leitura mínima de cada item de texto (`minReadSec`: 1,2 s + 0,25 s por palavra) */
  itemMinRead: boolean;
}

/** Um padrão de edição que o nível exige (hoje, só o `max`): a linguagem medida no vídeo de referência. */
export interface RequiredPattern {
  id: string;
  label: string;
  /** componentes do arsenal que satisfazem o padrão */
  components?: string[];
  /** em vez de componente: overlays com `presenter` (palco) ou com `wipe: "tear"` */
  feature?: 'presenter' | 'tear';
  /** mínimo por minuto de vídeo final (arredonda para baixo, nunca menos que 1) */
  minPerMinute?: number;
  minPerVideo?: number;
  /** quando usar */
  when: string;
  /** como montar na EDL */
  how: string;
}

/** a troca de layout entra até 0,25 s antes da frase: o `at` do overlay pode adiantar isto além da janela de sincronia */
export const LAYOUT_LEAD_SEC = 0.1;

export const BUDGET_KEYS = ['zooms', 'graphics', 'scenes', 'transitions', 'effects', 'sfx'] as const;
export type BudgetKey = (typeof BUDGET_KEYS)[number];

export const BUDGET_LABEL: Record<BudgetKey, string> = {
  zooms: 'zooms',
  graphics: 'gráficos',
  scenes: 'cenas ilustrativas',
  transitions: 'transições',
  effects: 'efeitos',
  sfx: 'SFX',
};

/** itens por minuto de vídeo final */
export interface Rate {
  min: number;
  max: number;
}

export interface LevelProfile {
  id: LevelId;
  label: string;
  summary: string;
  limits: StyleLimits;
  perMinute: Record<BudgetKey, Rate>;
  /** o nível espera trilha do começo ao fim */
  music: boolean;
  /** vinhetas de abertura e encerramento ligadas já no rascunho */
  bumpers: boolean;
  /** como dirigir neste nível */
  guidance: string[];
  /** padrões obrigatórios: a avaliação avisa `padrao-obrigatorio` para cada um que faltar */
  required: RequiredPattern[];
}

const rate = (min: number, max: number): Rate => ({ min, max });

/**
 * Linguagem do vídeo de referência do nível max (análise em STYLE.md §0). Os mínimos são cerca de metade
 * da frequência medida nos 5 minutos editados dele: pílulas 5/min, palco 2,8/min, frase 1/min, rasgo 1/min.
 */
export const MAX_PATTERNS: RequiredPattern[] = [
  {
    id: 'pilulas',
    label: 'pílulas de resumo',
    components: ['PillStack'],
    minPerMinute: 1.5,
    when: 'sobre o talking head, a cada ideia: 2–5 palavras por pílula, a última em coral',
    how: '{ "component": "PillStack", "props": { "items": [{ "text": "...", "at": <s> }] } }',
  },
  {
    id: 'frase-serifada',
    label: 'frase serifada',
    components: ['PhraseReveal'],
    minPerMinute: 0.5,
    when: 'a tese do bloco ou o anúncio do que vem, ao lado do rosto',
    how: '{ "component": "PhraseReveal", "props": { "text": "Sem abrir o *terminal.*", "wordAt": [...] } }',
  },
  {
    id: 'apresentador-em-cartao',
    label: 'apresentador em cartão',
    feature: 'presenter',
    minPerMinute: 1,
    when: 'sempre que a tela inteira for de conteúdo: o footage encolhe para o cartão em vez de sumir',
    how: 'no overlay: "presenter": { "slot": "right" | "left" | "pip-br" | "pip-bl" | "pip-tr" | "pip-tl", "focus": { "x": 0.5, "y": 0.4 } }',
  },
  {
    id: 'explicacao-dividida',
    label: 'explicação dividida',
    components: ['SplitExplainer'],
    minPerMinute: 0.4,
    when: 'enumeração, comparação ou definição (antes × agora, A × B)',
    how: '{ "component": "SplitExplainer", "presenter": { "slot": "right" }, "hidesCaptions": true, "props": { "eyebrow": "...", "title": "... *palavra* ...", "cards": [...], "revealAt": [...] } }',
  },
  {
    id: 'janela-flutuante',
    label: 'janela flutuante',
    components: ['WindowStage'],
    minPerMinute: 0.4,
    when: 'demonstração: comando, resposta da ferramenta ou a gravação de tela',
    how: '{ "component": "WindowStage", "presenter": { "slot": "pip-br" }, "hidesCaptions": true, "props": { "lines": [...], "notes": [...] } }',
  },
  {
    id: 'rasgo-de-papel',
    label: 'rasgo de papel',
    feature: 'tear',
    minPerMinute: 0.5,
    when: 'entrada de cena ilustrativa de tela cheia',
    how: 'no overlay da cena: "wipe": "tear", "hidesCaptions": true',
  },
  {
    id: 'citacao-marca-texto',
    label: 'citação com marca-texto',
    components: ['DocQuote'],
    minPerVideo: 1,
    when: 'a fonte oficial de uma afirmação (documentação, artigo, changelog)',
    how: '{ "component": "DocQuote", "presenter": { "slot": "pip-br" }, "props": { "source": "...", "text": "... ==trecho== ...", "markAt": <s> } }',
  },
];

export const LEVELS: Record<LevelId, LevelProfile> = {
  limpa: {
    id: 'limpa',
    label: 'Limpa',
    summary: 'Só cortes, legendas, áudio e cor. Quase nenhum gráfico.',
    limits: {
      zoomMinGapSec: 45,
      minClipSec: 0.5,
      transitionMinGapSec: 60,
      transitionKindsMax: 1,
      highEnergyTransitionsMax: 0,
      memeMinGapSec: 600,
      overlayMinReadSec: 1.2,
      graphicMinGapSec: 30,
      sceneMinGapSec: 600,
      maxIdleSec: null,
      minEditedShare: null,
      maxPlainSec: null,
      syncWindowSec: null,
      minBetweenPlainSec: null,
      itemMinRead: false,
    },
    perMinute: {
      zooms: rate(0, 1),
      graphics: rate(0, 0.5),
      scenes: rate(0, 0),
      transitions: rate(0, 0.25),
      effects: rate(0, 0.2),
      sfx: rate(0, 0.5),
    },
    music: false,
    bumpers: false,
    guidance: [
      'Gráfico só para informação que falta na fala: LowerThird na apresentação, SectionTitle nos capítulos, CodeCard se código for ditado.',
      'Sem cena ilustrativa, meme, efeito ou SFX. Transição só `cross-dissolve`, em salto de tempo.',
      'Zoom só para disfarçar jump cut.',
    ],
    required: [],
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    summary: 'O padrão do canal: a edição serve à explicação e não aparece.',
    limits: {
      zoomMinGapSec: 20,
      minClipSec: 0.5,
      transitionMinGapSec: 20,
      transitionKindsMax: 3,
      highEnergyTransitionsMax: 3,
      memeMinGapSec: 90,
      overlayMinReadSec: 1.2,
      graphicMinGapSec: 12,
      sceneMinGapSec: 60,
      maxIdleSec: null,
      minEditedShare: null,
      maxPlainSec: null,
      syncWindowSec: null,
      minBetweenPlainSec: null,
      itemMinRead: false,
    },
    perMinute: {
      zooms: rate(0, 3),
      graphics: rate(0, 4),
      scenes: rate(0, 1),
      transitions: rate(0, 1.5),
      effects: rate(0, 1.5),
      sfx: rate(0, 4),
    },
    music: false,
    bumpers: false,
    guidance: [
      'Gráfico onde a fala pede imagem; trecho de conversa fica só com a fala.',
      'Cena ilustrativa apenas no que não se entende ouvindo.',
      'Corte seco por padrão; transição em troca de assunto, de cenário ou de tempo.',
    ],
    required: [],
  },
  pro: {
    id: 'pro',
    label: 'Profissional',
    summary: 'Edição densa: apoio visual constante, cenas ilustrativas, transições e som trabalhados.',
    limits: {
      zoomMinGapSec: 10,
      minClipSec: 0.5,
      transitionMinGapSec: 10,
      transitionKindsMax: 6,
      highEnergyTransitionsMax: 6,
      memeMinGapSec: 60,
      overlayMinReadSec: 1.2,
      graphicMinGapSec: 6,
      sceneMinGapSec: 30,
      maxIdleSec: null,
      minEditedShare: null,
      maxPlainSec: null,
      syncWindowSec: { before: 0.3, after: 0.25 },
      minBetweenPlainSec: null,
      itemMinRead: false,
    },
    perMinute: {
      zooms: rate(2, 6),
      graphics: rate(3, 6),
      scenes: rate(0.75, 2),
      transitions: rate(0.5, 2),
      effects: rate(0.5, 2),
      sfx: rate(2, 8),
    },
    music: true,
    bumpers: true,
    guidance: [
      'Toda troca de capítulo: stinger + SectionTitle + whoosh.',
      'Toda enumeração, número, código, termo novo e comparação vira gráfico; nenhum bloco de 20s sem apoio visual (gráfico, zoom ou destaque de legenda).',
      'Cena ilustrativa em cada conceito abstrato: delegue ao motion-designer em paralelo e alterne kit papel e kit voxel.',
      'Varie: entradas diferentes por tipo de conteúdo, até 6 transições distintas, zooms alternando punch/ease/ken-burns.',
      'Trilha com ducking do começo ao fim, SFX nas entradas de gráfico e nas transições, vinhetas ligadas e um `look` discreto no vídeo todo.',
    ],
    required: [],
  },
  max: {
    id: 'max',
    label: 'Máxima',
    summary: 'Lotada: algo novo na tela a cada poucos segundos, com o arsenal inteiro à disposição.',
    limits: {
      zoomMinGapSec: 6,
      minClipSec: 0.5,
      transitionMinGapSec: 6,
      transitionKindsMax: 10,
      highEnergyTransitionsMax: 10,
      memeMinGapSec: 40,
      overlayMinReadSec: 1.2,
      graphicMinGapSec: 4,
      sceneMinGapSec: 20,
      maxIdleSec: 8,
      // pedido do Matheus: até 80% do vídeo editado ao máximo; só alguns momentos dele falando ou mostrando a tela
      minEditedShare: 0.8,
      maxPlainSec: 40,
      // docs/referencia-max.md §10.5: nenhum elemento fora de [−0,15 s; +0,10 s] da palavra-gatilho
      syncWindowSec: { before: 0.15, after: 0.1 },
      minBetweenPlainSec: 15,
      itemMinRead: true,
    },
    perMinute: {
      // medido na referência: o movimento vem da troca de layout (9–12 gráficos/min), não de zoom nem de transição de corte
      zooms: rate(2, 9),
      graphics: rate(6, 12),
      scenes: rate(1.5, 3),
      transitions: rate(0.5, 3.5),
      effects: rate(0.5, 3),
      sfx: rate(4, 12),
    },
    music: true,
    bumpers: true,
    guidance: [
      'Pelo menos 80% do vídeo é editado ao máximo, do começo ao fim (a referência só edita os primeiros 27%: aqui não). Os até 20% restantes são respiros escolhidos: você falando sozinho numa parte pessoal ou mostrando algo na tela, cada um com no máximo 40s e nunca dois seguidos.',
      'Linguagem da referência (STYLE.md §0, "Padrões obrigatórios"): no trecho editado, algo novo na tela a cada 2–4s e nunca mais de 8s parado; troca de layout a cada ~8–10s.',
      'Tela gravada também é editada: dentro de `WindowStage`, com zoom no que é citado, pílulas anotando e o apresentador no canto; tela crua só conta como respiro.',
      'Sobre o talking head: `PillStack` resume cada ideia em 2–5 palavras (última pílula em coral) e `PhraseReveal` crava a tese do bloco com uma palavra em itálico coral.',
      'Enumeração ou comparação vira palco: `SplitExplainer` com `presenter: right`; demonstração vira `WindowStage` com `presenter: pip-br`; fonte citada vira `DocQuote`. O apresentador nunca é cortado: o footage encolhe para o cartão e cresce de volta.',
      'Cena ilustrativa a cada ~30s, entrando por rasgo de papel (`wipe: "tear"`); o que o arsenal não tem, o motion-designer cria.',
      'Todo elemento entra na palavra que o motiva (início da palavra − 2 frames, nunca antes) e fica pelo menos 1,2s + 0,25s por palavra; troca de layout 0,15–0,25s antes da frase.',
      'Varie o lado do cartão (`right`/`left`, `pip-br`/`pip-bl`) e não repita o mesmo palco mais de 2 vezes seguidas.',
      'Continua valendo: um gráfico por vez, nada cobre o rosto na hora da ênfase, todo item tem `reason`.',
    ],
    required: MAX_PATTERNS,
  },
};

const ALIASES: Record<string, LevelId> = {
  clean: 'limpa',
  limpo: 'limpa',
  minima: 'limpa',
  padrao: 'normal',
  default: 'normal',
  profissional: 'pro',
  professional: 'pro',
  maxima: 'max',
  maximo: 'max',
  lotada: 'max',
};

export function isLevel(value: unknown): value is LevelId {
  return typeof value === 'string' && (LEVEL_IDS as readonly string[]).includes(value);
}

/** Aceita o id ou um apelido ("profissional", "Máxima", "clean"); devolve null se não reconhecer. */
export function matchLevel(text: string): LevelId | null {
  const key = text.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (isLevel(key)) return key;
  return ALIASES[key] ?? null;
}

export function parseLevel(text: string): LevelId {
  const level = matchLevel(text);
  if (!level) throw new Error(`nível desconhecido: "${text}" (use ${LEVEL_IDS.join(', ')})`);
  return level;
}

export function levelProfile(level: LevelId = DEFAULT_LEVEL): LevelProfile {
  return LEVELS[level];
}

export function formatMinimum(pattern: RequiredPattern): string {
  return pattern.minPerMinute !== undefined ? `≥ ${pattern.minPerMinute}/min` : `≥ ${pattern.minPerVideo ?? 1}/vídeo`;
}

/** Quantas vezes o padrão precisa aparecer num vídeo desta duração: obrigatório é pelo menos uma. */
export function requiredCount(pattern: RequiredPattern, durationSec: number): number {
  const perMinute = Math.floor((pattern.minPerMinute ?? 0) * (durationSec / 60));
  return Math.max(1, perMinute, pattern.minPerVideo ?? 0);
}

const perMinute = (value: Rate) => (value.max === 0 ? 'nenhum' : `${value.min}–${value.max}/min`);

/** Tabela dos níveis (sem argumento) ou a ficha de um deles, para o diretor e para `mce levels`. */
export function formatLevels(only?: LevelId): string {
  if (!only) {
    return LEVEL_IDS.map((id) => `${id.padEnd(7)} ${LEVELS[id].label.padEnd(13)} ${LEVELS[id].summary}`).join('\n');
  }
  const profile = LEVELS[only];
  return [
    `${profile.id} — ${profile.label}: ${profile.summary}`,
    '',
    ...BUDGET_KEYS.map((key) => `${BUDGET_LABEL[key].padEnd(19)} ${perMinute(profile.perMinute[key])}`),
    `${'trilha'.padEnd(19)} ${profile.music ? 'do começo ao fim' : 'opcional'}`,
    `${'vinhetas'.padEnd(19)} ${profile.bumpers ? 'ligadas' : 'opcionais'}`,
    '',
    `distância mínima: zoom ${profile.limits.zoomMinGapSec}s · gráfico ${profile.limits.graphicMinGapSec}s · cena ${profile.limits.sceneMinGapSec}s · transição ${profile.limits.transitionMinGapSec}s · meme ${profile.limits.memeMinGapSec}s`,
    `transições: até ${profile.limits.transitionKindsMax} tipos diferentes, ${profile.limits.highEnergyTransitionsMax} de energia alta`,
    ...(profile.limits.maxIdleSec === null ? [] : [`tela parada: no máximo ${profile.limits.maxIdleSec}s sem nada novo no trecho editado`]),
    ...(profile.limits.minEditedShare === null
      ? []
      : [`cobertura: pelo menos ${Math.round(profile.limits.minEditedShare * 100)}% do vídeo editado${profile.limits.maxPlainSec === null ? '' : `; cada trecho sem edição com até ${profile.limits.maxPlainSec}s`}`]),
    ...(profile.limits.minBetweenPlainSec === null
      ? []
      : [`respiros: declare os escolhidos em \`breathers\`; pelo menos ${profile.limits.minBetweenPlainSec}s editados entre dois trechos sem edição`]),
    ...(profile.limits.syncWindowSec === null
      ? []
      : [
          `sincronia: cada entrada de ${profile.limits.syncWindowSec.before.toFixed(2)}s antes a ${profile.limits.syncWindowSec.after.toFixed(2)}s depois do início da palavra que a motiva (o \`at\` do overlay pode adiantar mais ${LAYOUT_LEAD_SEC.toFixed(2)}s)`,
        ]),
    ...(profile.limits.itemMinRead ? ['leitura: cada item de texto fica na tela pelo menos 1,2s + 0,25s por palavra'] : []),
    ...(profile.required.length
      ? ['', 'padrões obrigatórios:', ...profile.required.map((pattern) => `  ${pattern.label.padEnd(25)} ${formatMinimum(pattern).padEnd(12)} ${pattern.when}`)]
      : []),
    '',
    ...profile.guidance.map((line) => `- ${line}`),
  ].join('\n');
}
