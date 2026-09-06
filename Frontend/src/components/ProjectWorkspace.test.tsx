import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDocuments, ProjectDocumentsByPhase, ProjectGlobalChat } from "./ProjectWorkspace";

const phases = [{ id: "11", code: "preliminary-study" }];
const document = (id: string, fileName: string) => ({ id, phaseId: 11, fileName, contentType: "application/octet-stream", length: 1000, status: "Available", createdBy: 1, createdByDisplayName: "Ana", createdAt: "2026-08-12T10:00:00Z", uploadedAt: "2026-08-12T10:00:01Z" });
const documents: ProjectDocumentsByPhase = { "11": [document("one", "one.pdf"), document("two", "two.docx"), document("three", "three.ifc")] };

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("ProjectDocuments", () => {
  it("supports exclusive, additive and range selection, then confirms keyboard deletion", async () => {
    const user = userEvent.setup();
    const onDeleteDocument = vi.fn().mockResolvedValue(undefined);
    render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={documents} onUploadFile={vi.fn()} onDeleteDocument={onDeleteDocument} />);
    const first = screen.getByRole("option", { name: /one\.pdf/ });
    const second = screen.getByRole("option", { name: /two\.docx/ });
    const third = screen.getByRole("option", { name: /three\.ifc/ });

    await user.click(first);
    await user.keyboard("{Control>}");
    await user.click(second);
    await user.keyboard("{/Control}");
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveAttribute("aria-selected", "true");

    await user.click(first);
    await user.keyboard("{Shift>}");
    await user.click(third);
    await user.keyboard("{/Shift}");
    expect([first, second, third].every((item) => item.getAttribute("aria-selected") === "true")).toBe(true);

    await user.keyboard("{Delete}");
    const dialog = screen.getByRole("alertdialog", { name: "Eliminar 3 documentos?" });
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(onDeleteDocument).toHaveBeenCalledTimes(3));
  });

  it("uploads all dropped files independently and reports only failed names", async () => {
    const onUploadFile = vi.fn((_phaseId: string, file: File) => file.name === "bad.zip" ? Promise.reject(new Error("failed")) : Promise.resolve());
    const { container } = render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{}} onUploadFile={onUploadFile} onDeleteDocument={vi.fn()} />);
    const section = container.querySelector(".project-documents")!;
    const files = [new File(["ok"], "good.png", { type: "image/png" }), new File(["bad"], "bad.zip", { type: "application/zip" })];

    fireEvent.dragEnter(section, { dataTransfer: { types: ["Files"], files } });
    expect(section).toHaveClass("is-dragging");
    fireEvent.drop(section, { dataTransfer: { types: ["Files"], files } });

    await waitFor(() => expect(onUploadFile).toHaveBeenCalledTimes(2));
    expect(onUploadFile).toHaveBeenNthCalledWith(1, "11", files[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("bad.zip");
    expect(screen.queryByText(/good\.png/)).not.toBeInTheDocument();
  });

  it("does not open deletion while Delete originates from the file input", async () => {
    render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={documents} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} />);
    fireEvent.click(screen.getByRole("option", { name: /one\.pdf/ }));
    const input = screen.getByLabelText("Adicionar documentos");
    input.focus();
    fireEvent.keyDown(input, { key: "Delete" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps failed deletions selected after a partial batch failure", async () => {
    const user = userEvent.setup();
    const onDeleteDocument = vi.fn((id: string) => id === "two" ? Promise.reject(new Error("failed")) : Promise.resolve());
    render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={documents} onUploadFile={vi.fn()} onDeleteDocument={onDeleteDocument} />);
    const first = screen.getByRole("option", { name: /one\.pdf/ });
    const second = screen.getByRole("option", { name: /two\.docx/ });
    await user.click(first);
    await user.keyboard("{Control>}");
    await user.click(second);
    await user.keyboard("{/Control}{Delete}");
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("ficheiro selecionado"));
    expect(first).toHaveAttribute("aria-selected", "false");
    expect(second).toHaveAttribute("aria-selected", "true");
  });

  it("downloads an available document without changing its selection or preview", async () => {
    const user = userEvent.setup();
    const onDownloadDocument = vi.fn().mockResolvedValue(undefined);
    const onPreviewDocumentSelect = vi.fn();
    render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={documents} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onDownloadDocument={onDownloadDocument} onPreviewDocumentSelect={onPreviewDocumentSelect} />);

    await user.click(screen.getByRole("button", { name: "Transferir one.pdf" }));

    expect(onDownloadDocument).toHaveBeenCalledWith(documents["11"][0]);
    expect(onPreviewDocumentSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: /one\.pdf/ })).toHaveAttribute("aria-selected", "false");
  });

  it("disables an in-progress download, reports failures, and hides unavailable downloads", async () => {
    const user = userEvent.setup();
    let resolveDownload: (() => void) | undefined;
    const onDownloadDocument = vi.fn(() => new Promise<void>((resolve) => { resolveDownload = resolve; }));
    const { rerender } = render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={documents} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onDownloadDocument={onDownloadDocument} />);
    const download = screen.getByRole("button", { name: "Transferir one.pdf" });

    await user.click(download);
    await user.click(download);
    expect(onDownloadDocument).toHaveBeenCalledTimes(1);
    expect(download).toBeDisabled();
    resolveDownload?.();
    await waitFor(() => expect(download).not.toBeDisabled());

    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [{ ...documents["11"][0], id: "failed", fileName: "failed.pdf" }] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onDownloadDocument={vi.fn().mockRejectedValue(new Error("failed"))} />);
    await user.click(screen.getByRole("button", { name: "Transferir failed.pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível transferir failed.pdf.");

    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [{ ...documents["11"][0], status: "Pending" }] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onDownloadDocument={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Transferir one.pdf" })).not.toBeInTheDocument();

    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [documents["11"][0]] }} readOnly onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onDownloadDocument={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Transferir one.pdf" })).toBeInTheDocument();
  });

  it("uses category classes for common formats and a generic fallback", () => {
    const categorized: ProjectDocumentsByPhase = { "11": [
      document("pdf", "plan.pdf"), document("word", "brief.odt"), document("sheet", "costs.xlsx"),
      document("slides", "review.pptx"), document("image", "render.png"), document("archive", "bundle.zip"),
      document("model", "building.ifc"), document("dwfx-model", "drawing.dwfx"), document("text", "notes.md"), document("other", "data.xyz"),
    ] };
    const { container } = render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={categorized} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} />);
    for (const kind of ["pdf", "document", "spreadsheet", "presentation", "image", "archive", "model", "text", "generic"])
      expect(container.querySelector(`.project-document__file--${kind}`)).toBeInTheDocument();
    expect(container.querySelectorAll(".project-document__file--model")).toHaveLength(2);
  });
});

describe("ProjectGlobalChat", () => {
  it("loads older messages and deduplicates periodic updates", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/projects/1/messages") return new Response(JSON.stringify({ items: [{ id: 2, authorDisplayName: "Ana", body: "Atual", createdAt: "2026-09-06T10:00:00Z", isOwn: true }], hasMore: true }), { headers: { "Content-Type": "application/json" } });
      if (url === "/api/projects/1/messages?beforeId=2") return new Response(JSON.stringify({ items: [{ id: 1, authorDisplayName: "Marta", body: "Anterior", createdAt: "2026-09-06T09:00:00Z", isOwn: false }], hasMore: false }), { headers: { "Content-Type": "application/json" } });
      if (url === "/api/projects/1/messages?afterId=2") return new Response(JSON.stringify({ items: [{ id: 2, authorDisplayName: "Ana", body: "Atual", createdAt: "2026-09-06T10:00:00Z", isOwn: true }, { id: 3, authorDisplayName: "Beatriz", body: "Nova", createdAt: "2026-09-06T10:05:00Z", isOwn: false }], hasMore: false }), { headers: { "Content-Type": "application/json" } });
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<ProjectGlobalChat projectId="1" archived={false} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText("Atual")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Carregar mensagens anteriores" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText("Anterior")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getAllByText("Atual")).toHaveLength(1);
  });

  it("preserves the draft when sending fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => init?.method === "POST"
      ? new Response(JSON.stringify({ error: "Falha ao enviar." }), { status: 500, headers: { "Content-Type": "application/json" } })
      : new Response(JSON.stringify({ items: [], hasMore: false }), { headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<ProjectGlobalChat projectId="1" archived={false} />);
    const composer = await screen.findByLabelText("Nova mensagem");
    await user.type(composer, "Não perder este texto");
    await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao enviar.");
    expect(composer).toHaveValue("Não perder este texto");
  });
});
