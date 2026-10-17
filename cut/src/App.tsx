import { useEffect } from 'react';

import { ConflictBanner } from './components/ConflictBanner.tsx';
import { LeftPanels, RightPanels } from './components/Panels.tsx';
import { Preview } from './components/Preview.tsx';
import { ProjectPicker } from './components/ProjectPicker.tsx';
import { Overlays } from './components/Overlays.tsx';
import { Timeline, timelineViewport } from './components/Timeline.tsx';
import { TopBar } from './components/TopBar.tsx';
import { planDelete } from './lib/gestures.ts';
import { keyAction } from './lib/keys.ts';
import { clampPps, fitPps } from './lib/timemap.ts';
import { frameStep, seek, shuttleKey, step, stop, togglePlay } from './playback.ts';
import { currentEdl, currentTimeline, openProject, playhead, redoEdit, saveEdits, setHint, speechOf, store, toast, tryOps, undoEdit, useEditor } from './store.ts';
import { api } from './api.ts';
import { normalizeRange } from './lib/gestures.ts';

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function deleteSelection(): void {
  const state = store.get();
  const edl = currentEdl(state);
  if (!edl || !state.project) return;
  const range = normalizeRange(state.markIn, state.markOut);
  const plans = planDelete(edl, state.selection, range, speechOf(state.project));
  if (plans.length === 0) return toast('selecione itens ou marque um trecho (I/O) para remover');
  const refused = plans.filter((plan) => !plan.ok);
  if (refused.length) return setHint({ tone: 'error', text: `recusado: ${refused.map((plan) => plan.message).join(' · ')}` });
  const ops = plans.flatMap((plan) => (plan.op ? [plan.op] : []));
  void tryOps(ops, plans.map((plan) => plan.message).filter(Boolean).join(' · ') || null).then((ok) => {
    if (ok) store.set({ selection: [], markIn: null, markOut: null });
  });
}

function onKey(event: KeyboardEvent): void {
  const action = keyAction(event, isTextField(event.target));
  if (!action) return;
  const state = store.get();
  if (!state.project) return;
  event.preventDefault();
  const timeline = currentTimeline(state);
  switch (action) {
    case 'playPause':
      return togglePlay();
    case 'shuttleForward':
    case 'shuttleBackward':
    case 'shuttleStop':
      return shuttleKey(action);
    case 'frameBack':
      return frameStep(-1);
    case 'frameForward':
      return frameStep(1);
    case 'secondBack':
      stop();
      return step(-1);
    case 'secondForward':
      stop();
      return step(1);
    case 'markIn':
      return store.set({ markIn: playhead.get().source });
    case 'markOut':
      return store.set({ markOut: playhead.get().source });
    case 'clearMarks':
      return store.set({ markIn: null, markOut: null, selection: [] });
    case 'undo':
      return undoEdit();
    case 'redo':
      return redoEdit();
    case 'save':
      return void saveEdits();
    case 'delete':
      return deleteSelection();
    case 'zoomIn':
      return store.set({ pps: clampPps(state.pps * 1.5) });
    case 'zoomOut':
      return store.set({ pps: clampPps(state.pps / 1.5) });
    case 'zoomFit': {
      const duration = state.mode === 'output' ? (timeline?.durationSec ?? 0) : state.project.source.durationSec;
      return store.set({ pps: fitPps(timelineViewport.width, duration) });
    }
    case 'toggleView':
      return store.set({ mode: state.mode === 'output' ? 'source' : 'output' });
    case 'still':
      return store.set({ still: api.stillUrl(state.project.slug, playhead.get().source) });
    case 'goStart':
      return seek(timeline?.clips[0]?.sourceStart ?? 0);
    case 'goEnd':
      return seek((timeline?.clips.at(-1)?.sourceEnd ?? 0) - 0.05);
  }
}

export function App() {
  const slug = new URLSearchParams(window.location.search).get('p');
  const project = useEditor((state) => state.project);
  const loadError = useEditor((state) => state.loadError);

  useEffect(() => {
    if (slug) void openProject(slug);
  }, [slug]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    const guard = (event: BeforeUnloadEvent) => {
      if (store.get().history.done.length) event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', guard);
    };
  }, []);

  if (!slug) return <ProjectPicker />;
  if (loadError) return <ProjectPicker error={loadError} />;
  if (!project) return <div className="flex h-full items-center justify-center text-s300/60">abrindo {slug}…</div>;

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <ConflictBanner />
      <div className="flex min-h-0 flex-1">
        <LeftPanels />
        <Preview />
        <RightPanels />
      </div>
      <Timeline />
      <Overlays />
    </div>
  );
}
