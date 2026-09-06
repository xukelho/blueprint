import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DrawingDocument, ProjectPartConversation } from "../api/projects";
import { ProjectDocumentViewer } from "./ProjectDocumentViewer";

const drawing: DrawingDocument = {
  schemaVersion: 1, converterVersion: "test", documentId: "doc", sourceFormat: "dxf", units: null,
  bounds: { minX: 0, minY: -10, maxX: 10, maxY: 0 }, layers: [], text: [], warnings: [],
  paths: [{ layerId: "lines", closed: false, style: { stroke: "#000", lineWeight: 1 }, segments: [{ kind: "line", start: { x: 0, y: -5 }, end: { x: 10, y: -5 } }] }],
};

const conversation: ProjectPartConversation = {
  id: 17,
  documentId: "doc",
  targetKey: "path:0",
  targetKind: "path",
  targetLabel: "Objeto 1",
  title: "Detalhe da parede",
  anchorX: 5,
  anchorY: -5,
  createdAt: "2026-09-07T10:00:00Z",
  messageCount: 23,
};

describe("ProjectDocumentViewer tools", () => {
  it("keeps pan and selection mutually exclusive and only selects with the selection tool", async () => {
    const user = userEvent.setup();
    const onPartSelect = vi.fn();
    render(<ProjectDocumentViewer phaseCode={null} document={null} drawing={drawing} content={null} loading={false} error="" onRetry={vi.fn()} isMaximized={false} onMaximizedChange={vi.fn()} selectedPart={null} conversations={[]} onPartSelect={onPartSelect} onConversationOpen={vi.fn()} />);
    const pan = screen.getByRole("button", { name: "Ferramenta de deslocamento" });
    const select = screen.getByRole("button", { name: "Ferramenta de seleção" });
    const canvas = screen.getByRole("img", { name: /Pré-visualização/ });
    expect(pan).toHaveAttribute("aria-pressed", "true");
    expect(select).toHaveAttribute("aria-pressed", "false");
    fireEvent.pointerUp(canvas, { clientX: 5, clientY: 5 });
    expect(onPartSelect).not.toHaveBeenCalled();
    await user.click(select);
    expect(pan).toHaveAttribute("aria-pressed", "false");
    expect(select).toHaveAttribute("aria-pressed", "true");
    expect(canvas.parentElement).toHaveClass("is-tool-select");
    fireEvent.pointerUp(canvas, { clientX: 5, clientY: 5 });
    expect(onPartSelect).toHaveBeenCalledWith(expect.objectContaining({ key: "path:0", kind: "path" }));
  });

  it("does not use the conversation message count as the marker badge", async () => {
    const user = userEvent.setup();
    const onConversationOpen = vi.fn();
    const { container } = render(<ProjectDocumentViewer phaseCode={null} document={null} drawing={drawing} content={null} loading={false} error="" onRetry={vi.fn()} isMaximized={false} onMaximizedChange={vi.fn()} selectedPart={null} conversations={[conversation]} onPartSelect={vi.fn()} onConversationOpen={onConversationOpen} />);

    const marker = within(container).getByRole("button", { name: "Abrir conversa: Detalhe da parede" });
    expect(within(marker).queryByText("23")).not.toBeInTheDocument();
    await user.click(marker);
    expect(onConversationOpen).toHaveBeenCalledWith(17);
  });

  it("renders an independently supplied marker badge count", () => {
    const { container } = render(<ProjectDocumentViewer phaseCode={null} document={null} drawing={drawing} content={null} loading={false} error="" onRetry={vi.fn()} isMaximized={false} onMaximizedChange={vi.fn()} selectedPart={null} conversations={[conversation]} conversationBadgeCounts={{ 17: 4 }} onPartSelect={vi.fn()} onConversationOpen={vi.fn()} />);

    const marker = within(container).getByRole("button", { name: "Abrir conversa: Detalhe da parede" });
    expect(within(marker).getByText("4")).toBeInTheDocument();
    expect(within(marker).queryByText("23")).not.toBeInTheDocument();
  });
});
