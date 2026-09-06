import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { Box, Hand, LoaderCircle, Maximize2, MessageSquare, Minimize2, MousePointer2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { DrawingDocument, DrawingPath, DrawingPoint, DrawingSelection, ProjectDocument, ProjectPartConversation } from "../api/projects";
import { phaseDefinition } from "../projectPhases";
import { filePreviewKind, ProjectFileViewer } from "./ProjectFileViewer";

type Props = {
  phaseCode: string | null;
  document: ProjectDocument | null;
  drawing: DrawingDocument | null;
  content: Blob | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  isMaximized: boolean;
  onMaximizedChange: (maximized: boolean) => void;
  selectedPart: DrawingSelection | null;
  conversations: ProjectPartConversation[];
  conversationBadgeCounts?: Readonly<Record<number, number>>;
  onPartSelect: (selection: DrawingSelection | null) => void;
  onConversationOpen: (conversationId: number) => void;
};
type Viewport = { scale: number; tx: number; ty: number; fitScale: number };
type ViewerTool = "pan" | "select";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const modelPoint = (event: ReactPointerEvent<HTMLCanvasElement>, view: Viewport): DrawingPoint => {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: (event.clientX - rect.left - view.tx) / view.scale, y: (view.ty - (event.clientY - rect.top)) / view.scale };
};

export function ProjectDocumentViewer({ phaseCode, document, drawing, content, loading, error, onRetry, isMaximized, onMaximizedChange, selectedPart, conversations, conversationBadgeCounts, onPartSelect, onConversationOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<Viewport>({ scale: 1, tx: 0, ty: 0, fitScale: 1 });
  const [dragging, setDragging] = useState(false);
  const [tool, setTool] = useState<ViewerTool>("pan");
  const [hoveredPart, setHoveredPart] = useState<DrawingSelection | null>(null);
  const phase = phaseCode ? phaseDefinition(phaseCode) : null;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    if (!drawing || !size.width || !size.height) return;
    const width = Math.max(drawing.bounds.maxX - drawing.bounds.minX, 1);
    const height = Math.max(drawing.bounds.maxY - drawing.bounds.minY, 1);
    const scale = Math.min(size.width / (width * 1.1), size.height / (height * 1.1));
    setView({ scale, fitScale: scale, tx: size.width / 2 - ((drawing.bounds.minX + drawing.bounds.maxX) / 2) * scale, ty: size.height / 2 + ((drawing.bounds.minY + drawing.bounds.maxY) / 2) * scale });
  }, [drawing, size.width, size.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawing || !size.width || !size.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.save();
    context.translate(view.tx, view.ty);
    context.scale(view.scale, -view.scale);
    const compositeArea = selectedPart?.kind === "area" && selectedPart.key.includes(",") ? selectedPart : hoveredPart?.kind === "area" && hoveredPart.key.includes(",") ? hoveredPart : null;
    if (compositeArea) {
      const area = joinedAreas(drawing).find((candidate) => candidate.key === compositeArea.key);
      if (area) { context.beginPath(); area.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.closePath(); context.fillStyle = compositeArea === selectedPart ? "rgba(0, 167, 181, .2)" : "rgba(245, 158, 11, .18)"; context.fill(); }
    }
    drawing.paths.forEach((path, index) => {
      const selectedArea = selectedPart?.kind === "area" && selectedPart.key.slice(5).split(",").includes(String(index));
      const hoveredArea = hoveredPart?.kind === "area" && hoveredPart.key.slice(5).split(",").includes(String(index));
      drawPath(context, path, selectedPart?.key === `path:${index}` || selectedArea, selectedArea, hoveredPart?.key === `path:${index}` || hoveredArea, hoveredArea);
    });
    drawing.text.forEach((text, index) => {
      context.save();
      context.fillStyle = text.style.stroke;
      context.font = `${Math.max(text.height, 1)}px sans-serif`;
      context.translate(text.position.x, text.position.y);
      context.rotate(-text.rotation);
      context.scale(1, -1);
      context.fillText(text.value, 0, 0);
      if (selectedPart?.key === `text:${index}` || hoveredPart?.key === `text:${index}`) {
        const width = Math.max(context.measureText(text.value).width, text.height);
        context.strokeStyle = selectedPart?.key === `text:${index}` ? "#00a7b5" : "#f59e0b"; context.lineWidth = 2 / view.scale;
        context.strokeRect(-text.height * .15, -text.height * .2, width + text.height * .3, text.height * 1.3);
      }
      context.restore();
    });
    context.restore();
  }, [drawing, size, view, selectedPart, hoveredPart]);

  useEffect(() => { setHoveredPart(null); dragRef.current = null; setDragging(false); }, [tool, drawing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawing) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setView((current) => {
        const scale = clamp(current.scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2), current.fitScale * .1, current.fitScale * 100);
        const modelX = (x - current.tx) / current.scale;
        const modelY = (current.ty - y) / current.scale;
        return { ...current, scale, tx: x - modelX * scale, ty: y + modelY * scale };
      });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [drawing]);

  const changeScale = (factor: number, x = size.width / 2, y = size.height / 2) => {
    setView((current) => {
      const scale = clamp(current.scale * factor, current.fitScale * .1, current.fitScale * 100);
      const modelX = (x - current.tx) / current.scale;
      const modelY = (current.ty - y) / current.scale;
      return { ...current, scale, tx: x - modelX * scale, ty: y + modelY * scale };
    });
  };
  const startPan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (tool !== "pan" || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty };
    setDragging(true);
  };
  const pan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (tool === "select") {
      if (!drawing) return;
      const point = modelPoint(event, view);
      setHoveredPart(hitTestDrawing(drawing, point, 8 / view.scale));
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    setView((current) => ({ ...current, tx: drag.tx + event.clientX - drag.x, ty: drag.ty + event.clientY - drag.y }));
  };
  const endPan = () => { dragRef.current = null; setDragging(false); };
  const endPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (tool === "select") {
      if (drawing) onPartSelect(hitTestDrawing(drawing, modelPoint(event, view), 8 / view.scale));
      return;
    }
    const drag = dragRef.current;
    endPan();
    if (!drag || !drawing || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) return;
  };

  const phaseLabel = phase?.label ?? "Fase do projeto";
  const unsupported = document && !document.preview && filePreviewKind(document.fileName) === "unsupported";
  return <section className={`mock-surface project-document-viewer ${isMaximized ? "is-maximized" : ""}`} aria-labelledby="document-visualizer-title">
    <header className="project-workspace-heading">
      <div><h2 id="document-visualizer-title">Visualizador de documentos</h2><p>{document?.fileName ?? "Pré-visualização de documentos"}</p></div>
      <div className="project-document-viewer__header-actions">
        {phase && <span className="project-context-label">{phaseLabel}</span>}
        <button type="button" className="project-icon-action" aria-label={isMaximized ? "Repor tamanho do visualizador de documentos" : "Maximizar visualizador de documentos"} aria-pressed={isMaximized} onClick={() => onMaximizedChange(!isMaximized)}>
          {isMaximized ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
        </button>
      </div>
    </header>
    <div ref={viewportRef} className={`project-document-viewer__canvas is-tool-${tool} ${dragging ? "is-dragging" : ""}`}>
      {drawing && !loading && <><canvas ref={canvasRef} role="img" aria-label={`Pré-visualização de ${document?.fileName ?? "documento"}`} onPointerDown={startPan} onPointerMove={pan} onPointerUp={endPointer} onPointerCancel={endPan} onPointerLeave={() => tool === "select" && setHoveredPart(null)} />
        <div className="project-document-viewer__markers" aria-label="Conversas no desenho">{conversations.map((conversation) => <button type="button" key={conversation.id} aria-label={`Abrir conversa: ${conversation.title}`} title={conversation.title} style={{ left: view.tx + conversation.anchorX * view.scale, top: view.ty - conversation.anchorY * view.scale }} onPointerDown={(event) => event.stopPropagation()} onClick={() => onConversationOpen(conversation.id)}><MessageSquare size={14} aria-hidden="true" />{conversationBadgeCounts?.[conversation.id] !== undefined && <span>{conversationBadgeCounts[conversation.id]}</span>}</button>)}</div>
        <div className="project-document-viewer__controls" aria-label="Ferramentas do visualizador"><button type="button" className="project-document-viewer__tool" aria-label="Ferramenta de deslocamento" aria-pressed={tool === "pan"} title="Deslocar desenho" onClick={() => setTool("pan")}><Hand size={18} /></button><button type="button" className="project-document-viewer__tool" aria-label="Ferramenta de seleção" aria-pressed={tool === "select"} title="Selecionar objetos e áreas" onClick={() => setTool("select")}><MousePointer2 size={18} /></button><span className="project-document-viewer__control-separator" aria-hidden="true" /><button type="button" aria-label="Aumentar zoom" onClick={() => changeScale(1.2)}><ZoomIn size={18} /></button><button type="button" aria-label="Diminuir zoom" onClick={() => changeScale(1 / 1.2)}><ZoomOut size={18} /></button></div></>}
      {document && content && !loading && <ProjectFileViewer document={document} content={content} />}
      {loading && <div className="project-document-viewer__state" role="status"><LoaderCircle size={42} aria-hidden="true" /><strong>A preparar documento…</strong><span>O ficheiro está a ser convertido para visualização.</span></div>}
      {!loading && error && <div className="project-document-viewer__state is-error" role="alert"><Box size={48} aria-hidden="true" /><strong>Não foi possível apresentar este documento.</strong><span>{error}</span><button type="button" onClick={onRetry}><RotateCcw size={16} />Tentar novamente</button></div>}
      {!loading && !error && unsupported && <div className="project-document-viewer__state"><Box size={52} aria-hidden="true" /><strong>Este ficheiro não pode ser visualizado.</strong><span>O formato ainda não tem um visualizador de leitura.</span></div>}
      {!loading && !error && !drawing && !content && !unsupported && <div className="project-document-viewer__state"><Box size={64} aria-hidden="true" /><strong>Sem documento para visualizar</strong><span>Selecione um documento disponível nesta fase.</span></div>}
    </div>
  </section>;
}

function drawPath(context: CanvasRenderingContext2D, path: DrawingPath, selected = false, selectedArea = false, hovered = false, hoveredArea = false) {
  context.beginPath();
  for (const segment of path.segments) {
    if (segment.kind === "line" && segment.start && segment.end) { context.moveTo(segment.start.x, segment.start.y); context.lineTo(segment.end.x, segment.end.y); }
    if (segment.kind === "arc" && segment.center && segment.radius !== null && segment.radius !== undefined) context.arc(segment.center.x, segment.center.y, segment.radius, segment.startAngle ?? 0, segment.endAngle ?? Math.PI * 2);
  }
  context.strokeStyle = selected ? "#00a7b5" : hovered ? "#f59e0b" : path.style.stroke;
  context.lineWidth = selected || hovered ? 3 / Math.max(context.getTransform().a, 1) : Math.max(path.style.lineWeight || 0, 1 / Math.max(context.getTransform().a, 1));
  if (path.style.dash) context.setLineDash(path.style.dash); else context.setLineDash([]);
  if (selectedArea) { context.fillStyle = "rgba(0, 167, 181, .2)"; context.fill(); }
  else if (hoveredArea) { context.fillStyle = "rgba(245, 158, 11, .18)"; context.fill(); }
  else if (path.style.fill) { context.fillStyle = path.style.fill; context.fill(); }
  context.stroke();
}

const distanceToSegment = (point: DrawingPoint, start: DrawingPoint, end: DrawingPoint) => {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
};

function pathPoints(path: DrawingPath): DrawingPoint[] {
  const points: DrawingPoint[] = [];
  path.segments.forEach((segment) => {
    if (segment.kind === "line" && segment.start && segment.end) {
      if (!points.length) points.push(segment.start);
      points.push(segment.end);
    } else if (segment.kind === "arc" && segment.center && segment.radius != null) {
      const start = segment.startAngle ?? 0; let sweep = (segment.endAngle ?? Math.PI * 2) - start;
      if (Math.abs(sweep) < 1e-8) sweep = Math.PI * 2;
      const steps = Math.max(12, Math.ceil(Math.abs(sweep) / (Math.PI / 18)));
      for (let step = 0; step <= steps; step++) points.push({ x: segment.center.x + Math.cos(start + sweep * step / steps) * segment.radius, y: segment.center.y + Math.sin(start + sweep * step / steps) * segment.radius });
    }
  });
  return points;
}

function isArea(path: DrawingPath, points: DrawingPoint[], tolerance: number) {
  if (path.closed) return points.length >= 3;
  return points.length >= 4 && Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y) <= tolerance;
}

function pointInPolygon(point: DrawingPoint, polygon: DrawingPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const centerOf = (points: DrawingPoint[]) => ({ x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length });

type JoinedArea = { key: string; points: DrawingPoint[] };
const joinedAreaCache = new WeakMap<DrawingDocument, JoinedArea[]>();

function joinedAreas(drawing: DrawingDocument) {
  const cached = joinedAreaCache.get(drawing);
  if (cached) return cached;
  const joinTolerance = Math.max(Math.hypot(drawing.bounds.maxX - drawing.bounds.minX, drawing.bounds.maxY - drawing.bounds.minY) * 1e-6, 1e-7);
  const candidates = drawing.paths.map((path, index) => ({ index, points: pathPoints(path) })).filter((item) => item.points.length >= 2);
  const endpointKey = (point: DrawingPoint) => `${Math.round(point.x / joinTolerance)}:${Math.round(point.y / joinTolerance)}`;
  const endpoints = new Map<string, typeof candidates>();
  candidates.forEach((candidate) => [candidate.points[0], candidate.points.at(-1)!].forEach((point) => endpoints.set(endpointKey(point), [...(endpoints.get(endpointKey(point)) ?? []), candidate])));
  const found = new Map<string, JoinedArea>();
  const processed = new Set<number>();
  candidates.forEach((start) => {
    if (processed.has(start.index)) return;
    if (Math.hypot(start.points[0].x - start.points.at(-1)!.x, start.points[0].y - start.points.at(-1)!.y) <= joinTolerance) return;
    const indexes = [start.index]; const points = [...start.points];
    for (let step = 0; step < candidates.length; step++) {
      const end = points.at(-1)!;
      if (indexes.length >= 3 && Math.hypot(end.x - points[0].x, end.y - points[0].y) <= joinTolerance) {
        const canonical = [...indexes].sort((a, b) => a - b).join(",");
        found.set(canonical, { key: `area:${canonical}`, points }); indexes.forEach((index) => processed.add(index)); break;
      }
      const next = (endpoints.get(endpointKey(end)) ?? []).find((candidate) => !indexes.includes(candidate.index) && (Math.hypot(candidate.points[0].x - end.x, candidate.points[0].y - end.y) <= joinTolerance || Math.hypot(candidate.points.at(-1)!.x - end.x, candidate.points.at(-1)!.y - end.y) <= joinTolerance));
      if (!next) break;
      const ordered = Math.hypot(next.points[0].x - end.x, next.points[0].y - end.y) <= joinTolerance ? next.points : [...next.points].reverse();
      indexes.push(next.index); points.push(...ordered.slice(1));
    }
  });
  const result = Array.from(found.values());
  joinedAreaCache.set(drawing, result);
  return result;
}

export function hitTestDrawing(drawing: DrawingDocument, point: DrawingPoint, tolerance: number): DrawingSelection | null {
  for (let index = drawing.text.length - 1; index >= 0; index--) {
    const text = drawing.text[index];
    const width = Math.max(text.value.length * text.height * .65, text.height);
    if (Math.abs(point.x - text.position.x - width / 2) <= width / 2 + tolerance && Math.abs(point.y - text.position.y - text.height / 2) <= text.height / 2 + tolerance)
      return { key: `text:${index}`, kind: "text", label: `Texto “${text.value.slice(0, 40)}”`, anchor: text.position };
  }
  const paths = drawing.paths.map((path, index) => ({ path, index, points: pathPoints(path) }));
  for (let cursor = paths.length - 1; cursor >= 0; cursor--) {
    const item = paths[cursor];
    if (item.points.some((candidate, index) => index > 0 && distanceToSegment(point, item.points[index - 1], candidate) <= tolerance))
      return { key: `path:${item.index}`, kind: "path", label: `Objeto ${item.index + 1}`, anchor: centerOf(item.points) };
  }
  for (let cursor = paths.length - 1; cursor >= 0; cursor--) {
    const item = paths[cursor];
    if (isArea(item.path, item.points, tolerance) && pointInPolygon(point, item.points))
      return { key: `area:${item.index}`, kind: "area", label: `Área ${item.index + 1}`, anchor: centerOf(item.points) };
  }
  const areas = joinedAreas(drawing);
  for (let index = areas.length - 1; index >= 0; index--) if (pointInPolygon(point, areas[index].points))
    return { key: areas[index].key, kind: "area", label: `Área detetada ${index + 1}`, anchor: centerOf(areas[index].points) };
  return null;
}
