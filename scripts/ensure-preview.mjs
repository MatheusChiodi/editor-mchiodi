#!/usr/bin/env node
/**
 * Hook UserPromptSubmit (instalado em ~/.claude/settings.json): quando o pedido é criar/editar vídeo, sobe sozinho a prévia
 * ao vivo do mchiodi-editor e avisa a URL ao Claude, que a repassa ao usuário.
 *
 *  - vídeo de música (mp3, clipe, letra): API do plano em 4880 + Vite com recarga instantânea em 5190 (`mce mv preview`)
 *  - edição de vídeo por EDL (corte, legenda, motion, efeito...): MChiodi Cut em 4870 (`mce cut`)
 *
 * Falha em silêncio (exit 0 sem saída): um hook de prompt nunca pode atrapalhar a conversa.
 * `MCE_PREVIEW_DRYRUN=1` só imprime o que faria, sem subir nada.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = join(ROOT, '.preview');
const STATE_FILE = join(STATE_DIR, 'state.json');
const PORTS = { musicApi: 4880, musicUi: 5190, cut: 4870 };
const DRY = process.env.MCE_PREVIEW_DRYRUN === '1';

const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pedido de vídeo = uma palavra do assunto E um verbo de ação. */
export function classify(prompt) {
  const text = plain(prompt);
  const subject = /\b(video|videos|clipe|musica|mp3|motion|legenda|legendas|animacao|animacoes|cena|cenas|render|renderiz\w*|corte|cortes|timeline|efeito|efeitos|transicao|short|shorts|edl|mce)\b/.test(text);
  const action = /\b(cri\w*|ger\w*|faz\w*|fac\w*|edit\w*|mont\w*|renderiz\w*|adicion\w*|ajust\w*|mud\w*|tro[cq]\w*|corte\w*|cort\w*|produz\w*|anim\w*|colo\w*|insir\w*|remov\w*|melhor\w*|refaz\w*|refa\w*|quero|preciso|bota\w*)\b/.test(text);
  if (!subject || !action) return null;
  // conversa de git/configuração que só cita "vídeos" (ex.: gitignore) não é pedido de vídeo
  if (/\b(gitignore|git|github|commit|push|pull request|deploy)\b/.test(text)) return null;
  return /\b(musica|mp3|clipe|letra|lyric|cantor\w*|cancao)\b/.test(text) ? 'music' : 'cut';
}

/** Alguém escuta nesta porta? Vale IPv4 e IPv6: o Vite escuta em `localhost`, que no Windows costuma ser só ::1. */
function listening(port) {
  const probe = (host) =>
    new Promise((done) => {
      const socket = createConnection({ port, host });
      socket.once('connect', () => (socket.destroy(), done(true)));
      socket.once('error', () => done(false));
      socket.setTimeout(500, () => (socket.destroy(), done(false)));
    });
  return Promise.all([probe('127.0.0.1'), probe('::1')]).then((results) => results.some(Boolean));
}

/** Projeto mais recente que tem o arquivo pedido. */
function latestProject(relativeFile) {
  const dir = join(ROOT, 'projects');
  if (!existsSync(dir)) return null;
  const rows = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => ({ slug: entry.name, file: join(dir, entry.name, relativeFile) }))
    .filter((row) => existsSync(row.file))
    .map((row) => ({ slug: row.slug, mtime: statSync(row.file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return rows[0]?.slug ?? null;
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function launch(args, env = {}) {
  const child = spawn(process.execPath, args, { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, ...env } });
  child.unref();
  return child.pid;
}

const tsx = (...rest) => [join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(ROOT, 'src', 'cli', 'index.ts'), ...rest];

function stop(pid) {
  if (!pid) return;
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
}

function openBrowser(url) {
  spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

async function ensureMusic(state, notes, opened) {
  const slug = latestProject(join('analysis', 'music.plan.json'));
  if (!slug) {
    notes.push('Prévia do vídeo de música: ainda não há plano. Depois de `pnpm mce music <arquivo.mp3>` (ou `--plan-only`), a prévia sobe sozinha no próximo pedido; ou rode `pnpm mce mv preview <projeto>`.');
    return;
  }
  const apiUp = await listening(PORTS.musicApi);
  const uiUp = await listening(PORTS.musicUi);
  const sameSlug = state.music?.slug === slug;
  const url = `http://localhost:${PORTS.musicUi}/`;
  if (DRY) return void notes.push(`[dry] música: slug=${slug} api=${apiUp} ui=${uiUp} mesmoProjeto=${sameSlug}`);

  let started = false;
  if (!apiUp || !sameSlug) {
    if (apiUp) stop(state.music?.apiPid);
    state.music = { ...state.music, slug, apiPid: launch(tsx('mv', 'preview', slug, '--no-open', '--port', String(PORTS.musicApi))) };
    started = true;
  }
  if (!uiUp) {
    state.music = { ...state.music, slug, uiPid: launch([join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', 'music-preview/vite.config.ts', '--port', String(PORTS.musicUi), '--strictPort'], { CI: 'true' }) };
    started = true;
  }
  if (started) opened.push(url);
  notes.push(`Prévia ao vivo do vídeo de música (projeto "${slug}"): ${url} — ${started ? 'subindo agora (leva alguns segundos)' : 'já estava no ar'}. Edições nas cenas (\`mce mv set|split|merge\`) e no código aparecem na hora, sem renderizar.`);
}

async function ensureCut(state, notes, opened) {
  const slug = latestProject(join('analysis', 'analysis.json'));
  const up = await listening(PORTS.cut);
  const url = `http://127.0.0.1:${PORTS.cut}/${slug ? `?p=${slug}` : ''}`;
  if (DRY) return void notes.push(`[dry] cut: slug=${slug} up=${up}`);
  let started = false;
  if (!up) {
    state.cut = { pid: launch(tsx('cut', ...(slug ? [slug] : []), '--no-open', '--port', String(PORTS.cut))) };
    started = true;
    opened.push(url);
  }
  notes.push(`Editor ao vivo (MChiodi Cut${slug ? `, projeto "${slug}"` : ''}): ${url} — ${started ? 'subindo agora' : 'já estava no ar'}. Novas versões da EDL aparecem sozinhas.`);
}

async function main() {
  let payload = {};
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  const mode = classify(String(payload.prompt ?? ''));
  if (!mode || !existsSync(join(ROOT, 'src', 'cli', 'index.ts'))) return;

  const state = readState();
  const notes = [];
  const opened = [];
  if (mode === 'music') await ensureMusic(state, notes, opened);
  else await ensureCut(state, notes, opened);
  if (!DRY) {
    writeState(state);
    for (const url of opened) setTimeout(() => openBrowser(url), 4000).unref?.();
    // dá tempo de os processos soltos subirem antes de este sair e abrir o navegador
    if (opened.length) await new Promise((done) => setTimeout(done, 4200));
  }
  if (notes.length === 0) return;
  const context = `PRÉVIA AO VIVO (hook automático): ${notes.join(' ')} Diga a URL ao usuário na primeira resposta e trabalhe de modo que ele acompanhe tudo ao vivo por lá, antes de qualquer render.`;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {});
}
