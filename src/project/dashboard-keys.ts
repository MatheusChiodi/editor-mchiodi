export type Key = 'up' | 'down' | 'enter' | 'escape' | 'quit' | 'help' | 'output' | 'video' | 'report' | 'project' | 'scenes' | 'copy';

const SEQUENCES: [string, Key][] = [
  ['\u001b[A', 'up'],
  ['\u001bOA', 'up'],
  ['\u001b[B', 'down'],
  ['\u001bOB', 'down'],
  ['\r\n', 'enter'],
];

const SINGLE: Record<string, Key> = {
  k: 'up',
  j: 'down',
  '\r': 'enter',
  '\n': 'enter',
  '\u001b': 'escape',
  '\u0003': 'quit',
  q: 'quit',
  '?': 'help',
  o: 'output',
  p: 'video',
  r: 'report',
  e: 'project',
  g: 'scenes',
  c: 'copy',
};

const ESCAPE_SEQUENCE = /^\u001b(?:\[[0-9;?]*[ -/]*[@-~]|O[@-~])/;

/** Traduz o que chega do stdin em raw mode (pode vir mais de uma tecla por vez) em teclas do painel. */
export function parseKeys(chunk: string): Key[] {
  const keys: Key[] = [];
  let rest = chunk;
  while (rest) {
    const known = SEQUENCES.find(([sequence]) => rest.startsWith(sequence));
    if (known) {
      keys.push(known[1]);
      rest = rest.slice(known[0].length);
      continue;
    }
    // seta para os lados, F5, mouse: sequência inteira descartada, para o "[" e a letra não virarem tecla
    const unknown = ESCAPE_SEQUENCE.exec(rest);
    if (unknown) {
      rest = rest.slice(unknown[0].length);
      continue;
    }
    const char = rest[0]!;
    const key = SINGLE[char] ?? SINGLE[char.toLowerCase()];
    if (key) keys.push(key);
    rest = rest.slice(1);
  }
  return keys;
}

export interface PanelState {
  /** edições na ordem em que aparecem */
  slugs: string[];
  selected: string | null;
  /** foco: a edição selecionada ocupa a tela, com todas as etapas e os detalhes */
  expanded: boolean;
  help: boolean;
}

export type PanelAction =
  | { type: 'quit' }
  | { type: 'open-output' | 'open-video' | 'open-report' | 'open-project' | 'copy-next'; slug: string }
  | { type: 'open-scenes' };

export const initialState = (slugs: string[], selected: string | null = null, expanded = false): PanelState => ({
  slugs,
  selected: selected !== null && slugs.includes(selected) ? selected : (slugs[0] ?? null),
  expanded,
  help: false,
});

/** A lista de edições mudou no disco: mantém a seleção se ela ainda existe; `fallback` é a que o painel destacaria sozinho. */
export function syncState(state: PanelState, slugs: string[], fallback: string | null = null): PanelState {
  const keep = state.selected !== null && slugs.includes(state.selected);
  const selected = keep ? state.selected : fallback !== null && slugs.includes(fallback) ? fallback : (slugs[0] ?? null);
  const same = selected === state.selected && slugs.length === state.slugs.length && slugs.every((slug, index) => slug === state.slugs[index]);
  return same ? state : { ...state, slugs, selected };
}

const ITEM_ACTION = {
  output: 'open-output',
  video: 'open-video',
  report: 'open-report',
  project: 'open-project',
  copy: 'copy-next',
} as const;

/** A máquina de estados do teclado: devolve o estado novo e, se a tecla pede um efeito, a ação para a casca executar. */
export function reduce(state: PanelState, key: Key): { state: PanelState; action?: PanelAction } {
  if (key === 'quit') return { state, action: { type: 'quit' } };
  if (key === 'help') return { state: { ...state, help: !state.help } };
  if (state.help) return key === 'escape' || key === 'enter' ? { state: { ...state, help: false } } : { state };
  switch (key) {
    case 'up':
    case 'down': {
      if (state.slugs.length === 0) return { state };
      const at = state.selected === null ? -1 : state.slugs.indexOf(state.selected);
      const next = at < 0 ? 0 : Math.min(state.slugs.length - 1, Math.max(0, at + (key === 'down' ? 1 : -1)));
      const selected = state.slugs[next]!;
      return selected === state.selected ? { state } : { state: { ...state, selected } };
    }
    case 'enter':
      return state.selected === null ? { state } : { state: { ...state, expanded: !state.expanded } };
    case 'escape':
      return state.expanded ? { state: { ...state, expanded: false } } : { state };
    case 'scenes':
      return { state, action: { type: 'open-scenes' } };
    default:
      return state.selected === null ? { state } : { state, action: { type: ITEM_ACTION[key], slug: state.selected } };
  }
}

/** Teclas na ordem em que a ajuda (`?`) as lista. */
export const KEY_HELP: [keys: string, what: string][] = [
  ['↑ ↓  j k', 'seleciona a edição'],
  ['Enter', 'foco (todas as etapas e detalhes) ↔ visão geral'],
  ['o', 'abre a pasta output/<slug>'],
  ['p', 'abre o vídeo mais recente (final, senão o último preview)'],
  ['r', 'abre o relatorio.md'],
  ['e', 'abre a pasta do projeto'],
  ['g', 'abre o visor de cenas no navegador'],
  ['c', 'copia o próximo comando sugerido'],
  ['?', 'mostra ou esconde esta ajuda'],
  ['q  Ctrl+C', 'sai'],
];
