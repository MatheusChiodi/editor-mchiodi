import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { captionPages, highlightOp, pageAt, replaceOp } from '../cut/src/lib/captions.ts';
import { draftInsert } from '../cut/src/lib/insert.ts';
import { buildPatch, fieldsFromJsonSchema, fieldsFromSample, formatFieldValue, getAt, missingReason, parseFieldInput, setAt } from '../cut/src/lib/schema-form.ts';
import { budgetUse, evalMarkers, percentFromLine, themeCssVars, withAlpha } from '../cut/src/lib/ui.ts';
import { createTimeMap } from '../cut/src/lib/timemap.ts';
import { applyOps } from '../src/cut/ops.ts';
import { overlaySchema, transitionSchema, zoomSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { baseEdl, SPEECH, WORDS } from './cut-fixture.ts';

const json = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Parameters<typeof fieldsFromJsonSchema>[0];

describe('formulário do schema Zod', () => {
  it('zoom: números com limites, enum, foco aninhado, reason obrigatório', () => {
    const fields = fieldsFromJsonSchema(json(zoomSchema));
    const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));
    expect(byKey.id!.readOnly).toBe(true);
    expect(byKey.scale).toMatchObject({ type: 'number', min: 1, max: 1.6 });
    expect(byKey.mode).toMatchObject({ type: 'enum', options: ['punch', 'ease', 'ken-burns'] });
    expect(byKey['focus.x']).toMatchObject({ type: 'number', path: ['focus', 'x'] });
    expect(byKey.reason).toMatchObject({ type: 'text', required: true });
  });

  it('overlay: props fora (editor próprio), palco vira JSON', () => {
    const fields = fieldsFromJsonSchema(json(overlaySchema));
    expect(fields.some((field) => field.key === 'props')).toBe(false);
    expect(fields.find((field) => field.key === 'presenter')!.type).toBe('json');
    expect(fields.find((field) => field.key === 'hidesCaptions')!.type).toBe('boolean');
  });

  it('transição: tipo é a lista do catálogo', () => {
    const type = fieldsFromJsonSchema(json(transitionSchema)).find((field) => field.key === 'type')!;
    expect(type.options).toContain('cross-dissolve');
  });

  it('props pelo sample do componente', () => {
    const fields = fieldsFromSample({ title: 'Oi', count: 3, on: true, items: ['a'] });
    expect(fields.map((field) => field.type)).toEqual(['string', 'number', 'boolean', 'json']);
    expect(fields[0]!.path).toEqual(['props', 'title']);
  });

  it('entrada → valor, com validação', () => {
    const number = { key: 'scale', path: ['scale'], label: 'escala', type: 'number' as const, min: 1, max: 1.6, required: false };
    expect(parseFieldInput(number, '1,2')).toEqual({ value: 1.2 });
    expect(parseFieldInput(number, '2')).toEqual({ error: 'escala: máximo 1.6' });
    expect(parseFieldInput(number, '')).toEqual({ value: undefined });
    const reason = { key: 'reason', path: ['reason'], label: 'motivo', type: 'text' as const, required: true };
    expect(parseFieldInput(reason, '  ')).toEqual({ error: 'motivo: obrigatório' });
    const data = { key: 'p', path: ['p'], label: 'p', type: 'json' as const, required: false };
    expect(parseFieldInput(data, '{"a":1}')).toEqual({ value: { a: 1 } });
    expect('error' in parseFieldInput(data, '{a')).toBe(true);
    expect(formatFieldValue(data, { a: 1 })).toContain('"a": 1');
  });

  it('patch só com o que mudou; set/get aninhado', () => {
    const original = { id: 'z1', at: 1, focus: { x: 0.5, y: 0.4 }, reason: 'a' };
    const edited = setAt(original, ['focus', 'x'], 0.7);
    expect(getAt(edited, ['focus', 'x'])).toBe(0.7);
    expect(original.focus.x).toBe(0.5);
    expect(buildPatch(original, edited)).toEqual({ focus: { x: 0.7, y: 0.4 } });
    expect(missingReason('zooms', { reason: ' ' })).toBe(true);
    expect(missingReason('sfx', {})).toBe(false);
  });
});

describe('legendas', () => {
  const edl = baseEdl({ captions: { replacements: { reakt: 'React' }, highlights: ['vite'], maxWordsPerPage: 2 } });
  const timeline = buildTimeline(edl.clips, 30);
  const pages = captionPages(WORDS, timeline, edl.captions);

  it('pagina como o render e mostra a correção e o destaque', () => {
    expect(pages.every((page) => page.words.length <= 2)).toBe(true);
    const all = pages.flatMap((page) => page.words);
    expect(all.find((word) => word.raw === 'reakt')).toMatchObject({ shown: 'React', replaced: true });
    expect(all.find((word) => word.raw === 'vite')!.highlighted).toBe(true);
    expect(pageAt(pages, 0)).toBe(0);
    expect(pageAt(pages, 99)).toBe(pages.length - 1);
  });

  it('edição inline vira captionReplace / captionHighlight que o servidor aceita', () => {
    const word = pages.flatMap((page) => page.words).find((item) => item.raw === 'pessoal')!;
    const op = replaceOp(word, 'Pessoal');
    expect(op).toEqual({ type: 'captionReplace', from: 'pessoal', to: 'Pessoal' });
    const react = pages.flatMap((page) => page.words).find((item) => item.raw === 'reakt')!;
    expect(replaceOp(react, '')).toEqual({ type: 'captionReplace', from: 'reakt', to: null });
    expect(replaceOp(react, 'React')).toBeNull();
    const highlight = highlightOp(word)!;
    const result = applyOps(edl, [op!, highlight], SPEECH);
    expect(result.edl.captions.replacements.pessoal).toBe('Pessoal');
    expect(result.edl.captions.highlights).toContain('pessoal');
  });
});

describe('inserir do arsenal', () => {
  const edl = baseEdl();
  const timeline = buildTimeline(edl.clips, 30);
  const lookup = (name: string) => (name === 'LowerThird' ? { defaultDuration: 5, sample: { title: 'x' } } : name === 'TechBadge' || name === 'TextReveal' ? { defaultDuration: 3, sample: {} } : undefined);

  it('componente vira overlay no playhead, com props de exemplo e reason vazio', () => {
    const draft = draftInsert('components', 'LowerThird', 2.0, timeline, [], lookup);
    expect(draft).toMatchObject({ ok: true, kind: 'overlays', item: { component: 'LowerThird', at: 2, duration: 5, props: { title: 'x' }, reason: '' } });
  });

  it('transição entra no próximo corte livre', () => {
    const draft = draftInsert('transitions', 'cross-dissolve', 0.5, timeline, [], lookup);
    expect(draft.item).toMatchObject({ intoClip: 'c002', type: 'cross-dissolve' });
    const taken = draftInsert('transitions', 'cross-dissolve', 0.5, timeline, [{ intoClip: 'c002' }], lookup);
    expect(taken.item).toMatchObject({ intoClip: 'c003' });
  });

  it('recusa trecho cortado e categoria que não vira item', () => {
    expect(draftInsert('components', 'LowerThird', 1.5, timeline, [], lookup).ok).toBe(false);
    expect(draftInsert('themes', 'neutro', 0.5, timeline, [], lookup).ok).toBe(false);
    expect(draftInsert('tech', 'tech:react', 0.5, timeline, [], lookup).item).toMatchObject({ component: 'TechBadge', props: { tech: 'react' } });
    expect(draftInsert('models', 'FileiraDeItens', 0.5, timeline, [], lookup).item).toMatchObject({ component: 'scene:modelos/FileiraDeItens' });
  });

  it('o item só passa no servidor depois do reason', () => {
    const draft = draftInsert('effects', 'look-mono', 0.5, timeline, [], lookup);
    expect(() => applyOps(edl, [{ type: 'insertItem', kind: 'effects', item: draft.item! }], SPEECH)).toThrow(/reason/);
    expect(applyOps(edl, [{ type: 'insertItem', kind: 'effects', item: { ...draft.item!, reason: 'flashback' } }], SPEECH).edl.effects).toHaveLength(1);
  });
});

describe('utilidades da UI', () => {
  it('tokens do tema viram variáveis CSS', () => {
    const vars = themeCssVars({ color: { coral: '#ff5555', slate900: '#0f172a', glowMint: '#9dffce' }, font: { body: 'Inter' } });
    expect(vars).toEqual({ '--mc-coral': '#ff5555', '--mc-slate-900': '#0f172a', '--mc-glow-mint': '#9dffce', '--mc-font-body': 'Inter' });
    expect(withAlpha('#ff5555', 0.5)).toBe('rgba(255, 85, 85, 0.5)');
  });

  it('achados do eval viram marcadores pelo instante da fonte', () => {
    const timeline = buildTimeline(baseEdl().clips, 30);
    const map = createTimeMap(timeline, 6, 'output', 100);
    const markers = evalMarkers(
      [
        { severity: 'warning', check: 'sem-respiro', at: 1.3, message: 'm', fix: 'f', outputSec: 1.3, sourceSec: 2.0 },
        { severity: 'error', check: 'duracao', at: null, message: 'm', fix: 'f', outputSec: null, sourceSec: null },
      ],
      map,
    );
    expect(markers).toHaveLength(1);
    expect(markers[0]!.x).toBeCloseTo(130, 1);
  });

  it('orçamento do nível', () => {
    expect(budgetUse(3, 60, { min: 0, max: 1 }).status).toBe('acima');
    expect(budgetUse(1, 60, { min: 2, max: 6 }).status).toBe('abaixo');
    expect(budgetUse(1, 60, { min: 0, max: 0 }).status).toBe('proibido');
    expect(budgetUse(2, 60, { min: 0, max: 3 })).toEqual({ perMinute: 2, status: 'ok' });
  });

  it('percentual numa linha de log', () => {
    expect(percentFromLine('render 42% (eta 10s)')).toBe(42);
    expect(percentFromLine('sem número')).toBeNull();
  });
});
