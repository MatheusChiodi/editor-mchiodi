export type TransitionKind = 'xfade' | 'stinger';

export interface TransitionPreset {
  /** kebab-case, igual à chave */
  id: string;
  label: string;
  /** quando usar */
  description: string;
  kind: TransitionKind;
  /** só xfade: nome nativo, ou expressão custom */
  xfade?: { transition: string } | { expr: string };
  /** só stinger: variante do componente Stinger */
  stinger?: { variant: string; props?: Record<string, unknown> };
  /** segundos, 0.2–1.0 */
  defaultDuration: number;
  energy: 'calm' | 'medium' | 'high';
  tone: 'any' | 'sober' | 'playful';
  sfx: 'whoosh' | 'pop' | 'glitch' | null;
}

type Meta = Pick<TransitionPreset, 'label' | 'description' | 'defaultDuration' | 'energy' | 'tone' | 'sfx'>;

const native = (transition: string, meta: Meta): Omit<TransitionPreset, 'id'> => ({ kind: 'xfade', xfade: { transition }, ...meta });
const custom = (expr: string, meta: Meta): Omit<TransitionPreset, 'id'> => ({ kind: 'xfade', xfade: { expr }, ...meta });
const stinger = (variant: string, meta: Meta): Omit<TransitionPreset, 'id'> => ({ kind: 'stinger', stinger: { variant }, ...meta });

// No xfade, P vai de 1 a 0, A é o clipe que sai e B o que entra. `m` (0→1) é o quanto de B aparece no pixel.
// Sem st()/ld(): o xfade roda em slice threads que dividem as variáveis da expressão, e a imagem vira ruído.
const mix = (m: string) => `A+(B-A)*${m}`;
const EASE_DISSOLVE = mix('(1-P)*(1-P)*(3-2*(1-P))');
// borda macia de 25% da diagonal, para a varredura não parecer uma régua atravessando o rosto
const SOFT_DIAGONAL = mix('clip(((1-P)*1.25-(X/W+Y/H)/2)/0.25,0,1)');
const SOFT_IRIS = mix('clip(((1-P)*1.3-hypot(X-W/2,Y-H/2)/hypot(W/2,H/2))/0.3,0,1)');

const presets: Record<string, Omit<TransitionPreset, 'id'>> = {
  // ── xfade: os 5 que a EDL já conhece (mesmo efeito de `XFADE` em render/cuts.ts) ──
  'cross-dissolve': native('fade', {
    label: 'Dissolução cruzada',
    description: 'Passagem de tempo ou tom mais sério; a transição neutra por padrão.',
    defaultDuration: 0.4,
    energy: 'calm',
    tone: 'sober',
    sfx: null,
  }),
  wipe: native('smoothleft', {
    label: 'Varredura suave à esquerda',
    description: 'Troca de capítulo, junto do SectionTitle.',
    defaultDuration: 0.4,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'whip-pan': native('hblur', {
    label: 'Chicote horizontal',
    description: 'Mudança brusca de energia ou de cenário; no máximo 3 por vídeo.',
    defaultDuration: 0.3,
    energy: 'high',
    tone: 'playful',
    sfx: 'whoosh',
  }),
  'zoom-blur': native('zoomin', {
    label: 'Zoom para dentro',
    description: 'Mergulhar num detalhe ou subir a energia antes de uma demonstração.',
    defaultDuration: 0.35,
    energy: 'high',
    tone: 'playful',
    sfx: 'whoosh',
  }),
  glitch: native('pixelize', {
    label: 'Glitch pixelado',
    description: 'Só em contexto de bug, erro ou hack; no máximo 2 por vídeo.',
    defaultDuration: 0.3,
    energy: 'high',
    tone: 'playful',
    sfx: 'glitch',
  }),

  // ── xfade: dissoluções ──
  'fade-slow': native('fadeslow', {
    label: 'Dissolução lenta',
    description: 'Encerrar um bloco reflexivo ou uma história pessoal sem pressa.',
    defaultDuration: 0.8,
    energy: 'calm',
    tone: 'sober',
    sfx: null,
  }),
  'fade-fast': native('fadefast', {
    label: 'Dissolução rápida',
    description: 'Suavizar um corte entre dois enquadramentos parecidos sem chamar atenção.',
    defaultDuration: 0.25,
    energy: 'calm',
    tone: 'any',
    sfx: null,
  }),
  'ease-dissolve': custom(EASE_DISSOLVE, {
    label: 'Dissolução com easing',
    description: 'Dissolução que arranca e pousa devagar; para trechos contemplativos com trilha.',
    defaultDuration: 0.6,
    energy: 'calm',
    tone: 'sober',
    sfx: null,
  }),
  'dip-to-black': native('fadeblack', {
    label: 'Mergulho no preto',
    description: 'Fim de ato ou salto grande no tempo ("três meses depois").',
    defaultDuration: 0.7,
    energy: 'calm',
    tone: 'sober',
    sfx: null,
  }),
  'dip-to-white': native('fadewhite', {
    label: 'Clarão branco',
    description: 'Revelação, resultado final ou lembrança; mais leve que o mergulho no preto.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'any',
    sfx: null,
  }),
  'fade-grays': native('fadegrays', {
    label: 'Dissolução dessaturada',
    description: 'Entrar ou sair de um flashback ou de um "como era antes".',
    defaultDuration: 0.6,
    energy: 'calm',
    tone: 'sober',
    sfx: null,
  }),
  'grain-dissolve': native('dissolve', {
    label: 'Dissolução granulada',
    description: 'Assunto retrô, terminal antigo ou baixo nível; a imagem troca em grãos.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'playful',
    sfx: null,
  }),

  // ── xfade: varreduras ──
  'wipe-right': native('smoothright', {
    label: 'Varredura suave à direita',
    description: 'Voltar a um assunto anterior; o par espelhado do wipe.',
    defaultDuration: 0.4,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'wipe-up': native('smoothup', {
    label: 'Varredura suave para cima',
    description: 'Subir de nível: do problema para a solução, do básico para o avançado.',
    defaultDuration: 0.4,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'wipe-down': native('smoothdown', {
    label: 'Varredura suave para baixo',
    description: 'Descer ao detalhe: abrir o código, entrar na implementação.',
    defaultDuration: 0.4,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'soft-diagonal': custom(SOFT_DIAGONAL, {
    label: 'Varredura diagonal macia',
    description: 'Troca de tópico dentro do mesmo capítulo; mais discreta que o wipe.',
    defaultDuration: 0.5,
    energy: 'calm',
    tone: 'any',
    sfx: null,
  }),
  'diagonal-wipe': native('diagtl', {
    label: 'Varredura diagonal',
    description: 'Passar de talking head para tela gravada, ou o contrário.',
    defaultDuration: 0.4,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'clock-wipe': native('radial', {
    label: 'Varredura de relógio',
    description: 'Passagem de tempo explícita: "depois de duas horas de build".',
    defaultDuration: 0.6,
    energy: 'medium',
    tone: 'playful',
    sfx: 'whoosh',
  }),

  // ── xfade: deslizar, cobrir, revelar ──
  'slide-left': native('slideleft', {
    label: 'Deslizar para a esquerda',
    description: 'Avançar numa sequência de passos; cada passo empurra o anterior.',
    defaultDuration: 0.35,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'slide-right': native('slideright', {
    label: 'Deslizar para a direita',
    description: 'Voltar um passo ou retomar o item anterior de uma lista.',
    defaultDuration: 0.35,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'cover-left': native('coverleft', {
    label: 'Cobrir pela direita',
    description: 'A cena nova desliza por cima da antiga; bom para entrar numa demonstração.',
    defaultDuration: 0.35,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'cover-up': native('coverup', {
    label: 'Cobrir por baixo',
    description: 'A cena nova sobe por cima da antiga, como um cartão; para abrir um exemplo.',
    defaultDuration: 0.35,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'reveal-right': native('revealright', {
    label: 'Revelar para a direita',
    description: 'A cena antiga sai de cima e mostra a nova; para fechar um parêntese e voltar ao fio.',
    defaultDuration: 0.35,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),

  // ── xfade: aberturas ──
  'circle-open': native('circleopen', {
    label: 'Círculo que abre',
    description: 'Abrir um assunto novo a partir do centro do quadro; começo de bloco.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'playful',
    sfx: 'pop',
  }),
  'circle-close': native('circleclose', {
    label: 'Círculo que fecha',
    description: 'Fechar um bloco ou uma piada; o par do círculo que abre.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'playful',
    sfx: 'pop',
  }),
  'soft-iris': custom(SOFT_IRIS, {
    label: 'Íris macia',
    description: 'Abrir do centro com borda difusa; versão sóbria do círculo que abre.',
    defaultDuration: 0.6,
    energy: 'calm',
    tone: 'sober',
    sfx: null,
  }),
  'split-open': native('vertopen', {
    label: 'Abrir ao meio',
    description: 'A imagem se abre do centro para os lados; para revelar um resultado ou o antes/depois.',
    defaultDuration: 0.4,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),

  // ── xfade: com textura ──
  'wind-left': native('hlwind', {
    label: 'Vento para a esquerda',
    description: 'Aceleração: pular uma parte chata ("avançando a instalação").',
    defaultDuration: 0.45,
    energy: 'high',
    tone: 'playful',
    sfx: 'whoosh',
  }),
  'slice-left': native('hlslice', {
    label: 'Fatias para a esquerda',
    description: 'Troca ritmada entre itens de uma comparação ou de um ranking.',
    defaultDuration: 0.45,
    energy: 'high',
    tone: 'playful',
    sfx: 'whoosh',
  }),
  'slice-up': native('vuslice', {
    label: 'Fatias para cima',
    description: 'Mesma batida das fatias, na vertical; alternar com slice-left para não repetir.',
    defaultDuration: 0.45,
    energy: 'high',
    tone: 'playful',
    sfx: 'whoosh',
  }),

  // ── stingers: cortinas ──
  'paper-curtain': stinger('paper-curtain', {
    label: 'Cortina paper',
    description: 'Troca de capítulo limpa, da esquerda para a direita; o stinger padrão da marca.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'sober',
    sfx: 'whoosh',
  }),
  'ink-curtain': stinger('ink-curtain', {
    label: 'Cortina ink',
    description: 'Troca de capítulo em vídeo de tom escuro ou assunto sério; vem da direita.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'sober',
    sfx: 'whoosh',
  }),
  'paper-rise': stinger('paper-rise', {
    label: 'Folha que sobe',
    description: 'Entrar numa cena ilustrativa ou num slide em fundo paper.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'ink-drop': stinger('ink-drop', {
    label: 'Queda slate',
    description: 'Entrar em código ou terminal: a tela escura desce como um pano.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'sober',
    sfx: 'whoosh',
  }),
  'double-bar': stinger('double-bar', {
    label: 'Barra dupla ink + coral',
    description: 'Abertura de bloco importante; a barra coral puxa e fecha a cortina ink.',
    defaultDuration: 0.6,
    energy: 'high',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'layered-sweep': stinger('layered-sweep', {
    label: 'Três camadas',
    description: 'Vinheta de marca: coral, ink e paper em fila; no máximo uma vez por vídeo.',
    defaultDuration: 0.7,
    energy: 'high',
    tone: 'playful',
    sfx: 'whoosh',
  }),

  // ── stingers: diagonais ──
  'diagonal-coral': stinger('diagonal-coral', {
    label: 'Faixa coral diagonal',
    description: 'Virada de assunto com energia; a faixa coral corta o quadro e o paper vem atrás.',
    defaultDuration: 0.5,
    energy: 'high',
    tone: 'playful',
    sfx: 'whoosh',
  }),
  chevron: stinger('chevron', {
    label: 'Seta slate',
    description: 'Avançar para o próximo passo de um tutorial; a seta aponta para onde o vídeo vai.',
    defaultDuration: 0.5,
    energy: 'high',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'split-diagonal': stinger('split-diagonal', {
    label: 'Cantos que se encontram',
    description: 'Confronto ou comparação (A contra B): dois triângulos fecham na diagonal.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),

  // ── stingers: íris ──
  'iris-coral': stinger('iris-coral', {
    label: 'Íris coral',
    description: 'O momento mais forte do vídeo (revelação, virada); é a única tela cheia de coral, use uma vez.',
    defaultDuration: 0.5,
    energy: 'high',
    tone: 'playful',
    sfx: 'pop',
  }),
  'iris-paper': stinger('iris-paper', {
    label: 'Íris paper',
    description: 'Abrir um exemplo ou uma cena ilustrativa a partir do centro, com aro coral.',
    defaultDuration: 0.5,
    energy: 'medium',
    tone: 'any',
    sfx: 'pop',
  }),
  'iris-ink': stinger('iris-ink', {
    label: 'Íris ink',
    description: 'Fechar um bloco e abrir o seguinte, como íris de cinema; encerra piada ou história.',
    defaultDuration: 0.6,
    energy: 'medium',
    tone: 'playful',
    sfx: 'pop',
  }),

  // ── stingers: persianas e blocos ──
  'blinds-horizontal': stinger('blinds-horizontal', {
    label: 'Persiana horizontal',
    description: 'Passar para uma lista, tabela ou comparação; as lâminas descem em cascata.',
    defaultDuration: 0.6,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'blinds-vertical': stinger('blinds-vertical', {
    label: 'Persiana vertical',
    description: 'Passar para código ou dados em colunas; as lâminas ink correm da esquerda.',
    defaultDuration: 0.6,
    energy: 'medium',
    tone: 'sober',
    sfx: 'whoosh',
  }),
  'blinds-diagonal': stinger('blinds-diagonal', {
    label: 'Persiana diagonal',
    description: 'Mudança de ritmo em trecho acelerado (montagem, timelapse de código).',
    defaultDuration: 0.6,
    energy: 'high',
    tone: 'playful',
    sfx: 'whoosh',
  }),
  'stagger-rows': stinger('stagger-rows', {
    label: 'Faixas escalonadas',
    description: 'Entrar numa enumeração (antes do BulletList); as faixas chegam uma a uma.',
    defaultDuration: 0.6,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'stagger-columns': stinger('stagger-columns', {
    label: 'Colunas escalonadas',
    description: 'Entrar em números ou benchmark (antes do BarChart); as colunas sobem como barras.',
    defaultDuration: 0.6,
    energy: 'medium',
    tone: 'any',
    sfx: 'whoosh',
  }),
  'grid-blocks': stinger('grid-blocks', {
    label: 'Grade de blocos',
    description: 'Assunto de pixels, grid, componentes ou arquitetura em peças.',
    defaultDuration: 0.7,
    energy: 'high',
    tone: 'playful',
    sfx: 'pop',
  }),

  // ── stingers: folhas ──
  'doors-horizontal': stinger('doors-horizontal', {
    label: 'Duas folhas',
    description: 'Fechar um capítulo e abrir o próximo: duas folhas paper se encontram num fio coral.',
    defaultDuration: 0.6,
    energy: 'medium',
    tone: 'sober',
    sfx: 'whoosh',
  }),
  'doors-vertical': stinger('doors-vertical', {
    label: 'Pálpebra',
    description: 'Fim de ato em tom sério: o quadro fecha em night por cima e por baixo, e reabre.',
    defaultDuration: 0.7,
    energy: 'calm',
    tone: 'sober',
    sfx: null,
  }),
};

export const transitions: Record<string, TransitionPreset> = Object.fromEntries(
  Object.entries(presets).map(([id, preset]) => [id, { id, ...preset }]),
);

/** Opções do filtro `xfade` (sem duration/offset) que realizam o preset. */
export function xfadeArgs(preset: TransitionPreset): string {
  if (preset.kind !== 'xfade' || !preset.xfade) throw new Error(`Transição "${preset.id}" não é xfade`);
  if ('expr' in preset.xfade) {
    // a expressão vai entre aspas simples no filtergraph: é o que protege as vírgulas e o ponto e vírgula
    if (preset.xfade.expr.includes("'")) throw new Error(`Transição "${preset.id}": expressão não pode conter aspas simples`);
    return `transition=custom:expr='${preset.xfade.expr}'`;
  }
  return `transition=${preset.xfade.transition}`;
}
