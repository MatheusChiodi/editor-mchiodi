import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ModelOrigin, ModelSlot } from '../../motion/src/components/registry.ts';
import { parseSceneSource } from '../preview/meta.ts';
import { ROOT } from '../project/paths.ts';
import { isValidSceneName, SCENE_PREFIX, type SceneFile, sceneKey, SCENES_DIR, scanScenes } from './sync.ts';

/**
 * Projeto reservado: `motion/src/scenes/modelos/<Nome>.tsx` é a biblioteca de MODELOS de animação.
 * Na EDL um modelo entra como `scene:modelos/<Nome>`, pelo mesmo caminho de qualquer cena (sync, Studio, render).
 */
export const MODELS_PROJECT = 'modelos';
export const MODEL_TEMPLATE = join(SCENES_DIR, '_template', 'ModelTemplate.tsx');
export const PROJECTS_DIR = join(ROOT, 'projects');

export function isModel(scene: SceneFile): boolean {
  return scene.project === MODELS_PROJECT;
}

// ---------------------------------------------------------------------------------------------------------------------
// Leitura estática de literais: o catálogo lê `tags`, `origin`, `slots` e `sample` do fonte, sem bundlar nem executar React
// (mesmo caminho do visor de cenas, `src/preview/meta.ts`). Entende objeto, lista, texto, número, booleano, `as const`,
// soma de textos, spread e constantes do próprio arquivo; qualquer outra expressão fica marcada como não resolvida.

interface Parsed {
  value: unknown;
  /** false quando alguma parte não era literal (chamada de função, conta, import) */
  ok: boolean;
  end: number;
  /** chaves do objeto cujo valor não foi resolvido por inteiro */
  incomplete?: string[];
}

const IDENTIFIER = /[A-Za-z_$][\w$]*/y;
const NUMBER = /-?\d[\d_]*(?:\.\d+)?/y;
const MAX_DEPTH = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function skipTrivia(source: string, from: number): number {
  let index = from;
  for (;;) {
    while (index < source.length && /\s/.test(source[index]!)) index += 1;
    if (source.startsWith('//', index)) {
      const line = source.indexOf('\n', index);
      index = line < 0 ? source.length : line + 1;
    } else if (source.startsWith('/*', index)) {
      const close = source.indexOf('*/', index + 2);
      index = close < 0 ? source.length : close + 2;
    } else {
      return index;
    }
  }
}

function readString(source: string, index: number): { value: string; end: number } | null {
  const quote = source[index];
  if (quote !== "'" && quote !== '"' && quote !== '`') return null;
  let text = '';
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    const char = source[cursor]!;
    if (char === '\\') {
      const next = source[cursor + 1] ?? '';
      text += next === 'n' ? '\n' : next === 't' ? '\t' : next;
      cursor += 1;
    } else if (char === quote) {
      return { value: text, end: cursor + 1 };
    } else {
      text += char;
    }
  }
  return null;
}

/** Avança até o fim da expressão: a próxima `,`/`;` ou o fechamento do bloco que a contém. `angles` conta `<>` (tipos). */
function skipExpression(source: string, from: number, angles = false): number {
  let depth = 0;
  for (let index = from; index < source.length; index += 1) {
    const char = source[index]!;
    if (char === "'" || char === '"' || char === '`') {
      const text = readString(source, index);
      if (!text) return source.length;
      index = text.end - 1;
    } else if (char === '/' && (source[index + 1] === '/' || source[index + 1] === '*')) {
      index = skipTrivia(source, index) - 1;
    } else if ('([{'.includes(char) || (angles && char === '<')) {
      depth += 1;
    } else if (')]}'.includes(char) || (angles && char === '>' && source[index - 1] !== '=')) {
      if (depth === 0) return index;
      depth -= 1;
    } else if ((char === ',' || char === ';') && depth === 0) {
      return index;
    }
  }
  return source.length;
}

function resolveConstant(source: string, name: string, depth: number): { value: unknown; ok: boolean } {
  if (depth >= MAX_DEPTH) return { value: undefined, ok: false };
  const declaration = new RegExp(`(?:^|\\n)[ \\t]*(?:export\\s+)?const\\s+${name.replace(/\$/g, '\\$')}\\s*(?::[^=;\\n]+?)?=(?![=>])`).exec(source);
  if (!declaration) return { value: undefined, ok: false };
  const { value, ok } = readValue(source, declaration.index + declaration[0].length, depth + 1);
  return { value, ok };
}

function readObject(source: string, open: number, depth: number): Parsed {
  const value: Record<string, unknown> = {};
  const incomplete: string[] = [];
  let ok = true;
  let index = open + 1;
  for (;;) {
    index = skipTrivia(source, index);
    if (index >= source.length) return { value, ok: false, end: index, incomplete };
    if (source[index] === '}') return { value, ok, end: index + 1, incomplete };
    if (source.startsWith('...', index)) {
      const spread = readValue(source, index + 3, depth);
      if (isRecord(spread.value)) Object.assign(value, spread.value);
      ok &&= spread.ok && isRecord(spread.value);
      index = spread.end;
    } else {
      const quoted = readString(source, index);
      IDENTIFIER.lastIndex = index;
      const key = quoted?.value ?? IDENTIFIER.exec(source)?.[0];
      if (key === undefined) {
        // chave computada: não dá para saber o nome sem executar
        ok = false;
        index = Math.max(index + 1, skipExpression(source, index));
      } else {
        const after = skipTrivia(source, quoted ? quoted.end : index + key.length);
        let item: { value: unknown; ok: boolean };
        if (source[after] === ':') {
          const read = readValue(source, after + 1, depth);
          item = read;
          index = read.end;
        } else if (source[after] === ',' || source[after] === '}') {
          item = resolveConstant(source, key, depth);
          index = after;
        } else {
          // método ou getter
          item = { value: undefined, ok: false };
          index = skipExpression(source, after);
        }
        if (item.value !== undefined) value[key] = item.value;
        if (!item.ok) {
          ok = false;
          incomplete.push(key);
        }
      }
    }
    index = skipTrivia(source, index);
    if (source[index] === ',') index += 1;
    else if (source[index] !== '}') {
      ok = false;
      index = Math.max(index + 1, skipExpression(source, index));
    }
  }
}

function readArray(source: string, open: number, depth: number): Parsed {
  const value: unknown[] = [];
  let ok = true;
  let index = open + 1;
  for (;;) {
    index = skipTrivia(source, index);
    if (index >= source.length) return { value, ok: false, end: index };
    if (source[index] === ']') return { value, ok, end: index + 1 };
    const spread = source.startsWith('...', index);
    const item = readValue(source, spread ? index + 3 : index, depth);
    if (spread && Array.isArray(item.value)) value.push(...item.value);
    else if (!spread && item.value !== undefined) value.push(item.value);
    ok &&= item.ok && (!spread || Array.isArray(item.value));
    index = skipTrivia(source, Math.max(item.end, index + 1));
    if (source[index] === ',') index += 1;
    else if (source[index] !== ']') {
      ok = false;
      index = Math.max(index + 1, skipExpression(source, index));
    }
  }
}

function readPrimary(source: string, from: number, depth: number): Parsed {
  const index = skipTrivia(source, from);
  const char = source[index];
  if (char === '{') return readObject(source, index, depth);
  if (char === '[') return readArray(source, index, depth);
  if (char === '(') {
    const inner = readValue(source, index + 1, depth);
    const close = skipTrivia(source, inner.end);
    return source[close] === ')' ? { ...inner, end: close + 1 } : { value: undefined, ok: false, end: skipExpression(source, index + 1) + 1 };
  }
  const text = readString(source, index);
  // template com interpolação só se resolve executando
  if (text) return { value: text.value, ok: char !== '`' || !text.value.includes('${'), end: text.end };
  NUMBER.lastIndex = index;
  const number = NUMBER.exec(source);
  if (number) return { value: Number(number[0].replace(/_/g, '')), ok: true, end: NUMBER.lastIndex };
  IDENTIFIER.lastIndex = index;
  const word = IDENTIFIER.exec(source)?.[0];
  if (!word) return { value: undefined, ok: false, end: skipExpression(source, index) };
  let end = index + word.length;
  if (word === 'true' || word === 'false') return { value: word === 'true', ok: true, end };
  if (word === 'null') return { value: null, ok: true, end };
  if (word === 'undefined') return { value: undefined, ok: true, end };
  let resolved = resolveConstant(source, word, depth);
  // acesso a membro: DEFAULTS.reveal
  for (;;) {
    const member = /\.([A-Za-z_$][\w$]*)/y;
    member.lastIndex = end;
    const match = member.exec(source);
    if (!match) break;
    end = member.lastIndex;
    resolved = isRecord(resolved.value) && match[1]! in resolved.value ? { value: resolved.value[match[1]!], ok: resolved.ok } : { value: undefined, ok: false };
  }
  return { ...resolved, end };
}

function readValue(source: string, from: number, depth = 0): Parsed {
  let result = readPrimary(source, from, depth);
  for (;;) {
    const index = skipTrivia(source, result.end);
    const char = source[index];
    if (char === undefined || ',;}])'.includes(char)) return result;
    if (char === '+') {
      const right = readPrimary(source, index + 1, depth);
      const sum =
        typeof result.value === 'string' && typeof right.value === 'string'
          ? result.value + right.value
          : typeof result.value === 'number' && typeof right.value === 'number'
            ? result.value + right.value
            : undefined;
      result = { value: sum, ok: result.ok && right.ok && sum !== undefined, end: Math.max(right.end, index + 1) };
      continue;
    }
    // `as const`, `as Tipo`, `satisfies Tipo`: o valor não muda
    if (/(?:as|satisfies)\s/y.test(source.slice(index, index + 10))) return { ...result, end: skipExpression(source, index, true) };
    // chamada, conta, ternário: só executando
    return { value: undefined, ok: false, end: skipExpression(source, index) };
  }
}

/** Valor de uma expressão literal de TypeScript em `source` a partir de `from`. `ok: false` = não era (só) literal. */
export function readLiteral(source: string, from = 0): { value: unknown; ok: boolean; incomplete: string[] } {
  const { value, ok, incomplete } = readValue(source, from);
  return { value, ok, incomplete: incomplete ?? [] };
}

// ---------------------------------------------------------------------------------------------------------------------
// Cenas e modelos, lidos do fonte

export interface SceneInfo extends SceneFile {
  description: string | null;
  defaultDuration: number | null;
  /** `export const MODEL = '<Nome>'`: o modelo de que esta cena sob medida é uma instância (como está escrito) */
  model: string | null;
  tags: string[];
  origin: ModelOrigin | null;
  slots: ModelSlot[];
  /** props de exemplo; `null` quando o `sample` não é literal */
  sample: Record<string, unknown> | null;
  /** chaves do `sample` que dependem de código (ficam de fora do trecho da EDL) */
  sampleIncomplete: string[];
}

/**
 * Vínculo cena → modelo. Formato único, na raiz do arquivo da cena: `export const MODEL = 'PilhaEmDoisGrupos';`
 * (aceita também `'modelos/PilhaEmDoisGrupos'`). Vale tanto para a cena que só embrulha o modelo quanto para a que
 * foi escrita à mão antes de ele existir.
 */
export function readModelLink(source: string): string | null {
  return /^export\s+const\s+MODEL\s*(?::\s*string\s*)?=\s*(['"`])(?:modelos\/)?([A-Z][A-Za-z0-9]*)\1/m.exec(source)?.[2] ?? null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim()) : [];
}

function toOrigin(value: unknown): ModelOrigin | null {
  if (!isRecord(value) || typeof value.project !== 'string' || typeof value.date !== 'string') return null;
  return { project: value.project, date: value.date, ...(typeof value.scene === 'string' ? { scene: value.scene } : {}) };
}

function toSlots(value: unknown): ModelSlot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((slot) =>
    isRecord(slot) && typeof slot.name === 'string' && typeof slot.type === 'string' && typeof slot.description === 'string'
      ? [{ name: slot.name, type: slot.type, description: slot.description }]
      : [],
  );
}

/** Tudo que o catálogo e a auditoria precisam de uma cena, só pelo texto do arquivo. */
export function readScene(scene: SceneFile, source: string): SceneInfo {
  const meta = parseSceneSource(source);
  const start = /export\s+const\s+entry\b[^=]*=/.exec(source);
  const entry = start ? readLiteral(source, start.index + start[0].length) : null;
  const fields = isRecord(entry?.value) ? entry.value : {};
  const sampleStart = start ? /\bsample\s*:/.exec(source.slice(start.index)) : null;
  const sample = start && sampleStart ? readLiteral(source, start.index + sampleStart.index + sampleStart[0].length) : null;
  return {
    ...scene,
    description: meta.description ?? (typeof fields.description === 'string' ? fields.description : null),
    defaultDuration: meta.defaultDuration ?? (typeof fields.defaultDuration === 'number' ? fields.defaultDuration : null),
    model: isModel(scene) ? null : readModelLink(source),
    tags: strings(fields.tags),
    origin: toOrigin(fields.origin),
    slots: toSlots(fields.slots),
    sample: isRecord(sample?.value) ? sample.value : null,
    sampleIncomplete: sample && isRecord(sample.value) ? sample.incomplete : [],
  };
}

export function loadScenes(dir = SCENES_DIR): SceneInfo[] {
  return scanScenes(dir).map((scene) => readScene(scene, readFileSync(join(dir, scene.project, `${scene.name}.tsx`), 'utf8')));
}

export function modelsOf(scenes: SceneInfo[]): SceneInfo[] {
  return scenes.filter(isModel);
}

/** O que falta para um modelo cumprir o contrato (lista vazia = completo). */
export function modelProblems(model: SceneInfo): string[] {
  const problems: string[] = [];
  if (!model.description || model.description.trim().length < 20 || /^\s*TODO/i.test(model.description)) problems.push('`description` não diz QUANDO usar (o tipo de fala que o modelo ilustra)');
  if (model.tags.length === 0 || model.tags.some((tag) => tag.toLowerCase() === 'todo')) problems.push('sem `tags` (a forma: lista, comparação, ciclo…)');
  if (!model.origin) problems.push('sem `origin: { project, date }`');
  if (model.slots.length === 0) problems.push('sem `slots` (uma linha por prop)');
  if (!model.sample || Object.keys(model.sample).length === 0) problems.push('`sample` vazio ou não literal');
  else {
    if (model.sampleIncomplete.length) problems.push(`\`sample\` com valor calculado em: ${model.sampleIncomplete.join(', ')} (escreva o literal)`);
    const described = new Set(model.slots.map((slot) => slot.name));
    const missing = Object.keys(model.sample).filter((key) => !described.has(key));
    if (model.slots.length && missing.length) problems.push(`props do \`sample\` sem descrição em \`slots\`: ${missing.join(', ')}`);
  }
  if (model.defaultDuration === null || model.defaultDuration <= 0) problems.push('sem `defaultDuration`');
  return problems;
}

/** `scene:<slug>/<Nome>` → nome do modelo vinculado, ou `null` quando a cena não tem modelo (ou aponta para um que não existe). */
export type SceneLinks = Record<string, string | null>;

export function sceneLinks(scenes: SceneInfo[]): SceneLinks {
  const models = new Set(modelsOf(scenes).map((model) => model.name));
  return Object.fromEntries(scenes.filter((scene) => !isModel(scene)).map((scene) => [sceneKey(scene), scene.model && models.has(scene.model) ? scene.model : null]));
}

export function loadSceneLinks(dir = SCENES_DIR): SceneLinks {
  return sceneLinks(loadScenes(dir));
}

/** Trecho pronto para colar em `overlays[]`; `at` e `reason` ficam para o diretor. */
export function modelSnippet(model: SceneInfo): string {
  return `{ "id": "<id>", "component": "${SCENE_PREFIX}${sceneKey(model)}", "at": <s>, "duration": ${model.defaultDuration ?? 6}, "props": ${JSON.stringify(model.sample ?? {})}, "reason": "<o que reforça>" }`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Uso nas EDLs e auditoria

export interface EdlUsage {
  project: string;
  /** `overlays[].component` da EDL mais recente do projeto */
  components: string[];
}

/** Lê só `overlays[].component` da última versão de cada projeto (JSON cru: uma EDL antiga não pode travar a auditoria). */
export function latestEdlUsage(projectsDir = PROJECTS_DIR): EdlUsage[] {
  if (!existsSync(projectsDir)) return [];
  const usage: EdlUsage[] = [];
  for (const project of readdirSync(projectsDir, { withFileTypes: true })) {
    const edlDir = join(projectsDir, project.name, 'edl');
    if (!project.isDirectory() || project.name.startsWith('.') || !existsSync(edlDir)) continue;
    const latest = readdirSync(edlDir)
      .map((file) => ({ file, version: Number(/^edl\.v(\d+)\.json$/.exec(file)?.[1] ?? Number.NaN) }))
      .filter((item) => Number.isFinite(item.version))
      .sort((a, b) => b.version - a.version)[0];
    if (!latest) continue;
    try {
      const edl = JSON.parse(readFileSync(join(edlDir, latest.file), 'utf8')) as { overlays?: { component?: unknown }[] };
      usage.push({ project: project.name, components: (edl.overlays ?? []).map((overlay) => overlay.component).filter((component): component is string => typeof component === 'string') });
    } catch {
      // EDL ilegível não conta uso
    }
  }
  return usage.sort((a, b) => a.project.localeCompare(b.project));
}

export interface AuditScene {
  key: string;
  description: string | null;
  /** modelo declarado em `MODEL` que não existe em modelos/ */
  brokenLink: string | null;
  uses: number;
}

export interface AuditModel {
  name: string;
  description: string | null;
  tags: string[];
  origin: ModelOrigin | null;
  /** overlays que usam o modelo, direto ou por uma cena vinculada, nas EDLs mais recentes */
  uses: number;
  projects: string[];
  /** cenas sob medida declaradas como instância dele */
  instances: string[];
  problems: string[];
}

export interface Audit {
  /** cenas sob medida consideradas (todas, ou só as do slug pedido) */
  scenes: number;
  unlinked: AuditScene[];
  linked: { key: string; model: string }[];
  models: AuditModel[];
}

/**
 * O que reaproveitar e o que falta virar modelo. `slug` limita as cenas sob medida a um projeto;
 * os modelos aparecem sempre todos, com o uso somado de todos os projetos.
 */
export function auditScenes(scenes: SceneInfo[], usage: EdlUsage[], slug?: string): Audit {
  const links = sceneLinks(scenes);
  const models = modelsOf(scenes);
  const used = usage.flatMap(({ project, components }) =>
    components.filter((component) => component.startsWith(SCENE_PREFIX)).map((component) => ({ project, key: component.slice(SCENE_PREFIX.length) })),
  );
  const custom = scenes.filter((scene) => !isModel(scene) && (!slug || scene.project === slug));
  const usesOf = (key: string) => used.filter((item) => item.key === key).length;
  return {
    scenes: custom.length,
    unlinked: custom
      .filter((scene) => links[sceneKey(scene)] === null)
      .map((scene) => ({ key: sceneKey(scene), description: scene.description, brokenLink: scene.model, uses: usesOf(sceneKey(scene)) })),
    linked: custom.flatMap((scene) => {
      const model = links[sceneKey(scene)];
      return model ? [{ key: sceneKey(scene), model }] : [];
    }),
    models: models.map((model) => {
      const instances = Object.entries(links).filter(([, name]) => name === model.name).map(([key]) => key);
      const hits = used.filter((item) => item.key === sceneKey(model) || instances.includes(item.key));
      return {
        name: model.name,
        description: model.description,
        tags: model.tags,
        origin: model.origin,
        uses: hits.length,
        projects: [...new Set(hits.map((hit) => hit.project))].sort(),
        instances,
        problems: modelProblems(model),
      };
    }),
  };
}

function clip(text: string | null, max = 90): string {
  if (!text) return '(sem descrição)';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatAudit(audit: Audit, slug?: string): string {
  const lines = [`cenas sob medida${slug ? ` de ${slug}` : ''}: ${audit.scenes} · com modelo: ${audit.linked.length} · sem modelo: ${audit.unlinked.length} · modelos na biblioteca: ${audit.models.length}`];
  if (audit.unlinked.length) {
    lines.push('', 'CENA SEM MODELO — crie com `pnpm mce scenes new <NomePelaForma> --from <slug>/<Cena>` e use `scene:modelos/<Nome>` na EDL:');
    for (const scene of audit.unlinked) {
      lines.push(`  ${scene.key.padEnd(38)} ${`${scene.uses} uso${scene.uses === 1 ? '' : 's'}`.padEnd(7)} ${clip(scene.description)}`);
      if (scene.brokenLink) lines.push(`      ! declara MODEL = '${scene.brokenLink}', que não existe em modelos/`);
    }
  }
  if (audit.linked.length) {
    lines.push('', 'CENAS COM MODELO:');
    for (const scene of audit.linked) lines.push(`  ${scene.key.padEnd(38)} → modelos/${scene.model}`);
  }
  lines.push('', audit.models.length ? 'MODELOS (reaproveite antes de criar; mais usados primeiro):' : 'MODELOS: nenhum ainda.');
  for (const model of [...audit.models].sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name))) {
    lines.push(
      `  ${model.name.padEnd(26)} ${`${model.uses} uso${model.uses === 1 ? '' : 's'}`.padEnd(7)} ${model.projects.length ? `em ${model.projects.join(', ')}` : 'ainda não usado'}` +
        `${model.tags.length ? ` · ${model.tags.join(', ')}` : ''}${model.origin ? ` · nasceu em ${model.origin.project} (${model.origin.date})` : ''}`,
    );
    if (model.instances.length) lines.push(`      instâncias: ${model.instances.join(', ')}`);
    for (const problem of model.problems) lines.push(`      ! incompleto: ${problem}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------------------------------
// Esqueleto de modelo novo (`mce scenes new`)

export interface NewModel {
  /** PascalCase, descreve a FORMA (PilhaEmDoisGrupos), nunca o assunto */
  name: string;
  tags: string[];
  /** `<slug>` ou `<slug>/<Cena>`: o vídeo (e a cena) de onde o modelo nasce */
  from?: string;
  /** AAAA-MM-DD */
  date: string;
}

export function parseTags(raw: string | undefined): string[] {
  return [...new Set((raw ?? '').split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

/** `<slug>` ou `<slug>/<Cena>` → origem do modelo. Sem `--from` o modelo nasce "avulso". */
export function parseOrigin(from: string | undefined, date: string): ModelOrigin {
  if (!from) return { project: 'avulso', date };
  const match = /^([A-Za-z0-9][\w.-]*)(?:\/([A-Z][A-Za-z0-9]*))?$/.exec(from.replace(/^scene:/, ''));
  if (!match) throw new Error(`--from inválido: "${from}" (use <slug> ou <slug>/<Cena>)`);
  if (match[1] === MODELS_PROJECT) throw new Error('--from é o vídeo de origem, não a pasta de modelos');
  return { project: match[1]!, date, ...(match[2] ? { scene: `${match[1]}/${match[2]}` } : {}) };
}

const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Troca o nome, as tags e a origem no template de modelo. Função pura: o template entra como texto. */
export function renderModelSkeleton(template: string, model: NewModel): string {
  if (!isValidSceneName(model.name)) throw new Error(`nome inválido: "${model.name}" (PascalCase, só letras e números, descrevendo a forma: PilhaEmDoisGrupos)`);
  const origin = parseOrigin(model.from, model.date);
  if (origin.scene?.endsWith(`/${model.name}`)) throw new Error(`"${model.name}" é o nome da cena de origem: o modelo se chama pela FORMA (ex.: PilhaEmDoisGrupos), não pelo assunto`);
  const tagsLine = /tags: \[[^\]]*\],/;
  const originLine = /origin: \{[^}]*\},/;
  if (!template.includes('ModelTemplate') || !tagsLine.test(template) || !originLine.test(template)) {
    throw new Error('template de modelo sem os marcadores esperados (ModelTemplate, `tags: [...],`, `origin: {...},`)');
  }
  const camel = model.name[0]!.toLowerCase() + model.name.slice(1);
  const originText = `origin: { project: ${quote(origin.project)}, date: ${quote(origin.date)}${origin.scene ? `, scene: ${quote(origin.scene)}` : ''} },`;
  return template
    .split('\n')
    .filter((line) => !line.startsWith('// TEMPLATE:'))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(tagsLine, () => `tags: [${(model.tags.length ? model.tags : ['todo']).map(quote).join(', ')}],`)
    .replace(originLine, () => originText)
    .replaceAll('ModelTemplate', model.name)
    .replaceAll('modelTemplate', camel);
}

/** Grava `modelos/<Nome>.tsx` a partir do template. Não sobrescreve; quem chama roda o sync em seguida. */
export function createModel(model: NewModel, dir = SCENES_DIR, templateFile = MODEL_TEMPLATE): { file: string; scene: SceneFile; origin: ModelOrigin } {
  const content = renderModelSkeleton(readFileSync(templateFile, 'utf8'), model);
  const origin = parseOrigin(model.from, model.date);
  if (origin.scene && !existsSync(join(dir, `${origin.scene}.tsx`))) throw new Error(`cena de origem não existe: ${origin.scene}`);
  const folder = join(dir, MODELS_PROJECT);
  const file = join(folder, `${model.name}.tsx`);
  if (existsSync(file)) throw new Error(`o modelo já existe: ${file}`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(file, content, 'utf8');
  return { file, scene: { project: MODELS_PROJECT, name: model.name }, origin };
}
