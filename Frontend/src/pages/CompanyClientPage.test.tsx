import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

const response = (body: unknown, status = 200) => new Response(
  status === 204 ? null : JSON.stringify(body),
  { status, headers: status === 204 ? undefined : { "Content-Type": "application/json" } },
);

const ownerProfile = {
  profileType: "employee",
  userId: 2,
  username: "owner",
  displayName: "Ana Martins",
  fullName: "Ana Martins",
  nif: "123",
  email: "ana@example.test",
  phoneNumber: "910000000",
  address: "Lisboa",
  companyId: 10,
  companyName: "Forma Norte",
  roles: ["employee", "company owner"],
  availableCompanies: [{ id: 10, name: "Forma Norte" }],
  companyRole: "owner",
  isArchitect: false,
};

const clients = [
  { id: 30, displayName: "Marta Silva", email: "marta@example.test", projectCount: 2 },
];
const invitations = [
  { id: 40, email: "pending@example.test", sentAt: "2026-08-03T10:00:00Z", expiresAt: "2026-08-06T10:00:00Z" },
];

function renderRoute(path = "/clients") {
  sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee", "company owner"]));
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("CompanyClientPage", () => {
  it("shows pending invitations first in initially expanded collapsible groups", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/profile") return response(ownerProfile);
      if (path === "/api/clients/") return response(clients);
      if (path === "/api/client-invitations/") return response(invitations);
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderRoute();

    const pendingHeading = await screen.findByRole("button", { name: /Convites pendentes/ });
    const confirmedHeading = screen.getByRole("button", { name: /^Clientes1$/ });
    expect(pendingHeading).toHaveAttribute("aria-expanded", "true");
    expect(confirmedHeading).toHaveAttribute("aria-expanded", "true");
    expect(pendingHeading.compareDocumentPosition(confirmedHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("pending@example.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marta Silva/ })).toBeInTheDocument();

    await user.click(pendingHeading);
    expect(pendingHeading).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("pending@example.test")).not.toBeInTheDocument();
  });

  it("renders the confirmed grid without group headings when there are no pending invitations", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/profile") return response({ ...ownerProfile, companyRole: "employee" });
      if (path === "/api/clients/") return response(clients);
      if (path === "/api/client-invitations/") return response([]);
      throw new Error(`Unexpected request: ${path}`);
    });
    renderRoute();

    expect(await screen.findByRole("button", { name: /Marta Silva/ })).toBeInTheDocument();
    expect(screen.queryByText("Convites pendentes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Clientes\d+$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convidar cliente" })).not.toBeInTheDocument();
  });

  it("searches both groups and shows filtered group counts and empty states", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/profile") return response(ownerProfile);
      if (path === "/api/clients/") return response(clients);
      if (path === "/api/client-invitations/") return response(invitations);
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderRoute();

    await screen.findByText("pending@example.test");
    await user.type(screen.getByPlaceholderText("Pesquisar por nome ou email"), "missing");

    expect(screen.getByText("0 clientes · 0 pendentes")).toBeInTheDocument();
    expect(screen.getByText("Nenhum convite pendente corresponde à pesquisa.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum cliente confirmado corresponde à pesquisa.")).toBeInTheDocument();
  });

  it("allows an owner to create an invitation and refreshes the pending UI", async () => {
    let invitationCreated = false;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === "/api/profile") return response(ownerProfile);
      if (path === "/api/clients/") return response(clients);
      if (path === "/api/client-invitations/" && init?.method === "POST") {
        invitationCreated = true;
        return response({ id: 41, email: "new@example.test", sentAt: "2026-08-03T10:00:00Z", expiresAt: "2026-08-06T10:00:00Z" }, 201);
      }
      if (path === "/api/client-invitations/") return response(invitationCreated ? [{ id: 41, email: "new@example.test", sentAt: "2026-08-03T10:00:00Z", expiresAt: "2026-08-06T10:00:00Z" }] : []);
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderRoute();

    await user.click(await screen.findByRole("button", { name: "Convidar cliente" }));
    await user.type(screen.getByLabelText("Email do cliente"), "new@example.test");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByText("new@example.test")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Convite criado");
    expect(fetchMock).toHaveBeenCalledWith("/api/client-invitations/", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "new@example.test" }),
    }));
    expect(fetchMock.mock.calls.filter(([path, init]) => path === "/api/client-invitations/" && !init).length).toBe(2);
  });

  it("keeps the invite dialog open and reports duplicate invitation errors", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === "/api/profile") return response(ownerProfile);
      if (path === "/api/clients/") return response(clients);
      if (path === "/api/client-invitations/" && init?.method === "POST") {
        return response({ error: "An invitation is already pending for this email." }, 409);
      }
      if (path === "/api/client-invitations/") return response(invitations);
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderRoute();

    await user.click(await screen.findByRole("button", { name: "Convidar cliente" }));
    await user.type(screen.getByLabelText("Email do cliente"), "pending@example.test");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already pending");
    expect(screen.getByRole("heading", { name: "Convidar cliente" })).toBeInTheDocument();
  });

  it("keeps biography fields read-only and saves only internal notes", async () => {
    const detail = {
      ...clients[0],
      fullName: "Marta Isabel Silva",
      nif: "123456789",
      phoneNumber: "910000000",
      address: "Lisboa",
      internalNotes: "Nota inicial",
      projects: [],
      canManageProjects: false,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === "/api/profile") return response(ownerProfile);
      if (path === "/api/clients/30" && init?.method === "PUT") return response(null, 204);
      if (path === "/api/clients/30") return response(detail);
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderRoute("/clients/30");

    expect(await screen.findByDisplayValue("Marta Isabel Silva")).toHaveAttribute("readonly");
    const notes = screen.getByLabelText("Notas internas");
    expect(notes).not.toHaveAttribute("readonly");
    await user.clear(notes);
    await user.type(notes, "Nota da empresa");
    await user.click(screen.getByRole("button", { name: "Guardar notas" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/clients/30/notes", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ internalNotes: "Nota da empresa" }),
    })));
    expect(screen.queryByText("Contacto")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Iniciais de Marta Silva")).toHaveTextContent("MS");
  });

  it("shows available projects as selectable cards and toggles their association", async () => {
    const projectCatalog = [
      { id: 1, companyId: 10, companyName: "Forma Norte", title: "Casa Atual", code: "CA-1", address: "Lisboa", googleMapsUrl: null, isArchived: false, client: { id: 30, displayName: "Marta Silva" }, currentPhaseCode: null },
      { id: 2, companyId: 10, companyName: "Forma Norte", title: "Casa Livre", code: "CL-2", address: "Porto", googleMapsUrl: null, isArchived: false, client: null, currentPhaseCode: null },
      { id: 3, companyId: 10, companyName: "Forma Norte", title: "Casa Ocupada", code: "CO-3", address: "Faro", googleMapsUrl: null, isArchived: false, client: { id: 99, displayName: "Outro cliente" }, currentPhaseCode: null },
    ];
    const associated = new Set([1]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === "/api/profile") return response(ownerProfile);
      if (path === "/api/projects/") return response(projectCatalog);
      if (path === "/api/clients/30/projects/2" && init?.method === "PUT") {
        associated.add(2);
        return response(null, 204);
      }
      if (path === "/api/clients/30/projects/1" && init?.method === "DELETE") {
        associated.delete(1);
        return response(null, 204);
      }
      if (path === "/api/clients/30") return response({
        ...clients[0],
        fullName: "Marta Isabel Silva",
        nif: "123456789",
        phoneNumber: "910000000",
        address: "Lisboa",
        internalNotes: "",
        projects: projectCatalog.filter((project) => associated.has(project.id)).map(({ id, title, code, currentPhaseCode, isArchived }) => ({ id, title, code, currentPhaseCode, isArchived })),
        canManageProjects: true,
      });
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderRoute("/clients/30");

    const assignedCard = await screen.findByRole("button", { name: "Remover projeto Casa Atual" });
    const availableCard = await screen.findByRole("button", { name: "Associar projeto Casa Livre" });
    expect(assignedCard).toHaveAttribute("aria-pressed", "true");
    expect(availableCard).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Casa Ocupada")).not.toBeInTheDocument();

    await user.click(availableCard);
    expect(await screen.findByRole("button", { name: "Remover projeto Casa Livre" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).toHaveBeenCalledWith("/api/clients/30/projects/2", expect.objectContaining({ method: "PUT" }));

    await user.click(screen.getByRole("button", { name: "Remover projeto Casa Atual" }));
    expect(await screen.findByRole("button", { name: "Associar projeto Casa Atual" })).toHaveAttribute("aria-pressed", "false");
    expect(fetchMock).toHaveBeenCalledWith("/api/clients/30/projects/1", expect.objectContaining({ method: "DELETE" }));
  });
});
