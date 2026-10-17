import { AbsoluteFill, Sequence } from 'remotion';

import { StageLayer } from './arsenal/StageLayer';
import { Captions } from './captions/Captions';
import { type ComponentEntry, registry } from './components/registry';
import { sceneRegistry } from './scenes';
import type { OverlayItem, OverlayProps } from './types';
import { designSize, placeVertical, resolveVertical, type VerticalBox, type VerticalFrame } from './vertical';

const SCENE_PREFIX = 'scene:';

/** `LowerThird` vem da biblioteca; `scene:<projeto>/<Nome>` é uma cena feita sob medida para um vídeo. */
export function resolveComponent(name: string): ComponentEntry | undefined {
  return name.startsWith(SCENE_PREFIX) ? sceneRegistry[name.slice(SCENE_PREFIX.length)] : registry[name];
}

const OverlaySequence: React.FC<{ item: OverlayItem; entry: ComponentEntry; fps: number; size?: { width: number; height: number } }> = ({ item, entry, fps, size }) => {
  const Component = entry.component;
  return (
    <Sequence
      name={`${item.component} · ${item.id}`}
      from={item.from}
      durationInFrames={item.durationInFrames}
      premountFor={fps}
      // no Short o componente enxerga a caixa como quadro (useVideoConfig e AbsoluteFill)
      {...(size ?? {})}
    >
      <StageLayer stage={item.stage} wipe={item.wipe} opaque={entry.opaque} durationInFrames={item.durationInFrames}>
        <Component {...item.props} durationInFrames={item.durationInFrames} />
      </StageLayer>
    </Sequence>
  );
};

/**
 * Caixa do Short: o componente é desenhado no tamanho de projeto da caixa e escalado para dentro dela.
 * `overflow: hidden` garante que nem sombra nem entrada deslizante invadam a legenda.
 */
const VerticalSlot: React.FC<{ item: OverlayItem; entry: ComponentEntry; fps: number; box: VerticalBox }> = ({ item, entry, fps, box }) => {
  if (box.zone === 'frame') return <OverlaySequence item={item} entry={entry} fps={fps} />;
  const size = designSize(box);
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, ...size, transform: `scale(${box.scale})`, transformOrigin: '0 0' }}>
        <OverlaySequence item={item} entry={entry} fps={fps} size={size} />
      </div>
    </div>
  );
};

function verticalBox(item: OverlayItem, entry: ComponentEntry, frame: VerticalFrame): VerticalBox | null {
  return placeVertical(resolveVertical(item.component, entry.vertical, item.vertical), frame);
}

/** Camada única de gráficos sobre o footage. Renderizada com alfa e composta pelo ffmpeg. */
export const Overlay: React.FC<OverlayProps> = ({ fps, captions, captionStyle, captionPreset, overlays, vertical }) => {
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
        if (!vertical) return <OverlaySequence key={item.id} item={item} entry={entry} fps={fps} />;
        const box = verticalBox(item, entry, vertical);
        return box ? <VerticalSlot key={item.id} item={item} entry={entry} fps={fps} box={box} /> : null;
      })}
      <Captions captions={captions} style={captionStyle} preset={captionPreset} hidden={hidden} />
    </AbsoluteFill>
  );
};
