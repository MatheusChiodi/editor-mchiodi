import { BUDGET_KEYS, BUDGET_LABEL, formatMinimum, LEVEL_IDS, LEVELS, type LevelId } from '../../../../src/edl/levels.ts';
import { budgetUse } from '../../lib/ui.ts';
import { currentEdl, currentTimeline, store, useEditor } from '../../store.ts';
import { Badge, Section } from '../ui.tsx';

const STATUS_TONE = { ok: 'emerald', abaixo: 'peach', acima: 'coral', proibido: 'coral' } as const;

/** Nível: visível sempre, troca só com confirmação explícita (op setLevel com confirm: true). */
export function LevelPanel() {
  const edl = useEditor(currentEdl)!;
  const timeline = useEditor(currentTimeline)!;
  const profile = LEVELS[edl.level];
  const durationSec = timeline.durationSec;
  const counts: Record<(typeof BUDGET_KEYS)[number], number> = {
    zooms: edl.zooms.length,
    graphics: edl.overlays.filter((item) => !item.component.startsWith('scene:')).length,
    scenes: edl.overlays.filter((item) => item.component.startsWith('scene:')).length,
    transitions: edl.transitions.length,
    effects: edl.effects.length,
    sfx: edl.sfx.length,
  };
  return (
    <>
      <Section title="Nível de edição">
        <div className="grid grid-cols-4 gap-1">
          {LEVEL_IDS.map((id: LevelId) => (
            <button
              key={id}
              type="button"
              onClick={() => id !== edl.level && store.set({ levelConfirm: id })}
              className={`rounded-md border px-1 py-2 text-[11px] font-bold ${id === edl.level ? 'border-coral bg-coral/15 text-paper' : 'border-paper/10 text-s300/60 hover:border-paper/30 hover:text-paper'}`}
            >
              {LEVELS[id].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-paper/90">{profile.summary}</p>
        <p className="mt-1 text-[10px] text-s300/50">Só você troca o nível; a troca pede confirmação e entra como edição a salvar.</p>
      </Section>
      <Section title="O que o nível permite (por minuto)">
        <table className="w-full text-[11px]">
          <tbody>
            {BUDGET_KEYS.map((key) => {
              const rate = profile.perMinute[key];
              const use = budgetUse(counts[key], durationSec, rate);
              return (
                <tr key={key} className="border-b border-paper/[0.05]">
                  <td className="py-1 text-s300">{BUDGET_LABEL[key]}</td>
                  <td className="py-1 text-right font-mono text-s300/70">{rate.max === 0 ? 'nenhum' : `${rate.min}–${rate.max}`}</td>
                  <td className="py-1 text-right font-mono">{use.perMinute.toFixed(1)}</td>
                  <td className="py-1 pl-2 text-right">
                    <Badge tone={STATUS_TONE[use.status]}>{use.status}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ul className="mt-2 space-y-0.5 text-[10px] text-s300/60">
          <li>trilha: {profile.music ? 'do começo ao fim' : 'opcional'} · vinhetas: {profile.bumpers ? 'ligadas' : 'opcionais'}</li>
          <li>
            distância mínima: zoom {profile.limits.zoomMinGapSec}s · gráfico {profile.limits.graphicMinGapSec}s · transição {profile.limits.transitionMinGapSec}s
          </li>
          {profile.broll.perMinute > 0 && <li>b-roll: até {profile.broll.perMinute}/min</li>}
        </ul>
      </Section>
      {profile.required.length > 0 && (
        <Section title="Padrões obrigatórios">
          <ul className="space-y-1 text-[11px]">
            {profile.required.map((pattern) => (
              <li key={pattern.id}>
                <span className="font-semibold text-paper">{pattern.label}</span> <span className="font-mono text-s300/60">{formatMinimum(pattern)}</span>
                <div className="text-[10px] text-s300/50">{pattern.when}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Como dirigir">
        <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-s300/80">
          {profile.guidance.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}
