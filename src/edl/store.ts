import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ZodError } from 'zod';

import type { Analysis, Transcript } from '../analyze/types.ts';
import { loadConfig } from '../config.ts';
import { type ProjectPaths, readJson, writeJson } from '../project/paths.ts';
import { techReplacements } from '../tech/detect.ts';
import { autocut } from './autocut.ts';
import { type LevelId, levelProfile } from './levels.ts';
import { type Edl, type EdlInput, formatEdlIssues, parseEdl } from './schema.ts';

export function listVersions(paths: ProjectPaths): number[] {
  if (!existsSync(paths.edlDir)) return [];
  return readdirSync(paths.edlDir)
    .map((file) => /^edl\.v(\d+)\.json$/.exec(file)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .sort((a, b) => a - b);
}

export function edlPath(paths: ProjectPaths, version: number): string {
  return join(paths.edlDir, `edl.v${version}.json`);
}

export function validateEdl(data: unknown): Edl {
  try {
    return parseEdl(data);
  } catch (error) {
    if (error instanceof ZodError) throw new Error(`EDL inválida:\n${formatEdlIssues(error)}`);
    throw error;
  }
}

/** Carrega uma versão (a mais recente por padrão), já validada. */
export function loadEdl(paths: ProjectPaths, version?: number): Edl {
  const versions = listVersions(paths);
  const wanted = version ?? versions.at(-1);
  if (wanted === undefined) throw new Error(`Nenhuma EDL em ${paths.edlDir}. Rode: pnpm mce draft ${paths.slug}`);
  if (!versions.includes(wanted)) throw new Error(`EDL v${wanted} não existe (versões: ${versions.join(', ')})`);
  return validateEdl(readJson(edlPath(paths, wanted)));
}

/** Nunca sobrescreve: cada gravação vira edl.v(N+1).json. */
export function saveNewVersion(paths: ProjectPaths, data: Omit<EdlInput, 'version' | 'createdAt'>): Edl {
  const version = (listVersions(paths).at(-1) ?? 0) + 1;
  const edl = validateEdl({ ...data, version, createdAt: new Date().toISOString() });
  writeJson(edlPath(paths, version), edl);
  return edl;
}

function outputSize(source: Analysis['source'], height: number): { width: number; height: number } {
  const targetHeight = Math.min(height, source.height);
  const width = Math.round((source.width / source.height) * targetHeight / 2) * 2;
  return { width, height: targetHeight };
}

/** EDL v-inicial: só o corte automático e legendas. O diretor parte daqui. */
export function draftEdl(paths: ProjectPaths, level?: LevelId): Edl {
  const config = loadConfig();
  const profile = levelProfile(level ?? config.edit.level);
  const analysis = readJson<Analysis>(paths.analysis);
  const transcript = readJson<Transcript>(paths.words);
  const fps = config.output.fps === 'source' ? analysis.source.fps : config.output.fps;
  const { clips, removed } = autocut({
    words: transcript.words,
    phrases: analysis.phrases,
    flags: analysis.flags,
    silences: analysis.silences,
    durationSec: analysis.source.durationSec,
    fps,
    cuts: config.cuts,
  });
  return saveNewVersion(paths, {
    project: paths.slug,
    notes: `Corte automático: retakes, marcadores, hesitações e pausas longas. Sem direção ainda (nível ${profile.id}).`,
    level: profile.id,
    intro: profile.bumpers,
    outro: profile.bumpers,
    source: {
      path: analysis.renderSource,
      durationSec: analysis.source.durationSec,
      fps: analysis.source.fps,
      width: analysis.source.width,
      height: analysis.source.height,
    },
    output: { fps, ...outputSize(analysis.source, config.output.height) },
    clips,
    removed,
    // grafia das tecnologias que a transcrição errou ou deixou em minúsculas ("riéqui" → "React"); o diretor revisa
    captions: { replacements: techReplacements(transcript.words) },
  });
}

/** Resumo do que mudou entre duas versões, para o relatório e para comparar. */
export function diffEdl(a: Edl, b: Edl): string[] {
  const lines: string[] = [];
  const total = (edl: Edl) => edl.clips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);
  const delta = total(b) - total(a);
  lines.push(`clipes: ${a.clips.length} → ${b.clips.length} (duração ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}s)`);
  if (a.level !== b.level) lines.push(`nível: ${a.level} → ${b.level}`);
  for (const key of ['overlays', 'zooms', 'transitions', 'sfx', 'chapters'] as const) {
    const before = new Set(a[key].map((item) => JSON.stringify(item)));
    const after = new Set(b[key].map((item) => JSON.stringify(item)));
    const added = [...after].filter((item) => !before.has(item)).length;
    const dropped = [...before].filter((item) => !after.has(item)).length;
    if (added || dropped) lines.push(`${key}: +${added} / -${dropped}`);
  }
  for (const key of ['captions', 'grade', 'audio', 'music', 'shorts'] as const) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) lines.push(`${key}: alterado`);
  }
  return lines;
}
