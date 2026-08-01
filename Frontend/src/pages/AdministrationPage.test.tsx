import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdministrationPage from "./AdministrationPage";

const roles = [
  { id: 11, name: "platform admin" },
  { id: 22, name: "client" },
  { id: 33, name: "employee" },
  { id: 44, name: "architect" },
];
const users = [
  { id: 1, username: "admin", roles: [roles[0]], createdAt: "2026-01-01", createdBy: 0, updatedAt: "2026-01-01", updatedBy: 0 },
  { id: 2, username: "ana", roles: [roles[2], roles[3]], createdAt: "2026-01-01", createdBy: 0, updatedAt: "2026-01-01", updatedBy: 0 },
  { id: 3, username: "marta", roles: [roles[1]], createdAt: "2026-01-01", createdBy: 0, updatedAt: "2026-01-01", updatedBy: 0 },
];
const companies = [
  { id: 10, name: "Forma Norte", legalName: "Forma Norte, Lda.", nif: "501", email: "geral@forma.pt", phoneNumber: "210", address: "Lisboa", website: null, isActive: true, createdAt: "2026-01-01", createdBy: 0, updatedAt: "2026-01-01", updatedBy: 0 },
  { id: 20, name: "Arquivo", legalName: "Arquivo, Lda.", nif: "502", email: "arquivo@forma.pt", phoneNumber: "211", address: "Porto", website: null, isActive: false, createdAt: "2026-01-01", createdBy: 0, updatedAt: "2026-01-02", updatedBy: 0 },
];
const employees = [
  { id: 100, userId: 2, companyId: 20, displayName: "Ana Martins", fullName: "Ana Sofia Martins", nif: "123", email: "ana@forma.pt", phoneNumber: "910", address: "Lisboa" },
];
const clients = [
  { id: 200, userId: 3, companyId: null, displayName: "Marta Silva", fullName: "Marta Silva", nif: "456", email: "marta@email.pt", phoneNumber: "911", address: "Setúbal" },
];

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
const noContent = () => new Response(null, { status: 204 });

function installApiMock(
  override?: (path: string, method: string, init?: RequestInit) => Response | undefined,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const custom = override?.(path, method, init);
    if (custom) return custom;
    if (method === "GET" && path === "/api/admin/roles") return jsonResponse(roles);
    if (method === "GET" && path === "/api/admin/users") return jsonResponse(users);
    if (method === "GET" && path === "/api/admin/employees") return jsonResponse(employees);
    if (method === "GET" && path === "/api/admin/clients") return jsonResponse(clients);
    if (method === "GET" && path === "/api/admin/companies?includeInactive=true") return jsonResponse(companies);
    throw new Error(`Unexpected request: ${method} ${path}`);
  });
}

function renderPage() {
  return render(<MemoryRouter><AdministrationPage /></MemoryRouter>);
}

async function fillContact(user: ReturnType<typeof userEvent.setup>) {
  const values: Array<[string, string]> = [
    ["Nome de apresentação", "Novo Perfil"],
    ["Nome completo", "Novo Perfil Completo"],
    ["NIF", "999"],
    ["Email", "novo@example.com"],
    ["Telefone", "919"],
    ["Morada", "Coimbra"],
  ];
  for (const [label, value] of values) await user.type(screen.getByLabelText(label), value);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdministrationPage", () => {
  it("loads the new endpoints, tab order, role badges and active companies by default", async () => {
    const fetchMock = installApiMock();
    renderPage();

    expect((await screen.findAllByRole("tab")).map((tab) => tab.textContent?.replace(/\d+$/, "")))
      .toEqual(["Utilizadores", "Colaboradores", "Clientes", "Empresas"]);
    expect(await screen.findByDisplayValue("admin")).toBeInTheDocument();
    expect(screen.getAllByText("platform admin")).toHaveLength(2);
    for (const path of ["/api/admin/roles", "/api/admin/users", "/api/admin/employees", "/api/admin/clients", "/api/admin/companies?includeInactive=true"]) {
      expect(fetchMock).toHaveBeenCalledWith(path, undefined);
    }

    await userEvent.click(screen.getByRole("tab", { name: /Empresas/ }));
    expect(screen.getAllByText("Forma Norte").length).toBeGreaterThan(0);
    expect(screen.queryByText("Arquivo")).not.toBeInTheDocument();
  });

  it("creates a platform administrator with credentials only", async () => {
    const saved = { ...users[0], id: 9, username: "novo-admin" };
    const fetchMock = installApiMock((path, method) =>
      path === "/api/admin/users" && method === "POST" ? jsonResponse(saved, 201) : undefined);
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("admin");
    await user.click(screen.getByRole("button", { name: "Criar utilizador" }));
    await user.type(screen.getByLabelText("Nome de utilizador"), "novo-admin");
    await user.type(screen.getByLabelText("Palavra-passe"), "secret");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/users", expect.objectContaining({
      method: "POST", body: JSON.stringify({ username: "novo-admin", password: "secret" }),
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("Utilizador criado");
  });

  it("updates a collaborator user with the complete role set", async () => {
    const fetchMock = installApiMock((path, method, init) =>
      path === "/api/admin/users/2" && method === "PUT"
        ? jsonResponse({ ...users[1], username: JSON.parse(String(init?.body)).username })
        : undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /anaemployee, architect/ }));
    const username = screen.getByLabelText("Nome de utilizador");
    await user.clear(username);
    await user.type(username, "ana-editada");
    await user.click(screen.getByLabelText("Arquiteto/Arquiteta"));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/2", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ username: "ana-editada", password: null, roleIds: [33] }),
    })));
  });

  it("creates an employee atomically with a required company and optional architect role", async () => {
    const fetchMock = installApiMock((path, method) =>
      path === "/api/admin/employees" && method === "POST"
        ? jsonResponse({ ...employees[0], id: 101, userId: 4, companyId: 10 }, 201)
        : undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /Colaboradores/ }));
    await user.click(screen.getByRole("button", { name: "Criar colaborador" }));
    await user.type(screen.getByLabelText("Nome de utilizador"), "novo-colaborador");
    await user.type(screen.getByLabelText("Palavra-passe"), "secret");
    await user.selectOptions(screen.getByLabelText("Empresa"), "10");
    await user.click(screen.getByLabelText("Arquiteto/Arquiteta"));
    await fillContact(user);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/employees", expect.objectContaining({
      method: "POST", body: expect.stringContaining('"roleIds":[33,44]'),
    })));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/users", expect.objectContaining({ method: "POST" }));
  });

  it("creates a client atomically without a company", async () => {
    const fetchMock = installApiMock((path, method) =>
      path === "/api/admin/clients" && method === "POST"
        ? jsonResponse({ ...clients[0], id: 201, userId: 5 }, 201)
        : undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /Clientes/ }));
    await user.click(screen.getByRole("button", { name: "Criar cliente" }));
    await user.type(screen.getByLabelText("Nome de utilizador"), "novo-cliente");
    await user.type(screen.getByLabelText("Palavra-passe"), "secret");
    expect(screen.getByLabelText("Empresa (opcional)")).toHaveValue("");
    await fillContact(user);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/clients", expect.objectContaining({
      method: "POST", body: expect.stringContaining('"companyId":null'),
    })));
  });

  it.each([
    ["Colaboradores", "Eliminar", "/api/admin/employees/100"],
    ["Clientes", "Eliminar", "/api/admin/clients/200"],
  ])("deletes %s through the entity endpoint", async (tab, action, path) => {
    const fetchMock = installApiMock((requestPath, method) =>
      requestPath === path && method === "DELETE" ? noContent() : undefined);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: new RegExp(tab) }));
    await user.click(screen.getByRole("button", { name: action }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: action }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(path, { method: "DELETE" }));
  });

  it("shows inactive relationships but prevents new associations and makes inactive companies read-only", async () => {
    installApiMock();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /Colaboradores/ }));
    const companySelect = screen.getByLabelText("Empresa");
    expect(companySelect).toHaveValue("20");
    expect(within(companySelect).getByRole("option", { name: /Arquivo.*Inativa/ })).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: /Empresas/ }));
    await user.click(screen.getByLabelText("Mostrar inativas"));
    await user.click(screen.getByRole("button", { name: /ArquivoArquivo, Lda.*Inativa/ }));
    expect(screen.getByText(/apenas de leitura/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar" })).not.toBeInTheDocument();
  });

  it("creates a company with company fields only", async () => {
    const saved = { ...companies[0], id: 30, name: "Nova Empresa", legalName: "Nova Empresa, Lda." };
    const fetchMock = installApiMock((path, method) =>
      path === "/api/admin/companies" && method === "POST" ? jsonResponse(saved, 201) : undefined);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: /Empresas/ }));
    await user.click(screen.getByRole("button", { name: "Criar empresa" }));
    for (const [label, value] of [
      ["Nome", "Nova Empresa"], ["Nome legal", "Nova Empresa, Lda."], ["NIF", "509"],
      ["Email", "nova@empresa.pt"], ["Telefone", "212"], ["Morada", "Braga"],
    ]) await user.type(screen.getByLabelText(label), value);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/companies", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Nova Empresa", legalName: "Nova Empresa, Lda.", nif: "509", email: "nova@empresa.pt", phoneNumber: "212", address: "Braga", website: "" }),
    })));
  });

  it("edits and soft-deletes an active company", async () => {
    const fetchMock = installApiMock((path, method, init) => {
      if (path === "/api/admin/companies/10" && method === "PUT") {
        return jsonResponse({ ...companies[0], name: JSON.parse(String(init?.body)).name });
      }
      if (path === "/api/admin/companies/10" && method === "DELETE") return noContent();
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: /Empresas/ }));
    const name = screen.getByLabelText("Nome");
    await user.clear(name);
    await user.type(name, "Forma Renovada");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/companies/10", expect.objectContaining({ method: "PUT" })));
    await user.click(screen.getByRole("button", { name: "Desativar" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/companies/10", { method: "DELETE" }));
  });

  it("maps backend field errors and protects dirty forms", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    installApiMock((path, method) =>
      path === "/api/admin/users/1" && method === "PUT"
        ? jsonResponse({ errors: { Username: ["Já existe."] } }, 400)
        : undefined);
    const user = userEvent.setup();
    renderPage();

    const username = await screen.findByLabelText("Nome de utilizador");
    await user.type(username, "-editado");
    await user.click(screen.getByRole("tab", { name: /Clientes/ }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /Utilizadores/ })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Já existe.")).toBeInTheDocument();
  });
});
