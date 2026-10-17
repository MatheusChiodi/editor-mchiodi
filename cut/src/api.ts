/** Cliente da API do `mce cut` (src/cut/server.ts). Tudo em segundos da FONTE. */
import type { Span } from '../../src/analyze/types.ts';
import type { CutOp } from '../../src/cut/ops.ts';
import type { SnapResult } from '../../src/cut/snap.ts';
import type { LevelId, LevelProfile } from '../../src/edl/levels.ts';
import type { Edl } from '../../src/edl/schema.ts';
import type { Timeline } from '../../src/edl/timeline.ts';
import type { EvalFinding } from './lib/ui.ts';

export interface VersionInfo {
  version: number;
  createdAt: string;
  notes: string;
  level: string;
  durationSec: number | null;
  byMatheus: boolean;
}

export interface LevelInfo {
  current: LevelId;
  profile: LevelProfile;
  all: { id: LevelId; label: string }[];
  changeRequires: 'confirm';
}

export interface ProjectWord {
  text: string;
  start: number;
  end: number;
  score: number;
}

export interface ProjectPayload {
  slug: string;
  latest: number | null;
  versions: VersionInfo[];
  edl: Edl | null;
  timeline: Timeline | null;
  source: { path: string; durationSec: number; fps: number; width: number; height: number };
  words: ProjectWord[];
  silences: Span[];
  flags: { kind: string; start: number; end: number; reason: string }[];
  phrases: { id: string; start: number; end: number; text: string }[];
  takes: string | null;
  level: LevelInfo | null;
  media: { proxy: string; waveform: string; still: string };
}

export interface PreviewResult {
  edl: Edl;
  timeline: Timeline;
  notes: string;
  warnings: string[];
  snaps: SnapResult[];
}

export interface SaveResult {
  version: number;
  edl: Edl;
  notes: string;
  warnings: string[];
}

export interface Waveform {
  peaksPerSec: number;
  durationSec: number;
  peaks: number[];
}

export interface JobView {
  id: string;
  kind: string;
  args: string[];
  status: 'running' | 'done' | 'failed' | 'canceled';
  file?: string | null;
  url?: string | null;
  log?: string[];
}

export interface EvalPayload {
  edlVersion: number;
  createdAt: string;
  passed: boolean;
  metrics: Record<string, unknown>;
  contactSheet: string | null;
  findings: EvalFinding[];
}

export interface ArsenalItem {
  id: string;
  group: string;
  description: string;
  usage: string;
  details?: string[];
  gallery?: string;
}

/** Erro da API com o corpo (409 traz o conflito; 422 traz `opIndex`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(typeof body.error === 'string' ? body.error : `HTTP ${status}`);
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
    headers: init?.body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { error: text.slice(0, 200) };
  }
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}

const base = (slug: string) => `/api/projects/${encodeURIComponent(slug)}`;

export const api = {
  projects: () => request<{ projects: { slug: string; analyzed: boolean; latest: number | null; versions: number }[] }>('/api/projects'),
  project: (slug: string) => request<ProjectPayload>(base(slug)),
  edl: (slug: string, version: number) => request<Edl>(`${base(slug)}/edl/${version}`),
  diff: (slug: string, a: number, b: number) => request<{ a: number; b: number; lines: string[] }>(`${base(slug)}/diff?a=${a}&b=${b}`),
  snap: (slug: string, t: number) => request<SnapResult>(`${base(slug)}/snap?t=${t}`),
  preview: (slug: string, baseVersion: number, ops: CutOp[]) => request<PreviewResult>(`${base(slug)}/preview`, { body: { baseVersion, ops } }),
  save: (slug: string, baseVersion: number, ops: CutOp[], message?: string) =>
    request<SaveResult>(`${base(slug)}/save`, { body: { baseVersion, ops, ...(message ? { message } : {}) } }),
  revert: (slug: string, version: number, baseVersion: number) => request<{ version: number }>(`${base(slug)}/revert`, { body: { version, baseVersion } }),
  level: (slug: string) => request<LevelInfo>(`${base(slug)}/level`),
  waveform: (slug: string) => request<Waveform>(`${base(slug)}/waveform`),
  srtUrl: (slug: string, version?: number) => `${base(slug)}/srt${version ? `?version=${version}` : ''}`,
  srtSave: (slug: string, version?: number) => request<{ path: string; url: string }>(`${base(slug)}/srt/save`, { body: version ? { version } : {} }),
  srtImport: (slug: string, baseVersion: number, srt: string) =>
    request<{ ops: CutOp[]; changes: { from: string; to: string }[]; unmatched: string[] }>(`${base(slug)}/srt/import`, { body: { baseVersion, srt } }),
  stillUrl: (slug: string, at: number) => `${base(slug)}/still?at=${at.toFixed(3)}`,
  jobs: (slug: string) => request<{ job: JobView | null }>(`${base(slug)}/jobs`),
  startJob: (slug: string, body: { kind: string; edl?: number; export?: { format: string; fit?: string; focusX?: number; scope?: string } }) =>
    request<{ job: JobView }>(`${base(slug)}/jobs`, { body }),
  cancelJob: (slug: string) => request<{ ok: boolean }>(`${base(slug)}/jobs/cancel`, { body: {} }),
  evals: (slug: string) => request<{ eval: EvalPayload | null }>(`${base(slug)}/evals`),
  claude: (slug: string, instruction: string, baseVersion: number, selection?: { start?: number; end?: number; ids?: string[] }) =>
    request<{ ok: boolean }>(`${base(slug)}/claude`, { body: { instruction, baseVersion, ...(selection ? { selection } : {}) } }),
  claudeCancel: (slug: string) => request<{ ok: boolean }>(`${base(slug)}/claude/cancel`, { body: {} }),
  claudeAccept: (slug: string, proposedVersion: number) => request<{ version: number }>(`${base(slug)}/claude/accept`, { body: { proposedVersion } }),
  claudeReject: (slug: string, proposedVersion: number) => request<{ version: number }>(`${base(slug)}/claude/reject`, { body: { proposedVersion } }),
  arsenal: (query: string) => request<{ kinds: Record<string, ArsenalItem[]> }>(`/api/arsenal?q=${encodeURIComponent(query)}`),
  events: (slug: string) => new EventSource(`${base(slug)}/events`),
};
