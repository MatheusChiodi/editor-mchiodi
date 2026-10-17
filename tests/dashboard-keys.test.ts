import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { DashboardItem } from '../src/project/dashboard.ts';
import {
  type ActionFacts,
  isSafeTarget,
  localUrl,
  openTarget,
  performAction,
  pidAlive,
  planAction,
  readScenesServer,
  SCENES_OFFLINE,
  suggestedCommand,
} from '../src/project/dashboard-actions.ts';
import { initialState, KEY_HELP, parseKeys, type PanelState, reduce, syncState } from '../src/project/dashboard-keys.ts';
import { buildPipeline, type Snapshot } from '../src/project/pipeline.ts';

const state = (extra: Partial<PanelState> = {}): PanelState => ({ slugs: ['a', 'b', 'c'], selected: 'a', expanded: false, help: false, ...extra });

describe('parseKeys', () => {
  it('setas, j/k, Enter, Esc, Ctrl+C e as letras do painel', () => {
    expect(parseKeys('\u001b[A')).toEqual(['up']);
    expect(parseKeys('\u001b[B')).toEqual(['down']);
    expect(parseKeys('\u001bOA\u001bOB')).toEqual(['up', 'down']);
    expect(parseKeys('jk')).toEqual(['down', 'up']);
    expect(parseKeys('\r')).toEqual(['enter']);
    expect(parseKeys('\r\n')).toEqual(['enter']);
    expect(parseKeys('\u001b')).toEqual(['escape']);
    expect(parseKeys('\u0003')).toEqual(['quit']);
    expect(parseKeys('q?opregc')).toEqual(['quit', 'help', 'output', 'video', 'report', 'project', 'scenes', 'copy']);
    expect(parseKeys('O')).toEqual(['output']);
  });

  it('várias teclas no mesmo pedaço; sequência desconhecida some inteira', () => {
    expect(parseKeys('j\u001b[Bo')).toEqual(['down', 'down', 'output']);
    expect(parseKeys('\u001b[C')).toEqual([]);
    expect(parseKeys('\u001b[15~')).toEqual([]);
    expect(parseKeys('\u001b[1;5Cq')).toEqual(['quit']);
    expect(parseKeys('xyz ')).toEqual([]);
    expect(parseKeys('')).toEqual([]);
  });
});

describe('reduce', () => {
  it('↑/↓ andam pela lista e param nas pontas', () => {
    expect(reduce(state(), 'down').state.selected).toBe('b');
    expect(reduce(state({ selected: 'c' }), 'down').state.selected).toBe('c');
    expect(reduce(state({ selected: 'b' }), 'up').state.selected).toBe('a');
    expect(reduce(state(), 'up').state.selected).toBe('a');
    expect(reduce(state({ selected: null }), 'down').state.selected).toBe('a');
    expect(reduce(state({ slugs: [], selected: null }), 'down').state.selected).toBeNull();
    expect(reduce(state(), 'down').action).toBeUndefined();
  });

  it('Enter alterna foco e visão geral; Esc volta para a visão geral', () => {
    const focused = reduce(state(), 'enter').state;
    expect(focused.expanded).toBe(true);
    expect(reduce(focused, 'enter').state.expanded).toBe(false);
    expect(reduce(focused, 'escape').state.expanded).toBe(false);
    expect(reduce(state(), 'escape').state).toEqual(state());
    expect(reduce(state({ slugs: [], selected: null }), 'enter').state.expanded).toBe(false);
  });

  it('? abre e fecha a ajuda; com ela aberta, as outras teclas não agem', () => {
    const open = reduce(state(), 'help').state;
    expect(open.help).toBe(true);
    expect(reduce(open, 'help').state.help).toBe(false);
    expect(reduce(open, 'escape').state.help).toBe(false);
    expect(reduce(open, 'down').state).toEqual(open);
    expect(reduce(open, 'output').action).toBeUndefined();
    expect(reduce(open, 'quit').action).toEqual({ type: 'quit' });
  });

  it('q sai; as letras viram ação sobre a edição selecionada', () => {
    expect(reduce(state(), 'quit')).toEqual({ state: state(), action: { type: 'quit' } });
    const selected = state({ selected: 'b' });
    expect(reduce(selected, 'output').action).toEqual({ type: 'open-output', slug: 'b' });
    expect(reduce(selected, 'video').action).toEqual({ type: 'open-video', slug: 'b' });
    expect(reduce(selected, 'report').action).toEqual({ type: 'open-report', slug: 'b' });
    expect(reduce(selected, 'project').action).toEqual({ type: 'open-project', slug: 'b' });
    expect(reduce(selected, 'copy').action).toEqual({ type: 'copy-next', slug: 'b' });
    expect(reduce(selected, 'scenes').action).toEqual({ type: 'open-scenes' });
    expect(reduce(selected, 'output').state).toBe(selected);
    expect(reduce(state({ slugs: [], selected: null }), 'output').action).toBeUndefined();
    expect(reduce(state({ slugs: [], selected: null }), 'scenes').action).toEqual({ type: 'open-scenes' });
  });

  it('initialState e syncState mantêm a seleção válida quando a lista muda', () => {
    expect(initialState(['a', 'b'], 'b', true)).toEqual({ slugs: ['a', 'b'], selected: 'b', expanded: true, help: false });
    expect(initialState(['a', 'b'], 'sumiu').selected).toBe('a');
    expect(initialState([]).selected).toBeNull();
    const current = state({ selected: 'b' });
    expect(syncState(current, ['a', 'b', 'c'])).toBe(current);
    expect(syncState(current, ['b', 'z']).selected).toBe('b');
    expect(syncState(current, ['x', 'y'], 'y').selected).toBe('y');
    expect(syncState(current, ['x', 'y']).selected).toBe('x');
    expect(syncState(current, []).selected).toBeNull();
  });

  it('a ajuda lista todas as teclas', () => {
    const text = KEY_HELP.map(([keys]) => keys).join(' ');
    for (const key of ['↑', 'j', 'Enter', 'o', 'p', 'r', 'e', 'g', 'c', '?', 'q']) expect(text).toContain(key);
  });
});

const facts = (extra: Partial<ActionFacts> = {}): ActionFacts => ({
  slug: 'aula',
  outputDir: 'D:\\saida\\aula',
  projectDir: 'D:\\projetos\\aula',
  report: 'D:\\saida\\aula\\relatorio.md',
  video: 'D:\\projetos\\aula\\renders\\v4-preview\\preview.mp4',
  command: 'pnpm mce eval aula',
  scenes: { url: 'http://localhost:4173/', alive: true },
  ...extra,
});

describe('ações', () => {
  it('planAction diz o que abrir ou copiar e o aviso do rodapé', () => {
    expect(planAction({ type: 'open-output', slug: 'aula' }, facts())).toEqual({ notice: 'abrindo output/aula', open: 'D:\\saida\\aula' });
    expect(planAction({ type: 'open-project', slug: 'aula' }, facts())).toEqual({ notice: 'abrindo projects/aula', open: 'D:\\projetos\\aula' });
    expect(planAction({ type: 'open-report', slug: 'aula' }, facts()).open).toBe('D:\\saida\\aula\\relatorio.md');
    expect(planAction({ type: 'open-video', slug: 'aula' }, facts())).toEqual({ notice: 'abrindo preview.mp4 (v4-preview)', open: facts().video });
    expect(planAction({ type: 'open-video', slug: 'aula' }, facts({ video: 'D:\\saida\\aula\\final.mp4' })).notice).toBe('abrindo final.mp4');
    expect(planAction({ type: 'copy-next', slug: 'aula' }, facts())).toEqual({ notice: 'copiado: pnpm mce eval aula', copy: 'pnpm mce eval aula' });
    expect(planAction({ type: 'open-scenes' }, facts())).toEqual({ notice: 'abrindo o visor de cenas: http://localhost:4173/', open: 'http://localhost:4173/' });
  });

  it('sem o alvo, só avisa (e diz como criar)', () => {
    const empty = facts({ outputDir: null, projectDir: null, report: null, video: null, command: null, scenes: null });
    expect(planAction({ type: 'open-output', slug: 'aula' }, empty)).toEqual({ notice: 'output/aula ainda não existe' });
    expect(planAction({ type: 'open-report', slug: 'aula' }, empty)).toEqual({ notice: 'sem relatório ainda: pnpm mce report aula' });
    expect(planAction({ type: 'open-video', slug: 'aula' }, empty)).toEqual({ notice: 'nenhum vídeo renderizado ainda: pnpm mce render aula' });
    expect(planAction({ type: 'copy-next', slug: 'aula' }, empty)).toEqual({ notice: 'nenhum comando para copiar agora' });
    expect(planAction({ type: 'open-scenes' }, empty)).toEqual({ notice: SCENES_OFFLINE });
    expect(planAction({ type: 'open-scenes' }, facts({ scenes: { url: 'http://localhost:4173/', alive: false } }))).toEqual({ notice: SCENES_OFFLINE });
    expect(SCENES_OFFLINE).toBe('visor de cenas fora do ar: pnpm mce scenes watch');
  });

  it('alvo com caractere que o cmd reinterpreta não é aberto', () => {
    expect(isSafeTarget('D:\\PROJETOS\\Sistemas\\editor-mchiodi\\output\\aula 2 (final)')).toBe(true);
    for (const bad of ['a&calc', 'a|b', '%TEMP%', 'a^b', 'a"b', 'a\nb', '', 'a>b']) expect(isSafeTarget(bad)).toBe(false);
    const plan = planAction({ type: 'open-output', slug: 'aula' }, facts({ outputDir: 'D:\\saida\\a&calc' }));
    expect(plan.open).toBeUndefined();
    expect(plan.notice).toContain('caractere especial');
  });

  it('localUrl só aceita http(s) em localhost', () => {
    expect(localUrl('http://localhost:4173')).toBe('http://localhost:4173/');
    expect(localUrl('http://127.0.0.1:5000/cenas')).toBe('http://127.0.0.1:5000/cenas');
    expect(localUrl('https://exemplo.com')).toBeNull();
    expect(localUrl('file:///C:/Windows/System32/calc.exe')).toBeNull();
    expect(localUrl('http://localhost:4173/?a=1&b=2')).toBeNull();
    expect(localUrl('calc.exe')).toBeNull();
    expect(localUrl(42)).toBeNull();
  });

  it('openTarget chama `cmd /c start "" <alvo>` com os argumentos separados', async () => {
    const calls: [string, string[]][] = [];
    await openTarget('D:\\saida\\aula 2', async (command, args) => void calls.push([command, args]));
    expect(calls).toEqual([['cmd', ['/c', 'start', '', 'D:\\saida\\aula 2']]]);
    await expect(openTarget('a&calc', async () => undefined)).rejects.toThrow('alvo recusado');
  });

  it('pidAlive: sinal 0, EPERM conta como vivo, pid inválido não', () => {
    expect(pidAlive(process.pid)).toBe(true);
    expect(pidAlive(0)).toBe(false);
    expect(pidAlive(Number.NaN)).toBe(false);
    const fail = (code: string) => () => {
      throw Object.assign(new Error(code), { code });
    };
    expect(pidAlive(123, fail('ESRCH'))).toBe(false);
    expect(pidAlive(123, fail('EPERM'))).toBe(true);
  });

  it('readScenesServer lê o contrato do visor e confere o pid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mce-scenes-'));
    try {
      const file = join(dir, 'server.json');
      expect(readScenesServer(file)).toBeNull();
      writeFileSync(file, JSON.stringify({ url: 'http://localhost:4173', pid: 4321, startedAt: 1 }));
      expect(readScenesServer(file, (pid) => pid === 4321)).toEqual({ url: 'http://localhost:4173/', alive: true });
      expect(readScenesServer(file, () => false)).toEqual({ url: 'http://localhost:4173/', alive: false });
      writeFileSync(file, JSON.stringify({ url: 'http://localhost:4173' }));
      expect(readScenesServer(file, () => true)).toEqual({ url: 'http://localhost:4173/', alive: false });
      writeFileSync(file, JSON.stringify({ url: 'https://exemplo.com', pid: 1 }));
      expect(readScenesServer(file, () => true)).toBeNull();
      writeFileSync(file, '{ pela metade');
      expect(readScenesServer(file, () => true)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const item = (extra: Partial<Snapshot> = {}): DashboardItem => {
    const snapshot: Snapshot = {
      slug: 'aula',
      analysis: { started: true, done: true, touchedAt: 0 },
      edlVersions: [1],
      edl: null,
      renders: {},
      delivered: [],
      job: null,
      live: null,
      ...extra,
    };
    return { snapshot, steps: buildPipeline(snapshot, 0) };
  };

  it('suggestedCommand só devolve comando de verdade', () => {
    expect(suggestedCommand(item())).toBeNull(); // a vez é do diretor
    expect(suggestedCommand(item({ analysis: { started: false, done: false, touchedAt: null }, edlVersions: [] }))).toBeNull(); // `analyze <arquivo>` não é copiável
    const ready = item();
    ready.steps = ready.steps.map((step) => (step.key === 'direction' ? { ...step, state: 'done' as const } : step.key === 'preview' ? { ...step, state: 'next' as const } : step));
    expect(suggestedCommand(ready)).toBe('pnpm mce render aula');
    ready.steps = ready.steps.map((step) => (step.key === 'preview' ? { ...step, state: 'running' as const } : step));
    expect(suggestedCommand(ready)).toBeNull();
  });

  it('performAction executa o plano com os efeitos injetados e transforma erro em aviso', async () => {
    const opened: string[] = [];
    const copied: string[] = [];
    const effects = {
      open: async (target: string) => void opened.push(target),
      copy: async (text: string) => void copied.push(text),
      facts: () => facts(),
    };
    expect(await performAction({ type: 'open-output', slug: 'aula' }, undefined, effects)).toBe('abrindo output/aula');
    expect(await performAction({ type: 'copy-next', slug: 'aula' }, undefined, effects)).toBe('copiado: pnpm mce eval aula');
    expect(opened).toEqual(['D:\\saida\\aula']);
    expect(copied).toEqual(['pnpm mce eval aula']);
    const broken = { ...effects, copy: async () => Promise.reject(new Error('clip.exe saiu com código 1\nmais')) };
    expect(await performAction({ type: 'copy-next', slug: 'aula' }, undefined, broken)).toBe('não deu: clip.exe saiu com código 1');
  });
});
