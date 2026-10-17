import { describe, expect, it } from 'vitest';

import { transitions, xfadeArgs } from '../src/arsenal/transitions.ts';
import { run } from '../src/lib/exec.ts';

/**
 * Cada preset `xfade` passa pelo ffmpeg de verdade em mídia sintética minúscula: nome nativo que
 * não existe nesta build ou expressão custom com erro de sintaxe quebra aqui, não no render do vídeo.
 */
const xfadePresets = Object.values(transitions).filter((preset) => preset.kind === 'xfade');

describe('arsenal de transições: xfade no ffmpeg (integração)', () => {
  it.each(xfadePresets.map((preset) => [preset.id, preset] as const))(
    '%s é aceito pelo ffmpeg',
    async (_id, preset) => {
      const graph = `[0:v][1:v]xfade=${xfadeArgs(preset)}:duration=0.4:offset=0.6,format=yuv420p[v]`;
      const { stderr } = await run('ffmpeg', [
        '-hide_banner', '-v', 'error', '-nostats',
        '-f', 'lavfi', '-i', 'testsrc2=s=160x90:r=30:d=1',
        '-f', 'lavfi', '-i', 'color=c=0xff5555:s=160x90:r=30:d=1',
        '-filter_complex', graph,
        '-map', '[v]', '-f', 'null', '-',
      ]);
      expect(stderr.trim()).toBe('');
    },
    60_000,
  );
});
