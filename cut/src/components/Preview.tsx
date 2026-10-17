import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { sourceToOutput } from '../../../src/edl/timeline.ts';
import { formatTimecode } from '../lib/timemap.ts';
import { attachVideo, frameStep, togglePlay } from '../playback.ts';
import { currentEdl, currentTimeline, playhead, store, usePlayhead, useEditor } from '../store.ts';
import { api } from '../api.ts';
import { Button } from './ui.tsx';

// o Remotion e as composições de motion/src pesam: carregam depois da UI
const GraphicsLayer = lazy(() => import('./GraphicsLayer.tsx'));

function useBox(ratio: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      const fitWidth = Math.min(width, height * ratio);
      setBox({ width: Math.floor(fitWidth), height: Math.floor(fitWidth / ratio) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ratio]);
  return { ref, box };
}

function Clock() {
  const source = usePlayhead((state) => state.source);
  const timeline = useEditor(currentTimeline);
  const fps = timeline?.fps ?? 30;
  const output = timeline ? sourceToOutput(timeline, source) : null;
  return (
    <div className="flex items-baseline gap-2 font-mono text-[11px]">
      <span className={output === null ? 'text-coral' : 'text-paper'}>{output === null ? 'cortado' : formatTimecode(output, fps)}</span>
      <span className="text-s600">/ {formatTimecode(timeline?.durationSec ?? 0, fps)}</span>
      <span className="text-s600" title="tempo da fonte">
        fonte {source.toFixed(2)}s
      </span>
    </div>
  );
}

function PlayButton() {
  const playing = usePlayhead((state) => state.playing);
  const rate = usePlayhead((state) => state.rate);
  return (
    <Button tone="primary" onClick={togglePlay} title="tocar/pausar (Espaço) · J K L">
      {playing ? `❚❚${Math.abs(rate) !== 1 ? ` ${rate}×` : ''}` : '▶'}
    </Button>
  );
}

export function Preview() {
  const project = useEditor((state) => state.project)!;
  const edl = useEditor(currentEdl)!;
  const timeline = useEditor(currentTimeline)!;
  const selection = useEditor((state) => state.selection);
  const graphics = useEditor((state) => state.graphics);
  const mode = useEditor((state) => state.mode);
  const ratio = edl.output.width / edl.output.height;
  const { ref, box } = useBox(ratio);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    attachVideo(videoRef.current);
    return () => attachVideo(null);
  }, []);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-night">
      <div ref={ref} className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="relative overflow-hidden rounded-md bg-ink shadow-2xl ring-1 ring-paper/10" style={{ width: box.width, height: box.height }}>
          <video
            ref={videoRef}
            src={project.media.proxy}
            className="absolute inset-0 h-full w-full"
            preload="auto"
            playsInline
            onLoadedData={() => setVideoError(null)}
            onError={() => setVideoError('não consegui carregar o proxy (a primeira abertura gera renders/proxy/; aguarde e recarregue)')}
          />
          {graphics !== 'off' && box.width > 0 && (
            <Suspense fallback={null}>
              <GraphicsLayer edl={edl} timeline={timeline} words={project.words} only={graphics === 'selected' ? selection : null} width={box.width} height={box.height} />
            </Suspense>
          )}
          {videoError && <div className="absolute inset-x-0 bottom-0 bg-night/80 p-2 text-[11px] text-peach">{videoError}</div>}
          {mode === 'source' && <div className="absolute top-2 left-2 rounded bg-night/70 px-1.5 py-0.5 text-[10px] font-bold text-peach">FONTE INTEIRA · trechos cortados tocam</div>}
        </div>
      </div>
      <div className="flex h-10 shrink-0 items-center gap-2 border-t border-paper/10 px-3">
        <Button tone="ghost" small onClick={() => frameStep(-1)} title="frame anterior (←)">
          ◂
        </Button>
        <PlayButton />
        <Button tone="ghost" small onClick={() => frameStep(1)} title="próximo frame (→)">
          ▸
        </Button>
        <Clock />
        <div className="flex-1" />
        <select
          value={graphics}
          onChange={(event) => store.set({ graphics: event.target.value as typeof graphics })}
          className="h-6 rounded border border-paper/10 bg-night px-1 text-[11px] text-s300"
          title="camada de gráficos do Remotion no preview"
        >
          <option value="all">gráficos: todos</option>
          <option value="selected">gráficos: só o selecionado</option>
          <option value="off">gráficos: desligados</option>
        </select>
        <Button small onClick={() => store.set({ markIn: playhead.get().source })} title="marcar entrada (I)">
          I
        </Button>
        <Button small onClick={() => store.set({ markOut: playhead.get().source })} title="marcar saída (O)">
          O
        </Button>
        <Button small onClick={() => store.set({ still: api.stillUrl(project.slug, playhead.get().source) })} title="still do frame atual (F) — mce frame">
          still aqui
        </Button>
      </div>
    </main>
  );
}
