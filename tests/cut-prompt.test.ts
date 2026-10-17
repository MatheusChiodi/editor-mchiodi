import { describe, expect, it } from 'vitest';

import { canRedo, canUndo, emptyHistory, pending, pushOp, redo, undo } from '../src/cut/history.ts';
import { buildPanelPrompt, describeSelection, panelArgs, parseStreamLine } from '../src/cut/prompt.ts';

const headless = { model: '', maxBudgetUsd: 0, timeoutMin: 30, useApiKey: false, extraTools: [] };

describe('buildPanelPrompt', () => {
  const prompt = buildPanelPrompt({
    slug: 'demo',
    version: 7,
    level: 'pro',
    instruction: 'tira as hesitações do bloco 3',
    selection: { start: 12.5, end: 30, ids: ['c012', 'lt-vite'] },
  });

  it('leva slug, versão, seleção (fonte) e a instrução literal', () => {
    expect(prompt).toContain('projeto "demo", EDL atual v7 (nível pro)');
    expect(prompt).toContain('12.50s–30.00s');
    expect(prompt).toContain('pnpm mce words demo --from 12.50 --to 30.00');
    expect(prompt).toContain('itens: c012, lt-vite');
    expect(prompt).toContain('tira as hesitações do bloco 3');
  });

  it('exige resposta como nova versão via mce edl save e respeita as decisões do Matheus', () => {
    expect(prompt).toContain('pnpm mce edl save demo projects/demo/cut/proposta.json');
    expect(prompt).toContain('notes "Matheus:"');
    expect(prompt).toContain('Não troque o nível (pro)');
    expect(prompt).toContain('RESULTADO:');
  });

  it('sem seleção, vale para o vídeo todo', () => {
    expect(describeSelection(undefined)).toContain('vídeo todo');
  });
});

describe('panelArgs', () => {
  it('mesmos argumentos do watcher, com stream-json e --verbose', () => {
    const args = panelArgs('oi', headless);
    expect(args.slice(0, 2)).toEqual(['-p', 'oi']);
    expect(args).toContain('dontAsk');
    expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json');
    expect(args.at(-1)).toBe('--verbose');
    expect(args).toContain('Bash(pnpm mce *)');
  });
});

describe('parseStreamLine', () => {
  it('texto e ferramenta do assistente, resultado final', () => {
    const assistant = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Vou cortar' }, { type: 'tool_use', name: 'Bash', input: { command: 'pnpm mce edl save demo x.json' } }] } });
    expect(parseStreamLine(assistant)).toEqual([
      { kind: 'text', text: 'Vou cortar' },
      { kind: 'tool', name: 'Bash', detail: 'pnpm mce edl save demo x.json' },
    ]);
    expect(parseStreamLine(JSON.stringify({ type: 'result', result: 'RESULTADO: ok — v8', is_error: false, total_cost_usd: 0.1, num_turns: 4 }))).toEqual([
      { kind: 'result', ok: true, text: 'RESULTADO: ok — v8', costUsd: 0.1, turns: 4 },
    ]);
    expect(parseStreamLine(JSON.stringify({ type: 'system', subtype: 'init' }))).toEqual([]);
    expect(parseStreamLine('')).toEqual([]);
  });
});

describe('history', () => {
  it('undo/redo de operações locais; nova op limpa o redo', () => {
    let history = emptyHistory<string>();
    history = pushOp(pushOp(history, 'a'), 'b');
    history = undo(history);
    expect(pending(history)).toEqual(['a']);
    expect(canRedo(history)).toBe(true);
    history = redo(history);
    expect(pending(history)).toEqual(['a', 'b']);
    history = pushOp(undo(history), 'c');
    expect(pending(history)).toEqual(['a', 'c']);
    expect(canRedo(history)).toBe(false);
    expect(canUndo(emptyHistory())).toBe(false);
    expect(undo(emptyHistory())).toEqual(emptyHistory());
  });
});
