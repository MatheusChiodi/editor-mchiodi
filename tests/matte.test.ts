import { describe, expect, it } from 'vitest';

import { matteArgs } from '../src/render/matte.ts';

describe('matteArgs', () => {
  it('monta o contrato do sidecar matting/matte.py', () => {
    const args = matteArgs('in.mkv', 'out.mkv', { width: 1920, height: 1080, fps: 30, frames: 900, downsample: 0.267 });
    expect(args[0]).toMatch(/matting[\\/]matte\.py$/);
    const flags = Object.fromEntries(args.slice(1).reduce<string[][]>((pairs, value, index, all) => (index % 2 === 0 ? [...pairs, [value, all[index + 1]!]] : pairs), []));
    expect(flags).toEqual({
      '--input': 'in.mkv',
      '--output': 'out.mkv',
      '--width': '1920',
      '--height': '1080',
      '--fps': '30',
      '--frames': '900',
      '--downsample': '0.267',
      '--variant': 'mobilenetv3',
      '--device': 'cuda',
    });
  });
});
