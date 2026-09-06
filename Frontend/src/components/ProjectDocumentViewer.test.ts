import { describe, expect, it } from "vitest";
import type { DrawingDocument, DrawingPath } from "../api/projects";
import { hitTestDrawing } from "./ProjectDocumentViewer";

const style = { stroke: "#000", lineWeight: 1 };
const rectangle: DrawingPath = { layerId: "walls", style, closed: true, segments: [
  { kind: "line", start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
  { kind: "line", start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
  { kind: "line", start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
  { kind: "line", start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
] };
const drawing: DrawingDocument = { schemaVersion: 1, converterVersion: "test", documentId: "doc", sourceFormat: "dxf", units: null, bounds: { minX: 0, minY: 0, maxX: 30, maxY: 20 }, layers: [], paths: [
  rectangle,
  { layerId: "fixtures", style, closed: true, segments: [{ kind: "arc", center: { x: 20, y: 5 }, radius: 3, startAngle: 0, endAngle: Math.PI * 2 }] },
  { layerId: "lines", style, closed: false, segments: [{ kind: "line", start: { x: 0, y: 15 }, end: { x: 10, y: 15 } }] },
], text: [{ layerId: "labels", style, value: "Kitchen", position: { x: 12, y: 12 }, height: 2, rotation: 0 }], warnings: [] };

describe("drawing selection hit testing", () => {
  it("selects path geometry near its stroke", () => expect(hitTestDrawing(drawing, { x: 5, y: 15.1 }, .25)).toMatchObject({ key: "path:2", kind: "path" }));
  it("detects an otherwise undefined closed area", () => expect(hitTestDrawing(drawing, { x: 5, y: 5 }, .25)).toMatchObject({ key: "area:0", kind: "area" }));
  it("detects circular areas from arc geometry", () => expect(hitTestDrawing(drawing, { x: 20, y: 5 }, .25)).toMatchObject({ key: "area:1", kind: "area" }));
  it("selects drawing text", () => expect(hitTestDrawing(drawing, { x: 13, y: 13 }, .25)).toMatchObject({ key: "text:0", kind: "text" }));
  it("returns no selection in empty space", () => expect(hitTestDrawing(drawing, { x: 28, y: 18 }, .25)).toBeNull());
  it("detects areas assembled from otherwise unrelated line objects", () => {
    const splitDrawing = { ...drawing, paths: rectangle.segments.map((segment) => ({ layerId: "walls", style, closed: false, segments: [segment] })), text: [] };
    expect(hitTestDrawing(splitDrawing, { x: 5, y: 5 }, .25)).toMatchObject({ key: "area:0,1,2,3", kind: "area" });
  });
});
