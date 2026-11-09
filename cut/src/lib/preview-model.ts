/**
 * Props da composição `Overlay` para o preview: a mesma função do render (src/render/overlay-props.ts), alimentada
 * com o que o servidor planejou (shifts do rosto, foco dos palcos) e com o arraste em andamento.
 */
import type { OverlayProps } from '../../../motion/src/types.ts';
import type { Point } from '../../../src/edl/fit.ts';
import type { GuardPayload } from '../../../src/cut/guard.ts';
import type { Word } from '../../../src/analyze/types.ts';
import type { Edl } from '../../../src/edl/schema.ts';
import { sourceToOutput, type Timeline } from '../../../src/edl/timeline.ts';
import { buildPreviewProps } from '../../../src/render/preview-props.ts';

export interface PreviewModel {
  props: OverlayProps | null;
  error: string | null;
}

export interface PreviewModelInput {
  edl: Edl;
  timeline: Timeline;
  words: Pick<Word, 'text' | 'start' | 'end' | 'score'>[];
  /** só estes itens (chaves `overlays:<id>`…); null = todos */
  only: string[] | null;
  guard: GuardPayload | null;
  /** offset provisório de um gráfico sendo arrastado */
  drag?: { id: string | null; offset: Point };
}

export function buildPreviewModel({ edl, timeline, words, only, guard, drag }: PreviewModelInput): PreviewModel {
  const keep = (kind: string, id: string) => only === null || only.includes(`${kind}:${id}`);
  // overlay ancorado em trecho cortado derrubaria a composição inteira: fica de fora (a timeline o marca)
  const scoped: Edl = {
    ...edl,
    overlays: edl.overlays
      .filter((item) => keep('overlays', item.id) && sourceToOutput(timeline, item.at) !== null)
      .map((item) => (drag?.id === item.id ? { ...item, offset: drag.offset } : item)),
    effects: edl.effects.filter((item) => keep('effects', item.id)),
    transitions: edl.transitions.filter((item) => keep('transitions', item.id)),
  };
  try {
    return { props: buildPreviewProps(scoped, timeline, { words: words as Word[] }, guard), error: null };
  } catch (error) {
    return { props: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Reaproveita o modelo anterior quando o novo tem as mesmas props: a camada do Remotion só re-renderiza (caro) se
 * algo mudou de fato. Soltar um gráfico dispara arraste → op → guard, e as três etapas costumam dar o mesmo resultado.
 */
export function reuseIfSame(previous: PreviewModel | null, next: PreviewModel): PreviewModel {
  if (!previous || previous.error !== next.error) return next;
  if (previous.props === next.props) return previous;
  return JSON.stringify(previous.props) === JSON.stringify(next.props) ? previous : next;
}
