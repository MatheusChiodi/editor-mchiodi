import { existsSync, readFileSync } from 'node:fs';

import type { Analysis, Transcript } from '../analyze/types.ts';
import { LEVEL_IDS, levelProfile } from '../edl/levels.ts';
import type { Edl } from '../edl/schema.ts';
import { diffEdl, edlPath, listVersions, loadEdl, saveNewVersion } from '../edl/store.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { type ProjectPaths, projectPaths, readJson } from '../project/paths.ts';
import { buildNotes } from './notes.ts';
import { applyOps, type CutOp, type EdlData } from './ops.ts';
import type { SpeechContext } from './snap.ts';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Erro com status HTTP: o servidor responde com ele em vez de 500. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Valida o slug (nada de `..`, barra ou drive) e exige projeto analisado. */
export function resolveProject(projectsDir: string, slug: string): ProjectPaths {
  if (!SLUG_PATTERN.test(slug)) throw new HttpError(400, `slug inválido: "${slug}"`);
  const paths = projectPaths(slug, projectsDir);
  if (!existsSync(paths.analysis)) throw new HttpError(404, `projeto "${slug}" não existe ou não foi analisado`);
  return paths;
}

export function loadSpeech(paths: ProjectPaths): SpeechContext {
  const analysis = readJson<Analysis>(paths.analysis);
  const { words } = readJson<Transcript>(paths.words);
  return { words, silences: analysis.silences, durationSec: analysis.source.durationSec };
}

export interface VersionInfo {
  version: number;
  createdAt: string;
  notes: string;
  level: string;
  durationSec: number | null;
  /** decisão do Matheus (a skill edit-video não desfaz) */
  byMatheus: boolean;
}

/** Histórico sem validar cada arquivo: uma versão antiga inválida não pode derrubar o editor. */
export function versionHistory(paths: ProjectPaths): VersionInfo[] {
  return listVersions(paths).map((version) => {
    try {
      const raw = readJson<Partial<Edl>>(edlPath(paths, version));
      const fps = raw.output?.fps ?? 30;
      const notes = raw.notes ?? '';
      return {
        version,
        createdAt: raw.createdAt ?? '',
        notes,
        level: raw.level ?? 'normal',
        durationSec: raw.clips ? buildTimeline(raw.clips, fps).durationSec : null,
        byMatheus: notes.startsWith('Matheus:'),
      };
    } catch {
      return { version, createdAt: '', notes: '(arquivo ilegível)', level: '?', durationSec: null, byMatheus: false };
    }
  });
}

function latestVersion(paths: ProjectPaths): number {
  const latest = listVersions(paths).at(-1);
  if (latest === undefined) throw new HttpError(409, `projeto sem EDL; rode pnpm mce draft ${paths.slug}`);
  return latest;
}

export interface ConflictInfo {
  baseVersion: number;
  currentVersion: number;
  /** o que mudou da base para a atual (diffEdl) */
  diff: string[];
  /** versões gravadas depois da base, com as notes */
  since: { version: number; notes: string }[];
}

/** Base desatualizada → conflito explícito (nunca perda silenciosa); base inexistente → erro. */
export function findConflict(paths: ProjectPaths, baseVersion: number): ConflictInfo | null {
  const versions = listVersions(paths);
  const current = versions.at(-1);
  if (current === undefined) throw new HttpError(409, 'projeto sem EDL');
  if (!versions.includes(baseVersion)) throw new HttpError(400, `baseVersion v${baseVersion} não existe (versões: ${versions.join(', ')})`);
  if (baseVersion === current) return null;
  return {
    baseVersion,
    currentVersion: current,
    diff: diffEdl(loadEdl(paths, baseVersion), loadEdl(paths, current)),
    since: versions.filter((version) => version > baseVersion).map((version) => ({ version, notes: loadEdl(paths, version).notes })),
  };
}

function assertBase(paths: ProjectPaths, baseVersion: number): void {
  const conflict = findConflict(paths, baseVersion);
  if (conflict) {
    throw new HttpError(409, `a EDL mudou desde a v${baseVersion} (agora v${conflict.currentVersion}); recarregue e refaça as edições não salvas`, {
      error: 'conflict',
      ...conflict,
    });
  }
}

function dataOf(edl: Edl): EdlData {
  const { version: _version, createdAt: _createdAt, ...data } = edl;
  return data;
}

export interface SaveRequest {
  baseVersion: number;
  ops: CutOp[];
  message?: string;
}

/** Aplica o lote sem gravar: a UI usa para mostrar o snap e os avisos antes de salvar. */
export function previewOps(paths: ProjectPaths, request: Omit<SaveRequest, 'message'>) {
  const base = loadEdl(paths, request.baseVersion);
  const result = applyOps(base, request.ops, loadSpeech(paths));
  return { ...result, notes: buildNotes(result.applied) };
}

/** Salva o lote como v(N+1), com notes "Matheus: ...". Base desatualizada → conflito. */
export function saveOps(paths: ProjectPaths, request: SaveRequest) {
  if (request.ops.length === 0) throw new HttpError(400, 'nada para salvar');
  assertBase(paths, request.baseVersion);
  const base = loadEdl(paths, request.baseVersion);
  const result = applyOps(base, request.ops, loadSpeech(paths));
  const notes = buildNotes(result.applied, request.message);
  const saved = saveNewVersion(paths, { ...result.data, notes });
  return { edl: saved, warnings: result.warnings, notes, snaps: result.snaps };
}

/** Voltar a uma versão = gravar uma nova com o conteúdo dela. O nível atual fica (só o Matheus troca nível). */
export function revertTo(paths: ProjectPaths, version: number, baseVersion: number): Edl {
  assertBase(paths, baseVersion);
  const current = loadEdl(paths, baseVersion);
  const target = loadEdl(paths, version);
  const levelNote = target.level !== current.level ? ` (nível mantido em ${current.level}; a v${version} era ${target.level})` : '';
  return saveNewVersion(paths, {
    ...dataOf(target),
    level: current.level,
    notes: `Matheus: voltou para a v${version}${levelNote}; a v${current.version} continua no histórico`,
  });
}

/** Rejeitar a proposta do painel = nova versão igual à base dela. Nada é apagado. */
export function rejectProposal(paths: ProjectPaths, proposedVersion: number, baseVersion = proposedVersion - 1): Edl {
  const latest = latestVersion(paths);
  if (proposedVersion !== latest) {
    throw new HttpError(409, `a proposta v${proposedVersion} não é mais a versão atual (v${latest}); compare no histórico`, { error: 'conflict', currentVersion: latest });
  }
  const base = loadEdl(paths, baseVersion);
  return saveNewVersion(paths, { ...dataOf(base), notes: `Matheus: rejeitou proposta v${proposedVersion} (volta ao conteúdo da v${baseVersion})` });
}

export function levelInfo(edl: Pick<Edl, 'level'>) {
  const profile = levelProfile(edl.level);
  return {
    current: edl.level,
    profile,
    all: LEVEL_IDS.map((id) => ({ id, label: levelProfile(id).label })),
    /** a troca é sempre ação explícita do Matheus: op `setLevel` com `confirm: true` */
    changeRequires: 'confirm',
  };
}

/** Tudo que a UI precisa para abrir um projeto. */
export function projectPayload(paths: ProjectPaths, apiBase: string) {
  const analysis = readJson<Analysis>(paths.analysis);
  const { words } = readJson<Transcript>(paths.words);
  const versions = versionHistory(paths);
  const edl = versions.length ? loadEdl(paths) : null;
  const timeline = edl ? buildTimeline(edl.clips, edl.output.fps) : null;
  return {
    slug: paths.slug,
    latest: versions.at(-1)?.version ?? null,
    versions,
    edl,
    timeline,
    source: analysis.source,
    words: words.map(({ text, start, end, score }) => ({ text, start, end, score })),
    silences: analysis.silences,
    flags: analysis.flags,
    phrases: analysis.phrases.map(({ id, start, end, text }) => ({ id, start, end, text })),
    takes: existsSync(paths.takes) ? readFileSync(paths.takes, 'utf8') : null,
    level: edl ? levelInfo(edl) : null,
    media: {
      proxy: `${apiBase}/proxy`,
      waveform: `${apiBase}/waveform`,
      still: `${apiBase}/still?at=`,
    },
  };
}
