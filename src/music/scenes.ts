import { type CameraId, MOTIF_IDS, type MotifId, type Shot, type TransitionId } from '../../motion/src/music/types.ts';
import { normalizeText } from '../motion/insert.ts';
import type { LyricLine } from './lyrics.ts';
import type { EnergyLevel, Section } from './sections.ts';

export { MOTIF_IDS, type MotifId };
type ThemeMotif = Exclude<MotifId, 'story' | 'words' | 'burst' | 'blob'>;

/**
 * Palavras (sem acento) que chamam cada motivo visual. Termo com ≥5 letras vale como prefixo ("silenc" pega "silêncio");
 * menor, só a palavra exata. Termo com espaço é frase e vale uma palavra por palavra.
 */
const LEXICON: Record<ThemeMotif, string[]> = {
  phone: ['mensag', 'mandar', 'enviar', 'apago', 'celular', 'whatsapp', 'digit', 'ligacao', 'telefon', 'chamada'],
  morning: ['bom dia', 'manha', 'amanhec', 'sol', 'nascer', 'aurora', 'alvorada'],
  photos: ['foto', 'fotos', 'sorriso', 'imagem', 'retrato', 'recentes', 'lembranca'],
  paper: ['rasgar', 'orgulho', 'papel', 'manual', 'frase', 'escrev', 'carta', 'bilhete'],
  clock: ['tempo', 'voltar', 'atras', 'passou', 'relogio', 'hora', 'horas', 'passado', 'final'],
  road: ['caminho', 'seguir', 'travei', 'estrada', 'alem', 'jornada', 'rumo', 'partir'],
  shout: ['gritav', 'grito', 'gritar', 'mundo', 'nome', 'barulho', 'voz', 'falar', 'fala', 'cantar', 'dizer', 'diz'],
  rain: ['chorei', 'chorar', 'choro', 'lagrima', 'chuva', 'doi', 'dor', 'sofrer', 'sofro', 'saudade'],
  night: ['noite', 'silenc', 'escur', 'sozinh', 'ausent', 'madrugad', 'lua', 'covard', 'vazio', 'solidao'],
  heart: ['coracao', 'peito', 'amor', 'amar', 'sentir', 'sente', 'paixao', 'ciume', 'amo'],
};

/** Empate resolve por esta ordem (o mais específico primeiro). */
const PRIORITY: ThemeMotif[] = ['phone', 'morning', 'photos', 'paper', 'clock', 'road', 'shout', 'rain', 'night', 'heart'];

const clean = (word: string) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

export interface MotifMatch {
  motif: ThemeMotif;
  /** palavra do verso que chamou o motivo, como foi escrita */
  keyword: string;
}

/** Qual motivo ilustra o verso: o de maior pontuação (frase vale por palavra); `null` se nenhuma palavra for conhecida. */
export function motifForText(text: string): MotifMatch | null {
  const original = text.split(/\s+/).filter(Boolean);
  const norm = original.map((word) => normalizeText(word).replace(/ /g, ''));
  let best: { motif: ThemeMotif; score: number; keyword: string } | null = null;
  for (const motif of PRIORITY) {
    let score = 0;
    let keyword = '';
    for (const term of LEXICON[motif]) {
      const parts = term.split(' ');
      for (let i = 0; i + parts.length <= norm.length; i++) {
        const hit = parts.every((part, k) => {
          const token = norm[i + k]!;
          return token === part || (part.length >= 5 && token.startsWith(part));
        });
        if (!hit) continue;
        score += parts.length;
        const shown = original.slice(i, i + parts.length).map(clean).join(' ');
        if (shown.length > keyword.length) keyword = shown;
        break;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { motif, score, keyword };
  }
  return best ? { motif: best.motif, keyword: best.keyword } : null;
}

export interface PlannedScene {
  start: number;
  end: number;
  motif: MotifId;
  /** palavra em destaque (motivo `words` e legenda da cena) */
  keyword: string | null;
  /** 0–2: varia o visual quando o mesmo motivo volta */
  variant: number;
  /** só nos planos `story` (planStory) */
  shot?: Shot;
  camera?: CameraId;
  transition?: TransitionId;
}

export interface PlanScenesInput {
  lyrics: LyricLine[];
  sections: Section[];
  durationSec: number;
  minSec?: number;
  maxSec?: number;
}

const FALLBACK: Record<EnergyLevel, MotifId> = { low: 'night', mid: 'blob', high: 'burst' };

interface Segment {
  start: number;
  end: number;
  motif: MotifId;
  keyword: string | null;
  lyric: boolean;
}

/**
 * Plano de cenas da música: cada verso chama um motivo pelo que diz; versos seguidos do mesmo tema viram uma cena;
 * trechos sem voz ganham motivo pela energia da seção; cenas longas se dividem e todas cobrem a música sem buracos.
 */
export function planScenes(input: PlanScenesInput): PlannedScene[] {
  const { durationSec, sections } = input;
  const minSec = input.minSec ?? 2.5;
  const maxSec = input.maxSec ?? 8;
  const energyAt = (t: number): EnergyLevel => (sections.find((section) => t >= section.start && t < section.end) ?? sections.at(-1))?.energy ?? 'mid';
  const lines = [...input.lyrics].sort((a, b) => a.start - b.start);

  // trecho sem voz, quebrado nas fronteiras das seções para a energia mudar o motivo
  const instrumental = (from: number, to: number): Segment[] => {
    const cuts = [from, ...sections.map((section) => section.start).filter((t) => t > from && t < to), to];
    return cuts.slice(0, -1).map((start, i) => ({ start, end: cuts[i + 1]!, motif: FALLBACK[energyAt((start + cuts[i + 1]!) / 2)], keyword: null, lyric: false }));
  };

  const segments: Segment[] = [];
  let cursor = 0;
  lines.forEach((line, index) => {
    const start = Math.max(cursor, line.start);
    if (start - cursor > 1.5) segments.push(...instrumental(cursor, start));
    else if (segments.length && start > cursor) segments.at(-1)!.end = start;
    const next = lines[index + 1];
    const end = Math.min(durationSec, next ? (next.start - line.end <= 1.5 ? next.start : line.end + 0.5) : line.end + 1);
    if (end <= start) return;
    const match = motifForText(line.text);
    const previous = segments.at(-1);
    const longest = [...line.text.split(/\s+/).map(clean)].sort((a, b) => b.length - a.length)[0] ?? null;
    const inherited = previous?.lyric && energyAt(previous.start) === energyAt(start) ? previous : null;
    segments.push({
      start,
      end,
      motif: match?.motif ?? inherited?.motif ?? 'words',
      keyword: match?.keyword ?? (inherited ? inherited.keyword : longest && longest.length >= 4 ? longest : null),
      lyric: true,
    });
    cursor = end;
  });
  if (cursor < durationSec) segments.push(...instrumental(cursor, durationSec));
  if (segments.length === 0) segments.push(...instrumental(0, durationSec));

  // cenas vizinhas do mesmo motivo viram uma, enquanto couberem no teto
  const merged: Segment[] = [];
  for (const segment of segments) {
    const last = merged.at(-1);
    if (last && last.motif === segment.motif && segment.end - last.start <= maxSec) {
      last.end = segment.end;
      last.keyword ??= segment.keyword;
    } else merged.push({ ...segment });
  }

  // cena curta demais é absorvida pela vizinha (a anterior; a primeira vai para a seguinte)
  for (let i = 0; i < merged.length && merged.length > 1; ) {
    const segment = merged[i]!;
    if (segment.end - segment.start >= minSec) {
      i++;
      continue;
    }
    if (i > 0) merged[i - 1]!.end = segment.end;
    else merged[1]!.start = segment.start;
    merged.splice(i, 1);
    i = Math.max(0, i - 1);
  }

  // cena longa vira pedaços iguais; a variante gira a cada uso do motivo
  const used: Partial<Record<MotifId, number>> = {};
  const scenes: PlannedScene[] = [];
  for (const segment of merged) {
    const length = segment.end - segment.start;
    const chunks = Math.max(1, Math.ceil(length / maxSec - 1e-9));
    for (let k = 0; k < chunks; k++) {
      const count = used[segment.motif] ?? 0;
      used[segment.motif] = count + 1;
      scenes.push({
        start: segment.start + (length * k) / chunks,
        end: k === chunks - 1 ? segment.end : segment.start + (length * (k + 1)) / chunks,
        motif: segment.motif,
        keyword: segment.keyword,
        variant: count % 3,
      });
    }
  }
  scenes[0]!.start = 0;
  scenes.at(-1)!.end = durationSec;
  return scenes;
}
