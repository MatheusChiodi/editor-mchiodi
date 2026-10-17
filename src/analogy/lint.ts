import { resolveThemeId, themeSpec } from '../../motion/src/themes/specs.ts';
import type { ThemeSpec } from '../../motion/src/themes/types.ts';
import type { Edl } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';
import type { Finding } from '../eval/checks.ts';
import { type Analogy, HIGH_CONFIDENCE } from './detect.ts';

/** Folga, em segundos, em volta da frase: a animação pode entrar um pouco antes ou sair um pouco depois. */
export const ANALOGY_MARGIN_SEC = 2;

/** Componente de arsenal que veste o talking head com a moldura do universo. */
export const THEME_FRAME = 'ThemeFrame';

/** O tema que atende à analogia: o do universo, senão o genérico da categoria. */
export function analogyTheme(analogy: Pick<Analogy, 'theme' | 'category'>): ThemeSpec {
  return themeSpec(analogy.theme, analogy.category);
}

type OverlayLike = Pick<Edl['overlays'][number], 'id' | 'component' | 'at' | 'duration' | 'props'>;

/** O overlay veste o universo da analogia? Vale a prop `theme` igual ao universo (ou ao tema dele), em modelo ou no `ThemeFrame`. */
export function wearsTheme(overlay: Pick<OverlayLike, 'props'>, analogy: Pick<Analogy, 'universe' | 'theme' | 'category'>): boolean {
  const theme = overlay.props.theme;
  if (typeof theme !== 'string' || theme === '') return false;
  return theme === analogy.universe || theme === analogy.theme || theme === resolveThemeId(analogy.theme, analogy.category);
}

/** Intervalo da frase da analogia no vídeo FINAL, ou null quando o trecho foi cortado. */
export function analogyWindow(analogy: Pick<Analogy, 'start' | 'end' | 'at'>, timeline: Timeline): { from: number; to: number; at: number } | null {
  const at = sourceToOutput(timeline, analogy.at);
  if (at === null) return null;
  const from = sourceToOutput(timeline, analogy.start) ?? at - (analogy.at - analogy.start);
  const to = sourceToOutput(timeline, analogy.end) ?? at + (analogy.end - analogy.at);
  return { from: Math.min(from, at), to: Math.max(to, at), at };
}

/** O primeiro overlay no tema do universo que toca a frase (± a folga), ou null. */
export function themedOverlay(edl: { overlays: OverlayLike[] }, timeline: Timeline, analogy: Analogy, marginSec = ANALOGY_MARGIN_SEC): OverlayLike | null {
  const window = analogyWindow(analogy, timeline);
  if (!window) return null;
  for (const overlay of edl.overlays) {
    if (!wearsTheme(overlay, analogy)) continue;
    const start = sourceToOutput(timeline, overlay.at);
    if (start === null) continue;
    if (start < window.to + marginSec && start + overlay.duration > window.from - marginSec) return overlay;
  }
  return null;
}

/** Trecho pronto para `overlays[]`: o modelo que a forma da analogia pede, já no tema do universo. */
export function analogySnippet(analogy: Analogy): string {
  const model = analogy.model ?? 'AnalogiaAjudante';
  return `{ "id": "analogia-${analogy.universe}", "component": "scene:modelos/${model}", "at": ${Math.max(0, analogy.at - 0.2).toFixed(2)}, "duration": 6, "hidesCaptions": true, "props": { "theme": "${analogy.universe}", "title": "<a frase da analogia>" }, "reason": "analogia de ${analogy.name} na fala: o trecho entra no visual do universo" }`;
}

/**
 * `analogia-sem-tema`: a fala tem uma analogia de confiança alta e, durante a frase (± 2 s), nenhum overlay veste o
 * tema daquele universo. Analogia é marca do canal (STYLE.md §5): quando existe, ela dita o visual do trecho.
 * Função pura: as analogias vêm de `findAnalogies(words, phrases)`.
 */
export function findUnthemedAnalogies(edl: { overlays: OverlayLike[] }, timeline: Timeline, analogies: readonly Analogy[], minConfidence = HIGH_CONFIDENCE): Finding[] {
  const findings: Finding[] = [];
  for (const analogy of analogies) {
    if (analogy.confidence < minConfidence) continue;
    const window = analogyWindow(analogy, timeline);
    if (!window || themedOverlay(edl, timeline, analogy)) continue;
    const theme = analogyTheme(analogy);
    const own = theme.id === analogy.universe;
    findings.push({
      severity: 'warning',
      check: 'analogia-sem-tema',
      at: window.at,
      message: `a fala usa uma analogia de ${analogy.name} ("${analogy.text}", conf ${analogy.confidence.toFixed(2)}) e nenhum overlay do trecho está no tema "${analogy.universe}"`,
      fix:
        `use scene:modelos/${analogy.model ?? 'Analogia*'} com "theme": "${analogy.universe}" nesse trecho, ou ${THEME_FRAME} { "theme": "${analogy.universe}" } sobre o talking head` +
        (own ? '' : ` (o universo ainda usa o tema genérico "${theme.id}": peça ao motion-designer o tema próprio)`) +
        ' — `pnpm mce analogies <slug> -v` dá o trecho pronto',
    });
  }
  return findings;
}
