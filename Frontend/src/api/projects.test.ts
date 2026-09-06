import { afterEach, describe, expect, it, vi } from "vitest";
import { createProjectDocumentDownload, getProjectMessages, sendProjectMessage, uploadProjectDocument } from "./projects";

afterEach(() => vi.restoreAllMocks());

describe("project document API", () => {
  it("creates a temporary download grant for a document", async () => {
    const grant = { url: "https://storage.test/download", expiresAt: "2026-08-12T10:15:00Z" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(grant), { headers: { "Content-Type": "application/json" } }));

    await expect(createProjectDocumentDownload("1", "document-1")).resolves.toEqual(grant);

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/1/documents/document-1/download", { method: "POST" });
  });

  it("uses a binary MIME fallback and forwards every required upload header", async () => {
    const completedDocument = { id: "document-1", phaseId: 12, fileName: "drawing.unknown", contentType: "application/octet-stream", length: 3, status: "Available", createdBy: 1, createdByDisplayName: "Ana", createdAt: "2026-08-12T10:00:00Z", uploadedAt: "2026-08-12T10:00:01Z" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/projects/1/phases/12/documents/uploads") return new Response(JSON.stringify({ documentId: "document-1", storedObjectId: "object-1", upload: { url: "https://storage.test/object-1", expiresAt: "2026-08-12T10:15:00Z", requiredHeaders: { "Content-Type": "application/octet-stream", "X-Required": "yes" } } }), { status: 201, headers: { "Content-Type": "application/json" } });
      if (url === "https://storage.test/object-1") return new Response(null, { status: 200 });
      if (url === "/api/projects/1/documents/document-1/complete") return new Response(JSON.stringify({ document: completedDocument }), { status: 200, headers: { "Content-Type": "application/json" } });
      throw new Error(`Unexpected request: ${url}`);
    });

    const file = new File(["abc"], "drawing.unknown");
    await expect(uploadProjectDocument("1", "12", file)).resolves.toEqual(completedDocument);

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/1/phases/12/documents/uploads", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ fileName: "drawing.unknown", contentType: "application/octet-stream", length: 3 }),
    }));
    expect(fetchMock).toHaveBeenCalledWith("https://storage.test/object-1", expect.objectContaining({
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream", "X-Required": "yes" },
      body: file,
    }));
  });
});

describe("project chat API", () => {
  it("uses cursor query parameters and posts plain message text", async () => {
    const page = { items: [], hasMore: false };
    const created = { id: 4, authorDisplayName: "Ana", body: "Olá", createdAt: "2026-09-06T12:00:00Z", isOwn: true };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input) === "/api/projects/7/messages?afterId=3&limit=50") return new Response(JSON.stringify(page), { headers: { "Content-Type": "application/json" } });
      if (String(input) === "/api/projects/7/messages" && init?.method === "POST") return new Response(JSON.stringify(created), { status: 201, headers: { "Content-Type": "application/json" } });
      throw new Error(`Unexpected request: ${input}`);
    });

    await expect(getProjectMessages("7", { afterId: 3, limit: 50 })).resolves.toEqual(page);
    await expect(sendProjectMessage("7", "Olá")).resolves.toEqual(created);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/projects/7/messages", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: "Olá" }) }));
  });
});
