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
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Sem fase atual")).toBeInTheDocument();
    expect(screen.getByText("0 arquitetos")).toBeInTheDocument();
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
    expect(screen.getByText("1 arquiteto")).toBeInTheDocument();
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

  it("switches the floor-plan context and phase conversations without removing the global thread", async () => {
    setAuthenticatedRoles(["employee"]);
    const phasedProject = { ...emptyProject, phases: [
      { id: 11, code: "preliminary-study", label: "Estudo Prévio", position: 0, isCurrent: true },
      { id: 12, code: "licensing-project", label: "Projeto de Licenciamento", position: 1, isCurrent: false },
    ] };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => String(input) === "/api/profile" ? response(profile("employee")) : response(phasedProject));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("img", { name: "Planta ilustrativa do piso térreo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conversa geral do projeto/ })).toBeInTheDocument();
    expect(screen.queryByText("Informação essencial, participantes e fases do projeto.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Projeto de Licenciamento" }));
    expect(screen.getAllByText("Projeto de Licenciamento").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Conversa geral do projeto/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Dúvidas sobre a planta/ }));
    await user.type(screen.getByLabelText("Nova mensagem"), "Vamos confirmar esta medida.");
    await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(screen.getByText("Vamos confirmar esta medida.")).toBeInTheDocument();
  });
});
