import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from '../project/paths.ts';

export const SCENES_DIR = join(ROOT, 'motion', 'src', 'scenes');
export const SCENE_PREFIX = 'scene:';

export interface SceneFile {
  project: string;
  name: string;
}

/** Chave usada na EDL: `scene:<projeto>/<Nome>`. */
export function sceneKey(scene: SceneFile): string {
  return `${scene.project}/${scene.name}`;
}

/** Id da composição no Remotion Studio (só letras, números e hífen). */
export function sceneCompositionId(scene: SceneFile): string {
  return `Cena-${scene.project}-${scene.name}`.replace(/[^a-zA-Z0-9-]/g, '-');
}

/** Id da composição que toca todas as cenas de um projeto em sequência. */
export function reelCompositionId(project: string): string {
  return `Roteiro-${project}`.replace(/[^a-zA-Z0-9-]/g, '-');
}

export interface SceneReel {
  id: string;
  project: string;
  keys: string[];
}

/** Um roteiro por projeto, com as cenas na ordem do índice. */
export function sceneReels(scenes: SceneFile[]): SceneReel[] {
  const reels = new Map<string, SceneReel>();
  for (const scene of scenes) {
    const reel = reels.get(scene.project) ?? { id: reelCompositionId(scene.project), project: scene.project, keys: [] };
    reel.keys.push(sceneKey(scene));
    reels.set(scene.project, reel);
  }
  return [...reels.values()];
}

export function isValidSceneName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

/** Cenas sob medida ficam em motion/src/scenes/<projeto>/<Nome>.tsx. */
export function scanScenes(dir = SCENES_DIR): SceneFile[] {
  if (!existsSync(dir)) return [];
  const scenes: SceneFile[] = [];
  for (const project of readdirSync(dir, { withFileTypes: true })) {
    if (!project.isDirectory() || project.name.startsWith('_')) continue;
    for (const file of readdirSync(join(dir, project.name))) {
      const name = /^(.+)\.tsx$/.exec(file)?.[1];
      if (name && isValidSceneName(name)) scenes.push({ project: project.name, name });
    }
  }
  return scenes.sort((a, b) => sceneKey(a).localeCompare(sceneKey(b)));
}

/**
 * Conteúdo de motion/src/scenes/index.ts. O bundle do Remotion precisa de imports estáticos,
 * então o índice é gerado a partir das pastas em vez de escrito à mão.
 */
export function renderSceneIndex(scenes: SceneFile[]): string {
  const lines = [
    '// GERADO por `pnpm mce scenes sync` — não edite à mão.',
    "import type { ComponentEntry } from '../components/registry';",
    ...scenes.map((scene, index) => `import { entry as scene${index} } from './${scene.project}/${scene.name}';`),
    '',
    'export const sceneRegistry: Record<string, ComponentEntry> = {',
    ...scenes.map((scene, index) => `  '${sceneKey(scene)}': scene${index},`),
    '};',
    '',
    'export const sceneCompositions: { id: string; key: string }[] = [',
    ...scenes.map((scene) => `  { id: '${sceneCompositionId(scene)}', key: '${sceneKey(scene)}' },`),
    '];',
    '',
    'export const sceneReels: { id: string; project: string; keys: string[] }[] = [',
    ...sceneReels(scenes).map((reel) => `  { id: '${reel.id}', project: '${reel.project}', keys: [${reel.keys.map((key) => `'${key}'`).join(', ')}] },`),
    '];',
    '',
  ];
  return lines.join('\n');
}

/** Regrava o índice só quando muda (evita invalidar o cache do bundler à toa). */
export function syncScenes(dir = SCENES_DIR): SceneFile[] {
  mkdirSync(dir, { recursive: true });
  const scenes = scanScenes(dir);
  const file = join(dir, 'index.ts');
  const content = renderSceneIndex(scenes);
  if (!existsSync(file) || readFileSync(file, 'utf8') !== content) writeFileSync(file, content, 'utf8');
  return scenes;
}

/** Overlays da EDL que apontam para cena inexistente. */
export function missingScenes(components: string[], scenes: SceneFile[]): string[] {
  const known = new Set(scenes.map(sceneKey));
  return components
    .filter((component) => component.startsWith(SCENE_PREFIX))
    .map((component) => component.slice(SCENE_PREFIX.length))
    .filter((key) => !known.has(key));
}
