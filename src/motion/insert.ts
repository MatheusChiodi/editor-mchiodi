import type { Word } from '../analyze/types.ts';
import type { Edl } from '../edl/schema.ts';
import { validateEdl } from '../edl/store.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';

/** Minúsculas, sem acento nem pontuação: "Açúcar, é Ótimo!" → "acucar e otimo". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

export interface PhraseMatch {
  /** índice da primeira palavra */
  index: number;
  start: number;
  end: number;
}

/** Ocorrências de uma frase falada (palavras consecutivas), para ancorar o gráfico no que está sendo dito. */
export function findPhrase(words: Word[], phrase: string): PhraseMatch[] {
  const target = normalizeText(phrase).split(' ').filter(Boolean);
  if (target.length === 0) return [];
  const spoken = words.map((word) => normalizeText(word.text));
  const matches: PhraseMatch[] = [];
  for (let i = 0; i + target.length <= words.length; i++) {
    if (target.every((part, offset) => spoken[i + offset] === part)) {
      matches.push({ index: i, start: words[i]!.start, end: words[i + target.length - 1]!.end });
    }
  }
  return matches;
}

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `PathDraw` → `path-draw-1`, `-2`... ; cena sob medida usa só o nome da cena. */
export function nextOverlayId(overlays: { id: string }[], component: string): string {
  const base = kebab(component.includes('/') ? component.split('/').pop()! : component);
  const used = overlays.map((item) => new RegExp(`^${base}-(\\d+)$`).exec(item.id)?.[1]).filter((n): n is string => Boolean(n)).map(Number);
  return `${base}-${Math.max(0, ...used) + 1}`;
}

export interface OverlayRequest {
  component: string;
  /** segundos da FONTE */
  at: number;
  duration: number;
  props?: Record<string, unknown>;
  reason: string;
  hidesCaptions?: boolean;
}

/** Devolve a EDL com o gráfico a mais; a validação do schema recusa instante em trecho cortado. */
export function insertOverlay(edl: Edl, request: OverlayRequest, knownComponents: ReadonlySet<string>): Edl {
  const { component } = request;
  if (!component.startsWith('scene:') && !knownComponents.has(component)) {
    throw new Error(`Componente "${component}" não existe. Veja: pnpm mce arsenal components`);
  }
  if (!request.reason.trim()) throw new Error('Todo gráfico precisa de motivo (--reason): o que ele reforça na fala (STYLE.md §1)');
  const overlay = {
    id: nextOverlayId(edl.overlays, component),
    component,
    at: request.at,
    duration: request.duration,
    props: request.props ?? {},
    reason: request.reason.trim(),
    hidesCaptions: request.hidesCaptions ?? false,
  };
  return validateEdl({
    ...edl,
    overlays: [...edl.overlays, overlay].sort((a, b) => a.at - b.at),
    notes: `Motion graphic: ${component} em ${request.at}s da fonte (${overlay.reason})`,
  });
}

export function removeOverlay(edl: Edl, id: string): Edl {
  if (!edl.overlays.some((item) => item.id === id)) throw new Error(`Gráfico "${id}" não existe nesta EDL (${edl.overlays.map((item) => item.id).join(', ') || 'nenhum'})`);
  return validateEdl({ ...edl, overlays: edl.overlays.filter((item) => item.id !== id), notes: `Removido o gráfico ${id}` });
}

export interface OverlayRow {
  id: string;
  component: string;
  source: number;
  output: number | null;
  duration: number;
  reason: string;
}

export function describeOverlays(edl: Edl, timeline: Timeline): OverlayRow[] {
  return edl.overlays.map((item) => ({
    id: item.id,
    component: item.component,
    source: item.at,
    output: sourceToOutput(timeline, item.at),
    duration: item.duration,
    reason: item.reason,
  }));
}
