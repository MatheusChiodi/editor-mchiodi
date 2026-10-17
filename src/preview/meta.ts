/** O que dá para saber de uma cena só lendo o fonte, sem bundlar nem renderizar. */
export interface SceneMeta {
  description: string | null;
  defaultDuration: number | null;
  /** chaves de `revealAt` com o valor do exemplo (segundos), na ordem do fonte */
  revealAt: Record<string, number>;
}

/** Trecho `{ ... }` balanceado que começa na primeira chave a partir de `from`. */
function braceBlock(source: string, from: number): string | null {
  const open = source.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  return null;
}

/** Literais de string encadeados por `+` logo depois de `from` (description costuma quebrar em várias linhas). */
function stringLiteral(source: string, from: number): string | null {
  const pattern = /\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`)\s*(\+)?/y;
  let cursor = from;
  let text = '';
  let found = false;
  for (;;) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(source);
    if (!match) break;
    found = true;
    text += (match[1] ?? match[2] ?? match[3] ?? '').replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, ' ');
    cursor = pattern.lastIndex;
    if (!match[4]) break;
  }
  return found ? text : null;
}

function numberPairs(block: string): Record<string, number> {
  const pairs: Record<string, number> = {};
  for (const match of block.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?=[,}\n])/g)) pairs[match[1]!] = Number(match[2]);
  return pairs;
}

/** Valor numérico direto ou por uma constante do arquivo (`defaultDuration: DURATION`). */
function numberOrConstant(source: string, raw: string): number | null {
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const constant = new RegExp(`const\\s+${raw.replace(/[$]/g, '\\$')}\\s*(?::[^=]+)?=\\s*(-?\\d+(?:\\.\\d+)?)`).exec(source);
  return constant ? Number(constant[1]) : null;
}

function revealFromSample(source: string, entryBlock: string): Record<string, number> {
  const inline = /revealAt\s*:\s*\{/.exec(entryBlock);
  if (inline) return numberPairs(braceBlock(entryBlock, inline.index) ?? '');
  const reference = /revealAt\s*:\s*([A-Za-z_$][\w$]*)/.exec(entryBlock)?.[1] ?? /revealAt\s*=\s*([A-Za-z_$][\w$]*)/.exec(source)?.[1];
  if (!reference) return {};
  const declaration = new RegExp(`const\\s+${reference.replace(/[$]/g, '\\$')}\\b[^=]*=\\s*\\{`).exec(source);
  return declaration ? numberPairs(braceBlock(source, declaration.index + declaration[0].length - 1) ?? '') : {};
}

/** Lê `description`, `defaultDuration` e os tempos de `revealAt` do `entry` da cena. Melhor esforço: o que não achar fica vazio. */
export function parseSceneSource(source: string): SceneMeta {
  const entryStart = /export\s+const\s+entry\b[^=]*=/.exec(source);
  const entryBlock = entryStart ? (braceBlock(source, entryStart.index + entryStart[0].length) ?? '') : '';
  const descriptionAt = /\bdescription\s*:/.exec(entryBlock);
  const duration = /\bdefaultDuration\s*:\s*([\w$.-]+)/.exec(entryBlock)?.[1];
  let revealAt = revealFromSample(source, entryBlock);
  if (Object.keys(revealAt).length === 0) {
    // sem exemplo numérico: pelo menos as chaves declaradas na interface de props
    const declared = /revealAt\??\s*:\s*\{/.exec(source);
    const block = declared ? (braceBlock(source, declared.index) ?? '') : '';
    revealAt = Object.fromEntries([...block.matchAll(/([A-Za-z_$][\w$]*)\??\s*:\s*number/g)].map((match) => [match[1]!, Number.NaN]));
  }
  return {
    description: descriptionAt ? stringLiteral(entryBlock, descriptionAt.index + descriptionAt[0].length) : null,
    defaultDuration: duration ? numberOrConstant(source, duration) : null,
    revealAt,
  };
}

/** Frames da tira: `count` pontos no meio de fatias iguais da duração (pega a entrada, o miolo e a saída). */
export function stripFrames(durationInFrames: number, count = 6): number[] {
  const last = Math.max(0, durationInFrames - 1);
  const frames = Array.from({ length: count }, (_, index) => Math.min(last, Math.round(((index + 0.5) / count) * durationInFrames)));
  return [...new Set(frames)];
}

export function overlayId(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** Overlay pronto para colar em `overlays[]` da EDL; `at` e `reason` ficam para o diretor preencher. */
export function edlSnippet(project: string, name: string, duration: number, revealAt: Record<string, number> = {}): string {
  const times = Object.fromEntries(Object.entries(revealAt).filter(([, value]) => Number.isFinite(value)));
  return JSON.stringify(
    {
      id: overlayId(name),
      component: `scene:${project}/${name}`,
      at: 0,
      duration,
      props: Object.keys(times).length ? { revealAt: times } : {},
      reason: '',
    },
    null,
    2,
  );
}
