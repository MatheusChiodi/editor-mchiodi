import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';

import { analyze } from '../analyze/index.ts';
import { extractFrame, renderTimelineView, sourceBands, viewPath } from '../analyze/timeline-view.ts';
import type { Analysis, Transcript } from '../analyze/types.ts';
import { findReverts, formatRevert } from '../edl/decisions.ts';
import { loadGuard } from '../render/guard-io.ts';
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
import { describeOverlays, findPhrase, insertOverlay, removeOverlay } from '../motion/insert.ts';
import { checkStageProps } from '../motion/props-check.ts';
import type { MotifId, MusicPlan } from '../../motion/src/music/types.ts';
import { exportNle, NLE_FORMAT_IDS, type NleFormat } from '../nle/index.ts';
import { render, renderDir } from '../render/index.ts';
import { EXPORT_FITS, EXPORT_FORMATS, type ExportFit, type ExportFormat, planExport } from '../render/formats.ts';
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
  .option('-m, --motion', 'mede movimento do quadro: pausa com a tela se mexendo não é cortada (gravação de tela)')
  .action(async (video: string, options: { project?: string; force?: boolean; motion?: boolean }) => {
    const paths = await tracked(options.project ?? slugFromFile(video), 'analysis', (onProgress) =>
      analyze(fromUser(video), { slug: options.project, force: options.force, motion: options.motion, onProgress, log }),
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
  .command('fit <project>')
  .description('Mostra como o vídeo se ajusta ao recorte de cada gráfico sem palco (o render aplica sozinho); --save grava os zooms fit-* numa nova versão')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .option('--save', 'grava os zooms de ajuste na EDL (nova versão)')
  .action(async (project: string, options: { edl?: number; face?: string; save?: boolean }) => {
    const paths = requireProject(project);
    const current = loadEdl(paths, options.edl);
    const timeline = buildTimeline(current.clips, current.output.fps);
    const guard = await loadGuard(paths, current, timeline);
    log(`rosto: ${guard.origin === 'padrão' ? 'padrão (sem detector)' : guard.origin}`);
    for (const item of guard.items) log(`${item.overlay.padEnd(24)} ${item.component.padEnd(20)} ${item.status.padEnd(14)} ${item.note}`);
    const needs = guard.items.filter((item) => item.status === 'precisa-palco').length;
    if (needs) log(`
${needs} gráfico(s) ainda cobrem o rosto: dê \`presenter\` a eles.`);
    if (options.save) {
      const saved = saveNext(paths, { ...current, zooms: [...current.zooms.filter((zoom) => !zoom.id.startsWith('fit-')), ...guard.zooms], notes: 'Ajuste automático do vídeo ao recorte dos gráficos (zooms fit-*).' });
      log(edlPath(paths, saved.version));
    }
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

program
  .command('export <project>')
  .description('Exporta em 16x9, 9x16 ou 1x1 para celular pelo render da EDL → renders/<projeto>-<formato>.mp4 + .srt ao lado')
  .option('-f, --format <formato>', `formato: ${EXPORT_FORMATS.join(' | ')}`, '16x9')
  .option('--fit <modo>', `9x16/1x1 do vídeo inteiro: ${EXPORT_FITS.join(' | ')} (padrão blur-pad)`)
  .option('--focus <x>', 'center-crop: posição do recorte, 0 = esquerda, 1 = direita', Number)
  .option('--shorts', '9x16 do trecho de edl.shorts pelo render de Short (foco da EDL, gráficos re-diagramados)')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .action(async (project: string, options: { format: string; fit?: string; focus?: number; shorts?: boolean; edl?: number }) => {
    if (!EXPORT_FORMATS.includes(options.format as ExportFormat)) throw new Error(`--format aceita ${EXPORT_FORMATS.join(', ')}`);
    if (options.fit && !EXPORT_FITS.includes(options.fit as ExportFit)) throw new Error(`--fit aceita ${EXPORT_FITS.join(', ')}`);
    const paths = requireProject(project);
    const current = loadEdl(paths, options.edl);
    const plan = planExport(
      current,
      { format: options.format as ExportFormat, fit: options.fit as ExportFit | undefined, focusX: options.focus, scope: options.shorts ? 'shorts' : 'full' },
      paths.rendersDir,
      project,
    );
    const result = await tracked(project, 'final', (onProgress) => render(paths, current, { mode: 'final', export: plan, onProgress, log }));
    log(`${result.file}\n${plan.srt}\n${plan.size.width}x${plan.size.height} · teto ${plan.maxrateK} kb/s · ${formatClock(result.durationSec)} em ${formatClock(result.elapsedSec, 0)}`);
  });

program
  .command('nle <project>')
  .description('Exporta os cortes da EDL para editor visual (Shotcut, Kdenlive, OpenShot...) → renders/nle/<projeto>-v<N>.<ext>')
  .option('-f, --format <formatos>', `um ou mais, separados por vírgula: ${NLE_FORMAT_IDS.join(' | ')} | all`, 'all')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .action((project: string, options: { format: string; edl?: number }) => {
    const wanted = options.format === 'all' ? NLE_FORMAT_IDS : options.format.split(',').map((item) => item.trim());
    const unknown = wanted.filter((item) => !NLE_FORMAT_IDS.includes(item as NleFormat));
    if (unknown.length) throw new Error(`--format aceita ${NLE_FORMAT_IDS.join(', ')} ou all (recebi: ${unknown.join(', ')})`);
    const paths = requireProject(project);
    const files = exportNle(loadEdl(paths, options.edl), wanted as NleFormat[], join(paths.rendersDir, 'nle'));
    for (const { file, opensIn } of files) log(`${file}  → ${opensIn}`);
    log('só os cortes: gráficos, zoom, cor e mixagem ficam no render do mce');
  });

program
  .command('music <audio>')
  .description('Gera um vídeo a partir de uma música (mp3): ouve, acha tempo, batidas e seções, e desenha um vídeo sincronizado. Com --lyrics a letra entra em karaokê; sem, usa o que foi ouvido')
  .option('-p, --project <slug>', 'nome do projeto (padrão: nome do arquivo)')
  .option('-l, --lyrics <arquivo>', 'letra em texto, um verso por linha (marcações [Refrão] são ignoradas)')
  .option('--no-transcribe', 'não transcreve a voz (música instrumental); com --lyrics, a letra é distribuída pelo tempo')
  .option('-s, --size <LxA>', '1920x1080 | 1080x1920 | 1080x1080', '1920x1080')
  .option('--fps <n>', 'quadros por segundo', Number, 30)
  .option('-t, --title <texto>', 'título que aparece no começo')
  .option('--preview', 'metade da resolução (render rápido para conferir)')
  .option('--plan-only', 'só analisa e grava o plano (analysis/music.plan.json), sem renderizar')
  .option('-o, --output <arquivo>', 'arquivo de saída (padrão: output/<projeto>/music.mp4)')
  .action(async (audio: string, options: { project?: string; lyrics?: string; transcribe: boolean; size: string; fps: number; title?: string; preview?: boolean; planOnly?: boolean; output?: string }) => {
    const match = /^(\d{3,4})x(\d{3,4})$/.exec(options.size);
    if (!match) throw new Error('--size aceita LxA, como 1920x1080');
    const { makeMusicVideo } = await import('../music/index.ts');
    const result = await tracked(options.project ?? slugFromFile(audio), 'music', (onProgress) =>
      makeMusicVideo(fromUser(audio), {
        slug: options.project,
        lyricsFile: options.lyrics ? fromUser(options.lyrics) : undefined,
        transcribe: options.transcribe,
        size: { width: Number(match[1]), height: Number(match[2]) },
        fps: options.fps,
        title: options.title,
        preview: options.preview,
        planOnly: options.planOnly,
        output: options.output ? fromUser(options.output) : undefined,
        onProgress,
        log,
      }),
    );
    log(result.file ?? result.planFile);
  });

const mv = program.command('mv').description('Vídeo da música: prévia ao vivo no navegador, edição das cenas e render a partir do plano salvo');
const musicPlanFile = (slug: string) => join(projectPaths(slug).analysisDir, 'music.plan.json');

function loadMusicPlan(slug: string): MusicPlan {
  const file = musicPlanFile(slug);
  if (!existsSync(file)) throw new Error(`Projeto "${slug}" não tem plano de música. Rode: pnpm mce music <arquivo.mp3> --plan-only`);
  return readJson<MusicPlan>(file);
}

mv
  .command('preview <project>')
  .description('Abre a prévia ao vivo: o vídeo toca no navegador, com a música, sem renderizar; recarrega sozinha quando as cenas mudam')
  .option('--port <n>', 'porta (padrão: a primeira livre a partir de 4880)', Number)
  .option('--no-open', 'não abre o navegador')
  .option('--rebuild', 'refaz a página da prévia (pnpm music:build)')
  .action(async (project: string, options: { port?: number; open: boolean; rebuild?: boolean }) => {
    const [{ startMusicPreview }, { findFreePort }, { openInBrowser }] = await Promise.all([import('../music/preview.ts'), import('../preview/studio.ts'), import('../preview/session.ts')]);
    loadMusicPlan(project);
    if (options.rebuild || !existsSync(join(ROOT, 'music-preview', 'dist', 'index.html'))) {
      log('construindo a página da prévia (uma vez)...');
      await run(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'music-preview/vite.config.ts'], { cwd: ROOT });
    }
    const server = await startMusicPreview({ slug: project, port: options.port ?? (await findFreePort(4880)), log });
    log(`prévia ao vivo: ${server.url}`);
    log('edite as cenas com `mce mv set|split|merge`; a tela atualiza sozinha. Encerrar: Ctrl+C');
    if (options.open && !(await openInBrowser(server.url))) log('não consegui abrir o navegador; abra a URL acima');
    await new Promise<void>((done) => process.once('SIGINT', () => void server.close().then(done)));
  });

mv
  .command('scenes <project>')
  .description('Lista as cenas numeradas: tempo, motivo, palavra em destaque e os versos de cada uma')
  .action(async (project: string) => {
    const { describeScenes } = await import('../music/edit.ts');
    const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
    for (const row of describeScenes(loadMusicPlan(project))) {
      log(`#${String(row.n).padEnd(3)} ${clock(row.start)}–${clock(row.end)}  ${row.motif.padEnd(9)} ${row.keyword ? `“${row.keyword}” ` : ''}${row.lyric ? `· ${row.lyric}` : '· instrumental'}`);
    }
  });

mv
  .command('set <project> <n>')
  .description('Troca o motivo da cena n (a prévia atualiza na hora)')
  .requiredOption('-m, --motif <id>', 'motivo da cena (veja `mce mv scenes`; ex.: rain, phone, heart, night)')
  .option('-k, --keyword <texto>', 'palavra em destaque da cena')
  .option('--no-keyword', 'apaga a palavra em destaque')
  .action(async (project: string, n: string, options: { motif: string; keyword?: string | boolean }) => {
    const { setSceneMotif } = await import('../music/edit.ts');
    const keyword = options.keyword === false ? null : typeof options.keyword === 'string' ? options.keyword : undefined;
    writeJson(musicPlanFile(project), setSceneMotif(loadMusicPlan(project), Number(n), options.motif as MotifId, keyword));
    log(`cena ${n} agora é ${options.motif}`);
  });

mv
  .command('split <project> <n>')
  .description('Divide a cena n em um instante (segundos da música)')
  .requiredOption('--at <s>', 'instante da divisão, em segundos da música', Number)
  .action(async (project: string, n: string, options: { at: number }) => {
    const { splitScene } = await import('../music/edit.ts');
    writeJson(musicPlanFile(project), splitScene(loadMusicPlan(project), Number(n), options.at));
    log(`cena ${n} dividida em ${options.at}s`);
  });

mv
  .command('merge <project> <n>')
  .description('Junta a cena n com a seguinte (vale o motivo da n)')
  .action(async (project: string, n: string) => {
    const { mergeScenes } = await import('../music/edit.ts');
    writeJson(musicPlanFile(project), mergeScenes(loadMusicPlan(project), Number(n)));
    log(`cenas ${n} e ${Number(n) + 1} juntas`);
  });

mv
  .command('render <project>')
  .description('Renderiza o vídeo a partir do plano salvo (com as suas edições), sem reanalisar a música')
  .option('--preview', 'metade da resolução')
  .option('-o, --output <arquivo>', 'arquivo de saída (padrão: output/<projeto>/music.mp4)')
  .action(async (project: string, options: { preview?: boolean; output?: string }) => {
    const { renderMusicVideo } = await import('../music/render.ts');
    const paths = projectPaths(project);
    const plan = loadMusicPlan(project);
    const meta = readJson<{ audio: string }>(join(paths.analysisDir, 'music.json'));
    if (!existsSync(meta.audio)) throw new Error(`Áudio original não encontrado: ${meta.audio}`);
    const output = options.output ? fromUser(options.output) : join(paths.outputDir, options.preview ? 'music-preview.mp4' : 'music.mp4');
    await tracked(project, 'music', (onProgress) =>
      renderMusicVideo(plan, meta.audio, output, { workDir: paths.rendersDir, scale: options.preview ? 0.5 : 1, concurrency: loadConfig().render.remotionConcurrency, onProgress }),
    );
    log(output);
  });

const motionCmd = program.command('motion').description('Motion graphics no meio do vídeo: explicações, animações e efeitos ancorados no tempo ou na fala');

/** Grava a EDL alterada como a próxima versão (nunca sobrescreve). */
function saveNext(paths: ReturnType<typeof requireProject>, next: ReturnType<typeof loadEdl>) {
  const { version: _version, createdAt: _createdAt, ...rest } = next;
  return saveNewVersion(paths, rest);
}

motionCmd
  .command('add <project>')
  .description('Insere um gráfico/animação no meio do vídeo (nova versão da EDL). Ancore em --at (segundos da fonte) ou --say (frase falada)')
  .requiredOption('-c, --component <nome>', 'componente (pnpm mce arsenal components) ou scene:<projeto>/<Nome>')
  .option('--at <s>', 'instante em segundos da FONTE', Number)
  .option('--say <frase>', 'ancora no início desta frase falada (transcrição)')
  .option('--nth <n>', 'qual ocorrência da frase, com --say (1 = a primeira)', Number, 1)
  .option('--offset <s>', 'deslocamento sobre a âncora; negativo entra antes da fala', Number, 0)
  .option('-d, --duration <s>', 'duração; padrão: a do componente', Number)
  .option('-p, --props <json>', 'props em JSON, ou @arquivo.json')
  .option('--sample', 'usa as props de exemplo do componente (para testar o visual)')
  .requiredOption('-r, --reason <texto>', 'o que o gráfico reforça na fala (obrigatório)')
  .option('--hide-captions', 'esconde a legenda enquanto o gráfico ocupa a faixa inferior')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .action(
    async (
      project: string,
      options: { component: string; at?: number; say?: string; nth: number; offset: number; duration?: number; props?: string; sample?: boolean; reason: string; hideCaptions?: boolean; edl?: number },
    ) => {
      if ((options.at === undefined) === (options.say === undefined)) throw new Error('Informe exatamente um: --at <s> ou --say "<frase>"');
      const paths = requireProject(project);
      const current = loadEdl(paths, options.edl);
      const { registry } = await import('../../motion/src/components/registry.ts');

      let anchor = options.at ?? 0;
      if (options.say !== undefined) {
        const matches = findPhrase(readJson<Transcript>(paths.words).words, options.say);
        if (matches.length === 0) throw new Error(`Frase não encontrada na transcrição: "${options.say}"`);
        const chosen = matches[options.nth - 1];
        if (!chosen) throw new Error(`A frase aparece ${matches.length}x; --nth ${options.nth} não existe`);
        if (matches.length > 1 && options.nth === 1) log(`aviso: a frase aparece ${matches.length}x (${matches.map((m) => `${m.start.toFixed(1)}s`).join(', ')}); usando a primeira. Escolha com --nth`);
        anchor = chosen.start;
      }
      const at = Math.max(0, Math.round((anchor + options.offset) * 1000) / 1000);

      const entry = (registry as Record<string, { defaultDuration: number; sample: Record<string, unknown> } | undefined>)[options.component];
      let props: Record<string, unknown> | undefined;
      if (options.props) {
        const raw = options.props.startsWith('@') ? readFileSync(fromUser(options.props.slice(1)), 'utf8') : options.props;
        props = JSON.parse(raw) as Record<string, unknown>;
      } else if (options.sample) {
        props = entry?.sample;
      }

      for (const issue of checkStageProps(options.component, props, options.duration ?? entry?.defaultDuration ?? 3)) log(`aviso: ${issue}`);
      const next = insertOverlay(
        current,
        { component: options.component, at, duration: options.duration ?? entry?.defaultDuration ?? 3, props, reason: options.reason, hidesCaptions: options.hideCaptions },
        new Set(Object.keys(registry)),
      );
      const saved = saveNext(paths, next);
      const row = describeOverlays(saved, buildTimeline(saved.clips, saved.output.fps)).find((item) => item.source === at && item.component === options.component);
      log(`${row?.id ?? options.component} em ${at}s da fonte (${row?.output?.toFixed(2) ?? '?'}s no vídeo final), ${row?.duration ?? options.duration}s → EDL v${saved.version}`);
      log(`próximo passo: pnpm mce render ${project}`);
    },
  );

motionCmd
  .command('still <component>')
  .description('Renderiza um frame do componente sobre fundo cinza para conferir o visual antes de inserir no vídeo')
  .option('-p, --props <json>', 'props em JSON, ou @arquivo.json (padrão: as de exemplo do componente)')
  .option('--frame <n>', 'frame (30 fps)', Number)
  .option('-o, --output <file>', 'arquivo de saída (png)')
  .action(async (component: string, options: { props?: string; frame?: number; output?: string }) => {
    const { registry } = await import('../../motion/src/components/registry.ts');
    const entry = (registry as Record<string, { defaultDuration: number; sample: Record<string, unknown> } | undefined>)[component];
    if (!entry) throw new Error(`Componente "${component}" não existe. Veja: pnpm mce arsenal components`);
    const raw = options.props?.startsWith('@') ? readFileSync(fromUser(options.props.slice(1)), 'utf8') : options.props;
    const props = raw ? (JSON.parse(raw) as Record<string, unknown>) : entry.sample;
    const fps = 30;
    const total = Math.round(entry.defaultDuration * fps);
    const frame = options.frame ?? Math.round(total * 0.6);
    const alpha = join(ROOT, 'projects', '.stills', `motion-${component}-alpha.png`);
    const output = fromUser(options.output ?? join(ROOT, 'projects', '.stills', `motion-${component}-${frame}.png`));
    syncScenes();
    await renderStill('Overlay', frame, alpha, {
      fps,
      width: 1920,
      height: 1080,
      durationInFrames: total,
      captions: [],
      captionStyle: 'long',
      overlays: [{ id: 'preview', component, from: 0, durationInFrames: total, props, hidesCaptions: false }],
    });
    // a camada de gráficos tem alfa: sobre cinza dá para enxergar o que o componente pinta
    await run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x3a4150:s=1920x1080', '-i', alpha, '-filter_complex', '[0][1]overlay', '-frames:v', '1', output]);
    log(output);
  });

motionCmd
  .command('list <project>')
  .description('Lista os gráficos da EDL com o tempo na fonte e no vídeo final')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .action((project: string, options: { edl?: number }) => {
    const edl = loadEdl(requireProject(project), options.edl);
    const rows = describeOverlays(edl, buildTimeline(edl.clips, edl.output.fps));
    if (!rows.length) return log('nenhum gráfico nesta EDL');
    for (const row of rows) log(`${row.id.padEnd(22)} ${row.component.padEnd(20)} fonte ${row.source.toFixed(2)}s · vídeo ${row.output?.toFixed(2) ?? '—'}s · ${row.duration}s  ${row.reason}`);
  });

motionCmd
  .command('remove <project> <id>')
  .description('Remove um gráfico pelo id (nova versão da EDL)')
  .option('-v, --edl <n>', 'versão da EDL (padrão: a mais recente)', Number)
  .action((project: string, id: string, options: { edl?: number }) => {
    const paths = requireProject(project);
    const saved = saveNext(paths, removeOverlay(loadEdl(paths, options.edl), id));
    log(`${id} removido → EDL v${saved.version}`);
  });

program
  .command('cut [project]')
  .description('MChiodi Cut: editor visual local sobre a EDL (servidor em 127.0.0.1 + UI de cut/dist); sem projeto, lista os projetos')
  .option('--port <n>', 'porta (padrão: a primeira livre a partir de 4870)', Number)
  .option('--no-open', 'não abre o navegador')
  .action(async (project: string | undefined, options: { port?: number; open: boolean }) => {
    const [{ startCutServer }, { findFreePort }, { openInBrowser }] = await Promise.all([
      import('../cut/server.ts'),
      import('../preview/studio.ts'),
      import('../preview/session.ts'),
    ]);
    if (project) requireProject(project);
    else log(`projetos: ${listProjects().join(', ') || '(nenhum)'}`);
    const server = await startCutServer({ port: options.port ?? (await findFreePort(4870)), log });
    const hasUi = existsSync(join(ROOT, 'cut', 'dist', 'index.html'));
    const url = `${server.url}/${project ? `?p=${project}` : ''}`;
    log(hasUi ? `MChiodi Cut: ${url}` : `API do MChiodi Cut: ${server.url}/api (a UI ainda não foi construída em cut/dist)`);
    log('encerrar: Ctrl+C');
    if (hasUi && options.open && !(await openInBrowser(url))) log('não consegui abrir o navegador; abra a URL acima');
    await new Promise<void>((done) => process.once('SIGINT', () => void server.close().then(done)));
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
    const history = listVersions(paths).map((version) => loadEdl(paths, version));
    const saved = saveNewVersion(paths, data);
    log(edlPath(paths, saved.version));
    // aviso, não bloqueio: o Matheus pode ter pedido a reversão; quem decide é ele, e as notes devem dizer isso
    for (const revert of findReverts(history, saved)) console.warn(`aviso: ${formatRevert(revert)}`);
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
