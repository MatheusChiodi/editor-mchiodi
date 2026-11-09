import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Edl } from '../edl/schema.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { cmx3600, fcp7, mlt, type NleInput, otio, toNleInput } from './formats.ts';

export const NLE_FORMATS = {
  mlt: { ext: 'mlt', build: mlt, opensIn: 'Shotcut (e melt)' },
  fcp7: { ext: 'xml', build: fcp7, opensIn: 'OpenShot, Kdenlive, Premiere, Resolve (Final Cut XML)' },
  edl: { ext: 'edl', build: cmx3600, opensIn: 'OpenShot, Kdenlive e a maioria dos editores (CMX3600)' },
  otio: { ext: 'otio', build: otio, opensIn: 'Kdenlive e editores com OpenTimelineIO' },
} satisfies Record<string, { ext: string; build: (input: NleInput) => string; opensIn: string }>;

export type NleFormat = keyof typeof NLE_FORMATS;
export const NLE_FORMAT_IDS = Object.keys(NLE_FORMATS) as NleFormat[];

/** Escreve os formatos pedidos em `dir` e devolve os arquivos. */
export function exportNle(edl: Edl, formats: NleFormat[], dir: string): { format: NleFormat; file: string; opensIn: string }[] {
  const input = toNleInput(edl, buildTimeline(edl.clips, edl.output.fps));
  mkdirSync(dir, { recursive: true });
  return formats.map((format) => {
    const { ext, build, opensIn } = NLE_FORMATS[format];
    const file = join(dir, `${edl.project}-v${edl.version}.${ext}`);
    writeFileSync(file, build(input), 'utf8');
    return { format, file, opensIn };
  });
}
