import { AbsoluteFill, Sequence } from 'remotion';

import { StageLayer } from './arsenal/StageLayer';
import { Captions } from './captions/Captions';
import { type ComponentEntry, registry } from './components/registry';
import { sceneRegistry } from './scenes';
import type { OverlayProps } from './types';

const SCENE_PREFIX = 'scene:';

/** `LowerThird` vem da biblioteca; `scene:<projeto>/<Nome>` é uma cena feita sob medida para um vídeo. */
export function resolveComponent(name: string): ComponentEntry | undefined {
  return name.startsWith(SCENE_PREFIX) ? sceneRegistry[name.slice(SCENE_PREFIX.length)] : registry[name];
}

/** Camada única de gráficos sobre o footage. Renderizada com alfa e composta pelo ffmpeg. */
export const Overlay: React.FC<OverlayProps> = ({ fps, captions, captionStyle, overlays }) => {
  const hidden = overlays
    .filter((item) => item.hidesCaptions)
    .map((item): [number, number] => [item.from, item.from + item.durationInFrames]);

  // a camada fixa (indicador de progresso) fica por cima do gráfico da vez, qualquer que seja a ordem na EDL
  const layered = [...overlays.filter((item) => item.layer !== 'persistent'), ...overlays.filter((item) => item.layer === 'persistent')];

  return (
    <AbsoluteFill>
      {layered.map((item) => {
        const entry = resolveComponent(item.component);
        if (!entry) throw new Error(`Componente "${item.component}" não existe (overlay ${item.id})`);
        const Component = entry.component;
        return (
          <Sequence
            key={item.id}
            name={`${item.component} · ${item.id}`}
            from={item.from}
            durationInFrames={item.durationInFrames}
            premountFor={fps}
          >
            <StageLayer stage={item.stage} wipe={item.wipe} opaque={entry.opaque} durationInFrames={item.durationInFrames}>
              <Component {...item.props} durationInFrames={item.durationInFrames} />
            </StageLayer>
          </Sequence>
        );
      })}
      <Captions captions={captions} style={captionStyle} hidden={hidden} />
    </AbsoluteFill>
  );
};
