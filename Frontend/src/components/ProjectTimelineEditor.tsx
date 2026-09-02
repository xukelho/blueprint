import { CSS } from "@dnd-kit/utilities";
import { CollisionDetection, DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { Flag, Plus, Trash2 } from "lucide-react";
import { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PROJECT_PHASES, phaseDefinition, phaseLabel } from "../projectPhases";

export type TimelinePhase = { id: string; code: string };
export type TimelineRect = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">;

type Props = { phases: TimelinePhase[]; currentPhaseId: string | null; onPhasesChange: (phases: TimelinePhase[]) => void; onCurrentPhaseIdChange: (phaseId: string | null) => void; onQuickFill: () => void };
const catalogId = (code: string) => `catalog:${code}`;
const timelineDropId = "timeline-drop";
export const newTimelinePhase = (code: string): TimelinePhase => ({ id: globalThis.crypto?.randomUUID?.() ?? `${code}-${Date.now()}-${Math.random()}`, code });

export function timelineConnectorPath(from: TimelineRect, to: TimelineRect, root: TimelineRect) {
  const sameRow = Math.abs(from.top - to.top) < 2;
  if (sameRow) {
    const x1 = from.right - root.left; const y1 = from.top - root.top + from.height / 2;
    const x2 = to.left - root.left;
    return `M ${x1} ${y1} H ${x2}`;
  }
  const x1 = from.left - root.left + from.width / 2; const y1 = from.bottom - root.top;
  const x2 = to.left - root.left + to.width / 2; const y2 = to.top - root.top;
  const middleY = y1 + (y2 - y1) / 2;
  return `M ${x1} ${y1} V ${middleY} H ${x2} V ${y2}`;
}

export function timelineInsertionIndex(phases: TimelinePhase[], overId: string, dropAfter: boolean) {
  if (overId === timelineDropId) return phases.length;
  const targetIndex = phases.findIndex((phase) => phase.id === overId);
  return targetIndex < 0 ? phases.length : targetIndex + (dropAfter ? 1 : 0);
}

export function reorderTimelinePhase(phases: TimelinePhase[], phaseId: string, overId: string | null, dropAfter = false) {
  const oldIndex = phases.findIndex((phase) => phase.id === phaseId);
  if (oldIndex < 0) return phases;
  if (!overId) return phases.filter((phase) => phase.id !== phaseId);
  const insertionIndex = timelineInsertionIndex(phases, overId, dropAfter);
  const newIndex = oldIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;
  return newIndex === oldIndex ? phases : arrayMove(phases, oldIndex, newIndex);
}

function ProjectPhaseCard({ code, isCurrent = false, isCompleted = false, action, className = "" }: { code: string; isCurrent?: boolean; isCompleted?: boolean; action?: ReactNode; className?: string }) {
  const phase = phaseDefinition(code); const Icon = phase.icon;
  return <article className={`project-phase-card ${isCurrent ? "is-current" : ""} ${isCompleted ? "is-completed" : ""} ${className}`.trim()}><strong>{phase.label}</strong><Icon className="project-phase-card__icon" size={42} strokeWidth={1.5} aria-hidden="true" /><div className="project-phase-card__actions">{isCurrent && <small>Fase atual</small>}{action}</div></article>;
}

function CatalogPhase({ code, onAdd }: { code: string; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: catalogId(code), data: { source: "catalog", code } });
  return <div ref={setNodeRef} className={isDragging ? "is-dragging" : ""} {...attributes} {...listeners}><ProjectPhaseCard code={code} action={<button type="button" aria-label={`Adicionar ${phaseLabel(code)}`} onClick={onAdd}><Plus size={16} />Adicionar</button>} /></div>;
}

function SortablePhase({ phase, isCurrent, onSetCurrent, onRemove, itemRef }: { phase: TimelinePhase; isCurrent: boolean; onSetCurrent: () => void; onRemove: () => void; itemRef: (element: HTMLElement | null) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id, data: { source: "timeline", phase } });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined };
  return <div ref={(element) => { setNodeRef(element); itemRef(element); }} style={style} className={isDragging ? "is-dragging" : ""} {...attributes} {...listeners}><ProjectPhaseCard code={phase.code} isCurrent={isCurrent} action={<><button type="button" className="project-phase-card__current-action" aria-label={`Definir ${phaseLabel(phase.code)} como fase atual`} aria-pressed={isCurrent} onClick={onSetCurrent}><Flag size={16} fill={isCurrent ? "currentColor" : "none"} aria-hidden="true" /></button>{!isCurrent && <button type="button" aria-label={`Remover ${phaseLabel(phase.code)}`} onClick={onRemove}><Trash2 size={16} />Remover</button>}</>} /></div>;
}

function TimelineDropArea() {
  const { setNodeRef } = useDroppable({ id: timelineDropId });
  return <div ref={setNodeRef} className="project-timeline-editor__drop-area" aria-hidden="true" />;
}

function TimelineConnectors({ phases, trackRef, itemRefs }: { phases: TimelinePhase[]; trackRef: React.RefObject<HTMLDivElement | null>; itemRefs: React.MutableRefObject<Map<string, HTMLElement>> }) {
  const [paths, setPaths] = useState<string[]>([]); const [viewBox, setViewBox] = useState({ width: 0, height: 0 });
  const measure = useCallback(() => {
    const track = trackRef.current; if (!track) return; const root = track.getBoundingClientRect();
    setViewBox((current) => current.width === root.width && current.height === root.height ? current : { width: root.width, height: root.height });
    setPaths(phases.slice(0, -1).flatMap((phase, index) => { const from = itemRefs.current.get(phase.id)?.getBoundingClientRect(); const to = itemRefs.current.get(phases[index + 1].id)?.getBoundingClientRect(); return from && to ? [timelineConnectorPath(from, to, root)] : []; }));
  }, [itemRefs, phases, trackRef]);
  useLayoutEffect(() => { measure(); const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure); if (trackRef.current) observer?.observe(trackRef.current); window.addEventListener("resize", measure); return () => { observer?.disconnect(); window.removeEventListener("resize", measure); }; }, [measure, trackRef]);
  return <svg className="project-timeline-connectors" viewBox={viewBox.width && viewBox.height ? `0 0 ${viewBox.width} ${viewBox.height}` : undefined} aria-hidden="true"><g>{paths.map((path, index) => <path key={index} d={path} />)}</g></svg>;
}

const timelineCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length) {
    const phaseCollision = pointerCollisions.find((collision) => collision.id !== timelineDropId);
    return phaseCollision ? [phaseCollision] : pointerCollisions;
  }
  return args.pointerCoordinates ? [] : rectIntersection(args);
};

function isDropAfterTarget(drag: DragEndEvent["active"], over: NonNullable<DragEndEvent["over"]>) {
  if (over.id === timelineDropId) return false;
  const draggedRect = drag.rect.current.translated;
  if (!draggedRect) return false;
  const draggedCenterX = draggedRect.left + draggedRect.width / 2;
  const draggedCenterY = draggedRect.top + draggedRect.height / 2;
  const targetCenterX = over.rect.left + over.rect.width / 2;
  const targetCenterY = over.rect.top + over.rect.height / 2;
  if (draggedCenterY > over.rect.bottom) return true;
  if (draggedCenterY < over.rect.top) return false;
  return Math.abs(draggedCenterY - targetCenterY) < over.rect.height / 2 && draggedCenterX > targetCenterX;
}

export function ProjectTimelineEditor({ phases, currentPhaseId, onPhasesChange, onCurrentPhaseIdChange, onQuickFill }: Props) {
  const [active, setActive] = useState<TimelinePhase | null>(null); const trackRef = useRef<HTMLDivElement>(null); const itemRefs = useRef(new Map<string, HTMLElement>());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const add = (code: string) => onPhasesChange([...phases, newTimelinePhase(code)]);
  const remove = (id: string) => { if (id !== currentPhaseId) onPhasesChange(phases.filter((phase) => phase.id !== id)); };
  const onDragStart = ({ active: drag }: DragStartEvent) => { const data = drag.data.current; setActive(data?.source === "catalog" ? { id: String(drag.id), code: data.code } : data?.phase ?? null); };
  const onDragEnd = ({ active: drag, over }: DragEndEvent) => {
    const data = drag.data.current; setActive(null);
    if (data?.source === "catalog") {
      if (!over) return;
      const index = timelineInsertionIndex(phases, String(over.id), isDropAfterTarget(drag, over));
      const next = [...phases]; next.splice(index, 0, newTimelinePhase(data.code)); onPhasesChange(next); return;
    }
    const oldIndex = phases.findIndex((phase) => phase.id === drag.id); if (oldIndex < 0) return;
    if (!over) { remove(String(drag.id)); return; }
    const next = reorderTimelinePhase(phases, String(drag.id), String(over.id), isDropAfterTarget(drag, over));
    if (next !== phases) onPhasesChange(next);
  };
  return <div className="project-timeline-editor"><div className="project-timeline-editor__toolbar"><p>Arraste as fases para construir e reorganizar a timeline. Use a bandeira para indicar a fase atual.</p><button type="button" className="secondary-action" onClick={onQuickFill}>Preenchimento rápido</button></div><DndContext sensors={sensors} collisionDetection={timelineCollisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}><div className="project-phase-catalog" aria-label="Fases disponíveis">{PROJECT_PHASES.map((phase) => <CatalogPhase key={phase.code} code={phase.code} onAdd={() => add(phase.code)} />)}</div><div ref={trackRef} className="project-timeline-editor__track"><TimelineDropArea /><TimelineConnectors phases={phases} trackRef={trackRef} itemRefs={itemRefs} />{!phases.length && <p className="mock-empty-state">Arraste ou adicione fases para construir a timeline.</p>}<SortableContext items={phases.map((phase) => phase.id)} strategy={rectSortingStrategy}>{phases.map((phase) => <SortablePhase key={phase.id} phase={phase} isCurrent={currentPhaseId === phase.id} onSetCurrent={() => onCurrentPhaseIdChange(phase.id)} onRemove={() => remove(phase.id)} itemRef={(element) => { if (element) itemRefs.current.set(phase.id, element); else itemRefs.current.delete(phase.id); }} />)}</SortableContext></div><DragOverlay>{active && <ProjectPhaseCard code={active.code} />}</DragOverlay></DndContext></div>;
}

type TimelineViewProps = {
  phases: TimelinePhase[];
  currentPhaseId: string | null;
  viewedPhaseId?: string | null;
  expanded?: boolean;
  onPhaseSelect?: (phaseId: string) => void;
};

export function ProjectTimelineView({ phases, currentPhaseId, viewedPhaseId = currentPhaseId, expanded = false, onPhaseSelect }: TimelineViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const currentNodeRef = useRef<HTMLButtonElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragRef = useRef<{ pointerId: number; startX: number; scrollLeft: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [selectionRing, setSelectionRing] = useState<{ x: number; y: number; diameter: number } | null>(null);
  const currentPhaseIndex = phases.findIndex((phase) => phase.id === currentPhaseId);

  useEffect(() => {
    currentNodeRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [currentPhaseId, phases.length]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    const node = viewedPhaseId ? nodeRefs.current.get(viewedPhaseId) : null;
    if (!view || !node) { setSelectionRing(null); return; }

    const measure = () => {
      const icon = node.querySelector<HTMLElement>(".project-timeline-node__icon");
      if (!icon) return;
      const root = view.getBoundingClientRect();
      const rect = icon.getBoundingClientRect();
      const diameter = rect.width + (expanded ? 14 : 10);
      const next = { x: rect.left - root.left + rect.width / 2, y: rect.top - root.top + rect.height / 2, diameter };
      setSelectionRing((current) => current && current.x === next.x && current.y === next.y && current.diameter === next.diameter ? current : next);
    };

    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(view);
    observer?.observe(node);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [expanded, phases, viewedPhaseId]);

  const startPanning = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(".project-timeline-node")) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const pan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(distance) > 5) { drag.moved = true; setIsPanning(true); }
    if (drag.moved) event.currentTarget.scrollLeft = drag.scrollLeft - distance;
  };
  const stopPanning = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (drag.moved) window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  };

  return <div
    ref={viewportRef}
    className={`project-timeline-viewport ${isPanning ? "is-panning" : ""}`}
    aria-label="Timeline do projeto"
    onPointerDown={startPanning}
    onPointerMove={pan}
    onPointerUp={stopPanning}
    onPointerCancel={stopPanning}
  >
    <div ref={viewRef} className={`project-timeline-view ${expanded ? "is-expanded" : ""}`}>
      {selectionRing && <span
        className="project-timeline-selection-ring"
        aria-hidden="true"
        style={{ width: selectionRing.diameter, height: selectionRing.diameter, transform: `translate(${selectionRing.x}px, ${selectionRing.y}px) translate(-50%, -50%)` }}
      />}
      {phases.map((phase, index) => {
        const definition = phaseDefinition(phase.code); const Icon = definition.icon;
        const isCurrent = currentPhaseId === phase.id;
        const isViewed = viewedPhaseId === phase.id;
        const isCompleted = currentPhaseIndex >= 0 && index < currentPhaseIndex;
        return <button
          key={phase.id}
          ref={(node) => {
            if (node) nodeRefs.current.set(phase.id, node); else nodeRefs.current.delete(phase.id);
            if (isCurrent) currentNodeRef.current = node;
          }}
          className={`project-timeline-node ${isCompleted ? "is-completed" : ""} ${isCurrent ? "is-current" : ""} ${isViewed ? "is-viewed" : ""}`.trim()}
          type="button"
          aria-label={`${definition.label}${isCurrent ? ", fase atual" : ""}`}
          aria-pressed={isViewed}
          onClick={() => {
            if (suppressClickRef.current) { suppressClickRef.current = false; return; }
            onPhaseSelect?.(phase.id);
          }}
        >
          <span className="project-timeline-node__icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
          {expanded && <span className="project-timeline-node__label">{definition.label}</span>}
          {isCurrent && <span className="sr-only">Fase atual</span>}
        </button>;
      })}
    </div>
  </div>;
}
