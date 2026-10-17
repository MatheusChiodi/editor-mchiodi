import { type CalculateMetadataFunction, Composition, Folder } from 'remotion';

import { EntranceGallery, galleryPages } from './arsenal/EntranceGallery';
import { Fx, fxVariants } from './arsenal/fx/Fx';
import { Stinger, stingerVariants } from './arsenal/stingers/Stinger';
import { Captions } from './captions/Captions';
import { CAPTION_PRESETS, type CaptionPreset } from './captions/presets';
import { cineDemos } from './cine/demos';
import { registry } from './components/registry';
import { Overlay } from './Overlay';
import { Backdrop } from './preview/Backdrop';
import { sampleCaptions } from './preview/sample-captions';
import { reelDuration, reelParts, SceneReel } from './preview/SceneReel';
import { sceneCompositions, sceneReels, sceneRegistry } from './scenes';
import { THUMB } from './thumbnail/layout';
import { Thumbnail, thumbnailSample } from './thumbnail/Thumbnail';
import type { CaptionStyle, OverlayProps } from './types';

const FPS = 30;

/** Dimensões e duração vêm das props geradas pelo pipeline (`mce render`). */
const overlayMetadata: CalculateMetadataFunction<OverlayProps> = ({ props }) => ({
  fps: props.fps,
  width: props.width,
  height: props.height,
  durationInFrames: props.durationInFrames,
  defaultCodec: 'prores',
  defaultVideoImageFormat: 'png',
  defaultPixelFormat: 'yuva444p10le',
  defaultProResProfile: '4444',
});

const CaptionsPreview: React.FC<{ style: CaptionStyle; preset?: CaptionPreset }> = ({ style, preset }) => (
  <Backdrop>
    <Captions captions={sampleCaptions} style={style} preset={preset} />
  </Backdrop>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Overlay"
      component={Overlay}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={FPS * 8}
      defaultProps={{
        fps: FPS,
        width: 1920,
        height: 1080,
        durationInFrames: FPS * 8,
        captions: sampleCaptions,
        captionStyle: 'long',
        overlays: [],
      }}
      calculateMetadata={overlayMetadata}
    />
    <Folder name="Cinema">
      {cineDemos.map((demo) => (
        <Composition key={demo.id} id={demo.id} component={demo.component} fps={FPS} width={1920} height={1080} durationInFrames={demo.durationInFrames} />
      ))}
    </Folder>
    <Folder name="Capa">
      <Composition id="Thumbnail" component={Thumbnail} fps={FPS} width={THUMB.width} height={THUMB.height} durationInFrames={1} defaultProps={thumbnailSample} />
    </Folder>
    <Folder name="Legendas">
      <Composition
        id="Legendas-Longo"
        component={CaptionsPreview}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={FPS * 8}
        defaultProps={{ style: 'long' as const }}
      />
      <Composition
        id="Legendas-Shorts"
        component={CaptionsPreview}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={FPS * 8}
        defaultProps={{ style: 'shorts' as const }}
      />
      {/* um por estilo (`captions.preset`), nos dois formatos: `pnpm mce still Legendas-<preset>-long` */}
      {CAPTION_PRESETS.flatMap((preset) =>
        (['long', 'shorts'] as const).map((style) => (
          <Composition
            key={`${preset}-${style}`}
            id={`Legendas-${preset}-${style}`}
            component={CaptionsPreview}
            fps={FPS}
            width={style === 'long' ? 1920 : 1080}
            height={style === 'long' ? 1080 : 1920}
            durationInFrames={FPS * 8}
            defaultProps={{ style, preset }}
          />
        )),
      )}
    </Folder>
    <Folder name="Entradas">
      {galleryPages.map((ids, index) => (
        <Composition
          key={index}
          id={`Entradas-${index + 1}`}
          component={() => (
            <Backdrop>
              <EntranceGallery ids={ids} />
            </Backdrop>
          )}
          fps={FPS}
          width={1920}
          height={1080}
          durationInFrames={FPS * 6}
        />
      ))}
    </Folder>
    <Folder name="Transicoes">
      {stingerVariants.map((variant) => (
        <Composition
          key={variant}
          id={`Stinger-${variant}`}
          component={() => (
            <Backdrop>
              <Stinger variant={variant} durationInFrames={FPS} />
            </Backdrop>
          )}
          fps={FPS}
          width={1920}
          height={1080}
          durationInFrames={FPS}
        />
      ))}
    </Folder>
    <Folder name="Efeitos">
      {fxVariants.map((variant) => (
        <Composition
          key={variant}
          id={`Fx-${variant}`}
          component={() => (
            <Backdrop>
              <Fx variant={variant} intensity={0.6} durationInFrames={FPS * 4} />
            </Backdrop>
          )}
          fps={FPS}
          width={1920}
          height={1080}
          durationInFrames={FPS * 4}
        />
      ))}
    </Folder>
    <Folder name="Roteiros">
      {sceneReels.map(({ id, keys }) => {
        const parts = reelParts(keys, sceneRegistry, FPS);
        return (
          <Composition
            key={id}
            id={id}
            component={() => <SceneReel parts={parts} registry={sceneRegistry} />}
            fps={FPS}
            width={1920}
            height={1080}
            durationInFrames={reelDuration(parts)}
          />
        );
      })}
    </Folder>
    <Folder name="Cenas">
      {sceneCompositions.map(({ id, key }) => {
        const entry = sceneRegistry[key]!;
        const Component = entry.component;
        const durationInFrames = Math.round(entry.defaultDuration * FPS);
        return (
          <Composition
            key={id}
            id={id}
            component={() => <Component {...entry.sample} durationInFrames={durationInFrames} />}
            fps={FPS}
            width={1920}
            height={1080}
            durationInFrames={durationInFrames}
          />
        );
      })}
    </Folder>
    <Folder name="Componentes">
      {Object.entries(registry).map(([name, entry]) => {
        const Component = entry.component;
        return (
          <Composition
            key={name}
            id={name}
            component={() => (
              <Backdrop>
                <Component {...entry.sample} durationInFrames={Math.round(entry.defaultDuration * FPS)} />
              </Backdrop>
            )}
            fps={FPS}
            width={1920}
            height={1080}
            durationInFrames={Math.round(entry.defaultDuration * FPS)}
          />
        );
      })}
    </Folder>
  </>
);
