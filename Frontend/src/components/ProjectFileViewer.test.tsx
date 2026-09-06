import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { filePreviewKind, ProjectFileViewer } from "./ProjectFileViewer";

const document = (fileName: string) => ({ id: "doc", phaseId: 1, fileName, contentType: "application/octet-stream", length: 10, status: "Available", createdBy: 1, createdByDisplayName: "Ana", createdAt: "2026-01-01T00:00:00Z", uploadedAt: "2026-01-01T00:00:01Z" });

afterEach(cleanup);

describe("ProjectFileViewer", () => {
  it("classifies every supported extension without affecting CAD formats", () => {
    expect(filePreviewKind("drawing.PDF")).toBe("pdf");
    expect(filePreviewKind("minutes.docx")).toBe("word");
    expect(filePreviewKind("legacy.doc")).toBe("word");
    expect(filePreviewKind("costs.xlsx")).toBe("spreadsheet");
    expect(filePreviewKind("legacy.xls")).toBe("spreadsheet");
    expect(filePreviewKind("rooms.csv")).toBe("spreadsheet");
    expect(filePreviewKind("notes.md")).toBe("text");
    expect(filePreviewKind("photo.tiff")).toBe("image");
    expect(filePreviewKind("detail.svg")).toBe("svg");
    expect(filePreviewKind("submission.zip")).toBe("zip");
    expect(filePreviewKind("model.dwg")).toBe("unsupported");
  });

  it("renders and searches plain text read-only", async () => {
    const user = userEvent.setup();
    render(<ProjectFileViewer document={document("issues.txt")} content={new Blob(["Wall issue\nDoor issue"], { type: "text/plain" })} />);
    expect(await screen.findByText(/Wall issue/)).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Pesquisar no documento" }), "issue");
    expect(screen.getByText("2 ocorrências")).toBeInTheDocument();
    expect(screen.getAllByText("issue")).toHaveLength(2);
  });

  it("renders workbook sheets and cells", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Room", "Area"], ["Kitchen", 18]]), "Rooms");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Door", "D01"]]), "Doors");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    render(<ProjectFileViewer document={document("schedule.xlsx")} content={new Blob([bytes])} />);
    expect(await screen.findByText("Kitchen")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Doors" }));
    expect(await screen.findByText("D01")).toBeInTheDocument();
  });

  it("lists ZIP entries without extracting their contents", async () => {
    const archive = new JSZip();
    archive.file("drawings/plan.pdf", "not a real pdf");
    archive.file("../unsafe.txt", "normalised by JSZip");
    const bytes = await archive.generateAsync({ type: "uint8array" });
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    render(<ProjectFileViewer document={document("submission.zip")} content={new Blob([buffer])} />);
    expect(await screen.findByText("drawings/plan.pdf")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/caminho normalizado/)).toBeInTheDocument());
    expect(screen.getByText(/nomes e tamanhos apenas/)).toBeInTheDocument();
  });
});
