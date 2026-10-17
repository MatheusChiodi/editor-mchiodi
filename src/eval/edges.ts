import type { LevelId } from '../edl/levels.ts';
import type { Overlay } from '../edl/schema.ts';
import type { PlacedClip, Timeline } from '../edl/timeline.ts';
import { formatClock } from '../lib/time.ts';
import type { Finding, TimedWord } from './checks.ts';
import { captionClash } from './direction.ts';

/**
 * Checagens de borda de corte que o `findCutWords`/`judgeCuts` não pegam: respiro mínimo entre a borda e a
 * palavra, salto de fundo/volume e clique na junção, jump cut visual, gráfico na faixa da legenda e o
 * ranking dos cortes que valem uma imagem. Tudo puro; a casca (ffmpeg/sharp) está em `visual.ts`.
 */

/** Respiro mínimo entre a borda do clipe e a palavra (o timestamp do alinhador erra dezenas de ms). */
export const MIN_EDGE_PAD_SEC = 0.03;
/** Até onde uma borda pode "entrar" numa palavra sem virar `corte-em-palavra` (mesma tolerância de checks.ts). */
const IN_WORD_TOLERANCE = 0.02;

export interface ClipEdge {
  clip: PlacedClip;
  side: 'início' | 'fim';
  /** segundos da fonte */
  edge: number;
  /** segundos do vídeo final (sem vinheta) */
  at: number;
}

/**
 * Bordas que viram corte de verdade: o início e o fim de cada clipe, menos as junções em que o clipe
 * seguinte continua a fonte exatamente onde o anterior parou (ali não há corte audível nem visível).
 */
export function clipEdges(timeline: Timeline): ClipEdge[] {
  const edges: ClipEdge[] = [];
  timeline.clips.forEach((clip, index) => {
    const previous = timeline.clips[index - 1];
    const next = timeline.clips[index + 1];
    if (!previous || Math.abs(previous.sourceEnd - clip.sourceStart) > 1e-6) {
      edges.push({ clip, side: 'início', edge: clip.sourceStart, at: clip.outputStart });
    }
    if (!next || Math.abs(next.sourceStart - clip.sourceEnd) > 1e-6) {
      edges.push({ clip, side: 'fim', edge: clip.sourceEnd, at: clip.outputEnd });
    }
  });
  return edges;
}

/** A palavra inteira sai no vídeo final (algum clipe a contém). */
export function isKept(timeline: Timeline, word: TimedWord): boolean {
  return timeline.clips.some((clip) => clip.sourceStart <= word.start + IN_WORD_TOLERANCE && clip.sourceEnd >= word.end - IN_WORD_TOLERANCE);
}

export interface EdgeGap {
  edge: ClipEdge;
  word: TimedWord;
  /** `dentro`: a palavra que fica no clipe; `fora`: a palavra cortada do outro lado da borda */
  role: 'dentro' | 'fora';
  /** distância (s) entre a borda e a palavra; negativa = a borda já encosta dentro dela (até a tolerância) */
  gapSec: number;
}

/** Para cada borda, a palavra mais próxima de cada lado, com a distância. Bordas dentro de palavra ficam de fora (já são erro). */
export function edgeGaps(timeline: Timeline, words: readonly TimedWord[]): EdgeGap[] {
  const gaps: EdgeGap[] = [];
  for (const edge of clipEdges(timeline)) {
    const crossed = words.some((word) => word.start + IN_WORD_TOLERANCE < edge.edge && word.end - IN_WORD_TOLERANCE > edge.edge);
    if (crossed) continue;
    // depois da borda: a primeira palavra que termina depois dela; antes: a última que começa antes dela
    const after = words.find((word) => word.end > edge.edge + IN_WORD_TOLERANCE);
    const before = words.findLast((word) => word.start < edge.edge - IN_WORD_TOLERANCE);
    const inner = edge.side === 'início' ? after : before;
    const outer = edge.side === 'início' ? before : after;
    if (inner) gaps.push({ edge, word: inner, role: 'dentro', gapSec: edge.side === 'início' ? inner.start - edge.edge : edge.edge - inner.end });
    // palavra do outro lado que também está no vídeo (clipe vizinho) não vaza: o som dela sai de qualquer jeito
    if (outer && !isKept(timeline, outer)) {
      gaps.push({ edge, word: outer, role: 'fora', gapSec: edge.side === 'início' ? edge.edge - outer.end : outer.start - edge.edge });
    }
  }
  return gaps;
}

/**
 * Borda colada numa palavra: a sílaba de ataque some (dentro) ou o rabo da palavra cortada vaza (fora).
 * Um aviso por borda; quando os dois lados estão colados não há onde pôr a borda nessa pausa.
 */
export function findTightEdges(timeline: Timeline, words: readonly TimedWord[], minPadSec = MIN_EDGE_PAD_SEC): Finding[] {
  const byEdge = new Map<ClipEdge, EdgeGap[]>();
  for (const gap of edgeGaps(timeline, words)) {
    if (gap.gapSec < minPadSec) byEdge.set(gap.edge, [...(byEdge.get(gap.edge) ?? []), gap]);
  }
  return [...byEdge.entries()].map(([edge, gaps]): Finding => {
    const describe = ({ word, role, gapSec }: EdgeGap) => {
      const ms = Math.round(gapSec * 1000);
      return `${ms < 0 ? `entra ${-ms} ms em` : `fica a ${ms} ms de`} "${word.text}"${role === 'fora' ? ' (cortada)' : ''}`;
    };
    const inner = gaps.find((gap) => gap.role === 'dentro');
    const outer = gaps.find((gap) => gap.role === 'fora');
    const symptoms = [
      inner && (edge.side === 'início' ? 'o ataque da primeira sílaba pode sair cortado' : 'o fim da palavra pode sair comido'),
      outer && (edge.side === 'início' ? 'o rabo da palavra cortada pode vazar' : 'o começo da palavra cortada pode vazar'),
    ].filter(Boolean);
    const key = edge.side === 'início' ? 'start' : 'end';
    const only = gaps[0]!;
    const target = only.role === 'dentro'
      ? edge.side === 'início' ? only.word.start - 2 * minPadSec : only.word.end + 2 * minPadSec
      : edge.side === 'início' ? only.word.end + 2 * minPadSec : only.word.start - 2 * minPadSec;
    return {
      severity: 'warning',
      check: 'sem-respiro',
      at: edge.at,
      message: `o ${edge.side} do clipe ${edge.clip.id} (${edge.edge.toFixed(3)}s da fonte) ${gaps.map(describe).join(' e ')}, mínimo ${Math.round(minPadSec * 1000)} ms: ${symptoms.join('; ')}`,
      fix: inner && outer
        ? `as duas palavras estão coladas (sem pausa para a borda): mova clips[${edge.clip.id}].${key} para a pausa seguinte/anterior ou aceite após conferir na mce view`
        : `leve clips[${edge.clip.id}].${key} para ~${Math.max(0, target).toFixed(3)} (sem invadir a palavra vizinha; confira na mce view)`,
    };
  });
}

// ── áudio na junção ──────────────────────────────────────────────────────────────

export interface JoinAudio {
  at: number;
  /** RMS de 25–200 ms antes/depois do corte, relativo ao nível da fala (fora do fade da borda) */
  before: number;
  after: number;
  /** maior degrau entre amostras vizinhas a ±3 ms do corte, dividido pelo maior degrau no entorno (10–60 ms) */
  stepRatio: number;
  /** o mesmo degrau, relativo ao nível da fala */
  step: number;
}

function rmsOf(samples: Float32Array, from: number, to: number): number {
  const start = Math.max(0, from);
  const end = Math.min(samples.length, to);
  if (end <= start) return 0;
  let sum = 0;
  for (let index = start; index < end; index += 1) sum += samples[index]! * samples[index]!;
  return Math.sqrt(sum / (end - start));
}

function maxStep(samples: Float32Array, from: number, to: number): number {
  let max = 0;
  for (let index = Math.max(1, from); index < Math.min(samples.length, to); index += 1) {
    max = Math.max(max, Math.abs(samples[index]! - samples[index - 1]!));
  }
  return max;
}

/** Mede fundo/volume dos dois lados e o degrau de amostra em cada corte (tempos do vídeo final). `level` = `speechLevel`. */
export function measureJoins(samples: Float32Array, sampleRate: number, cuts: readonly number[], level: number): JoinAudio[] {
  const ms = (value: number) => Math.round((value / 1000) * sampleRate);
  const reference = level || 1e-6;
  return cuts.map((at) => {
    const center = Math.round(at * sampleRate);
    const near = maxStep(samples, center - ms(3), center + ms(3));
    const around = Math.max(maxStep(samples, center - ms(60), center - ms(10)), maxStep(samples, center + ms(10), center + ms(60)));
    return {
      at,
      before: rmsOf(samples, center - ms(200), center - ms(25)) / reference,
      after: rmsOf(samples, center + ms(25), center + ms(200)) / reference,
      stepRatio: near / Math.max(around, 1e-5),
      step: near / reference,
    };
  });
}

export const JOIN_LIMITS = {
  /** abaixo disso (fração do nível da fala) o lado é pausa: só fundo de sala */
  pause: 0.35,
  /** razão entre os dois lados a partir da qual o salto se ouve (2.5x ≈ 8 dB) */
  ratio: 2.5,
  /** lado mais alto precisa ter pelo menos isso, senão é silêncio contra silêncio */
  floor: 0.04,
  /** degrau na borda X vezes maior que no entorno = descontinuidade */
  stepRatio: 4,
  /** e com tamanho audível (fração do nível da fala) */
  step: 0.1,
} as const;

const toDb = (ratio: number) => 20 * Math.log10(ratio);

/**
 * Pulo na junção: fundo de sala que muda de nível entre duas pausas (ambiente/denoise diferente),
 * volume de fala que muda entre dois trechos falados (retake de outra distância) e clique (degrau de amostra).
 * Fala de um lado e pausa do outro é natural e não conta. `skipAt`: cortes que já têm `estalo`.
 */
export function judgeJoins(measures: readonly JoinAudio[], skipAt: readonly number[] = []): Finding[] {
  const findings: Finding[] = [];
  for (const join of measures) {
    const louder = Math.max(join.before, join.after);
    const quieter = Math.min(join.before, join.after);
    const ratio = louder / Math.max(quieter, 1e-3);
    const bothPause = louder < JOIN_LIMITS.pause;
    const bothSpeech = quieter >= JOIN_LIMITS.pause;
    if (louder >= JOIN_LIMITS.floor && ratio >= JOIN_LIMITS.ratio && (bothPause || bothSpeech)) {
      const db = toDb(ratio).toFixed(0);
      const side = join.after > join.before ? 'sobe' : 'cai';
      findings.push({
        severity: 'warning',
        check: 'salto-de-nivel',
        at: join.at,
        message: bothPause
          ? `o fundo de sala ${side} ${db} dB no corte em ${formatClock(join.at)}: o ambiente "pula"`
          : `o volume da fala ${side} ${db} dB no corte em ${formatClock(join.at)}: soa como outra gravação`,
        fix: bothPause
          ? 'leve a borda para dentro da pausa mais limpa do outro lado ou suba audio.denoise; se o ambiente mudou de verdade, uma transição cross-dissolve disfarça'
          : 'confira se é retake de outra distância: prefira o take do mesmo bloco ou separe os trechos com uma transição/respiro',
      });
    }
    if (join.stepRatio >= JOIN_LIMITS.stepRatio && join.step >= JOIN_LIMITS.step && !skipAt.some((at) => Math.abs(at - join.at) < 0.01)) {
      findings.push({
        severity: 'warning',
        check: 'clique',
        at: join.at,
        message: `degrau de amostra no corte em ${formatClock(join.at)} (${join.stepRatio.toFixed(1)}x o entorno): pode estalar baixinho`,
        fix: 'confira audio.cutFadeMs (> 0) e se a borda está em silêncio medido; re-renderize',
      });
    }
  }
  return findings;
}

// ── jump cut visual ──────────────────────────────────────────────────────────────

export interface FrameDiff {
  /** diferença média absoluta (0–255) entre os dois quadros em cinza, no miolo */
  raw: number;
  /** a mesma diferença depois do melhor deslocamento de até `maxShift` px: baixa = o quadro só "andou" */
  aligned: number;
  shift: { dx: number; dy: number };
}

/** Compara dois quadros em cinza do mesmo tamanho (1 byte por pixel). Ignora uma margem de `maxShift` px. */
export function frameDiff(a: Uint8Array, b: Uint8Array, width: number, height: number, maxShift = 4): FrameDiff {
  if (a.length < width * height || b.length < width * height) throw new Error('quadro menor que width x height');
  const meanAt = (dx: number, dy: number) => {
    let sum = 0;
    let count = 0;
    for (let y = maxShift; y < height - maxShift; y += 1) {
      const row = y * width;
      const shifted = (y + dy) * width + dx;
      for (let x = maxShift; x < width - maxShift; x += 1) {
        sum += Math.abs(a[row + x]! - b[shifted + x]!);
        count += 1;
      }
    }
    return count ? sum / count : 0;
  };
  const raw = meanAt(0, 0);
  let best = { value: raw, dx: 0, dy: 0 };
  for (let dy = -maxShift; dy <= maxShift; dy += 1) {
    for (let dx = -maxShift; dx <= maxShift; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const value = meanAt(dx, dy);
      if (value < best.value) best = { value, dx, dy };
    }
  }
  return { raw, aligned: best.value, shift: { dx: best.dx, dy: best.dy } };
}

export const JUMP_LIMITS = {
  /** abaixo disso o corte é invisível (tela parada, apresentador imóvel) */
  invisible: 2.5,
  /** acima disso é troca de plano/cena: corte franco, não jump cut */
  scene: 28,
} as const;

export type JumpKind = 'invisivel' | 'jump' | 'troca';

export function classifyJump(diff: Pick<FrameDiff, 'raw'>): JumpKind {
  if (diff.raw < JUMP_LIMITS.invisible) return 'invisivel';
  if (diff.raw > JUMP_LIMITS.scene) return 'troca';
  return 'jump';
}

/**
 * Quão feio é o jump cut (0–1): cresce rápido ao sair do invisível, cai perto da troca de plano,
 * e pesa mais quando o alinhamento explica a diferença (o mesmo quadro, só deslocado).
 */
export function jumpScore(diff: FrameDiff): number {
  if (classifyJump(diff) !== 'jump') return 0;
  const visible = Math.min(1, (diff.raw - JUMP_LIMITS.invisible) / 4);
  const sameShot = (JUMP_LIMITS.scene - diff.raw) / (JUMP_LIMITS.scene - JUMP_LIMITS.invisible);
  const displaced = diff.raw > 0 ? 1 - diff.aligned / diff.raw : 0;
  return Math.min(1, visible * sameShot * (0.7 + 0.3 * displaced));
}

export interface JumpCut {
  /** tempo do vídeo final (com vinheta) */
  at: number;
  clip: PlacedClip;
  diff: FrameDiff;
}

export interface JumpContext {
  level: LevelId;
  zoomMinGapSec: number;
  /** inícios (s do vídeo final) de zooms e efeitos de câmera */
  zoomsAt: readonly number[];
  /** clipes que já entram com transição */
  transitionInto: ReadonlySet<string>;
}

/** O que fazer com um jump cut, dentro do nível (STYLE.md §0): no `limpa` não se cobra disfarce. */
export function suggestJumpFix(cut: Pick<JumpCut, 'at' | 'clip'>, context: JumpContext): string {
  const { clip } = cut;
  if (context.level === 'limpa') return `no nível limpa o jump cut é aceito; se incomodar na imagem, devolva a pausa entre os clipes (funda-os) em vez de acrescentar zoom`;
  const nearest = Math.min(Infinity, ...context.zoomsAt.map((at) => Math.abs(at - cut.at)));
  const zoom = `zoom punch (scale 1.08–1.12) no início de ${clip.id}: zooms[] { "at": ${clip.sourceStart.toFixed(3)}, "mode": "punch", "reason": "disfarça o jump cut" }`;
  const transition = `transição calm na entrada de ${clip.id}: transitions[] { "intoClip": "${clip.id}", "type": "cross-dissolve" }`;
  if (nearest < context.zoomMinGapSec) return `${transition} (já há zoom a ${nearest.toFixed(1)}s; mínimo ${context.zoomMinGapSec}s entre zooms)`;
  return context.level === 'normal' ? zoom : `${zoom}, ou ${transition}`;
}

/**
 * Jump cuts que merecem aviso: mesmo plano com micro deslocamento, sem transição nem zoom já em cima do corte.
 * Só os `limit` piores viram aviso; o resto entra num aviso de resumo.
 */
export function judgeJumps(cuts: readonly JumpCut[], context: JumpContext, limit = 6): Finding[] {
  const covered = (cut: JumpCut) =>
    context.transitionInto.has(cut.clip.id) || context.zoomsAt.some((at) => Math.abs(at - cut.at) <= 0.25);
  const ugly = cuts
    .filter((cut) => classifyJump(cut.diff) === 'jump' && !covered(cut))
    .map((cut) => ({ cut, score: jumpScore(cut.diff) }))
    .sort((a, b) => b.score - a.score);
  const findings: Finding[] = ugly.slice(0, limit).map(({ cut }) => ({
    severity: 'warning',
    check: 'jump-cut',
    at: cut.at,
    message: `jump cut na entrada de ${cut.clip.id} em ${formatClock(cut.at)}: mesmo plano com salto visível (diferença ${cut.diff.raw.toFixed(1)}/255${cut.diff.shift.dx || cut.diff.shift.dy ? `, quadro deslocado ~${Math.hypot(cut.diff.shift.dx, cut.diff.shift.dy).toFixed(0)} px a 160 px` : ''})`,
    fix: suggestJumpFix(cut, context),
  }));
  if (ugly.length > limit) {
    findings.push({
      severity: 'warning',
      check: 'jump-cut',
      at: null,
      message: `mais ${ugly.length - limit} jump cuts menores (${ugly.slice(limit).map(({ cut }) => formatClock(cut.at)).join(', ')})`,
      fix: context.level === 'limpa' ? 'aceitos no nível limpa' : 'disfarce só os que chamam atenção na prancha de contato; não encha de zoom',
    });
  }
  return findings;
}

// ── gráfico na faixa da legenda ──────────────────────────────────────────────────

/** Componentes que se desenham sempre na faixa inferior (onde a legenda `long` mora). */
const BOTTOM_COMPONENTS: Record<string, string> = {
  LowerThird: 'um lower third',
  SubscribeCTA: 'o CTA de inscrição',
  LikeReminder: 'o lembrete de like',
  SourceCitation: 'a citação de fonte',
};

/**
 * O overlay ocupa a faixa da legenda? Pela tabela acima ou pela posição declarada nas props
 * (`position: "bottom"`/`"bottom-right"`). Cantos com folga de 250 px (PillStack, TechBadge, TechRow) não contam.
 */
export function bottomBandOwner(overlay: Pick<Overlay, 'component' | 'props'>): string | null {
  const fixed = BOTTOM_COMPONENTS[overlay.component];
  if (fixed) return fixed;
  const position = overlay.props.position;
  if (overlay.component === 'TextReveal' && position === 'bottom') return 'um TextReveal na base';
  if (overlay.component === 'Toast' && position === 'bottom-right') return 'um Toast no canto inferior';
  return null;
}

export interface PlacedOverlay extends Pick<Overlay, 'id' | 'component' | 'props' | 'hidesCaptions' | 'presenter' | 'layer'> {
  /** s do vídeo final */
  out: number;
  duration: number;
}

/** Soma (s) da interseção de `[from, to]` com os intervalos dados, que podem se sobrepor. */
export function overlapSec(from: number, to: number, spans: readonly { start: number; end: number }[]): number {
  const clipped = spans
    .map((span) => ({ start: Math.max(from, span.start), end: Math.min(to, span.end) }))
    .filter((span) => span.end > span.start)
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let cursor = from;
  for (const span of clipped) {
    const start = Math.max(cursor, span.start);
    if (span.end > start) total += span.end - start;
    cursor = Math.max(cursor, span.end);
  }
  return total;
}

/**
 * Gráfico na faixa inferior com legenda visível por cima (`legenda-sobre-grafico`). A legenda some sozinha
 * enquanto qualquer overlay com `hidesCaptions` está na tela, então esse tempo não conta. Palcos e cenas de
 * tela cheia são da `legenda-sobre-palco` e ficam de fora. `captions`: páginas no tempo do vídeo final (s).
 */
export function findCaptionOverGraphic(
  overlays: readonly PlacedOverlay[],
  captions: readonly { start: number; end: number }[],
  minOverlapSec = 0.3,
): Finding[] {
  const hidden = overlays.filter((overlay) => overlay.hidesCaptions).map((overlay) => ({ start: overlay.out, end: overlay.out + overlay.duration }));
  const findings: Finding[] = [];
  for (const overlay of overlays) {
    if (overlay.hidesCaptions || captionClash(overlay)) continue;
    const owner = bottomBandOwner(overlay);
    if (!owner) continue;
    const end = overlay.out + overlay.duration;
    const visible = overlapSec(overlay.out, end, captions) - overlapSec(overlay.out, end, captions.flatMap((caption) =>
      hidden.map((span) => ({ start: Math.max(caption.start, span.start), end: Math.min(caption.end, span.end) })).filter((span) => span.end > span.start),
    ));
    if (visible < minOverlapSec) continue;
    findings.push({
      severity: 'warning',
      check: 'legenda-sobre-grafico',
      at: overlay.out,
      message: `"${overlay.id}" é ${owner} e divide a faixa inferior com a legenda por ${visible.toFixed(1)}s`,
      fix: `defina "hidesCaptions": true em "${overlay.id}" ou mova-o para uma pausa da fala`,
    });
  }
  return findings;
}

// ── pontos de decisão ────────────────────────────────────────────────────────────

/** Peso de cada achado na hora de escolher os cortes da prancha de contato. */
export const DECISION_WEIGHTS: Record<string, number> = {
  'corte-em-palavra': 1,
  estalo: 1,
  clique: 0.8,
  'palavra-perdida-no-corte': 0.7,
  'corte-em-som': 0.6,
  'sem-respiro': 0.5,
  'salto-de-nivel': 0.5,
  'jump-cut': 0.4,
};

export interface DecisionPoint {
  at: number;
  score: number;
  /** achados que caíram neste corte, na ordem em que vieram */
  checks: string[];
}

/**
 * Os `limit` cortes mais suspeitos: soma o peso dos achados localizados a até `window` s do corte
 * e o `jumpScore` visual (mesmo sem aviso). Cortes sem nada medido ficam de fora.
 */
export function rankDecisionPoints(
  cuts: readonly number[],
  findings: readonly Finding[],
  jumpScores: ReadonlyMap<number, number>,
  limit: number,
  window = 0.06,
): DecisionPoint[] {
  return cuts
    .map((at): DecisionPoint => {
      const near = findings.filter((finding) => finding.at !== null && finding.check in DECISION_WEIGHTS && Math.abs(finding.at - at) <= window);
      const checks = [...new Set(near.map((finding) => finding.check))];
      const score = checks.reduce((sum, check) => sum + DECISION_WEIGHTS[check]!, 0) + 0.3 * (jumpScores.get(at) ?? 0);
      return { at, score, checks };
    })
    .filter((point) => point.score > 0)
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, limit);
}
