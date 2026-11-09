/**
 * Sincronia dos componentes de palco com a duração do overlay: lógica pura (sem React nem Remotion).
 *
 * Os componentes revelam itens em instantes dados (`at`, `wordAt`, `revealAt`) ou numa cascata padrão. Dois
 * problemas aparecem quando o overlay é curto ou a fala demora: um item entra tarde demais para ser lido (ou
 * depois que o overlay já saiu), e a cascata padrão estoura a duração. Estas funções puxam os instantes para o
 * que ainda dá para ler: o último item precisa de `readSec` na tela antes da saída; quem foi falado cedo
 * continua no instante dito.
 */
import { stageMotion } from '../arsenal/stage';
import { LAST_ENTRY_SEC, minReadSec } from './read-time';

/** Defasagem mínima entre duas entradas puxadas para trás: elas continuam em cascata, não colam. */
export const ENTRY_GAP = 0.25;
/** Passo mínimo da cascata padrão quando ela é comprimida para caber: abaixo disso as entradas parecem simultâneas. */
export const MIN_STEP = 0.3;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Último instante (s) em que um item que precisa de `readSec` pode entrar e ainda ser lido antes da saída. */
export function entryDeadline(durationSec: number, readSec: number = LAST_ENTRY_SEC): number {
  return Math.max(0, durationSec - stageMotion.exit.sec - Math.max(0, readSec));
}

/** Leitura mínima de cada texto (s): a mesma conta da autoavaliação (1,2 s + 0,25 s por palavra). */
export const readTimes = (texts: readonly string[]): number[] => texts.map((text) => minReadSec(text));

/**
 * Puxa para trás os instantes que não deixam tempo de leitura. `readSec` é um valor para todos ou um por item.
 * Os que já cabem não mudam. Quando um item é puxado, os anteriores recuam no mínimo `gap` antes dele
 * (cascata preservada). O resultado nunca é negativo nem decrescente.
 */
export function fitEntryTimes(times: readonly number[], durationSec: number, readSec: number | readonly number[] = LAST_ENTRY_SEC, gap: number = ENTRY_GAP): number[] {
  if (!finite(durationSec) || durationSec <= 0 || times.length === 0) return [...times];
  const out = [...times];
  const read = (index: number) => (typeof readSec === 'number' ? readSec : (readSec[index] ?? LAST_ENTRY_SEC));
  let pulled = false;
  for (let index = out.length - 1; index >= 0; index -= 1) {
    const limit = Math.min(entryDeadline(durationSec, read(index)), pulled ? out[index + 1]! - gap : out[index + 1] ?? Infinity);
    const next = Math.min(out[index]!, limit);
    pulled = next < out[index]!;
    out[index] = next;
  }
  // piso em 0 e ordem crescente (quando o overlay é curto demais, os itens colapsam nos primeiros instantes)
  return out.map((time, index) => (out[index] = Math.max(0, time, index > 0 ? out[index - 1]! : 0)));
}

/**
 * Passo da cascata padrão (s entre itens): `step`, comprimido quando `count` itens a partir de `start` não
 * caberiam até o prazo da última entrada. Nunca abaixo de `MIN_STEP` nem acima de `step`.
 */
export function fitStep(count: number, start: number, step: number, durationSec: number, readSec: number = LAST_ENTRY_SEC): number {
  if (count <= 1 || !finite(durationSec) || durationSec <= 0) return step;
  const room = entryDeadline(durationSec, readSec) - start;
  return Math.min(step, Math.max(MIN_STEP, room / (count - 1)));
}

/**
 * Atalho dos componentes: instantes dados (`given`, `undefined` = automático) → cascata a partir de `start` com
 * passo ajustado à duração, depois `fitEntryTimes`. Sem `durationSec` válido, devolve a conta antiga.
 */
export function entryTimes(
  given: readonly (number | undefined)[],
  start: number,
  step: number,
  durationSec: number | undefined,
  readSec: number | readonly number[] = LAST_ENTRY_SEC,
): number[] {
  const lastRead = typeof readSec === 'number' ? readSec : (readSec[given.length - 1] ?? LAST_ENTRY_SEC);
  const usable = finite(durationSec) && durationSec > 0 ? durationSec : null;
  const useStep = usable === null ? step : fitStep(given.length, start, step, usable, lastRead);
  const times: number[] = [];
  given.forEach((value, index) => {
    const previous = times[index - 1];
    const time = finite(value) && value >= 0 ? value : previous === undefined ? start : previous + useStep;
    times.push(Math.max(time, previous ?? 0));
  });
  return usable === null ? times : fitEntryTimes(times, usable, readSec);
}

/**
 * Começo do marca-texto: `markAt` ou o padrão, limitado para o traço (`runSec`) terminar com folga antes da saída.
 * Overlay curto demais para o traço inteiro: começa em 0,2 s.
 */
export function fitMarkStart(start: number, durationSec: number | undefined, runSec: number, lingerSec = 0.5): number {
  if (!finite(durationSec) || durationSec <= 0) return start;
  return Math.max(0.2, Math.min(start, durationSec - stageMotion.exit.sec - runSec - lingerSec));
}
