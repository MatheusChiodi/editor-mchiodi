import type { LevelProfile } from '../edl/levels.ts';
import type { Edl } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { formatClock } from '../lib/time.ts';
import { TECH_BY_ID, TECH_PREFIX } from '../tech/catalog.ts';
import { summarizeTech, type TechMention } from '../tech/detect.ts';
import { overlayTechIds } from '../tech/overlay.ts';
import type { Finding } from './checks.ts';

/** Depois da menção, o ícone tem este tempo (s do vídeo final) para estar na tela. */
export const TECH_ICON_WINDOW = 6;
/** O ícone pode ter saído até este tempo antes da menção e ainda conta (o overlay entrou um pouco adiantado). */
export const TECH_ICON_LEAD = 1;
/** Em `pro`/`max`, tecnologia que volta à fala depois deste silêncio sobre ela (s) é tratada como nova e pede o ícone de novo. */
export const TECH_REINTRO_GAP = 60;

interface Shown {
  start: number;
  end: number;
}

/**
 * Tecnologia citada sem ícone na tela. A fala cita a tecnologia (confiança alta) e, de `TECH_ICON_LEAD` antes a
 * `TECH_ICON_WINDOW` depois da menção, nenhum overlay mostra o ícone dela (`tech:<id>` num prop, rótulo que o componente
 * detecta sozinho, `TechBadge`/`TechRow`). `normal`: só a primeira menção de cada uma; `pro`/`max`: também quando ela
 * volta depois de `TECH_REINTRO_GAP` sem ser citada nem mostrada; `limpa` não cobra. As menções vêm por parâmetro
 * (`findTechMentions`), em tempo da fonte; as cortadas pela EDL não contam.
 */
export function findMissingTechIcons(
  edl: Pick<Edl, 'overlays'>,
  timeline: Timeline,
  mentions: readonly TechMention[],
  profile: Pick<LevelProfile, 'id'>,
): Finding[] {
  if (profile.id === 'limpa') return [];
  const shown = new Map<string, Shown[]>();
  for (const overlay of edl.overlays) {
    const start = sourceToOutput(timeline, overlay.at);
    if (start === null) continue;
    for (const tech of overlayTechIds(overlay.component, overlay.props)) {
      shown.set(tech, [...(shown.get(tech) ?? []), { start, end: start + overlay.duration }]);
    }
  }

  const reintro = profile.id === 'pro' || profile.id === 'max';
  const findings: Finding[] = [];
  for (const summary of summarizeTech(mentions.filter((mention) => mention.confidence === 'high'))) {
    // sem desenho no conjunto (monograma) não há ícone a cobrar
    if (TECH_BY_ID.get(summary.tech)?.icon == null) continue;
    const spans = shown.get(summary.tech) ?? [];
    let lastSeen: number | null = null;
    for (const mention of summary.mentions) {
      const at = sourceToOutput(timeline, mention.start);
      if (at === null) continue;
      const seenBefore = Math.max(lastSeen ?? -Infinity, ...spans.filter((span) => span.end <= at).map((span) => span.end));
      const due = lastSeen === null || (reintro && at - seenBefore >= TECH_REINTRO_GAP);
      const again = lastSeen !== null;
      lastSeen = at;
      if (!due || spans.some((span) => span.start <= at + TECH_ICON_WINDOW && span.end >= at - TECH_ICON_LEAD)) continue;
      findings.push({
        severity: 'warning',
        check: 'tecnologia-sem-icone',
        at,
        message: again
          ? `${summary.name} volta à fala em ${formatClock(at, 2)} depois de mais de ${TECH_REINTRO_GAP}s e o ícone não reaparece (fonte ${mention.start.toFixed(2)}s, "${mention.heard}")`
          : `${summary.name} é citada pela primeira vez em ${formatClock(at, 2)} e nenhum overlay mostra o ícone nos ${TECH_ICON_WINDOW}s seguintes (fonte ${mention.start.toFixed(2)}s, "${mention.heard}")`,
        fix: `overlays[]: { "component": "TechBadge", "at": ${mention.start.toFixed(2)}, "duration": 3, "props": { "tech": "${summary.tech}" } } — ou "${TECH_PREFIX}${summary.tech}" no ícone de um overlay desse trecho; várias na mesma frase pedem um TechRow com revealAt`,
      });
    }
  }
  return findings.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}
