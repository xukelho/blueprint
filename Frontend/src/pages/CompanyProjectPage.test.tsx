import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { setAuthenticatedRoles } from "../auth";
import { ProfileProvider } from "../profile/ProfileContext";
import { CompanyProjectPage } from "./CompanyProjectPage";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const emptyProject = { id: 1, title: "Casa do Vale", code: "CV-001", address: "", googleMapsUrl: null, isArchived: false, client: null, members: [], phases: [], canEditTimeline: true };
const profile = (companyRole: "owner" | "employee") => ({ profileType: "employee", userId: 1, username: "ana", displayName: "Ana", fullName: "Ana Martins", nif: "123", email: "ana@example.test", phoneNumber: "910", address: "Lisboa", companyId: 1, companyName: "Forma Norte", roles: ["employee"], availableCompanies: [], companyRole, isArchitect: true });

function renderPage() {
  return render(<MemoryRouter initialEntries={["/projects/1"]}><ProfileProvider><Routes><Route path="/projects/:id" element={<CompanyProjectPage />} /><Route path="/projects" element={<p>Lista de projetos</p>} /></Routes></ProfileProvider></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("CompanyProjectPage", () => {
  it("hides empty optional fields in consultation mode", async () => {
    setAuthenticatedRoles(["employee"]);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => String(input) === "/api/profile" ? response(profile("employee")) : response(emptyProject));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Casa do Vale" })).toBeInTheDocument();
    expect(screen.getByText("CV-001")).toBeInTheDocument();
    expect(screen.queryByText("Ativo")).not.toBeInTheDocument();
    expect(screen.getByText("Sem fase atual")).toBeInTheDocument();
    expect(screen.getByText("Sem arquitetos atribuídos")).toBeInTheDocument();
    expect(screen.getByText("Localização por definir")).toBeInTheDocument();
    expect(screen.queryByText("Cliente")).not.toBeInTheDocument();
    expect(screen.queryByText("Morada")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Abrir mapa/ })).not.toBeInTheDocument();
  });

  it("presents the project context in the architectural hero", async () => {
    setAuthenticatedRoles(["employee"]);
    const project = {
      ...emptyProject,
      address: "Rua do Vale, Lisboa",
      client: { id: 7, displayName: "Marta e João" },
      members: [{ employeeId: 3, displayName: "Inês Costa", email: "ines@example.test" }],
      phases: [{ id: 11, code: "preliminary-study", label: "Estudo Prévio", position: 0, isCurrent: true }],
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => String(input) === "/api/profile" ? response(profile("employee")) : response(project));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Casa do Vale" })).toBeInTheDocument();
    expect(screen.getByText("Marta e João")).toBeInTheDocument();
    expect(screen.getAllByText("Estudo Prévio").length).toBeGreaterThan(0);
    expect(screen.getByText("Rua do Vale, Lisboa")).toBeInTheDocument();
    expect(screen.getByText("Inês Costa")).toBeInTheDocument();
  });

  it("sends the optional Google Maps URL when an owner saves", async () => {
    setAuthenticatedRoles(["employee"]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/profile") return response(profile("owner"));
      if (url === "/api/clients/" || url === "/api/projects/members") return response([]);
      if (url === "/api/projects/1" && !init?.method) return response(emptyProject);
      if (url === "/api/projects/1" && init?.method === "PUT") return response({ ...emptyProject, ...JSON.parse(String(init.body)) });
      if (url === "/api/projects/1/members") return response(emptyProject);
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Editar projeto" }));
    await user.type(screen.getByLabelText(/^Localização \(Google Maps\)/), "https://www.google.com/maps/search/?api=1&query=38.7,-9.1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/projects/1", expect.objectContaining({ method: "PUT", body: expect.stringContaining('"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=38.7,-9.1"') })));
  });

  it("shows a Google Maps preview below the saved project location", async () => {
    setAuthenticatedRoles(["employee"]);
    const project = { ...emptyProject, address: "Lisboa", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=38.7,-9.1" };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => String(input) === "/api/profile" ? response(profile("employee")) : response(project));

    renderPage();

    const preview = await screen.findByTitle("Mapa da localização do projeto Casa do Vale");
    expect(preview).toHaveAttribute("src", "https://www.google.com/maps?q=38.7%2C-9.1&output=embed");
    expect(screen.getByRole("link", { name: /Abrir no Google Maps/ })).toHaveAttribute("href", project.googleMapsUrl);
  });

  it("allows an owner to reactivate an archived project", async () => {
    setAuthenticatedRoles(["employee"]);
    const archivedProject = { ...emptyProject, isArchived: true };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/profile") return response(profile("owner"));
      if (url === "/api/clients/" || url === "/api/projects/members") return response([]);
      if (url === "/api/projects/1" && !init?.method) return response(archivedProject);
      if (url === "/api/projects/1/reactivate" && init?.method === "POST") return new Response(null, { status: 204 });
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Arquivado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar projeto" }));
    await user.click(screen.getByRole("button", { name: "Reativar" }));
    expect(screen.getByRole("alertdialog", { name: "Reativar projeto?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reativar projeto" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/projects/1/reactivate", { method: "POST" }));
  });

  it("fills and saves the quick timeline", async () => {
    setAuthenticatedRoles(["employee"]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/profile") return response(profile("owner"));
      if (url === "/api/clients/" || url === "/api/projects/members") return response([]);
      if (url === "/api/projects/1" && !init?.method) return response(emptyProject);
      if (url === "/api/projects/1/phases" && init?.method === "PUT") return response({ ...emptyProject, phases: JSON.parse(String(init.body)).phaseCodes.map((code: string, position: number) => ({ id: position + 1, code, label: code, position, isCurrent: false })) });
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Opções da timeline" }));
    await user.click(screen.getByRole("menuitem", { name: "Editar timeline" }));
    await user.click(screen.getByRole("button", { name: "Preenchimento rápido" }));
    expect(screen.getAllByText("Estudos de Viabilidade").length).toBeGreaterThan(1);
    await user.click(screen.getByRole("button", { name: "Guardar timeline" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/projects/1/phases", expect.objectContaining({ method: "PUT", body: expect.stringContaining('"currentPhaseIndex":null') })));
    expect(fetchMock.mock.calls.find(([url]) => url === "/api/projects/1/phases")?.[1]).toEqual(expect.objectContaining({ body: expect.stringContaining('"feasibility-studies"') }));
  });

  it("allows the same phase to be added more than once and saves its flagged occurrence", async () => {
    setAuthenticatedRoles(["employee"]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/profile") return response(profile("owner"));
      if (url === "/api/clients/" || url === "/api/projects/members") return response([]);
      if (url === "/api/projects/1" && !init?.method) return response(emptyProject);
      if (url === "/api/projects/1/phases" && init?.method === "PUT") return response({ ...emptyProject, phases: JSON.parse(String(init.body)).phaseCodes.map((code: string, position: number) => ({ id: position + 1, code, label: code, position, isCurrent: position === JSON.parse(String(init.body)).currentPhaseIndex })) });
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Opções da timeline" }));
    await user.click(screen.getByRole("menuitem", { name: "Editar timeline" }));
    const add = screen.getByRole("button", { name: "Adicionar Estudos de Viabilidade" });
    await user.click(add);
    await user.click(add);
    expect(screen.getAllByText("Estudos de Viabilidade")).toHaveLength(3);
    const currentPhaseFlags = screen.getAllByRole("button", { name: "Definir Estudos de Viabilidade como fase atual" });
    await user.click(currentPhaseFlags[1]);
    expect(currentPhaseFlags[0]).toHaveAttribute("aria-pressed", "false");
    expect(currentPhaseFlags[1]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: "Remover Estudos de Viabilidade" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Guardar timeline" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/projects/1/phases", expect.objectContaining({ body: expect.stringContaining('"currentPhaseIndex":1') })));
  });

  it("selects the newest DXF for each phase and falls back to an unsupported document", async () => {
    setAuthenticatedRoles(["employee"]);
    const phasedProject = { ...emptyProject, phases: [
      { id: 11, code: "preliminary-study", label: "Estudo PrÃ©vio", position: 0, isCurrent: true },
      { id: 12, code: "licensing-project", label: "Projeto de Licenciamento", position: 1, isCurrent: false },
      { id: 13, code: "execution-project", label: "Projeto de ExecuÃ§Ã£o", position: 2, isCurrent: false },
    ] };
    const document = (id: string, phaseId: number, fileName: string, uploadedAt: string, preview: { kind: "drawing"; sourceFormat: string } | null) => ({ id, phaseId, fileName, contentType: preview ? "application/dxf" : "application/pdf", length: 100, status: "Available", createdBy: 1, createdByDisplayName: "Ana Martins", createdAt: uploadedAt, uploadedAt, preview });
    const initialDrawing = document("initial-drawing", 11, "Inicial.dxf", "2026-08-12T09:00:00Z", { kind: "drawing", sourceFormat: "dxf" });
    const licensingPdf = document("licensing-pdf", 12, "Memoria.pdf", "2026-08-12T13:00:00Z", null);
    const licensingOldDrawing = document("licensing-old", 12, "Licenca_R01.dxf", "2026-08-12T11:00:00Z", { kind: "drawing", sourceFormat: "dxf" });
    const licensingNewDrawing = document("licensing-new", 12, "Licenca_R02.dxf", "2026-08-12T12:00:00Z", { kind: "drawing", sourceFormat: "dxf" });
    const executionPdf = document("execution-pdf", 13, "Caderno.pdf", "2026-08-12T14:00:00Z", null);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/profile") return response(profile("employee"));
      if (url === "/api/projects/1" && !init?.method) return response(phasedProject);
      if (url === "/api/projects/1/documents") return response([initialDrawing, licensingPdf, licensingOldDrawing, licensingNewDrawing, executionPdf]);
      if (url === "/api/projects/1/documents/initial-drawing/drawing" || url === "/api/projects/1/documents/licensing-new/drawing") return response({ schemaVersion: 1, converterVersion: "test", documentId: url.includes("initial") ? "initial-drawing" : "licensing-new", sourceFormat: "dxf", units: null, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, layers: [], paths: [], text: [], warnings: [] });
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("img", { name: /Inicial\.dxf/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Projeto de Licenciamento" }));
    expect(await screen.findByRole("img", { name: /Licenca_R02\.dxf/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Memoria\.pdf/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Licenca_R02\.dxf/ })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("option", { name: /Inicial\.dxf/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Projeto de Execu/ }));
    expect(await screen.findByText(/visualizado/)).toBeInTheDocument();
    expect(screen.getAllByText("Caderno.pdf")).toHaveLength(2);
  });

  it("switches phase documents and keeps the global conversation available", async () => {
    setAuthenticatedRoles(["employee"]);
    const phasedProject = { ...emptyProject, phases: [
      { id: 11, code: "preliminary-study", label: "Estudo Prévio", position: 0, isCurrent: true },
      { id: 12, code: "licensing-project", label: "Projeto de Licenciamento", position: 1, isCurrent: false },
    ] };
    const planDocument = { id: "document-1", phaseId: 11, fileName: "Planta_Piso_0_R03.dxf", contentType: "application/dxf", length: 8400000, status: "Available", createdBy: 1, createdByDisplayName: "Ana Martins", createdAt: "2026-08-12T09:38:00Z", uploadedAt: "2026-08-12T09:38:00Z", preview: { kind: "drawing", sourceFormat: "dxf" } };
    const uploadedDocument = { ...planDocument, id: "document-2", phaseId: 12, fileName: "Licenca_Municipal.pdf", contentType: "application/pdf", preview: null, length: 7 };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/profile") return response(profile("employee"));
      if (url === "/api/projects/1" && !init?.method) return response(phasedProject);
      if (url === "/api/projects/1/documents") return response([planDocument]);
      if (url === "/api/projects/1/documents/document-1/drawing") return response({ schemaVersion: 1, converterVersion: "test", documentId: "document-1", sourceFormat: "dxf", units: null, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, layers: [], paths: [], text: [], warnings: [] });
      if (url === "/api/projects/1/phases/12/documents/uploads" && init?.method === "POST") return response({ documentId: "document-2", storedObjectId: "object-2", upload: { url: "https://storage.test/document-2", expiresAt: "2026-08-12T10:00:00Z", requiredHeaders: { "Content-Type": "application/pdf", "X-Upload": "required" } } }, 201);
      if (url === "https://storage.test/document-2" && init?.method === "PUT") return new Response(null, { status: 200 });
      if (url === "/api/projects/1/documents/document-2/complete" && init?.method === "POST") return response({ document: uploadedDocument });
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("img", { name: "Pré-visualização de Planta_Piso_0_R03.dxf" })).toBeInTheDocument();
    const visualizerHeading = screen.getByRole("heading", { name: "Visualizador de documentos" });
    const workspace = visualizerHeading.closest(".project-workspace");
    expect(workspace).not.toBeNull();
    const maximize = screen.getByRole("button", { name: "Maximizar visualizador de documentos" });
    expect(maximize).toHaveAttribute("aria-pressed", "false");
    await user.click(maximize);
    expect(workspace).toHaveClass("is-document-viewer-maximized");
    expect(screen.getByRole("button", { name: "Repor tamanho do visualizador de documentos" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Repor tamanho do visualizador de documentos" }));
    expect(workspace).not.toHaveClass("is-document-viewer-maximized");
    const documentsToggle = screen.getByRole("button", { name: "Documentos" });
    expect(documentsToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Planta_Piso_0_R03.dxf")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Geral" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Conversa geral do projeto" })).toBeInTheDocument();
    expect(screen.queryByText("Informação essencial, participantes e fases do projeto.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Projeto de Licenciamento" }));
    const emptyDocumentsToggle = screen.getByRole("button", { name: "Documentos" });
    expect(emptyDocumentsToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Adicionar documentos/ })).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Adicionar documentos"), new File(["licença"], "Licenca_Municipal.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("option", { name: /Licenca_Municipal\.pdf/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("https://storage.test/document-2", expect.objectContaining({ method: "PUT", headers: { "Content-Type": "application/pdf", "X-Upload": "required" } }));
    expect(emptyDocumentsToggle).toHaveAttribute("aria-expanded", "true");

    await user.type(screen.getByLabelText("Nova mensagem"), "Atualização global do projeto.");
    await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(screen.getByText("Atualização global do projeto.")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Conversas" }));
    await user.click(screen.getByRole("button", { name: /Dúvidas sobre a planta/ }));
    await user.type(screen.getByLabelText("Nova mensagem"), "Vamos confirmar esta medida.");
    await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(screen.getByText("Vamos confirmar esta medida.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar à lista de conversas" }));
    expect(screen.getByText("Conversas da fase")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Ficheiros" }));
    expect(screen.getByRole("tree", { name: "Pastas de Casa do Vale" })).toBeInTheDocument();
    expect(screen.getAllByText("Projeto de Licenciamento").length).toBeGreaterThan(0);
    expect(screen.getByText("As pastas são criadas pela timeline e não podem ser movidas, renomeadas ou eliminadas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /renomear|eliminar|mover/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Geral" }));
    expect(screen.getByText("Atualização global do projeto.")).toBeInTheDocument();
  });
});
