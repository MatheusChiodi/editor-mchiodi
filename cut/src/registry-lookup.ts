/** Registry de componentes e cenas (motion/src): carregado sob demanda, no mesmo pedaço da camada de gráficos. */
import { resolveComponent } from '../../motion/src/Overlay';
import type { ComponentLookup } from './lib/insert.ts';

export const lookupComponent: ComponentLookup = (name) => {
  const entry = resolveComponent(name);
  return entry ? { defaultDuration: entry.defaultDuration, sample: entry.sample } : undefined;
};
