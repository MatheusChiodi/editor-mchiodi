import { useMemo, useState } from 'react';
import { z } from 'zod';

import type { ItemKind } from '../../../src/cut/ops.ts';
import { brollSchema, effectSchema, overlaySchema, sfxSchema, transitionSchema, zoomSchema } from '../../../src/edl/schema.ts';
import { type Field, fieldsFromJsonSchema, fieldsFromSample, formatFieldValue, getAt, parseFieldInput, setAt } from '../lib/schema-form.ts';
import { inputClass } from './ui.tsx';

const SCHEMAS: Record<ItemKind, z.ZodType> = {
  overlays: overlaySchema,
  broll: brollSchema,
  zooms: zoomSchema,
  transitions: transitionSchema,
  effects: effectSchema,
  sfx: sfxSchema,
};

const cache = new Map<ItemKind, Field[]>();

export function schemaFields(kind: ItemKind): Field[] {
  let fields = cache.get(kind);
  if (!fields) {
    fields = fieldsFromJsonSchema(z.toJSONSchema(SCHEMAS[kind], { io: 'input', unrepresentable: 'any' }) as Parameters<typeof fieldsFromJsonSchema>[0]);
    cache.set(kind, fields);
  }
  return fields;
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (value: unknown) => void }) {
  const shown = formatFieldValue(field, value);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commit = (raw: string | boolean) => {
    const parsed = parseFieldInput(field, raw);
    if ('error' in parsed) return setError(parsed.error);
    setError(null);
    setDraft(null);
    onChange(parsed.value);
  };
  const reasonMissing = field.key === 'reason' && !String(value ?? '').trim();
  let control;
  if (field.type === 'boolean') {
    control = <input type="checkbox" checked={Boolean(shown)} onChange={(event) => commit(event.target.checked)} className="accent-coral" />;
  } else if (field.type === 'enum') {
    control = (
      <select value={String(shown)} onChange={(event) => commit(event.target.value)} className={inputClass} disabled={field.readOnly}>
        {!field.required && <option value="">(padrão{field.defaultValue !== undefined ? `: ${String(field.defaultValue)}` : ''})</option>}
        {field.options!.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else if (field.type === 'text' || field.type === 'json') {
    control = (
      <textarea
        value={draft ?? String(shown)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== null && commit(draft)}
        rows={field.type === 'json' ? Math.min(8, String(shown).split('\n').length + 1) : 2}
        className={`${inputClass} ${field.type === 'json' ? 'font-mono text-[11px]' : ''} ${reasonMissing ? 'border-coral/70' : ''}`}
        placeholder={field.key === 'reason' ? 'o que este item reforça na fala (obrigatório)' : field.defaultValue !== undefined ? `padrão: ${JSON.stringify(field.defaultValue)}` : ''}
      />
    );
  } else {
    control = (
      <input
        value={draft ?? String(shown)}
        readOnly={field.readOnly}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== null && commit(draft)}
        onKeyDown={(event) => event.key === 'Enter' && draft !== null && commit(draft)}
        className={`${inputClass} ${field.readOnly ? 'opacity-50' : ''}`}
        inputMode={field.type === 'number' ? 'decimal' : undefined}
        placeholder={field.defaultValue !== undefined ? `padrão: ${String(field.defaultValue)}` : ''}
      />
    );
  }
  return (
    <label className={`grid gap-1 ${field.type === 'boolean' ? 'grid-cols-[1fr_auto] items-center' : ''}`}>
      <span className={`text-[10px] font-semibold ${reasonMissing ? 'text-coral' : 'text-s300/70'}`}>
        {field.label}
        {(field.required || field.key === 'reason') && ' *'}
      </span>
      {control}
      {error && <span className="text-[10px] text-coral">{error}</span>}
    </label>
  );
}

/** Formulário de um item da EDL: campos do schema Zod + props do componente (pelo valor atual/sample). */
export function ItemForm({ kind, value, onChange }: { kind: ItemKind; value: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  const fields = schemaFields(kind);
  const props = (value.props ?? null) as Record<string, unknown> | null;
  const propFields = useMemo(() => (props ? fieldsFromSample(props) : []), [props]);
  const ordered = [...fields.filter((field) => field.key === 'reason'), ...fields.filter((field) => field.key !== 'reason')];
  return (
    <div className="grid gap-2.5">
      {ordered.map((field) => (
        <FieldInput key={field.key} field={field} value={getAt(value, field.path)} onChange={(next) => onChange(setAt(value, field.path, next))} />
      ))}
      {kind === 'overlays' && (
        <div className="mt-1 grid gap-2.5 rounded-md border border-paper/10 p-2">
          <div className="text-[10px] font-bold tracking-wider text-s300/50 uppercase">props do componente</div>
          {propFields.map((field) => (
            <FieldInput key={field.key} field={field} value={getAt(value, field.path)} onChange={(next) => onChange(setAt(value, field.path, next))} />
          ))}
          <FieldInput
            field={{ key: 'props', path: ['props'], label: 'todas as props (JSON)', type: 'json', required: false }}
            value={props ?? {}}
            onChange={(next) => onChange({ ...value, props: next ?? {} })}
          />
        </div>
      )}
    </div>
  );
}
