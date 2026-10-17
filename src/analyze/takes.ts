import type { Analogy } from '../analogy/detect.ts';
import { takesMark, takesSection } from '../analogy/report.ts';
import { formatClock } from '../lib/time.ts';
import type { TechMention } from '../tech/detect.ts';
import { phraseTechMark, takesTechSection } from '../tech/report.ts';
import type { Analysis, Flag, Phrase } from './types.ts';

const FLAG_LABEL: Record<Flag['kind'], string> = {
  retake: 'RETAKE',
  restart: 'RECOMEÇO',
  marker: 'CORTA',
  filler: 'HESITAÇÃO',
  'voiced-gap': 'SOM SEM PALAVRA',
};

function stamp(seconds: number): string {
  return formatClock(seconds, 2);
}

/** Seções opcionais do takes.md, calculadas fora (cada uma entra só quando tem conteúdo). */
export interface TakesExtras {
  /** analogias de universo na fala (`findAnalogies`): seção "Analogias" + marca `>> ANALOGIA` na frase */
  analogies?: Analogy[];
  /** tecnologias citadas (`findTechMentions`): seção "Tecnologias citadas" + ` [tech: …]` no fim da linha da frase */
  tech?: TechMention[];
}

/**
 * takes.md: o vídeo em forma de texto. É o que o diretor lê em vez de assistir.
 * Tempos são da FONTE, no mesmo referencial da EDL.
 */
export function renderTakes(analysis: Analysis, minFlagConfidence: number, extras: TakesExtras = {}): string {
  const { source, loudness, phrases, flags, silences, scenes } = analysis;
  const speech = phrases.reduce((total, phrase) => total + (phrase.end - phrase.start), 0);
  const longPauses = phrases.filter((phrase) => phrase.pauseAfter >= 1).length;
  const lines: string[] = [
    `# takes — ${source.path.split(/[\\/]/).pop()}`,
    '',
    `- duração: ${stamp(source.durationSec)} (${source.durationSec.toFixed(1)}s) · ${source.width}x${source.height} @ ${source.fps} fps${source.isVfr ? ' (VFR, normalizado para CFR)' : ''}`,
    `- fala: ${speech.toFixed(0)}s em ${phrases.length} frases · silêncio detectado: ${silences
      .reduce((total, span) => total + (span.end - span.start), 0)
      .toFixed(0)}s · pausas ≥ 1s: ${longPauses}`,
    `- loudness: ${loudness.integratedLufs.toFixed(1)} LUFS · pico ${loudness.truePeakDb.toFixed(1)} dBTP · LRA ${loudness.lra.toFixed(1)}`,
    `- trocas de cena: ${scenes.length ? scenes.map(stamp).join(', ') : 'nenhuma (plano único)'}`,
    '',
    'Formato: `ID início–fim (duração) texto` · `‖ 1.2s` = pausa depois da frase.',
    `Marcas \`>>\` são sugestões de corte da análise; as com confiança ≥ ${minFlagConfidence} já entram no corte automático.`,
    'Tempos em mm:ss.cc do arquivo fonte. Para palavras exatas: `pnpm mce words <projeto> --from <s> --to <s>`.',
    '',
    ...takesSection(extras.analogies ?? []),
    ...takesTechSection(extras.tech ?? []),
  ];

  const pending = [...flags].sort((a, b) => a.start - b.start);
  for (const phrase of phrases) {
    lines.push(formatPhrase(phrase) + phraseTechMark(extras.tech ?? [], phrase));
    for (const analogy of extras.analogies ?? []) if (analogy.phraseId === phrase.id) lines.push(takesMark(analogy));
    while (pending.length && pending[0]!.start < phrase.end + phrase.pauseAfter) {
      const flag = pending.shift()!;
      const auto = flag.kind !== 'voiced-gap' && flag.confidence >= minFlagConfidence ? 'auto' : 'sugestão';
      lines.push(
        `   >> ${FLAG_LABEL[flag.kind]} ${stamp(flag.start)}–${stamp(flag.end)} [${auto}, conf ${flag.confidence.toFixed(2)}] ${flag.reason}`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

function formatPhrase(phrase: Phrase): string {
  const duration = (phrase.end - phrase.start).toFixed(1);
  const pause = phrase.pauseAfter >= 0.6 ? `  ‖ ${phrase.pauseAfter.toFixed(1)}s` : '';
  return `${phrase.id} ${stamp(phrase.start)}–${stamp(phrase.end)} (${duration}s) ${phrase.text}${pause}`;
}
