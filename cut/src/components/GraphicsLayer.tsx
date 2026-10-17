/**
 * Camada de gráficos do preview: a MESMA composição `Overlay` de motion/src que o render usa, com as props montadas
 * pela mesma função (src/render/overlay-props.ts). Fica parada; o playhead do editor manda o frame (seekTo).
 */
import { Player, type PlayerRef } from '@remotion/player';
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { Overlay } from '../../../motion/src/Overlay';
import type { Word } from '../../../src/analyze/types.ts';
import type { Edl } from '../../../src/edl/schema.ts';
import { sourceToOutput, type Timeline } from '../../../src/edl/timeline.ts';
import { buildOverlayProps } from '../../../src/render/overlay-props.ts';
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
  edl: Edl;
  timeline: Timeline;
  words: Pick<Word, 'text' | 'start' | 'end' | 'score'>[];
  /** só estes itens (chaves `overlays:<id>`…); null = todos */
  only: string[] | null;
  width: number;
  height: number;
}

export default function GraphicsLayer({ edl, timeline, words, only, width, height }: Props) {
  const player = useRef<PlayerRef>(null);
  const [cut, setCut] = useState(false);

  const built = useMemo(() => {
    const keep = (kind: string, id: string) => only === null || only.includes(`${kind}:${id}`);
    // overlay ancorado em trecho cortado derrubaria a composição inteira: fica de fora (a timeline o marca)
    const scoped: Edl = {
      ...edl,
      overlays: edl.overlays.filter((item) => keep('overlays', item.id) && sourceToOutput(timeline, item.at) !== null),
      effects: edl.effects.filter((item) => keep('effects', item.id)),
      transitions: edl.transitions.filter((item) => keep('transitions', item.id)),
    };
    try {
      return { props: buildOverlayProps(scoped, timeline, { words: words as Word[] }), error: null };
    } catch (error) {
      return { props: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [edl, timeline, words, only]);

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
