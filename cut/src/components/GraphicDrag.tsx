/**
 * Alças de arraste dos gráficos no preview. Uma caixa transparente por gráfico no ar (a área que o componente ocupa,
 * footprints.json + shift do rosto + offset): arrastar move, soltar grava `offset` como op da EDL (nova versão, com
 * desfazer/refazer). Alt solta o snap; duplo clique ou R volta à posição original. Cobrir o rosto acende o aviso.
 */
import { useRef, useState } from 'react';

import footprints from '../../../motion/src/arsenal/footprints.json';
import { DEFAULT_FACE, type Footprints, type Point } from '../../../src/edl/fit.ts';
import type { Edl } from '../../../src/edl/schema.ts';
import type { Timeline } from '../../../src/edl/timeline.ts';
import { resetGraphic } from '../graphics.ts';
import { coversFace, DRAG_SLOP_PX, dragOffset, faceBox, frameGuides, type GraphicHandle, handlesAt, offsetOp, SNAP_PX } from '../lib/graphic-drag.ts';
import { dragging, store, tryOps, useDragging, useEditor, usePlayhead } from '../store.ts';

interface Gesture {
  id: string;
  pointer: number;
  startX: number;
  startY: number;
  startOffset: Point;
  moved: boolean;
  handle: GraphicHandle;
}

const FOOTPRINTS = footprints as Footprints;
const pct = (value: number) => `${(value * 100).toFixed(3)}%`;

export default function GraphicDrag({ edl, timeline, width, height }: { edl: Edl; timeline: Timeline; width: number; height: number }) {
  const source = usePlayhead((state) => state.source);
  const guard = useEditor((state) => state.guard);
  const selection = useEditor((state) => state.selection);
  const live = useDragging((state) => state);
  const gesture = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  // durante o gesto a caixa segue o offset provisório; fora dele, a EDL
  const handles = handlesAt(edl, timeline, source, FOOTPRINTS, guard?.shifts).map((handle) =>
    live.id === handle.overlay.id ? { ...handle, rect: { ...handle.base, x: handle.base.x + live.offset.x, y: handle.base.y + live.offset.y } } : handle,
  );
  if (handles.length === 0) return null;
  const active = live.id ? (handles.find((handle) => handle.overlay.id === live.id) ?? null) : null;

  const finish = async (event: React.PointerEvent, commit: boolean) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointer) return;
    gesture.current = null;
    setGuides({ x: null, y: null });
    const { offset } = dragging.get();
    if (commit && current.moved) {
      const same = Math.abs(offset.x - current.startOffset.x) < 5e-4 && Math.abs(offset.y - current.startOffset.y) < 5e-4;
      if (!same) await tryOps([offsetOp(current.id, offset)], null);
    }
    dragging.set({ id: null, offset: { x: 0, y: 0 } });
  };

  return (
    <div className="absolute inset-0 z-10" style={{ pointerEvents: 'none' }}>
      {active && (
        <>
          {guides.x !== null && <div className="absolute top-0 bottom-0 w-px bg-mint/80" style={{ left: pct(guides.x) }} />}
          {guides.y !== null && <div className="absolute right-0 left-0 h-px bg-mint/80" style={{ top: pct(guides.y) }} />}
          <FaceZone face={guard?.faces[active.overlay.id] ?? DEFAULT_FACE} />
        </>
      )}
      {handles.map((handle) => {
        const { overlay, rect } = handle;
        const face = guard?.faces[overlay.id] ?? DEFAULT_FACE;
        const covers = coversFace(rect, face);
        const selected = selection.includes(`overlays:${overlay.id}`);
        const moving = live.id === overlay.id;
        const status = guard?.items.find((item) => item.overlay === overlay.id)?.status;
        return (
          <div
            key={overlay.id}
            data-graphic={overlay.id}
            className={`group absolute cursor-move rounded-sm border ${covers ? 'border-dashed border-coral bg-coral/10' : selected || moving ? 'border-mint/80 bg-mint/5' : 'border-transparent hover:border-paper/40'}`}
            style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h), pointerEvents: 'auto', touchAction: 'none' }}
            title={`${overlay.component} · arraste para mover (Alt solta o snap) · duplo clique ou R volta ao original`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              store.set({ selection: [`overlays:${overlay.id}`] });
              gesture.current = { id: overlay.id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, startOffset: overlay.offset ?? { x: 0, y: 0 }, moved: false, handle };
            }}
            onPointerMove={(event) => {
              const current = gesture.current;
              if (!current || event.pointerId !== current.pointer) return;
              const dx = event.clientX - current.startX;
              const dy = event.clientY - current.startY;
              if (!current.moved && Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
              current.moved = true;
              const result = dragOffset({
                base: current.handle.base,
                startOffset: current.startOffset,
                delta: { x: dx / width, y: dy / height },
                guides: frameGuides(face),
                threshold: { x: SNAP_PX / width, y: SNAP_PX / height },
                snap: !event.altKey,
              });
              dragging.set({ id: current.id, offset: result.offset });
              setGuides(result.hit);
            }}
            onPointerUp={(event) => void finish(event, true)}
            onPointerCancel={(event) => void finish(event, false)}
            onDoubleClick={() => void resetGraphic(overlay.id)}
          >
            {(selected || moving || covers) && (
              <span className={`pointer-events-none absolute -top-5 left-0 max-w-full truncate rounded px-1 text-[10px] font-bold ${covers ? 'bg-coral text-night' : 'bg-mint text-night'}`}>
                {overlay.component}
                {covers ? (status === 'precisa-palco' ? ' · cobre o rosto: use palco' : ' · cobre o rosto (o render afasta)') : ''}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Contorno do rosto protegido: aparece só durante o arraste, para ver o que não cobrir. */
function FaceZone({ face }: { face: Point }) {
  const box = faceBox(face);
  return <div className="absolute rounded-sm border border-dashed border-peach/60" style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }} />;
}
