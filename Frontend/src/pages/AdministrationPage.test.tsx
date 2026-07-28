import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdministrationPage from "./AdministrationPage";

const users = [
  {
    id: 1,
    roleId: 1,
    role: "platform admin",
    username: "admin",
    createdAt: "2026-07-20T10:00:00Z",
    createdBy: 1,
    updatedAt: "2026-07-20T10:00:00Z",
    updatedBy: 1,
  },
  {
    id: 2,
    roleId: 4,
    role: "architect",
    username: "ana",
    createdAt: "2026-07-21T10:00:00Z",
    createdBy: 1,
    updatedAt: "2026-07-21T10:00:00Z",
    updatedBy: 1,
  },
];

const architects = [
  {
    id: 10,
    userId: 2,
    displayName: "Ana Martins",
    fullName: "Ana Sofia Martins",
    nif: "123456789",
    email: "ana@example.com",
    phoneNumber: "910000000",
    address: "Lisboa",
  },
];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const noContentResponse = () => new Response(null, { status: 204 });

function installApiMock(
  handler?: (path: string, method: string, init?: RequestInit) => Response | undefined,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const overridden = handler?.(path, method, init);
    if (overridden) return overridden;

    if (method === "GET" && path === "/api/admin/users") return jsonResponse(users);
    if (method === "GET" && path === "/api/admin/architects") return jsonResponse(architects);
    if (method === "GET" && path === "/api/admin/clients") return jsonResponse([]);
    if (method === "GET" && path === "/api/admin/companies") return jsonResponse([]);
    throw new Error(`Unexpected request: ${method} ${path}`);
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdministrationPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdministrationPage", () => {
  it("loads the four tabs in order and selects the first user", async () => {
    installApiMock();
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("A carregar");
    const tabList = await screen.findByRole("tablist", { name: "Entidades" });
    expect(within(tabList).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Utilizadores2",
      "Arquitetos1",
      "Clientes0",
      "Empresas0",
    ]);
    expect(screen.getByRole("heading", { name: "admin", level: 2 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Nome de utilizador")).toHaveValue("admin"));
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await userEvent.click(screen.getByRole("tab", { name: /Arquitetos/ }));
    expect(screen.getByRole("heading", { name: "Ana Martins", level: 2 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Sofia Martins"));
    expect(screen.getByText("Conta associada")).toBeInTheDocument();
    expect(screen.getByText("Arquiteto", { selector: ".admin-linked-user small" })).toBeInTheDocument();
  });

  it("enables Save after an edit and updates a user", async () => {
    let currentUsers = [...users];
    const fetchMock = installApiMock((path, method, init) => {
      if (method === "GET" && path === "/api/admin/users") return jsonResponse(currentUsers);
      if (method === "PUT" && path === "/api/admin/users/1") {
        const body = JSON.parse(String(init?.body));
        currentUsers = currentUsers.map((item) =>
          item.id === 1 ? { ...item, username: body.username } : item,
        );
        return jsonResponse(currentUsers[0]);
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();

    const username = await screen.findByLabelText("Nome de utilizador");
    await waitFor(() => expect(username).toHaveValue("admin"));
    await user.clear(username);
    await user.type(username, "admin.blueprint");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Utilizador atualizado");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/users/1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ roleId: 1, username: "admin.blueprint", password: null }),
      }),
    );
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("creates the login before creating an architect profile", async () => {
    const createdUser = { ...users[1], id: 20, username: "carolina" };
    const createdProfile = {
      ...architects[0],
      id: 21,
      userId: 20,
      displayName: "Carolina",
      fullName: "Carolina Ferreira",
    };
    const fetchMock = installApiMock((path, method) => {
      if (method === "POST" && path === "/api/admin/users") return jsonResponse(createdUser, 201);
      if (method === "POST" && path === "/api/admin/architects") return jsonResponse(createdProfile, 201);
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /Arquitetos/ }));
    await user.click(screen.getByRole("button", { name: "Criar arquiteto" }));
    await user.type(screen.getByLabelText("Nome de utilizador"), "carolina");
    await user.type(screen.getByLabelText("Palavra-passe"), "secret");
    await user.type(screen.getByLabelText("Nome de apresentação"), "Carolina");
    await user.type(screen.getByLabelText("Nome completo"), "Carolina Ferreira");
    await user.type(screen.getByLabelText("NIF"), "987654321");
    await user.type(screen.getByLabelText("Email"), "carolina@example.com");
    await user.type(screen.getByLabelText("Telefone"), "920000000");
    await user.type(screen.getByLabelText("Morada"), "Porto");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ roleId: 4, username: "carolina", password: "secret" }),
      }),
    ));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/architects",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"userId":20'),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Arquiteto criado");
  });

  it("removes the new user when profile creation fails", async () => {
    const createdUser = { ...users[1], id: 30, username: "falha" };
    const fetchMock = installApiMock((path, method) => {
      if (method === "POST" && path === "/api/admin/users") return jsonResponse(createdUser, 201);
      if (method === "POST" && path === "/api/admin/architects") {
        return jsonResponse({ error: "The selected user already has a profile." }, 409);
      }
      if (method === "DELETE" && path === "/api/admin/users/30") return noContentResponse();
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /Arquitetos/ }));
    await user.click(screen.getByRole("button", { name: "Criar arquiteto" }));
    const values: Array<[string, string]> = [
      ["Nome de utilizador", "falha"],
      ["Palavra-passe", "secret"],
      ["Nome de apresentação", "Falha"],
      ["Nome completo", "Perfil com Falha"],
      ["NIF", "123"],
      ["Email", "falha@example.com"],
      ["Telefone", "910"],
      ["Morada", "Lisboa"],
    ];
    for (const [label, value] of values) await user.type(screen.getByLabelText(label), value);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already has a profile");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/30", { method: "DELETE" });
  });

  it("protects unsaved changes and deletes a profile through its linked user", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = installApiMock((path, method) => {
      if (method === "DELETE" && path === "/api/admin/users/2") return noContentResponse();
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /Arquitetos/ }));
    await user.type(screen.getByLabelText("Nome de apresentação"), " editado");
    await user.click(screen.getByRole("tab", { name: /Clientes/ }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /Arquitetos/ })).toHaveAttribute("aria-selected", "true");

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/2", { method: "DELETE" }));
  });
});
