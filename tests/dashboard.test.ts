import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';

import type { ActivityEntry } from '../src/project/activity.ts';
import {
  box,
  type DashboardItem,
  type DashboardOptions,
  finishedSteps,
  meter,
  packItems,
  pad,
  pickFocus,
  renderDashboard,
  shouldColor,
  SPINNER,
  spread,
  stripAnsi,
  truncate,
  visibleWidth,
  watchInterval,
  wrap,
} from '../src/project/dashboard.ts';
import { BELL, ENTER_SCREEN, LEAVE_SCREEN, paintFrame, runDashboard } from '../src/project/dashboard-watch.ts';
import { createVramSampler, type Health, healthParts, parseNvidiaSmi, queryVram } from '../src/project/health.ts';
import { budgetGaps, type ItemExtras, pickVideo, queueSummary, summarizeEval } from '../src/project/insight.ts';
import type { Live } from '../src/project/live.ts';
import { buildPipeline, type EdlSnapshot, type RenderSnapshot, type Snapshot } from '../src/project/pipeline.ts';

const NOW = 1_800_000_000_000;
const ESC = '\u001b[';
const RED = `${ESC}31m`;
const RESET = `${ESC}0m`;

const edl = (extra: Partial<EdlSnapshot> = {}): EdlSnapshot => ({
  version: 2,
  level: 'max',
  clips: 30,
  graphics: 40,
  scenes: 11,
  zooms: 30,
  transitions: 9,
  effects: 8,
  chapters: 5,
  sourceSec: 439,
  durationSec: 400,
  budget: { ok: 6, total: 6 },
  hasShorts: false,
  ...extra,
});

const render = (files: string[], extra: Partial<RenderSnapshot> = {}): RenderSnapshot => ({ files, touchedAt: NOW, eval: null, ...extra });

const item = (extra: Partial<Snapshot> = {}): DashboardItem => {
  const snapshot: Snapshot = {
    slug: 'aula',
    analysis: { started: true, done: true, touchedAt: NOW },
    edlVersions: [1, 2],
    edl: edl(),
    renders: {},
    delivered: [],
    job: null,
    live: null,
    ...extra,
  };
  return { snapshot, steps: buildPipeline(snapshot, NOW) };
};

const rendering: Live = { task: 'preview', label: 'gráficos (Remotion)', percent: 42, etaSec: 185, startedAt: NOW - 80_000, updatedAt: NOW - 1000 };
const directing: Live = { task: 'direction', label: 'criando as cenas do bloco 2', percent: null, etaSec: null, startedAt: NOW - 600_000, updatedAt: NOW - 5000 };

const fresh = (slug: string) => item({ slug, analysis: { started: false, done: false, touchedAt: null }, edlVersions: [], edl: null });
const running = (slug = 'rodando') => item({ slug, live: rendering, renders: { 'v2-preview': render(['cut.mkv']) } });
const many = () => [fresh('novo-video'), item({ slug: 'parado' }), running(), item({ slug: 'dirigindo', live: directing }), fresh('outro')];

const SIZES = [
  [60, 15],
  [80, 24],
  [120, 30],
  [200, 50],
] as const;

describe('medidas de texto', () => {
  it('visibleWidth ignora ANSI e conta 2 colunas para ideograma e emoji', () => {
    expect(visibleWidth('abc')).toBe(3);
    expect(visibleWidth(`${RED}abc${RESET}`)).toBe(3);
    expect(visibleWidth(`${ESC}1;38;2;255;85;85mMChiodi${RESET} ${ESC}?25l`)).toBe(8);
    expect(visibleWidth('✓ ▶ ─│╭╮╰╯ █░ ⠹ …')).toBe(17);
    expect(visibleWidth('日本')).toBe(4);
    expect(visibleWidth('a\u0301')).toBe(1);
    expect(stripAnsi(`${RED}x${RESET}`)).toBe('x');
  });

  it('truncate corta na largura visível, põe "…" e fecha a cor', () => {
    expect(truncate('abcdef', 6)).toBe('abcdef');
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abcdef', 1)).toBe('…');
    expect(truncate('abcdef', 0)).toBe('');
    const cut = truncate(`${RED}abcdef${RESET} fim`, 4);
    expect(cut).toBe(`${RED}abc…${RESET}`);
    expect(visibleWidth(cut)).toBe(4);
    expect(visibleWidth(truncate('日本語です', 4))).toBeLessThanOrEqual(4);
  });

  it('pad, wrap e spread', () => {
    expect(pad('ab', 4)).toBe('ab  ');
    expect(pad('abcdef', 4)).toBe('abc…');
    expect(visibleWidth(pad(`${RED}ab${RESET}`, 5))).toBe(5);
    expect(wrap('um dois três quatro', 8)).toEqual(['um dois', 'três', 'quatro']);
    expect(wrap('', 8)).toEqual([]);
    expect(wrap('palavralongademais', 6)).toEqual(['palav…']);
    expect(spread('ab', 'cd', 8)).toBe('ab    cd');
    expect(spread('abcdef', 'cd', 7)).toBe('abcdef');
  });

  it('meter enche na proporção e nunca passa da largura', () => {
    expect(meter(0, 10)).toBe('░░░░░░░░░░');
    expect(meter(0.5, 10)).toBe('█████░░░░░');
    expect(meter(3, 4)).toBe('████');
    expect(meter(Number.NaN, 4)).toBe('░░░░');
  });

  it('shouldColor e watchInterval', () => {
    expect(shouldColor(true, {})).toBe(true);
    expect(shouldColor(true, { NO_COLOR: '1' })).toBe(false);
    expect(shouldColor(false, {})).toBe(false);
    expect(shouldColor(undefined, {})).toBe(false);
    expect(watchInterval(true)).toBe(1);
    expect(watchInterval('5')).toBe(5);
    expect(watchInterval('0.1')).toBe(0.25);
    expect(watchInterval('abc')).toBe(1);
  });
});

describe('box', () => {
  it('desenha a borda com título e canto direito, toda linha na largura pedida', () => {
    const lines = box(['um', 'uma linha comprida demais para caber'], { width: 24, title: 'aula', right: 'max' });
    expect(lines).toEqual([
      `╭─ aula ${'─'.repeat(9)} max ─╮`,
      `│ um${' '.repeat(18)} │`,
      '│ uma linha comprida … │',
      `╰${'─'.repeat(22)}╯`,
    ]);
    expect(lines.every((line) => visibleWidth(line) === 24)).toBe(true);
  });

  it('sem espaço, o canto direito some e o título encurta', () => {
    const lines = box([], { width: 12, title: 'um-slug-bem-grande', right: 'nível max' });
    expect(lines[0]).toBe('╭─ um-sl… ─╮');
    expect(lines).toHaveLength(2);
    expect(box(['x'], { width: 10 })[0]).toBe('╭────────╮');
  });

  it('com cor, a largura visível não muda', () => {
    const lines = box(['x'], { width: 30, title: `${RED}aula${RESET}`, right: 'max', color: true });
    expect(lines.every((line) => visibleWidth(line) === 30)).toBe(true);
    expect(lines[0]).toContain(`${ESC}90m`);
  });
});

describe('renderDashboard', () => {
  it.each(SIZES)('nenhum quadro passa de %i×%i', (columns, rows) => {
    for (const items of [[], [running()], many(), [...many(), ...many(), ...many(), ...many()]]) {
      for (const color of [false, true]) {
        const frame = renderDashboard({ items, now: NOW, columns, rows, color, tick: 3, intervalSec: 1 });
        expect(frame).toHaveLength(rows);
        expect(Math.max(...frame.map(visibleWidth))).toBeLessThanOrEqual(columns);
      }
    }
  });

  it('tela minúscula não quebra', () => {
    for (const [columns, rows] of [[1, 1], [8, 2], [20, 3], [30, 6]] as const) {
      const frame = renderDashboard({ items: many(), now: NOW, columns, rows, intervalSec: 1 });
      expect(frame.length).toBeLessThanOrEqual(rows);
      expect(Math.max(...frame.map(visibleWidth))).toBeLessThanOrEqual(columns);
    }
  });

  it('cabeçalho com a marca, cartão com borda e rodapé na última linha', () => {
    const frame = renderDashboard({ items: [running('aula')], now: NOW, columns: 100, rows: 24, intervalSec: 1 });
    expect(frame[0]).toMatch(/^ MChiodi Editor {2}1 edição · 1 rodando\s+\d\d:\d\d:\d\d $/);
    expect(frame.find((line) => line.startsWith('╭─ aula '))).toMatch(/nível max · EDL v2 ─╮$/);
    expect(frame.some((line) => line.startsWith('╰'))).toBe(true);
    expect(frame.at(-1)).toContain('atualiza a cada 1s · Ctrl+C sai');
    expect(frame.at(-1)).toContain('✓ feito  ▶ rodando  ! atenção  → próximo  · pendente');
  });

  it('largo: a etapa que roda cabe em uma linha, com spinner, barra, %, falta e decorrido', () => {
    const frame = renderDashboard({ items: [running()], now: NOW, columns: 110, rows: 30, tick: 2 });
    const line = frame.find((text) => text.includes('▶ 4 Preview'))!;
    expect(line).toContain(`${SPINNER[2]} gráficos (Remotion)`);
    expect(line).toContain('████████░░░░░░░░░░░░  42%  faltam ~03:05 · há 01:20');
    const tighter = renderDashboard({ items: [running()], now: NOW, columns: 100 }).find((text) => text.includes('▶ 4 Preview'))!;
    expect(tighter).toMatch(/gráficos \(Remotion\) {2}█+░+ {2}42% {2}faltam ~03:05 · há 01:20 │$/);
    expect(frame.find((text) => text.includes('✓ 3 Direção'))).toContain('EDL v2 · nível max · 40 gráficos');
    expect(frame.join('\n')).toContain('orçamento 6/6 no alvo');
  });

  it('120 colunas ou mais ganha a coluna do estado por extenso', () => {
    const wide = renderDashboard({ items: [running()], now: NOW, columns: 120 }).join('\n');
    expect(wide).toMatch(/▶ 4 Preview\s+em andamento/);
    expect(renderDashboard({ items: [running()], now: NOW, columns: 100 }).join('\n')).not.toContain('em andamento');
  });

  it('estreito: empilha a etapa que roda e abrevia o detalhe das outras', () => {
    const frame = renderDashboard({ items: [running()], now: NOW, columns: 60 });
    const at = frame.findIndex((text) => text.includes('▶ 4 Preview'));
    expect(frame[at]).not.toContain('gráficos');
    expect(frame[at + 1]).toContain(`${SPINNER[0]} gráficos (Remotion)`);
    expect(frame[at + 2]).toMatch(/█+░+ {2}42% {2}faltam ~03:05 · há 01:20/);
    expect(frame.find((text) => text.includes('✓ 3 Direção'))).toContain('…');
    expect(Math.max(...frame.map(visibleWidth))).toBe(60);
  });

  it('direção ao vivo (sem %) mostra o que o diretor faz e há quanto tempo', () => {
    const frame = renderDashboard({ items: [item({ live: directing })], now: NOW, columns: 100, tick: 1 });
    expect(frame.find((text) => text.includes('▶ 3 Direção'))).toContain(`${SPINNER[1]} criando as cenas do bloco 2  há 10:00`);
  });

  it('spinner muda com o tick', () => {
    const at = (tick: number) => renderDashboard({ items: [running()], now: NOW, columns: 100, rows: 24, tick, intervalSec: 1 }).join('\n');
    expect(at(0)).not.toBe(at(1));
    expect(at(0)).toBe(at(SPINNER.length));
    expect(at(1)).toContain(SPINNER[1]);
    expect(at(-1)).toContain(SPINNER.at(-1));
  });

  it('sem cor, nenhum código ANSI; com cor, cada estado na sua e o coral só no título', () => {
    const items = [...many(), item({ slug: 'travado', renders: { 'v2-preview': render(['cut.mkv'], { touchedAt: 0 }) } })];
    const plain = renderDashboard({ items, now: NOW, columns: 120, rows: 80, intervalSec: 1 }).join('\n');
    expect(plain).not.toContain('\u001b');
    const colored = renderDashboard({ items, now: NOW, columns: 120, rows: 80, intervalSec: 1, color: true }).join('\n');
    for (const code of ['32m', '36m', '31m', '33m', '90m']) expect(colored).toContain(ESC + code);
    expect(colored.split('38;2;255;85;85m')).toHaveLength(2);
    expect(colored).toContain(`${ESC}1;38;2;255;85;85mMChiodi Editor${RESET}`);
    expect(stripAnsi(colored)).toBe(plain);
  });

  it('com altura de sobra, todas as edições viram cartão', () => {
    const frame = renderDashboard({ items: many(), now: NOW, columns: 100 });
    expect(frame.filter((line) => line.startsWith('╭'))).toHaveLength(5);
    expect(frame.join('\n')).not.toContain('etapas antes');
    expect(frame.at(-1)).toMatch(/^╰/);
  });

  it('faltando altura, a edição que roda fica com o cartão e as outras viram uma linha cada', () => {
    const frame = renderDashboard({ items: many(), now: NOW, columns: 100, rows: 24, intervalSec: 1 });
    const tops = frame.filter((line) => line.startsWith('╭'));
    expect(tops).toHaveLength(1);
    expect(tops[0]).toContain('rodando');
    expect(frame.some((line) => line.includes('▶ 4 Preview'))).toBe(true);
    for (const slug of ['novo-video', 'parado', 'dirigindo', 'outro']) {
      expect(frame.filter((line) => line.startsWith(` ${slug}`))).toHaveLength(1);
    }
    expect(frame.find((line) => line.startsWith(' dirigindo'))).toContain('▶ Direção');
    expect(frame.find((line) => line.startsWith(' novo-video'))).toMatch(/0\/8 {2}→ Análise$/);
  });

  it('sobrando umas linhas, a edição travada ganha um cartão cortado em vez de tela vazia', () => {
    const stuck = item({ slug: 'travado', renders: { 'v2-preview': render(['cut.mkv'], { touchedAt: 0 }) } });
    const frame = renderDashboard({ items: [running(), stuck], now: NOW, columns: 100, rows: 24, intervalSec: 1 });
    expect(frame).toHaveLength(24);
    expect(frame.filter((line) => line.startsWith('╭'))).toHaveLength(2);
    expect(frame.some((line) => line.includes('! 4 Preview'))).toBe(true);
    expect(frame.some((line) => /\+\d+ etapas/.test(line))).toBe(true);
    expect(frame.filter((line) => line.includes('▶ 4 Preview'))).toHaveLength(1);
  });

  it('recado longo do diretor: por extenso com altura de sobra, cortado sem ela', () => {
    const label = 'pausada a pedido do Matheus: primeiro a referência do nível max, depois as cenas do bloco 2';
    const items = [item({ live: { ...directing, label } })];
    const roomy = renderDashboard({ items, now: NOW, columns: 100 }).join('\n');
    expect(roomy.replace(/[│\s]+/g, ' ')).toContain(`${label} há 10:00`);
    const tight = renderDashboard({ items, now: NOW, columns: 100, rows: 15, intervalSec: 1 });
    expect(tight.find((line) => line.includes('▶ 3 Direção'))).toMatch(/…\s+há 10:00/);
  });

  it('`focus` vence a que está rodando', () => {
    const frame = renderDashboard({ items: many(), now: NOW, columns: 100, rows: 24, intervalSec: 1, focus: 'parado' });
    const tops = frame.filter((line) => line.startsWith('╭'));
    expect(tops).toHaveLength(1);
    expect(tops[0]).toContain('parado');
  });

  it('nem o cartão cabe inteiro: mostra a etapa atual, as vizinhas e "+N etapas"', () => {
    const frame = renderDashboard({ items: many(), now: NOW, columns: 80, rows: 15, intervalSec: 1 });
    expect(frame).toHaveLength(15);
    expect(frame.filter((line) => line.startsWith('╭'))).toHaveLength(1);
    expect(frame.some((line) => line.includes('▶ 4 Preview'))).toBe(true);
    const more = frame.find((line) => /\+\d+ etapas/.test(line))!;
    const hidden = Number(/\+(\d+) etapas/.exec(more)![1]);
    const shown = frame.filter((line) => /^│ [✓▶!→·] \d /.test(line)).length;
    expect(shown + hidden).toBe(9);
    expect(shown).toBeGreaterThan(0);
  });

  it('edições demais para a altura: as prioritárias e "+N edições"', () => {
    const items = Array.from({ length: 20 }, (_, index) => (index === 17 ? running('a-que-roda') : fresh(`video-${index}`)));
    const frame = renderDashboard({ items, now: NOW, columns: 80, rows: 10, intervalSec: 1 });
    expect(frame).toHaveLength(10);
    expect(frame.some((line) => line.startsWith(' a-que-roda'))).toBe(true);
    expect(frame.at(-2)).toBe(' +13 edições');
  });

  it('dica do que fazer: próximo, retomar e concluído; e o modo autônomo', () => {
    const next = renderDashboard({ items: [item({ renders: { 'v2-preview': render(['preview.mp4']) }, job: { status: 'failed', error: 'sem créditos' } })], now: NOW, columns: 100 }).join('\n');
    expect(next).toContain('próximo  pnpm mce eval aula');
    expect(next).toContain('modo autônomo: falhou — sem créditos');
    expect(next).toMatch(/█+░+ {2}4\/8 etapas · 50%/);
    const stuck = renderDashboard({ items: [item({ renders: { 'v2-preview': render(['cut.mkv'], { touchedAt: 0 }) } })], now: NOW, columns: 100 }).join('\n');
    expect(stuck).toContain('interrompido em gráficos');
    expect(stuck).toContain('retomar  pnpm mce render aula');
    const done = item();
    done.steps = done.steps.map((step) => ({ ...step, state: 'done' as const }));
    expect(renderDashboard({ items: [done], now: NOW, columns: 100 }).join('\n')).toContain('concluído · novas correções viram uma nova versão da EDL');
  });

  it('sem projeto nenhum, diz como começar; sem watch, não há rodapé', () => {
    const frame = renderDashboard({ items: [], now: NOW, columns: 100 });
    expect(frame.at(-1)).toContain('nenhum projeto ainda: pnpm mce analyze <arquivo>');
    expect(frame.join('\n')).not.toContain('Ctrl+C');
    expect(renderDashboard({ items: [], now: NOW, columns: 100, rows: 10, intervalSec: 2, notice: 'leitura falhou: x' }).at(-1)).toContain('leitura falhou: x');
  });

  it('acima de 120 colunas o painel para de esticar', () => {
    const frame = renderDashboard({ items: [running()], now: NOW, columns: 200, rows: 50, intervalSec: 1 });
    expect(Math.max(...frame.map(visibleWidth))).toBe(120);
  });
});

describe('watch', () => {
  class FakeOut extends EventEmitter {
    isTTY = true;
    columns = 80;
    rows = 12;
    written: string[] = [];
    write(text: string) {
      this.written.push(text);
      return true;
    }
  }

  it('paintFrame posiciona cada linha, não usa quebra de linha nem apaga a tela', () => {
    const text = paintFrame(['um', 'dois'], 2);
    expect(text).toBe(`${ESC}?2026h${ESC}1;1H${ESC}2Kum${ESC}2;1H${ESC}2Kdois${ESC}?2026l`);
    expect(text).not.toContain('\n');
    expect(text).not.toContain(`${ESC}2J`);
    expect(paintFrame(['um'], 3)).toContain(`${ESC}2;1H${ESC}J`);
    expect(paintFrame(['um', 'dois', 'três'], 2)).not.toContain('três');
  });

  it('entra no buffer alternativo, redesenha no lugar, reage ao resize e devolve o terminal', async () => {
    const out = new FakeOut();
    let stop = () => {};
    let now = NOW;
    let loads = 0;
    const done = runDashboard({
      load: () => {
        loads += 1;
        return [running()];
      },
      intervalSec: 0.02,
      out,
      clock: () => (now += 20),
      frameMs: 5,
      stop: new Promise<void>((resolve) => (stop = resolve)),
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    out.columns = 60;
    out.rows = 8;
    out.emit('resize');
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();
    await done;

    expect(out.written[0]).toContain(ENTER_SCREEN);
    expect(out.written.at(-1)).toBe(LEAVE_SCREEN);
    expect(out.written.length).toBeGreaterThan(4);
    expect(loads).toBeGreaterThan(1);
    expect(out.written.join('')).not.toContain('\n');
    expect(out.written.at(-2)).toContain(`${ESC}8;1H`);
    expect(out.written.at(-2)).not.toContain(`${ESC}9;1H`);
    expect(out.listenerCount('resize')).toBe(0);
  });

  it('erro na leitura não derruba o painel: fica o último quadro e um aviso', async () => {
    const out = new FakeOut();
    out.rows = 20;
    let stop = () => {};
    let now = NOW;
    let loads = 0;
    const done = runDashboard({
      load: () => {
        loads += 1;
        if (loads > 1) throw new Error('JSON pela metade');
        return [running()];
      },
      intervalSec: 0.01,
      color: false,
      out,
      clock: () => (now += 20),
      frameMs: 5,
      stop: new Promise<void>((resolve) => (stop = resolve)),
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    stop();
    await done;
    const last = out.written.at(-2)!;
    expect(last).toContain('leitura falhou: JSON pela metade');
    expect(last).toContain('▶ 4 Preview');
  });

  it('saída redirecionada: texto puro, sem buffer alternativo', async () => {
    const out = new FakeOut();
    out.isTTY = false;
    let stop = () => {};
    const done = runDashboard({ load: () => [running()], intervalSec: 0.01, out, stop: new Promise<void>((resolve) => (stop = resolve)) });
    await new Promise((resolve) => setTimeout(resolve, 35));
    stop();
    await done;
    expect(out.written.length).toBeGreaterThan(1);
    expect(out.written.join('')).not.toContain('\u001b');
    expect(out.written[0]).toContain('MChiodi Editor');
  });
});

const GB = 1024 ** 3;
const HOUR_AGO = NOW - 3_600_000;
const activity: ActivityEntry[] = [
  { at: HOUR_AGO, kind: 'step-start', step: 'analysis', text: 'análise iniciada' },
  { at: HOUR_AGO + 192_000, kind: 'step-done', step: 'analysis', text: 'análise concluída em 03:12', durationSec: 192 },
  { at: HOUR_AGO + 600_000, kind: 'note', step: 'direction', text: 'criando as cenas do bloco 2' },
  { at: HOUR_AGO + 900_000, kind: 'step-start', step: 'preview', text: 'render preview iniciado' },
  { at: HOUR_AGO + 1_030_000, kind: 'step-failed', step: 'preview', text: 'render preview falhou após 02:10: sem memória', durationSec: 130 },
  { at: HOUR_AGO + 1_100_000, kind: 'step-start', step: 'preview', text: 'render preview iniciado' },
  { at: HOUR_AGO + 1_729_000, kind: 'step-done', step: 'preview', text: 'render preview concluído em 10:29', durationSec: 629 },
  { at: HOUR_AGO + 1_800_000, kind: 'step-start', step: 'eval', text: 'autoavaliação iniciada' },
  { at: HOUR_AGO + 1_930_000, kind: 'step-done', step: 'eval', text: 'autoavaliação concluída em 02:10', durationSec: 130 },
];
const extras: ItemExtras = {
  activity,
  eval: {
    render: 'v2-preview',
    passed: false,
    errors: 2,
    warnings: 3,
    top: [
      { severity: 'error', text: 'corte-em-palavra: corte no meio de "exemplo" em 01:23.40' },
      { severity: 'error', text: 'estalo: descontinuidade de áudio em 02:10.00' },
      { severity: 'warning', text: 'abaixo-do-nivel: 8 cenas ilustrativas (nível max: 11–20)' },
    ],
  },
  budgetGaps: ['faltam 3 cenas', 'sobram 2 zooms'],
};
/** preview pronto, avaliação reprovada, com histórico: a edição que o painel mostra em foco */
const detailed = (slug = 'aula'): DashboardItem => ({
  ...item({ slug, renders: { 'v2-preview': render(['preview.mp4', 'eval.json'], { eval: { passed: false, errors: 2, warnings: 3 } }) } }),
  extra: extras,
});
const health = (extra: Partial<Health> = {}): Health => ({ ramFreeBytes: 5.5 * GB, ramTotalBytes: 15.8 * GB, vram: { usedMb: 1229, totalMb: 6144 }, diskFreeBytes: 239.4 * GB, ...extra });
const queue = { pending: ['aula-3', 'aula-4'], running: ['aula-2'], failed: ['aula-1'] };
const historyLines = (frame: string[]) => frame.filter((line) => /\d\d:\d\d (análise|render preview|autoavaliação|criando)/.test(line));

describe('painel com teclado, saúde, qualidade e histórico', () => {
  const PANEL_SIZES = [...SIZES, [80, 24], [100, 30], [110, 32], [140, 40]] as const;
  const STATES: Partial<DashboardOptions>[] = [
    { selected: 'aula' },
    { selected: 'aula', expanded: true },
    { selected: 'aula', expanded: true, toast: 'copiado: pnpm mce eval aula', flash: [{ slug: 'aula', key: 'preview' }] },
    { selected: 'aula', help: true },
    { selected: 'aula', expanded: true, help: true, health: health({ ramFreeBytes: 1.2 * GB, diskFreeBytes: 4.5 * GB }) },
    { selected: 'nao-existe', expanded: true, notice: 'leitura falhou: x' },
    { expanded: true },
  ];

  it.each(PANEL_SIZES)('nenhum estado novo passa de %i×%i', (columns, rows) => {
    for (const items of [[detailed()], [...many(), detailed()], [...Array.from({ length: 20 }, (_, index) => fresh(`video-${index}`)), detailed()]]) {
      for (const state of STATES) {
        for (const color of [false, true]) {
          const frame = renderDashboard({ items, now: NOW, columns, rows, color, tick: 3, intervalSec: 1, keys: true, health: health(), queue, ...state });
          expect(frame).toHaveLength(rows);
          expect(Math.max(...frame.map(visibleWidth))).toBeLessThanOrEqual(columns);
        }
      }
    }
  });

  it('tela minúscula com tudo ligado não quebra', () => {
    for (const [columns, rows] of [[1, 1], [8, 2], [20, 3], [30, 6], [40, 9]] as const) {
      for (const state of STATES) {
        const frame = renderDashboard({ items: [...many(), detailed()], now: NOW, columns, rows, intervalSec: 1, keys: true, health: health(), queue, ...state });
        expect(frame.length).toBeLessThanOrEqual(rows);
        expect(Math.max(...frame.map(visibleWidth))).toBeLessThanOrEqual(columns);
      }
    }
  });

  it('foco: todas as etapas com a duração, tempo total, qualidade, orçamento e histórico', () => {
    const frame = renderDashboard({ items: [detailed()], now: NOW, columns: 110, rows: 32, intervalSec: 1, keys: true, selected: 'aula', expanded: true });
    expect(frame).toHaveLength(32);
    expect(frame.find((line) => line.startsWith('╭'))).toContain('╭─ ▸ aula ');
    expect(frame.filter((line) => /^│ [✓▶!→·] \d /.test(line))).toHaveLength(9);
    expect(frame.find((line) => line.includes('✓ 1 Análise'))).toMatch(/proxy, transcrição e takes\.md\s+03:12 │$/);
    expect(frame.find((line) => line.includes('✓ 4 Preview'))).toMatch(/preview\.mp4\s+10:29 │$/);
    expect(frame.find((line) => line.includes('! 5 Autoavaliação'))).not.toMatch(/02:10 │$/);
    const text = frame.join('\n');
    expect(text).toMatch(/│ tempo {6}18:01 de máquina em 4 execuções · desde \d\d\/\d\d \d\d:\d\d/);
    expect(text).toContain('│ qualidade  reprovada · 2 erros, 3 avisos · v2-preview');
    expect(text).toContain('│            ! corte-em-palavra: corte no meio de "exemplo" em 01:23.40');
    expect(text).toContain('│            · abaixo-do-nivel: 8 cenas ilustrativas (nível max: 11–20)');
    expect(text).toContain('│ orçamento  faltam 3 cenas · sobram 2 zooms');
    expect(text).toMatch(/│ histórico {2}\d\d:\d\d /);
    expect(historyLines(frame).at(-1)).toMatch(/\d\d:\d\d autoavaliação concluída em 02:10/);
    expect(text).toContain('render preview falhou após 02:10: sem memória');
    expect(text).toContain('retomar  pnpm mce eval aula');
  });

  it('o histórico encolhe com a altura, das linhas mais antigas para as novas', () => {
    const at = (rows: number) => renderDashboard({ items: [detailed()], now: NOW, columns: 100, rows, intervalSec: 1, keys: true, selected: 'aula', expanded: true });
    const tall = historyLines(at(40));
    const short = historyLines(at(24));
    expect(tall).toHaveLength(9);
    expect(short.length).toBeGreaterThan(0);
    expect(short.length).toBeLessThan(tall.length);
    expect(short.at(-1)).toContain('autoavaliação concluída em 02:10');
    // o essencial fica mesmo apertado: uma linha de tempo, de qualidade e de orçamento
    const tight = at(24).join('\n');
    for (const label of ['│ tempo ', '│ qualidade ', '│ orçamento ']) expect(tight).toContain(label);
    // sem altura nem para as etapas, as seções extras somem antes delas
    const tiny = at(12);
    expect(tiny.some((line) => line.includes('! 5 Autoavaliação'))).toBe(true);
    expect(tiny.join('\n')).not.toContain('histórico');
  });

  it('foco com várias edições: a selecionada em cartão e as outras em uma linha', () => {
    const frame = renderDashboard({ items: [...many(), detailed()], now: NOW, columns: 100, rows: 30, intervalSec: 1, keys: true, selected: 'aula', expanded: true });
    const tops = frame.filter((line) => line.startsWith('╭'));
    expect(tops).toHaveLength(1);
    expect(tops[0]).toContain('▸ aula');
    for (const slug of ['novo-video', 'parado', 'rodando', 'dirigindo', 'outro']) expect(frame.filter((line) => line.startsWith(` ${slug}`))).toHaveLength(1);
    const crowded = renderDashboard({ items: [...Array.from({ length: 20 }, (_, index) => fresh(`video-${index}`)), detailed()], now: NOW, columns: 100, rows: 30, intervalSec: 1, keys: true, selected: 'aula', expanded: true });
    expect(crowded.filter((line) => line.startsWith('╭'))).toHaveLength(1);
    expect(crowded.some((line) => /^ \+\d+ edições$/.test(line))).toBe(true);
  });

  it('visão geral: a seleção vence quem roda e ganha o marcador, em cartão ou em linha', () => {
    const frame = renderDashboard({ items: many(), now: NOW, columns: 100, rows: 24, intervalSec: 1, keys: true, selected: 'parado' });
    const tops = frame.filter((line) => line.startsWith('╭'));
    expect(tops).toHaveLength(1);
    expect(tops[0]).toContain('▸ parado');
    const items = Array.from({ length: 20 }, (_, index) => fresh(`video-${index}`));
    const lines = renderDashboard({ items, now: NOW, columns: 80, rows: 10, intervalSec: 1, keys: true, selected: 'video-7' });
    expect(lines.filter((line) => line.startsWith('▸'))).toEqual([expect.stringMatching(/^▸video-7 /)]);
  });

  it('visão geral: sobrando altura, a edição em foco mostra as seções extras', () => {
    const frame = renderDashboard({ items: [detailed(), fresh('outro')], now: NOW, columns: 100, rows: 60, intervalSec: 1, keys: true, selected: 'aula' });
    expect(frame.filter((line) => line.startsWith('╭'))).toHaveLength(2);
    expect(historyLines(frame)).toHaveLength(9);
    const none = renderDashboard({ items: [item()], now: NOW, columns: 100, rows: 40, intervalSec: 1, keys: true, selected: 'aula' }).join('\n');
    expect(none).not.toContain('histórico');
    expect(none).not.toContain('qualidade');
  });

  it('impressão única: todo cartão ganha as seções, com mais histórico na edição pedida', () => {
    const all = renderDashboard({ items: [detailed('a'), detailed('b')], now: NOW, columns: 100 });
    expect(all.filter((line) => line.includes('│ qualidade '))).toHaveLength(2);
    expect(historyLines(all)).toHaveLength(8);
    const one = renderDashboard({ items: [detailed('a'), detailed('b')], now: NOW, columns: 100, focus: 'a' });
    expect(historyLines(one)).toHaveLength(9 + 4);
    expect(all.join('\n')).not.toContain('Ctrl+C');
    expect(Math.max(...all.map(visibleWidth))).toBeLessThanOrEqual(100);
  });

  it('orçamento no alvo e sem avaliação', () => {
    const ok = { ...item(), extra: { activity: [], eval: null, budgetGaps: [] } };
    const text = renderDashboard({ items: [ok], now: NOW, columns: 100 }).join('\n');
    expect(text).toContain('│ orçamento  no alvo do nível');
    expect(text).not.toContain('qualidade');
    expect(text).not.toContain('│ tempo');
    const started = { ...item(), extra: { activity: activity.slice(0, 1), eval: null, budgetGaps: null } };
    const onlyStarted = renderDashboard({ items: [started], now: NOW, columns: 100 }).join('\n');
    expect(onlyStarted).not.toContain('│ tempo');
    expect(onlyStarted).toMatch(/│ histórico {2}\d\d:\d\d análise iniciada/);
  });

  it('packItems junta itens inteiros e resume o resto em "+N"', () => {
    expect(packItems(['um', 'dois', 'três'], 40, 2)).toEqual(['um · dois · três']);
    expect(packItems(['faltam 3 cenas', 'sobram 2 zooms', 'falta trilha'], 20, 2)).toEqual(['faltam 3 cenas', 'sobram 2 zooms · +1']);
    expect(packItems(['faltam 3 cenas', 'sobram 2 zooms', 'falta trilha'], 20, 3)).toEqual(['faltam 3 cenas', 'sobram 2 zooms', 'falta trilha']);
    expect(packItems(['um item comprido demais'], 10, 2)).toEqual(['um item c…']);
    expect(packItems([], 10, 2)).toEqual([]);
    for (const line of packItems(Array.from({ length: 12 }, (_, index) => `faltam ${index} coisas`), 50, 2)) expect(visibleWidth(line)).toBeLessThanOrEqual(50);
  });

  it('cabeçalho: saúde da máquina por extenso, abreviada e só o alerta, conforme a largura', () => {
    const head = (columns: number, state: Health, color = false) => renderDashboard({ items: [running()], now: NOW, columns, rows: 24, intervalSec: 1, color, health: state })[0]!;
    expect(head(120, health())).toMatch(/^ MChiodi Editor {2}1 edição · 1 rodando\s+RAM livre 5,5\/15,8 GB · VRAM 1,2\/6,0 GB · disco 239 GB livres {2}\d\d:\d\d:\d\d $/);
    expect(head(100, health())).toMatch(/1 rodando\s+RAM 5,5G · VRAM 1,2\/6,0 · disco 239G {2}\d\d:\d\d:\d\d $/);
    expect(head(80, health())).toMatch(/^ MChiodi Editor\s+RAM 5,5G · VRAM 1,2\/6,0 · disco 239G {2}\d\d:\d\d:\d\d $/);
    expect(head(40, health())).toMatch(/^ MChiodi Editor\s+\d\d:\d\d:\d\d $/);
    expect(head(120, health({ vram: null, diskFreeBytes: null }))).toMatch(/RAM livre 5,5\/15,8 GB {2}\d\d/);
    const low = health({ ramFreeBytes: 1.2 * GB, diskFreeBytes: 4.5 * GB });
    expect(head(50, low)).toMatch(/^ MChiodi Editor\s+RAM 1,2G · disco 4,5G {2}\d\d:\d\d:\d\d $/);
    const colored = head(120, low, true);
    expect(colored).toContain(`${RED}RAM livre 1,2/15,8 GB${RESET}`);
    expect(colored).toContain(`${RED}disco 4,5 GB livres${RESET}`);
    expect(colored).toContain(`${ESC}90mVRAM 1,2/6,0 GB${RESET}`);
    expect(head(120, health(), true)).not.toContain(RED);
  });

  it('fila do modo autônomo: uma linha acima do rodapé, só quando há o que mostrar', () => {
    const frame = renderDashboard({ items: [running()], now: NOW, columns: 100, rows: 24, intervalSec: 1, queue });
    expect(frame.at(-2)).toBe(' fila  2 pendentes · 1 rodando · 1 falha  próximos: aula-3, aula-4');
    const single = renderDashboard({ items: [running()], now: NOW, columns: 100, rows: 24, intervalSec: 1, queue: { pending: ['x'], running: [], failed: [] } });
    expect(single.at(-2)).toBe(' fila  1 pendente · 0 rodando · 0 falhas  próximos: x');
    const empty = renderDashboard({ items: [running()], now: NOW, columns: 100, rows: 24, intervalSec: 1, queue: { pending: [], running: [], failed: [] } });
    expect(empty.join('\n')).not.toContain('fila');
    expect(renderDashboard({ items: [running()], now: NOW, columns: 100, rows: 8, intervalSec: 1, queue }).join('\n')).not.toContain('fila');
    expect(renderDashboard({ items: [running()], now: NOW, columns: 100, queue }).at(-1)).toContain('fila  2 pendentes');
    expect(renderDashboard({ items: [running()], now: NOW, columns: 100, rows: 24, intervalSec: 1, queue, color: true }).at(-2)).toContain(`${RED}1 falha${RESET}`);
  });

  it('rodapé: as teclas principais na largura que der, e o aviso de uma ação no lugar delas', () => {
    const foot = (columns: number, extra: Partial<DashboardOptions> = {}) => renderDashboard({ items: [running()], now: NOW, columns, rows: 24, intervalSec: 1, keys: true, ...extra }).at(-1)!;
    expect(foot(120)).toContain(' ↑↓ edição · Enter foco · o pasta · p vídeo · r relatório · g cenas · c copiar · ? ajuda · q sai');
    expect(foot(120, { expanded: true, selected: 'rodando' })).toContain('Enter visão geral');
    expect(foot(80)).toBe(' ↑↓ · Enter foco · o p r e g c abrir/copiar · ? ajuda · q sai');
    expect(foot(30)).toBe(' ↑↓ Enter · ? ajuda · q sai');
    expect(foot(20)).toBe(' ? ajuda · q sai');
    expect(foot(120)).not.toContain('Ctrl+C');
    expect(foot(120, { toast: 'copiado: pnpm mce eval aula' })).toMatch(/^ copiado: pnpm mce eval aula\s/);
    expect(foot(120, { toast: 'abrindo output/aula', notice: 'leitura falhou: x' })).not.toContain('leitura falhou');
    expect(foot(120, { notice: 'leitura falhou: x' })).toContain('leitura falhou: x');
    expect(foot(120, { help: true })).toContain('? ou Esc fecha a ajuda');
  });

  it('ajuda: todas as teclas em um cartão; sem altura, as linhas que couberem', () => {
    const frame = renderDashboard({ items: many(), now: NOW, columns: 100, rows: 30, intervalSec: 1, keys: true, help: true });
    expect(frame.find((line) => line.startsWith('╭'))).toContain('╭─ teclas ');
    const text = frame.join('\n');
    for (const what of ['seleciona a edição', 'abre a pasta output/<slug>', 'abre o vídeo mais recente', 'abre o relatorio.md', 'abre a pasta do projeto', 'abre o visor de cenas', 'copia o próximo comando', 'sai']) {
      expect(text).toContain(what);
    }
    expect(text).not.toContain('novo-video');
    const small = renderDashboard({ items: many(), now: NOW, columns: 60, rows: 8, intervalSec: 1, keys: true, help: true });
    expect(small).toHaveLength(8);
    expect(small.join('\n')).not.toContain('╭');
    expect(small[1]).toContain('seleciona a edição');
  });

  it('etapa que acabou de terminar fica destacada', () => {
    const flash = [{ slug: 'aula', key: 'preview' as const }];
    const plain = renderDashboard({ items: [detailed()], now: NOW, columns: 100, rows: 30, intervalSec: 1, flash });
    expect(plain.find((line) => line.includes('✓ 4 Preview'))).toContain('acabou agora · preview.mp4');
    expect(plain.find((line) => line.includes('✓ 1 Análise'))).not.toContain('acabou agora');
    const colored = renderDashboard({ items: [detailed()], now: NOW, columns: 100, rows: 30, intervalSec: 1, flash, color: true }).join('\n');
    expect(colored).toContain(`${ESC}7mPreview`);
    expect(renderDashboard({ items: [detailed()], now: NOW, columns: 100, rows: 30, intervalSec: 1, color: true }).join('\n')).not.toContain(`${ESC}7m`);
  });

  it('finishedSteps: etapa de máquina que rodava e terminou, bem ou mal', () => {
    const before = [running('aula'), item({ slug: 'dirigida', live: directing })];
    const done = item({ slug: 'aula', renders: { 'v2-preview': render(['preview.mp4']) } });
    const stuck = item({ slug: 'aula', renders: { 'v2-preview': render(['cut.mkv'], { touchedAt: 0 }) } });
    expect(finishedSteps(before, [done])).toEqual([{ slug: 'aula', key: 'preview' }]);
    expect(finishedSteps(before, [stuck])).toEqual([{ slug: 'aula', key: 'preview' }]);
    expect(finishedSteps(before, before)).toEqual([]);
    expect(finishedSteps([done], [done])).toEqual([]);
    expect(finishedSteps([], [done])).toEqual([]);
    // a direção não é etapa de máquina: o diretor limpar o aviso não toca o sino
    expect(finishedSteps(before, [running('aula'), item({ slug: 'dirigida' })])).toEqual([]);
  });

  it('pickFocus: o pedido, senão quem roda, senão o primeiro', () => {
    expect(pickFocus(many())).toBe('rodando');
    expect(pickFocus(many(), 'parado')).toBe('parado');
    expect(pickFocus([fresh('a'), fresh('b')])).toBe('a');
    expect(pickFocus([])).toBeNull();
  });
});

describe('coleta', () => {
  it('parseNvidiaSmi lê a primeira GPU e ignora o que não é número', () => {
    expect(parseNvidiaSmi('1229, 6144\r\n')).toEqual({ usedMb: 1229, totalMb: 6144 });
    expect(parseNvidiaSmi('512, 8192\n300, 4096\n')).toEqual({ usedMb: 512, totalMb: 8192 });
    expect(parseNvidiaSmi('[N/A], [N/A]\n')).toBeNull();
    expect(parseNvidiaSmi('NVIDIA-SMI has failed because it could not communicate with the driver')).toBeNull();
    expect(parseNvidiaSmi('0, 0')).toBeNull();
    expect(parseNvidiaSmi('')).toBeNull();
  });

  it('healthParts: alerta com RAM livre < 2 GB e disco < 10 GB', () => {
    expect(healthParts(health()).map((part) => [part.text, part.alert])).toEqual([
      ['RAM livre 5,5/15,8 GB', false],
      ['VRAM 1,2/6,0 GB', false],
      ['disco 239 GB livres', false],
    ]);
    expect(healthParts(health({ ramFreeBytes: 1.99 * GB }))[0]).toMatchObject({ alert: true, short: 'RAM 2,0G' });
    expect(healthParts(health({ ramFreeBytes: 2 * GB }))[0]!.alert).toBe(false);
    expect(healthParts(health({ diskFreeBytes: 9.9 * GB })).at(-1)).toMatchObject({ alert: true, text: 'disco 9,9 GB livres' });
    expect(healthParts(health({ diskFreeBytes: 10 * GB })).at(-1)!.alert).toBe(false);
    expect(healthParts(health({ vram: null, diskFreeBytes: null }))).toHaveLength(1);
  });

  it('queryVram: sem nvidia-smi, com erro ou travado, devolve null sem lançar', async () => {
    const calls: string[][] = [];
    const ok = await queryVram(async (command, args) => {
      calls.push([command, ...args]);
      return { stdout: '1229, 6144\n' };
    });
    expect(ok).toEqual({ usedMb: 1229, totalMb: 6144 });
    expect(calls).toEqual([['nvidia-smi', '--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits']]);
    expect(await queryVram(async () => Promise.reject(new Error('ENOENT')))).toBeNull();
    const hung = (_command: string, _args: string[], options: { signal: AbortSignal }) =>
      new Promise<{ stdout: string }>((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('abortado'))));
    expect(await queryVram(hung, 10)).toBeNull();
  });

  it('createVramSampler consulta no máximo a cada 5 s e uma por vez', async () => {
    let now = 0;
    let asked = 0;
    const sampler = createVramSampler({
      clock: () => now,
      query: async () => {
        asked += 1;
        return asked >= 3 ? null : { usedMb: asked * 100, totalMb: 6144 };
      },
    });
    expect(sampler.current()).toBeNull();
    expect(sampler.current()).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked).toBe(1);
    expect(sampler.current()).toEqual({ usedMb: 100, totalMb: 6144 });
    now = 4999;
    sampler.current();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked).toBe(1);
    now = 5000;
    expect(sampler.current()).toEqual({ usedMb: 100, totalMb: 6144 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked).toBe(2);
    expect(sampler.current()).toEqual({ usedMb: 200, totalMb: 6144 });
    now = 10_000;
    sampler.current();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // uma leitura que falha não apaga o número; falhando por mais de 30 s, ele some, sem erro
    expect(asked).toBe(3);
    expect(sampler.current()).toEqual({ usedMb: 200, totalMb: 6144 });
    now = 36_000;
    expect(sampler.current()).toBeNull();
  });

  it('summarizeEval conta e põe os erros na frente', () => {
    const finding = (severity: 'error' | 'warning', check: string) => ({ severity, check, at: null, message: `mensagem de ${check}`, fix: '' });
    const summary = summarizeEval({ passed: false, findings: [finding('warning', 'a'), finding('error', 'b'), finding('warning', 'c'), finding('warning', 'd'), finding('error', 'e')] }, 'v3-preview');
    expect(summary).toEqual({
      render: 'v3-preview',
      passed: false,
      errors: 2,
      warnings: 3,
      top: [
        { severity: 'error', text: 'b: mensagem de b' },
        { severity: 'error', text: 'e: mensagem de e' },
        { severity: 'warning', text: 'a: mensagem de a' },
      ],
    });
    expect(summarizeEval({ passed: true, findings: [] }, 'v1-final')).toEqual({ render: 'v1-final', passed: true, errors: 0, warnings: 0, top: [] });
  });

  it('budgetGaps: só o que está fora do alvo, com os padrões obrigatórios e a trilha', () => {
    const row = (key: 'zooms' | 'graphics' | 'scenes', label: string, count: number, min: number, max: number) => ({ key, label, count, min, max });
    const rows = [row('zooms', 'zooms', 12, 4, 10), row('graphics', 'gráficos', 8, 6, 12), row('scenes', 'cenas ilustrativas', 2, 5, 9)];
    expect(budgetGaps(rows)).toEqual(['sobram 2 zooms', 'faltam 3 cenas']);
    const required = [
      { id: 'pill', label: 'pílulas de resumo', count: 1, min: 3, how: '' },
      { id: 'stage', label: 'palco', count: 2, min: 2, how: '' },
    ];
    expect(budgetGaps(rows, required, true)).toEqual(['sobram 2 zooms', 'faltam 3 cenas', 'falta trilha', 'faltam 2 pílulas de resumo']);
    expect(budgetGaps([row('zooms', 'zooms', 5, 4, 10)])).toEqual([]);
  });

  it('queueSummary separa a fila por estado; pickVideo prefere o final', () => {
    const job = (slug: string, status: 'pending' | 'running' | 'done' | 'failed') => ({ id: slug, file: `${slug}.mp4`, slug, status, addedAt: '', startedAt: null, finishedAt: null, attempts: 0, error: null });
    expect(queueSummary([job('a', 'done'), job('b', 'running'), job('c', 'pending'), job('d', 'failed'), job('e', 'pending')])).toEqual({ pending: ['c', 'e'], running: ['b'], failed: ['d'] });
    expect(queueSummary([])).toEqual({ pending: [], running: [], failed: [] });
    const previews = [
      { file: 'v1-preview/preview.mp4', mtimeMs: 10 },
      { file: 'v3-preview/preview.mp4', mtimeMs: 30 },
      { file: 'v2-preview/preview.mp4', mtimeMs: 20 },
    ];
    expect(pickVideo('output/final.mp4', previews)).toBe('output/final.mp4');
    expect(pickVideo(null, previews)).toBe('v3-preview/preview.mp4');
    expect(pickVideo(null, [])).toBeNull();
  });
});

describe('watch com teclado', () => {
  class FakeOut extends EventEmitter {
    isTTY = true;
    columns = 100;
    rows = 30;
    written: string[] = [];
    write(text: string) {
      this.written.push(text);
      return true;
    }
    /** último quadro pintado, sem os códigos de posição */
    get screen() {
      return stripAnsi(this.written.findLast((text) => text.includes(`${ESC}1;1H`)) ?? '');
    }
  }
  class FakeIn extends EventEmitter {
    isTTY = true;
    raw: boolean[] = [];
    flowing = false;
    setRawMode(mode: boolean) {
      this.raw.push(mode);
      return this;
    }
    resume() {
      this.flowing = true;
      return this;
    }
    pause() {
      this.flowing = false;
      return this;
    }
  }
  const wait = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));

  it('seleciona, foca, mostra a ajuda, executa a ação com aviso que some, e sai no q devolvendo o terminal', async () => {
    const out = new FakeOut();
    const input = new FakeIn();
    let now = NOW;
    const performed: [string, string | undefined][] = [];
    const done = runDashboard({
      load: () => [running('a-roda'), detailed('parada')],
      ambient: () => ({ health: health(), queue }),
      intervalSec: 60,
      color: false,
      out,
      input,
      clock: () => now,
      frameMs: 5,
      perform: (action, target) => {
        performed.push([action.type, target?.snapshot.slug]);
        return `abrindo output/${'slug' in action ? action.slug : ''}`;
      },
    });
    await wait();
    expect(input.raw).toEqual([true]);
    expect(input.flowing).toBe(true);
    expect(out.screen).toContain('▸ a-roda');
    expect(out.screen).toContain('RAM 5,5G');
    expect(out.screen).toContain('fila  2 pendentes');
    expect(out.screen).toContain('Enter foco');

    input.emit('data', '\u001b[B');
    await wait();
    expect(out.screen).toContain('▸ parada');
    expect(out.screen).not.toContain('▸ a-roda');

    input.emit('data', Buffer.from('\r'));
    await wait();
    expect(out.screen).toContain('Enter visão geral');
    expect(out.screen).toContain('histórico');
    expect(out.screen.split('╭')).toHaveLength(2);

    input.emit('data', 'o');
    await wait();
    expect(performed).toEqual([['open-output', 'parada']]);
    expect(out.screen).toContain('abrindo output/parada');
    now += 3100;
    await wait();
    expect(out.screen).not.toContain('abrindo output/parada');

    input.emit('data', 'g');
    await wait();
    expect(performed.at(-1)).toEqual(['open-scenes', undefined]);

    input.emit('data', '?');
    await wait();
    expect(out.screen).toContain('╭─ teclas ');
    input.emit('data', '?');
    await wait();
    expect(out.screen).not.toContain('╭─ teclas ');

    input.emit('data', 'q');
    await done;
    expect(input.raw).toEqual([true, false]);
    expect(input.flowing).toBe(false);
    expect(input.listenerCount('data')).toBe(0);
    expect(out.listenerCount('resize')).toBe(0);
    expect(out.written.at(-1)).toBe(LEAVE_SCREEN);
    expect(out.written.join('')).not.toContain('\n');
    for (const text of out.written.filter((chunk) => chunk.includes(`${ESC}1;1H`))) expect(text).not.toContain(`${ESC}31;1H`);
  });

  it('Ctrl+C em raw mode também sai; ação que falha vira aviso', async () => {
    const out = new FakeOut();
    const input = new FakeIn();
    const done = runDashboard({
      load: () => [running('aula')],
      intervalSec: 60,
      color: false,
      out,
      input,
      frameMs: 5,
      perform: () => Promise.reject(new Error('explorer sumiu')),
    });
    await wait();
    input.emit('data', 'c');
    await wait();
    expect(out.screen).toContain('não deu: explorer sumiu');
    input.emit('data', '\u0003');
    await done;
    expect(input.raw).toEqual([true, false]);
  });

  it('com um projeto pedido, abre no foco; stdin que não é terminal não liga o teclado', async () => {
    const out = new FakeOut();
    const input = new FakeIn();
    let stop = () => {};
    const focused = runDashboard({ load: () => [detailed('aula')], intervalSec: 60, color: false, out, input, focus: 'aula', frameMs: 5, stop: new Promise<void>((resolve) => (stop = resolve)) });
    await wait();
    expect(out.screen).toContain('Enter visão geral');
    expect(out.screen).toContain('histórico');
    stop();
    await focused;
    expect(input.raw).toEqual([true, false]);

    const piped = new FakeIn();
    piped.isTTY = false;
    const plain = new FakeOut();
    const second = runDashboard({ load: () => [detailed('aula')], intervalSec: 60, color: false, out: plain, input: piped, frameMs: 5, stop: new Promise<void>((resolve) => (stop = resolve)) });
    await wait();
    expect(plain.screen).toContain('Ctrl+C sai');
    expect(plain.screen).not.toContain('▸');
    piped.emit('data', 'q');
    stop();
    await second;
    expect(piped.raw).toEqual([]);
    expect(piped.listenerCount('data')).toBe(0);
  });

  const finishing = (bell: boolean | undefined) => {
    const out = new FakeOut();
    let now = NOW;
    let loads = 0;
    let stop = () => {};
    const done = runDashboard({
      load: () => {
        loads += 1;
        return loads < 3 ? [running('aula')] : [item({ slug: 'aula', renders: { 'v2-preview': render(['preview.mp4']) } })];
      },
      intervalSec: 0.01,
      color: false,
      out,
      bell,
      clock: () => (now += 5),
      frameMs: 5,
      stop: new Promise<void>((resolve) => (stop = resolve)),
    });
    return { out, done, stop: () => stop(), advance: (ms: number) => (now += ms) };
  };

  it('etapa que termina com o painel aberto toca o sino uma vez e fica destacada por alguns segundos', async () => {
    const panel = finishing(undefined);
    await wait(80);
    expect(panel.out.written.filter((text) => text === BELL)).toHaveLength(1);
    expect(panel.out.screen).toContain('acabou agora · preview.mp4');
    panel.advance(9000);
    await wait(30);
    expect(panel.out.screen).not.toContain('acabou agora');
    expect(panel.out.screen).toContain('✓ 4 Preview');
    panel.stop();
    await panel.done;
  });

  it('--no-bell: destaca sem tocar', async () => {
    const panel = finishing(false);
    await wait(80);
    expect(panel.out.written.join('')).not.toContain(BELL);
    expect(panel.out.screen).toContain('acabou agora');
    panel.stop();
    await panel.done;
  });

  it('saída redirecionada não recebe sino nem liga o teclado', async () => {
    const out = new FakeOut();
    out.isTTY = false;
    const input = new FakeIn();
    let loads = 0;
    let stop = () => {};
    const done = runDashboard({
      load: () => ((loads += 1) < 2 ? [running('aula')] : [item({ slug: 'aula', renders: { 'v2-preview': render(['preview.mp4']) } })]),
      intervalSec: 0.01,
      out,
      input,
      stop: new Promise<void>((resolve) => (stop = resolve)),
    });
    await wait(50);
    stop();
    await done;
    expect(out.written.join('')).not.toContain(BELL);
    expect(out.written.join('')).not.toContain('\u001b');
    expect(input.raw).toEqual([]);
  });
});
