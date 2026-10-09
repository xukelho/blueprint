import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDocuments, ProjectDocumentsByPhase, ProjectGlobalChat } from "./ProjectWorkspace";

const phases = [{ id: "11", code: "preliminary-study" }];
const document = (id: string, fileName: string) => ({ id, phaseId: 11, fileName, contentType: "application/octet-stream", length: 1000, status: "Available", isVisible: true, createdBy: 1, createdByDisplayName: "Ana", createdAt: "2026-08-12T10:00:00Z", uploadedAt: "2026-08-12T10:00:01Z" });
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

  it("shows the hidden action only on hover or focus and hides it without professional support", () => {
    const hidden = { ...documents["11"][0], isVisible: false };
    const { rerender } = render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [hidden] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Mostrar one.pdf aos clientes" })).not.toBeInTheDocument();

    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [hidden] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={vi.fn().mockResolvedValue(undefined)} />);
    const control = screen.getByRole("button", { name: "Mostrar one.pdf aos clientes" });
    expect(control).toHaveAttribute("aria-pressed", "false");
    expect(control).not.toHaveClass("is-shown");
    fireEvent.pointerEnter(control.closest(".project-document")!);
    fireEvent.focus(control);
    expect(control).not.toHaveClass("is-shown");
  });

  it("keeps visibility pending after pointer exit, blocks duplicates, and waits for server props", async () => {
    const hidden = { ...documents["11"][0], isVisible: false };
    let resolveChange: (() => void) | undefined;
    const onVisibilityChange = vi.fn(() => new Promise<void>((resolve) => { resolveChange = resolve; }));
    const { rerender } = render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [hidden] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    const card = screen.getByRole("option", { name: /one\.pdf/ }).closest(".project-document")!;
    const control = screen.getByRole("button", { name: "Mostrar one.pdf aos clientes" });
    fireEvent.pointerEnter(card);
    fireEvent.click(control);
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute("aria-busy", "true");
    expect(control).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent("A atualizar visibilidade de one.pdf");
    fireEvent.pointerLeave(card);
    expect(control).toHaveClass("is-shown");
    fireEvent.click(control);
    expect(onVisibilityChange).toHaveBeenCalledTimes(1);

    await act(async () => { resolveChange?.(); });
    expect(control).toHaveAttribute("aria-pressed", "false");
    expect(control).not.toBeDisabled();
    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [{ ...hidden, isVisible: true }] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    expect(screen.getByRole("button", { name: "Ocultar one.pdf dos clientes" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps pending state across phase changes, allows other documents, and suppresses a late failure", async () => {
    const testPhases = [...phases, { id: "12", code: "licensing-project" }];
    const first = { ...documents["11"][0], isVisible: false };
    const other = { ...documents["11"][1], isVisible: false };
    const nextPhase = { ...documents["11"][2], phaseId: 12, isVisible: false };
    const deferred = new Map<string, { resolve: () => void; reject: () => void }>();
    const onVisibilityChange = vi.fn((item: typeof first) => new Promise<void>((resolve, reject) => {
      deferred.set(item.id, { resolve: () => resolve(), reject: () => reject(new Error("late failure")) });
    }));
    const { rerender } = render(<ProjectDocuments phases={testPhases} viewedPhaseId="11" documents={{ "11": [first, other], "12": [nextPhase] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar one.pdf aos clientes" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar two.docx aos clientes" }));
    expect(onVisibilityChange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "A atualizar visibilidade de one.pdf" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "A atualizar visibilidade de two.docx" })).toBeDisabled();
    await act(async () => { deferred.get("two")?.resolve(); });

    rerender(<ProjectDocuments phases={testPhases} viewedPhaseId="12" documents={{ "11": [first, other], "12": [nextPhase] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar three.ifc aos clientes" }));
    expect(screen.getByRole("button", { name: "A atualizar visibilidade de three.ifc" })).toBeDisabled();
    rerender(<ProjectDocuments phases={testPhases} viewedPhaseId="11" documents={{ "11": [first, other], "12": [nextPhase] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    expect(screen.getByRole("button", { name: "A atualizar visibilidade de one.pdf" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "A atualizar visibilidade de one.pdf" }));
    expect(onVisibilityChange).toHaveBeenCalledTimes(3);

    rerender(<ProjectDocuments phases={testPhases} viewedPhaseId="12" documents={{ "11": [first, other], "12": [nextPhase] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    await act(async () => { deferred.get("one")?.reject(); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => { deferred.get("three")?.resolve(); });
  });

  it("starts hide grace after a save resolves outside the card and clears it when the document is removed", async () => {
    vi.useFakeTimers();
    let resolveVisibility: (() => void) | undefined;
    const onVisibilityChange = vi.fn(() => new Promise<void>((resolve) => { resolveVisibility = resolve; }));
    const visible = documents["11"][0];
    const { rerender } = render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [visible] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    let card = screen.getByRole("option", { name: /one\.pdf/ }).closest(".project-document")!;
    fireEvent.pointerEnter(card);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar one.pdf dos clientes" }));
    fireEvent.pointerLeave(card);
    await act(async () => { resolveVisibility?.(); });
    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [{ ...visible, isVisible: false }] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    let control = screen.getByRole("button", { name: "Mostrar one.pdf aos clientes" });
    expect(control).toHaveClass("is-shown");
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(control).toHaveClass("is-shown");
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(control).not.toHaveClass("is-shown");

    onVisibilityChange.mockResolvedValue(undefined);
    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [visible] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    card = screen.getByRole("option", { name: /one\.pdf/ }).closest(".project-document")!;
    fireEvent.pointerEnter(card);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar one.pdf dos clientes" }));
    await act(async () => { await Promise.resolve(); });
    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [{ ...visible, isVisible: false }] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    control = screen.getByRole("button", { name: "Mostrar one.pdf aos clientes" });
    fireEvent.pointerLeave(card);
    expect(vi.getTimerCount()).toBe(1);
    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{}} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restores hidden state and reports a Portuguese error when visibility fails", async () => {
    const hidden = { ...documents["11"][0], isVisible: false };
    render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [hidden] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={vi.fn().mockRejectedValue(new Error("server"))} />);
    const control = screen.getByRole("button", { name: "Mostrar one.pdf aos clientes" });
    fireEvent.click(control);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível atualizar a visibilidade de one.pdf.");
    expect(control).toHaveAttribute("aria-pressed", "false");
    expect(control).not.toBeDisabled();
    expect(control).toHaveAttribute("aria-busy", "false");
  });

  it("keeps hide feedback for five seconds after pointer and focus leave, restarting after re-entry", async () => {
    vi.useFakeTimers();
    const onVisibilityChange = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={documents} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    const card = screen.getByRole("option", { name: /one\.pdf/ }).closest(".project-document")!;
    const control = screen.getByRole("button", { name: "Ocultar one.pdf dos clientes" });
    fireEvent.pointerEnter(card);
    fireEvent.focus(control);
    fireEvent.click(control);
    await act(async () => { await Promise.resolve(); });
    expect(control).toHaveClass("is-shown");
    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [{ ...documents["11"][0], isVisible: false }, documents["11"][1], documents["11"][2]] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    const hiddenControl = screen.getByRole("button", { name: "Mostrar one.pdf aos clientes" });
    fireEvent.pointerLeave(card);
    fireEvent.blur(hiddenControl, { relatedTarget: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(hiddenControl).toHaveClass("is-shown");
    fireEvent.pointerEnter(card);
    fireEvent.pointerLeave(card);
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(hiddenControl).toHaveClass("is-shown");
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(hiddenControl).not.toHaveClass("is-shown");

      rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={documents} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
      const shownControl = screen.getByRole("button", { name: "Ocultar one.pdf dos clientes" });
      fireEvent.pointerEnter(card);
      fireEvent.focus(shownControl);
      fireEvent.click(shownControl);
      await act(async () => { await Promise.resolve(); });
      rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [{ ...documents["11"][0], isVisible: false }, documents["11"][1], documents["11"][2]] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
      const focusedHiddenControl = screen.getByRole("button", { name: "Mostrar one.pdf aos clientes" });
      fireEvent.pointerLeave(card);
      fireEvent.blur(focusedHiddenControl, { relatedTarget: null });
      fireEvent.focus(focusedHiddenControl);
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(focusedHiddenControl).toHaveClass("is-shown");
      fireEvent.blur(focusedHiddenControl, { relatedTarget: null });
      expect(vi.getTimerCount()).toBe(1);
      cleanup();
      expect(vi.getTimerCount()).toBe(0);
    });

  it("does not select a document when visibility is changed and omits unavailable actions", async () => {
    const onPreviewDocumentSelect = vi.fn();
    const onVisibilityChange = vi.fn().mockResolvedValue(undefined);
    const hidden = { ...documents["11"][0], isVisible: false };
    const { rerender } = render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [hidden] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} onPreviewDocumentSelect={onPreviewDocumentSelect} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mostrar one.pdf aos clientes" })); await Promise.resolve(); });
    expect(screen.getByRole("option", { name: /one\.pdf/ })).toHaveAttribute("aria-selected", "false");
    expect(onPreviewDocumentSelect).not.toHaveBeenCalled();

    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [{ ...hidden, status: "Pending" }] }} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} onPreviewDocumentSelect={onPreviewDocumentSelect} />);
    expect(screen.queryByRole("button", { name: /one\.pdf aos clientes/ })).not.toBeInTheDocument();
    rerender(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={{ "11": [hidden] }} readOnly onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} onVisibilityChange={onVisibilityChange} />);
    expect(screen.getByRole("button", { name: "one.pdf oculto para os clientes" })).toBeDisabled();
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
