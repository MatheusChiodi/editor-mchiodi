import { type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { normalizeToken } from '../../../src/analyze/speech.ts';
import type { ItemKind } from '../../../src/cut/ops.ts';
import { snapEdge, type SnapResult } from '../../../src/cut/snap.ts';
import { idsInRange, normalizeRange, planMove, planRemove, planResize, planRestore, planTrim } from '../lib/gestures.ts';
import { clampPps, createTimeMap, fitPps, formatClock, rulerTicks, type TimeMap, zoomScroll } from '../lib/timemap.ts';
import { cutMarkers, edgeBands, type LaneItem, layoutTracks, TRACK_HEIGHT, trackHeight, TRACKS, type TrackId, visibleWords } from '../lib/tracks.ts';
import { evalMarkers } from '../lib/ui.ts';
import { seek } from '../playback.ts';
import { currentEdl, currentTimeline, playhead, setHint, speechOf, store, tryOps, usePlayhead, useEditor } from '../store.ts';
import { Button } from './ui.tsx';

export const timelineViewport = { width: 1200 };

const HEADER_W = 104;
const RULER_H = 26;
const EDGE_PX = 6;
const DRAG_THRESHOLD = 3;

type Drag =
  | { type: 'scrub' }
  | { type: 'range'; fromX: number; moved: boolean }
  | { type: 'item'; item: LaneItem; startX: number; dx: number; moved: boolean; additive: boolean }
  | { type: 'resize'; item: LaneItem; edge: 'start' | 'end'; startX: number; dx: number }
  | { type: 'trim'; item: LaneItem; edge: 'start' | 'end'; startX: number; dx: number; origin: number; snap: SnapResult | null };

const ITEM_STYLE: Record<string, string> = {
  clip: 'bg-s600/45 border-s300/25 text-paper',
  removed: 'hatch border-coral/30 text-coral/80',
  overlays: 'bg-peri/25 border-peri/60 text-paper',
  scene: 'bg-mint/20 border-mint/60 text-paper',
  zooms: 'bg-peach/20 border-peach/60 text-paper',
  effects: 'bg-emerald/20 border-emerald/60 text-paper',
  sfx: 'bg-s300/15 border-s300/40 text-s300',
  transitions: 'bg-coral/25 border-coral/70 text-paper',
  broll: 'bg-mint/15 border-mint/50 text-paper',
};

function styleOf(item: LaneItem): string {
  if (item.kind === 'overlays' && item.label.includes('/')) return ITEM_STYLE.scene!;
  return ITEM_STYLE[item.kind] ?? ITEM_STYLE.clip!;
}

function Ruler({ map, scrollLeft, width, onDown }: { map: TimeMap; scrollLeft: number; width: number; onDown: (event: ReactPointerEvent) => void }) {
  const from = scrollLeft / map.pps;
  const to = (scrollLeft + width) / map.pps;
  const ticks = rulerTicks(from, to, map.pps);
  return (
    <div className="relative h-full cursor-ew-resize border-b border-paper/10 bg-s900" style={{ width: map.width + 240 }} onPointerDown={onDown}>
      {ticks.minor.map((t) => (
        <div key={`m${t}`} className="absolute bottom-0 h-1.5 w-px bg-paper/15" style={{ left: t * map.pps }} />
      ))}
      {ticks.major.map((tick) => (
        <div key={`M${tick.t}`} className="absolute bottom-0 h-full" style={{ left: tick.t * map.pps }}>
          <div className="absolute bottom-0 h-2.5 w-px bg-paper/35" />
          <span className="absolute top-1 left-1 font-mono text-[10px] text-s300/70">{tick.label}</span>
        </div>
      ))}
      <div className="absolute top-0 left-0 h-full" style={{ left: map.width }}>
        <div className="h-full w-px bg-coral/40" />
      </div>
    </div>
  );
}

function Playhead({ map }: { map: TimeMap }) {
  const source = usePlayhead((state) => state.source);
  const x = map.toX(source);
  const left = x ?? map.toXClamped(source);
  return (
    <div className="pointer-events-none absolute top-0 bottom-0 z-30" style={{ left: left + HEADER_W }}>
      <div className={`absolute top-0 -left-[5px] h-3 w-[11px] rounded-b-sm ${x === null ? 'bg-peach' : 'bg-coral'}`} />
      <div className={`absolute top-0 bottom-0 w-px ${x === null ? 'bg-peach/70' : 'bg-coral'}`} />
    </div>
  );
}

function Waveform({ map, scrollLeft, width, height }: { map: TimeMap; scrollLeft: number; width: number; height: number }) {
  const waveform = useEditor((state) => state.waveform);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element || !waveform) return;
    const dpr = window.devicePixelRatio || 1;
    element.width = Math.max(1, Math.floor(width * dpr));
    element.height = Math.floor(height * dpr);
    const context = element.getContext('2d')!;
    context.scale(dpr, dpr);
    context.clearRect(0, 0, width, height);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--mc-slate-300').trim() || '#cbd5e1';
    context.fillStyle = color;
    context.globalAlpha = 0.55;
    const middle = height / 2;
    for (let px = 0; px < width; px += 2) {
      const a = map.fromX(scrollLeft + px).source;
      const b = map.fromX(scrollLeft + px + 2).source;
      if (a === null) continue;
      const end = b === null || b < a ? a + 2 / map.pps : b;
      let peak = 0;
      for (let index = Math.floor(a * waveform.peaksPerSec); index <= Math.ceil(end * waveform.peaksPerSec); index += 1) peak = Math.max(peak, waveform.peaks[index] ?? 0);
      const h = Math.max(1, (peak / 255) * (height - 6));
      context.fillRect(px, middle - h / 2, 1.5, h);
    }
  }, [waveform, map, scrollLeft, width, height]);
  if (!waveform) return <div className="absolute inset-0 flex items-center px-2 text-[10px] text-s600">forma de onda…</div>;
  return <canvas ref={canvas} className="pointer-events-none absolute top-0" style={{ left: scrollLeft, width, height }} />;
}

function Toolbar({ map }: { map: TimeMap }) {
  const mode = useEditor((state) => state.mode);
  const pps = useEditor((state) => state.pps);
  const markIn = useEditor((state) => state.markIn);
  const markOut = useEditor((state) => state.markOut);
  const hint = useEditor((state) => state.hint);
  const selection = useEditor((state) => state.selection.length);
  const range = normalizeRange(markIn, markOut);
  const project = useEditor((state) => state.project)!;

  const act = (kind: 'remove' | 'restore') => {
    if (!range) return;
    const plan = kind === 'remove' ? planRemove(range, speechOf(project)) : planRestore(range, speechOf(project));
    if (!plan.ok || !plan.op) return setHint({ tone: 'error', text: `recusado: ${plan.message}` });
    void tryOps([plan.op], plan.message).then((ok) => ok && store.set({ markIn: null, markOut: null }));
  };

  const hintTone = hint?.tone === 'error' ? 'text-coral' : hint?.tone === 'warn' ? 'text-peach' : 'text-mint';
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-paper/10 bg-s900/40 px-2">
      <div className="flex overflow-hidden rounded-md border border-paper/10">
        {(['output', 'source'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => store.set({ mode: value })}
            className={`px-2.5 py-1 text-[11px] font-semibold ${mode === value ? 'bg-paper/15 text-paper' : 'text-s300/60 hover:text-paper'}`}
            title={value === 'output' ? 'vídeo editado (Tab alterna)' : 'fonte inteira: o cortado aparece hachurado e pode ser restaurado'}
          >
            {value === 'output' ? 'editado' : 'fonte inteira'}
          </button>
        ))}
      </div>
      <Button tone="ghost" small onClick={() => store.set({ pps: clampPps(pps / 1.5) })} title="menos zoom (−)">
        −
      </Button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round((Math.log(pps / 2) / Math.log(300)) * 100)}
        onChange={(event) => store.set({ pps: clampPps(2 * 300 ** (Number(event.target.value) / 100)) })}
        className="w-24 accent-coral"
        title="zoom da timeline (Ctrl+roda)"
      />
      <Button tone="ghost" small onClick={() => store.set({ pps: clampPps(pps * 1.5) })} title="mais zoom (+)">
        +
      </Button>
      <Button tone="ghost" small onClick={() => store.set({ pps: fitPps(timelineViewport.width, map.durationSec) })} title="caber tudo (Ctrl+0)">
        caber
      </Button>
      <span className="h-4 w-px bg-paper/10" />
      {range ? (
        <>
          <span className="font-mono text-[11px] text-coral">
            trecho {range.start.toFixed(2)}–{range.end.toFixed(2)}s ({(range.end - range.start).toFixed(2)}s da fonte)
          </span>
          <Button small tone="danger" onClick={() => act('remove')} title="remove o trecho (as pontas encaixam em pausa medida)">
            remover trecho
          </Button>
          <Button small tone="ok" onClick={() => act('restore')} title="restaura o que foi cortado dentro do trecho">
            restaurar trecho
          </Button>
          <Button
            small
            tone="ghost"
            onClick={() => {
              const edl = currentEdl(store.get());
              const timeline = currentTimeline(store.get());
              if (!edl || !timeline) return;
              const layout = layoutTracks(edl, timeline, map);
              const items = TRACKS.flatMap((track) => layout.items[track.id]).filter((item) => item.kind !== 'clip' && item.kind !== 'removed');
              store.set({ selection: idsInRange(items, range) });
            }}
          >
            selecionar itens
          </Button>
          <Button small tone="ghost" onClick={() => store.set({ markIn: null, markOut: null })}>
            limpar
          </Button>
        </>
      ) : (
        <span className="text-[11px] text-s300/40">
          {markIn !== null ? 'entrada marcada: marque a saída (O)' : 'arraste no fundo das trilhas ou use I/O para marcar um trecho'}
          {selection > 0 && ` · ${selection} selecionado(s) — Delete remove`}
        </span>
      )}
      <div className="flex-1" />
      {hint && (
        <button type="button" className={`max-w-[46%] truncate text-right text-[11px] ${hintTone}`} title={hint.text} onClick={() => setHint(null)}>
          {hint.text} ✕
        </button>
      )}
      <span className="flex items-center gap-1 text-[10px] text-s300/50" title="faixas verdes: silêncio medido sem palavra — o único lugar onde uma borda de corte pode ficar">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald/50" /> pausa medida
      </span>
    </div>
  );
}

export function Timeline() {
  const project = useEditor((state) => state.project)!;
  const edl = useEditor(currentEdl)!;
  const timeline = useEditor(currentTimeline)!;
  const mode = useEditor((state) => state.mode);
  const pps = useEditor((state) => state.pps);
  const selection = useEditor((state) => state.selection);
  const markIn = useEditor((state) => state.markIn);
  const markOut = useEditor((state) => state.markOut);
  const evals = useEditor((state) => state.evals);
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewport, setViewport] = useState(1200);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [popover, setPopover] = useState<{ x: number; start: number; end: number; label: string } | null>(null);
  const fitted = useRef(false);
  const speech = speechOf(project);

  const map = useMemo(() => createTimeMap(timeline, project.source.durationSec, mode, pps), [timeline, project.source.durationSec, mode, pps]);
  const layout = useMemo(() => layoutTracks(edl, timeline, map), [edl, timeline, map]);
  const bands = useMemo(() => edgeBands(speech, map), [speech, map]);
  const cuts = useMemo(() => (mode === 'output' ? cutMarkers(edl, timeline, map) : []), [edl, timeline, map, mode]);
  const findings = useMemo(() => (evals ? evalMarkers(evals.findings, map) : []), [evals, map]);
  const words = useMemo(() => visibleWords(project.words, map, scrollLeft - 200, scrollLeft + viewport + 200), [project.words, map, scrollLeft, viewport]);
  const captionMaps = useMemo(
    () => ({
      highlights: new Set(edl.captions.highlights.map(normalizeToken)),
      replacements: new Map(Object.entries(edl.captions.replacements).map(([from, to]) => [normalizeToken(from), to])),
    }),
    [edl.captions],
  );

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth - HEADER_W;
      timelineViewport.width = width;
      setViewport(width);
      if (!fitted.current && width > 100) {
        fitted.current = true;
        store.set({ pps: fitPps(width, timeline.durationSec) });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [timeline.durationSec]);

  // segue o playhead quando ele sai da área visível tocando
  useEffect(
    () =>
      playhead.subscribe(() => {
        const element = scroller.current;
        const { playing, source } = playhead.get();
        if (!element || !playing) return;
        const x = map.toXClamped(source);
        if (x < element.scrollLeft || x > element.scrollLeft + element.clientWidth - HEADER_W - 40) element.scrollLeft = Math.max(0, x - 80);
      }),
    [map],
  );

  const contentX = (event: { clientX: number }) => {
    const element = scroller.current!;
    return event.clientX - element.getBoundingClientRect().left - HEADER_W + element.scrollLeft;
  };
  const sourceAtX = (x: number) => map.fromX(x).source ?? (x <= 0 ? 0 : (timeline.clips.at(-1)?.sourceEnd ?? project.source.durationSec));

  const begin = (event: ReactPointerEvent, next: Drag) => {
    event.preventDefault();
    event.stopPropagation();
    scroller.current?.setPointerCapture(event.pointerId);
    setPopover(null);
    setDrag(next);
  };

  const onRulerDown = (event: ReactPointerEvent) => {
    const x = contentX(event);
    if (event.shiftKey) {
      store.set({ markIn: sourceAtX(x), markOut: null });
      return begin(event, { type: 'range', fromX: x, moved: false });
    }
    seek(sourceAtX(x));
    begin(event, { type: 'scrub' });
  };

  const onBackgroundDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    begin(event, { type: 'range', fromX: contentX(event), moved: false });
  };

  const onItemDown = (event: ReactPointerEvent, item: LaneItem) => {
    if (event.button !== 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const local = event.clientX - rect.left;
    const edge = local < EDGE_PX ? 'start' : rect.width - local < EDGE_PX ? 'end' : null;
    const x = contentX(event);
    if (item.kind === 'removed') {
      setPopover({ x: item.x + item.w / 2, start: item.sourceStart, end: item.sourceEnd, label: `${item.label}${item.reason ? ` · ${item.reason}` : ''}` });
      return;
    }
    if (item.kind === 'clip' && edge) {
      const clip = edl.clips.find((candidate) => candidate.id === item.id)!;
      store.set({ selection: [item.key] });
      return begin(event, { type: 'trim', item, edge, startX: x, dx: 0, origin: clip[edge], snap: null });
    }
    if (item.kind !== 'clip' && edge && item.kind !== 'transitions' && item.kind !== 'sfx') {
      store.set({ selection: [item.key] });
      return begin(event, { type: 'resize', item, edge, startX: x, dx: 0 });
    }
    begin(event, { type: 'item', item, startX: x, dx: 0, moved: false, additive: event.shiftKey || event.ctrlKey });
  };

  const onMove = (event: ReactPointerEvent) => {
    if (!drag) return;
    const x = contentX(event);
    if (drag.type === 'scrub') return seek(sourceAtX(x));
    if (drag.type === 'range') {
      const moved = drag.moved || Math.abs(x - drag.fromX) > DRAG_THRESHOLD;
      if (moved) store.set({ markIn: sourceAtX(Math.min(drag.fromX, x)), markOut: sourceAtX(Math.max(drag.fromX, x)) });
      return setDrag({ ...drag, moved });
    }
    if (drag.type === 'item') {
      const dx = x - drag.startX;
      if (drag.item.kind === 'clip') return;
      return setDrag({ ...drag, dx, moved: drag.moved || Math.abs(dx) > DRAG_THRESHOLD });
    }
    if (drag.type === 'resize') return setDrag({ ...drag, dx: x - drag.startX });
    if (drag.type === 'trim') {
      const dx = x - drag.startX;
      const snap = snapEdge(drag.origin + dx / map.pps, speech);
      setDrag({ ...drag, dx, snap });
    }
  };

  const onUp = (event: ReactPointerEvent) => {
    const current = drag;
    setDrag(null);
    if (!current) return;
    const x = contentX(event);
    if (current.type === 'range' && !current.moved) {
      store.set({ selection: [], markIn: null, markOut: null });
      seek(sourceAtX(x));
      return;
    }
    if (current.type === 'item') {
      const { item } = current;
      if (!current.moved) {
        const selected = store.get().selection;
        store.set({
          selection: current.additive ? (selected.includes(item.key) ? selected.filter((key) => key !== item.key) : [...selected, item.key]) : [item.key],
          ...(item.kind !== 'clip' ? { right: 'properties' as const } : {}),
        });
        // item gráfico: o playhead vai para a entrada dele, para o preview mostrar o que foi selecionado
        if (item.kind !== 'clip' && !item.orphan && !current.additive) seek(item.sourceStart + 0.05);
        return;
      }
      const plan = planMove(edl, timeline, map, item.kind as ItemKind, item.id, current.dx / map.pps);
      if (!plan.ok) return setHint({ tone: 'error', text: `recusado: ${plan.message}` });
      if (plan.op) void tryOps([plan.op], plan.message);
      return;
    }
    if (current.type === 'resize') {
      const { item } = current;
      const plan = planResize(edl, timeline, map, item.kind as ItemKind, item.id, current.edge, current.dx / map.pps, item.w / map.pps);
      if (!plan.ok) return setHint({ tone: 'error', text: `recusado: ${plan.message}` });
      if (plan.op) void tryOps([plan.op], plan.message);
      return;
    }
    if (current.type === 'trim') {
      if (Math.abs(current.dx) < 1) return;
      const plan = planTrim(edl.clips, current.item.id, current.edge, current.origin + current.dx / map.pps, speech);
      if (!plan.ok) return setHint({ tone: 'error', text: `recusado: ${plan.message}` });
      if (plan.op) void tryOps([plan.op], plan.message);
    }
  };

  const onWheel = (event: ReactWheelEvent) => {
    const element = scroller.current!;
    if (event.ctrlKey || event.metaKey) {
      const anchor = event.clientX - element.getBoundingClientRect().left - HEADER_W;
      const next = clampPps(pps * (event.deltaY < 0 ? 1.2 : 1 / 1.2));
      store.set({ pps: next });
      requestAnimationFrame(() => {
        element.scrollLeft = zoomScroll(pps, next, anchor, element.scrollLeft);
      });
      return;
    }
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && !event.shiftKey) element.scrollLeft += event.deltaY;
  };

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    // Ctrl+roda é zoom da timeline, não do navegador
    const block = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    element.addEventListener('wheel', block, { passive: false });
    return () => element.removeEventListener('wheel', block);
  }, []);

  const rows = TRACKS.map((track) => ({ ...track, height: trackHeight(track.id, layout.lanes[track.id]) }));
  const contentWidth = map.width + 240;
  const range = normalizeRange(markIn, markOut);
  const trimming = drag?.type === 'trim';

  const renderItem = (item: LaneItem, track: TrackId, laneHeight: number) => {
    const selected = selection.includes(item.key);
    let { x, w } = item;
    if (drag?.type === 'item' && drag.moved && (drag.item.key === item.key || (selected && selection.includes(drag.item.key)))) x += drag.dx;
    if (drag?.type === 'resize' && drag.item.key === item.key) {
      if (drag.edge === 'end') w = Math.max(4, w + drag.dx);
      else {
        x += drag.dx;
        w = Math.max(4, w - drag.dx);
      }
    }
    const top = track === 'clips' ? 4 : 3 + item.lane * (laneHeight - 4);
    const height = track === 'clips' ? TRACK_HEIGHT.clips - 8 : laneHeight - 6;
    return (
      <div
        key={item.key}
        data-key={item.key}
        onPointerDown={(event) => onItemDown(event, item)}
        onDoubleClick={() => item.kind !== 'clip' && item.kind !== 'removed' && store.set({ selection: [item.key], right: 'properties' })}
        title={`${item.kind === 'clip' ? 'clipe' : item.kind} ${item.id}${item.reason ? `\nmotivo: ${item.reason}` : ''}${item.orphan ? '\n⚠ ancorado num trecho cortado' : ''}`}
        className={`group absolute flex items-center overflow-hidden rounded-[5px] border px-1.5 text-[10px] leading-tight font-semibold ${styleOf(item)} ${
          selected ? 'z-10 ring-2 ring-coral' : ''
        } ${item.orphan ? 'border-dashed !border-coral' : ''} ${item.kind === 'clip' ? 'cursor-pointer' : item.kind === 'removed' ? 'cursor-pointer' : 'cursor-grab'}`}
        style={{ left: x, width: Math.max(w, 3), top, height }}
      >
        {item.kind !== 'removed' && item.kind !== 'sfx' && item.kind !== 'transitions' && (
          <>
            <span className="absolute inset-y-0 left-0 w-[5px] cursor-ew-resize bg-paper/0 group-hover:bg-paper/30" />
            <span className="absolute inset-y-0 right-0 w-[5px] cursor-ew-resize bg-paper/0 group-hover:bg-paper/30" />
          </>
        )}
        <span className="pointer-events-none truncate">{w > 28 ? item.label : ''}</span>
      </div>
    );
  };

  const trimGhost = (() => {
    if (drag?.type !== 'trim') return null;
    const edgeX = drag.edge === 'start' ? drag.item.x : drag.item.x + drag.item.w;
    const rawX = edgeX + drag.dx;
    const snapX = drag.snap?.ok ? edgeX + (drag.snap.time - drag.origin) * map.pps : null;
    return { rawX, snapX, snap: drag.snap };
  })();

  return (
    <section className="flex h-[clamp(250px,40vh,440px)] shrink-0 flex-col border-t border-paper/10 bg-night no-select">
      <Toolbar map={map} />
      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-auto"
        onScroll={(event) => setScrollLeft((event.target as HTMLDivElement).scrollLeft)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        onWheel={onWheel}
      >
        <div className="relative" style={{ width: HEADER_W + contentWidth }}>
          <div className="sticky top-0 z-20 flex" style={{ height: RULER_H }}>
            <div className="sticky left-0 z-30 flex shrink-0 items-center border-r border-b border-paper/10 bg-s900 px-2 font-mono text-[10px] text-s300/60" style={{ width: HEADER_W }}>
              {mode === 'output' ? 'saída' : 'fonte'} · {formatClock(map.durationSec)}
            </div>
            <Ruler map={map} scrollLeft={scrollLeft} width={viewport} onDown={onRulerDown} />
          </div>

          {rows.map((row) => (
            <div key={row.id} className="flex border-b border-paper/[0.06]" style={{ height: row.height }}>
              <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-paper/10 bg-s900/95 px-2" style={{ width: HEADER_W }} title={row.hint}>
                <span className="text-[11px] font-semibold text-s300">{row.label}</span>
                <span className="text-[9px] text-s600">{row.hint}</span>
              </div>
              <div className="relative shrink-0" style={{ width: contentWidth }} onPointerDown={onBackgroundDown}>
                {row.id === 'audio' && (
                  <>
                    {bands.map((band) => (
                      <div key={`b${band.start}`} className={`absolute inset-y-0 ${trimming ? 'bg-emerald/45' : 'bg-emerald/20'}`} style={{ left: band.x, width: band.w }} />
                    ))}
                    <Waveform map={map} scrollLeft={Math.max(0, scrollLeft)} width={viewport} height={row.height} />
                  </>
                )}
                {row.id === 'clips' &&
                  bands.map((band) => <div key={`bt${band.start}`} className="pointer-events-none absolute bottom-0 h-[3px] bg-emerald/80" style={{ left: band.x, width: band.w }} />)}
                {row.id === 'words' &&
                  words.map((word) => {
                    const token = normalizeToken(word.text);
                    const replaced = captionMaps.replacements.get(token);
                    const highlighted = captionMaps.highlights.has(token);
                    return (
                      <div
                        key={word.index}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          seek(project.words[word.index]!.start + 0.001);
                        }}
                        onDoubleClick={() => store.set({ left: 'captions', focusWord: word.index })}
                        className={`absolute top-1 bottom-1 cursor-pointer overflow-hidden rounded-sm border-l px-0.5 text-[10px] leading-[20px] whitespace-nowrap ${
                          highlighted ? 'border-coral bg-coral/20 text-coral' : 'border-paper/20 bg-paper/[0.04] text-s300'
                        } ${replaced ? 'underline decoration-peach' : ''}`}
                        style={{ left: word.x, width: word.w }}
                        title={`${word.text}${replaced ? ` → ${replaced}` : ''} (duplo clique: editar legenda)`}
                      >
                        {word.w > 14 ? (replaced ?? word.text) : ''}
                      </div>
                    );
                  })}
                {row.id === 'clips' && cuts.map((cut) => <div key={`cl${cut.start}`} className="pointer-events-none absolute inset-y-0 z-20 w-[2px] -ml-px bg-coral/70" style={{ left: cut.x }} />)}
                {layout.items[row.id].map((item) => renderItem(item, row.id, TRACK_HEIGHT[row.id]))}
                {row.id === 'clips' &&
                  cuts.map((cut) => (
                    <button
                      key={`cut${cut.start}`}
                      type="button"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setPopover({ x: cut.x, start: cut.start, end: cut.end, label: `${cut.removedSec.toFixed(2)}s cortados (${cut.kinds.join(', ') || 'manual'})` });
                      }}
                      className="absolute -top-[1px] z-20 -ml-[5px] h-[10px] w-[10px] cursor-pointer"
                      style={{ left: cut.x }}
                      title={`${cut.removedSec.toFixed(2)}s cortados aqui — clique para restaurar`}
                    >
                      <span className="absolute top-0 left-[1px] h-2 w-2 rotate-45 bg-coral" />
                    </button>
                  ))}
              </div>
            </div>
          ))}

          {/* camada de cima: trecho marcado, achados do eval, fantasma do aparo, playhead */}
          <div className="pointer-events-none absolute inset-y-0" style={{ left: HEADER_W, width: contentWidth }}>
            {range && (
              <div
                className="absolute bottom-0 border-x-2 border-coral bg-coral/10"
                style={{ top: RULER_H, left: map.toXClamped(range.start), width: Math.max(2, map.toXClamped(range.end) - map.toXClamped(range.start)) }}
              />
            )}
            {markIn !== null && markOut === null && <div className="absolute bottom-0 w-[2px] bg-coral" style={{ top: RULER_H, left: map.toXClamped(markIn) }} />}
            {findings.map((finding) => (
              <button
                key={`f${finding.index}`}
                type="button"
                className="pointer-events-auto absolute z-20 -ml-[5px] h-0 w-0 border-x-[5px] border-t-[8px] border-x-transparent"
                style={{ top: RULER_H - 9, left: finding.x, borderTopColor: finding.severity === 'error' ? 'var(--mc-coral)' : finding.severity === 'warning' ? 'var(--mc-glow-peach)' : 'var(--mc-glow-periwinkle)' }}
                title={`${finding.check}: ${finding.message}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  seek(finding.sourceSec);
                  store.set({ right: 'eval' });
                }}
              />
            ))}
            {trimGhost && (
              <>
                <div className="absolute bottom-0 w-px bg-paper/50" style={{ top: RULER_H, left: trimGhost.rawX }} />
                {trimGhost.snapX !== null && <div className="absolute bottom-0 w-[2px] bg-emerald" style={{ top: RULER_H, left: trimGhost.snapX }} />}
                <div
                  className={`absolute z-40 max-w-[360px] rounded-md px-2 py-1 text-[10px] font-semibold shadow-lg ${trimGhost.snap?.ok ? 'bg-emerald text-ink' : 'bg-coral text-paper'}`}
                  style={{ top: RULER_H + 2, left: (trimGhost.snapX ?? trimGhost.rawX) + 6 }}
                >
                  {trimGhost.snap ? (trimGhost.snap.ok ? (trimGhost.snap.warning ? `encaixa em ${trimGhost.snap.time.toFixed(2)}s — ${trimGhost.snap.insideWord ? `"${trimGhost.snap.insideWord.text}" ficaria cortada` : 'fora de pausa'}` : `${trimGhost.snap.time.toFixed(2)}s · pausa medida`) : trimGhost.snap.warning) : 'arraste até uma pausa'}
                </div>
              </>
            )}
            {popover && (
              <div className="pointer-events-auto absolute z-40 w-64 rounded-lg border border-paper/15 bg-s900 p-2.5 text-xs shadow-2xl" style={{ top: RULER_H + 4, left: Math.max(0, popover.x - 128) }}>
                <div className="mb-1 font-semibold text-paper">Trecho cortado</div>
                <div className="mb-2 text-[11px] text-s300/70">
                  {popover.start.toFixed(2)}–{popover.end.toFixed(2)}s da fonte · {popover.label}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    small
                    tone="ok"
                    onClick={() => {
                      const plan = planRestore({ start: popover.start, end: popover.end }, speech);
                      setPopover(null);
                      if (!plan.ok || !plan.op) return setHint({ tone: 'error', text: `recusado: ${plan.message}` });
                      void tryOps([plan.op], plan.message);
                    }}
                  >
                    restaurar
                  </Button>
                  <Button
                    small
                    onClick={() => {
                      store.set({ mode: 'source', markIn: popover.start, markOut: popover.end });
                      seek(popover.start);
                      setPopover(null);
                    }}
                  >
                    ver na fonte
                  </Button>
                  <Button small tone="ghost" onClick={() => setPopover(null)}>
                    ✕
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Playhead map={map} />
        </div>
      </div>
    </section>
  );
}

