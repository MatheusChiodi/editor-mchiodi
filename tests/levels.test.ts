import { describe, expect, it } from 'vitest';

import { configSchema } from '../src/config.ts';
import {
  BUDGET_KEYS,
  DEFAULT_LEVEL,
  formatLevels,
  isLevel,
  LEVEL_IDS,
  LEVELS,
  levelProfile,
  matchLevel,
  parseLevel,
} from '../src/edl/levels.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { diffEdl } from '../src/edl/store.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { buildBudget, countItems, formatBudget, judgeBudget } from '../src/eval/budget.ts';
import { lintStyle } from '../src/eval/checks.ts';
import { effects } from '../src/arsenal/effects.ts';
import { transitions } from '../src/arsenal/transitions.ts';
import { buildReport } from '../src/report/index.ts';
import { headlessPrompt } from '../src/watcher/headless.ts';
import { enqueue, inboxLevel } from '../src/watcher/queue.ts';

function edlWith(extra: Record<string, unknown>) {
  return edlSchema.parse({
    version: 3,
    project: 'teste',
    createdAt: '2026-10-12T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 400, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [
      { id: 'c1', start: 0, end: 100 },
      { id: 'c2', start: 110, end: 400 },
    ],
    ...extra,
  });
}

const checksOf = (extra: Record<string, unknown>) => {
  const edl = edlWith(extra);
  return lintStyle(edl, buildTimeline(edl.clips, 30)).map((finding) => finding.check);
};

/** n itens a intervalos iguais no vídeo FINAL (o trecho 100–110s da fonte é cortado), em tempo da fonte. */
const spread = (count: number, make: (index: number, at: number) => Record<string, unknown>) =>
  Array.from({ length: count }, (_, index) => {
    const out = 2 + (index * 380) / count;
    return make(index, out < 100 ? out : out + 10);
  });

describe('níveis de edição', () => {
  it('cada nível é mais cheio que o anterior, em alvo e em limite', () => {
    for (let index = 1; index < LEVEL_IDS.length; index += 1) {
      const lower = LEVELS[LEVEL_IDS[index - 1]!];
      const higher = LEVELS[LEVEL_IDS[index]!];
      for (const key of BUDGET_KEYS) {
        expect(higher.perMinute[key].max).toBeGreaterThan(lower.perMinute[key].max);
        expect(higher.perMinute[key].min).toBeGreaterThanOrEqual(lower.perMinute[key].min);
        expect(higher.perMinute[key].min).toBeLessThanOrEqual(higher.perMinute[key].max);
      }
      for (const gap of ['zoomMinGapSec', 'transitionMinGapSec', 'memeMinGapSec', 'graphicMinGapSec', 'sceneMinGapSec'] as const) {
        expect(higher.limits[gap]).toBeLessThan(lower.limits[gap]);
      }
      expect(higher.limits.transitionKindsMax).toBeGreaterThan(lower.limits.transitionKindsMax);
    }
  });

  it('o alvo cabe nos limites: dá para atingir o máximo respeitando a distância mínima', () => {
    for (const profile of Object.values(LEVELS)) {
      expect(profile.perMinute.zooms.max).toBeLessThanOrEqual(60 / profile.limits.zoomMinGapSec);
      expect(profile.perMinute.graphics.max).toBeLessThanOrEqual(60 / profile.limits.graphicMinGapSec);
      expect(profile.perMinute.scenes.max).toBeLessThanOrEqual(60 / profile.limits.sceneMinGapSec);
      expect(profile.perMinute.transitions.max).toBeLessThanOrEqual(60 / profile.limits.transitionMinGapSec);
      expect(profile.guidance.length).toBeGreaterThan(0);
    }
  });

  it('normal não exige nada: é o comportamento de antes dos níveis', () => {
    expect(DEFAULT_LEVEL).toBe('normal');
    expect(levelProfile()).toBe(LEVELS.normal);
    for (const key of BUDGET_KEYS) expect(LEVELS.normal.perMinute[key].min).toBe(0);
    expect(LEVELS.normal.music).toBe(false);
  });

  it('reconhece ids e apelidos, com ou sem acento e caixa', () => {
    expect(matchLevel('pro')).toBe('pro');
    expect(matchLevel(' Profissional ')).toBe('pro');
    expect(matchLevel('MÁXIMA')).toBe('max');
    expect(matchLevel('clean')).toBe('limpa');
    expect(matchLevel('rascunhos')).toBeNull();
    expect(isLevel('max')).toBe(true);
    expect(isLevel('profissional')).toBe(false);
    expect(parseLevel('normal')).toBe('normal');
    expect(() => parseLevel('épico')).toThrow(/limpa, normal, pro, max/);
  });

  it('formatLevels lista todos ou detalha um', () => {
    const list = formatLevels().split('\n');
    expect(list).toHaveLength(LEVEL_IDS.length);
    expect(list[2]).toContain('Profissional');
    const card = formatLevels('pro');
    expect(card).toMatch(/gráficos\s+3–6\/min/);
    expect(card).toMatch(/trilha\s+do começo ao fim/);
    expect(card).toContain('até 6 tipos diferentes');
    expect(card).toContain(`- ${LEVELS.pro.guidance[0]}`);
    expect(formatLevels('limpa')).toMatch(/cenas ilustrativas\s+nenhum/);
  });
});

describe('nível na EDL e no config', () => {
  it('EDL sem nível é normal; nível inválido é recusado', () => {
    expect(edlWith({}).level).toBe('normal');
    expect(edlWith({ level: 'max' }).level).toBe('max');
    expect(() => edlWith({ level: 'profissional' })).toThrow();
  });

  it('config traz o nível padrão', () => {
    expect(configSchema.parse({}).edit.level).toBe('normal');
    expect(configSchema.parse({ edit: { level: 'pro' } }).edit.level).toBe('pro');
    expect(() => configSchema.parse({ edit: { level: 'x' } })).toThrow();
  });

  it('diff e relatório mostram o nível', () => {
    const a = edlWith({});
    const b = edlWith({ level: 'pro' });
    expect(diffEdl(a, b)).toContain('nível: normal → pro');
    expect(diffEdl(a, a).join('\n')).not.toContain('nível');
    const report = buildReport({ edl: b, timeline: buildTimeline(b.clips, 30), history: [], evaluations: [], renderedFile: null });
    expect(report).toContain('nível de edição pro (Profissional)');
  });
});

describe('orçamento', () => {
  const camera = Object.values(effects).find((preset) => preset.category === 'camera')!;
  const look = Object.values(effects).find((preset) => preset.category !== 'camera')!;
  const edl = edlWith({
    zooms: [{ id: 'z1', at: 10, duration: 2, reason: 'ênfase' }],
    effects: [
      { id: 'e1', preset: camera.id, at: 40, reason: 'virada' },
      { id: 'e2', preset: look.id, at: 0, reason: 'look' },
    ],
    overlays: [
      { id: 'o1', component: 'LowerThird', at: 20, duration: 4, reason: 'nome' },
      { id: 's1', component: 'scene:teste/Fluxo', at: 60, duration: 6, reason: 'fluxo' },
    ],
    sfx: [{ id: 'x1', file: 'whoosh.wav', at: 20 }],
  });

  it('conta efeito de câmera como zoom e cena à parte dos gráficos', () => {
    expect(countItems(edl)).toEqual({ zooms: 2, graphics: 1, scenes: 1, transitions: 0, effects: 1, sfx: 1 });
  });

  it('alvo = taxa do nível × duração, arredondando a favor do diretor', () => {
    const rows = buildBudget(edl, 390, LEVELS.pro);
    expect(rows.map((row) => row.key)).toEqual([...BUDGET_KEYS]);
    // 6,5 min: zooms 2–6/min → 13–39; cenas 0,75–2/min → 4–13
    expect(rows.find((row) => row.key === 'zooms')).toMatchObject({ count: 2, min: 13, max: 39 });
    expect(rows.find((row) => row.key === 'scenes')).toMatchObject({ count: 1, min: 4, max: 13 });
    expect(buildBudget(edl, 390, LEVELS.limpa).find((row) => row.key === 'scenes')).toMatchObject({ min: 0, max: 0 });
  });

  it('judgeBudget acusa o que falta e o que sobra', () => {
    const below = judgeBudget(buildBudget(edl, 390, LEVELS.pro), LEVELS.pro, false);
    expect(below.every((finding) => finding.check === 'abaixo-do-nivel' && finding.severity === 'warning')).toBe(true);
    expect(below).toHaveLength(BUDGET_KEYS.length + 1);
    expect(below[0]!.message).toBe('2 zooms (nível pro: 13–39)');
    expect(below[0]!.fix).toContain('adicione 11');
    expect(below.at(-1)!.message).toContain('sem trilha');

    const above = judgeBudget(buildBudget(edl, 390, LEVELS.limpa), LEVELS.limpa, false);
    expect(above.map((finding) => [finding.check, finding.message])).toEqual([['acima-do-nivel', '1 cenas ilustrativas (nível limpa: 0–0)']]);
    expect(judgeBudget(buildBudget(edl, 390, LEVELS.normal), LEVELS.normal, false)).toEqual([]);
  });

  it('formatBudget mostra agora × alvo e o veredito por linha', () => {
    const text = formatBudget(LEVELS.pro, 390, buildBudget(edl, 390, LEVELS.pro), false);
    const lines = text.split('\n');
    expect(lines[0]).toBe('nível pro (Profissional) · 06:30 de vídeo');
    expect(lines.find((line) => line.startsWith('zooms'))).toMatch(/2\s+13–39\s+faltam 11$/);
    expect(lines.at(-1)).toMatch(/^trilha\s+não\s+sim\s+falta$/);
    const clean = formatBudget(LEVELS.limpa, 390, buildBudget(edl, 390, LEVELS.limpa), true);
    expect(clean).toMatch(/cenas ilustrativas\s+1\s+0–0\s+sobram 1/);
    expect(clean).toMatch(/gráficos\s+1\s+0–4\s+ok/);
    expect(clean.split('\n').at(-1)).toMatch(/sim\s+opcional\s+ok$/);
  });
});

describe('lintStyle por nível', () => {
  const zooms = (count: number) => spread(count, (index, at) => ({ id: `z${index}`, at, duration: 1.5, reason: 'ênfase' }));

  it('a mesma EDL passa no pro e é excesso no normal e no limpa', () => {
    // 30 zooms em 6,5 min ≈ 13s entre eles
    const extra = { zooms: zooms(30) };
    expect(checksOf({ ...extra, level: 'normal' })).toEqual(expect.arrayContaining(['zoom-frequente', 'acima-do-nivel']));
    expect(checksOf({ ...extra, level: 'limpa' })).toEqual(expect.arrayContaining(['zoom-frequente', 'acima-do-nivel']));
    const pro = checksOf({ ...extra, level: 'pro' });
    expect(pro).not.toContain('zoom-frequente');
    expect(pro).not.toContain('acima-do-nivel');
  });

  it('EDL vazia passa no normal e no limpa, e fica devendo no pro e no max', () => {
    expect(checksOf({})).toEqual([]);
    expect(checksOf({ level: 'limpa' })).toEqual([]);
    const pro = checksOf({ level: 'pro' });
    expect(pro).toHaveLength(BUDGET_KEYS.length + 1);
    expect(new Set(pro)).toEqual(new Set(['abaixo-do-nivel']));
    // o max cobra também a linguagem obrigatória e a tela parada
    const max = checksOf({ level: 'max' });
    expect(max.filter((check) => check === 'abaixo-do-nivel')).toHaveLength(BUDGET_KEYS.length + 1);
    expect(max.filter((check) => check === 'padrao-obrigatorio')).toHaveLength(LEVELS.max.required.length);
    expect(max.filter((check) => check === 'tela-parada')).toHaveLength(1);
    expect(max.filter((check) => check === 'pouco-editado')).toHaveLength(1);
    expect(new Set(max)).toEqual(new Set(['abaixo-do-nivel', 'padrao-obrigatorio', 'tela-parada', 'pouco-editado']));
  });

  it('distância entre gráficos e entre cenas segue o nível', () => {
    const overlays = [
      { id: 'g1', component: 'Callout', at: 20, duration: 2, reason: 'apoio' },
      { id: 'g2', component: 'Counter', at: 28, duration: 2, reason: 'número' },
      { id: 's1', component: 'scene:teste/A', at: 150, duration: 6, reason: 'fluxo' },
      { id: 's2', component: 'scene:teste/B', at: 190, duration: 6, reason: 'analogia' },
    ];
    const normal = checksOf({ overlays });
    expect(normal).toEqual(expect.arrayContaining(['grafico-frequente', 'cena-frequente']));
    const pro = checksOf({ overlays, level: 'pro' });
    expect(pro).not.toContain('grafico-frequente');
    expect(pro).not.toContain('cena-frequente');
    const edl = edlWith({ overlays });
    const finding = lintStyle(edl, buildTimeline(edl.clips, 30)).find((item) => item.check === 'cena-frequente')!;
    expect(finding.message).toContain('"s2" entra 40.0s depois de "s1" (mínimo 60s no nível normal)');
  });

  it('cena e gráfico não disputam a mesma distância mínima', () => {
    const overlays = [
      { id: 'g1', component: 'Callout', at: 20, duration: 2, reason: 'apoio' },
      { id: 's1', component: 'scene:teste/A', at: 24, duration: 6, reason: 'fluxo' },
    ];
    const checks = checksOf({ overlays });
    expect(checks).not.toContain('grafico-frequente');
    expect(checks).not.toContain('cena-frequente');
  });

  it('variedade e energia das transições têm teto por nível', () => {
    const clips = Array.from({ length: 6 }, (_, index) => ({ id: `k${index}`, start: index * 60, end: index * 60 + 50 }));
    const high = Object.values(transitions).filter((preset) => preset.energy === 'high').slice(0, 5);
    expect(high).toHaveLength(5);
    const list = high.map((preset, index) => ({ id: `t${index}`, intoClip: `k${index + 1}`, type: preset.id, reason: 'bloco' }));
    const normal = checksOf({ clips, transitions: list });
    expect(normal).toEqual(expect.arrayContaining(['transicao-variada', 'transicao-intensa']));
    const pro = checksOf({ clips, transitions: list, level: 'pro' });
    expect(pro).not.toContain('transicao-variada');
    expect(pro).not.toContain('transicao-intensa');
    expect(checksOf({ clips, transitions: list.slice(0, 1), level: 'limpa' })).toContain('transicao-intensa');
  });

  it('pro completo não deve nada', () => {
    const scenes = spread(6, (index, at) => ({ id: `s${index}`, component: `scene:teste/C${index}`, at: at + 4, duration: 3, reason: 'conceito' }));
    const look = Object.values(effects).find((preset) => preset.category !== 'camera')!;
    const clips = Array.from({ length: 8 }, (_, index) => ({ id: `k${index}`, start: index * 50, end: index * 50 + 50 }));
    const edl = edlWith({
      level: 'pro',
      clips,
      zooms: spread(16, (index, at) => ({ id: `z${index}`, at, duration: 1.5, reason: 'ênfase' })),
      overlays: [...spread(22, (index, at) => ({ id: `g${index}`, component: 'Callout', at: at + 8, duration: 1.5, reason: 'apoio' })), ...scenes],
      transitions: [1, 3, 5, 7].map((index) => ({ id: `t${index}`, intoClip: `k${index}`, type: 'wipe', reason: 'capítulo' })),
      effects: spread(4, (index, at) => ({ id: `e${index}`, preset: look.id, at: at + 2, duration: 2, reason: 'virada' })),
      sfx: spread(14, (index, at) => ({ id: `x${index}`, file: 'pop.wav', at })),
      music: { file: 'trilha.mp3' },
    });
    const budget = lintStyle(edl, buildTimeline(edl.clips, 30)).filter((finding) => /-do-nivel$/.test(finding.check));
    expect(budget).toEqual([]);
  });

  it('aceita um perfil explícito, sobrepondo o nível da EDL', () => {
    const edl = edlWith({ zooms: zooms(30) });
    const checks = lintStyle(edl, buildTimeline(edl.clips, 30), LEVELS.max).map((finding) => finding.check);
    expect(checks).not.toContain('zoom-frequente');
    expect(checks).toContain('abaixo-do-nivel');
  });
});

describe('nível no watcher', () => {
  const inbox = 'D:\\editor\\inbox';

  it('a pasta da inbox escolhe o nível', () => {
    expect(inboxLevel(inbox, 'D:\\editor\\inbox\\aula.mp4')).toEqual({ accepted: true, level: null });
    expect(inboxLevel(inbox, 'D:\\editor\\inbox\\pro\\aula.mp4')).toEqual({ accepted: true, level: 'pro' });
    expect(inboxLevel(inbox, 'D:\\editor\\inbox\\Profissional\\aula.mp4')).toEqual({ accepted: true, level: 'pro' });
    expect(inboxLevel(inbox, 'D:\\editor\\inbox\\max\\aula.mp4').level).toBe('max');
  });

  it('pasta que não é nível, ou mais funda, fica de fora', () => {
    expect(inboxLevel(inbox, 'D:\\editor\\inbox\\rascunhos\\aula.mp4')).toEqual({ accepted: false, level: null });
    expect(inboxLevel(inbox, 'D:\\editor\\inbox\\pro\\velhos\\aula.mp4')).toEqual({ accepted: false, level: null });
  });

  it('o job guarda o nível e o prompt headless manda usá-lo', () => {
    const { job } = enqueue([], 'D:/inbox/pro/aula.mp4', new Date('2026-10-12T03:00:00Z'), 'pro');
    expect(job).toMatchObject({ slug: 'aula', level: 'pro' });
    const prompt = headlessPrompt(job!);
    expect(prompt).toContain('Nível de edição: pro (Profissional)');
    expect(prompt).toContain('pnpm mce draft aula --level pro');
    expect(enqueue([], 'D:/inbox/aula.mp4').job!.level).toBeNull();
    expect(headlessPrompt({ file: 'D:/inbox/aula.mp4', slug: 'aula' })).not.toContain('Nível de edição');
  });
});
