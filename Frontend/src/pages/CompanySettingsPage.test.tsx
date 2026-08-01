import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CompanySettingsPage from "./CompanySettingsPage";

const company = {
  id: 10,
  name: "Forma Norte",
  legalName: "Forma Norte, Lda.",
  nif: "501234567",
  email: "geral@forma.pt",
  phoneNumber: "210000000",
  address: "Lisboa",
  website: null,
  isActive: true,
  createdAt: "2026-01-01",
  createdBy: 0,
  updatedAt: "2026-01-01",
  updatedBy: 0,
};

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CompanySettingsPage />
    </MemoryRouter>,
  );
}

describe("CompanySettingsPage", () => {
  it("manages company members from the members and permissions section", async () => {
    const member = {
      employeeId: 31,
      userId: 41,
      username: "ana.martins",
      displayName: "Ana",
      fullName: "Ana Martins",
      companyRole: "employee",
      isArchitect: false,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/company") return response(company);
      if (url === "/api/company/members/" && !init?.method) return response([member]);
      if (url === "/api/company/members/" && init?.method === "POST") return response({ ...member, employeeId: 32, userId: 42, username: "bruno.silva", displayName: "Bruno", fullName: "Bruno Silva" }, 201);
      if (url === "/api/company/members/31" && init?.method === "PUT") return response({ ...member, ...JSON.parse(String(init.body)) });
      if (url === "/api/company/members/31" && init?.method === "DELETE") return new Response(null, { status: 204 });
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Membros/ }));
    await screen.findAllByText("Ana Martins");
    expect(screen.queryByText("ana.martins")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ana Martins")).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText(/Função de Ana/), "owner");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/company/members/31", expect.objectContaining({ method: "PUT", body: expect.stringContaining('"companyRole":"owner"') })));
    await user.click(screen.getByLabelText(/Arquiteto\/a Ana/));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/company/members/31", expect.objectContaining({ method: "PUT", body: expect.stringContaining('"isArchitect":true') })));

    await user.click(screen.getByRole("button", { name: "Criar membro" }));
    const createDialog = screen.getByRole("dialog", { name: "Criar membro" });
    await user.type(within(createDialog).getByLabelText("Nome de utilizador"), "bruno.silva");
    await user.type(within(createDialog).getByLabelText("Palavra-passe temporária"), "secret");
    await user.type(within(createDialog).getByLabelText("Nome de apresentação"), "Bruno");
    await user.type(within(createDialog).getByLabelText("Nome completo"), "Bruno Silva");
    await user.click(within(createDialog).getByRole("button", { name: "Criar membro" }));
    expect(await screen.findByText("Bruno Silva")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Desativar Ana" }));
    const deactivateDialog = screen.getByRole("alertdialog", { name: "Desativar membro?" });
    expect(within(deactivateDialog).getByText(/Ana deixará de ter acesso/)).toBeInTheDocument();
    await user.click(within(deactivateDialog).getByRole("button", { name: "Desativar membro" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/company/members/31", expect.objectContaining({ method: "DELETE" })));
  });

  it("loads the atelier and saves controlled company fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) =>
      init?.method === "PUT"
        ? response({ ...company, ...JSON.parse(String(init.body)), website: " atelier.pt " })
        : response(company),
    );
    const user = userEvent.setup();
    renderPage();

    const name = await screen.findByLabelText("Nome do atelier");
    expect(name).toHaveValue("Forma Norte");
    expect(screen.getByLabelText("Website")).toHaveValue("");
    expect(screen.queryByText("Perfil e conta")).not.toBeInTheDocument();
    expect(screen.queryByText("Segurança e sessões")).not.toBeInTheDocument();
    expect(screen.queryByText("Preferências gerais")).not.toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "Forma Renovada");
    await user.type(screen.getByLabelText("Website"), " atelier.pt ");
    await user.click(screen.getByRole("button", { name: "Guardar alterações" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/company", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining('"name":"Forma Renovada"'),
    })));
    expect(await screen.findByRole("button", { name: "Alterações guardadas" })).toBeInTheDocument();
  });

  it("shows load failures and backend field errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(company))
      .mockResolvedValueOnce(response({ errors: { Name: ["Name is required."] } }, 400));
    const user = userEvent.setup();
    renderPage();

    const name = await screen.findByLabelText("Nome do atelier");
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "Guardar alterações" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
