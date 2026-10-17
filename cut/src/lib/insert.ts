/** Arsenal → item novo da EDL, ancorado no playhead. O `reason` fica vazio de propósito: o formulário exige. */
import type { ItemKind } from '../../../src/cut/ops.ts';
import { sourceToOutput, type Timeline } from '../../../src/edl/timeline.ts';
import { round3 } from '../../../src/lib/time.ts';

export type ArsenalKind = 'components' | 'models' | 'themes' | 'tech' | 'entrances' | 'transitions' | 'effects' | 'captions';

export interface ComponentInfo {
  defaultDuration: number;
  sample: Record<string, unknown>;
}

export type ComponentLookup = (component: string) => ComponentInfo | undefined;

export interface InsertDraft {
  ok: boolean;
  kind: ItemKind | null;
  item: Record<string, unknown> | null;
  message: string | null;
}

const no = (message: string): InsertDraft => ({ ok: false, kind: null, item: null, message });

/** O que cada categoria do arsenal vira na EDL. */
export const INSERTABLE: Record<ArsenalKind, string | null> = {
  components: 'overlay',
  models: 'overlay (cena)',
  tech: 'overlay TechBadge',
  entrances: 'overlay TextReveal',
  transitions: 'transição no próximo corte',
  effects: 'efeito',
  themes: null,
  captions: null,
};

export function draftInsert(
  kind: ArsenalKind,
  id: string,
  at: number,
  timeline: Timeline,
  existingTransitions: { intoClip: string }[],
  lookup: ComponentLookup,
): InsertDraft {
  if (kind === 'themes') return no('tema é prop de um modelo Analogia*: insira o modelo e escolha o `theme` nas props');
  if (kind === 'captions') return no('estilo de legenda vale para o vídeo todo (captions.preset): peça ao Claude ou edite a EDL');
  if (kind === 'transitions') {
    const playOut = sourceToOutput(timeline, at) ?? 0;
    const next = timeline.clips.slice(1).find((clip) => clip.outputStart >= playOut - 1e-3 && !existingTransitions.some((item) => item.intoClip === clip.id));
    if (!next) return no('não há corte livre depois do playhead');
    return { ok: true, kind: 'transitions', item: { intoClip: next.id, type: id, reason: '' }, message: `entra no corte de ${next.id} (${next.outputStart.toFixed(2)}s)` };
  }
  if (sourceToOutput(timeline, at) === null) return no('o playhead está num trecho cortado: ancore num instante que ficou no vídeo');
  const anchor = round3(at);
  if (kind === 'effects') return { ok: true, kind: 'effects', item: { preset: id, at: anchor, reason: '' }, message: null };
  const overlay = (component: string, extra: Record<string, unknown> = {}, duration?: number): InsertDraft => {
    const info = lookup(component);
    if (!info && !component.startsWith('scene:')) return no(`componente "${component}" não está no registry`);
    return {
      ok: true,
      kind: 'overlays',
      item: { component, at: anchor, duration: duration ?? info?.defaultDuration ?? 4, props: { ...(info?.sample ?? {}), ...extra }, reason: '' },
      message: null,
    };
  };
  if (kind === 'components') return overlay(id);
  if (kind === 'models') return overlay(`scene:modelos/${id}`);
  if (kind === 'tech') return overlay('TechBadge', { tech: id.replace(/^tech:/, '') }, 3);
  return overlay('TextReveal', { entrance: id });
}
