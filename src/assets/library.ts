import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { ffmpeg } from '../lib/ffmpeg.ts';
import { ASSETS_DIR } from '../project/paths.ts';

export type AssetKind = 'music' | 'sfx' | 'memes' | 'luts' | 'brand';

/** Resolve um asset da EDL: caminho absoluto, ou nome relativo à pasta do tipo em assets/. */
export function resolveAsset(kind: AssetKind, file: string, root = ASSETS_DIR): string | null {
  const candidates = isAbsolute(file) ? [file] : [join(root, kind, file), join(root, file)];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function listAssets(kind: AssetKind, root = ASSETS_DIR): string[] {
  const dir = join(root, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort();
}

/**
 * Efeitos sintetizados pelo próprio ffmpeg: livres de direitos por construção e reproduzíveis.
 * Cada receita é uma fonte lavfi + filtros; todos saem em 48 kHz estéreo.
 */
export const SFX_RECIPES: Record<string, { source: string; filters: string }> = {
  // ruído rosa com envelope de sopro: sobe rápido, some suave
  'whoosh.wav': {
    source: 'anoisesrc=d=0.5:c=pink:a=0.8:r=48000',
    filters: 'highpass=f=350,lowpass=f=5200,afade=t=in:st=0:d=0.22:curve=qsin,afade=t=out:st=0.24:d=0.26,volume=1.6',
  },
  // senoide com queda de afinação e decaimento exponencial
  'pop.wav': {
    source: "aevalsrc='0.7*sin(2*PI*(760-2600*t)*t)*exp(-34*t)':d=0.16:s=48000",
    filters: 'afade=t=in:st=0:d=0.003',
  },
  'click.wav': {
    source: "aevalsrc='0.6*sin(2*PI*2100*t)*exp(-140*t)':d=0.05:s=48000",
    filters: 'afade=t=in:st=0:d=0.001',
  },
  // duas parciais de sino
  'ding.wav': {
    source: "aevalsrc='(0.45*sin(2*PI*1320*t)+0.25*sin(2*PI*1980*t))*exp(-5.5*t)':d=0.9:s=48000",
    filters: 'afade=t=in:st=0:d=0.004,afade=t=out:st=0.7:d=0.2',
  },
  // ruído branco degradado e picotado
  'glitch.wav': {
    source: 'anoisesrc=d=0.24:c=white:a=0.5:r=48000',
    filters: 'acrusher=bits=5:samples=24:mode=log,tremolo=f=38:d=0.9,highpass=f=500,afade=t=out:st=0.16:d=0.08',
  },
};

export function sfxArgs(recipe: { source: string; filters: string }, output: string): string[] {
  return ['-f', 'lavfi', '-i', recipe.source, '-af', `${recipe.filters},aformat=channel_layouts=stereo`, '-ar', '48000', '-c:a', 'pcm_s16le', output];
}

/** Gera a biblioteca-base de SFX em assets/sfx (não sobrescreve arquivos que você já colocou lá). */
export async function generateSfx(root = ASSETS_DIR, force = false): Promise<string[]> {
  const dir = join(root, 'sfx');
  mkdirSync(dir, { recursive: true });
  const created: string[] = [];
  for (const [name, recipe] of Object.entries(SFX_RECIPES)) {
    const output = join(dir, name);
    if (existsSync(output) && !force) continue;
    await ffmpeg(sfxArgs(recipe, output));
    created.push(name);
  }
  return created;
}
