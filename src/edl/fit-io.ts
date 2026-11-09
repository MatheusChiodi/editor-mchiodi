import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Footprints } from './fit.ts';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'motion', 'src', 'arsenal', 'footprints.json');

/** Medidas de `scripts/measure-footprints.ts`; sem o arquivo, nada é ajustado (o render segue como antes). */
export function loadFootprints(): Footprints {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Footprints;
  } catch {
    return {};
  }
}
