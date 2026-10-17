/**
 * Servidor local do MChiodi Cut: API JSON sobre a EDL + arquivos, só em 127.0.0.1. Casca fina: a lógica está em
 * src/cut/*.ts (funções puras) e em src/edl, src/render. Nenhum estado de edição mora aqui; toda mudança vira
 * edl.v(N+1).json via `saveNewVersion`.
 *
 * Segurança: bind em 127.0.0.1; `Host` e `Origin` precisam ser localhost/127.0.0.1 (barra DNS rebinding e
 * página de fora); POST só com `Content-Type: application/json`; sem cabeçalho CORS; slug validado e todo
 * caminho de arquivo resolvido e conferido dentro da pasta permitida.
 *
 * Tempos: tudo em segundos da FONTE, salvo onde diz "saída". Erros: `{ error: string, ... }` com status HTTP
 * (400 pedido inválido, 404, 409 conflito, 422 operação recusada pela EDL/snap).
 *
 * GET  /api/health                                  → { ok, version: 1 }
 * GET  /api/projects                                → { projects: [{ slug, analyzed, latest, versions }] }
 * GET  /api/projects/:slug                          → projeto: { slug, latest, versions[], edl, timeline, source, words[],
 *                                                     silences[], flags[], phrases[], takes, level, media: { proxy, waveform, still } }
 * GET  /api/projects/:slug/edl/:v                   → EDL da versão v
 * GET  /api/projects/:slug/diff?a=&b=               → { a, b, lines[] } (diffEdl)
 * GET  /api/projects/:slug/snap?t=                  → SnapResult: borda válida mais próxima de t + aviso se caía em palavra
 * POST /api/projects/:slug/preview  { baseVersion, ops }            → aplica sem gravar: { edl, timeline, notes, warnings, snaps }
 * POST /api/projects/:slug/save     { baseVersion, ops, message? }  → { version, edl, notes, warnings, snaps }
 *                                    409 { error: 'conflict', baseVersion, currentVersion, diff[], since[] } se a base ficou velha
 *                                    422 { error, opIndex } se uma operação viola a EDL (schema, reason, snap)
 * POST /api/projects/:slug/revert   { version, baseVersion }        → nova versão com o conteúdo de `version` (nível atual mantido)
 * GET  /api/projects/:slug/level                    → { current, profile, all[], changeRequires: 'confirm' }
 *                                    (trocar: op { type: 'setLevel', level, confirm: true } no /save, só por ação do Matheus)
 * GET  /api/projects/:slug/proxy                    → vídeo do player (gera uma vez em renders/proxy/), com HTTP Range
 * GET  /api/projects/:slug/waveform                 → { peaksPerSec, durationSec, peaks[] } (0–255, cache em renders/proxy/peaks.json)
 * GET  /api/projects/:slug/still?at=                → PNG do frame da fonte em `at` (o mesmo do `mce frame`)
 * GET  /api/projects/:slug/srt?version=             → .srt no tempo de SAÍDA (com a vinheta de abertura)
 * POST /api/projects/:slug/srt/save   { version? }               → grava o .srt ao lado do render da versão: { path, file, url }
 * POST /api/projects/:slug/srt/import { baseVersion, srt }          → { ops[] (captionReplace), changes[], unmatched[] }; salvar = /save
 * GET  /api/projects/:slug/file?path=renders/...    → arquivo de renders/ ou analysis/views/ (mp4 com Range, png, srt, json)
 * POST /api/projects/:slug/jobs { kind, edl?, export? }            → 202 { job }; kind: render | final | shorts | eval | evalFinal | export
 *                                    export: { format: 16x9|9x16|1x1, fit?: blur-pad|center-crop, focusX?, scope?: full|shorts }
 *                                    409 se já há job no projeto. Progresso pelos eventos.
 * GET  /api/projects/:slug/jobs                     → { job } atual ou último (null)
 * POST /api/projects/:slug/jobs/cancel              → { ok }
 * GET  /api/projects/:slug/evals                    → última avaliação: { edlVersion, passed, metrics, findings[{ ..., outputSec, sourceSec }] }
 * POST /api/projects/:slug/claude { instruction, baseVersion, selection?: { start?, end?, ids? } } → 202; streaming nos eventos
 * POST /api/projects/:slug/claude/cancel            → { ok }
 * POST /api/projects/:slug/claude/accept { proposedVersion }        → { version } (a proposta já é a versão atual)
 * POST /api/projects/:slug/claude/reject { proposedVersion }        → nova versão igual à base, notes "Matheus: rejeitou proposta vN"
 * GET  /api/projects/:slug/events                   → SSE. Eventos (data = JSON):
 *        version      { version, notes, byMatheus }          nova edl.vN.json (do editor, do Claude ou do terminal)
 *        job          { id, kind, status, args }              job começou
 *        job-log      { id, line }
 *        job-progress { id, label, percent, etaSec }         lido de live.json (o mesmo do `mce progress`)
 *        job-done     { id, kind, ok, code, file?, url? }  url = /file?path=... do vídeo (export e render)
 *        claude       { kind: 'text'|'tool'|'result'|'start', ... }
 *        claude-done  { ok, baseVersion, proposedVersion|null, diff[], result }
 * GET  /api/arsenal?kind=&q=                        → { items[] } (com `gallery` quando há folha) ou { kinds: { [kind]: items[] } }
 * GET  /api/gallery/:file.png                       → miniatura da galeria (projects/.gallery)
 * GET  /*                                           → build da UI em cut/dist (SPA), senão arquivo de assets/ (staticFile);
 *                                                     sem build, 404 com aviso
 */
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { type FSWatcher, watch } from 'chokidar';
import { z } from 'zod';

import { extractFrame } from '../analyze/timeline-view.ts';
import type { Analysis, Transcript } from '../analyze/types.ts';
import { ARSENAL_KINDS, type ArsenalKind, catalog, search } from '../arsenal/catalog.ts';
import { loadConfig } from '../config.ts';
import { findReverts, formatRevert } from '../edl/decisions.ts';
import type { Edl } from '../edl/schema.ts';
import { diffEdl, listVersions, loadEdl } from '../edl/store.ts';
import { buildTimeline, outputToSource } from '../edl/timeline.ts';
import { collectEvaluations } from '../eval/index.ts';
import { run } from '../lib/exec.ts';
import { liveFile, readLive } from '../project/live.ts';
import { type ProjectPaths, PROJECTS_DIR, projectPaths, readJson, ROOT } from '../project/paths.ts';
import { listProjects } from '../project/pipeline.ts';
import { bumperDurations } from '../render/bumpers.ts';
import { planExport } from '../render/formats.ts';
import { buildSrt, importSrt } from '../render/srt.ts';
import { headlessEnv } from '../watcher/headless.ts';
import { jobOutputRel, jobSucceeded, srtSidecarRel, JOB_KINDS, type JobRequest, mceArgs, spawnMce, type SpawnedJob } from './jobs.ts';
import { ensureProxy, ensureWaveform } from './media.ts';
import { cutOpSchema, CutOpError } from './ops.ts';
import {
  HttpError,
  levelInfo,
  loadSpeech,
  previewOps,
  projectPayload,
  rejectProposal,
  resolveProject,
  revertTo,
  saveOps,
  versionHistory,
} from './project.ts';
import { buildPanelPrompt, panelArgs, parseStreamLine } from './prompt.ts';
import { snapEdge } from './snap.ts';

export interface CutServerOptions {
  /** 0 = porta efêmera (testes) */
  port?: number;
  projectsDir?: string;
  /** build da UI (fase B); padrão cut/dist */
  distDir?: string;
  /** arquivos pedidos por staticFile() (memes, marca, b-roll); padrão assets/ */
  assetsDir?: string;
  /** observa projects/<slug>/edl/ (chokidar) para avisar a UI de versão nova */
  watch?: boolean;
  /** como chamar o `claude` do painel (testes trocam por um falso) */
  claudeCommand?: (args: string[]) => { command: string; args: string[] };
  log?: (message: string) => void;
}

export interface CutServer {
  url: string;
  port: number;
  server: Server;
  close: () => Promise<void>;
}

const MAX_BODY = 8 * 1024 * 1024;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.srt': 'application/x-subrip; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/** Só loopback: `localhost`/`127.0.0.1`/`[::1]` em qualquer porta (o dev server do Vite da fase B incluso). */
export function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, '').toLowerCase();
  return name === 'localhost' || name === '127.0.0.1' || name === '[::1]';
}

export function isLoopbackOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  try {
    return isLoopbackHost(new URL(origin).host);
  } catch {
    return false;
  }
}

/** Caminho dentro de `root` ou null (rejeita `..`, absoluto, drive, barra invertida). */
export function safeJoin(root: string, relative: string): string | null {
  if (!relative || relative.includes('\0') || relative.includes('\\') || /^[a-zA-Z]:/.test(relative) || relative.startsWith('/')) return null;
  if (relative.split('/').some((part) => part === '..' || part.startsWith('.'))) return null;
  const base = resolve(root);
  const full = resolve(base, relative);
  return full === base || full.startsWith(base + sep) ? full : null;
}

/** `bytes=a-b` → intervalo válido, `null` (sem Range) ou `'invalid'`. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid';
  let start: number;
  let end: number;
  if (match[1] === '') {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

/** Diff da proposta do Claude + o que ela desfaz de decisões "Matheus:" até a base (a UI mostra antes de aceitar). */
function proposalDiff(paths: ProjectPaths, baseVersion: number, proposed: number): string[] {
  const history = listVersions(paths).filter((version) => version <= baseVersion).map((version) => loadEdl(paths, version));
  const reverts = findReverts(history, loadEdl(paths, proposed)).map((revert) => `⚠ ${formatRevert(revert)}`);
  return [...reverts, ...diffEdl(loadEdl(paths, baseVersion), loadEdl(paths, proposed))];
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

function sendFile(req: IncomingMessage, res: ServerResponse, file: string, type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'): void {
  const { size } = statSync(file);
  const range = parseRange(req.headers.range, size);
  if (range === 'invalid') {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
    res.end();
    return;
  }
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  if (range) {
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': range.end - range.start + 1 });
    if (req.method === 'HEAD') return void res.end();
    createReadStream(file, range).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  if (req.method === 'HEAD') return void res.end();
  createReadStream(file).pipe(res);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  // formulário/texto de outra página não passa: só JSON (que o navegador não manda cross-site sem preflight)
  if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'use Content-Type: application/json');
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > MAX_BODY) throw new HttpError(413, 'corpo grande demais');
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}

function parseWith<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((issue) => `${issue.path.join('.') || '(corpo)'}: ${issue.message}`).join('; '));
  return parsed.data;
}

const version = z.number().int().positive();
const saveBody = z.object({ baseVersion: version, ops: z.array(cutOpSchema), message: z.string().max(500).optional() });
const previewBody = z.object({ baseVersion: version, ops: z.array(cutOpSchema) });
const revertBody = z.object({ version, baseVersion: version });
const srtImportBody = z.object({ baseVersion: version, srt: z.string().min(1) });
const srtSaveBody = z.object({ version: version.optional() });
const proposalBody = z.object({ proposedVersion: version });
const claudeBody = z.object({
  instruction: z.string().trim().min(1).max(4000),
  baseVersion: version,
  selection: z
    .object({ start: z.number().nonnegative().optional(), end: z.number().nonnegative().optional(), ids: z.array(z.string()).max(200).optional() })
    .optional(),
});
const jobBody = z.object({
  kind: z.enum(JOB_KINDS),
  edl: version.optional(),
  export: z
    .object({
      format: z.enum(['16x9', '9x16', '1x1']),
      fit: z.enum(['blur-pad', 'center-crop']).optional(),
      focusX: z.number().min(0).max(1).optional(),
      scope: z.enum(['full', 'shorts']).optional(),
    })
    .optional(),
});

interface JobState {
  id: string;
  kind: JobRequest['kind'];
  args: string[];
  status: 'running' | 'done' | 'failed' | 'canceled';
  startedAt: number;
  endedAt: number | null;
  code: number | null;
  log: string[];
  file: string | null;
  spawned: SpawnedJob | null;
}

interface ClaudeState {
  running: boolean;
  baseVersion: number;
  proposedVersion: number | null;
  controller: AbortController | null;
}

export async function startCutServer(options: CutServerOptions = {}): Promise<CutServer> {
  const projectsDir = options.projectsDir ?? PROJECTS_DIR;
  const distDir = options.distDir ?? join(ROOT, 'cut', 'dist');
  const assetsDir = options.assetsDir ?? join(ROOT, 'assets');
  const galleryDir = join(projectsDir, '.gallery');
  const log = options.log ?? (() => {});
  const streams = new Map<string, Set<ServerResponse>>();
  const watchers = new Map<string, Promise<FSWatcher>>();
  const jobs = new Map<string, JobState>();
  const claude = new Map<string, ClaudeState>();
  const proxies = new Map<string, Promise<string>>();
  const waveforms = new Map<string, Promise<unknown>>();
  let jobCounter = 0;

  const emit = (slug: string, event: string, data: unknown) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of streams.get(slug) ?? []) res.write(payload);
  };

  /** Resolve quando o chokidar está pronto: antes disso uma versão nova passaria sem aviso. */
  const watchProject = (paths: ProjectPaths): Promise<unknown> => {
    if (options.watch === false) return Promise.resolve();
    const existing = watchers.get(paths.slug);
    if (existing) return existing;
    mkdirSync(paths.edlDir, { recursive: true });
    const watcher = watch(paths.edlDir, { ignoreInitial: true, depth: 0, awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 } });
    watcher.on('add', (file) => {
      const match = /edl\.v(\d+)\.json$/.exec(file);
      if (!match) return;
      const info = versionHistory(paths).find((item) => item.version === Number(match[1]));
      emit(paths.slug, 'version', { version: Number(match[1]), notes: info?.notes ?? '', byMatheus: info?.byMatheus ?? false });
    });
    const ready = new Promise<FSWatcher>((done) => watcher.once('ready', () => done(watcher)));
    watchers.set(paths.slug, ready);
    return ready;
  };

  /** URL de um arquivo do projeto pelo endpoint /file (null se estiver fora de renders/ ou analysis/views/) */
  const fileUrl = (paths: ProjectPaths, file: string): string | null => {
    const rel = relative(paths.dir, file).split(sep).join('/');
    return rel.startsWith('renders/') || rel.startsWith('analysis/views/') ? `/api/projects/${paths.slug}/file?path=${encodeURIComponent(rel)}` : null;
  };

  const publicJob = (job: JobState | undefined) =>
    job ? { id: job.id, kind: job.kind, args: job.args, status: job.status, startedAt: job.startedAt, endedAt: job.endedAt, code: job.code, file: job.file, log: job.log.slice(-50) } : null;

  const startJob = (paths: ProjectPaths, request: JobRequest) => {
    const current = jobs.get(paths.slug);
    if (current?.status === 'running') throw new HttpError(409, `já há um ${current.kind} rodando neste projeto`, { job: publicJob(current) });
    const args = mceArgs(paths.slug, request);
    let file: string | null = null;
    if (request.kind === 'export') {
      const edl = loadEdl(paths, request.edl);
      file = planExport(edl, request.export!, paths.rendersDir, paths.slug).file;
    } else {
      const version = request.edl ?? listVersions(paths).at(-1);
      const rel = version === undefined ? null : jobOutputRel(request.kind, version);
      file = rel ? join(paths.dir, ...rel.split('/')) : null;
    }
    const job: JobState = { id: `j${++jobCounter}`, kind: request.kind, args, status: 'running', startedAt: Date.now(), endedAt: null, code: null, log: [], file, spawned: null };
    jobs.set(paths.slug, job);
    emit(paths.slug, 'job', { id: job.id, kind: job.kind, status: job.status, args });
    job.spawned = spawnMce(args, (line) => {
      job.log.push(line);
      if (job.log.length > 400) job.log.splice(0, job.log.length - 400);
      emit(paths.slug, 'job-log', { id: job.id, line });
    });
    let lastProgress = '';
    const poll = setInterval(() => {
      const live = readLive(liveFile(paths));
      if (!live) return;
      const key = `${live.label}:${live.percent}`;
      if (key === lastProgress) return;
      lastProgress = key;
      emit(paths.slug, 'job-progress', { id: job.id, label: live.label, percent: live.percent, etaSec: live.etaSec });
    }, 500);
    void job.spawned.done.then((code) => {
      clearInterval(poll);
      job.code = code;
      job.endedAt = Date.now();
      if (job.status !== 'canceled') job.status = jobSucceeded(job.kind, code) ? 'done' : 'failed';
      emit(paths.slug, 'job-done', { id: job.id, kind: job.kind, ok: job.status === 'done', code, file: job.file, url: job.file ? fileUrl(paths, job.file) : null });
    });
    return job;
  };

  const runClaude = (paths: ProjectPaths, body: z.infer<typeof claudeBody>) => {
    const state = claude.get(paths.slug);
    if (state?.running) throw new HttpError(409, 'o painel já tem uma sessão rodando neste projeto');
    const latest = listVersions(paths).at(-1);
    if (latest !== body.baseVersion) {
      throw new HttpError(409, `salve ou descarte as edições antes: a EDL atual é v${latest}, a UI está na v${body.baseVersion}`, { error: 'conflict', currentVersion: latest });
    }
    const edl = loadEdl(paths, body.baseVersion);
    const config = loadConfig().headless;
    const prompt = buildPanelPrompt({ slug: paths.slug, version: body.baseVersion, level: edl.level, instruction: body.instruction, selection: body.selection });
    const args = panelArgs(prompt, config);
    const command = options.claudeCommand ? options.claudeCommand(args) : { command: 'claude', args };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMin * 60_000);
    const session: ClaudeState = { running: true, baseVersion: body.baseVersion, proposedVersion: null, controller };
    claude.set(paths.slug, session);
    emit(paths.slug, 'claude', { kind: 'start', baseVersion: body.baseVersion });
    let resultText = '';
    let ok = false;
    void run(command.command, command.args, {
      cwd: ROOT,
      env: headlessEnv(process.env, config),
      signal: controller.signal,
      onStdoutLine: (line) => {
        for (const event of parseStreamLine(line)) {
          if (event.kind === 'result') {
            resultText = event.text;
            ok = event.ok;
          }
          emit(paths.slug, 'claude', event);
        }
      },
    })
      .catch((error: unknown) => {
        ok = false;
        resultText ||= controller.signal.aborted ? 'sessão cancelada' : error instanceof Error ? error.message.split('\n')[0]! : String(error);
      })
      .finally(() => {
        clearTimeout(timeout);
        session.running = false;
        session.controller = null;
        const newest = listVersions(paths).at(-1) ?? body.baseVersion;
        const proposed = newest > body.baseVersion ? newest : null;
        session.proposedVersion = proposed;
        const diff = proposed ? proposalDiff(paths, body.baseVersion, proposed) : [];
        emit(paths.slug, 'claude-done', { ok: ok && proposed !== null, baseVersion: body.baseVersion, proposedVersion: proposed, diff, result: resultText });
      });
  };

  const latestEval = (paths: ProjectPaths) => {
    const report = collectEvaluations(paths.rendersDir).at(-1);
    if (!report) return null;
    const versions = listVersions(paths);
    const edl = versions.includes(report.edlVersion) ? loadEdl(paths, report.edlVersion) : null;
    const timeline = edl ? buildTimeline(edl.clips, edl.output.fps) : null;
    const introSec = edl ? bumperDurations(edl).introSec : 0;
    return {
      edlVersion: report.edlVersion,
      createdAt: report.createdAt,
      passed: report.passed,
      metrics: report.metrics,
      contactSheet: report.contactSheet ? fileUrl(paths, report.contactSheet) : null,
      findings: report.findings.map((finding) => {
        const outputSec = finding.at === null ? null : finding.at - introSec;
        const sourceSec = outputSec !== null && timeline && outputSec >= 0 ? outputToSource(timeline, outputSec) : null;
        return { ...finding, outputSec, sourceSec };
      }),
    };
  };

  const arsenal = (kind: string | null, query: string) => {
    const withGallery = (items: ReturnType<typeof catalog>) =>
      items.map((item) => (existsSync(join(galleryDir, `${item.id}.png`)) ? { ...item, gallery: `/api/gallery/${encodeURIComponent(item.id)}.png` } : item));
    if (kind) {
      if (!ARSENAL_KINDS.includes(kind as ArsenalKind)) throw new HttpError(400, `categoria desconhecida: ${kind} (use ${ARSENAL_KINDS.join(', ')})`);
      return { kind, items: withGallery(search(catalog(kind as ArsenalKind), query)) };
    }
    return { kinds: Object.fromEntries(ARSENAL_KINDS.map((name) => [name, withGallery(search(catalog(name), query))])) };
  };

  const serveStatic = (req: IncomingMessage, res: ServerResponse, pathname: string) => {
    let relative: string;
    try {
      relative = decodeURIComponent(pathname).replace(/^\/+/, '');
    } catch {
      throw new HttpError(400, 'caminho inválido');
    }
    const isFile = (file: string | null): file is string => file !== null && existsSync(file) && statSync(file).isFile();
    const built = relative ? safeJoin(distDir, relative) : null;
    if (isFile(built)) return sendFile(req, res, built);
    // staticFile() dos componentes do Remotion pede /memes/x.png na raiz: no build vem de assets/ (no cut:dev, publicDir do Vite)
    const asset = relative ? safeJoin(assetsDir, relative) : null;
    if (isFile(asset)) return sendFile(req, res, asset);
    const index = join(distDir, 'index.html');
    if (!existsSync(index)) {
      sendJson(res, 404, { error: 'a UI ainda não foi construída (cut/dist); a API está em /api' });
      return;
    }
    if (!relative) return sendFile(req, res, index);
    // rota da SPA
    if (!extname(relative)) return sendFile(req, res, index);
    sendJson(res, 404, { error: 'não encontrado' });
  };

  const handleProject = async (req: IncomingMessage, res: ServerResponse, slug: string, rest: string, url: URL) => {
    const paths = resolveProject(projectsDir, slug);
    const method = req.method ?? 'GET';
    const apiBase = `/api/projects/${slug}`;
    const get = method === 'GET' || method === 'HEAD';

    if (rest === '' && get) return sendJson(res, 200, projectPayload(paths, apiBase));
    if (rest === '/events' && method === 'GET') {
      await watchProject(paths);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`event: hello\ndata: ${JSON.stringify({ latest: listVersions(paths).at(-1) ?? null })}\n\n`);
      const set = streams.get(slug) ?? new Set();
      set.add(res);
      streams.set(slug, set);
      const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
      req.on('close', () => {
        clearInterval(ping);
        set.delete(res);
      });
      return;
    }
    const edlMatch = /^\/edl\/(\d+)$/.exec(rest);
    if (edlMatch && get) return sendJson(res, 200, loadEdl(paths, Number(edlMatch[1])));
    if (rest === '/diff' && get) {
      const a = Number(url.searchParams.get('a'));
      const b = Number(url.searchParams.get('b'));
      if (!Number.isInteger(a) || !Number.isInteger(b)) throw new HttpError(400, 'diff precisa de ?a=&b=');
      return sendJson(res, 200, { a, b, lines: diffEdl(loadEdl(paths, a), loadEdl(paths, b)) });
    }
    if (rest === '/snap' && get) {
      const t = Number(url.searchParams.get('t'));
      if (!Number.isFinite(t)) throw new HttpError(400, 'snap precisa de ?t=');
      return sendJson(res, 200, snapEdge(t, loadSpeech(paths)));
    }
    if (rest === '/preview' && method === 'POST') {
      const body = parseWith(previewBody, await readBody(req));
      const result = previewOps(paths, body);
      return sendJson(res, 200, { edl: result.edl, timeline: buildTimeline(result.edl.clips, result.edl.output.fps), notes: result.notes, warnings: result.warnings, snaps: result.snaps });
    }
    if (rest === '/save' && method === 'POST') {
      const body = parseWith(saveBody, await readBody(req));
      const saved = saveOps(paths, body);
      log(`${slug}: v${saved.edl.version} — ${saved.notes}`);
      return sendJson(res, 200, { version: saved.edl.version, edl: saved.edl, notes: saved.notes, warnings: saved.warnings, snaps: saved.snaps });
    }
    if (rest === '/revert' && method === 'POST') {
      const body = parseWith(revertBody, await readBody(req));
      const saved = revertTo(paths, body.version, body.baseVersion);
      return sendJson(res, 200, { version: saved.version, edl: saved, notes: saved.notes });
    }
    if (rest === '/level' && get) return sendJson(res, 200, levelInfo(loadEdl(paths)));
    if (rest === '/proxy' && get) {
      if (!proxies.has(slug)) proxies.set(slug, ensureProxy(paths).finally(() => undefined));
      let file: string;
      try {
        file = await proxies.get(slug)!;
      } catch (error) {
        proxies.delete(slug);
        throw error;
      }
      return sendFile(req, res, file, 'video/mp4');
    }
    if (rest === '/waveform' && get) {
      if (!waveforms.has(slug)) waveforms.set(slug, ensureWaveform(paths));
      try {
        return sendJson(res, 200, await waveforms.get(slug));
      } finally {
        // o cache em disco vale; o da memória só evita duas decodificações ao mesmo tempo
        waveforms.delete(slug);
      }
    }
    if (rest === '/still' && get) {
      const at = Number(url.searchParams.get('at'));
      if (!Number.isFinite(at) || at < 0) throw new HttpError(400, 'still precisa de ?at= (segundos da fonte)');
      const analysis = readJson<Analysis>(paths.analysis);
      const file = await extractFrame(analysis.proxy, at, join(paths.analysisDir, 'views', `frame-${at.toFixed(2)}.png`));
      return sendFile(req, res, file, 'image/png');
    }
    const srtOf = (edl: Edl) => {
      const { words } = readJson<Transcript>(paths.words);
      return buildSrt(words, buildTimeline(edl.clips, edl.output.fps), edl.captions, bumperDurations(edl).introSec);
    };
    if (rest === '/srt' && get) {
      const wanted = url.searchParams.get('version');
      const edl = loadEdl(paths, wanted ? Number(wanted) : undefined);
      const text = srtOf(edl);
      res.writeHead(200, { 'Content-Type': TYPES['.srt']!, 'Content-Disposition': `attachment; filename="${slug}-v${edl.version}.srt"`, 'Cache-Control': 'no-store' });
      return void res.end(text);
    }
    if (rest === '/srt/save' && method === 'POST') {
      const body = parseWith(srtSaveBody, await readBody(req));
      const edl = loadEdl(paths, body.version);
      const relativePath = srtSidecarRel(slug, edl.version, (rel) => existsSync(join(paths.dir, rel)));
      const file = safeJoin(paths.dir, relativePath)!;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, srtOf(edl), 'utf8');
      return sendJson(res, 200, { path: relativePath, file, url: `${apiBase}/file?path=${encodeURIComponent(relativePath)}` });
    }
    if (rest === '/srt/import' && method === 'POST') {
      const body = parseWith(srtImportBody, await readBody(req));
      const edl = loadEdl(paths, body.baseVersion);
      const { words } = readJson<Transcript>(paths.words);
      return sendJson(res, 200, importSrt(body.srt, words, buildTimeline(edl.clips, edl.output.fps), edl.captions, bumperDurations(edl).introSec));
    }
    if (rest === '/file' && get) {
      const relative = url.searchParams.get('path') ?? '';
      const allowed = relative.startsWith('renders/') || relative.startsWith('analysis/views/');
      const file = allowed ? safeJoin(paths.dir, relative) : null;
      const type = file ? TYPES[extname(file).toLowerCase()] : undefined;
      if (!file || !type || !['.mp4', '.png', '.jpg', '.srt', '.json', '.md', '.txt'].includes(extname(file).toLowerCase())) throw new HttpError(403, 'caminho não permitido');
      if (!existsSync(file) || !statSync(file).isFile()) throw new HttpError(404, 'arquivo não existe');
      return sendFile(req, res, file, type);
    }
    if (rest === '/jobs' && get) return sendJson(res, 200, { job: publicJob(jobs.get(slug)) });
    if (rest === '/jobs' && method === 'POST') {
      const body = parseWith(jobBody, await readBody(req));
      if (body.kind === 'export' && !body.export) throw new HttpError(400, 'export precisa de { export: { format } }');
      let job: JobState;
      try {
        job = startJob(paths, body);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(422, error instanceof Error ? error.message : String(error));
      }
      return sendJson(res, 202, { job: publicJob(job) });
    }
    if (rest === '/jobs/cancel' && method === 'POST') {
      const job = jobs.get(slug);
      if (job?.status === 'running') {
        job.status = 'canceled';
        job.spawned?.cancel();
      }
      return sendJson(res, 200, { ok: true });
    }
    if (rest === '/evals' && get) return sendJson(res, 200, { eval: latestEval(paths) });
    if (rest === '/claude' && method === 'POST') {
      runClaude(paths, parseWith(claudeBody, await readBody(req)));
      return sendJson(res, 202, { ok: true });
    }
    if (rest === '/claude/cancel' && method === 'POST') {
      claude.get(slug)?.controller?.abort();
      return sendJson(res, 200, { ok: true });
    }
    if (rest === '/claude/accept' && method === 'POST') {
      const body = parseWith(proposalBody, await readBody(req));
      const latest = listVersions(paths).at(-1);
      if (latest !== body.proposedVersion) throw new HttpError(409, `a proposta v${body.proposedVersion} não é mais a atual (v${latest})`, { error: 'conflict', currentVersion: latest });
      return sendJson(res, 200, { version: body.proposedVersion });
    }
    if (rest === '/claude/reject' && method === 'POST') {
      const body = parseWith(proposalBody, await readBody(req));
      const session = claude.get(slug);
      const base = session?.proposedVersion === body.proposedVersion ? session.baseVersion : undefined;
      const saved = rejectProposal(paths, body.proposedVersion, base);
      return sendJson(res, 200, { version: saved.version, edl: saved, notes: saved.notes });
    }
    throw new HttpError(404, `rota não existe: ${method} ${apiBase}${rest}`);
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (!isLoopbackHost(req.headers.host)) return sendJson(res, 403, { error: 'só localhost' });
    if (!isLoopbackOrigin(req.headers.origin as string | undefined)) return sendJson(res, 403, { error: 'origem não permitida' });
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const { pathname } = url;
    const method = req.method ?? 'GET';
    const get = method === 'GET' || method === 'HEAD';
    if (!pathname.startsWith('/api/')) {
      if (!get) return sendJson(res, 405, { error: 'método não permitido' });
      return serveStatic(req, res, pathname);
    }
    if (pathname === '/api/health' && get) return sendJson(res, 200, { ok: true, version: 1 });
    if (pathname === '/api/projects' && get) {
      const projects = listProjects(projectsDir).map((slug) => {
        const paths = projectPaths(slug, projectsDir);
        const versions = listVersions(paths);
        return { slug, analyzed: existsSync(paths.analysis), latest: versions.at(-1) ?? null, versions: versions.length };
      });
      return sendJson(res, 200, { projects });
    }
    if (pathname === '/api/arsenal' && get) return sendJson(res, 200, arsenal(url.searchParams.get('kind'), url.searchParams.get('q') ?? ''));
    const gallery = /^\/api\/gallery\/([^/]+\.png)$/.exec(pathname);
    if (gallery && get) {
      const file = safeJoin(galleryDir, decodeURIComponent(gallery[1]!));
      if (!file || !existsSync(file)) throw new HttpError(404, 'sem miniatura');
      return sendFile(req, res, file, 'image/png');
    }
    const project = /^\/api\/projects\/([^/]+)(\/.*)?$/.exec(pathname);
    if (project) return handleProject(req, res, decodeURIComponent(project[1]!), project[2] ?? '', url);
    throw new HttpError(404, `rota não existe: ${method} ${pathname}`);
  };

  const server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (res.headersSent) return void res.end();
      if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message, ...error.body });
      if (error instanceof CutOpError) return sendJson(res, 422, { error: error.message, opIndex: error.opIndex });
      const message = error instanceof Error ? error.message : String(error);
      // EDL inválida (validateEdl) também é recusa da operação, não falha do servidor
      if (message.startsWith('EDL inválida') || message.includes('não existe')) return sendJson(res, message.includes('não existe') ? 404 : 422, { error: message });
      log(`erro: ${message}`);
      sendJson(res, 500, { error: message });
    });
  });

  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(options.port ?? 0, '127.0.0.1', () => done());
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    server,
    close: async () => {
      for (const job of jobs.values()) if (job.status === 'running') job.spawned?.cancel();
      for (const session of claude.values()) session.controller?.abort();
      await Promise.all([...watchers.values()].map(async (watcher) => (await watcher).close()));
      for (const set of streams.values()) for (const res of set) res.end();
      const closed = new Promise<void>((done) => server.close(() => done()));
      server.closeAllConnections();
      await closed;
    },
  };
}

