/**
 * Camada de gráficos do preview: a MESMA composição `Overlay` de motion/src que o render usa, com as props montadas
 * pela mesma função (src/render/overlay-props.ts). Fica parada; o playhead do editor manda o frame (seekTo).
 */
import { Player, type PlayerRef } from '@remotion/player';
import { Component, type ReactNode, useEffect, useRef, useState } from 'react';

import { Overlay } from '../../../motion/src/Overlay';
import { sourceToOutput, type Timeline } from '../../../src/edl/timeline.ts';
import type { PreviewModel } from '../lib/preview-model.ts';
import { playhead } from '../store.ts';

class Boundary extends Component<{ children: ReactNode; reset: unknown }, { error: string | null; reset: unknown }> {
  override state = { error: null as string | null, reset: null as unknown };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  static getDerivedStateFromProps(props: { reset: unknown }, state: { reset: unknown }) {
    return props.reset !== state.reset ? { error: null, reset: props.reset } : null;
  }
  override render() {
    if (this.state.error) return <div className="absolute top-2 right-2 max-w-[60%] rounded bg-night/80 px-2 py-1 text-[10px] text-coral">gráficos: {this.state.error}</div>;
    return this.props.children;
  }
}

interface Props {
  /** props da composição (o Preview as monta: o palco e os zooms de ajuste leem as mesmas) */
  model: PreviewModel;
  /** fps/duração da timeline, para o playhead virar frame */
  timeline: Timeline;
  width: number;
  height: number;
}

export default function GraphicsLayer({ model, timeline, width, height }: Props) {
  const player = useRef<PlayerRef>(null);
  const [cut, setCut] = useState(false);
  const built = model;

  useEffect(() => {
    const sync = () => {
      const output = sourceToOutput(timeline, playhead.get().source);
      setCut(output === null);
      if (output !== null && player.current) player.current.seekTo(Math.round(output * timeline.fps));
    };
    sync();
    return playhead.subscribe(sync);
  }, [timeline]);

  if (!built.props) return <div className="absolute top-2 right-2 rounded bg-night/80 px-2 py-1 text-[10px] text-coral">gráficos: {built.error}</div>;
  const { props } = built;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ opacity: cut ? 0 : 1 }}>
      <Boundary reset={props}>
        <Player
          ref={player}
          component={Overlay}
          inputProps={props}
          durationInFrames={Math.max(1, props.durationInFrames)}
          compositionWidth={props.width}
          compositionHeight={props.height}
          fps={props.fps}
          style={{ width, height, background: 'transparent' }}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          acknowledgeRemotionLicense
        />
      </Boundary>
    </div>
  );
}
