import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { Box, LoaderCircle, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { DrawingDocument, DrawingPath, ProjectDocument } from "../api/projects";
import { phaseDefinition } from "../projectPhases";

type Props = {
  phaseCode: string | null;
  document: ProjectDocument | null;
  drawing: DrawingDocument | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
};
type Viewport = { scale: number; tx: number; ty: number; fitScale: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ProjectDrawingViewer({ phaseCode, document, drawing, loading, error, onRetry }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<Viewport>({ scale: 1, tx: 0, ty: 0, fitScale: 1 });
  const [dragging, setDragging] = useState(false);
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
    for (const path of drawing.paths) drawPath(context, path);
    for (const text of drawing.text) {
      context.save();
      context.fillStyle = text.style.stroke;
      context.font = `${Math.max(text.height, 1)}px sans-serif`;
      context.translate(text.position.x, text.position.y);
      context.rotate(-text.rotation);
      context.scale(1, -1);
      context.fillText(text.value, 0, 0);
      context.restore();
    }
    context.restore();
  }, [drawing, size, view]);

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
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty };
    setDragging(true);
  };
  const pan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setView((current) => ({ ...current, tx: drag.tx + event.clientX - drag.x, ty: drag.ty + event.clientY - drag.y }));
  };
  const endPan = () => { dragRef.current = null; setDragging(false); };

  const phaseLabel = phase?.label ?? "Fase do projeto";
  const unsupported = document && !document.preview;
  return <section className="mock-surface project-drawing-viewer" aria-labelledby="drawing-viewer-title">
    <header className="project-workspace-heading">
      <div><h2 id="drawing-viewer-title">Planta do projeto</h2><p>{document?.fileName ?? "Pré-visualização CAD"}</p></div>
      {phase && <span className="project-context-label">{phaseLabel}</span>}
    </header>
    <div ref={viewportRef} className={`project-drawing-viewer__canvas ${dragging ? "is-dragging" : ""}`}>
      {drawing && !loading && <><canvas ref={canvasRef} role="img" aria-label={`Desenho de ${document?.fileName ?? "projeto"}`} onPointerDown={startPan} onPointerMove={pan} onPointerUp={endPan} onPointerCancel={endPan} />
        <div className="project-drawing-viewer__controls" aria-label="Controlos de zoom"><button type="button" aria-label="Aumentar zoom" onClick={() => changeScale(1.2)}><ZoomIn size={18} /></button><button type="button" aria-label="Diminuir zoom" onClick={() => changeScale(1 / 1.2)}><ZoomOut size={18} /></button></div></>}
      {loading && <div className="project-drawing-viewer__state" role="status"><LoaderCircle size={42} aria-hidden="true" /><strong>A preparar desenho…</strong><span>O ficheiro está a ser convertido para visualização.</span></div>}
      {!loading && error && <div className="project-drawing-viewer__state is-error" role="alert"><Box size={48} aria-hidden="true" /><strong>Não foi possível apresentar este desenho.</strong><span>{error}</span><button type="button" onClick={onRetry}><RotateCcw size={16} />Tentar novamente</button></div>}
      {!loading && !error && unsupported && <div className="project-drawing-viewer__state"><Box size={52} aria-hidden="true" /><strong>Este ficheiro não pode ser visualizado.</strong><span>Selecione um ficheiro CAD compatível para o apresentar aqui.</span></div>}
      {!loading && !error && !drawing && !unsupported && <div className="project-drawing-viewer__state"><Box size={64} aria-hidden="true" /><strong>Sem planta para visualizar</strong><span>Adicione um ficheiro DXF aos documentos desta fase.</span></div>}
    </div>
  </section>;
}

function drawPath(context: CanvasRenderingContext2D, path: DrawingPath) {
  context.beginPath();
  for (const segment of path.segments) {
    if (segment.kind === "line" && segment.start && segment.end) { context.moveTo(segment.start.x, segment.start.y); context.lineTo(segment.end.x, segment.end.y); }
    if (segment.kind === "arc" && segment.center && segment.radius !== null && segment.radius !== undefined) context.arc(segment.center.x, segment.center.y, segment.radius, segment.startAngle ?? 0, segment.endAngle ?? Math.PI * 2);
  }
  context.strokeStyle = path.style.stroke;
  context.lineWidth = Math.max(path.style.lineWeight || 0, 1 / Math.max(context.getTransform().a, 1));
  if (path.style.dash) context.setLineDash(path.style.dash); else context.setLineDash([]);
  if (path.style.fill) { context.fillStyle = path.style.fill; context.fill(); }
  context.stroke();
}
