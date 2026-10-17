// Tema NEUTRO: o estilo padrão do canal (papel, glows, traço limpo). É o que os modelos de analogia usam sem `theme`.

import { theme as brand } from '../../theme';
import { defineTheme, PAWN_ACTORS } from '../shared/generic';
import type { SceneryProps } from '../shared/kit';
import { fade } from '../shared/math';
import { themeSpec } from '../specs';

const spec = themeSpec('neutro');

const Far: React.FC<SceneryProps> = ({ t }) => {
  const drift = Math.sin(t * 0.6) * 40;
  return (
    <>
      <defs>
        <radialGradient id="neutro-mint">
          <stop offset="0" stopColor={fade(brand.color.glowMint, 0.6)} />
          <stop offset="0.45" stopColor={fade(brand.color.glowPeriwinkle, 0.27)} />
          <stop offset="1" stopColor={fade(brand.color.glowPeriwinkle, 0)} />
        </radialGradient>
        <radialGradient id="neutro-peach">
          <stop offset="0" stopColor={fade(brand.color.glowPeriwinkle, 0.55)} />
          <stop offset="0.45" stopColor={fade(brand.color.glowPeach, 0.27)} />
          <stop offset="1" stopColor={fade(brand.color.glowPeach, 0)} />
        </radialGradient>
      </defs>
      <circle cx={150} cy={90 + drift} r={640} fill="url(#neutro-mint)" />
      <circle cx={1780} cy={1010 - drift} r={640} fill="url(#neutro-peach)" />
    </>
  );
};

const Near: React.FC<SceneryProps> = ({ palette, ground }) => (
  <>
    <defs>
      <linearGradient id="neutro-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={fade(palette.ground, 0.95)} />
        <stop offset="1" stopColor={fade(palette.ground, 0)} />
      </linearGradient>
    </defs>
    <rect x={-500} y={ground} width={2920} height={260} fill="url(#neutro-floor)" />
    <path d={`M-500 ${ground}H2420`} stroke={fade(palette.shade, 0.9)} strokeWidth={2} />
  </>
);

export const neutro = defineTheme(spec, {
  parts: { Far, Near, actors: PAWN_ACTORS, grain: 0.12, vignette: 0.14 },
  panel: { radius: 24, border: 2, shadow: '0 54px 105px -60px rgba(15,23,42,0.45)', decor: 'card' },
  bar: { kind: 'smooth', radius: 999 },
});
