import { useRef } from 'react';
import { letterPageSize, markSizes } from './letterHeadPdf';
import type { MarkKind, MarkPlacement, MarkPosition } from './letterHeadPdf';

const fieldClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';

const arrowMovement: Record<string, MarkPosition> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }
};

export function DraggableMark({ kind, pageNumber, src, position, disabled, onMove, pageSize = letterPageSize, size = markSizes[kind], instructionsId = 'letter-mark-instructions', resize }: {
  kind: MarkKind;
  pageNumber: number;
  pageSize?: { width: number; height: number };
  size?: { width: number; height: number };
  instructionsId?: string;
  src: string;
  position: MarkPosition;
  disabled: boolean;
  onMove: (position: MarkPosition) => void;
  resize?: { scale: number; onChange: (scale: number) => void };
}) {
  const drag = useRef<{
    id: number;
    clientX: number;
    clientY: number;
    scaleX: number;
    scaleY: number;
    position: MarkPosition;
  } | null>(null);
  const touches = useRef(new Map<number, MarkPosition>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const { width, height } = pageSize;

  const label = { signature: 'signature', stamp: 'company seal', date: 'date' }[kind];

  return (
    <button type="button" aria-label={`Move ${label} on page ${pageNumber}`} aria-describedby={instructionsId}
      disabled={disabled}
      className="absolute touch-none select-none cursor-grab rounded-sm hover:outline hover:outline-2 hover:outline-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 active:cursor-grabbing"
      style={{
        WebkitTouchCallout: 'none',
        left: `${position.x / width * 100}%`,
        top: `${position.y / height * 100}%`,
        width: `${size.width / width * 100}%`,
        height: `${size.height / height * 100}%`
      }}
      onDragStart={event => event.preventDefault()}
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (event.button !== 0 || touches.current.size >= 2 || (drag.current && (!resize || event.pointerType !== 'touch'))) return;
        const page = event.currentTarget.parentElement?.getBoundingClientRect();
        if (!page?.width || !page.height) return;
        event.preventDefault();
        if (event.pointerType !== 'touch') event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (drag.current && resize) {
          const [first, second] = [...touches.current.values()];
          pinch.current = { distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)), scale: resize.scale };
          return;
        }
        drag.current = {
          id: event.pointerId, clientX: event.clientX, clientY: event.clientY,
          scaleX: width / page.width, scaleY: height / page.height, position
        };
      }}
      onPointerMove={event => {
        if (!touches.current.has(event.pointerId)) return;
        touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinch.current && resize) {
          const [first, second] = [...touches.current.values()];
          resize.onChange(pinch.current.scale * Math.hypot(second.x - first.x, second.y - first.y) / pinch.current.distance);
          return;
        }
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        onMove({
          x: start.position.x + (event.clientX - start.clientX) * start.scaleX,
          y: start.position.y + (event.clientY - start.clientY) * start.scaleY
        });
      }}
      onLostPointerCapture={event => {
        if (!touches.current.delete(event.pointerId)) return;
        pinch.current = null;
        const [remaining] = touches.current.entries();
        if (!remaining || !drag.current) {
          drag.current = null;
          return;
        }
        const [id, point] = remaining;
        drag.current = { ...drag.current, id, clientX: point.x, clientY: point.y, position };
      }}
      onKeyDown={event => {
        const direction = arrowMovement[event.key];
        if (!direction) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 2;
        onMove({ x: position.x + direction.x * step, y: position.y + direction.y * step });
      }}>
      <img src={src} alt="" draggable={false} className="pointer-events-none block h-full w-full" />
    </button>
  );
}

export function PlacementField({ label, value, onChange }: {
  label: string;
  value: MarkPlacement;
  onChange: (value: MarkPlacement) => void;
}) {
  return <label className="block space-y-2 text-sm font-semibold">
    <span>{label}</span>
    <select className={fieldClass} value={value} onChange={event => onChange(event.target.value as MarkPlacement)}>
      <option value="off">Do not include</option>
      <option value="last">Last page only</option>
      <option value="all">Every page</option>
    </select>
  </label>;
}

export function AddTodayDateField({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-slate-900"
        checked={checked} onChange={event => onChange(event.target.checked)} />
      Add today’s date to the first page
    </label>
  );
}
