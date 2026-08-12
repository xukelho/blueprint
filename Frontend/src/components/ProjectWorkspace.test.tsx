import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDocuments, ProjectDocumentsByPhase } from "./ProjectWorkspace";

const phases = [{ id: "11", code: "preliminary-study" }];
const document = (id: string, fileName: string) => ({ id, phaseId: 11, fileName, contentType: "application/octet-stream", length: 1000, status: "Available", createdBy: 1, createdByDisplayName: "Ana", createdAt: "2026-08-12T10:00:00Z", uploadedAt: "2026-08-12T10:00:01Z" });
const documents: ProjectDocumentsByPhase = { "11": [document("one", "one.pdf"), document("two", "two.docx"), document("three", "three.ifc")] };

afterEach(() => cleanup());

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

  it("uses category classes for common formats and a generic fallback", () => {
    const categorized: ProjectDocumentsByPhase = { "11": [
      document("pdf", "plan.pdf"), document("word", "brief.odt"), document("sheet", "costs.xlsx"),
      document("slides", "review.pptx"), document("image", "render.png"), document("archive", "bundle.zip"),
      document("model", "building.ifc"), document("text", "notes.md"), document("other", "data.xyz"),
    ] };
    const { container } = render(<ProjectDocuments phases={phases} viewedPhaseId="11" documents={categorized} onUploadFile={vi.fn()} onDeleteDocument={vi.fn()} />);
    for (const kind of ["pdf", "document", "spreadsheet", "presentation", "image", "archive", "model", "text", "generic"])
      expect(container.querySelector(`.project-document__file--${kind}`)).toBeInTheDocument();
  });
});
