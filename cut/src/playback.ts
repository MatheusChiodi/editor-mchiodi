/**
 * Transporte do preview. O <video> toca o proxy no tempo da FONTE; na vista editada, o laço pula os trechos cortados
 * (o que se ouve é o vídeo final). J/K/L: para trás o navegador não toca, então o laço anda o tempo à mão.
 */
import { outputToSource, sourceToOutput, type Timeline } from '../../src/edl/timeline.ts';
import { shuttle } from './lib/keys.ts';
import { collapsedOutput, nextPlayable } from './lib/timemap.ts';
import { currentTimeline, playhead, store } from './store.ts';

let video: HTMLVideoElement | null = null;
let frame = 0;
let last = 0;

export function attachVideo(element: HTMLVideoElement | null): void {
  video = element;
  if (video) video.currentTime = playhead.get().source;
}

const timeline = (): Timeline | null => currentTimeline(store.get());

function loop(now: number): void {
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  const state = playhead.get();
  if (!video) return;
  const tl = timeline();
  const editedView = store.get().mode === 'output';
  if (state.rate < 0) {
    let t = video.currentTime + dt * state.rate;
    if (editedView && tl) {
      // para trás, o corte é atravessado para o fim do clipe anterior
      const inside = tl.clips.find((clip) => t >= clip.sourceStart - 1e-3 && t <= clip.sourceEnd + 1e-3);
      if (!inside) {
        const previous = [...tl.clips].reverse().find((clip) => clip.sourceEnd <= t + 1e-3);
        t = previous ? previous.sourceEnd - 0.02 : 0;
      }
    }
    if (t <= 0) {
      t = 0;
      stop();
    }
    video.currentTime = t;
    playhead.set({ source: t });
  } else {
    let t = video.currentTime;
    if (editedView && tl && !video.paused) {
      const next = nextPlayable(tl, t);
      if (next === null) {
        stop();
      } else if (next - t > 1e-3) {
        video.currentTime = next;
        t = next;
      }
    }
    playhead.set({ source: t });
  }
  if (playhead.get().playing) frame = requestAnimationFrame(loop);
}

function run(rate: number): void {
  if (!video) return;
  cancelAnimationFrame(frame);
  last = 0;
  if (rate === 0) return stop();
  playhead.set({ playing: true, rate });
  if (rate > 0) {
    const tl = timeline();
    if (store.get().mode === 'output' && tl) {
      const next = nextPlayable(tl, video.currentTime);
      video.currentTime = next ?? tl.clips[0]?.sourceStart ?? 0;
    }
    video.playbackRate = rate;
    void video.play().catch(() => stop());
  } else {
    video.pause();
  }
  frame = requestAnimationFrame(loop);
}

export function stop(): void {
  cancelAnimationFrame(frame);
  video?.pause();
  playhead.set({ playing: false, rate: 0 });
}

export function togglePlay(): void {
  if (playhead.get().playing) stop();
  else run(1);
}

export function shuttleKey(action: 'shuttleForward' | 'shuttleBackward' | 'shuttleStop'): void {
  run(shuttle(playhead.get().rate, action));
}

export function seek(source: number): void {
  const durationSec = store.get().project?.source.durationSec ?? Infinity;
  const t = Math.min(Math.max(source, 0), durationSec);
  if (video) video.currentTime = t;
  playhead.set({ source: t });
}

/** Passo na vista: frame (1/fps de saída) ou segundos; na vista editada atravessa os cortes. */
export function step(seconds: number): void {
  const tl = timeline();
  const current = playhead.get().source;
  if (!tl || store.get().mode === 'source') return seek(current + seconds);
  const out = sourceToOutput(tl, current) ?? collapsedOutput(tl, current);
  const target = Math.min(Math.max(out + seconds, 0), Math.max(0, tl.durationSec - 1 / tl.fps));
  seek(outputToSource(tl, target) ?? current);
}

export function frameStep(direction: 1 | -1): void {
  stop();
  const fps = timeline()?.fps ?? 30;
  step(direction / fps);
}
