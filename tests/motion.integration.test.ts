import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { detectStills } from '../src/analyze/motion.ts';
import { ffmpeg } from '../src/lib/ffmpeg.ts';

/** 0–2s: quadro cinza parado; 2–4s: padrão em movimento. */
const dir = mkdtempSync(join(tmpdir(), 'mce-motion-'));
const video = join(dir, 'still-then-motion.mp4');

beforeAll(async () => {
  await ffmpeg([
    '-f', 'lavfi', '-i', 'color=c=gray:s=320x180:r=30:d=2',
    '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=2',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]',
    '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video,
  ]);
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('detectStills (ffmpeg de verdade)', () => {
  it('acha o trecho parado e ignora o que se mexe', async () => {
    const stills = await detectStills(video, { width: 320, height: 180 }, { minStillSec: 0.5 });
    expect(stills).toHaveLength(1);
    expect(stills[0]!.start).toBe(0);
    expect(stills[0]!.end).toBeGreaterThan(1.7);
    expect(stills[0]!.end).toBeLessThan(2.3);
  }, 60_000);
});
