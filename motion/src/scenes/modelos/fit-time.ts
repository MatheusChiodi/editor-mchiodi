// Ajuste dos tempos de revelação de um modelo à duração do overlay. Só funções puras (testadas em tests/models-time.test.ts).
// Nome em minúsculas: o `scenes sync` só registra arquivos PascalCase.
import { stageMotion } from '../../arsenal/stage';
import { fitEntryTimes } from '../../components/timing';

/** Último item entra com pelo menos isto (s) de tela antes da saída da cena. */
export const SCENE_TAIL_SEC = 1.2;
/** Vão mínimo (s) entre itens puxados para trás. */
export const SCENE_GAP_SEC = 0.15;

/**
 * Puxa para dentro da duração os tempos (array, objeto ou aninhados) que não deixam `SCENE_TAIL_SEC` de tela
 * ao último. Os que já cabem não mudam; a ordem entre eles é mantida (valores iguais ficam na ordem de leitura).
 * Sem duração válida devolve o próprio valor. Não muta a entrada.
 */
export function fitSceneTimes<T>(times: T, durationSec: number | undefined): T {
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) return times;
  const slots: { get: () => number; set: (value: number) => void }[] = [];
  const clone = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const copy: unknown[] = [];
      value.forEach((item, index) => {
        if (typeof item === 'number' && Number.isFinite(item)) {
          copy[index] = item;
          slots.push({ get: () => copy[index] as number, set: (next) => void (copy[index] = next) });
        } else copy[index] = clone(item);
      });
      return copy;
    }
    if (value && typeof value === 'object') {
      const copy: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        if (typeof item === 'number' && Number.isFinite(item)) {
          copy[key] = item;
          slots.push({ get: () => copy[key] as number, set: (next) => void (copy[key] = next) });
        } else copy[key] = clone(item);
      }
      return copy;
    }
    return value;
  };
  const copy = clone(times);
  const ordered = slots.map((slot, order) => ({ slot, order })).sort((a, b) => a.slot.get() - b.slot.get() || a.order - b.order);
  const fitted = fitEntryTimes(
    ordered.map((entry) => entry.slot.get()),
    durationSec,
    SCENE_TAIL_SEC - stageMotion.exit.sec,
    SCENE_GAP_SEC,
  );
  ordered.forEach((entry, index) => entry.slot.set(Math.round(fitted[index]! * 1000) / 1000));
  return copy as T;
}
