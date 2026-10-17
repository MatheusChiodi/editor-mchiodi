import type { Analogy } from '../analogy/detect.ts';
import { findUnthemedAnalogies } from '../analogy/lint.ts';
import { normalizeToken } from '../analyze/speech.ts';
import { effects } from '../arsenal/effects.ts';
import { transitions as transitionPresets } from '../arsenal/transitions.ts';
import type { Span } from '../analyze/types.ts';
import { type LevelProfile, levelProfile } from '../edl/levels.ts';
import type { Edl } from '../edl/schema.ts';
import { cutPoints, sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { formatClock } from '../lib/time.ts';
import { placeBroll } from '../render/layout.ts';
import { MODELS_PROJECT, type SceneLinks } from '../scenes/models.ts';
import { SCENE_PREFIX } from '../scenes/sync.ts';
import { buildBudget, buildRequired, judgeBudget, judgeRequired, SCENE_COMPONENT } from './budget.ts';
import { captionClash, findOffSync, findShortReads, findStackedBreathers, findStalls, namedCues } from './direction.ts';

export type Severity = 'error' | 'warning';

export interface Finding {
  severity: Severity;
  check: string;
  /** instante no vídeo FINAL, quando o problema é localizado */
  at: number | null;
  message: string;
  /** o que mudar na EDL */
  fix: string;
}

export interface TimedWord extends Span {
  text: string;
}

const EDGE_TOLERANCE = 0.02;

/** Palavra atravessada por uma borda de clipe = corte no meio de palavra. Vale antes mesmo do render. */
export function findCutWords(edl: Pick<Edl, 'clips'>, words: TimedWord[], timeline: Timeline): Finding[] {
  const findings: Finding[] = [];
  const placed = new Map(timeline.clips.map((clip) => [clip.id, clip]));
  for (const clip of edl.clips) {
    const position = placed.get(clip.id);
    if (!position) continue;
    for (const [edge, label] of [[position.sourceStart, 'início'], [position.sourceEnd, 'fim']] as const) {
      const word = words.find((item) => item.start + EDGE_TOLERANCE < edge && item.end - EDGE_TOLERANCE > edge);
      if (!word) continue;
      findings.push({
        severity: 'error',
        check: 'corte-em-palavra',
        at: label === 'início' ? position.outputStart : position.outputEnd,
        message: `o ${label} do clipe ${clip.id} (${edge.toFixed(3)}s da fonte) cai dentro da palavra "${word.text}" (${word.start.toFixed(3)}–${word.end.toFixed(3)}s)`,
        fix:
          label === 'início'
            ? `mova clips[${clip.id}].start para antes de ${word.start.toFixed(3)} ou depois de ${word.end.toFixed(3)}`
            : `mova clips[${clip.id}].end para depois de ${word.end.toFixed(3)} ou antes de ${word.start.toFixed(3)}`,
      });
    }
  }
  return findings;
}

/**
 * Instantes (s, relativos ao início do overlay) em que algo novo aparece dentro dele: itens revelados,
 * pílulas, linhas, marca-texto. É o que faz um overlay de 10s não contar como 10s de tela parada.
 */
export function overlayCues(props: Record<string, unknown>): number[] {
  // `namedCues` devolve os mesmos instantes com a prop de origem (para a checagem de sincronia)
  return namedCues(props).map((cue) => cue.at);
}

/** Tudo que muda a tela, em segundos do vídeo final: entradas e saídas de overlay, itens internos, zooms, efeitos curtos e transições. */
export function visualEvents(edl: Pick<Edl, 'overlays' | 'zooms' | 'effects' | 'transitions'> & Partial<Pick<Edl, 'broll'>>, timeline: Timeline): number[] {
  const out = (time: number) => sourceToOutput(timeline, time);
  const events: number[] = [];
  for (const overlay of edl.overlays) {
    const start = out(overlay.at);
    if (start === null) continue;
    events.push(start, start + overlay.duration, ...overlayCues(overlay.props).filter((cue) => cue < overlay.duration).map((cue) => start + cue));
  }
  // b-roll troca o quadro inteiro: entrada e saída contam como algo novo
  for (const item of placeBroll(edl.broll ?? [], timeline)) events.push(item.start, item.end);
  for (const zoom of edl.zooms) {
    const start = out(zoom.at);
    if (start !== null) events.push(start);
  }
  for (const effect of edl.effects) {
    const start = out(effect.at);
    // look, grão e vinheta de vídeo inteiro não são "algo novo"
    if (start !== null && (effect.duration !== undefined || effects[effect.preset]?.defaultDuration !== null)) events.push(start);
  }
  for (const transition of edl.transitions) {
    const clip = timeline.clips.find((item) => item.id === transition.intoClip);
    if (clip) events.push(clip.outputStart);
  }
  return events.filter((time) => time >= 0 && time <= timeline.durationSec).sort((a, b) => a - b);
}

/** Intervalos do vídeo final maiores que `maxIdleSec` sem nenhum evento visual. */
export function idleGaps(events: number[], durationSec: number, maxIdleSec: number): { from: number; to: number }[] {
  const marks = [0, ...events, durationSec];
  const gaps: { from: number; to: number }[] = [];
  for (let index = 1; index < marks.length; index += 1) {
    if (marks[index]! - marks[index - 1]! > maxIdleSec + 0.05) gaps.push({ from: marks[index - 1]!, to: marks[index]! });
  }
  return gaps;
}

export interface Coverage {
  /** fatia do vídeo fora dos trechos sem edição (0–1) */
  share: number;
  /** trechos com mais de `maxIdleSec` sem nada novo, no tempo do vídeo final */
  plain: { from: number; to: number }[];
  plainSec: number;
}

/** Quanto do vídeo está editado: tudo o que não cai num intervalo longo demais sem evento visual. */
export function editedCoverage(events: number[], durationSec: number, maxIdleSec: number): Coverage {
  const plain = idleGaps(events, durationSec, maxIdleSec);
  const plainSec = plain.reduce((sum, gap) => sum + (gap.to - gap.from), 0);
  return { share: durationSec > 0 ? 1 - plainSec / durationSec : 1, plain, plainSec };
}

/** Cobertura da EDL no nível dela, ou null quando o nível não cobra (para o lint e para `mce level`). */
export function levelCoverage(edl: Pick<Edl, 'overlays' | 'zooms' | 'effects' | 'transitions'>, timeline: Timeline, profile: LevelProfile): Coverage | null {
  if (profile.limits.maxIdleSec === null) return null;
  return editedCoverage(visualEvents(edl, timeline), timeline.durationSec, profile.limits.maxIdleSec);
}

/** "62% editado (mínimo 80%) · 4 trechos sem edição somando 02:28, o maior com 51s" */
export function formatCoverage(coverage: Coverage, profile: LevelProfile): string {
  const min = profile.limits.minEditedShare;
  const longest = Math.max(0, ...coverage.plain.map((gap) => gap.to - gap.from));
  const head = `${Math.round(coverage.share * 100)}% do vídeo editado${min === null ? '' : ` (mínimo ${Math.round(min * 100)}%)`}`;
  if (coverage.plain.length === 0) return `${head} · nenhum trecho sem edição`;
  return `${head} · ${coverage.plain.length} trecho${coverage.plain.length > 1 ? 's' : ''} sem edição somando ${formatClock(coverage.plainSec, 0)}, o maior com ${longest.toFixed(0)}s`;
}

/**
 * Toda animação nova nasce com um modelo reutilizável: overlay que usa uma cena sob medida (`scene:<slug>/<Nome>`,
 * slug ≠ `modelos`) sem modelo vinculado vira aviso. `links` vem de `loadSceneLinks()`; cena que não está nele
 * (arquivo inexistente) é problema de outra checagem.
 */
export function findUnmodeledScenes(edl: Pick<Edl, 'overlays'>, timeline: Timeline, links: SceneLinks): Finding[] {
  return edl.overlays.flatMap((overlay): Finding[] => {
    if (!overlay.component.startsWith(SCENE_PREFIX)) return [];
    const key = overlay.component.slice(SCENE_PREFIX.length);
    if (key.startsWith(`${MODELS_PROJECT}/`) || links[key] !== null) return [];
    return [
      {
        severity: 'warning',
        check: 'cena-sem-modelo',
        at: sourceToOutput(timeline, overlay.at) ?? 0,
        message: `overlay "${overlay.id}" usa a cena sob medida ${overlay.component}, que não tem modelo reutilizável`,
        fix: `crie o modelo com \`pnpm mce scenes new <NomePelaForma> --from ${key}\` e use \`scene:modelos/<Nome>\` (se o modelo já existe, declare \`export const MODEL = '<Nome>'\` na cena)`,
      },
    ];
  });
}

/**
 * Confere a EDL contra o nível de edição dela (STYLE.md §0): distância entre zooms, gráficos, cenas e
 * transições, sobreposição, picotado, e se o total de cada coisa está dentro do que o nível pede.
 * Com `sceneLinks`, cobra também o modelo de cada cena sob medida (`cena-sem-modelo`); com `words` (a transcrição,
 * no tempo da fonte), a sincronia de cada entrada com a fala (`fora-de-sincronia`).
 * Com `analogies` (de `findAnalogies`), o tema do universo em cada analogia de confiança alta (`analogia-sem-tema`).
 */
export function lintStyle(
  edl: Edl,
  timeline: Timeline,
  profile: LevelProfile = levelProfile(edl.level),
  sceneLinks?: SceneLinks,
  words?: readonly TimedWord[],
  analogies?: readonly Analogy[],
): Finding[] {
  const { limits } = profile;
  const findings: Finding[] = [];
  if (sceneLinks) findings.push(...findUnmodeledScenes(edl, timeline, sceneLinks));
  // analogia de universo é marca do canal: do nível normal para cima, o trecho tem de vestir o tema (STYLE.md §5)
  if (analogies && profile.id !== 'limpa') findings.push(...findUnthemedAnalogies(edl, timeline, analogies));
  const out = (time: number) => sourceToOutput(timeline, time) ?? 0;
  const warn = (check: string, at: number, message: string, fix: string) =>
    findings.push({ severity: 'warning', check, at, message, fix });

  // efeito de câmera (punch-in, push, tremor) é zoom para o espectador: conta no mesmo limite
  const cameraEffects = edl.effects.filter((effect) => effects[effect.preset]?.category === 'camera');
  const zooms = [...edl.zooms, ...cameraEffects].map((zoom) => ({ ...zoom, out: out(zoom.at) })).sort((a, b) => a.out - b.out);
  zooms.forEach((zoom, index) => {
    const previous = zooms[index - 1];
    if (previous && zoom.out - previous.out < limits.zoomMinGapSec) {
      warn('zoom-frequente', zoom.out, `zoom "${zoom.id}" vem ${(zoom.out - previous.out).toFixed(1)}s depois de "${previous.id}" (mínimo ${limits.zoomMinGapSec}s)`, `remova "${zoom.id}" ou "${previous.id}"`);
    }
  });

  const overlays = edl.overlays
    .map((overlay) => ({ ...overlay, out: out(overlay.at) }))
    .sort((a, b) => a.out - b.out);
  overlays.forEach((overlay, index) => {
    // camada fixa (`layer: "persistent"`, o indicador de progresso) convive com o gráfico da vez: não conta como sobreposição
    const previous = overlay.layer === 'persistent' ? undefined : overlays.slice(0, index).reverse().find((item) => item.layer !== 'persistent');
    if (previous && overlay.out < previous.out + previous.duration - 0.05) {
      warn('graficos-sobrepostos', overlay.out, `"${overlay.id}" entra enquanto "${previous.id}" ainda está na tela`, `encurte "${previous.id}" ou atrase "${overlay.id}"`);
    }
    if (overlay.duration < limits.overlayMinReadSec) {
      warn('grafico-curto', overlay.out, `"${overlay.id}" fica só ${overlay.duration.toFixed(1)}s na tela`, `aumente a duração para pelo menos ${limits.overlayMinReadSec}s`);
    }
    if (overlay.out + overlay.duration > timeline.durationSec + 0.05) {
      warn('grafico-cortado', overlay.out, `"${overlay.id}" passa do fim do vídeo`, 'adiante ou encurte o overlay');
    }
    if (!overlay.reason.trim()) {
      warn('sem-motivo', overlay.out, `overlay "${overlay.id}" não tem "reason"`, 'explique o que ele reforça ou remova');
    }
  });

  const spaced = [
    ['grafico-frequente', 'gráfico', overlays.filter((overlay) => !SCENE_COMPONENT.test(overlay.component)), limits.graphicMinGapSec],
    ['cena-frequente', 'cena', overlays.filter((overlay) => SCENE_COMPONENT.test(overlay.component)), limits.sceneMinGapSec],
  ] as const;
  for (const [check, noun, items, minGap] of spaced) {
    items.forEach((item, index) => {
      const previous = items[index - 1];
      if (previous && item.out - previous.out < minGap) {
        warn(check, item.out, `${noun} "${item.id}" entra ${(item.out - previous.out).toFixed(1)}s depois de "${previous.id}" (mínimo ${minGap}s no nível ${profile.id})`, `fique com o que mais ajuda, afaste os dois ou suba o nível da EDL`);
      }
    });
  }

  for (const item of [...edl.zooms, ...edl.effects, ...edl.transitions]) {
    if (!item.reason.trim()) warn('sem-motivo', 0, `"${item.id}" não tem "reason"`, 'explique o que ele reforça ou remova');
  }

  const memes = overlays.filter((overlay) => overlay.component === 'MemeInsert');
  memes.forEach((meme, index) => {
    const previous = memes[index - 1];
    if (previous && meme.out - previous.out < limits.memeMinGapSec) {
      warn('meme-frequente', meme.out, `meme "${meme.id}" ${(meme.out - previous.out).toFixed(0)}s depois do anterior (mínimo ${limits.memeMinGapSec}s)`, 'fique com o melhor dos dois');
    }
  });

  const transitions = edl.transitions
    .map((transition) => ({ ...transition, out: timeline.clips.find((clip) => clip.id === transition.intoClip)?.outputStart ?? 0 }))
    .sort((a, b) => a.out - b.out);
  transitions.forEach((transition, index) => {
    const previous = transitions[index - 1];
    if (previous && transition.out - previous.out < limits.transitionMinGapSec) {
      warn('transicao-frequente', transition.out, `transição "${transition.id}" ${(transition.out - previous.out).toFixed(1)}s depois da anterior`, 'use corte seco em uma delas');
    }
  });

  const kinds = new Set(edl.transitions.map((transition) => transition.type));
  if (kinds.size > limits.transitionKindsMax) {
    warn('transicao-variada', 0, `${kinds.size} transições diferentes (máximo ${limits.transitionKindsMax} no nível ${profile.id})`, 'repita as que já usou em vez de estrear outra');
  }
  const intense = edl.transitions.filter((transition) => transitionPresets[transition.type]?.energy === 'high');
  if (intense.length > limits.highEnergyTransitionsMax) {
    warn('transicao-intensa', 0, `${intense.length} transições de energia alta (máximo ${limits.highEnergyTransitionsMax} no nível ${profile.id})`, 'troque as excedentes por uma `calm` ou `medium`');
  }

  findings.push(...judgeBudget(buildBudget(edl, timeline.durationSec, profile), profile, edl.music !== null));
  findings.push(...judgeRequired(buildRequired(edl, timeline.durationSec, profile), profile));

  // no trecho editado nada fica parado; fora dele são os respiros (apresentador sozinho, tela crua), com teto de duração e de fatia do vídeo
  const coverage = levelCoverage(edl, timeline, profile);
  if (coverage) {
    const longest = [...coverage.plain].sort((a, b) => b.to - b.from - (a.to - a.from));
    if (limits.minEditedShare !== null && coverage.share < limits.minEditedShare - 1e-9) {
      const need = coverage.plainSec - (1 - limits.minEditedShare) * timeline.durationSec;
      findings.push({
        severity: 'warning',
        check: 'pouco-editado',
        at: longest[0]?.from ?? 0,
        message: `${formatCoverage(coverage, profile)}; maiores: ${longest.slice(0, 3).map((gap) => `${formatClock(gap.from, 0)}–${formatClock(gap.to, 0)}`).join(', ')}`,
        fix: `edite mais ${need.toFixed(0)}s, começando pelos maiores trechos: palco (SplitExplainer/WindowStage com presenter), PillStack, cena ilustrativa ou zoom na tela gravada`,
      });
    }
    for (const gap of coverage.plain) {
      if (limits.maxPlainSec !== null && gap.to - gap.from <= limits.maxPlainSec + 0.05) continue;
      warn(
        'tela-parada',
        gap.from,
        `${(gap.to - gap.from).toFixed(1)}s sem nada novo na tela a partir de ${formatClock(gap.from)} (${limits.maxPlainSec === null ? `máximo ${limits.maxIdleSec}s` : `um trecho sem edição pode ter até ${limits.maxPlainSec}s`} no nível ${profile.id})`,
        'acrescente uma pílula (PillStack), um item revelado, um zoom ou troque de layout nesse intervalo',
      );
    }
    // dentro do teto, o trecho sem edição só passa calado se for respiro declarado, e dois deles não se colam
    findings.push(...findStalls(coverage, timeline, edl.breathers, limits, profile.id));
    findings.push(...findStackedBreathers(coverage, limits.minBetweenPlainSec, profile.id));
  }

  if (limits.syncWindowSec && words) findings.push(...findOffSync(edl, timeline, words, limits.syncWindowSec));
  if (limits.itemMinRead) findings.push(...findShortReads(edl, timeline));

  // palco, janela ou cena de tela cheia com legenda por cima: o texto do layout e a legenda brigam pela base do quadro
  for (const overlay of overlays) {
    const stage = overlay.hidesCaptions ? null : captionClash(overlay);
    if (stage) warn('legenda-sobre-palco', overlay.out, `"${overlay.id}" é ${stage} e não esconde as legendas`, 'defina "hidesCaptions": true nesse overlay');
  }

  // 3+ clipes curtos seguidos: soa picotado
  let streak = 0;
  for (const clip of timeline.clips) {
    streak = clip.outputEnd - clip.outputStart < limits.minClipSec * 2 ? streak + 1 : 0;
    if (streak === 3) {
      warn('picotado', clip.outputStart, `3 clipes seguidos com menos de ${(limits.minClipSec * 2).toFixed(1)}s perto de ${formatClock(clip.outputStart)}`, 'funda clipes vizinhos devolvendo as pausas entre eles');
    }
  }
  return findings;
}

function rms(samples: Float32Array, from: number, to: number): number {
  const start = Math.max(0, from);
  const end = Math.min(samples.length, to);
  if (end <= start) return 0;
  let sum = 0;
  for (let index = start; index < end; index += 1) sum += samples[index]! * samples[index]!;
  return Math.sqrt(sum / (end - start));
}

/** Nível típico da fala: percentil 75 do RMS em blocos de 20 ms (ignora os silêncios). */
export function speechLevel(samples: Float32Array, sampleRate: number): number {
  const block = Math.round(sampleRate * 0.02);
  const levels: number[] = [];
  for (let start = 0; start + block <= samples.length; start += block) levels.push(rms(samples, start, start + block));
  if (levels.length === 0) return 0;
  levels.sort((a, b) => a - b);
  return levels[Math.floor(levels.length * 0.75)]!;
}

export interface CutAudio {
  at: number;
  /** pico bem em cima do corte, relativo à fala (0 = silêncio total) */
  edgeRatio: number;
  /** energia logo antes e logo depois do corte, relativa à fala */
  beforeRatio: number;
  afterRatio: number;
}

/** Mede o áudio do vídeo renderizado em volta de cada corte. */
export function measureCuts(samples: Float32Array, sampleRate: number, cuts: number[]): CutAudio[] {
  const level = speechLevel(samples, sampleRate) || 1e-6;
  const ms = (value: number) => Math.round((value / 1000) * sampleRate);
  return cuts.map((at) => {
    const center = Math.round(at * sampleRate);
    let edge = 0;
    for (let index = Math.max(0, center - ms(0.5)); index < Math.min(samples.length, center + ms(0.5)); index += 1) {
      edge = Math.max(edge, Math.abs(samples[index]!));
    }
    return {
      at,
      edgeRatio: edge / level,
      beforeRatio: rms(samples, center - ms(70), center - ms(15)) / level,
      afterRatio: rms(samples, center + ms(15), center + ms(70)) / level,
    };
  });
}

/** Estalo = sinal não chega a zero no corte. Corte "em cima de som" = fala forte colada na borda. */
export function judgeCuts(measures: CutAudio[]): Finding[] {
  const findings: Finding[] = [];
  for (const cut of measures) {
    if (cut.edgeRatio > 0.5) {
      findings.push({
        severity: 'error',
        check: 'estalo',
        at: cut.at,
        message: `áudio não zera no corte em ${formatClock(cut.at)} (pico ${(cut.edgeRatio * 100).toFixed(0)}% do nível da fala): risco de estalo`,
        fix: 'confira audio.cutFadeMs (deve ser > 0) e re-renderize',
      });
    }
    if (cut.beforeRatio > 0.6 || cut.afterRatio > 0.6) {
      const side = cut.beforeRatio > cut.afterRatio ? 'antes' : 'depois';
      findings.push({
        severity: 'warning',
        check: 'corte-em-som',
        at: cut.at,
        message: `fala forte colada no corte em ${formatClock(cut.at)} (${side}): pode ter cortado o fim ou o começo de uma palavra`,
        fix:
          side === 'antes'
            ? 'aumente o `end` do clipe anterior em ~0.1s (confira na mce view)'
            : 'reduza o `start` do clipe seguinte em ~0.1s (confira na mce view)',
      });
    }
  }
  return findings;
}

export interface SyncResult {
  matched: number;
  expected: number;
  /** mediana de (ouvido − esperado), em segundos: positivo = legenda adiantada */
  medianOffset: number;
  worstOffset: number;
  /** palavras esperadas que a retranscrição não encontrou, com o instante */
  missing: TimedWord[];
}

/**
 * Compara as legendas esperadas com o que se ouve no vídeo renderizado (retranscrição).
 * Alinha por subsequência comum mais longa de tokens normalizados.
 */
export function compareWords(expected: TimedWord[], heard: TimedWord[]): SyncResult {
  const a = expected.map((word) => normalizeToken(word.text));
  const b = heard.map((word) => normalizeToken(word.text));
  const width = b.length + 1;
  const table = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j] && a[i] !== ''
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }
  const offsets: number[] = [];
  const missing: TimedWord[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j] && a[i] !== '') {
      offsets.push(heard[j]!.start - expected[i]!.start);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
      missing.push(expected[i]!);
      i += 1;
    } else {
      j += 1;
    }
  }
  missing.push(...expected.slice(i));
  const sorted = [...offsets].sort((x, y) => x - y);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
  const worst = offsets.reduce((max, value) => (Math.abs(value) > Math.abs(max) ? value : max), 0);
  return { matched: offsets.length, expected: expected.length, medianOffset: median, worstOffset: worst, missing };
}

export function judgeSync(result: SyncResult, cuts: number[]): Finding[] {
  const findings: Finding[] = [];
  if (Math.abs(result.medianOffset) > 0.12) {
    findings.push({
      severity: 'error',
      check: 'legenda-dessincronizada',
      at: null,
      message: `legendas ${result.medianOffset > 0 ? 'adiantadas' : 'atrasadas'} em ${Math.abs(result.medianOffset * 1000).toFixed(0)} ms (mediana)`,
      fix: 'provável drift no corte: confira se os clipes estão na grade de frames e re-renderize',
    });
  }
  const ratio = result.expected ? result.matched / result.expected : 1;
  if (ratio < 0.85) {
    findings.push({
      severity: 'warning',
      check: 'fala-divergente',
      at: null,
      message: `só ${(ratio * 100).toFixed(0)}% das palavras esperadas foram ouvidas no vídeo renderizado`,
      fix: 'confira os trechos das palavras ausentes; pode haver corte no meio de frase',
    });
  }
  // palavra sumida colada num corte é o sintoma clássico de corte dentro da palavra
  for (const word of result.missing) {
    const cut = cuts.find((at) => Math.abs(at - word.start) < 0.35 || Math.abs(at - word.end) < 0.35);
    if (cut === undefined) continue;
    findings.push({
      severity: 'warning',
      check: 'palavra-perdida-no-corte',
      at: cut,
      message: `"${word.text}" (esperada em ${formatClock(word.start)}) não foi ouvida, e há um corte em ${formatClock(cut)}`,
      fix: 'abra a mce view desse corte e afaste a borda do clipe da palavra',
    });
  }
  return findings;
}

export function judgeLoudness(integrated: number, truePeak: number, target: number, peakLimit: number): Finding[] {
  const findings: Finding[] = [];
  if (Math.abs(integrated - target) > 1) {
    findings.push({
      severity: 'error',
      check: 'loudness',
      at: null,
      message: `loudness ${integrated.toFixed(1)} LUFS, alvo ${target} (tolerância ±1)`,
      fix: 'se o limitador estiver segurando demais, reduza a dinâmica (denoise/compressão) ou aceite alvo menor',
    });
  }
  if (truePeak > peakLimit + 0.6) {
    findings.push({
      severity: 'error',
      check: 'pico',
      at: null,
      message: `pico real ${truePeak.toFixed(1)} dBTP acima do limite ${peakLimit}`,
      fix: 'reduza audio.truePeakDb em 1 dB',
    });
  }
  return findings;
}

export function judgeDuration(video: number, audio: number, expected: number, fps: number): Finding[] {
  const findings: Finding[] = [];
  const frame = 1 / fps;
  if (Math.abs(video - expected) > frame * 1.5) {
    findings.push({
      severity: 'error',
      check: 'duracao',
      at: null,
      message: `vídeo com ${video.toFixed(3)}s, a EDL previa ${expected.toFixed(3)}s`,
      fix: 're-renderize; se persistir, há clipe fora da grade de frames',
    });
  }
  if (Math.abs(video - audio) > 0.06) {
    findings.push({
      severity: 'error',
      check: 'drift-av',
      at: null,
      message: `áudio (${audio.toFixed(3)}s) e vídeo (${video.toFixed(3)}s) têm durações diferentes`,
      fix: 're-renderize a partir dos cortes',
    });
  }
  return findings;
}

export function cutTimes(timeline: Timeline): number[] {
  return cutPoints(timeline);
}
