import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';

import { analyze } from '../analyze/index.ts';
import { extractFrame, renderTimelineView, sourceBands, viewPath } from '../analyze/timeline-view.ts';
import type { Analysis, Transcript } from '../analyze/types.ts';
import { diffEdl, draftEdl, edlPath, listVersions, loadEdl, saveNewVersion, validateEdl } from '../edl/store.ts';
import { formatLevels, LEVEL_IDS, type LevelId, levelProfile, parseLevel } from '../edl/levels.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { buildBudget, buildRequired, formatBudget } from '../eval/budget.ts';
import { formatCoverage, levelCoverage } from '../eval/checks.ts';
import { formatBreathers } from '../eval/direction.ts';
import { consoleProgress } from '../lib/ffmpeg.ts';
import { formatClock } from '../lib/time.ts';
import { appendNote, describeStatus, type NoteKind } from '../project/memory.ts';
import { activityFile, appendActivity, withActivity } from '../project/activity.ts';
import { loadAmbient, loadItems } from '../project/dashboard-data.ts';
import { loadConfig } from '../config.ts';
import { run } from '../lib/exec.ts';
import { createVramSampler, deepFilterCheck, doctorLines, queryVram, type ToolCheck, vidstabCheck } from '../project/health.ts';
import { resolveDeepFilterBinary } from '../render/denoise.ts';
import { clearLive, liveFile, type LiveTask, trackProgress, writeLive } from '../project/live.ts';
import { projectPaths, readJson, requireProject, ROOT, slugFromFile, writeJson } from '../project/paths.ts';
import { renderDashboard, shouldColor, watchInterval } from '../project/dashboard.ts';
import { runDashboard } from '../project/dashboard-watch.ts';
import { listProjects } from '../project/pipeline.ts';
import { renderStill } from '../render/overlay.ts';
import { auditScenes, createModel, formatAudit, latestEdlUsage, loadScenes, parseTags } from '../scenes/models.ts';
import { SCENE_PREFIX, sceneCompositionId, sceneKey, syncScenes } from '../scenes/sync.ts';
import { runWatcher, sendToQueue } from '../watcher/index.ts';
import { loadQueue, saveQueue, summarize } from '../watcher/queue.ts';
import { ARSENAL_KINDS, type ArsenalKind, catalog, counts, formatCatalog, search } from '../arsenal/catalog.ts';
import { renderGallery } from '../arsenal/gallery.ts';
import { generateSfx, listAssets } from '../assets/library.ts';
import { collectEvaluations, evaluate, formatReport } from '../eval/index.ts';
import { writeReport } from '../report/write.ts';
import { render, renderDir } from '../render/index.ts';
import { SHORTS_MAX_SEC } from '../render/shorts.ts';
import { applySuggestion, formatSuggestions, suggestShorts } from '../render/shorts-suggest.ts';
import { formatFocusPlan, planShortFocus } from '../render/shorts-focus.ts';
import { manualTrackPath, parseFocusTrackFile } from '../analyze/focus.ts';
import { findTechMentions } from '../tech/detect.ts';
import { hasVidstab } from '../render/stabilize.ts';
import { registerAnalogies } from '../analogy/cli.ts';
import { registerBroll } from '../broll/cli.ts';
import { registerPack } from '../pack/cli.ts';
import { registerRetention } from '../retention/cli.ts';
import { registerTech } from '../tech/cli.ts';
import { bareGroup, userPath } from './invocation.ts';

// O `mce` global roda de qualquer pasta: caminho digitado pelo usuário vale a partir de onde ele está;
// todo o resto (Remotion, ffmpeg, caminhos relativos da EDL) roda na raiz, igual ao `pnpm mce`.
const USER_CWD = process.cwd();
process.chdir(ROOT);
const fromUser = (file: string) => userPath(USER_CWD, file);

const program = new Command('mce').description('MChiodi Editor — ferramentas de edição dirigidas pelo Claude Code');
const log = (message: string) => console.log(message);

/** Roda uma etapa gravando o progresso em live.json, para o `mce progress --watch` acompanhar de outro terminal. */
async function tracked<T>(slug: string, task: LiveTask, work: (onProgress: ReturnType<typeof trackProgress>) => Promise<T>): Promise<T> {
  const paths = projectPaths(slug);
  const file = liveFile(paths);
  const onProgress = trackProgress(file, task, consoleProgress());
  onProgress({ label: 'preparando', percent: 0, etaSec: null });
  try {
    // início, fim (com duração) e falha vão para activity.log: o histórico do painel
    return await withActivity(activityFile(paths), task, () => work(onProgress));
  } finally {
    clearLive(file);
  }
}

program
  .command('analyze <video>')
  .description('Proxy, transcrição por palavra, silêncios, retakes e loudness → analysis/takes.md')
  .option('-p, --project <slug>', 'nome do projeto (padrão: nome do arquivo)')
  .option('-f, --force', 'refaz proxy e transcrição')
  .action(async (video: string, options: { project?: string; force?: boolean }) => {
    const paths = await tracked(options.project ?? slugFromFile(video), 'analysis', (onProgress) =>
      analyze(fromUser(video), { slug: options.project, force: options.force, onProgress, log }),
    );
    log(`projeto: ${paths.slug}`);
  });

program
  .command('draft <project>')
  .description('Cria uma nova versão da EDL só com o corte automático')
  .option('-l, --level <nível>', `nível de edição: ${LEVEL_IDS.join(' | ')} (padrão: edit.level do mce.config.json)`, parseLevel)
  .action((project: string, options: { level?: LevelId }) => {
    const paths = requireProject(project);
    const edl = draftEdl(paths, options.level);
    const timeline = buildTimeline(edl.clips, edl.output.fps);
    log(
      `${edlPath(paths, edl.version)}\n${edl.clips.length} clipes · ${formatClock(edl.source.durationSec)} → ${formatClock(timeline.durationSec)} · ${edl.removed.length} trechos removidos · nível ${edl.level}`,
    );
  });

program
  .command('levels [level]')
  .description('Níveis de edição (limpa, normal, pro, max): sem argumento lista; com o nível, mostra alvos, limites e orientação')
  .action((level?: string) => {
    log(formatLevels(level ? parseLevel(level) : undefined));
  });

program
  .command('level <project> [level]')
  .description('Orçamento do projeto no nível da EDL (quanto já tem × quanto o nível pede); com o nível, grava nova versão da EDL nele')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .action((project: string, level: string | undefined, options: { edl?: number }) => {
    const paths = requireProject(project);
    let current = loadEdl(paths, options.edl);
    if (level && parseLevel(level) !== current.level) {
      const { version: _version, createdAt: _createdAt, ...data } = current;
      current = saveNewVersion(paths, { ...data, level: parseLevel(level), notes: `Nível de edição: ${current.level} → ${parseLevel(level)}.` });
      log(edlPath(paths, current.version));
    }
    const profile = levelProfile(current.level);
    const { durationSec } = buildTimeline(current.clips, current.output.fps);
    log(formatBudget(profile, durationSec, buildBudget(current, durationSec, profile), current.music !== null, buildRequired(current, durationSec, profile)));
    const coverage = levelCoverage(current, buildTimeline(current.clips, current.output.fps), profile);
    if (coverage) log(`
cobertura: ${formatCoverage(coverage, profile)}`);
    const breathers = formatBreathers(current, buildTimeline(current.clips, current.output.fps), coverage, profile.limits);
    if (breathers) log(breathers);
    log(`\n${profile.guidance.map((line) => `- ${line}`).join('\n')}`);
  });

program
  .command('words <project>')
  .description('Palavras com timestamps exatos num intervalo da fonte')
  .requiredOption('--from <s>', 'início em segundos', Number)
  .requiredOption('--to <s>', 'fim em segundos', Number)
  .action((project: string, options: { from: number; to: number }) => {
    const paths = requireProject(project);
    const { words } = readJson<Transcript>(paths.words);
    for (const word of words) {
      if (word.end < options.from || word.start > options.to) continue;
      log(`${word.start.toFixed(3)}\t${word.end.toFixed(3)}\t${word.text}${word.interpolated ? '\t(interpolada)' : ''}`);
    }
  });

program
  .command('view <project>')
  .description('PNG de um trecho da FONTE: frames + forma de onda + palavras + o que a EDL mantém/corta')
  .requiredOption('--from <s>', 'início em segundos', Number)
  .requiredOption('--to <s>', 'fim em segundos', Number)
  .option('-v, --edl <n>', 'versão da EDL para marcar cortes (padrão: a mais recente, se houver)', Number)
  .action(async (project: string, options: { from: number; to: number; edl?: number }) => {
    const paths = requireProject(project);
    const analysis = readJson<Analysis>(paths.analysis);
    const { words } = readJson<Transcript>(paths.words);
    const current = listVersions(paths).length ? loadEdl(paths, options.edl) : null;
    const file = await renderTimelineView({
      title: `${project}${current ? ` · EDL v${current.version}` : ''} · fonte`,
      from: options.from,
      to: options.to,
      video: analysis.proxy,
      audio: paths.audio16k,
      words,
      bands: sourceBands(analysis.silences, current),
      markers: current ? current.clips.flatMap((clip) => [{ at: clip.start, label: `▶ ${clip.id}` }, { at: clip.end, label: '✂' }]) : [],
      output: viewPath(join(paths.analysisDir, 'views'), options.from, options.to),
    });
    log(file);
  });

program
  .command('frame <project>')
  .description('Extrai um frame da fonte em resolução cheia do proxy (para ver enquadramento/tela)')
  .requiredOption('--at <s>', 'instante em segundos', Number)
  .action(async (project: string, options: { at: number }) => {
    const paths = requireProject(project);
    const analysis = readJson<Analysis>(paths.analysis);
    const file = join(paths.analysisDir, 'views', `frame-${options.at.toFixed(2)}.png`);
    await extractFrame(analysis.proxy, options.at, file);
    log(file);
  });

program
  .command('render <project>')
  .description('Executa a EDL: preview rápido (padrão) ou final em alta qualidade')
  .option('--final', 'render final na resolução da EDL, a partir do arquivo original')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .option('--no-overlay', 'sem legendas/gráficos: só cortes e áudio')
  .option('--shorts', 'renderiza o Short vertical (trecho definido em edl.shorts)')
  .action(async (project: string, options: { final?: boolean; edl?: number; overlay: boolean; shorts?: boolean }) => {
    const paths = requireProject(project);
    const task: LiveTask = options.shorts ? 'shorts' : options.final ? 'final' : 'preview';
    const result = await tracked(project, task, (onProgress) =>
      render(paths, loadEdl(paths, options.edl), {
        mode: options.final ? 'final' : 'preview',
        variant: options.shorts ? 'shorts' : 'main',
        skipOverlay: !options.overlay,
        onProgress,
        log,
      }),
    );
    log(`${result.file}\n${formatClock(result.durationSec)} de vídeo em ${formatClock(result.elapsedSec, 0)}`);
  });

const shorts = program.command('shorts').description('Short vertical: escolha do trecho');

shorts
  .command('suggest <project>', { isDefault: true })
  .description('Ranqueia trechos da edição atual para o Short (nota explicada por componentes); o diretor escolhe')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .option('-n, --count <n>', 'quantos candidatos', Number, 3)
  .option('--min <s>', 'duração mínima no Short (s)', Number, 20)
  .option('--max <s>', 'duração máxima no Short (s)', Number, SHORTS_MAX_SEC)
  .option('--apply <n>', 'grava o candidato n como `shorts` numa nova versão da EDL', Number)
  .action((project: string, options: { edl?: number; count: number; min: number; max: number; apply?: number }) => {
    const paths = requireProject(project);
    const current = loadEdl(paths, options.edl);
    const analysis = readJson<Analysis>(paths.analysis);
    const { words } = readJson<Transcript>(paths.words);
    const config = loadConfig();
    const { hookTerms, imperatives, weakOpeners, channelTerms, hookWindowSec } = config.shorts;
    const settings = { count: Math.max(options.count, options.apply ?? 0), minSec: options.min, maxSec: Math.min(options.max, SHORTS_MAX_SEC) };
    const candidates = suggestShorts(
      { words, clips: current.clips, silences: analysis.silences, flags: analysis.flags, tech: findTechMentions(words), focusX: current.shorts?.focusX },
      { ...settings, minSilenceSec: config.cuts.minSilenceSec, hookWindowSec, rules: { terms: hookTerms, imperatives, weakOpeners, channelTerms } },
    );
    const file = join(paths.analysisDir, 'shorts-candidates.json');
    writeJson(file, { project: paths.slug, edlVersion: current.version, createdAt: new Date().toISOString(), options: settings, candidates });
    log(formatSuggestions(candidates));
    log(`\n${file}`);
    if (options.apply === undefined) return;
    const chosen = candidates.find((candidate) => candidate.rank === options.apply);
    if (!chosen) throw new Error(`candidato #${options.apply} não existe (${candidates.length} sugeridos)`);
    const saved = saveNewVersion(paths, applySuggestion(current, chosen));
    log(`aplicado: ${edlPath(paths, saved.version)}`);
  });

shorts
  .command('focus <project>')
  .description('Foco dinâmico do Short: detecta o apresentador (ou lê analysis/focus-track.json) e planeja fixo ou pan suave')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .option('--track <file>', 'importa um track à mão ({ samples: [{ t, x }] }, x = centro do apresentador) para analysis/focus-track.json')
  .option('--redetect', 'refaz a detecção, ignorando o cache')
  .option('--apply', 'grava o plano em `shorts.focusX` numa nova versão da EDL')
  .action(async (project: string, options: { edl?: number; track?: string; redetect?: boolean; apply?: boolean }) => {
    const paths = requireProject(project);
    const current = loadEdl(paths, options.edl);
    if (!current.shorts) throw new Error('A EDL não define `shorts`; escolha o trecho antes (pnpm mce shorts suggest)');
    if (options.track) {
      const samples = parseFocusTrackFile(readJson(fromUser(options.track)));
      writeJson(manualTrackPath(paths.analysisDir), { samples });
      log(`track importado: ${samples.length} amostras → ${manualTrackPath(paths.analysisDir)}`);
    }
    const result = await planShortFocus(paths, current, { force: options.redetect, onProgress: consoleProgress() });
    const file = join(paths.analysisDir, 'shorts-focus.json');
    writeJson(file, { project: paths.slug, edlVersion: current.version, createdAt: new Date().toISOString(), origin: result.origin, plan: result.plan });
    log(formatFocusPlan(result));
    log(`\n${file}`);
    if (!options.apply) return;
    const { version: _version, createdAt: _createdAt, ...data } = current;
    const { plan } = result;
    const before = current.shorts.focusX;
    const saved = saveNewVersion(paths, {
      ...data,
      shorts: { ...current.shorts, focusX: plan.focus },
      notes:
        `Short: foco ${plan.mode === 'fixed' ? `fixo em ${plan.focus as number}` : `em pan (${(plan.focus as unknown[]).length} keyframes)`} pelo mce shorts focus ` +
        `sobre a v${current.version} (variação do apresentador ${plan.spreadPx.toFixed(0)} px, ${result.origin}; antes: ${Array.isArray(before) ? 'keyframes' : before}).`,
    });
    log(`aplicado: ${edlPath(paths, saved.version)}`);
  });

program
  .command('eval <project>')
  .description('Autoavaliação do vídeo RENDERIZADO: cortes, estalos, loudness, sincronia de legenda + imagens para conferir')
  .option('--final', 'avalia o render final (padrão: o preview)')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .option('--no-transcribe', 'pula a retranscrição (mais rápido, sem checagem de sincronia)')
  .option('--views <n>', 'quantas imagens gerar', Number, 8)
  .action(async (project: string, options: { final?: boolean; edl?: number; transcribe: boolean; views: number }) => {
    const paths = requireProject(project);
    const current = loadEdl(paths, options.edl);
    const mode = options.final ? 'final' : 'preview';
    const dir = renderDir(paths, current, mode);
    const file = join(dir, `${mode}.mp4`);
    if (!existsSync(file)) throw new Error(`Render não encontrado: ${file}\nRode: pnpm mce render ${project}${options.final ? ' --final' : ''}`);
    const report = await tracked(project, options.final ? 'evalFinal' : 'eval', (onProgress) =>
      evaluate(paths, current, file, dir, { transcribe: options.transcribe, maxViews: options.views, onProgress }),
    );
    log(formatReport(report));
    if (!report.passed) process.exitCode = 2;
  });

program
  .command('report <project>')
  .description('Gera output/<projeto>/relatorio.md e capitulos.txt a partir da EDL e das avaliações')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .action((project: string, options: { edl?: number }) => {
    const { report, chapters, count, problems } = writeReport(requireProject(project), options.edl);
    log(`${report}
${chapters} (${count} capítulos)`);
    for (const problem of problems) log(`atenção: ${problem}`);
  });

program
  .command('status <project>')
  .description('Em que pé está o projeto e qual o próximo passo (para retomar uma edição)')
  .action((project: string) => {
    const paths = projectPaths(project);
    const evaluations = collectEvaluations(paths.rendersDir);
    const last = evaluations.at(-1);
    log(
      describeStatus({
        slug: project,
        analyzed: existsSync(paths.analysis),
        edlVersions: listVersions(paths),
        renders: existsSync(paths.rendersDir) ? readdirSync(paths.rendersDir).sort() : [],
        lastEval: last
          ? {
              edlVersion: last.edlVersion,
              passed: last.passed,
              errors: last.findings.filter((finding) => finding.severity === 'error').length,
              warnings: last.findings.filter((finding) => finding.severity === 'warning').length,
            }
          : null,
        delivered: existsSync(paths.outputDir) ? readdirSync(paths.outputDir).sort() : [],
        hasMemory: existsSync(paths.memory),
      }),
    );
  });

program
  .command('doctor')
  .description('Confere as ferramentas externas: ffmpeg, ffprobe, deep-filter (denoise neural, opcional), vidstab (estabilização, opcional) e GPU')
  .action(async () => {
    const version = async (name: string): Promise<ToolCheck> => {
      try {
        const { stdout } = await run(name, ['-version']);
        return { name, ok: true, detail: stdout.split(/\r?\n/)[0] ?? '', required: true };
      } catch {
        return { name, ok: false, detail: 'não encontrado no PATH', required: true };
      }
    };
    const vram = await queryVram();
    const checks = [
      await version('ffmpeg'),
      await version('ffprobe'),
      deepFilterCheck(resolveDeepFilterBinary({ env: process.env, configPath: loadConfig().denoise.deepFilterPath, platform: process.platform, exists: existsSync })),
      vidstabCheck(await hasVidstab()),
      { name: 'nvidia-smi', ok: vram !== null, detail: vram ? `VRAM ${vram.usedMb}/${vram.totalMb} MB` : 'sem GPU NVIDIA visível; transcrição em CPU é bem mais lenta', required: false },
    ];
    log(doctorLines(checks).join('\n'));
    if (checks.some((check) => check.required && !check.ok)) process.exitCode = 2;
  });

program
  .command('progress [project]')
  .description('Passo a passo de cada edição: o que já foi feito, o que está rodando agora (com %) e o que falta')
  .option('-w, --watch [segundos]', 'painel ao vivo em tela cheia, sem rolagem (padrão: relê a cada 1s); `?` mostra as teclas, `q` sai')
  .option('--no-bell', 'não toca o sino do terminal quando uma etapa termina')
  .action(async (project: string | undefined, options: { watch?: string | boolean; bell: boolean }) => {
    const color = shouldColor(process.stdout.isTTY, process.env);
    const load = () => loadItems(project);
    if (project && !listProjects().includes(project)) throw new Error(`projeto "${project}" não existe (projetos: ${listProjects().join(', ') || 'nenhum'})`);
    if (!options.watch) {
      const columns = (process.stdout.isTTY && process.stdout.columns) || 100;
      const ambient = loadAmbient(await queryVram());
      log(renderDashboard({ items: load(), now: Date.now(), columns, color, focus: project, ...ambient }).join('\n'));
      return;
    }
    const vram = createVramSampler();
    await runDashboard({ load, ambient: () => loadAmbient(vram.current()), intervalSec: watchInterval(options.watch), focus: project, color, bell: options.bell });
  });

program
  .command('doing <project> <text>')
  .description('O diretor avisa o que está fazendo agora (aparece na etapa "Direção" do mce progress)')
  .option('--percent <n>', 'quanto da direção já foi (0–100)', Number)
  .option('--done', 'limpa o aviso')
  .action((project: string, text: string, options: { percent?: number; done?: boolean }) => {
    const paths = projectPaths(project);
    const file = liveFile(paths);
    if (options.done) return clearLive(file);
    const now = Date.now();
    writeLive(file, { task: 'direction', label: text, percent: options.percent ?? null, etaSec: null, startedAt: now, updatedAt: now });
    appendActivity(activityFile(paths), { at: now, kind: 'note', step: 'direction', text });
  });

program
  .command('note <project> <text>')
  .description('Registra uma nota datada em projects/<projeto>/project.md')
  .option('-k, --kind <tipo>', 'decisao | correcao | pendencia', 'decisao')
  .action((project: string, text: string, options: { kind: string }) => {
    if (!['decisao', 'correcao', 'pendencia'].includes(options.kind)) throw new Error('--kind deve ser decisao, correcao ou pendencia');
    const paths = requireProject(project);
    appendNote(paths.memory, project, options.kind as NoteKind, text);
    log(paths.memory);
  });

program
  .command('arsenal [kind]')
  .description('Catálogo do que já existe pronto: components | models (modelos de animação reutilizáveis) | themes (temas de universo das analogias) | tech (tecnologias com ícone) | entrances | transitions | effects | captions (estilos de legenda)')
  .option('-s, --search <texto>', 'filtra por id, grupo ou descrição (sem categoria: busca em todas)')
  .option('-v, --verbose', 'mostra como usar cada item na EDL (nos modelos, também os slots)')
  .action((kind: string | undefined, options: { search?: string; verbose?: boolean }) => {
    if (!kind && options.search) {
      const sections = ARSENAL_KINDS.map((name) => ({ name, items: search(catalog(name), options.search!) })).filter((section) => section.items.length);
      log(sections.length ? sections.map((section) => `# ${section.name}\n${formatCatalog(section.items, Boolean(options.verbose))}`).join('\n\n') : 'nada encontrado');
      return;
    }
    if (!kind) {
      const totals = counts();
      for (const name of ARSENAL_KINDS) log(`${name.padEnd(12)} ${totals[name]} ${name === 'models' ? 'modelos de animação (crescem a cada vídeo)' : name === 'tech' ? 'tecnologias com ícone (tech:<id>)' : name === 'captions' ? 'estilos de legenda (captions.preset)' : 'modelos'}   → pnpm mce arsenal ${name}`);
      return;
    }
    if (!ARSENAL_KINDS.includes(kind as ArsenalKind)) throw new Error(`categoria desconhecida: ${kind} (use ${ARSENAL_KINDS.join(', ')})`);
    const items = search(catalog(kind as ArsenalKind), options.search ?? '');
    const empty = kind === 'models' ? 'nenhum modelo serve: crie com `pnpm mce scenes new <NomePelaForma> --tags <a,b> --from <slug>` (motion-designer)' : 'nada encontrado';
    log(items.length ? formatCatalog(items, Boolean(options.verbose)) : empty);
  });

program
  .command('watch')
  .description('Observa inbox/ e edita cada vídeo novo sozinho (claude -p), um por vez')
  .option('--once', 'processa a fila atual e sai')
  .action(async (options: { once?: boolean }) => {
    await runWatcher({ log: (message) => log(`[${new Date().toLocaleTimeString('pt-BR')}] ${message}`), once: options.once });
  });

program
  .command('send <video>')
  .description('Manda um vídeo para edição completa: vídeo editado + capa + título + descrição + capítulos, sem supervisão')
  .option('-l, --level <nível>', `nível de edição: ${LEVEL_IDS.join(' | ')} (padrão: edit.level do mce.config.json)`, parseLevel)
  .option('--queue-only', 'só coloca na fila; quem edita é o `mce watch` que estiver rodando')
  .action(async (video: string, options: { level?: LevelId; queueOnly?: boolean }) => {
    const file = fromUser(video);
    if (!existsSync(file)) throw new Error(`arquivo não encontrado: ${file}`);
    const job = sendToQueue(file, options.level ?? null);
    log(job ? `na fila: ${job.slug}${job.level ? ` (nível ${job.level})` : ''}` : 'esse arquivo já está na fila ou não é um vídeo (pnpm mce queue)');
    if (options.queueOnly || !job) return;
    log('acompanhe em outro terminal: pnpm mce progress --watch');
    await runWatcher({ log: (message) => log(`[${new Date().toLocaleTimeString('pt-BR')}] ${message}`), once: true });
  });

program
  .command('queue')
  .description('Mostra a fila do watcher')
  .option('--retry', 'recoloca na fila os jobs que falharam')
  .action((options: { retry?: boolean }) => {
    let queue = loadQueue();
    if (options.retry) {
      queue = queue.map((job) => (job.status === 'failed' ? { ...job, status: 'pending' as const, error: null } : job));
      saveQueue(queue);
    }
    log(summarize(queue));
    for (const job of queue) log(`${job.status.padEnd(8)} ${job.slug}  ${job.error ?? ''}`);
  });

program
  .command('gallery')
  .description('Folhas de contato (mosaicos PNG) dos componentes e cenas, para conferir o arsenal olhando')
  .option('-s, --search <texto>', 'só os componentes que casam com a busca')
  .option('--at <fração>', 'ponto da duração em que o frame é tirado (0–1)', Number, 0.6)
  .action(async (options: { search?: string; at: number }) => {
    const ids = [
      ...search(catalog('components'), options.search ?? '').map((item) => item.id),
      ...(options.search ? [] : syncScenes().map(sceneCompositionId)),
    ];
    const sheets = await renderGallery({ ids, outDir: join(ROOT, 'projects', '.gallery'), at: options.at, log: (id) => process.stderr.write(`${id} `) });
    process.stderr.write('\n');
    log(sheets.join('\n'));
  });

const scenes = program.command('scenes').description('Cenas ilustrativas sob medida (motion/src/scenes/<projeto>/<Nome>.tsx)');

scenes
  .command('sync')
  .description('Regenera o índice das cenas para o bundle do Remotion')
  .action(() => {
    const found = syncScenes();
    log(found.length ? found.map((scene) => `${SCENE_PREFIX}${sceneKey(scene)}  (preview: ${sceneCompositionId(scene)})`).join('\n') : 'nenhuma cena ainda');
  });

scenes
  .command('new <name>')
  .description('Cria o esqueleto de um MODELO reutilizável em motion/src/scenes/modelos/<Nome>.tsx (nome pela forma: PilhaEmDoisGrupos) e roda o sync')
  .option('--tags <a,b>', 'forma da animação, para a busca: lista, comparação, antes-depois, ciclo…')
  .option('--from <slug[/Cena]>', 'vídeo (e cena sob medida) de onde o modelo nasce; vira `origin`')
  .action((name: string, options: { tags?: string; from?: string }) => {
    const created = createModel({ name, tags: parseTags(options.tags), from: options.from, date: new Date().toISOString().slice(0, 10) });
    syncScenes();
    log(
      [
        created.file,
        `EDL: ${SCENE_PREFIX}${sceneKey(created.scene)}  (preview: ${sceneCompositionId(created.scene)})`,
        `origem: ${created.origin.project}${created.origin.scene ? ` (cena ${created.origin.scene})` : ''} · ${created.origin.date}`,
        'próximo: troque o miolo pela animação, deixe TUDO em props, preencha description/tags/slots/sample e teste com dois conjuntos de props',
        ...(created.origin.scene ? [`se a cena ${created.origin.scene} continuar existindo, declare nela: export const MODEL = '${name}';`] : []),
      ].join('\n'),
    );
  });

scenes
  .command('audit [project]')
  .description('Cenas sob medida sem modelo reutilizável e os modelos existentes com o uso nas EDLs mais recentes; código 2 se houver cena sem modelo')
  .action((project: string | undefined) => {
    const audit = auditScenes(loadScenes(), latestEdlUsage(), project);
    log(formatAudit(audit, project));
    if (audit.unlinked.length) process.exitCode = 2;
  });

// imports dinâmicos: o visor (chokidar, servidor) só carrega para quem usa estes comandos
scenes
  .command('watch [project]')
  .description('Visor de cenas: sobe o Remotion Studio (player ao vivo) e abre o Chrome na cena mais recente; cena nova aparece sozinha')
  .option('--port <n>', 'porta do Studio (o índice usa a seguinte); padrão: preview.port da config', Number)
  .option('--no-open', 'não abre o navegador')
  .option('--previews <modo>', 'prévias renderizadas no índice: off | strip (tira de frames) | video (tira + prévia animada)', 'off')
  .option('--force', 'com --previews: renderiza tudo de novo, ignorando o que já está em disco')
  .action(async (project: string | undefined, options: { port?: number; open: boolean; previews: string; force?: boolean }) => {
    if (!['off', 'strip', 'video'].includes(options.previews)) throw new Error('--previews aceita off, strip ou video');
    const [{ runViewer }, { loadConfig }] = await Promise.all([import('../preview/index.ts'), import('../config.ts')]);
    await runViewer(project, {
      port: options.port ?? loadConfig().preview.port,
      open: options.open,
      previews: options.previews as 'off' | 'strip' | 'video',
      force: options.force,
      log,
    });
  });

scenes
  .command('open [project]')
  .description('Abre o Chrome no visor que já está no ar (na cena mais recente do projeto)')
  .action(async (project: string | undefined) => {
    const { openViewer } = await import('../preview/index.ts');
    await openViewer(project, log);
  });

scenes
  .command('stop')
  .description('Encerra o visor (Remotion Studio incluído) e libera a RAM')
  .action(async () => {
    const { stopViewer } = await import('../preview/index.ts');
    await stopViewer(log);
  });

program
  .command('still <composition>')
  .description('Renderiza um frame de uma composição do Studio (componente, cena ou legenda) para conferir o visual')
  .option('--frame <n>', 'frame (30 fps)', Number, 45)
  .option('-o, --output <file>', 'arquivo de saída')
  .action(async (composition: string, options: { frame: number; output?: string }) => {
    syncScenes();
    const output = fromUser(options.output ?? join(ROOT, 'projects', '.stills', `${composition}-${options.frame}.png`));
    await renderStill(composition, options.frame, output);
    log(output);
  });

const assets = program.command('assets').description('Biblioteca local de trilhas, SFX, memes e LUTs');

assets
  .command('init')
  .description('Gera os SFX-base (sintetizados, livres de direitos) em assets/sfx')
  .option('-f, --force', 'recria os que já existem')
  .action(async (options: { force?: boolean }) => {
    const created = await generateSfx(undefined, options.force);
    log(created.length ? `criados: ${created.join(', ')}` : 'nada a criar: os SFX-base já existem');
  });

assets
  .command('list')
  .action(() => {
    for (const kind of ['music', 'sfx', 'memes', 'luts', 'brand'] as const) {
      log(`${kind}: ${listAssets(kind).join(', ') || '(vazio)'}`);
    }
  });

const edl = program.command('edl').description('Versões da EDL');

edl
  .command('list <project>')
  .action((project: string) => {
    const paths = requireProject(project);
    for (const version of listVersions(paths)) {
      const item = loadEdl(paths, version);
      const timeline = buildTimeline(item.clips, item.output.fps);
      log(`v${version}  ${formatClock(timeline.durationSec)}  ${item.level.padEnd(6)} ${item.clips.length} clipes, ${item.overlays.length} overlays  ${item.notes}`);
    }
  });

edl
  .command('validate <file>')
  .description('Valida um arquivo de EDL sem gravar')
  .action((file: string) => {
    const parsed = validateEdl(JSON.parse(readFileSync(fromUser(file), 'utf8')));
    log(`ok: ${parsed.clips.length} clipes, ${parsed.overlays.length} overlays`);
  });

edl
  .command('save <project> <file>')
  .description('Valida o arquivo e grava como próxima versão (edl.vN.json)')
  .action((project: string, file: string) => {
    const paths = requireProject(project);
    const { version: _version, createdAt: _createdAt, ...data } = JSON.parse(readFileSync(fromUser(file), 'utf8'));
    const saved = saveNewVersion(paths, data);
    log(edlPath(paths, saved.version));
  });

edl
  .command('diff <project> <a> <b>')
  .action((project: string, a: string, b: string) => {
    const paths = requireProject(project);
    log(diffEdl(loadEdl(paths, Number(a)), loadEdl(paths, Number(b))).join('\n'));
  });

registerPack(program, log, fromUser);
registerRetention(program, log, fromUser);
registerAnalogies(program, log);
registerTech(program, log);
registerBroll(program, log);

// `mce`, `mce scenes`, `mce edl`... sem subcomando: ajuda no stdout e código 0 (não é erro)
bareGroup(program, process.argv.slice(2))?.help();

program.parseAsync().catch((error: unknown) => {
  console.error(`erro: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
