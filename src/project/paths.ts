import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROJECTS_DIR = join(ROOT, 'projects');
export const INBOX_DIR = join(ROOT, 'inbox');
export const OUTPUT_DIR = join(ROOT, 'output');
export const ASSETS_DIR = join(ROOT, 'assets');
export const MOTION_ENTRY = join(ROOT, 'motion', 'src', 'index.ts');

export interface ProjectPaths {
  slug: string;
  dir: string;
  analysisDir: string;
  edlDir: string;
  rendersDir: string;
  outputDir: string;
  meta: string;
  memory: string;
  analysis: string;
  words: string;
  takes: string;
  proxy: string;
  audio16k: string;
}

export function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'video'
  );
}

export function slugFromFile(file: string): string {
  return slugify(basename(file, extname(file)));
}

export function projectPaths(slug: string, projectsDir = PROJECTS_DIR): ProjectPaths {
  const dir = join(projectsDir, slug);
  const analysisDir = join(dir, 'analysis');
  return {
    slug,
    dir,
    analysisDir,
    edlDir: join(dir, 'edl'),
    rendersDir: join(dir, 'renders'),
    outputDir: join(OUTPUT_DIR, slug),
    meta: join(dir, 'project.json'),
    memory: join(dir, 'project.md'),
    analysis: join(analysisDir, 'analysis.json'),
    words: join(analysisDir, 'words.json'),
    takes: join(analysisDir, 'takes.md'),
    proxy: join(analysisDir, 'proxy.mp4'),
    audio16k: join(analysisDir, 'audio16k.wav'),
  };
}

export function ensureProject(slug: string): ProjectPaths {
  const paths = projectPaths(slug);
  for (const dir of [paths.analysisDir, paths.edlDir, paths.rendersDir, paths.outputDir]) {
    mkdirSync(dir, { recursive: true });
  }
  return paths;
}

export function requireProject(slug: string): ProjectPaths {
  const paths = projectPaths(slug);
  if (!existsSync(paths.analysis)) {
    const known = existsSync(PROJECTS_DIR)
      ? readdirSync(PROJECTS_DIR, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
      : [];
    throw new Error(
      `Projeto "${slug}" não foi analisado. Rode: pnpm mce analyze <arquivo>\nProjetos existentes: ${known.join(', ') || '(nenhum)'}`,
    );
  }
  return paths;
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) as T;
}

export function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
