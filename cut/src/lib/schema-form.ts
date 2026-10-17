/**
 * Formulário gerado do schema Zod do item (via JSON Schema, `z.toJSONSchema`). Objeto de números vira campos
 * aninhados (`focus.x`); união, nulo-ou-objeto e lista viram JSON. As props de um componente vêm do `sample` dele.
 */
export type FieldType = 'string' | 'text' | 'number' | 'boolean' | 'enum' | 'json';

export interface Field {
  key: string;
  path: string[];
  label: string;
  type: FieldType;
  options?: string[];
  min?: number;
  max?: number;
  required: boolean;
  defaultValue?: unknown;
  /** só leitura no formulário (id) */
  readOnly?: boolean;
}

interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  minLength?: number;
  default?: unknown;
  items?: JsonSchema;
  additionalProperties?: unknown;
}

const LABELS: Record<string, string> = {
  id: 'id',
  at: 'início (s da fonte)',
  start: 'início (s da fonte)',
  end: 'fim (s da fonte)',
  duration: 'duração (s de saída)',
  reason: 'motivo — o que reforça na fala',
  component: 'componente',
  hidesCaptions: 'esconde a legenda',
  wipe: 'entrada',
  layer: 'camada',
  presenter: 'palco (apresentador em cartão)',
  shorts: 'no Short',
  scale: 'escala',
  mode: 'modo',
  'focus.x': 'foco x',
  'focus.y': 'foco y',
  intoClip: 'no corte de',
  type: 'tipo',
  preset: 'preset',
  intensity: 'intensidade',
  file: 'arquivo',
  from: 'começa no s do arquivo',
  fit: 'encaixe',
  gainDb: 'ganho (dB)',
  props: 'props',
};

/** Campos que o formulário não mostra: as props têm editor próprio. */
const SKIP = new Set(['props']);

function typeOf(schema: JsonSchema): string | undefined {
  return Array.isArray(schema.type) ? schema.type.find((type) => type !== 'null') : schema.type;
}

export function fieldsFromJsonSchema(schema: JsonSchema, prefix: string[] = []): Field[] {
  const fields: Field[] = [];
  const required = new Set(schema.required ?? []);
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
    if (prefix.length === 0 && SKIP.has(name)) continue;
    const path = [...prefix, name];
    const key = path.join('.');
    const base = {
      key,
      path,
      label: LABELS[key] ?? name,
      required: required.has(name) && prop.default === undefined,
      ...(prop.default !== undefined ? { defaultValue: prop.default } : {}),
      ...(key === 'id' ? { readOnly: true } : {}),
    };
    const type = typeOf(prop);
    if (prop.enum) {
      fields.push({ ...base, type: 'enum', options: prop.enum.map(String) });
    } else if (type === 'number' || type === 'integer') {
      const min = prop.minimum ?? prop.exclusiveMinimum;
      fields.push({ ...base, type: 'number', ...(min !== undefined ? { min } : {}), ...(prop.maximum !== undefined ? { max: prop.maximum } : {}) });
    } else if (type === 'boolean') {
      fields.push({ ...base, type: 'boolean' });
    } else if (type === 'string') {
      fields.push({ ...base, type: name === 'reason' ? 'text' : 'string', ...(name === 'reason' ? { required: true } : {}) });
    } else if (type === 'object' && prop.properties && Object.values(prop.properties).every((inner) => ['number', 'integer'].includes(typeOf(inner) ?? ''))) {
      fields.push(...fieldsFromJsonSchema(prop, path).map((field) => ({ ...field, required: false })));
    } else {
      fields.push({ ...base, type: 'json' });
    }
  }
  return fields;
}

/** Campos das props de um componente, inferidos do `sample` do registry (o schema das props é livre). */
export function fieldsFromSample(sample: Record<string, unknown>): Field[] {
  return Object.entries(sample).map(([name, value]): Field => {
    const base = { key: `props.${name}`, path: ['props', name], label: name, required: false };
    if (typeof value === 'number') return { ...base, type: 'number' };
    if (typeof value === 'boolean') return { ...base, type: 'boolean' };
    if (typeof value === 'string') return { ...base, type: value.length > 48 || value.includes('\n') ? 'text' : 'string' };
    return { ...base, type: 'json' };
  });
}

export function getAt(target: unknown, path: string[]): unknown {
  let cursor = target;
  for (const part of path) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

export function setAt<T extends Record<string, unknown>>(target: T, path: string[], value: unknown): T {
  const [head, ...rest] = path;
  if (head === undefined) return target;
  const current = target[head];
  const next = rest.length === 0 ? value : setAt((current && typeof current === 'object' ? current : {}) as Record<string, unknown>, rest, value);
  const copy: Record<string, unknown> = { ...target };
  if (next === undefined) delete copy[head];
  else copy[head] = next;
  return copy as T;
}

/** Texto do campo → valor. Campo vazio opcional = sem valor (o schema aplica o padrão). */
export function parseFieldInput(field: Field, raw: string | boolean): { value: unknown } | { error: string } {
  if (field.type === 'boolean') return { value: Boolean(raw) };
  const text = String(raw);
  if (text.trim() === '') {
    if (field.required) return { error: `${field.label}: obrigatório` };
    return { value: undefined };
  }
  if (field.type === 'number') {
    const value = Number(text.replace(',', '.'));
    if (!Number.isFinite(value)) return { error: `${field.label}: número inválido` };
    if (field.min !== undefined && value < field.min) return { error: `${field.label}: mínimo ${field.min}` };
    if (field.max !== undefined && value > field.max) return { error: `${field.label}: máximo ${field.max}` };
    return { value };
  }
  if (field.type === 'json') {
    try {
      return { value: JSON.parse(text) };
    } catch {
      return { error: `${field.label}: JSON inválido` };
    }
  }
  if (field.type === 'enum' && field.options && !field.options.includes(text)) return { error: `${field.label}: opção inválida` };
  return { value: text };
}

/** Valor → texto do campo. */
export function formatFieldValue(field: Field, value: unknown): string | boolean {
  if (field.type === 'boolean') return Boolean(value ?? field.defaultValue);
  if (value === undefined || value === null) return field.type === 'json' && value === null ? 'null' : '';
  if (field.type === 'json') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * O que mudou nas chaves de primeiro nível. O `updateItem` mescla raso e o JSON some com `undefined`: campo opcional
 * apagado (ausente/undefined/texto vazio) vai em `unset`, senão a chave antiga ficaria na EDL.
 */
export function buildUpdate(original: Record<string, unknown>, edited: Record<string, unknown>): { patch: Record<string, unknown>; unset: string[] } {
  const patch: Record<string, unknown> = {};
  const unset: string[] = [];
  const keys = new Set([...Object.keys(original), ...Object.keys(edited)]);
  for (const key of keys) {
    if (key === 'id' || JSON.stringify(original[key]) === JSON.stringify(edited[key])) continue;
    const value = edited[key];
    if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
      if (original[key] !== undefined) unset.push(key);
    } else patch[key] = value;
  }
  return { patch, unset };
}

/** Só o patch (sem as remoções); ver `buildUpdate`. */
export function buildPatch(original: Record<string, unknown>, edited: Record<string, unknown>): Record<string, unknown> {
  return buildUpdate(original, edited).patch;
}

/** `reason` obrigatório (STYLE.md §1): sem ele o item não salva. O SFX não tem o campo. */
export function missingReason(kind: string, item: Record<string, unknown>): boolean {
  if (kind === 'sfx') return false;
  return typeof item.reason !== 'string' || item.reason.trim() === '';
}
