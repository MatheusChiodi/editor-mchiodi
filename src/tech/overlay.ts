import { labelTech, resolveTech, TECH_PREFIX } from './catalog.ts';

type Props = Record<string, unknown>;

const strings = (value: unknown): string[] => (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === 'string');
const field = (value: unknown, key: string): unknown => (value && typeof value === 'object' ? (value as Props)[key] : undefined);
const each = (value: unknown, key: string): unknown[] => (Array.isArray(value) ? value.map((item) => field(item, key)) : []);

/**
 * Rótulos que cada componente mostra com ícone automático quando nomeiam uma tecnologia do catálogo.
 * É o contrato entre a tela e a cobrança: o componente desenha o ícone destes campos (com `labelTech`), e o lint
 * `tecnologia-sem-icone` os conta como "ícone na tela". Componente novo com detecção automática entra aqui.
 */
export const AUTO_TECH_LABELS: Record<string, (props: Props) => unknown[]> = {
  SplitExplainer: (props) => each(props.cards, 'label'),
  PillStack: (props) => each(props.items, 'text'),
  BulletList: (props) => strings(props.items),
  Comparison: (props) => [field(props.left, 'title'), field(props.right, 'title'), ...strings(field(props.left, 'items')), ...strings(field(props.right, 'items'))],
  StackLayers: (props) => each(props.layers, 'label'),
  ArchitectureMap: (props) => [props.client, props.server, props.database, ...strings(props.extras)],
  Diagram: (props) => each(props.nodes, 'label'),
  Definition: (props) => [props.term],
  KeywordPop: (props) => [props.word],
};

/** Componentes cujo assunto É a tecnologia: todo nome neles é resolvido pelo catálogo (id ou apelido). */
export const TECH_COMPONENTS: Record<string, (props: Props) => unknown[]> = {
  TechBadge: (props) => [props.tech],
  TechRow: (props) => techItems(props.items),
  TechStack: (props) => techItems(props.items),
};

/**
 * Cenas sob medida que desenham tecnologias FIXAS no código (não vêm por prop): a cobrança não tem como lê-las do JSON.
 * Modelo reutilizável não entra aqui: ele recebe `tech:<id>` nos props. Uma cena nova pode, em vez disto, declarar
 * `"techIcons": ["tech:html", "tech:css"]` nos props do overlay.
 */
export const SCENE_TECHS: Record<string, readonly string[]> = {
  'scene:como-melhorei/StackInicial': ['html', 'css', 'bootstrap', 'javascript', 'php', 'mysql'],
};

function techItems(items: unknown): unknown[] {
  return Array.isArray(items) ? items.map((item) => (typeof item === 'string' ? item : field(item, 'tech'))) : [];
}

function explicit(value: unknown, found: Set<string>): void {
  if (typeof value === 'string') {
    if (value.startsWith(TECH_PREFIX)) {
      const tech = resolveTech(value);
      if (tech) found.add(tech.id);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) explicit(item, found);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) explicit(item, found);
  }
}

/**
 * Tecnologias cujo ícone um overlay põe na tela, pelos props: `tech:<id>` em qualquer campo (cenas e modelos incluídos),
 * os nomes de um `TechBadge`/`TechRow`/`TechStack` e os rótulos que o componente detecta sozinho (`autoTechIcons: false` desliga).
 */
export function overlayTechIds(component: string, props: Props): string[] {
  const found = new Set<string>(SCENE_TECHS[component] ?? []);
  explicit(props, found);
  for (const name of strings(TECH_COMPONENTS[component]?.(props) ?? [])) {
    const tech = resolveTech(name);
    if (tech) found.add(tech.id);
  }
  if (props.autoTechIcons !== false) {
    for (const label of strings(AUTO_TECH_LABELS[component]?.(props) ?? [])) {
      const tech = labelTech(label);
      if (tech) found.add(tech.id);
    }
  }
  return [...found];
}
