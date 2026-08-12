import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadProjectDocument } from "./projects";

afterEach(() => vi.restoreAllMocks());

describe("project document API", () => {
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
