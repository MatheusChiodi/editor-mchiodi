import { levelProfile } from '../edl/levels.ts';
import type { Edl, Removal } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';
import type { EvalReport } from '../eval/index.ts';
import { formatChapter, formatClock } from '../lib/time.ts';
import { bumperDurations } from '../render/bumpers.ts';
import { MODELS_PROJECT, modelsOf, type SceneInfo, sceneLinks } from '../scenes/models.ts';
import { SCENE_PREFIX } from '../scenes/sync.ts';

const KIND_LABEL: Record<Removal['kind'], string> = {
  silence: 'pausas',
  retake: 'retakes e recomeços',
  filler: 'hesitações',
  marker: 'marcador "corta"',
  manual: 'decisão do diretor',
};

/** Pausas menores que isso entram só no total, para o relatório não virar uma lista de 300 linhas. */
const LIST_SILENCE_FROM = 1.5;

export interface Chapter {
  at: number;
  title: string;
}

/** Capítulos no tempo do vídeo final. O YouTube exige o primeiro em 0:00, ordem crescente e 10s entre eles. */
export function buildChapters(
  edl: Pick<Edl, 'chapters'>,
  timeline: Timeline,
  /** duração da vinheta de abertura, que desloca todos os capítulos */
  introSec = 0,
): { chapters: Chapter[]; problems: string[] } {
  const problems: string[] = [];
  const chapters = edl.chapters
    .map((chapter) => {
      const at = sourceToOutput(timeline, chapter.at);
      return { title: chapter.title.trim(), at: at === null ? -1 : at + introSec };
    })
    .filter((chapter) => chapter.at >= 0)
    .sort((a, b) => a.at - b.at);
  if (chapters.length === 0) return { chapters, problems };
  // o primeiro capítulo é sempre o começo do vídeo, mesmo que a âncora esteja alguns segundos depois
  chapters[0]!.at = 0;
  chapters.forEach((chapter, index) => {
    const previous = chapters[index - 1];
    if (previous && Math.floor(chapter.at) - Math.floor(previous.at) < 10) {
      problems.push(`"${chapter.title}" começa menos de 10s depois de "${previous.title}"`);
    }
  });
  if (chapters.length < 3) problems.push('menos de 3 capítulos: o YouTube não ativa a divisão');
  return { chapters, problems };
}

export function renderChapters(chapters: Chapter[]): string {
  return chapters.map((chapter) => `${formatChapter(chapter.at)} ${chapter.title}`).join('\n') + (chapters.length ? '\n' : '');
}

export interface ReportInput {
  edl: Edl;
  timeline: Timeline;
  /** todas as versões da EDL, para o histórico */
  history: Pick<Edl, 'version' | 'notes' | 'createdAt'>[];
  /** avaliações na ordem em que rodaram */
  evaluations: EvalReport[];
  renderedFile: string | null;
  /** cenas e modelos lidos do fonte (`loadScenes()`), para a seção "Modelos"; sem isso a seção sai vazia */
  scenes?: SceneInfo[];
}

export interface ReportModels {
  /** modelos que o vídeo usa, direto (`scene:modelos/<Nome>`) ou por uma cena vinculada */
  used: { model: SceneInfo; overlays: string[] }[];
  /** modelos que nasceram deste vídeo (`origin.project`) */
  created: SceneInfo[];
  /** cenas sob medida usadas no vídeo que ainda não têm modelo */
  unmodeled: string[];
}

/** O que o vídeo tirou do acervo de modelos e o que deixou nele. */
export function reportModels(edl: Pick<Edl, 'project' | 'overlays'>, scenes: SceneInfo[]): ReportModels {
  const links = sceneLinks(scenes);
  const models = modelsOf(scenes);
  const used = new Map<string, string[]>();
  const unmodeled = new Set<string>();
  for (const overlay of edl.overlays) {
    if (!overlay.component.startsWith(SCENE_PREFIX)) continue;
    const key = overlay.component.slice(SCENE_PREFIX.length);
    const name = key.startsWith(`${MODELS_PROJECT}/`) ? key.slice(MODELS_PROJECT.length + 1) : links[key];
    if (name) used.set(name, [...(used.get(name) ?? []), overlay.id]);
    else if (name === null) unmodeled.add(key);
  }
  return {
    used: models.filter((model) => used.has(model.name)).map((model) => ({ model, overlays: used.get(model.name)! })),
    created: models.filter((model) => model.origin?.project === edl.project),
    unmodeled: [...unmodeled].sort(),
  };
}

function modelsSection(edl: Edl, scenes: SceneInfo[]): string[] {
  const { used, created, unmodeled } = reportModels(edl, scenes);
  const line = (model: SceneInfo) => `\`scene:${MODELS_PROJECT}/${model.name}\`${model.tags.length ? ` [${model.tags.join(', ')}]` : ''} — ${model.description ?? 'sem descrição'}`;
  const lines = ['', '## Modelos', ''];
  lines.push(used.length ? `Usados neste vídeo (${used.length}):` : 'Nenhum modelo do acervo usado neste vídeo.');
  for (const { model, overlays } of used) lines.push(`- ${line(model)} (${overlays.length}×: ${overlays.map((id) => `\`${id}\``).join(', ')})`);
  lines.push('', created.length ? `Criados por causa deste vídeo (${created.length}), prontos para os próximos:` : 'Nenhum modelo novo nasceu deste vídeo.');
  for (const model of created) lines.push(`- ${line(model)}`);
  if (unmodeled.length) {
    lines.push('', `Cenas sob medida ainda sem modelo (${unmodeled.length}): ${unmodeled.map((key) => `\`${key}\``).join(', ')} → \`pnpm mce scenes audit ${edl.project}\``);
  }
  return lines;
}

function span(start: number, end: number): string {
  return `${formatClock(start)}–${formatClock(end)}`;
}

/** relatorio.md: o que saiu, o que entrou e por quê. Tudo derivado da EDL, nada escrito à mão. */
export function buildReport(input: ReportInput): string {
  const { edl, timeline } = input;
  const { introSec, outroSec } = bumperDurations(edl);
  const finalSec = timeline.durationSec + introSec + outroSec;
  const out = (time: number) => {
    const mapped = sourceToOutput(timeline, time);
    return mapped === null ? null : mapped + introSec;
  };
  const stamp = (time: number) => {
    const mapped = out(time);
    return mapped === null ? '(cortado)' : formatClock(mapped, 1);
  };
  const removedSec = edl.source.durationSec - timeline.durationSec;
  const lines: string[] = [
    `# Relatório de edição — ${edl.project}`,
    '',
    `- EDL v${edl.version} · ${edl.createdAt.slice(0, 10)} · nível de edição ${edl.level} (${levelProfile(edl.level).label})`,
    `- Duração: ${formatClock(edl.source.durationSec, 0)} → **${formatClock(finalSec, 0)}** (${removedSec.toFixed(0)}s removidos, ${((removedSec / edl.source.durationSec) * 100).toFixed(0)}%${introSec + outroSec > 0 ? `; inclui ${(introSec + outroSec).toFixed(1)}s de vinhetas` : ''})`,
    `- ${timeline.clips.length} clipes · ${edl.overlays.length} gráficos · ${edl.zooms.length} zooms · ${edl.transitions.length} transições`,
    ...(input.renderedFile ? [`- Arquivo: \`${input.renderedFile}\``] : []),
    '',
    '## O que foi cortado',
    '',
  ];

  const byKind = new Map<Removal['kind'], { count: number; seconds: number }>();
  for (const removal of edl.removed) {
    const entry = byKind.get(removal.kind) ?? { count: 0, seconds: 0 };
    entry.count += 1;
    entry.seconds += removal.end - removal.start;
    byKind.set(removal.kind, entry);
  }
  if (byKind.size === 0) lines.push('Nada foi removido.');
  for (const [kind, entry] of byKind) lines.push(`- ${KIND_LABEL[kind]}: ${entry.count} trechos, ${entry.seconds.toFixed(1)}s`);

  const listed = edl.removed.filter((removal) => removal.kind !== 'silence' || removal.end - removal.start >= LIST_SILENCE_FROM);
  if (listed.length) {
    lines.push('', '| Trecho da fonte | Duração | Tipo | Motivo |', '|---|---|---|---|');
    for (const removal of listed) {
      lines.push(`| ${span(removal.start, removal.end)} | ${(removal.end - removal.start).toFixed(1)}s | ${KIND_LABEL[removal.kind]} | ${removal.reason || '—'} |`);
    }
  }

  lines.push('', '## O que foi adicionado', '');
  const added: { at: number; text: string }[] = [
    ...edl.overlays.map((overlay) => ({
      at: out(overlay.at) ?? 0,
      text: `**${overlay.component}** \`${overlay.id}\` em ${stamp(overlay.at)} por ${overlay.duration.toFixed(1)}s — ${overlay.reason || 'sem motivo registrado'}`,
    })),
    ...edl.zooms.map((zoom) => ({
      at: out(zoom.at) ?? 0,
      text: `**Zoom** ${zoom.scale.toFixed(2)}× (${zoom.mode}) em ${stamp(zoom.at)} por ${zoom.duration.toFixed(1)}s — ${zoom.reason || 'sem motivo registrado'}`,
    })),
    ...edl.transitions.map((transition) => {
      const clip = timeline.clips.find((item) => item.id === transition.intoClip);
      return {
        at: (clip?.outputStart ?? 0) + introSec,
        text: `**Transição** ${transition.type} em ${formatClock((clip?.outputStart ?? 0) + introSec, 1)} — ${transition.reason || 'sem motivo registrado'}`,
      };
    }),
    ...edl.sfx.map((cue) => ({ at: out(cue.at) ?? 0, text: `**SFX** ${cue.file} em ${stamp(cue.at)}` })),
  ].sort((a, b) => a.at - b.at);
  if (added.length === 0) lines.push('Nenhum gráfico, zoom ou transição nesta versão.');
  for (const item of added) lines.push(`- ${item.text}`);

  lines.push(...modelsSection(edl, input.scenes ?? []));

  lines.push(
    '',
    '## Acabamento',
    '',
    `- Legendas: ${edl.captions.enabled ? `estilo \`${edl.captions.style}\` · \`${edl.captions.preset}\`, até ${edl.captions.maxWordsPerPage} palavras por página` : 'desligadas'}${edl.captions.highlights.length ? `; destaques: ${edl.captions.highlights.join(', ')}` : ''}`,
    `- Cor: preset \`${edl.grade.preset}\`${edl.grade.lut ? ` + LUT ${edl.grade.lut}` : ''}${edl.grade.exposure ? `, exposição ${edl.grade.exposure > 0 ? '+' : ''}${edl.grade.exposure}` : ''}${edl.grade.sharpen ? `, nitidez ${edl.grade.sharpen}` : ''}`,
    `- Áudio: alvo ${edl.audio.targetLufs} LUFS, redução de ruído \`${edl.audio.denoise}\`, de-esser ${edl.audio.deesser ? 'ligado' : 'desligado'}, fade de ${edl.audio.cutFadeMs} ms em cada corte`,
    `- Música: ${edl.music ? `${edl.music.file} a ${edl.music.gainDb} dB${edl.music.duck ? ' com ducking' : ''}` : 'nenhuma'}`,
  );

  if (edl.shorts) {
    lines.push(`- Short: trecho ${span(edl.shorts.start, edl.shorts.end)} da fonte — ${edl.shorts.reason || 'sem motivo registrado'}`);
  }
  for (const breather of edl.breathers) {
    lines.push(`- Respiro declarado: trecho ${span(breather.start, breather.end)} da fonte, sem edição — ${breather.reason}`);
  }

  const { chapters, problems } = buildChapters(edl, timeline, introSec);
  if (chapters.length) {
    lines.push('', '## Capítulos', '', '```', renderChapters(chapters).trimEnd(), '```');
    for (const problem of problems) lines.push(`- atenção: ${problem}`);
  }

  lines.push('', '## Autoavaliação', '');
  if (input.evaluations.length === 0) lines.push('Nenhuma avaliação registrada para este projeto.');
  input.evaluations.forEach((evaluation, index) => {
    const { metrics } = evaluation;
    lines.push(
      `### Volta ${index + 1} — EDL v${evaluation.edlVersion}: ${evaluation.passed ? 'aprovada' : 'reprovada'}`,
      '',
      `${metrics.durationSec.toFixed(1)}s · ${metrics.cuts} cortes · ${metrics.loudnessLufs.toFixed(1)} LUFS · pico ${metrics.truePeakDb.toFixed(1)} dBTP` +
        (metrics.captionOffsetMs === null ? '' : ` · legenda ${metrics.captionOffsetMs >= 0 ? '+' : ''}${metrics.captionOffsetMs} ms`),
      '',
    );
    if (evaluation.findings.length === 0) lines.push('- nenhum problema encontrado');
    for (const finding of evaluation.findings) {
      lines.push(`- ${finding.severity === 'error' ? 'ERRO' : 'aviso'} \`${finding.check}\`: ${finding.message}`);
    }
    if (evaluation.contactSheet) lines.push(`- prancha de contato dos cortes suspeitos: \`${evaluation.contactSheet}\``);
    lines.push('');
  });

  lines.push('## Histórico da EDL', '');
  for (const version of input.history) lines.push(`- v${version.version} (${version.createdAt.slice(0, 16).replace('T', ' ')}): ${version.notes || 'sem notas'}`);
  return `${lines.join('\n')}\n`;
}
