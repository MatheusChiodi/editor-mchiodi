import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { catalog, formatCatalog, modelItem, search } from '../src/arsenal/catalog.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { findUnmodeledScenes, lintStyle } from '../src/eval/checks.ts';
import { buildReport, reportModels } from '../src/report/index.ts';
import {
  auditScenes,
  createModel,
  formatAudit,
  isModel,
  latestEdlUsage,
  loadSceneLinks,
  loadScenes,
  MODEL_TEMPLATE,
  modelProblems,
  modelSnippet,
  modelsOf,
  parseOrigin,
  parseTags,
  readLiteral,
  readModelLink,
  readScene,
  renderModelSkeleton,
  sceneLinks,
} from '../src/scenes/models.ts';
import { renderSceneIndex, scanScenes, sceneCompositionId, sceneReels, syncScenes } from '../src/scenes/sync.ts';

const dir = mkdtempSync(join(tmpdir(), 'mce-models-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function write(content: string, ...parts: string[]) {
  mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(join(dir, ...parts), content);
}

const MODEL_SOURCE = `
import type { ComponentEntry } from '../../components/registry';

export interface PilhaEmDoisGruposProps { groups?: { title: string; items: string[] }[]; revealAt?: number[][] }

const SAMPLE_GROUPS = [
  { title: 'Antes', items: ['Planilha', 'E-mail'] }, // comentário, com vírgula
  { title: 'Depois', items: ['Um painel só'] },
];
const REVEAL: number[][] = [[0.9, 1.6], [3.2]];
const DURATION = 8;

export const PilhaEmDoisGrupos = () => null;

export const entry: ComponentEntry = {
  component: PilhaEmDoisGrupos,
  sample: { title: 'O que mudou.', groups: SAMPLE_GROUPS, revealAt: REVEAL },
  defaultDuration: DURATION,
  description:
    'Enumeração em dois blocos que se comparam: os itens de cada grupo empilham um a um, na ordem da fala. ' +
    'Para "eu sabia isto e isto; do outro lado, só aquilo".',
  tags: ['pilha', 'comparação', 'lista'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/StackInicial' },
  slots: [
    { name: 'title', type: 'string', description: 'a frase da cena' },
    { name: 'groups', type: '{ title: string; items: string[] }[]', description: 'os dois grupos, na ordem da fala' },
    { name: 'revealAt', type: 'number[][]', description: 'segundo de cada item, por grupo e índice' },
  ],
};
`;

const SKELETON_LIKE = `
export const entry = {
  component: X,
  sample: { items: build(3), title: 'ok' },
  defaultDuration: 5,
  description: 'TODO: diga quando usar.',
  tags: ['todo'],
};
`;

const custom = (extra = '') => `${extra}\nexport const entry = { component: C, sample: { revealAt: { a: 1 } }, defaultDuration: 6, description: 'Cena papel: algo específico deste vídeo.' };\n`;

write(MODEL_SOURCE, 'modelos', 'PilhaEmDoisGrupos.tsx');
write(SKELETON_LIKE, 'modelos', 'Rascunho.tsx');
write(custom("export const MODEL = 'PilhaEmDoisGrupos';"), 'aula-react', 'StackDoReact.tsx');
write(custom(), 'aula-react', 'VirtualDom.tsx');
write(custom("export const MODEL = 'NaoExiste';"), 'aula-react', 'Fila.tsx');
write(custom('// export const MODEL = "PilhaEmDoisGrupos";'), 'outro-video', 'Solta.tsx');
write('export const helper = 1;\n', 'modelos', 'kit.ts');

describe('leitura estática de literais', () => {
  it('objeto, lista, texto, número, booleano, comentários e vírgula final', () => {
    const { value, ok } = readLiteral(`{ a: 'x', "b": [1, -2.5, true, null], /* c */ c: { d: \`z\` }, // fim\n }`);
    expect(ok).toBe(true);
    expect(value).toEqual({ a: 'x', b: [1, -2.5, true, null], c: { d: 'z' } });
  });

  it('resolve constantes do arquivo, soma de textos, spread, membro e `as const`', () => {
    const source = `const BASE: Record<string, number> = { a: 1 };\nconst LIST = ['p', 'q'] as const;\nconst X = { ...BASE, b: BASE.a, text: 'um ' + 'dois', list: [...LIST, 'r'], BASE } satisfies Foo<A, B>;`;
    const { value, ok } = readLiteral(source, source.indexOf('{ ...BASE'));
    expect(ok).toBe(true);
    expect(value).toEqual({ a: 1, b: 1, text: 'um dois', list: ['p', 'q', 'r'], BASE: { a: 1 } });
  });

  it('marca o que só se resolve executando, sem perder o resto', () => {
    const result = readLiteral(`{ a: 1, b: make(2, { x: ')' }), c: n * 2, d: cond ? 1 : 2, e: 'fim' }`);
    expect(result.ok).toBe(false);
    expect(result.value).toEqual({ a: 1, e: 'fim' });
    expect(result.incomplete).toEqual(['b', 'c', 'd']);
  });

  it('não trava em fonte quebrado', () => {
    expect(readLiteral('{ a: [1, 2').ok).toBe(false);
    expect(readLiteral("{ a: 'sem fim").ok).toBe(false);
    expect(readLiteral('').ok).toBe(false);
  });
});

describe('modelos: descoberta e metadados', () => {
  const scenes = loadScenes(dir);
  const models = modelsOf(scenes);

  it('a pasta `modelos` é um projeto como os outros para o sync (índice, composição, roteiro)', () => {
    const found = scanScenes(dir);
    expect(found.filter(isModel).map((scene) => scene.name)).toEqual(['PilhaEmDoisGrupos', 'Rascunho']);
    expect(renderSceneIndex(found)).toContain("'modelos/PilhaEmDoisGrupos': scene");
    expect(sceneCompositionId({ project: 'modelos', name: 'PilhaEmDoisGrupos' })).toBe('Cena-modelos-PilhaEmDoisGrupos');
    expect(sceneReels(found).map((reel) => reel.id)).toContain('Roteiro-modelos');
  });

  it('lê descrição, duração, tags, origem, slots e sample do fonte', () => {
    const model = models.find((item) => item.name === 'PilhaEmDoisGrupos')!;
    expect(model.description).toMatch(/^Enumeração em dois blocos.*só aquilo"\.$/);
    expect(model.defaultDuration).toBe(8);
    expect(model.tags).toEqual(['pilha', 'comparação', 'lista']);
    expect(model.origin).toEqual({ project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/StackInicial' });
    expect(model.slots.map((slot) => slot.name)).toEqual(['title', 'groups', 'revealAt']);
    expect(model.sample).toEqual({
      title: 'O que mudou.',
      groups: [{ title: 'Antes', items: ['Planilha', 'E-mail'] }, { title: 'Depois', items: ['Um painel só'] }],
      revealAt: [[0.9, 1.6], [3.2]],
    });
    expect(model.model).toBeNull();
    expect(modelProblems(model)).toEqual([]);
  });

  it('aponta o que falta num modelo incompleto', () => {
    const draft = models.find((item) => item.name === 'Rascunho')!;
    expect(draft.sample).toEqual({ title: 'ok' });
    expect(draft.sampleIncomplete).toEqual(['items']);
    const problems = modelProblems(draft).join('\n');
    for (const piece of ['description', 'tags', 'origin', 'slots', 'items']) expect(problems).toContain(piece);
  });

  it('o trecho da EDL usa scene:modelos/<Nome> com o sample inteiro', () => {
    const snippet = modelSnippet(models[0]!);
    expect(snippet).toContain('"component": "scene:modelos/PilhaEmDoisGrupos"');
    expect(snippet).toContain('"duration": 8');
    expect(snippet).toContain('"revealAt":[[0.9,1.6],[3.2]]');
  });

  it('entra no catálogo do arsenal: lista, busca por tag/slot sem acento e detalhe com slots', () => {
    const items = catalog('models', dir);
    expect(items.map((item) => item.id)).toEqual(['PilhaEmDoisGrupos', 'Rascunho']);
    expect(items[0]!.group).toBe('8s · pilha, comparação, lista · nasceu em como-melhorei (2026-10-12)');
    expect(search(items, 'COMPARACAO').map((item) => item.id)).toEqual(['PilhaEmDoisGrupos']);
    expect(search(items, 'groups')).toHaveLength(1);
    const verbose = formatCatalog(items.slice(0, 1), true);
    expect(verbose).toContain('· groups: { title: string; items: string[] }[] — os dois grupos, na ordem da fala');
    expect(verbose).toContain('overlays[]: { "id": "<id>", "component": "scene:modelos/PilhaEmDoisGrupos"');
    expect(formatCatalog(items.slice(0, 1), false)).not.toContain('groups:');
    expect(modelItem(models[1]!).group).toBe('5s · todo · origem não registrada');
    expect(catalog('models', join(dir, 'nao-existe'))).toEqual([]);
  });
});

describe('vínculo cena ↔ modelo', () => {
  it('lê `export const MODEL` na raiz do arquivo; comentário e indentação não valem', () => {
    expect(readModelLink("export const MODEL = 'PilhaEmDoisGrupos';")).toBe('PilhaEmDoisGrupos');
    expect(readModelLink('import x from "y";\nexport const MODEL: string = "modelos/CicloDeDoisPassos";\n')).toBe('CicloDeDoisPassos');
    expect(readModelLink("// export const MODEL = 'PilhaEmDoisGrupos';")).toBeNull();
    expect(readModelLink("  export const MODEL = 'PilhaEmDoisGrupos';")).toBeNull();
    expect(readModelLink("export const MODEL = 'minusculo';")).toBeNull();
    expect(readModelLink('export const entry = {};')).toBeNull();
  });

  it('só vale vínculo com modelo que existe; modelo não entra na lista', () => {
    expect(loadSceneLinks(dir)).toEqual({
      'aula-react/Fila': null,
      'aula-react/StackDoReact': 'PilhaEmDoisGrupos',
      'aula-react/VirtualDom': null,
      'outro-video/Solta': null,
    });
    expect(sceneLinks([])).toEqual({});
  });

  it('um modelo nunca é instância de outro', () => {
    expect(readScene({ project: 'modelos', name: 'X' }, "export const MODEL = 'Y';").model).toBeNull();
  });
});

describe('scenes audit', () => {
  const projects = join(dir, '_projects');
  const edl = (project: string, version: number, components: string[]) => {
    mkdirSync(join(projects, project, 'edl'), { recursive: true });
    writeFileSync(join(projects, project, 'edl', `edl.v${version}.json`), JSON.stringify({ overlays: components.map((component, index) => ({ id: `o${index}`, component })) }));
  };
  edl('aula-react', 1, ['scene:modelos/PilhaEmDoisGrupos', 'scene:modelos/PilhaEmDoisGrupos', 'scene:modelos/PilhaEmDoisGrupos']);
  edl('aula-react', 2, ['LowerThird', 'scene:aula-react/StackDoReact', 'scene:aula-react/VirtualDom', 'scene:aula-react/VirtualDom']);
  edl('aula-react', 10, ['LowerThird', 'scene:aula-react/StackDoReact', 'scene:aula-react/VirtualDom']);
  edl('outro-video', 3, ['scene:modelos/PilhaEmDoisGrupos', 'scene:outro-video/Solta']);
  mkdirSync(join(projects, '.gallery'), { recursive: true });
  mkdirSync(join(projects, 'quebrado', 'edl'), { recursive: true });
  writeFileSync(join(projects, 'quebrado', 'edl', 'edl.v1.json'), '{ nao é json');

  it('lê só a EDL mais recente de cada projeto (v10 > v2) e ignora o que não é projeto', () => {
    expect(latestEdlUsage(projects)).toEqual([
      { project: 'aula-react', components: ['LowerThird', 'scene:aula-react/StackDoReact', 'scene:aula-react/VirtualDom'] },
      { project: 'outro-video', components: ['scene:modelos/PilhaEmDoisGrupos', 'scene:outro-video/Solta'] },
    ]);
    expect(latestEdlUsage(join(projects, 'nao-existe'))).toEqual([]);
  });

  const audit = auditScenes(loadScenes(dir), latestEdlUsage(projects));

  it('lista as cenas sem modelo, inclusive a que aponta para modelo inexistente', () => {
    expect(audit.scenes).toBe(4);
    expect(audit.unlinked.map((scene) => scene.key)).toEqual(['aula-react/Fila', 'aula-react/VirtualDom', 'outro-video/Solta']);
    expect(audit.unlinked[0]).toMatchObject({ brokenLink: 'NaoExiste', uses: 0 });
    expect(audit.unlinked[1]).toMatchObject({ brokenLink: null, uses: 1 });
    expect(audit.linked).toEqual([{ key: 'aula-react/StackDoReact', model: 'PilhaEmDoisGrupos' }]);
  });

  it('conta o uso de cada modelo, direto e pelas cenas vinculadas', () => {
    const pile = audit.models.find((model) => model.name === 'PilhaEmDoisGrupos')!;
    expect(pile).toMatchObject({ uses: 2, projects: ['aula-react', 'outro-video'], instances: ['aula-react/StackDoReact'], problems: [] });
    const draft = audit.models.find((model) => model.name === 'Rascunho')!;
    expect(draft.uses).toBe(0);
    expect(draft.problems.length).toBeGreaterThan(0);
  });

  it('com slug, olha só as cenas daquele vídeo; os modelos continuam todos', () => {
    const one = auditScenes(loadScenes(dir), latestEdlUsage(projects), 'outro-video');
    expect(one.scenes).toBe(1);
    expect(one.unlinked.map((scene) => scene.key)).toEqual(['outro-video/Solta']);
    expect(one.models).toHaveLength(2);
    expect(auditScenes(loadScenes(dir), [], 'sem-cenas')).toMatchObject({ scenes: 0, unlinked: [], linked: [] });
  });

  it('o texto diz o que fazer com cada pendência', () => {
    const text = formatAudit(audit);
    expect(text).toContain('cenas sob medida: 4 · com modelo: 1 · sem modelo: 3 · modelos na biblioteca: 2');
    expect(text).toContain('pnpm mce scenes new <NomePelaForma> --from <slug>/<Cena>');
    expect(text).toContain("! declara MODEL = 'NaoExiste', que não existe em modelos/");
    expect(text).toContain('aula-react/StackDoReact');
    expect(text).toMatch(/PilhaEmDoisGrupos\s+2 usos\s+em aula-react, outro-video · pilha, comparação, lista · nasceu em como-melhorei/);
    expect(text).toContain('! incompleto:');
    expect(text.indexOf('PilhaEmDoisGrupos  ')).toBeLessThan(text.indexOf('Rascunho  '));
    expect(formatAudit(auditScenes([], []), 'x')).toContain('MODELOS: nenhum ainda.');
  });
});

const baseEdl = (overlays: unknown[], project = 'aula-react') =>
  edlSchema.parse({
    version: 3,
    project,
    createdAt: '2026-10-12T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 400, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [
      { id: 'c1', start: 0, end: 100 },
      { id: 'c2', start: 110, end: 400 },
    ],
    overlays,
  });

describe('autoavaliação: cena-sem-modelo', () => {
  const edl = baseEdl([
    { id: 'nome', component: 'LowerThird', at: 5, duration: 4, reason: 'nome' },
    { id: 'pilha', component: 'scene:modelos/PilhaEmDoisGrupos', at: 30, duration: 8, reason: 'r' },
    { id: 'stack', component: 'scene:aula-react/StackDoReact', at: 120, duration: 8, reason: 'r' },
    { id: 'vdom', component: 'scene:aula-react/VirtualDom', at: 200, duration: 6, reason: 'r' },
    { id: 'vdom2', component: 'scene:aula-react/VirtualDom', at: 300, duration: 6, reason: 'r' },
    { id: 'sumiu', component: 'scene:aula-react/Sumiu', at: 350, duration: 6, reason: 'r' },
  ]);
  const timeline = buildTimeline(edl.clips, 30);
  const links = loadSceneLinks(dir);

  it('um aviso por overlay de cena sob medida sem modelo, com o conserto e o tempo do vídeo final', () => {
    const findings = findUnmodeledScenes(edl, timeline, links);
    expect(findings.map((finding) => finding.message.match(/"(\w+)"/)![1])).toEqual(['vdom', 'vdom2']);
    expect(findings[0]).toMatchObject({ severity: 'warning', check: 'cena-sem-modelo', at: 190 });
    expect(findings[0]!.fix).toContain('pnpm mce scenes new <NomePelaForma> --from aula-react/VirtualDom');
    expect(findings[0]!.fix).toContain('scene:modelos/<Nome>');
  });

  it('modelo, cena vinculada, componente da biblioteca e cena inexistente não geram aviso', () => {
    expect(findUnmodeledScenes(baseEdl(edl.overlays.filter((overlay) => !overlay.id.startsWith('vdom'))), timeline, links)).toEqual([]);
    expect(findUnmodeledScenes(edl, timeline, {})).toEqual([]);
  });

  it('o lintStyle só cobra quando recebe a lista de vínculos', () => {
    const checks = (found: { check: string }[]) => found.filter((finding) => finding.check === 'cena-sem-modelo').length;
    expect(checks(lintStyle(edl, timeline))).toBe(0);
    expect(checks(lintStyle(edl, timeline, undefined, links))).toBe(2);
  });
});

describe('relatório: seção Modelos', () => {
  const scenes = loadScenes(dir);
  const edl = baseEdl(
    [
      { id: 'pilha', component: 'scene:modelos/PilhaEmDoisGrupos', at: 30, duration: 8, reason: 'r' },
      { id: 'stack', component: 'scene:aula-react/StackDoReact', at: 120, duration: 8, reason: 'r' },
      { id: 'vdom', component: 'scene:aula-react/VirtualDom', at: 200, duration: 6, reason: 'r' },
    ],
    'como-melhorei',
  );

  it('separa os modelos usados, os criados por causa do vídeo e as cenas ainda sem modelo', () => {
    const models = reportModels(edl, scenes);
    expect(models.used.map((item) => [item.model.name, item.overlays])).toEqual([['PilhaEmDoisGrupos', ['pilha', 'stack']]]);
    expect(models.created.map((model) => model.name)).toEqual(['PilhaEmDoisGrupos']);
    expect(models.unmodeled).toEqual(['aula-react/VirtualDom']);
    expect(reportModels(baseEdl([], 'outro'), scenes)).toEqual({ used: [], created: [], unmodeled: [] });
  });

  it('entra no relatorio.md, antes do acabamento', () => {
    const input = { edl, timeline: buildTimeline(edl.clips, 30), history: [], evaluations: [], renderedFile: null };
    const report = buildReport({ ...input, scenes });
    expect(report).toContain('## Modelos');
    expect(report).toContain('Usados neste vídeo (1):');
    expect(report).toContain('- `scene:modelos/PilhaEmDoisGrupos` [pilha, comparação, lista] — Enumeração em dois blocos');
    expect(report).toContain('(2×: `pilha`, `stack`)');
    expect(report).toContain('Criados por causa deste vídeo (1), prontos para os próximos:');
    expect(report).toContain('Cenas sob medida ainda sem modelo (1): `aula-react/VirtualDom` → `pnpm mce scenes audit como-melhorei`');
    expect(report.indexOf('## Modelos')).toBeGreaterThan(report.indexOf('## O que foi adicionado'));
    expect(report.indexOf('## Modelos')).toBeLessThan(report.indexOf('## Acabamento'));
    const empty = buildReport(input);
    expect(empty).toContain('Nenhum modelo do acervo usado neste vídeo.');
    expect(empty).toContain('Nenhum modelo novo nasceu deste vídeo.');
  });
});

describe('scenes new: esqueleto de modelo', () => {
  const template = readFileSync(MODEL_TEMPLATE, 'utf8');

  it('tags e origem a partir das opções da linha de comando', () => {
    expect(parseTags(' Lista, comparação ,,lista ')).toEqual(['lista', 'comparação']);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseOrigin(undefined, '2026-10-12')).toEqual({ project: 'avulso', date: '2026-10-12' });
    expect(parseOrigin('como-melhorei', '2026-10-12')).toEqual({ project: 'como-melhorei', date: '2026-10-12' });
    expect(parseOrigin('scene:como-melhorei/StackInicial', '2026-10-12')).toEqual({ project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/StackInicial' });
    expect(() => parseOrigin('a/b/c', '2026-10-12')).toThrow('--from inválido');
    expect(() => parseOrigin('modelos/Algo', '2026-10-12')).toThrow('vídeo de origem');
  });

  it('o template real vira um modelo com nome, tags e origem trocados, e continua legível pelo catálogo', () => {
    const source = renderModelSkeleton(template, { name: 'CicloDeDoisPassos', tags: ['ciclo', "d'água"], from: 'aula-react/VirtualDom', date: '2026-10-12' });
    expect(source).not.toContain('ModelTemplate');
    expect(source).not.toContain('modelTemplate');
    expect(source).not.toContain('// TEMPLATE:');
    expect(source.startsWith('// MODELO de animação reutilizável')).toBe(true);
    expect(source).toContain('export const CicloDeDoisPassos: React.FC<CicloDeDoisPassosProps & BaseProps>');
    expect(source).toContain('export function cicloDeDoisPassosTimes(');
    expect(source).toContain('scene:modelos/CicloDeDoisPassos');
    const model = readScene({ project: 'modelos', name: 'CicloDeDoisPassos' }, source);
    expect(model.tags).toEqual(['ciclo', "d'água"]);
    expect(model.origin).toEqual({ project: 'aula-react', date: '2026-10-12', scene: 'aula-react/VirtualDom' });
    expect(model.defaultDuration).toBe(6);
    expect(model.slots.map((slot) => slot.name)).toEqual(Object.keys(model.sample!));
    expect((model.sample!.items as unknown[]).length).toBe(3);
    // só falta o que é trabalho do designer: dizer quando usar
    expect(modelProblems(model)).toHaveLength(1);
    expect(modelProblems(model)[0]).toContain('description');
  });

  it('sem tags o esqueleto fica marcado como incompleto', () => {
    const model = readScene({ project: 'modelos', name: 'Abc' }, renderModelSkeleton(template, { name: 'Abc', tags: [], date: '2026-10-12' }));
    expect(model.tags).toEqual(['todo']);
    expect(model.origin).toEqual({ project: 'avulso', date: '2026-10-12' });
    expect(modelProblems(model).join('\n')).toContain('tags');
  });

  it('recusa nome fora do padrão, nome igual ao da cena de origem e template sem marcadores', () => {
    expect(() => renderModelSkeleton(template, { name: 'pilha', tags: [], date: '2026-10-12' })).toThrow('nome inválido');
    expect(() => renderModelSkeleton(template, { name: 'VirtualDom', tags: [], from: 'aula-react/VirtualDom', date: '2026-10-12' })).toThrow('FORMA');
    expect(() => renderModelSkeleton('export const entry = {};', { name: 'Abc', tags: [], date: '2026-10-12' })).toThrow('marcadores');
  });

  it('grava em modelos/, não sobrescreve, exige a cena de origem e o sync passa a enxergar o modelo', () => {
    const created = createModel({ name: 'DegrauEVao', tags: ['antes-depois'], from: 'aula-react/VirtualDom', date: '2026-10-12' }, dir);
    expect(created.file).toBe(join(dir, 'modelos', 'DegrauEVao.tsx'));
    expect(existsSync(created.file)).toBe(true);
    expect(created.origin.scene).toBe('aula-react/VirtualDom');
    expect(() => createModel({ name: 'DegrauEVao', tags: [], date: '2026-10-12' }, dir)).toThrow('já existe');
    expect(() => createModel({ name: 'OutraForma', tags: [], from: 'aula-react/NaoExiste', date: '2026-10-12' }, dir)).toThrow('cena de origem não existe');
    expect(existsSync(join(dir, 'modelos', 'OutraForma.tsx'))).toBe(false);
    expect(syncScenes(dir).map((scene) => `${scene.project}/${scene.name}`)).toContain('modelos/DegrauEVao');
    rmSync(created.file);
    syncScenes(dir);
  });
});

describe('acervo real', () => {
  const scenes = loadScenes();

  it('toda cena existente é lida sem erro, com descrição e duração', () => {
    expect(scenes.length).toBeGreaterThan(0);
    for (const scene of scenes) {
      expect(scene.description, `${scene.project}/${scene.name}`).toBeTruthy();
      expect(scene.defaultDuration, `${scene.project}/${scene.name}`).toBeGreaterThan(0);
    }
  });

  it('todo modelo em motion/src/scenes/modelos cumpre o contrato', () => {
    for (const model of modelsOf(scenes)) expect(modelProblems(model), model.name).toEqual([]);
  });

  it('todo vínculo declarado aponta para um modelo que existe', () => {
    const models = new Set(modelsOf(scenes).map((model) => model.name));
    for (const scene of scenes) if (scene.model) expect(models.has(scene.model), `${scene.project}/${scene.name} → ${scene.model}`).toBe(true);
  });
});
