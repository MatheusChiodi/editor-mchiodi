import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { registry } from '../motion/src/components/registry.ts';
import { resolveComponent } from '../motion/src/Overlay.tsx';
import { overlaySchema } from '../src/edl/schema.ts';
import {
  isValidSceneName,
  missingScenes,
  renderSceneIndex,
  scanScenes,
  sceneCompositionId,
  sceneKey,
  syncScenes,
} from '../src/scenes/sync.ts';

const dir = mkdtempSync(join(tmpdir(), 'mce-scenes-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function touch(...parts: string[]) {
  mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(join(dir, ...parts), 'export const entry = {};\n');
}

describe('cenas sob medida', () => {
  touch('aula-react', 'VirtualDom.tsx');
  touch('aula-react', 'Reconciliacao.tsx');
  touch('aula-react', 'helpers.ts');
  touch('aula-react', 'rascunho.tsx');
  touch('outro-video', 'FilaDeEventos.tsx');
  touch('_shared', 'Base.tsx');

  it('encontra só componentes PascalCase em pastas de projeto', () => {
    expect(scanScenes(dir).map(sceneKey)).toEqual([
      'aula-react/Reconciliacao',
      'aula-react/VirtualDom',
      'outro-video/FilaDeEventos',
    ]);
    expect(scanScenes(join(dir, 'nao-existe'))).toEqual([]);
  });

  it('valida o nome da cena', () => {
    expect(isValidSceneName('VirtualDom')).toBe(true);
    expect(isValidSceneName('virtualDom')).toBe(false);
    expect(isValidSceneName('Virtual-Dom')).toBe(false);
  });

  it('gera um índice com imports estáticos, registro e composições de preview', () => {
    const index = renderSceneIndex(scanScenes(dir));
    expect(index).toContain("import { entry as scene1 } from './aula-react/VirtualDom';");
    expect(index).toContain("'aula-react/VirtualDom': scene1,");
    expect(index).toContain("{ id: 'Cena-aula-react-VirtualDom', key: 'aula-react/VirtualDom' },");
    expect(renderSceneIndex([])).toContain('export const sceneRegistry');
  });

  it('o id da composição só tem caracteres aceitos pelo Remotion', () => {
    expect(sceneCompositionId({ project: 'aula_1', name: 'Fila' })).toBe('Cena-aula-1-Fila');
  });

  it('syncScenes grava o índice e não regrava se nada mudou', () => {
    expect(syncScenes(dir)).toHaveLength(3);
    const file = join(dir, 'index.ts');
    const first = statSync(file).mtimeMs;
    const content = readFileSync(file, 'utf8');
    syncScenes(dir);
    expect(statSync(file).mtimeMs).toBe(first);
    expect(readFileSync(file, 'utf8')).toBe(content);
  });

  it('aponta cenas citadas na EDL que não existem', () => {
    const components = ['LowerThird', 'scene:aula-react/VirtualDom', 'scene:aula-react/Sumiu'];
    expect(missingScenes(components, scanScenes(dir))).toEqual(['aula-react/Sumiu']);
  });
});

describe('resolução de componente na camada de gráficos', () => {
  it('biblioteca pelo nome; cena pelo prefixo scene:', () => {
    expect(resolveComponent('LowerThird')).toBe(registry.LowerThird);
    expect(resolveComponent('NaoExiste')).toBeUndefined();
    expect(resolveComponent('scene:projeto/NaoExiste')).toBeUndefined();
  });

  it('todo componente da biblioteca cumpre o contrato do registro', () => {
    expect(Object.keys(registry).length).toBeGreaterThanOrEqual(6);
    for (const [name, entry] of Object.entries(registry)) {
      expect(name).toMatch(/^[A-Z][A-Za-z0-9]*$/);
      expect(typeof entry.component).toBe('function');
      expect(entry.defaultDuration).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(10);
      expect(Object.keys(entry.sample).length).toBeGreaterThan(0);
    }
  });
});

describe('schema: nome de componente', () => {
  const overlay = overlaySchema;
  const base = { id: 'o1', at: 1, duration: 2 };

  it('aceita componente da biblioteca e cena sob medida; recusa o resto', () => {
    expect(overlay.safeParse({ ...base, component: 'LowerThird' }).success).toBe(true);
    expect(overlay.safeParse({ ...base, component: 'scene:aula-react/VirtualDom' }).success).toBe(true);
    expect(overlay.safeParse({ ...base, component: 'lowerThird' }).success).toBe(false);
    expect(overlay.safeParse({ ...base, component: 'scene:VirtualDom' }).success).toBe(false);
  });
});
